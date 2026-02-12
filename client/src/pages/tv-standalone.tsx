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

    socket.on('connect', () => {
      console.log('[TV-WS] Connected:', socket.id);
      socket.emit('tv:join', { token });
    });

    socket.on('tv:joined', (data) => {
      console.log('[TV-WS] Joined clinic room:', data);
    });

    const refetchPatients = () => {
      queryClient.refetchQueries({ queryKey: [`/api/tv/${token}/patients`] });
    };

    socket.on('patient:called', refetchPatients);
    socket.on('patient:updated', refetchPatients);
    socket.on('patient:created', refetchPatients);
    socket.on('patient:status-updated', refetchPatients);
    socket.on('patient:deleted', refetchPatients);
    socket.on('patient:priority-updated', refetchPatients);
    socket.on('queue:updated', refetchPatients);
    socket.on('queue:reset', refetchPatients);
    socket.on('window:updated', refetchPatients);
    socket.on('window:patient-assigned', refetchPatients);

    socket.on('settings:updated', () => {
      queryClient.refetchQueries({ queryKey: [`/api/tv/${token}/settings`] });
    });

    socket.on('disconnect', (reason) => {
      console.log('[TV-WS] Disconnected:', reason);
    });

    return () => {
      socket.disconnect();
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

  const { currentPatient, queueHistory } = useMemo(() => {
    const transformToQueueItem = (patient: TvQueueItem): QueueItem => {
      let displayStatus: "waiting" | "calling" | "completed";
      if (patient.status === "called") {
        displayStatus = "calling";
      } else if (patient.status === "completed") {
        displayStatus = "completed";
      } else {
        displayStatus = "waiting";
      }
      return {
        id: patient.id,
        name: patient.name || `No. ${patient.number}`,
        number: patient.number.toString(),
        room: patient.windowName || "Not available",
        status: displayStatus,
        timestamp: patient.calledAt ? new Date(patient.calledAt) : new Date(),
        calledAt: patient.calledAt ? new Date(patient.calledAt) : null,
        requeueReason: patient.requeueReason,
      };
    };

    const current = (() => {
      const calledPatients = tvPatients
        .filter(p => p.status === "called")
        .map(transformToQueueItem)
        .sort((a, b) => {
          if (!a.calledAt) return 1;
          if (!b.calledAt) return -1;
          return b.calledAt.getTime() - a.calledAt.getTime();
        });
      return calledPatients[0] || null;
    })();

    const history = tvPatients
      .filter(p => p.status === "called")
      .map(transformToQueueItem)
      .sort((a, b) => {
        if (!a.calledAt) return 1;
        if (!b.calledAt) return -1;
        return b.calledAt.getTime() - a.calledAt.getTime();
      })
      .slice(1, 4);

    return { currentPatient: current, queueHistory: history };
  }, [tvPatients]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement !== null);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-600 text-lg">Mengesahkan pautan TV...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white" data-testid="tv-error">
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
        className="fixed overflow-hidden bg-white m-0"
        style={{
          inset: 0,
          width: '100vw',
          height: '100dvh',
          padding: 'var(--tv-overscan, 3vw)'
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
            onClick={() => document.exitFullscreen().catch(console.error)}
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center" data-testid="tv-landing">
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