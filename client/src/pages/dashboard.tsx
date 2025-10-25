import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { TVDisplay } from "@/components/tv-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, Settings, Users, Clock } from "lucide-react";
import { type Patient } from "@shared/schema";

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

interface DashboardStats {
  totalWaiting: number;
  totalCalled: number;
  totalCompleted: number;
  activeWindows: number;
}

export default function Dashboard() {
  const [fullscreen, setFullscreen] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(false);
  const [showExitButton, setShowExitButton] = useState(false);

  // Listen for browser fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(document.fullscreenElement !== null);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // JS fallback for dvh support (for older TV browsers)
  useEffect(() => {
    if (!fullscreen) return;

    const setTVHeight = () => {
      const container = document.getElementById('tv-container');
      // Guard for missing CSS.supports or lack of dvh support
      if (container && (typeof CSS === 'undefined' || !CSS.supports('height', '100dvh'))) {
        // Fallback for browsers without dvh support
        const vh = window.innerHeight;
        container.style.height = `${vh}px`;
        container.style.minHeight = `${vh}px`; // Handle dynamic UI chrome on TVs
      }
    };

    setTVHeight();
    window.addEventListener('resize', setTVHeight);
    return () => window.removeEventListener('resize', setTVHeight);
  }, [fullscreen]);

  // Handle cursor hover for exit button in fullscreen
  useEffect(() => {
    if (!fullscreen) return;

    let hideTimeout: NodeJS.Timeout;

    const handleMouseMove = () => {
      setShowExitButton(true);
      
      // Clear existing timeout
      clearTimeout(hideTimeout);
      
      // Hide button after 3 seconds of inactivity
      hideTimeout = setTimeout(() => {
        setShowExitButton(false);
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearTimeout(hideTimeout);
    };
  }, [fullscreen]);

  // Show fullscreen prompt from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('fullscreen') === '1') {
      // Remove parameter from URL
      window.history.replaceState({}, '', '/');
      // Show prompt to enter fullscreen
      setShowFullscreenPrompt(true);
    }
  }, []);

  // Handle fullscreen prompt click (from QR auth)
  const handleEnterFullscreen = async () => {
    try {
      // Unlock audio BEFORE entering fullscreen (user gesture required)
      const { audioSystem } = await import("@/lib/audio-system");
      await audioSystem.unlock();
      
      // Enter fullscreen
      await document.documentElement.requestFullscreen();
      setShowFullscreenPrompt(false);
    } catch (error) {
      console.error('Failed to enter fullscreen or unlock audio:', error);
      setShowFullscreenPrompt(false);
    }
  };

  // Fetch dashboard statistics
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats & { totalWindows: number }>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 3000, // Refresh every 3 seconds for real-time dashboard updates
  });

  // Fetch current call
  const { data: currentCall, error: currentCallError, isLoading: currentCallLoading } = useQuery<Patient | null>({
    queryKey: ['/api/dashboard/current-call'], // Stable query key
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/current-call?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (!response.ok) throw new Error('Failed to fetch current call');
      return response.json();
    },
    refetchInterval: 2000, // Refresh every 2 seconds for real-time updates
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache results
  });


  // Fetch recent history 
  const { data: history = [] } = useQuery<Patient[]>({
    queryKey: ['/api/dashboard/history'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch windows data to map window IDs to names
  const { data: windows = [] } = useQuery<any[]>({
    queryKey: ['/api/windows'],
    refetchInterval: 5000, // Refresh every 5 seconds to stay in sync with patient calls
  });

  // Fetch active media for display
  const { data: activeMedia = [] } = useQuery<any[]>({
    queryKey: ['/api/display'],
    refetchInterval: 10000, // Refresh every 10 seconds to get updated media
  });

  // Fetch display settings
  const { data: settingsData = [] } = useQuery<Array<{key: string; value: string}>>({
    queryKey: ['/api/settings'],
  });

  // Convert settings array to object and parse booleans
  const settings = settingsData.reduce((acc: Record<string, any>, setting) => {
    acc[setting.key] = setting.value === "true" ? true : setting.value === "false" ? false : setting.value;
    return acc;
  }, {});

  const showPrayerTimes = settings.showPrayerTimes === true;
  const showWeather = settings.showWeather === true;
  const clinicName = settings.clinicName || "MAIN CLINIC 24 HOURS";
  const clinicLogo = settings.clinicLogo || "";
  const showClinicLogo = settings.showClinicLogo === "true";

  // Convert Patient to QueueItem for TV display
  const convertToQueueItem = (patient: Patient): QueueItem => {
    // Use room name directly from API response, fallback to mapping windowId OR lastWindowId
    const roomName = (patient as any).room || (() => {
      // Try current windowId first
      let window = windows.find(w => w.id === patient.windowId);
      
      // If no current window (requeued patient), use lastWindowId to show last room
      if (!window && (patient as any).lastWindowId) {
        window = windows.find(w => w.id === (patient as any).lastWindowId);
      }
      
      return window?.name || "Not available";
    })();
    
    return {
      id: patient.id,
      name: patient.name || `No. ${patient.number}`,
      number: patient.number.toString(),
      room: roomName,
      status: patient.status === "called" ? "calling" : patient.status === "completed" ? "completed" : "waiting",
      timestamp: new Date(),
      calledAt: patient.calledAt ? new Date(patient.calledAt) : null,
      requeueReason: patient.requeueReason
    };
  };

  const toggleFullscreen = async () => {
    if (!fullscreen) {
      try {
        // Unlock audio BEFORE entering fullscreen (user gesture required)
        const { audioSystem } = await import("@/lib/audio-system");
        await audioSystem.unlock();
        
        // Enter fullscreen
        await document.documentElement.requestFullscreen();
      } catch (error) {
        console.error('Failed to enter fullscreen or unlock audio:', error);
      }
    } else {
      document.exitFullscreen().catch(console.error);
    }
    // State will auto-update via fullscreenchange event listener
  };

  if (fullscreen) {
    return (
      <div 
        id="tv-container"
        className="fixed overflow-hidden bg-white m-0" 
        style={{ 
          inset: 0,
          width: '100vw',
          height: '100dvh', // dvh for better TV browser support
          padding: 'var(--tv-overscan, 3vw)' // Responsive overscan with fallback for older TV browsers
        }}
      >
        <TVDisplay
          currentPatient={currentCall ? convertToQueueItem(currentCall) : undefined}
          queueHistory={history.map(convertToQueueItem)}
          clinicName={clinicName}
          mediaItems={activeMedia.map(media => ({
            url: media.url || `/api/media/${media.id}/file`,
            type: media.url?.includes('youtube') || media.url?.includes('youtu.be') ? 'youtube' : media.type,
            name: media.name
          }))}
          isFullscreen={true}
          showPrayerTimes={showPrayerTimes}
          showWeather={showWeather}
        />
        {/* Floating Exit Button - Appears on cursor hover */}
        <div 
          className="fixed top-4 right-4 z-[9999] transition-opacity duration-300"
          style={{ opacity: showExitButton ? 1 : 0, pointerEvents: showExitButton ? 'auto' : 'none' }}
        >
          <Button
            onClick={toggleFullscreen}
            className="bg-black/70 text-white border-white/20 hover:bg-black/90"
            variant="outline"
            size="sm"
            data-testid="button-exit-fullscreen"
          >
            Exit Fullscreen
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Fullscreen Prompt Overlay */}
      {showFullscreenPrompt && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
          <Card className="max-w-md mx-4 text-center">
            <CardHeader>
              <CardTitle className="text-2xl">TV Display Ready</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                QR login successful! Click the button below to start fullscreen TV display.
              </p>
              <div className="space-y-2">
                <Button
                  onClick={handleEnterFullscreen}
                  className="w-full btn-gradient"
                  size="lg"
                  data-testid="button-start-tv-display"
                >
                  <Monitor className="h-5 w-5 mr-2" />
                  Start TV Display
                </Button>
                <Button
                  onClick={() => setShowFullscreenPrompt(false)}
                  variant="outline"
                  className="w-full"
                  data-testid="button-cancel-tv-display"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Main dashboard for clinic calling system</p>
        </div>
        <Button
          onClick={toggleFullscreen}
          data-testid="button-fullscreen-tv"
          className="btn-gradient"
        >
          <Monitor className="h-4 w-4 mr-2" />
          Fullscreen TV Display
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-waiting-count">
              {statsLoading ? "..." : (stats?.totalWaiting || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              patients in queue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Called</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-called-count">
              {statsLoading ? "..." : (stats?.totalCalled || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              patients being called
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-completed-count">
              {statsLoading ? "..." : (stats?.totalCompleted || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              patients today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rooms</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-active-windows">
              {statsLoading ? "..." : (stats?.activeWindows || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              out of {stats?.totalWindows || 0} rooms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* TV Preview */}
      <Card>
        <CardHeader>
          <CardTitle>TV Display Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden max-w-2xl mx-auto" style={{ aspectRatio: '16/9' }}>
            <div className="h-full scale-[0.42] origin-top-left" style={{ width: '238%', height: '238%' }}>
              <TVDisplay
                currentPatient={currentCall ? convertToQueueItem(currentCall) : undefined}
                queueHistory={history.slice(0, 4).map(convertToQueueItem)}
                clinicName={clinicName}
                mediaItems={activeMedia.map(media => ({
                  url: media.url || `/api/media/${media.id}/file`,
                  type: media.url?.includes('youtube') || media.url?.includes('youtu.be') ? 'youtube' : media.type,
                  name: media.name
                }))}
                showPrayerTimes={showPrayerTimes}
                showWeather={showWeather}
                disableAudio={true}
              />
            </div>
          </div>
          <div className="mt-4 text-center">
            <Button 
              onClick={toggleFullscreen}
              variant="outline"
              data-testid="button-preview-fullscreen"
            >
              <Monitor className="h-4 w-4 mr-2" />
              View Full Display
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}