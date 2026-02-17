import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io, Socket } from "socket.io-client";
import { TVDisplay } from "@/components/tv-display";
import { Button } from "@/components/ui/button";
import { Monitor, Copy, Check } from "lucide-react";
import { type TvQueueItem } from "@shared/schema";

interface QueueItem {
  id: string;
  name: string;
  number: string;
  room: string;
  status: "waiting" | "calling" | "completed";
  timestamp: Date;
  calledAt?: Date | null;
  requeueReason?: string | null;
}

interface TvStandaloneProps {
  token: string;
}

export default function TvStandalone({ token }: TvStandaloneProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [showExitButton, setShowExitButton] = useState(false);
  const [validating, setValidating] = useState(true);
  const [clinicInfo, setClinicInfo] = useState<{ clinicName: string; isActive: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          const root = document.documentElement;
          if (root.classList.contains('dark')) {
            root.classList.remove('dark');
            root.classList.add('light');
          }
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

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
      observer.disconnect();
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
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      randomizationFactor: 0.5,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[TV-WS] Connected:', socket.id);
      socket.emit('tv:join', { token });
    });

    socket.on('tv:joined', (data) => {
      console.log('[TV-WS] Joined clinic room:', data);
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
      'queue:updated', 'queue:reset', 'window:updated', 'window:patient-assigned'
    ];
    patientEvents.forEach(evt => socket.on(evt, debouncedRefetchPatients));

    socket.on('settings:updated', () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tv/${token}/settings`] });
    });

    socket.on('disconnect', (reason) => {
      console.log('[TV-WS] Disconnected:', reason);
    });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [clinicInfo, token, queryClient]);

  const { data: tvPatients = [] } = useQuery<TvQueueItem[]>({
    queryKey: [`/api/tv/${token}/patients`],
    enabled: !!clinicInfo,
    staleTime: 30000,
    refetchInterval: 30000,
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

  const { data: logoData } = useQuery<{ logo: string }>({
    queryKey: [`/api/tv/${token}/logo`],
    enabled: !!clinicInfo,
    staleTime: 3600000,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const { data: activeMedia = [] } = useQuery<any[]>({
    queryKey: [`/api/tv/${token}/media/active`],
    enabled: !!clinicInfo,
    staleTime: 180000,
    refetchInterval: 180000,
    refetchOnWindowFocus: false,
  });

  const settings = settingsData.reduce((acc: Record<string, any>, setting) => {
    acc[setting.key] = setting.value === "true" ? true : setting.value === "false" ? false : setting.value;
    return acc;
  }, {});

  const showPrayerTimes = settings.showPrayerTimes === true;
  const showWeather = settings.showWeather === true;
  const clinicName = settings.clinicName || clinicInfo?.clinicName || "CLINIC";

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
      return {
        id: p.id,
        name: p.name || `No. ${p.number}`,
        number: p.number.toString(),
        room: p.windowName || "Not available",
        status: "calling" as const,
        timestamp: p.calledAt ? new Date(p.calledAt) : new Date(),
        calledAt: p.calledAt ? new Date(p.calledAt) : null,
        requeueReason: p.requeueReason,
      };
    })();

    const history: QueueItem[] = callLogRef.current
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
      if (container && (typeof CSS === 'undefined' || !CSS.supports('height', '100dvh'))) {
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
      const { audioSystem } = await import("@/lib/audio-system");
      await audioSystem.unlock();
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
      doc.exitFullscreen().catch(console.error);
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
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 text-lg">Mengesahkan pautan TV...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#ffffff', colorScheme: 'light' }} data-testid="tv-error">
        <div className="text-center space-y-4 max-w-md mx-4">
          <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
            <Monitor className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Pautan TV Tidak Sah</h1>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-400">Sila minta admin klinik untuk memberikan pautan TV yang betul.</p>
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
            type: m.url?.includes('youtube') || m.url?.includes('youtu.be') ? 'youtube' : m.type,
            name: m.name
          }))}
          isFullscreen={true}
          showPrayerTimes={showPrayerTimes}
          showWeather={showWeather}
          tvToken={token}
        />
        <div
          className="fixed top-4 right-4 z-[9999] transition-opacity duration-300"
          style={{ opacity: showExitButton ? 1 : 0, pointerEvents: showExitButton ? 'auto' : 'none' }}
        >
          <Button
            onClick={exitFullscreen}
            className="bg-black/70 text-white border-white/20"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center" style={{ colorScheme: 'light' }} data-testid="tv-landing">
      <div className="text-center space-y-6 max-w-lg mx-4">
        <div className="w-20 h-20 mx-auto bg-blue-100 rounded-2xl flex items-center justify-center">
          <Monitor className="w-10 h-10 text-blue-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-clinic-name">{clinicName}</h1>
          <p className="text-gray-500 text-lg">Paparan TV Klinik</p>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
          <p className="text-gray-600">
            Tekan butang di bawah untuk memulakan paparan TV dalam mod skrin penuh.
          </p>
          <Button
            onClick={enterFullscreen}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
            size="lg"
            data-testid="button-start-tv"
          >
            <Monitor className="w-5 h-5 mr-2" />
            Mulakan Paparan TV
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Paparan ini akan dikemas kini secara automatik setiap 30 saat.
          <br />Tiada login diperlukan.
        </p>
      </div>
    </div>
  );
}