import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { TVDisplay } from "@/components/tv-display";
import { audioSystem } from "@/lib/audio-system";
import { Button } from "@/components/ui/button";
import { Monitor, Copy, Check } from "lucide-react";
import { type TvQueueItem } from "@shared/schema";
import { EodResetBanner } from "@/components/eod-reset-banner";
import { applyEodWarning, applyEodPostponed, applyEodCompleted } from "@/lib/eod-reset-store";

interface QueueItem {
  id: string;
  name: string;
  number: string;
  room: string;
  status: "waiting" | "calling" | "completed";
  timestamp: Date;
  calledAt?: Date | null;
  requeueReason?: string | null;
  // Family/Batch group fields
  groupMembers?: Array<{ id: string; name: string | null; number: number }>;
  groupName?: string | null;
}

interface TvStandaloneProps {
  token: string;
}

interface TvBrowserCompatibility {
  userAgent: string;
  blockingIssues: string[];
  warnings: string[];
  audio: string;
}

function inspectTvBrowser(): TvBrowserCompatibility {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';

  if (typeof window.fetch !== 'function') {
    blockingIssues.push('Fetch API tiada');
  }
  if (typeof window.Promise !== 'function') {
    blockingIssues.push('Promise tiada');
  }
  if (typeof window.WebSocket !== 'function') {
    warnings.push('WebSocket tiada — sistem akan guna polling HTTP');
  }

  const audio = typeof document !== 'undefined' ? document.createElement('audio') : null;
  const mp3Supported = !!audio?.canPlayType?.('audio/mpeg');
  const wavSupported = !!audio?.canPlayType?.('audio/wav');
  const webAudioSupported = !!((window as any).AudioContext || (window as any).webkitAudioContext);
  // Audio capability affects announcements, but must not prevent the visual
  // queue from loading. Report it as a warning so the TV can still display.
  if (!mp3Supported) warnings.push('Audio MP3 tiada — paparan akan berjalan tanpa bunyi');
  if (!wavSupported) {
    warnings.push('Audio WAV tiada — bunyi MP3 fallback akan digunakan');
  }
  if (!webAudioSupported) {
    warnings.push('Web Audio tiada — HTML Audio fallback akan digunakan');
  }
  if (!(document.documentElement as any).requestFullscreen && !(document.documentElement as any).webkitRequestFullscreen) {
    warnings.push('Fullscreen API tiada — paparan akan guna mod penuh tanpa API fullscreen');
  }
  if (typeof (window as any).ResizeObserver !== 'function') {
    warnings.push('ResizeObserver tiada — saiz akan guna fallback resize');
  }

  return {
    userAgent,
    blockingIssues,
    warnings,
    audio: `${mp3Supported ? 'MP3 OK' : 'MP3 TIADA'} / ${wavSupported ? 'WAV OK' : 'WAV TIADA'} / ${webAudioSupported ? 'WebAudio OK' : 'WebAudio TIADA'}`,
  };
}

export default function TvStandalone({ token }: TvStandaloneProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [showExitButton, setShowExitButton] = useState(false);
  const [validating, setValidating] = useState(true);
  const [clinicInfo, setClinicInfo] = useState<{ clinicName: string; isActive: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [browserCompatibility] = useState<TvBrowserCompatibility>(() => inspectTvBrowser());
  const queryClient = useQueryClient();

  useEffect(() => {
    fetch(`/api/tv/${token}`)
      .then(res => {
        if (!res.ok) throw new Error("Token tidak sah");
        return res.json();
      })
      .then(data => {
        setClinicInfo(data);
        setValidating(false);
      })
      .catch(() => {
        setError("Link TV tidak sah atau klinik tidak aktif.");
        setValidating(false);
      });
  }, [token]);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'color-scheme';
    meta.content = 'light only';
    document.head.appendChild(meta);

    const metaDark = document.createElement('meta');
    metaDark.name = 'supported-color-schemes';
    metaDark.content = 'light only';
    document.head.appendChild(metaDark);

    document.documentElement.style.colorScheme = 'light';
    document.body.style.colorScheme = 'light';

    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');

    const MutationObserverCtor = (window as any).MutationObserver;
    const observer = typeof MutationObserverCtor === 'function'
      ? new MutationObserverCtor((mutations: MutationRecord[]) => {
          for (const mutation of mutations) {
            if (mutation.attributeName === 'class') {
              const root = document.documentElement;
              if (root.classList.contains('dark')) {
                root.classList.remove('dark');
                root.classList.add('light');
              }
            }
          }
        })
      : null;
    if (observer) {
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    } else {
      console.warn('[TV] MutationObserver tiada — dark-mode guard disabled');
    }

    const forceLightStyle = document.createElement('style');
    forceLightStyle.id = 'tv-force-light';
    forceLightStyle.textContent = `
      .tv-white-bg {
        background-color: #ffffff !important;
        background-image: linear-gradient(#ffffff, #ffffff) !important;
        color: #111827 !important;
      }
      @media (prefers-color-scheme: dark) {
        .tv-white-bg {
          background-color: #ffffff !important;
          background-image: linear-gradient(#ffffff, #ffffff) !important;
          color: #111827 !important;
        }
      }
      .tv-force-light {
        color-scheme: light !important;
        forced-color-adjust: none !important;
      }
    `;
    document.head.appendChild(forceLightStyle);

    return () => {
      observer?.disconnect();
      document.head.removeChild(meta);
      document.head.removeChild(metaDark);
      document.head.removeChild(forceLightStyle);
      document.documentElement.style.colorScheme = '';
      document.body.style.colorScheme = '';
    };
  }, []);

  useEffect(() => {
    if (!clinicInfo) return;

    const socket: Socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      reconnectionAttempts: Infinity,
      timeout: 10000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[TV WS] Connected:', socket.id);
      socket.emit('tv:join', { token });
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/patients`] });
    });

    socket.on('tv:joined', (data) => {
      // TV joined clinic room
    });

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedRefetchPatients = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/patients`] });
      }, 300);
    };

    const patientEvents = [
      'patient:called', 'patient:updated', 'patient:created',
      'patient:status-updated', 'patient:deleted', 'patient:priority-updated',
      'patient:group-called', 'patient:group-linked',
      'queue:updated', 'queue:reset', 'window:created', 'window:updated',
      'window:patient-updated'
    ];
    patientEvents.forEach(evt => socket.on(evt, debouncedRefetchPatients));

    socket.on('settings:updated', () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/settings`] });
      // ✅ FIX: media list depends on youtubeUrl + dashboardMediaType settings.
      // Without this, switching combine/own/youtube mode (or changing the URL)
      // takes up to 3 minutes (next poll) for the youtube-audio item to appear/disappear.
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/media/active`] });
    });

    socket.on('media:updated', () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/media/active`] });
    });

    // End-of-day reset events
    socket.on('system:eod-warning', (data: any) => {
      applyEodWarning({ scheduledAt: data.scheduledAt, message: data.message });
    });
    socket.on('system:eod-postponed', (data: any) => {
      applyEodPostponed({ scheduledAt: data.scheduledAt, postponeCount: data.postponeCount, message: data.message });
    });
    socket.on('system:eod-completed', (data: any) => {
      applyEodCompleted({ count: data.count, forced: !!data.forced, reason: data.reason });
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/patients`] });
    });

    socket.on('connect_error', (socketError) => {
      console.warn('[TV WS] Connection error; retrying automatically:', socketError.message);
    });

    const manager = socket.io;
    manager.on('reconnect_attempt', (attemptNumber) => {
      console.log('[TV WS] Reconnection attempt:', attemptNumber);
    });
    manager.on('reconnect', (attemptNumber) => {
      console.log('[TV WS] Reconnected after attempt:', attemptNumber);
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/patients`] });
    });
    manager.on('reconnect_error', (socketError) => {
      console.warn('[TV WS] Reconnection error:', socketError.message);
    });

    socket.on('disconnect', (reason) => {
      console.warn('[TV WS] Disconnected:', reason);
    });

    const forceReconnectIfNeeded = (source: string) => {
      if (!socket.connected) {
        console.log(`[TV WS] Reconnect requested (${source})`);
        socket.connect();
      }
    };
    const handleOnline = () => forceReconnectIfNeeded('browser-online');
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        forceReconnectIfNeeded('screen-visible');
      }
    };
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    const reconnectWatchdog = window.setInterval(() => {
      forceReconnectIfNeeded('watchdog');
    }, 10000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.clearInterval(reconnectWatchdog);
      manager.off('reconnect_attempt');
      manager.off('reconnect');
      manager.off('reconnect_error');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clinicInfo, token, queryClient]);

  const { data: tvPatients = [] } = useQuery<TvQueueItem[]>({
    queryKey: [`/api/tv/${token}/patients`],
    enabled: !!clinicInfo,
    staleTime: 30000,
    refetchInterval: 15000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  const { data: settingsData = [] } = useQuery<Array<{key: string; value: string}>>({
    queryKey: [`/api/tv/${token}/settings`],
    enabled: !!clinicInfo,
    staleTime: 120000,
    refetchInterval: 120000,
    refetchOnWindowFocus: false,
  });

  const { data: activeMedia = [] } = useQuery<any[]>({
    queryKey: [`/api/tv/${token}/media/active`],
    enabled: !!clinicInfo,
    // Schedules can change at the minute boundary; refresh often enough to
    // switch slots without requiring a page reload. WebSocket invalidation
    // still makes manual edits appear immediately.
    staleTime: 60000,
    refetchInterval: 60000,
    refetchOnWindowFocus: false,
  });

  const settings = settingsData.reduce((acc: Record<string, any>, setting) => {
    acc[setting.key] = setting.value === "true" ? true : setting.value === "false" ? false : setting.value;
    return acc;
  }, {});

  const showPrayerTimes = settings.showPrayerTimes === true;
  const showWeather = settings.showWeather === true;
  const clinicName = settings.clinicName || clinicInfo?.clinicName || "KLINIK UTAMA 24 JAM";

  const callLogRef = useRef<Array<{ logId: string; patientId: string; name: string; room: string; calledAt: Date }>>([]);
  const prevSnapshotRef = useRef<Map<string, { calledAt: string | null; windowName: string | null; status: string }>>(new Map());
  const seededRef = useRef(false);
  const [callLogVersion, setCallLogVersion] = useState(0);

  useEffect(() => {
    if (tvPatients.length === 0) return;

    let changed = false;

    if (!seededRef.current) {
      seededRef.current = true;
      const allCallEvents: Array<{ logId: string; patientId: string; name: string; room: string; calledAt: Date }> = [];
      for (const p of tvPatients) {
        const name = p.name || `No. ${p.number}`;
        if (p.callHistory && p.callHistory.length > 0) {
          for (const ch of p.callHistory) {
            allCallEvents.push({
              logId: `${p.id}-init-${new Date(ch.calledAt).getTime()}`,
              patientId: p.id,
              name,
              room: ch.room,
              calledAt: new Date(ch.calledAt),
            });
          }
        } else if (p.calledAt) {
          allCallEvents.push({
            logId: `${p.id}-init-${new Date(p.calledAt).getTime()}`,
            patientId: p.id,
            name,
            room: p.windowName || "N/A",
            calledAt: new Date(p.calledAt),
          });
        }
      }
      allCallEvents.sort((a, b) => b.calledAt.getTime() - a.calledAt.getTime());
      callLogRef.current = allCallEvents;
      changed = true;
    } else {
      const prevSnapshot = prevSnapshotRef.current;
      for (const p of tvPatients) {
        if (p.status === "called" && p.calledAt) {
          const calledAtStr = new Date(p.calledAt).toISOString();
          const prev = prevSnapshot.get(p.id);
          const isNewCall = !prev || prev.status !== "called";
          const isRecall = prev && prev.status === "called" && prev.calledAt !== calledAtStr;

          if (isNewCall || isRecall) {
            callLogRef.current.unshift({
              logId: `${p.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              patientId: p.id,
              name: p.name || `No. ${p.number}`,
              room: p.windowName || "N/A",
              calledAt: new Date(p.calledAt),
            });
            changed = true;
          }
        }
      }
    }

    const newSnapshot = new Map<string, { calledAt: string | null; windowName: string | null; status: string }>();
    for (const p of tvPatients) {
      const calledAtStr = p.calledAt ? new Date(p.calledAt).toISOString() : null;
      newSnapshot.set(p.id, { calledAt: calledAtStr, windowName: p.windowName || null, status: p.status });
    }
    prevSnapshotRef.current = newSnapshot;

    if (callLogRef.current.length > 20) {
      callLogRef.current = callLogRef.current.slice(0, 20);
    }

    if (changed) {
      setCallLogVersion(v => v + 1);
    }
  }, [tvPatients]);

  const { currentPatient, queueHistory } = useMemo(() => {
    const current = (() => {
      const calledPatients = tvPatients
        .filter(p => p.status === "called" && p.calledAt)
        .sort((a, b) => {
          const aTime = a.calledAt ? new Date(a.calledAt).getTime() : 0;
          const bTime = b.calledAt ? new Date(b.calledAt).getTime() : 0;
          return bTime - aTime;
        });
      const p = calledPatients[0];
      if (!p) return null;

      // TV batch detection: only show groupMembers if ALL members are called to the SAME room
      // AND within 30 seconds of each other (true batch call). Otherwise show single name only.
      const tvGroupMembers = (() => {
        if (!p.groupId || !p.windowId || !p.groupMembers) return undefined;
        const sameRoomMembers = p.groupMembers.filter(m => {
          const member = tvPatients.find(pt => pt.id === m.id);
          return member && member.status === "called" && member.windowId === p.windowId;
        });
        if (sameRoomMembers.length <= 1) return undefined;
        const calledAts = sameRoomMembers
          .map(m => {
            const member = tvPatients.find(pt => pt.id === m.id);
            return member?.calledAt;
          })
          .filter(Boolean) as string[];
        if (calledAts.length <= 1) return undefined;
        const timestamps = calledAts.map(t => new Date(t).getTime()).sort((a, b) => a - b);
        const maxDiff = timestamps[timestamps.length - 1] - timestamps[0];
        return maxDiff <= 30000 ? sameRoomMembers : undefined;
      })();

      return {
        id: p.id,
        name: p.name || `No. ${p.number}`,
        number: p.number.toString(),
        room: p.windowName || "Not available",
        status: "calling" as const,
        timestamp: p.calledAt ? new Date(p.calledAt) : new Date(),
        calledAt: p.calledAt ? new Date(p.calledAt) : null,
        requeueReason: p.requeueReason,
        groupMembers: tvGroupMembers,
        groupName: p.groupName ?? undefined,
      };
    })();

    const history: QueueItem[] = [...callLogRef.current]
      .sort((a, b) => b.calledAt.getTime() - a.calledAt.getTime())
      .filter(entry => !current || entry.patientId !== current.id || entry.calledAt.getTime() !== current.calledAt?.getTime())
      .slice(0, 4)
      .map(entry => ({
        id: entry.logId,
        name: entry.name,
        number: "",
        room: entry.room,
        status: "completed" as const,
        timestamp: entry.calledAt,
        calledAt: entry.calledAt,
      }));

    return { currentPatient: current, queueHistory: history };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvPatients, callLogVersion]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const doc = document as any;
      const isFs = !!(document.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement);
      setFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const setTVHeight = () => {
      const container = document.getElementById('tv-container');
      const supportsDvh = typeof CSS !== 'undefined'
        && typeof CSS.supports === 'function'
        && CSS.supports('height', '100dvh');
      if (container && !supportsDvh) {
        const vh = window.innerHeight;
        container.style.height = `${vh}px`;
        container.style.minHeight = `${vh}px`;
      }
    };
    setTVHeight();
    window.addEventListener('resize', setTVHeight);
    return () => window.removeEventListener('resize', setTVHeight);
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    let hideTimeout: ReturnType<typeof setTimeout>;
    const handleMouseMove = () => {
      setShowExitButton(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setShowExitButton(false), 3000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimeout);
    };
  }, [fullscreen]);

  const enterFullscreen = async () => {
    try {
      await audioSystem.unlock();
      // Starting the TV display is the user gesture needed by Smart TV/Chrome
      // autoplay policies. Schedule mode should not require a second audio
      // button after fullscreen opens.
      if (settings.mediaScheduleMode === 'schedule') {
        try {
          sessionStorage.setItem('tv-audio-unlocked', '1');
        } catch {}
      }
      const el = document.documentElement as any;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      } else if (el.mozRequestFullScreen) {
        el.mozRequestFullScreen();
      } else if (el.msRequestFullscreen) {
        el.msRequestFullscreen();
      } else {
        setFullscreen(true);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
      setFullscreen(true);
    }
  };

  const exitFullscreen = () => {
    const doc = document as any;
    if (doc.exitFullscreen) {
      const result = doc.exitFullscreen();
      if (result && typeof result.catch === 'function') {
        result.catch(console.error);
      }
    } else if (doc.webkitExitFullscreen) {
      doc.webkitExitFullscreen();
    } else if (doc.mozCancelFullScreen) {
      doc.mozCancelFullScreen();
    } else if (doc.msExitFullscreen) {
      doc.msExitFullscreen();
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }}>
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto" style={{ borderColor: '#3b82f6', borderTopColor: 'transparent' }} />
          <p style={{ color: '#4B5563', fontSize: 'clamp(14px, 1.5vmin, 22px)' }}>Mengesahkan pautan TV...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }} data-testid="tv-error">
        <div className="text-center space-y-4 max-w-md mx-4">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#fee2e2' }}>
            <Monitor className="w-8 h-8" style={{ color: '#ef4444' }} />
          </div>
          <h1 className="font-bold" style={{ color: '#111827', fontSize: 'clamp(20px, 2.5vmin, 36px)' }}>Pautan TV Tidak Sah</h1>
          <p style={{ color: '#4B5563', fontSize: 'clamp(12px, 1.3vmin, 20px)' }}>{error}</p>
          <p style={{ color: '#9CA3AF', fontSize: 'clamp(10px, 1.1vmin, 16px)' }}>Sila minta admin klinik untuk memberikan pautan TV yang betul.</p>
        </div>
      </div>
    );
  }

  if (browserCompatibility.blockingIssues.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }} data-testid="tv-browser-error">
        <div className="text-center space-y-4 max-w-2xl mx-4">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center" style={{ backgroundColor: '#fee2e2' }}>
            <Monitor className="w-8 h-8" style={{ color: '#ef4444' }} />
          </div>
          <h1 className="font-bold" style={{ color: '#111827', fontSize: 'clamp(20px, 2.5vmin, 36px)' }}>Browser TV Tidak Disokong</h1>
          <p style={{ color: '#4B5563', fontSize: 'clamp(12px, 1.3vmin, 20px)' }}>
            Browser ini tidak mempunyai fungsi asas yang diperlukan untuk paparan TV.
          </p>
          <div className="rounded-lg p-4 text-left" style={{ backgroundColor: '#fff1f2', color: '#9f1239' }}>
            <strong>Masalah dikesan:</strong>
            <ul className="list-disc ml-5 mt-2">
              {browserCompatibility.blockingIssues.map(issue => <li key={issue}>{issue}</li>)}
            </ul>
          </div>
          <p style={{ color: '#6B7280', fontSize: '12px', wordBreak: 'break-word' }}>
            {browserCompatibility.userAgent}
          </p>
        </div>
      </div>
    );
  }

  if (fullscreen) {
    return (
      <div
        id="tv-container"
        className="fixed overflow-hidden m-0 tv-force-light tv-white-bg"
        style={{
          inset: 0,
          width: '100vw',
          height: '100dvh',
          padding: 'var(--tv-overscan, 3vw)',
          backgroundColor: '#ffffff',
          backgroundImage: 'linear-gradient(#ffffff, #ffffff)',
          colorScheme: 'light'
        }}
      >
        <TVDisplay
          currentPatient={currentPatient || undefined}
          queueHistory={queueHistory}
          clinicName={clinicName}
          mediaItems={activeMedia.map((m: any) => ({
            url: m.url || `/api/tv/${token}/media/${m.id}/file`,
            type: m.type === 'youtube-audio' ? 'youtube-audio' : (m.url?.includes('youtube') || m.url?.includes('youtu.be') ? 'youtube' : m.type),
            name: m.name
          }))}
          isFullscreen={true}
          showPrayerTimes={showPrayerTimes}
          showWeather={showWeather}
          tvToken={token}
        />
        <div className="fixed top-0 left-0 right-0 z-[9998]">
          <EodResetBanner variant="tv" />
        </div>
        <div
          className="fixed top-4 right-4 z-[9999] transition-opacity duration-300"
          style={{ opacity: showExitButton ? 1 : 0, pointerEvents: showExitButton ? 'auto' : 'none' }}
        >
          <Button
            onClick={exitFullscreen}
            style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: '#ffffff', borderColor: 'rgba(255,255,255,0.2)' }}
            variant="outline"
            size="sm"
            data-testid="button-exit-fullscreen"
          >
            Keluar Fullscreen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(to bottom right, #eff6ff, #ffffff)', colorScheme: 'light' }} data-testid="tv-landing">
      <div className="text-center space-y-6 max-w-lg mx-4">
        <div className="w-20 h-20 mx-auto rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#dbeafe' }}>
          <Monitor className="w-10 h-10" style={{ color: '#2563eb' }} />
        </div>
        <div>
          <h1 className="font-bold mb-2" style={{ color: '#111827', fontSize: 'clamp(24px, 3vmin, 44px)' }} data-testid="text-clinic-name">{clinicName}</h1>
          <p style={{ color: '#6B7280', fontSize: 'clamp(14px, 1.5vmin, 22px)' }}>Paparan TV Klinik</p>
        </div>
        <div className="rounded-xl shadow-lg p-6 space-y-4" style={{ backgroundColor: '#ffffff' }}>
          <p style={{ color: '#4B5563' }}>
            Tekan butang di bawah untuk memulakan paparan TV dalam mod skrin penuh.
          </p>
          <Button
            onClick={enterFullscreen}
            className="w-full py-6"
            style={{ backgroundColor: '#2563eb', color: '#ffffff', fontSize: 'clamp(14px, 1.5vmin, 22px)' }}
            size="lg"
            data-testid="button-start-tv"
          >
            <Monitor className="w-5 h-5 mr-2" />
            Start TV Display
          </Button>
        </div>
        {browserCompatibility.warnings.length > 0 && (
          <div className="rounded-lg p-3 text-left" style={{ backgroundColor: '#fffbeb', color: '#92400e', fontSize: '12px' }}>
            <strong>Keserasian browser:</strong>
            <ul className="list-disc ml-5 mt-1">
              {browserCompatibility.warnings.map(warning => <li key={warning}>{warning}</li>)}
            </ul>
            <div className="mt-1" style={{ color: '#a16207' }}>{browserCompatibility.audio}</div>
          </div>
        )}
        <p style={{ color: '#9CA3AF', fontSize: 'clamp(9px, 1.0vmin, 14px)' }}>
           Queue updates every 15 seconds; scheduled media switches automatically within 1 minute.
           <br />No login required.
        </p>
      </div>
    </div>
  );
}