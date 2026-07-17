import { useState, useEffect, useLayoutEffect, useRef, useMemo, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Volume2, Calendar } from "lucide-react";
import { createGradientStyle, createTextGradientStyle } from "@/hooks/useActiveTheme";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CLINIC_LOGO } from "@/lib/clinic-logo";
import { audioSystem } from "@/lib/audio-system";
import type { AudioSettings } from "@/lib/audio-system";
import { useWebSocket } from "@/hooks/useWebSocket";
import { getDisplayName } from "@/lib/name-utils";

const IsolatedClock = memo(function IsolatedClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (d: Date) => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const day = now.getDate();
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const year = now.getFullYear();

  return (
    <div className="flex items-center justify-center space-x-5" style={{ color: '#111827' }}>
      <div className="text-center">
        <div className="text-6xl font-bold" style={{ color: '#000000' }}>{day}</div>
      </div>
      <div className="text-center">
        <div className="font-bold text-3xl leading-tight" style={{ color: '#111827' }}>{dayName}</div>
        <div className="text-2xl leading-tight" style={{ color: '#4B5563' }}>{month} {year}</div>
      </div>
      <div className="text-center">
        <div className="font-mono font-bold text-6xl" style={{ color: '#111827' }} data-testid="display-time">
          {formatTime(now)}
        </div>
      </div>
    </div>
  );
});

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

interface PrayerTime {
  name: string;
  time: string;
  key?: string;
}

interface PrayerTimesResponse {
  prayerTimes: PrayerTime[];
  date: {
    readable: string;
    timestamp: string;
  };
  location: {
    city: string;
    country: string;
  };
  meta: {
    timezone: string;
    method: string;
  };
}

interface WeatherResponse {
  location: {
    city: string;
    country: string;
  };
  current: {
    temperature: number;
    humidity: number;
    windSpeed: number;
    description: string;
    icon: string;
  };
  units: {
    temperature: string;
    windSpeed: string;
    humidity: string;
  };
}

interface MediaItem {
  url: string;
  type: "image" | "video" | "youtube" | "youtube-audio";
  name?: string;
}

interface TVDisplayProps {
  currentPatient?: QueueItem;
  queueWaiting?: QueueItem[]; // ✅ Waiting patients (not currently rendered)
  queueHistory?: QueueItem[]; // ✅ Recent calling history (shows 2nd, 3rd, 4th most recent called patients)
  clinicName?: string;
  mediaItems?: MediaItem[];
  prayerTimes?: PrayerTime[];
  isFullscreen?: boolean;
  showPrayerTimes?: boolean;
  showWeather?: boolean;
  disableAudio?: boolean; // Mute audio for preview mode
  // Token for unauthenticated TV display access
  tvToken?: string;
}

function FitText({
  text,
  baseStyle,
  className,
  testId,
  maxFontSize = 56,
  minFontSize = 14,
  align = 'center',
  wrap = false,
}: {
  text: string;
  baseStyle?: React.CSSProperties;
  className?: string;
  testId?: string;
  maxFontSize?: number;
  minFontSize?: number;
  align?: 'start' | 'center' | 'end';
  wrap?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);
  const [overflowScale, setOverflowScale] = useState(1);

  // If wrap=true, allow text to break into multiple lines.
  // The binary search will find the largest font that still fits.
  const shouldWrap = wrap;

  useLayoutEffect(() => {
    let rafId = 0;
    const fit = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const container = containerRef.current;
        const span = spanRef.current;
        if (!container || !span) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        if (cw <= 0 || ch <= 0) return;
        // 3px safety margin prevents subpixel rounding bleed on Smart TVs.
        const safeW = Math.max(1, cw - 3);
        const safeH = Math.max(1, ch - 3);
        // Max lines target for wrapped text to keep font large.
        const MAX_WRAP_LINES = 3;
        let lo = minFontSize;
        let hi = maxFontSize;
        let best = minFontSize;
        for (let i = 0; i < 12; i++) {
          if (lo > hi) break;
          const mid = Math.floor((lo + hi) / 2);
          span.style.fontSize = `${mid}px`;
          // scrollWidth measures layout width BEFORE CSS transforms.
          // getBoundingClientRect includes stage scale and misleads the fit.
          const tw = span.scrollWidth;
          const th = span.scrollHeight;
          // For wrapped text with width:100%, scrollWidth always equals
          // container width, so width check is meaningless. Only check height.
          // Also enforce max line count so font stays large.
          let fits: boolean;
          if (shouldWrap) {
            fits = th <= safeH;
            if (fits) {
              const lineHeightPx = parseFloat(window.getComputedStyle(span).lineHeight) || mid * 1.05;
              const lineCount = Math.ceil(th / lineHeightPx);
              if (lineCount > MAX_WRAP_LINES) fits = false;
            }
          } else {
            fits = tw <= safeW && th <= safeH;
          }
          if (fits) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
          }
        }
        span.style.fontSize = `${best}px`;
        setFontSize(best);
        // Safety net: if the text STILL overflows at the chosen size
        // (e.g. minFontSize reached, or measurement was off), scale it
        // down visually so it can never be cut off.
        const tw = span.scrollWidth;
        const th = span.scrollHeight;
        let ratio: number;
        if (shouldWrap) {
          // For wrapped text, scrollWidth always == container width,
          // so only check height for overflow.
          ratio = Math.min(1, th > 0 ? ch / th : 1);
        } else {
          ratio = Math.min(1, tw > 0 ? cw / tw : 1, th > 0 ? ch / th : 1);
        }
        const finalScale = ratio < 1 ? ratio * 0.96 : 1;
        setOverflowScale(finalScale);
      });
    };
    fit();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(fit);
      if (containerRef.current) ro.observe(containerRef.current);
    } catch {}
    // Fallbacks for browsers without ResizeObserver (e.g. some Smart TVs)
    // and for late layout/webfont changes that RO won't catch:
    window.addEventListener('resize', fit);
    const t1 = window.setTimeout(fit, 300);
    const t2 = window.setTimeout(fit, 1200);
    try {
      (document as any).fonts?.ready?.then(fit);
    } catch {}
    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', fit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [text, maxFontSize, minFontSize, shouldWrap]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', alignItems: align === 'start' ? 'flex-start' : align === 'end' ? 'flex-end' : 'center', justifyContent: 'center' }}
      data-testid={testId}
    >
      <span
        ref={spanRef}
        style={{
          ...baseStyle,
          fontSize: `${fontSize}px`,
          whiteSpace: shouldWrap ? 'normal' : 'nowrap',
          overflowWrap: shouldWrap ? 'break-word' : 'normal',
          wordBreak: shouldWrap ? 'break-word' : 'normal',
          lineHeight: shouldWrap ? 1.05 : 1.1,
          display: 'inline-block',
          maxWidth: shouldWrap ? '100%' : undefined,
          transform: overflowScale < 1 ? `scale(${overflowScale})` : undefined,
          transformOrigin: 'center center',
        }}
      >
        {text}
      </span>
    </div>
  );
}

// FitRow: scales an entire row of content down uniformly when it is wider
// than its container, so nothing gets clipped (e.g. clock + prayer times bar).
function FitRow({
  children,
  className,
  refitKey,
}: {
  children: React.ReactNode;
  className?: string;
  refitKey?: string;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState<{ scale: number; width: number | null }>({ scale: 1, width: null });

  useEffect(() => {
    let rafId = 0;
    const refit = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const outer = outerRef.current;
        const inner = innerRef.current;
        if (!outer || !inner) return;
        const cw = outer.clientWidth;
        if (cw <= 0) return;
        // Measure natural content width. Use scrollWidth (not getBoundingClientRect)
        // because getBoundingClientRect includes CSS transform scale on the stage,
        // which makes overflowed text appear smaller than it really is.
        const prevWidth = inner.style.width;
        inner.style.width = 'auto';
        const needed = inner.scrollWidth;
        inner.style.width = prevWidth;
        if (needed > cw + 1) {
          const scale = (cw / needed) * 0.99;
          setFit(prev => (Math.abs(prev.scale - scale) > 0.005 || prev.width !== needed) ? { scale, width: needed } : prev);
        } else {
          setFit(prev => (prev.scale !== 1 || prev.width !== null) ? { scale: 1, width: null } : prev);
        }
      });
    };
    refit();
    let ro: ResizeObserver | null = null;
    try {
      ro = new ResizeObserver(refit);
      if (outerRef.current) ro.observe(outerRef.current);
    } catch {}
    let mo: MutationObserver | null = null;
    try {
      mo = new MutationObserver(refit);
      if (innerRef.current) mo.observe(innerRef.current, { childList: true, subtree: true, characterData: true });
    } catch {}
    window.addEventListener('resize', refit);
    const t1 = window.setTimeout(refit, 300);
    const t2 = window.setTimeout(refit, 1200);
    try {
      (document as any).fonts?.ready?.then(refit);
    } catch {}
    return () => {
      cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      window.removeEventListener('resize', refit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [refitKey]);

  return (
    <div ref={outerRef} style={{ width: '100%', overflow: 'hidden' }}>
      <div
        ref={innerRef}
        className={className}
        style={{
          width: fit.width ? `${fit.width}px` : '100%',
          transform: fit.scale < 1 ? `scale(${fit.scale})` : undefined,
          transformOrigin: 'left center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function TVDisplay({ 
  currentPatient,
  queueWaiting = [], // Not currently rendered (reserved for future use)
  queueHistory = [], // ✅ Recent calling history (2nd, 3rd, 4th most recent called patients)
  clinicName = "",
  mediaItems = [],
  prayerTimes = [],
  isFullscreen = false,
  showPrayerTimes = false,
  showWeather = false,
  disableAudio = false,
  tvToken
}: TVDisplayProps) {
  
  const stageRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  // TV MODE - Manual toggle from Settings (saved in localStorage)
  const [isTVMode, setIsTVMode] = useState(() => {
    // Browser-safe localStorage access
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('tvMode') === 'true';
    }
    return false;
  });
  
  // Listen for TV mode changes from Settings
  useEffect(() => {
    // Browser-only - skip in SSR/test environments
    if (typeof window === 'undefined') return;
    
    const handleStorageChange = () => {
      try {
        if (typeof localStorage !== 'undefined') {
          const tvModeEnabled = localStorage.getItem('tvMode') === 'true';
          // Only update state if value actually changed (prevents unnecessary re-renders)
          setIsTVMode(prev => {
            if (prev !== tvModeEnabled) {
              console.log('📺 TV Mode changed:', tvModeEnabled);
              return tvModeEnabled;
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('TV Mode: localStorage access failed', error);
      }
    };
    
    // Check immediately on mount (in case changed while component unmounted)
    handleStorageChange();
    
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('tvModeChanged', handleStorageChange);
    
    // ✅ Reduced from 2s to 30s - only needed as fallback, events handle real-time updates
    const interval = setInterval(handleStorageChange, 30000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('tvModeChanged', handleStorageChange);
      clearInterval(interval);
    };
  }, []);
  
  // Update font sizes when TV Mode changes
  useEffect(() => {
    if (isTVMode) {
      console.log('📺 TV Mode ON - Increasing font sizes 2x');
      setPatientNameFontSize('14rem');
      setRoomNameFontSize('5rem');
    } else {
      console.log('📺 TV Mode OFF - Using normal font sizes');
      setPatientNameFontSize('7rem');
      setRoomNameFontSize('2.5rem');
    }
  }, [isTVMode]);
  
  const wsResult = useWebSocket(!!tvToken);
  const socket = tvToken ? null : wsResult.socket;
  
  useEffect(() => {
    if (!socket) return;

    const handleSettingsUpdate = () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = String(query.queryKey[0]);
          return key.includes('/api/settings') || key.includes('/api/tv/') && key.includes('/settings');
        }
      });
    };

    const handleThemesUpdate = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0]);
          return key.includes('/api/themes/active') || key.includes('/api/tv/') && key.includes('/themes/active');
        }
      });
    };

    const handleTextGroupsUpdate = () => {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = String(query.queryKey[0]);
          return key.includes('/api/text-groups/active') || key.includes('/api/tv/') && key.includes('/text-groups/active');
        }
      });
    };

    socket.on('settings:updated', handleSettingsUpdate);
    socket.on('themes:updated', handleThemesUpdate);
    socket.on('text-groups:updated', handleTextGroupsUpdate);

    return () => {
      socket.off('settings:updated', handleSettingsUpdate);
      socket.off('themes:updated', handleThemesUpdate);
      socket.off('text-groups:updated', handleTextGroupsUpdate);
    };
  }, [socket, queryClient, tvToken]);
  
  // Fetch active theme - use token-based endpoint if tvToken provided
  const { data: theme } = useQuery({
    queryKey: tvToken ? [`/api/tv/${tvToken}/themes/active`] : ['/api/themes/active'],
    queryFn: async () => {
      const endpoint = tvToken ? `/api/tv/${tvToken}/themes/active` : '/api/themes/active';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch theme');
      return response.json();
    },
    staleTime: 120000, // ✅ BANDWIDTH SAVE: Cache for 2 min - WebSocket is primary!
    refetchInterval: 120000, // ✅ BANDWIDTH SAVE: Poll every 2 min as fallback (was 30s = 4x reduction!)
    refetchOnMount: false, // ❌ Disable - use cached data
    refetchOnWindowFocus: false, // ❌ Disable - prevents burst
    retry: 1,
  });

  // Fetch text groups - use token-based endpoint if tvToken provided
  const { data: textGroups = [] } = useQuery({
    queryKey: tvToken ? [`/api/tv/${tvToken}/text-groups/active`] : ['/api/text-groups/active'],
    queryFn: async () => {
      const endpoint = tvToken ? `/api/tv/${tvToken}/text-groups/active` : '/api/text-groups/active';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch text groups');
      return response.json();
    },
    staleTime: 120000, // ✅ BANDWIDTH SAVE: Cache for 2 min - WebSocket is primary!
    refetchInterval: 120000, // ✅ BANDWIDTH SAVE: Poll every 2 min as fallback (was 30s = 4x reduction!)
    refetchOnMount: false, // ❌ Disable - use cached data
    refetchOnWindowFocus: false, // ❌ Disable - prevents burst
  });

  // Fetch settings - use token-based endpoint if tvToken provided
  // ✅ Use /api/settings/tv for 80% smaller payload (~2KB vs ~11KB)
  // NOTE: clinicLogo excluded from this endpoint - fetched separately with long cache
  const { data: settings = [] } = useQuery<Array<{key: string; value: string}>>({
    queryKey: tvToken ? [`/api/tv/${tvToken}/settings`] : ['/api/settings/tv'],
    queryFn: async () => {
      const endpoint = tvToken ? `/api/tv/${tvToken}/settings` : '/api/settings/tv';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    staleTime: 25000, // ✅ BANDWIDTH FIX: WebSocket 'settings:updated' invalidates instantly; HTTP poll is fallback only
    refetchInterval: 30000, // ✅ BANDWIDTH FIX: Poll every 30s as fallback (was 5s = 6x reduction). Real-time updates via WebSocket.
    refetchOnMount: 'always', // ⚡ Always get fresh settings when component mounts
    refetchOnWindowFocus: false, // ❌ Disable - prevents burst
  });

  // ✅ Logo hardcoded - no API call needed (saves 211KB per request)

  // Convert settings array to object for easier access
  const settingsObj = settings.reduce((acc: Record<string, string>, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  const youtubeAudioVolumeRaw = parseInt(settingsObj.youtubeAudioVolume || '50', 10);
  // Apply perceptual (exponential) curve so slider feels linear to human ear.
  // Human hearing is logarithmic, so YT setVolume(10) sounds much louder than 10%.
  // curve: actual = (slider/100)^2 * 100  → slider 50 = vol 25, slider 10 = vol 1, slider 100 = vol 100
  const youtubeAudioVolume = Math.max(0, Math.min(100, Math.round(Math.pow(youtubeAudioVolumeRaw / 100, 2) * 100)));

  // Extract marquee settings with fallbacks
  const enableMarquee = settingsObj.enableMarquee === 'true';
  const marqueeText = settingsObj.marqueeText || "Welcome to the Health Clinic";
  const marqueeColor = settingsObj.marqueeColor || "#ffffff";
  const marqueeBackgroundColor = settingsObj.marqueeBackgroundColor || "#0f172a";

  // Extract modal highlight box settings
  const modalBackgroundColor = settingsObj.modalBackgroundColor || '#1e293b';
  const modalBorderColor = settingsObj.modalBorderColor || '#fbbf24';
  const modalTextColor = settingsObj.modalTextColor || '#ffffff';

  // ✅ Logo hardcoded directly - always shown, no API call, no database storage needed
  const clinicLogo = CLINIC_LOGO;
  const showClinicLogo = true;
  
  // Helper function to get background style based on mode (solid vs gradient)
  const getBackgroundStyle = (mode: string | undefined, solidColor: string, gradientValue: string, fallbackColor: string) => {
    if (mode === 'gradient' && gradientValue) {
      return { background: gradientValue };
    }
    return { backgroundColor: solidColor || fallbackColor };
  };
  
  // Universal helper function to get text style based on mode (solid vs gradient)
  const getTextStyle = (mode: string | undefined, solidColor: string, gradientValue: string, fallbackColor: string) => {
    if (mode === 'gradient' && gradientValue) {
      return {
        background: gradientValue,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      };
    }
    return { color: solidColor || fallbackColor };
  };
  
  // Unified palette — all section backgrounds share the same slate-teal gradient
  // for a consistent look. Accents (gold/orange) appear in highlight boxes & text.
  const UNIFIED_BG_COLOR = '#0f172a';
  const UNIFIED_BG_GRADIENT = 'linear-gradient(135deg, #0f172a 0%, #134e4a 100%)';
  const ACCENT_BG_COLOR = '#f09819';
  const ACCENT_BG_GRADIENT = 'linear-gradient(135deg, #ff512f 0%, #f09819 100%)';

  const headerBackgroundMode = settingsObj.headerBackgroundMode || 'gradient';
  const headerBackgroundColor = settingsObj.headerBackgroundColor || UNIFIED_BG_COLOR;
  const headerBackgroundGradient = settingsObj.headerBackgroundGradient || UNIFIED_BG_GRADIENT;
  
  // Calling box keeps a warm accent so it pops against the dark base
  const callBackgroundMode = settingsObj.callBackgroundMode || 'gradient';
  const callBackgroundColor = settingsObj.callBackgroundColor || ACCENT_BG_COLOR;
  const callBackgroundGradient = settingsObj.callBackgroundGradient || ACCENT_BG_GRADIENT;
  
  const prayerTimesBackgroundMode = settingsObj.prayerTimesBackgroundMode || 'gradient';
  const prayerTimesBackgroundColor = settingsObj.prayerTimesBackgroundColor || UNIFIED_BG_COLOR;
  const prayerTimesBackgroundGradient = settingsObj.prayerTimesBackgroundGradient || UNIFIED_BG_GRADIENT;
  
  const weatherBackgroundMode = settingsObj.weatherBackgroundMode || 'gradient';
  const weatherBackgroundColor = settingsObj.weatherBackgroundColor || UNIFIED_BG_COLOR;
  const weatherBackgroundGradient = settingsObj.weatherBackgroundGradient || UNIFIED_BG_GRADIENT;
  
  // Queue items get a subtle elevated tone of the same family
  const queueItemBackgroundMode = settingsObj.queueItemBackgroundMode || 'gradient';
  const queueItemBackgroundColor = settingsObj.queueItemBackgroundColor || '#1e293b';
  const queueItemBackgroundGradient = settingsObj.queueItemBackgroundGradient || 'linear-gradient(135deg, #1e293b 0%, #0f766e 100%)';
  
  const historyNameColor = settingsObj.historyNameColor || '#facc15';
  const historyNameMode = settingsObj.historyNameMode || 'gradient';
  const historyNameGradient = settingsObj.historyNameGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
  
  const marqueeBackgroundMode = settingsObj.marqueeBackgroundMode || 'gradient';
  const marqueeBackgroundGradient = settingsObj.marqueeBackgroundGradient || UNIFIED_BG_GRADIENT;
  
  // Extract text color settings
  const headerTextMode = settingsObj.headerTextMode || 'solid';
  const headerTextColor = settingsObj.headerTextColor || '#ffffff';
  const headerTextGradient = settingsObj.headerTextGradient || 'linear-gradient(135deg, #ffffff 0%, #fef3c7 100%)';
  
  const clinicNameTextMode = settingsObj.clinicNameTextMode || 'solid';
  const clinicNameTextColor = settingsObj.clinicNameTextColor || '#ffffff';
  const clinicNameTextGradient = settingsObj.clinicNameTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
  
  
  const callNameTextMode = settingsObj.callNameTextMode || 'solid';
  const callNameTextColor = settingsObj.callNameTextColor || '#ffffff';
  const callNameTextGradient = settingsObj.callNameTextGradient || 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)';
  
  const windowTextMode = settingsObj.windowTextMode || 'solid';
  const windowTextColor = settingsObj.windowTextColor || '#ffffff';
  const windowTextGradient = settingsObj.windowTextGradient || 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
  
  const prayerTimesTextMode = settingsObj.prayerTimesTextMode || 'solid';
  const prayerTimesTextColor = settingsObj.prayerTimesTextColor || '#ffffff';
  const prayerTimesTextGradient = settingsObj.prayerTimesTextGradient || 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)';
  const prayerTimesHighlightColor = settingsObj.prayerTimesHighlightColor || '#facc15';
  
  const weatherTextMode = settingsObj.weatherTextMode || 'solid';
  const weatherTextColor = settingsObj.weatherTextColor || '#ffffff';
  const weatherTextGradient = settingsObj.weatherTextGradient || 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
  
  const queueTextMode = settingsObj.queueTextMode || 'solid';
  const queueTextColor = settingsObj.queueTextColor || '#1f2937';
  const queueTextGradient = settingsObj.queueTextGradient || 'linear-gradient(135deg, #1e293b 0%, #475569 100%)';
  
  const marqueeTextMode = settingsObj.marqueeTextMode || 'solid';
  const marqueeTextGradient = settingsObj.marqueeTextGradient || 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)';

  // Helper function to get text group styles (excluding color/gradient properties that Settings should override)
  const getTextGroupStyles = (groupName: string, excludeColorOverrides = false) => {
    const group = (textGroups as any[]).find((g: any) => g.groupName === groupName);
    if (!group) return {};

    const styles: any = {};
    
    // Always include non-color properties that don't conflict with Settings
    if (group.backgroundColor) styles.backgroundColor = group.backgroundColor;
    if (group.fontSize) styles.fontSize = group.fontSize;
    if (group.fontWeight) styles.fontWeight = group.fontWeight;
    if (group.textAlign) styles.textAlign = group.textAlign;
    
    // Only include color/gradient if not excluding them (so Settings can override)
    if (!excludeColorOverrides) {
      if (group.color) styles.color = group.color;
      
      // Handle gradient (takes precedence over color)
      if (group.gradient) {
        styles.background = group.gradient;
        styles.WebkitBackgroundClip = 'text';
        styles.WebkitTextFillColor = 'transparent';
        styles.backgroundClip = 'text';
      }
    }

    return styles;
  };
  
  // Helper function to create history name text styles
  const getHistoryNameStyle = () => {
    if (historyNameMode === 'gradient') {
      return {
        background: historyNameGradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text'
      };
    }
    return { color: historyNameColor };
  };

  // Location state for prayer times
  // Default immediately to Kuala Lumpur so prayer times appear instantly on TVs/kiosks
  // (browser geolocation is usually blocked on HDMI TV devices). GPS only refines it.
  const KL_FALLBACK = { lat: 3.139, lon: 101.6869 };
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(KL_FALLBACK);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Track previous patient for audio notification
  const previousPatientIdRef = useRef<string | undefined>(undefined);
  const audioUnlockedRef = useRef(false);

  // Marquee dynamic speed - consistent pixels/second regardless of text length
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [marqueeDuration, setMarqueeDuration] = useState<number>(25); // Default 25s

  // Get user location on component mount
  useEffect(() => {
    if (!showPrayerTimes && !showWeather) return;

    const getLocation = () => {
      if (navigator.geolocation) {
        // Add timeout to prevent hanging indefinitely
        const timeoutId = setTimeout(() => {
          console.warn('Geolocation timeout, using fallback location');
          setLocationError('Location timeout');
          // Fallback to Kuala Lumpur
          setLocation(KL_FALLBACK);
        }, 5000); // 5 second timeout

        navigator.geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeoutId);
            setLocation({
              lat: position.coords.latitude,
              lon: position.coords.longitude
            });
            setLocationError(null);
          },
          (error) => {
            clearTimeout(timeoutId);
            console.warn('Geolocation failed, using fallback location:', error.message);
            setLocationError(error.message);
            // Fallback to Kuala Lumpur
            setLocation(KL_FALLBACK);
          },
          {
            timeout: 4000, // 4 second timeout for getCurrentPosition
            enableHighAccuracy: false
          }
        );
      } else {
        console.warn('Geolocation not supported, using fallback location');
        setLocationError('Geolocation not supported');
        // Fallback to Kuala Lumpur
        setLocation(KL_FALLBACK);
      }
    };

    getLocation();
  }, [showPrayerTimes, showWeather]);

  // Fetch real prayer times from API when showPrayerTimes is enabled and location is available
  const { data: prayerTimesData, isLoading: prayerTimesLoading } = useQuery<PrayerTimesResponse>({
    queryKey: ['/api/prayer-times', location?.lat, location?.lon],
    queryFn: async () => {
      if (!location) throw new Error('Location not available');
      
      const params = new URLSearchParams({
        latitude: location.lat.toString(),
        longitude: location.lon.toString()
      });
      
      const response = await fetch(`/api/prayer-times?${params}`);
      if (!response.ok) throw new Error('Failed to fetch prayer times');
      return response.json();
    },
    enabled: showPrayerTimes && !!location,
    staleTime: 1000 * 60 * 60, // 1 hour - prayer times don't change frequently
    refetchInterval: 1000 * 60 * 30, // Refetch every 30 minutes
  });

  // Fetch real weather data from API when showWeather is enabled and location is available
  const { data: weatherData, isLoading: weatherLoading } = useQuery<WeatherResponse>({
    queryKey: ['/api/weather', location?.lat, location?.lon],
    queryFn: async () => {
      if (!location) throw new Error('Location not available');
      
      const params = new URLSearchParams({
        latitude: location.lat.toString(),
        longitude: location.lon.toString()
      });
      
      console.log('🌤️ Fetching weather for location:', location);
      const response = await fetch(`/api/weather?${params}`);
      if (!response.ok) throw new Error('Failed to fetch weather data');
      const data = await response.json();
      console.log('🌤️ Weather API response:', data);
      return data;
    },
    enabled: showWeather && !!location,
    staleTime: 1000 * 60 * 15, // 15 minutes - weather changes more frequently
    refetchInterval: 1000 * 60 * 30, // Refetch every 30 minutes (server caches for 15 min)
  });

  // Use real prayer times if available, otherwise fall back to props
  const displayPrayerTimes = showPrayerTimes && prayerTimesData?.prayerTimes && prayerTimesData.prayerTimes.length > 0 
    ? prayerTimesData.prayerTimes 
    : (prayerTimes || []);
  
  
  const [minuteKey, setMinuteKey] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setMinuteKey(k => k + 1), 300000);
    return () => clearInterval(timer);
  }, []);

  const { nextPrayer, shouldHighlight } = useMemo(() => {
    if (!showPrayerTimes || !prayerTimesData?.prayerTimes) {
      return { nextPrayer: null, shouldHighlight: false };
    }

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let nextUpcomingPrayer = null;
    let minTimeUntilNext = Infinity;
    
    for (const prayer of prayerTimesData.prayerTimes) {
      const cleanTime = prayer.time.replace(/[^\d:]/g, '');
      const [hours, minutes] = cleanTime.split(':').map(Number);
      if (isNaN(hours) || isNaN(minutes)) continue;
      
      const prayerTime = hours * 60 + minutes;
      const timeDiff = prayerTime - currentMinutes;
      
      if (timeDiff > 0 && timeDiff < minTimeUntilNext) {
        nextUpcomingPrayer = prayer;
        minTimeUntilNext = timeDiff;
      }
    }
    
    if (!nextUpcomingPrayer && prayerTimesData.prayerTimes.length > 0) {
      nextUpcomingPrayer = prayerTimesData.prayerTimes[0];
    }
    
    if (nextUpcomingPrayer) {
      return { nextPrayer: nextUpcomingPrayer.key, shouldHighlight: true };
    }
    
    return { nextPrayer: null, shouldHighlight: false };
  }, [showPrayerTimes, prayerTimesData, minuteKey]);
  
  const [showHighlight, setShowHighlight] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [prevPatientId, setPrevPatientId] = useState<string | undefined>(undefined);
  const [prevCalledAt, setPrevCalledAt] = useState<number | null>(null);
  const [prevRequeueReason, setPrevRequeueReason] = useState<string | null | undefined>(undefined);
  
  // Media slideshow states
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isMediaVisible, setIsMediaVisible] = useState(true);
  
  // Auto-resize text functionality (TV Mode multiplies by 2x)
  const [patientNameFontSize, setPatientNameFontSize] = useState(() => isTVMode ? '14rem' : '7rem');
  const [roomNameFontSize, setRoomNameFontSize] = useState(() => isTVMode ? '5rem' : '2.5rem');
  const [historyFontSizes, setHistoryFontSizes] = useState<Record<string, {name: string, room: string}>>({});
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Function to calculate optimal font size for text to fit container
  const calculateFontSize = (text: string, maxWidth: number, baseSize: number, minSize: number = 16) => {
    if (!text) return `${baseSize}px`;
    
    // Estimate character width (roughly 0.6 of font size for most fonts)
    const charWidth = baseSize * 0.6;
    const textWidth = text.length * charWidth;
    
    if (textWidth <= maxWidth) {
      return `${baseSize}px`;
    }
    
    // Calculate scaling factor
    const scaleFactor = maxWidth / textWidth;
    const newSize = Math.max(baseSize * scaleFactor, minSize);
    
    return `${Math.floor(newSize)}px`;
  };
  
  // Timer refs for cleanup
  const highlightTimerRef = useRef<NodeJS.Timeout | null>(null);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fadeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ytAudioIframeRef = useRef<HTMLIFrameElement | null>(null);
  const ytAudioContainerRef = useRef<HTMLDivElement | null>(null);
  const ytAudioPlayerRef = useRef<any>(null);
  const ytAudioReadyRef = useRef(false);
  const ytAudioDuckedRef = useRef(false);
  const ytAudioVolumeRef = useRef(50);
  const ytAudioOriginalSrcRef = useRef<string>('');


  // Auto-scale 1920×1080 stage to fit any screen size (VIEWPORT-CENTERED APPROACH)
  useEffect(() => {
    if (!isFullscreen || !stageRef.current) return;

    const STAGE_WIDTH = 1920;
    const STAGE_HEIGHT = 1080;
    const stage = stageRef.current;
    const viewport = stage.parentElement;

    const fitStage = () => {
      if (!viewport) return;
      
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;

      // CONTAIN MODE: scale so the WHOLE 1920×1080 stage fits inside the screen
      // without ever overflowing/enlarging. Uses the smaller of the width/height
      // ratios, then centers both axes (letterbox bars appear only where needed).
      // This prevents content from auto-enlarging on screens that are not exactly 16:9.
      const scale = Math.min(vw / STAGE_WIDTH, vh / STAGE_HEIGHT);

      const scaledWidth = STAGE_WIDTH * scale;
      const scaledHeight = STAGE_HEIGHT * scale;
      const marginLeft = (vw - scaledWidth) / 2;   // horizontal centering (left: 0)
      const marginTop = -(scaledHeight / 2);        // vertical centering (top: 50%)

      console.log('🎬 CONTAIN MODE:', {
        viewportSize: `${vw}×${vh}`,
        stageSize: `${STAGE_WIDTH}×${STAGE_HEIGHT}`,
        scale: scale.toFixed(3),
        scaledSize: `${scaledWidth.toFixed(0)}×${scaledHeight.toFixed(0)}`,
        sideBar: `${marginLeft.toFixed(0)}px`,
        topBottomBar: `${((vh - scaledHeight) / 2).toFixed(0)}px`
      });

      // Apply scale and center both axes
      stage.style.transformOrigin = 'top left';
      stage.style.transform = `scale(${scale})`;
      stage.style.marginLeft = `${marginLeft}px`;
      stage.style.marginTop = `${marginTop}px`;
    };

    fitStage();
    window.addEventListener('resize', fitStage);
    window.addEventListener('orientationchange', fitStage);

    return () => {
      window.removeEventListener('resize', fitStage);
      window.removeEventListener('orientationchange', fitStage);
    };
  }, [isFullscreen]);

  // Calculate dynamic marquee duration for consistent speed
  useEffect(() => {
    if (!marqueeRef.current || !enableMarquee) return;

    const calculateDuration = () => {
      const marqueeElement = marqueeRef.current;
      if (!marqueeElement) return;

      const textElement = marqueeElement.querySelector('span');
      if (!textElement) return;

      const textWidth = textElement.offsetWidth;
      const viewportWidth = window.innerWidth;
      
      // Consistent speed: 100 pixels per second (adjust this value for speed)
      const pixelsPerSecond = 100;
      
      // Total distance = text width + viewport width (full scroll from right to left)
      const totalDistance = textWidth + viewportWidth;
      const duration = totalDistance / pixelsPerSecond;

      setMarqueeDuration(duration);

      console.log('🏃 MARQUEE SPEED:', {
        textWidth: `${textWidth}px`,
        viewportWidth: `${viewportWidth}px`,
        totalDistance: `${totalDistance}px`,
        speed: `${pixelsPerSecond}px/s`,
        duration: `${duration.toFixed(1)}s`
      });
    };

    // Calculate on mount and when text changes
    calculateDuration();
    
    // Recalculate on window resize
    window.addEventListener('resize', calculateDuration);
    
    return () => window.removeEventListener('resize', calculateDuration);
  }, [marqueeText, enableMarquee]);

  // Detect new patient call and trigger animation sequence + AUDIO
  // Trigger on EITHER: new patient ID OR same patient called again (calledAt changes)
  // SKIP TRIGGER if patient was requeued but calledAt hasn't changed (old call before requeue)
  useEffect(() => {
    // Convert Date to timestamp number for reliable comparison
    const currentCalledAtTimestamp = currentPatient?.calledAt ? new Date(currentPatient.calledAt).getTime() : null;
    
    // Detect if patient was requeued (requeueReason changed from undefined/null to a value)
    const wasRequeued = currentPatient?.requeueReason && 
                        currentPatient.requeueReason !== prevRequeueReason;
    
    // If patient was requeued, update tracking but DON'T trigger highlight/sound
    if (wasRequeued && currentPatient?.id === prevPatientId) {
      console.log('🔄 PATIENT REQUEUED - Updating tracking (no trigger):', {
        patientId: currentPatient.id,
        requeueReason: currentPatient.requeueReason,
        prevRequeueReason,
        keepingCalledAt: currentCalledAtTimestamp
      });
      // Keep current calledAt - only NEW calls after requeue will trigger
      setPrevCalledAt(currentCalledAtTimestamp);
      setPrevRequeueReason(currentPatient.requeueReason);
      return; // Don't trigger highlight for requeue action itself
    }
    
    // Only trigger audio for NEW calls (calledAt timestamp INCREASES, not just changes)
    // This prevents audio when switching back to older patient after dispensing recent one
    const hasNewCall = currentPatient && 
      currentCalledAtTimestamp && 
      currentCalledAtTimestamp > (prevCalledAt || 0);
    
    console.log('🔔 TV TRIGGER CHECK:', {
      hasNewCall,
      currentPatientId: currentPatient?.id,
      prevPatientId,
      currentCalledAtTimestamp,
      prevCalledAt,
      calledAtChanged: currentCalledAtTimestamp !== prevCalledAt,
      requeueReason: currentPatient?.requeueReason,
      wasRequeued
    });
    
    if (hasNewCall) {
      // Clean up any existing timers
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      if (blinkTimerRef.current) {
        clearInterval(blinkTimerRef.current);
      }
      
      setShowHighlight(false);
      setIsBlinking(false);
      
      const audioSettings: AudioSettings = {
        enableSound: (settingsObj.enableSound ?? 'true') === 'true',
        volume: parseInt(settingsObj.volume || '70', 10),
        soundMode: 'preset',
        presetKey: (settingsObj.presetKey || 'notification_sound') as any,
        ttsEnabled: (settingsObj.ttsEnabled ?? 'false') === 'true',
        ttsLanguage: (settingsObj.ttsLanguage as any) || 'ms-MY',
        ttsRate: parseFloat(settingsObj.ttsRate || '0.9'),
        ttsVoiceGender: (settingsObj.ttsVoiceGender as any) || 'FEMALE',
        ttsPronunciations: settingsObj.ttsPronunciations ? (() => { try { const parsed = JSON.parse(settingsObj.ttsPronunciations); return parsed.map((r: any) => ({ original: r.original || '', replacementBM: r.replacementBM || r.replacement || '', replacementEN: r.replacementEN || r.replacement || '' })); } catch { return []; } })() : [],
      };

      if (!disableAudio && (audioSettings.enableSound || audioSettings.ttsEnabled)) {
        const player = ytAudioPlayerRef.current;
        if (isFullscreen && player && ytAudioReadyRef.current) {
          ytAudioDuckedRef.current = true;
          try { player.setVolume(0); } catch {}
          console.log('🔇 YouTube audio ducked for calling sequence');
        }

        const restoreAudio = () => {
          ytAudioDuckedRef.current = false;
          const playerNow = ytAudioPlayerRef.current;
          if (isFullscreen && playerNow && ytAudioReadyRef.current) {
            try {
              playerNow.unMute();
              playerNow.setVolume(youtubeAudioVolume);
              console.log('🔊 YouTube audio restored, volume:', youtubeAudioVolume);
            } catch {}
          }
        };

        audioSystem.playCallingSequence({
          patientName: currentPatient.name,
          patientNumber: parseInt(currentPatient.number, 10),
          windowName: currentPatient.room
        }, audioSettings).then(restoreAudio).catch(error => {
          console.error('Failed to play calling sound:', error);
          restoreAudio();
        });
      }
      
      setShowHighlight(true);
      
      highlightTimerRef.current = setTimeout(() => {
        setShowHighlight(false);
        setIsBlinking(true);
        
        blinkTimerRef.current = setTimeout(() => {
          setIsBlinking(false);
        }, 4000);
        
      }, 5000);

      // Update previous patient ID, calledAt timestamp, and requeueReason
      setPrevPatientId(currentPatient.id);
      setPrevCalledAt(currentCalledAtTimestamp);
      setPrevRequeueReason(currentPatient.requeueReason);
    }
  }, [currentPatient?.id, currentPatient?.calledAt, currentPatient?.requeueReason]); // Depend on patient ID, calledAt, AND requeueReason changes

  // Auto-resize text effect - adjust font sizes based on text length
  useEffect(() => {
    if (currentPatient) {
      // Calculate container widths (approximate based on typical screen sizes)
      const isFullSize = isFullscreen;
      const nameContainerWidth = isFullSize ? 600 : 400; // Approximate container width
      const roomContainerWidth = isFullSize ? 400 : 300; // Room container is smaller
      
      // Base font sizes 
      const nameBaseSize = isFullSize ? 80 : 60; // Bigger calling name
      const roomBaseSize = isFullSize ? 50 : 40; // Bigger calling room
      
      // Calculate optimal font sizes
      const newNameSize = calculateFontSize(getDisplayName(currentPatient.name), nameContainerWidth, nameBaseSize, 20);
      const newRoomSize = calculateFontSize(currentPatient.room, roomContainerWidth, roomBaseSize, 16);
      
      setPatientNameFontSize(newNameSize);
      setRoomNameFontSize(newRoomSize);
    }
  }, [currentPatient?.name, currentPatient?.room, isFullscreen]);

  // Auto-resize text effect for history items
  useEffect(() => {
    if (queueHistory.length > 0) {
      const newHistoryFontSizes: Record<string, {name: string, room: string}> = {};
      
      // Calculate container widths for history items (bigger containers for bigger text)
      const isFullSize = isFullscreen;
      const historyNameContainerWidth = isFullSize ? 450 : 350; // Bigger name column width
      const historyRoomContainerWidth = isFullSize ? 300 : 250; // Bigger room column width
      
      // Base font sizes for history (bigger base sizes)
      const historyNameBaseSize = isFullSize ? 56 : 42; // Bigger history name size
      const historyRoomBaseSize = isFullSize ? 56 : 42; // Bigger history room size
      
      queueHistory.forEach((item) => {
        const nameFontSize = calculateFontSize(getDisplayName(item.name), historyNameContainerWidth, historyNameBaseSize, 22); // Bigger minimum size
        const roomFontSize = calculateFontSize(item.room, historyRoomContainerWidth, historyRoomBaseSize, 22); // Bigger minimum size
        
        newHistoryFontSizes[item.id] = {
          name: nameFontSize,
          room: roomFontSize
        };
      });
      
      setHistoryFontSizes(newHistoryFontSizes);
    }
  }, [queueHistory, isFullscreen]);

  const youtubeAudioItemEarly = mediaItems.find(m => m.type === 'youtube-audio');
  const visibleMediaItems = mediaItems.filter(m => m.type !== 'youtube-audio');

  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    try {
      return sessionStorage.getItem('tv-audio-unlocked') === '1';
    } catch {
      return false;
    }
  });

  const unlockAudio = () => {
    try { sessionStorage.setItem('tv-audio-unlocked', '1'); } catch {}
    // CRITICAL: call unMute/setVolume/playVideo SYNCHRONOUSLY inside the click
    // handler so the browser still considers this a user gesture. If we wait
    // for React re-render + effect, the gesture context is lost and Chrome
    // silently keeps the player muted.
    try {
      const player = ytAudioPlayerRef.current;
      if (player) {
        try { player.playVideo(); } catch {}
        try { player.unMute(); } catch {}
        try { player.setVolume(ytAudioVolumeRef.current); } catch {}
      }
    } catch {}
    setAudioUnlocked(true);
  };

  const showAudioGate = isFullscreen && !!youtubeAudioItemEarly && !audioUnlocked;

  const [ytPlayerState, setYtPlayerState] = useState<string>('INIT');

  const [diagnosticBadgeVisible, setDiagnosticBadgeVisible] = useState(true);
  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleHide = () => {
      if (hideTimer) clearTimeout(hideTimer);
      hideTimer = setTimeout(() => setDiagnosticBadgeVisible(false), 3000);
    };
    const handleActivity = () => {
      setDiagnosticBadgeVisible(true);
      scheduleHide();
    };
    scheduleHide();
    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  // Standalone helper used by the diagnostic badge. Must NOT depend on any
  // function declared later in the component (no hoisting for const).
  function extractYtId(url: string | undefined): string {
    if (!url) return '';
    const t = url.trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(t)) return t;
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,
      /\/live\/([a-zA-Z0-9_-]{11})/,
      /\/shorts\/([a-zA-Z0-9_-]{11})/,
      /\/embed\/([a-zA-Z0-9_-]{11})/,
      /\/v\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const p of patterns) {
      const m = t.match(p);
      if (m) return m[1];
    }
    return '';
  }

  let audioDiagnostic: string | null = null;
  if (isFullscreen) {
    if (!youtubeAudioItemEarly) {
      audioDiagnostic = 'AUDIO: NO URL (settings)';
    } else {
      const vid = extractYtId(youtubeAudioItemEarly.url);
      if (!vid) {
        audioDiagnostic = `AUDIO: BAD URL (${(youtubeAudioItemEarly.url || '').slice(0, 30)})`;
      } else if (youtubeAudioVolume === 0) {
        audioDiagnostic = 'AUDIO: VOL 0%';
      } else if (!audioUnlocked) {
        audioDiagnostic = 'AUDIO: TAP NEEDED';
      } else {
        audioDiagnostic = `AUDIO: ${ytPlayerState} v${youtubeAudioVolume}`;
      }
    }
  }

  // Load YouTube IFrame API script once
  useEffect(() => {
    if ((window as any).YT && (window as any).YT.Player) return;
    if (document.getElementById('youtube-iframe-api-script')) return;
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
  }, []);

  // Extract YouTube video ID — supports watch, youtu.be, live, shorts, embed,
  // mobile (m.youtube.com), music.youtube.com, and bare 11-char IDs.
  const getYouTubeVideoId = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    // Already a bare 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
    const patterns = [
      /[?&]v=([a-zA-Z0-9_-]{11})/,           // ...watch?v=ID
      /youtu\.be\/([a-zA-Z0-9_-]{11})/,      // youtu.be/ID
      /\/live\/([a-zA-Z0-9_-]{11})/,         // /live/ID
      /\/shorts\/([a-zA-Z0-9_-]{11})/,       // /shorts/ID
      /\/embed\/([a-zA-Z0-9_-]{11})/,        // /embed/ID
      /\/v\/([a-zA-Z0-9_-]{11})/,            // /v/ID (old format)
    ];
    for (const re of patterns) {
      const match = trimmed.match(re);
      if (match && match[1]) return match[1];
    }
    return '';
  };

  // Initialize YT.Player (muted autoplay) as soon as fullscreen + URL are
  // available — do NOT wait for audioUnlocked. This way the player is already
  // loaded when the user taps the gate, and we can call unMute() synchronously
  // inside the click handler (preserving the user gesture context).
  useEffect(() => {
    if (!isFullscreen || !youtubeAudioItemEarly) return;
    const videoId = getYouTubeVideoId(youtubeAudioItemEarly.url);
    if (!videoId) return;

    let cancelled = false;
    let initIntervalId: any = null;

    const createPlayer = () => {
      if (cancelled) return;
      const YT = (window as any).YT;
      if (!YT || !YT.Player || !ytAudioContainerRef.current) return;

      // Destroy old player if any
      if (ytAudioPlayerRef.current) {
        try { ytAudioPlayerRef.current.destroy(); } catch {}
        ytAudioPlayerRef.current = null;
      }
      ytAudioReadyRef.current = false;

      // Create a target div for YT.Player
      ytAudioContainerRef.current.innerHTML = '<div id="yt-audio-player-target"></div>';

      ytAudioPlayerRef.current = new YT.Player('yt-audio-player-target', {
        videoId,
        playerVars: {
          autoplay: 1,
          loop: 1,
          playlist: videoId,
          controls: 0,
          enablejsapi: 1,
          mute: 1, // Start muted so autoplay works; we'll unMute after PLAYING
        },
        events: {
          onReady: (e: any) => {
            ytAudioReadyRef.current = true;
            try {
              const vol = ytAudioDuckedRef.current ? 0 : ytAudioVolumeRef.current;
              const alreadyUnlocked = (() => {
                try { return sessionStorage.getItem('tv-audio-unlocked') === '1'; } catch { return false; }
              })();
              // Set baseline volume so unMute() won't spike to default 100.
              e.target.setVolume(vol);
              e.target.mute();
              e.target.playVideo();
              if (alreadyUnlocked) {
                // User has tapped earlier (or refreshed within session).
                // Browser autoplay quota is granted — unmute under our control.
                e.target.unMute();
                e.target.setVolume(vol);
                console.log('🔊 [YT Audio] Player ready, AUTO-UNMUTED (session unlocked) vol:', vol);
              } else {
                console.log('🔊 [YT Audio] Player ready, baseline volume set to:', vol);
              }
            } catch (err) {
              console.error('🔊 [YT Audio] onReady error:', err);
            }
          },
          onError: (e: any) => {
            // YT error codes: 2=invalid param, 5=html5 error, 100=not found,
            // 101/150=embed disabled by owner
            const code = e?.data;
            const map: Record<number, string> = { 2: 'BAD-PARAM', 5: 'HTML5-ERR', 100: 'NOT-FOUND', 101: 'EMBED-OFF', 150: 'EMBED-OFF' };
            setYtPlayerState(`ERR-${map[code] || code}`);
            console.error('🔊 [YT Audio] Player error:', code);
          },
          onStateChange: (e: any) => {
            // -1=unstarted 0=ended 1=playing 2=paused 3=buffering 5=cued
            const stateMap: Record<number, string> = { '-1': 'UNSTART', 0: 'ENDED', 1: 'PLAY', 2: 'PAUSE', 3: 'BUFFER', 5: 'CUED' } as any;
            setYtPlayerState(stateMap[e.data] || `S${e.data}`);

            // Auto-recovery: if player stalls in UNSTART/CUED/PAUSED/ENDED
            // and the user has already authorized audio, force playVideo()
            // again. Browser autoplay quota is granted for the whole session
            // after the first user gesture, so this will succeed.
            const isUnlocked = (() => {
              try { return sessionStorage.getItem('tv-audio-unlocked') === '1'; } catch { return false; }
            })();
            if (isUnlocked && (e.data === -1 || e.data === 5 || e.data === 2 || e.data === 0) && ytAudioPlayerRef.current) {
              setTimeout(() => {
                try {
                  if (!ytAudioPlayerRef.current) return;
                  ytAudioPlayerRef.current.playVideo();
                  ytAudioPlayerRef.current.unMute();
                  ytAudioPlayerRef.current.setVolume(ytAudioVolumeRef.current);
                  console.log('🔊 [YT Audio] Auto-recovery: forcing playVideo from state', e.data);
                } catch {}
              }, 300);
            }

            // YT.PlayerState.PLAYING === 1
            if (e.data === 1 && ytAudioPlayerRef.current) {
              const vol = ytAudioDuckedRef.current ? 0 : ytAudioVolumeRef.current;
              // Only attempt unMute if user has already authorized audio.
              // Otherwise stay muted; the click handler will unmute under
              // a fresh user gesture.
              const alreadyUnlocked = (() => {
                try { return sessionStorage.getItem('tv-audio-unlocked') === '1'; } catch { return false; }
              })();
              if (!alreadyUnlocked) {
                console.log('🔊 [YT Audio] PLAYING (muted) - waiting for user tap');
                return;
              }
              try {
                // Baseline already set in onReady, so unMute restores to `vol` not 100
                ytAudioPlayerRef.current.setVolume(vol);
                ytAudioPlayerRef.current.unMute();
                ytAudioPlayerRef.current.setVolume(vol);
                console.log('🔊 [YT Audio] PLAYING - volume forced to:', vol);

                // Re-enforce after small delays — read ref so latest slider value is honored
                setTimeout(() => {
                  if (ytAudioPlayerRef.current) {
                    try {
                      const v = ytAudioDuckedRef.current ? 0 : ytAudioVolumeRef.current;
                      ytAudioPlayerRef.current.setVolume(v);
                    } catch {}
                  }
                }, 500);
                setTimeout(() => {
                  if (ytAudioPlayerRef.current) {
                    try {
                      const v = ytAudioDuckedRef.current ? 0 : ytAudioVolumeRef.current;
                      ytAudioPlayerRef.current.setVolume(v);
                    } catch {}
                  }
                }, 2000);
              } catch (err) {
                console.error('🔊 [YT Audio] onStateChange error:', err);
              }
            }
          },
        },
      });
    };

    // Wait for YT API to be ready
    if ((window as any).YT && (window as any).YT.Player) {
      createPlayer();
    } else {
      const prevCallback = (window as any).onYouTubeIframeAPIReady;
      (window as any).onYouTubeIframeAPIReady = () => {
        if (typeof prevCallback === 'function') prevCallback();
        createPlayer();
      };
      // Fallback poll in case callback was missed
      initIntervalId = setInterval(() => {
        if ((window as any).YT && (window as any).YT.Player) {
          clearInterval(initIntervalId);
          createPlayer();
        }
      }, 200);
    }

    // WATCHDOG: every 1.5s check if player is stuck in a non-playing state
    // (UNSTART, CUED, PAUSED, ENDED) while the user has authorized audio.
    // This catches the case where the initial UNSTART state never fires
    // onStateChange (no transition to recover from), and any silent stalls.
    const watchdog = setInterval(() => {
      if (cancelled) return;
      const player = ytAudioPlayerRef.current;
      if (!player || !ytAudioReadyRef.current) return;
      const isUnlocked = (() => {
        try { return sessionStorage.getItem('tv-audio-unlocked') === '1'; } catch { return false; }
      })();
      if (!isUnlocked) return;
      try {
        const state = typeof player.getPlayerState === 'function' ? player.getPlayerState() : null;
        // 1=PLAYING, 3=BUFFERING are healthy
        if (state === 1 || state === 3) return;
        // Stuck — kick it
        player.playVideo();
        player.unMute();
        player.setVolume(ytAudioVolumeRef.current);
        console.log('🔊 [YT Audio] Watchdog kicked stuck player from state', state);
      } catch {}
    }, 1500);

    return () => {
      cancelled = true;
      clearInterval(watchdog);
      if (initIntervalId) clearInterval(initIntervalId);
      if (ytAudioPlayerRef.current) {
        try { ytAudioPlayerRef.current.destroy(); } catch {}
        ytAudioPlayerRef.current = null;
      }
      ytAudioReadyRef.current = false;
    };
  }, [isFullscreen, youtubeAudioItemEarly?.url]);

  // Keep latest volume in a ref so closures (onReady/onStateChange/setTimeout) always read fresh value
  useEffect(() => {
    ytAudioVolumeRef.current = youtubeAudioVolume;
    if (!ytAudioPlayerRef.current || !ytAudioReadyRef.current) return;
    const vol = ytAudioDuckedRef.current ? 0 : youtubeAudioVolume;
    try {
      ytAudioPlayerRef.current.unMute();
      ytAudioPlayerRef.current.setVolume(vol);
      console.log('🔊 [YT Audio] Volume updated to:', vol);
    } catch (err) {
      console.error('🔊 [YT Audio] setVolume error:', err);
    }
  }, [youtubeAudioVolume]);

  // Media slideshow management 
  useEffect(() => {
    if (visibleMediaItems.length > 1) {
      mediaTimerRef.current = setInterval(() => {
        setIsMediaVisible(false);
        
        fadeTimerRef.current = setTimeout(() => {
          setCurrentMediaIndex((prev) => (prev + 1) % visibleMediaItems.length);
          setIsMediaVisible(true);
        }, 500);
        
      }, 10000);
      
      return () => {
        if (mediaTimerRef.current) {
          clearInterval(mediaTimerRef.current);
        }
        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
        }
      };
    }
  }, [visibleMediaItems.length]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      if (blinkTimerRef.current) {
        clearInterval(blinkTimerRef.current);
      }
      if (mediaTimerRef.current) {
        clearInterval(mediaTimerRef.current);
      }
      if (fadeTimerRef.current) {
        clearTimeout(fadeTimerRef.current);
      }
    };
  }, []);


  // YouTube video helper functions
  const isYouTubeUrl = (url: string): boolean => {
    if (!url) return false;
    return /youtube\.com|youtu\.be/i.test(url);
  };

  const getYouTubeEmbedUrl = (url: string): string => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId) return url;
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
  };

  const getYouTubeAudioEmbedUrl = (url: string): string => {
    let videoId = '';
    if (url.includes('youtube.com/watch')) {
      videoId = url.split('v=')[1]?.split('&')[0] || '';
    } else if (url.includes('youtube.com/live/')) {
      videoId = url.split('live/')[1]?.split('?')[0] || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
    }
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`;
  };

  const currentMedia = visibleMediaItems.length > 0 ? visibleMediaItems[currentMediaIndex % visibleMediaItems.length] : null;

  // Fixed 1920×1080 stage styling (only for fullscreen)
  const stageStyle = isFullscreen ? {
    position: 'absolute' as const,
    top: '50%',
    left: 0,
    width: '1920px',
    height: '1080px',
    transform: 'scale(1)',
    transformOrigin: 'top left', // Scale from top-left corner
    overflow: 'hidden',
    display: 'grid',
    gridTemplateRows: '870px 210px', // Big media area on top (870px), info bar with clinic name + clock/prayer below (210px) = 1080px total
    gridTemplateColumns: '1420px 500px', // Narrower right panel so media area is bigger: Left 1420px, Right 500px = 1920px total
    gap: 0,
    padding: 0,
    boxSizing: 'border-box' as const,
    minWidth: 0,
    minHeight: 0,
    colorScheme: 'light',
    color: '#111827',
    ...getBackgroundStyle(headerBackgroundMode, headerBackgroundColor, headerBackgroundGradient, '#ffffff')
  } : {
    gridTemplateRows: 'auto 1fr',
    gridTemplateColumns: '74% 26%',
    gap: '0',
    colorScheme: 'light',
    color: '#111827',
    ...getBackgroundStyle(headerBackgroundMode, headerBackgroundColor, headerBackgroundGradient, '#ffffff')
  };

  const wrapperClass = isFullscreen 
    ? `grid${isTVMode ? ' tv-mode' : ''}`
    : `h-screen grid${isTVMode ? ' tv-mode' : ''}`;

  // Render content - same for both fullscreen and non-fullscreen
  const renderContent = () => (
    <>
      {/* Top Row - Advertisement Area with 16:9 ratio */}
      <div className={`${isFullscreen ? 'm-0 p-0 w-full h-full' : 'p-4 w-full'}`}>
        <div className="overflow-hidden flex items-center justify-center w-full h-full relative" style={{ aspectRatio: '16/9', backgroundColor: '#f3f4f6', colorScheme: 'light', color: '#111827' }}>
          {currentMedia ? (
            <div 
              className="absolute inset-0 w-full h-full transition-opacity ease-in-out"
              style={{ 
                opacity: isMediaVisible ? 1 : 0,
                transitionDuration: '500ms'
              }}
            >
              {isYouTubeUrl(currentMedia.url) ? (
                <iframe
                  src={getYouTubeEmbedUrl(currentMedia.url)}
                  className="w-full h-full"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  data-testid="youtube-content"
                />
              ) : currentMedia.type === "image" ? (
                <img 
                  src={currentMedia.url} 
                  alt="Media Content" 
                  className="w-full h-full object-cover"
                  data-testid="media-content"
                />
              ) : (
                <video 
                  src={currentMedia.url} 
                  className="w-full h-full object-cover"
                  autoPlay
                  muted
                  loop
                  data-testid="media-content"
                />
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center" style={{ color: '#6B7280' }}>
                <div className="text-5xl font-bold mb-4" data-testid="no-display-message">
                  NO DISPLAY
                </div>
                <p className="text-lg">No media uploaded</p>
              </div>
            </div>
          )}
          
          {/* Media indicator dots */}
          {visibleMediaItems.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {visibleMediaItems.map((_, index) => (
                <div
                  key={index}
                  className="w-3 h-3 rounded-full transition-all duration-300"
                  style={{
                    backgroundColor: index === currentMediaIndex ? '#ffffff' : 'rgba(255,255,255,0.5)',
                    boxShadow: index === currentMediaIndex ? '0 4px 6px rgba(0,0,0,0.3)' : 'none'
                  }}
                  data-testid={`media-indicator-${index}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Right - Patient Names Header and History */}
      <div className={`${isFullscreen ? 'p-0 m-0 row-span-2' : 'p-4 row-span-2'} flex flex-col w-full h-full`}
           style={{
             color: '#ffffff',
             // Reserve space for the floating marquee so it never covers the call history
             ...(isFullscreen && enableMarquee ? { paddingBottom: '70px' } : {}),
             ...getBackgroundStyle(headerBackgroundMode, headerBackgroundColor, headerBackgroundGradient, '#0f172a')
           }}>
        {/* Header */}
        <div className={`text-center ${isFullscreen ? 'mb-3 pt-4 px-4' : 'mb-4'}`}>
          {/* Logo Display - Use uploaded logo if enabled */}
          {showClinicLogo && clinicLogo && (
            <div className={isFullscreen ? 'mb-3' : 'mb-4'}>
              <div className="rounded-lg p-4 shadow-lg w-full flex items-center justify-center tv-white-bg" style={{ backgroundColor: '#ffffff', backgroundImage: 'linear-gradient(#ffffff, #ffffff)' }}>
                <img 
                  src={clinicLogo} 
                  alt="Clinic Logo" 
                  className="h-32 w-auto object-contain"
                  style={{ maxWidth: '350px' }}
                  data-testid="clinic-logo"
                />
              </div>
            </div>
          )}
          <div className={`px-4 py-2 ${isFullscreen ? 'rounded-md' : 'rounded-lg mt-2'}`}
               style={{
                 ...getBackgroundStyle(callBackgroundMode, callBackgroundColor, callBackgroundGradient, '#16a34a'),
                 color: '#ffffff'
               }}>
            <h2 className="font-bold" style={{ 
              fontSize: 'var(--tv-fs-xl, 32px)', // Responsive: auto-scales from 22px to 48px
              ...getTextGroupStyles('title', true), // Exclude color overrides so Settings can override
              ...getTextStyle(callNameTextMode, callNameTextColor, callNameTextGradient, '#ffffff')
            }}>CALLING</h2>
          </div>
        </div>

        {/* Current Patient Display */}
        {currentPatient ? (
          <div className={`${isFullscreen ? 'p-2 mx-4 rounded-md mb-3' : 'p-3 rounded-lg mb-3'} text-center`}
               style={{
                 ...getBackgroundStyle(callBackgroundMode, callBackgroundColor, callBackgroundGradient, '#16a34a')
               }}>
            <div className={`font-bold ${isBlinking ? 'tv-blink-active' : ''}`}
                 style={{ 
                   fontSize: patientNameFontSize,
                   lineHeight: '1.1',
                   wordBreak: 'break-word',
                   overflow: 'hidden',
                   ...getTextStyle(callNameTextMode, callNameTextColor, callNameTextGradient, '#facc15')
                 }} 
                 data-testid="current-patient-display">
              {getDisplayName(currentPatient.name)}
            </div>
            <div className={isBlinking ? 'tv-blink-active' : ''}
                 style={{ 
                   fontSize: roomNameFontSize,
                   lineHeight: '1.1',
                   wordBreak: 'break-word',
                   overflow: 'hidden',
                   ...getTextStyle(windowTextMode, windowTextColor, windowTextGradient, '#facc15')
                 }} 
                 data-testid="current-room">
              {currentPatient.room}
            </div>
          </div>
        ) : (
          <div className={`${isFullscreen ? 'p-2 mx-4 rounded-md mb-3' : 'p-3 rounded-lg mb-3'} text-center`}
               style={{
                 ...getBackgroundStyle(callBackgroundMode, callBackgroundColor, callBackgroundGradient, '#16a34a')
               }}>
            <div style={{ fontSize: 'var(--tv-fs-2xl, 48px)', color: '#ffffff' }}>N/A</div>
          </div>
        )}

        {/* History Section - Recent Calling History */}
        <div className={`flex-1 flex flex-col min-h-0 ${isFullscreen ? 'px-4 pb-4' : 'mt-4'}`}>
          {/* Recent Calling History Items (rolling log of recent calls, max 4) */}
          <div className={`grid grid-rows-4 overflow-hidden flex-1 min-h-0 ${isFullscreen ? 'gap-3' : 'gap-2'}`} data-testid="queue-list">
            {Array.from({ length: 4 }).map((_, idx) => {
              const item = queueHistory[idx];
              if (!item) {
                return (
                  <div key={`empty-${idx}`} className="rounded-lg min-h-0 opacity-0" />
                );
              }
              return (
                <div key={item.id} className="flex flex-col items-center justify-center px-2 py-1 rounded-lg min-h-0 leading-none text-center"
                     style={{
                       ...getBackgroundStyle(queueItemBackgroundMode, queueItemBackgroundColor, queueItemBackgroundGradient, '#2563eb')
                     }}>
                  <div style={{ flex: '3 1 0', minHeight: 0, width: '100%', textAlign: 'center' }}>
                    <FitText
                      text={getDisplayName(item.name)}
                      baseStyle={{ ...getHistoryNameStyle(), fontWeight: 'bold', textAlign: 'center' }}
                      maxFontSize={isFullscreen ? 64 : 48}
                      minFontSize={isFullscreen ? 24 : 20}
                      align="center"
                    />
                  </div>
                  <div style={{ flex: '2 1 0', minHeight: 0, width: '100%', textAlign: 'center' }}>
                    <FitText
                      text={item.room}
                      baseStyle={{ ...getHistoryNameStyle(), fontWeight: 'normal', opacity: 0.9, textAlign: 'center' }}
                      maxFontSize={isFullscreen ? 44 : 32}
                      minFontSize={isFullscreen ? 18 : 16}
                      align="center"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Second Row Left - Date & Prayer Times / Weather */}
      <div className={`${isFullscreen ? 'px-4 py-1 m-0' : 'px-4 py-2'} w-full h-full flex flex-col items-center justify-center overflow-hidden`}
           style={{
             color: '#ffffff',
             // Reserve space for the floating marquee so it never covers the clock/prayer bar
             ...(isFullscreen && enableMarquee ? { paddingBottom: '60px' } : {}),
             ...getBackgroundStyle(showWeather ? weatherBackgroundMode : prayerTimesBackgroundMode, showWeather ? weatherBackgroundColor : prayerTimesBackgroundColor, showWeather ? weatherBackgroundGradient : prayerTimesBackgroundGradient, showWeather ? '#f97316' : '#1e40af')
           }}>
        {/* Clinic Name - below media area */}
        <h1 className="font-bold text-center leading-none mb-2 w-full"
            style={{
              ...getTextGroupStyles('clinic_name', true), // Exclude color overrides so Settings can override
              ...getTextStyle(clinicNameTextMode, clinicNameTextColor, clinicNameTextGradient, '#ffffff'),
              fontSize: 'var(--tv-fs-xl, 32px)', // Responsive
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              flexShrink: 0, // Never collapse when vertical space is tight (e.g. marquee enabled in fullscreen)
              paddingTop: '2px', // Prevent glyph tops from being clipped with leading-none
            }}
            data-testid="clinic-name">
          {clinicName}
        </h1>

        {/* Combined Date/Time + Prayer Times / Weather in ONE white box */}
        <div className={`px-4 tv-white-bg w-full ${isFullscreen ? 'py-2 rounded-md' : 'py-3 rounded-lg'}`} style={{ backgroundColor: '#ffffff', backgroundImage: 'linear-gradient(#ffffff, #ffffff)', color: '#111827' }}>
          <FitRow
            className="flex items-center justify-between gap-6 px-4 whitespace-nowrap"
            refitKey={`${prayerTimesLoading}-${displayPrayerTimes.length}-${showWeather}-${weatherLoading ? 1 : 0}`}
          >
            <IsolatedClock />

            {/* Compact Prayer Times block (right of clock, single row) */}
            {showPrayerTimes && (
              <div className="flex items-center gap-4" data-testid="prayer-times-inline">
                <div className="text-center leading-tight">
                  <span className="text-3xl" style={{ color: '#b45309' }}>🕌</span>
                  <div className="font-bold text-lg" style={{ color: '#111827' }}>PRAYER<br />TIME</div>
                </div>

                {prayerTimesLoading && (
                  <div className="text-base" style={{ color: '#4B5563' }}>Loading prayer times...</div>
                )}

                {!prayerTimesLoading && displayPrayerTimes.length > 0 && (
                  <div className="grid grid-cols-5 gap-6">
                    {displayPrayerTimes.map((prayer, index) => {
                      const isCurrentPrayer = nextPrayer === prayer.key && shouldHighlight;
                      const color = isCurrentPrayer ? '#d97706' : '#111827';
                      return (
                        <div key={prayer.key || index} className="text-center leading-tight">
                          <div className={`font-bold text-2xl ${isCurrentPrayer ? 'animate-pulse' : ''}`} style={{ color }}>
                            {prayer.name}
                          </div>
                          <div className={`text-2xl ${isCurrentPrayer ? 'font-bold' : ''}`} style={{ color: isCurrentPrayer ? '#d97706' : '#374151' }}>
                            {prayer.time}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {!prayerTimesLoading && displayPrayerTimes.length === 0 && (
                  <div className="text-base" style={{ color: '#4B5563' }}>Prayer times not available</div>
                )}
              </div>
            )}

            {/* Compact Weather block (right of clock, single row) */}
            {showWeather && (
              <div className="flex items-center gap-3" data-testid="weather-inline">
                {weatherLoading ? (
                  <div className="text-base" style={{ color: '#4B5563' }}>Loading weather...</div>
                ) : weatherData ? (
                  <>
                    <span className="text-5xl">{weatherData.current.icon}</span>
                    <span className="text-4xl font-bold" style={{ color: '#111827' }}>
                      {weatherData.current.temperature}{weatherData.units.temperature}
                    </span>
                    {/* Hide extra details when prayer times are also shown, to guarantee single-row fit */}
                    {!showPrayerTimes && (
                      <>
                        <span className="text-base truncate" style={{ color: '#374151', maxWidth: '260px' }}>
                          {weatherData.current.description}
                        </span>
                        <span className="text-base" style={{ color: '#4B5563' }}>
                          💧 {weatherData.current.humidity}{weatherData.units.humidity}
                        </span>
                      </>
                    )}
                  </>
                ) : (
                  <div className="text-base" style={{ color: '#4B5563' }}>Weather unavailable</div>
                )}
              </div>
            )}
          </FitRow>
        </div>
      </div>

      
      {/* Floating Marquee Overlay */}
      {isFullscreen && enableMarquee && (
        <div 
          className="fixed bottom-0 left-0 w-full py-2 z-50"
          style={{
            color: '#ffffff',
            ...getBackgroundStyle(marqueeBackgroundMode, marqueeBackgroundColor, marqueeBackgroundGradient, '#1e40af')
          }}
        >
          <div className="overflow-hidden w-full">
            <div 
              ref={marqueeRef}
              className="inline-flex whitespace-nowrap animate-marquee" 
              data-testid="marquee-container" 
              aria-hidden="false"
              style={{
                animationDuration: `${marqueeDuration}s`
              }}
            >
              <span 
                className="px-8 font-bold text-3xl" 
                style={{ 
                  fontSize: 'clamp(2rem, 2.5vw, 2.5rem)',
                  color: marqueeColor
                }}
              >
                {marqueeText}
              </span>
              <span 
                className="px-8 font-bold text-3xl" 
                style={{ 
                  fontSize: 'clamp(2rem, 2.5vw, 2.5rem)',
                  color: marqueeColor
                }} 
                aria-hidden="true"
              >
                {marqueeText}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Highlight Overlay - Cinematic calling display */}
      {showHighlight && currentPatient && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center tv-highlight-animate"
             style={{
               background: 'radial-gradient(ellipse at center, rgba(15,23,42,0.95) 0%, rgba(0,0,0,0.98) 70%)'
             }}
             data-testid="highlight-overlay">
          {/* Animated glow ring behind content */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="rounded-3xl tv-highlight-glow"
                 style={{
                   width: 'min(85vw, 1400px)',
                   height: 'min(75vh, 800px)',
                   border: `3px solid ${modalBorderColor}`,
                   background: `linear-gradient(135deg, ${modalBackgroundColor}ee 0%, ${modalBackgroundColor}99 100%)`
                 }} />
          </div>

          {/* Shimmer overlay */}
          <div className="absolute inset-0 pointer-events-none tv-highlight-fade-in"
               style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <div className="tv-highlight-shimmer absolute inset-0 opacity-30 rounded-3xl"
                 style={{ width: 'min(85vw, 1400px)', height: 'min(75vh, 800px)', margin: 'auto' }} />
          </div>

          {/* Main content */}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-8"
               style={{ maxWidth: '1200px', width: '90%' }}>

            {/* CALLING badge */}
            <div className="mb-6 px-10 py-3 rounded-full tv-highlight-pulse-border"
                 style={{
                   border: `2px solid ${modalBorderColor}`,
                   background: `linear-gradient(135deg, ${modalBorderColor}33, ${modalBorderColor}11)`,
                   color: modalBorderColor,
                   fontSize: 'clamp(28px, 3vw, 44px)',
                   fontWeight: 700,
                   letterSpacing: '0.15em',
                   textTransform: 'uppercase'
                 }}>
              Now Calling
            </div>

            {/* Patient Name - Cinematic big */}
            <div className="relative mb-8 w-full" style={{ maxHeight: 'min(45vh, 500px)', minHeight: '120px' }}>
              <div className="px-6 py-4 rounded-2xl w-full h-full flex items-center justify-center"
                   style={{
                     background: 'linear-gradient(135deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.2) 100%)',
                     border: `1px solid rgba(255,255,255,0.1)`,
                     backdropFilter: 'blur(8px)',
                     overflow: 'hidden'
                   }}>
                <div style={{
                  fontSize: patientNameFontSize,
                  fontWeight: 900,
                  color: modalTextColor,
                  lineHeight: '1.1',
                  wordBreak: 'break-word',
                  overflow: 'hidden',
                  textShadow: `0 0 40px ${modalBorderColor}44, 0 2px 10px rgba(0,0,0,0.5)`,
                  letterSpacing: '0.02em'
                }} data-testid="highlight-patient-name">
                  {getDisplayName(currentPatient.name)}
                </div>
              </div>
            </div>

            {/* Divider line with glow */}
            <div className="w-full max-w-2xl mb-8 h-px"
                 style={{
                   background: `linear-gradient(90deg, transparent, ${modalBorderColor}, transparent)`,
                   boxShadow: `0 0 12px ${modalBorderColor}66`
                 }} />

            {/* Room info */}
            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span style={{
                fontSize: 'clamp(24px, 2.5vw, 40px)',
                color: modalTextColor,
                opacity: 0.7,
                fontWeight: 500,
                letterSpacing: '0.1em',
                textTransform: 'uppercase'
              }}>
                Please proceed to
              </span>
              <span style={{
                fontSize: 'clamp(36px, 4vw, 72px)',
                fontWeight: 800,
                color: modalBorderColor,
                textShadow: `0 0 30px ${modalBorderColor}55`,
                letterSpacing: '0.05em'
              }} data-testid="highlight-patient-room">
                {currentPatient.room}
              </span>
            </div>

          </div>
        </div>
      )}
    </>
  );

  const youtubeAudioIframe = (isFullscreen && youtubeAudioItemEarly) ? (
    // IMPORTANT: must be a real, "visible-to-the-engine" iframe.
    // 1×1 + opacity:0 + off-screen makes Chrome's intersection observer
    // treat the player as non-visible and silently block autoplay
    // (state stays UNSTART forever). We keep it small but in-viewport
    // and just hide it BEHIND the content with negative z-index.
    <div
      ref={ytAudioContainerRef}
      style={{
        position: 'fixed',
        bottom: 0,
        right: 0,
        width: '160px',
        height: '90px',
        zIndex: -1,
        opacity: 0.01,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
      data-testid="youtube-audio-iframe"
    />
  ) : null;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 overflow-hidden" style={{ backgroundColor: '#000000' }}>
        <div 
          ref={stageRef}
          id="stage"
          className={wrapperClass}
          style={stageStyle} 
          data-testid="tv-display">
          {renderContent()}
        </div>
        {youtubeAudioIframe}
        {audioDiagnostic && !showAudioGate && (
          <div
            data-testid="badge-audio-diagnostic"
            className="fixed bottom-4 left-4 z-[9998] px-3 py-1.5 rounded-md text-xs font-semibold pointer-events-none"
            style={{
              backgroundColor: 'rgba(220, 38, 38, 0.85)',
              color: '#ffffff',
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              opacity: diagnosticBadgeVisible ? 1 : 0,
              transition: 'opacity 400ms ease-in-out',
            }}
          >
            {audioDiagnostic}
          </div>
        )}
        {showAudioGate && (
          <button
            type="button"
            onClick={unlockAudio}
            data-testid="button-unlock-audio"
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center text-white cursor-pointer"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', border: 'none' }}
          >
            <div className="text-center px-8" style={{ maxWidth: '900px' }}>
              <Volume2 className="mx-auto mb-8" style={{ width: '8rem', height: '8rem' }} />
              <div style={{ fontSize: '4rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                TAP TO START
              </div>
              <div style={{ fontSize: '2rem', opacity: 0.9, marginBottom: '1rem' }}>
                Tekan skrin atau OK pada remote untuk aktifkan audio
              </div>
              <div style={{ fontSize: '1.5rem', opacity: 0.7 }}>
                Press screen or OK on remote to enable audio
              </div>
            </div>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={wrapperClass}
         style={stageStyle} 
         data-testid="tv-display">
      {renderContent()}
    </div>
  );
}