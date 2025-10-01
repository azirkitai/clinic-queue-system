import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Volume2, Calendar } from "lucide-react";
import { createGradientStyle, createTextGradientStyle } from "@/hooks/useActiveTheme";
import { useQuery } from "@tanstack/react-query";
import { audioSystem } from "@/lib/audio-system";
import type { AudioSettings } from "@/lib/audio-system";

interface QueueItem {
  id: string;
  name: string;
  number: string;
  room: string;
  status: "waiting" | "calling" | "completed";
  timestamp: Date;
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
  type: "image" | "video" | "youtube";
  name?: string;
}

interface TVDisplayProps {
  currentPatient?: QueueItem;
  queueHistory?: QueueItem[];
  clinicName?: string;
  mediaItems?: MediaItem[];
  prayerTimes?: PrayerTime[];
  isFullscreen?: boolean;
  showPrayerTimes?: boolean;
  showWeather?: boolean;
  // Token for unauthenticated TV display access
  tvToken?: string;
}

export function TVDisplay({ 
  currentPatient,
  queueHistory = [],
  clinicName = "KLINIK UTAMA 24 JAM",
  mediaItems = [],
  prayerTimes = [],
  isFullscreen = false,
  showPrayerTimes = false,
  showWeather = false,
  tvToken
}: TVDisplayProps) {
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const stageRef = useRef<HTMLDivElement>(null);
  
  // Fetch active theme - use token-based endpoint if tvToken provided
  const { data: theme } = useQuery({
    queryKey: tvToken ? [`/api/tv/${tvToken}/themes/active`, 'tv-theme'] : ['/api/themes/active'],
    queryFn: async () => {
      const endpoint = tvToken ? `/api/tv/${tvToken}/themes/active` : '/api/themes/active';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch theme');
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    retry: 1,
  });

  // Fetch text groups - use token-based endpoint if tvToken provided
  const { data: textGroups = [] } = useQuery({
    queryKey: tvToken ? [`/api/tv/${tvToken}/text-groups/active`, 'tv-text-groups'] : ['/api/text-groups/active'],
    queryFn: async () => {
      const endpoint = tvToken ? `/api/tv/${tvToken}/text-groups/active` : '/api/text-groups/active';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch text groups');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Fetch settings - use token-based endpoint if tvToken provided
  const { data: settings = [] } = useQuery<Array<{key: string; value: string}>>({
    queryKey: tvToken ? [`/api/tv/${tvToken}/settings`, 'tv-settings'] : ['/api/settings'],
    queryFn: async () => {
      const endpoint = tvToken ? `/api/tv/${tvToken}/settings` : '/api/settings';
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
    staleTime: 30 * 1000, // 30 seconds - shorter for real-time marquee updates
    refetchInterval: 30 * 1000, // Refetch every 30 seconds for live updates
  });

  // Convert settings array to object for easier access
  const settingsObj = settings.reduce((acc: Record<string, string>, setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  // Extract marquee settings with fallbacks
  const enableMarquee = settingsObj.enableMarquee === 'true';
  const marqueeText = settingsObj.marqueeText || "Selamat datang ke Klinik Kesihatan";
  const marqueeColor = settingsObj.marqueeColor || "#ffffff";
  const marqueeBackgroundColor = settingsObj.marqueeBackgroundColor || "#1e40af";

  // Extract modal highlight box settings
  const modalBackgroundColor = settingsObj.modalBackgroundColor || '#1e293b';
  const modalBorderColor = settingsObj.modalBorderColor || '#fbbf24';
  const modalTextColor = settingsObj.modalTextColor || '#ffffff';

  // Extract clinic logo settings from settings
  const settingsClinicLogo = settingsObj.clinicLogo || '';
  const showClinicLogo = settingsObj.showClinicLogo === 'true';
  
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
  
  // Extract individual section settings
  const headerBackgroundMode = settingsObj.headerBackgroundMode || 'solid';
  const headerBackgroundColor = settingsObj.headerBackgroundColor || '#1e40af';
  const headerBackgroundGradient = settingsObj.headerBackgroundGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  
  const callBackgroundMode = settingsObj.callBackgroundMode || 'solid';
  const callBackgroundColor = settingsObj.callBackgroundColor || '#16a34a';
  const callBackgroundGradient = settingsObj.callBackgroundGradient || 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)';
  
  const prayerTimesBackgroundMode = settingsObj.prayerTimesBackgroundMode || 'solid';
  const prayerTimesBackgroundColor = settingsObj.prayerTimesBackgroundColor || '#7c3aed';
  const prayerTimesBackgroundGradient = settingsObj.prayerTimesBackgroundGradient || 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)';
  
  const weatherBackgroundMode = settingsObj.weatherBackgroundMode || 'solid';
  const weatherBackgroundColor = settingsObj.weatherBackgroundColor || '#f97316';
  const weatherBackgroundGradient = settingsObj.weatherBackgroundGradient || 'linear-gradient(135deg, #fdcb6e 0%, #e84393 100%)';
  
  const queueBackgroundMode = settingsObj.queueBackgroundMode || 'solid';
  const queueBackgroundColor = settingsObj.queueBackgroundColor || '#f3f4f6';
  const queueBackgroundGradient = settingsObj.queueBackgroundGradient || 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)';
  
  const queueItemBackgroundMode = settingsObj.queueItemBackgroundMode || 'solid';
  const queueItemBackgroundColor = settingsObj.queueItemBackgroundColor || '#2563eb';
  const queueItemBackgroundGradient = settingsObj.queueItemBackgroundGradient || 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)';
  
  const historyNameColor = settingsObj.historyNameColor || '#facc15';
  const historyNameMode = settingsObj.historyNameMode || 'solid';
  const historyNameGradient = settingsObj.historyNameGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)';
  
  const marqueeBackgroundMode = settingsObj.marqueeBackgroundMode || 'solid';
  const marqueeBackgroundGradient = settingsObj.marqueeBackgroundGradient || 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)';
  
  // Extract text color settings
  const headerTextMode = settingsObj.headerTextMode || 'solid';
  const headerTextColor = settingsObj.headerTextColor || '#ffffff';
  const headerTextGradient = settingsObj.headerTextGradient || 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)';
  
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
  
  const weatherTextMode = settingsObj.weatherTextMode || 'solid';
  const weatherTextColor = settingsObj.weatherTextColor || '#ffffff';
  const weatherTextGradient = settingsObj.weatherTextGradient || 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)';
  
  const queueTextMode = settingsObj.queueTextMode || 'solid';
  const queueTextColor = settingsObj.queueTextColor || '#1f2937';
  const queueTextGradient = settingsObj.queueTextGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  
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
  const [location, setLocation] = useState<{lat: number; lon: number} | null>(null);
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
          setLocation({ lat: 3.139, lon: 101.6869 });
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
            setLocation({ lat: 3.139, lon: 101.6869 });
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
        setLocation({ lat: 3.139, lon: 101.6869 });
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
    refetchInterval: 1000 * 60 * 10, // Refetch every 10 minutes
  });

  // Use real prayer times if available, otherwise fall back to props
  const displayPrayerTimes = showPrayerTimes && prayerTimesData?.prayerTimes && prayerTimesData.prayerTimes.length > 0 
    ? prayerTimesData.prayerTimes 
    : (prayerTimes || []);
  
  
  // Client-side highlight computation using browser timezone (more accurate)
  const computeHighlighting = () => {
    if (!showPrayerTimes || !prayerTimesData?.prayerTimes) {
      return { nextPrayer: null, shouldHighlight: false };
    }

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Removed excessive debug logging
    
    // Find next upcoming prayer (for highlighting purpose)
    let nextUpcomingPrayer = null;
    let minTimeUntilNext = Infinity;
    
    for (const prayer of prayerTimesData.prayerTimes) {
      // Clean time string - remove timezone info like "(MYT)"
      const cleanTime = prayer.time.replace(/[^\d:]/g, '');
      const [hours, minutes] = cleanTime.split(':').map(Number);
      
      if (isNaN(hours) || isNaN(minutes)) continue; // Skip invalid times
      
      const prayerTime = hours * 60 + minutes;
      const timeDiff = prayerTime - currentTime;
      
      // If prayer is upcoming today and closer than current minimum
      if (timeDiff > 0 && timeDiff < minTimeUntilNext) {
        nextUpcomingPrayer = prayer;
        minTimeUntilNext = timeDiff;
      }
    }
    
    // If no prayer left today, highlight first prayer of next day (SUBUH)
    if (!nextUpcomingPrayer && prayerTimesData.prayerTimes.length > 0) {
      nextUpcomingPrayer = prayerTimesData.prayerTimes[0]; // First prayer (usually SUBUH)
    }
    
    if (nextUpcomingPrayer) {
      return { nextPrayer: nextUpcomingPrayer.key, shouldHighlight: true };
    }
    
    return { nextPrayer: null, shouldHighlight: false };
  };

  const { nextPrayer, shouldHighlight } = computeHighlighting();
  
  // Animation states
  const [showHighlight, setShowHighlight] = useState(false);
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkVisible, setBlinkVisible] = useState(true);
  const [prevPatientId, setPrevPatientId] = useState<string | undefined>(undefined);
  
  // Media slideshow states
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [isMediaVisible, setIsMediaVisible] = useState(true);
  
  // Auto-resize text functionality
  const [patientNameFontSize, setPatientNameFontSize] = useState('4rem');
  const [roomNameFontSize, setRoomNameFontSize] = useState('2.5rem');
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

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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

      // CINEMA LETTERBOX MODE: Scale by WIDTH only
      // Left/right edges ALWAYS touch the screen
      // Black bars appear ONLY on top/bottom (like movies)
      const scale = vw / STAGE_WIDTH;

      const scaledHeight = STAGE_HEIGHT * scale;
      const marginTop = -(scaledHeight / 2); // Center: offset by half of scaled height

      console.log('🎬 LETTERBOX MODE:', {
        viewportSize: `${vw}×${vh}`,
        stageSize: `${STAGE_WIDTH}×${STAGE_HEIGHT}`,
        scale: scale.toFixed(3),
        scaledHeight: `${scaledHeight.toFixed(0)}px`,
        marginTop: `${marginTop.toFixed(0)}px`,
        topBar: `${((vh - scaledHeight) / 2).toFixed(0)}px`,
        bottomBar: `${((vh - scaledHeight) / 2).toFixed(0)}px`
      });

      // Apply scale and vertical centering
      stage.style.transformOrigin = 'top left';
      stage.style.transform = `scale(${scale})`;
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
  useEffect(() => {
    if (currentPatient && currentPatient.id !== prevPatientId) {
      // Clean up any existing timers
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      if (blinkTimerRef.current) {
        clearInterval(blinkTimerRef.current);
      }
      
      // Reset all animation states
      setShowHighlight(false);
      setIsBlinking(false);
      setBlinkVisible(true);
      
      // AUDIO PLAYBACK: Parse audio settings and play sound
      const audioSettings: AudioSettings = {
        enableSound: (settings.find(s => s.key === 'enable_sound')?.value ?? 'true') === 'true',
        volume: parseInt(settings.find(s => s.key === 'sound_volume')?.value || '70', 10),
        soundMode: 'preset',
        presetKey: (settings.find(s => s.key === 'preset_sound_key')?.value || 'notification_sound') as any
      };

      // Play notification sound for new patient
      if (audioSettings.enableSound) {
        audioSystem.playCallingSequence({
          patientName: currentPatient.name,
          patientNumber: parseInt(currentPatient.number, 10),
          windowName: currentPatient.room
        }, audioSettings).catch(error => {
          console.error('Failed to play calling sound:', error);
        });
      }
      
      // Step 1: Show highlight card for 5 seconds
      setShowHighlight(true);
      
      highlightTimerRef.current = setTimeout(() => {
        setShowHighlight(false);
        
        // Step 2: Start blinking after highlight disappears
        setIsBlinking(true);
        setBlinkVisible(true);
        
        // Blink 5 complete cycles (10 toggles: 5 off, 5 on)
        let toggleCount = 0;
        blinkTimerRef.current = setInterval(() => {
          toggleCount++;
          setBlinkVisible(toggleCount % 2 === 1); // true for odd, false for even
          
          if (toggleCount >= 10) { // 5 complete blinks = 10 toggles
            clearInterval(blinkTimerRef.current!);
            setIsBlinking(false);
            setBlinkVisible(true); // Ensure final state is visible
          }
        }, 400); // 400ms per toggle (faster, crisper blinks)
        
      }, 5000); // 5 seconds for highlight

      // Update previous patient ID
      setPrevPatientId(currentPatient.id);
    }
  }, [currentPatient?.id]); // Only depend on patient ID change

  // Auto-resize text effect - adjust font sizes based on text length
  useEffect(() => {
    if (currentPatient) {
      // Calculate container widths (approximate based on typical screen sizes)
      const isFullSize = isFullscreen;
      const nameContainerWidth = isFullSize ? 600 : 400; // Approximate container width
      const roomContainerWidth = isFullSize ? 400 : 300; // Room container is smaller
      
      // Base font sizes 
      const nameBaseSize = isFullSize ? 64 : 48; // 4rem equivalent
      const roomBaseSize = isFullSize ? 40 : 32; // 2.5rem equivalent
      
      // Calculate optimal font sizes
      const newNameSize = calculateFontSize(currentPatient.name, nameContainerWidth, nameBaseSize, 20);
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
      const historyNameBaseSize = isFullSize ? 40 : 32; // Bigger base size (~2.5rem equivalent)
      const historyRoomBaseSize = isFullSize ? 40 : 32; // Same bigger size for room
      
      queueHistory.forEach((item) => {
        const nameFontSize = calculateFontSize(item.name, historyNameContainerWidth, historyNameBaseSize, 22); // Bigger minimum size
        const roomFontSize = calculateFontSize(item.room, historyRoomContainerWidth, historyRoomBaseSize, 22); // Bigger minimum size
        
        newHistoryFontSizes[item.id] = {
          name: nameFontSize,
          room: roomFontSize
        };
      });
      
      setHistoryFontSizes(newHistoryFontSizes);
    }
  }, [queueHistory, isFullscreen]);

  // Media slideshow management 
  useEffect(() => {
    if (mediaItems.length > 1) {
      mediaTimerRef.current = setInterval(() => {
        // Start fade out
        setIsMediaVisible(false);
        
        // After fade out completes, switch media and fade in
        fadeTimerRef.current = setTimeout(() => {
          setCurrentMediaIndex((prev) => (prev + 1) % mediaItems.length);
          setIsMediaVisible(true);
        }, 500); // 500ms fade out duration
        
      }, 10000); // Change media every 10 seconds
      
      return () => {
        if (mediaTimerRef.current) {
          clearInterval(mediaTimerRef.current);
        }
        if (fadeTimerRef.current) {
          clearTimeout(fadeTimerRef.current);
        }
      };
    }
  }, [mediaItems.length]);

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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false 
    });
  };

  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    const year = date.getFullYear();
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    return { day, month, year, dayName };
  };

  const dateInfo = formatDate(currentTime);

  // YouTube video helper functions
  const isYouTubeUrl = (url: string): boolean => {
    return url.includes('youtube.com/watch') || url.includes('youtu.be/');
  };

  const getYouTubeEmbedUrl = (url: string): string => {
    if (url.includes('youtube.com/watch')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
    }
    return url;
  };

  // Get current media item
  const currentMedia = mediaItems.length > 0 ? mediaItems[currentMediaIndex] : null;

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
    gridTemplateRows: '700px 380px', // Fixed: Top 700px (16:9 for 1248px), Bottom 380px = 1080px total
    gridTemplateColumns: '1248px 672px', // Fixed: Left 65% (1248px), Right 35% (672px) = 1920px total
    gap: 0,
    padding: 0,
    boxSizing: 'border-box' as const,
    minWidth: 0,
    minHeight: 0,
    ...getBackgroundStyle(headerBackgroundMode, headerBackgroundColor, headerBackgroundGradient, '#ffffff')
  } : {
    gridTemplateRows: 'auto 1fr',
    gridTemplateColumns: '65% 35%',
    gap: '0',
    ...getBackgroundStyle(headerBackgroundMode, headerBackgroundColor, headerBackgroundGradient, '#ffffff')
  };

  const wrapperClass = isFullscreen 
    ? "text-gray-900 grid"  // No h-screen - inline 1080px is enough
    : "h-screen text-gray-900 grid";

  // Render content - same for both fullscreen and non-fullscreen
  const renderContent = () => (
    <>
      {/* Top Row - Advertisement Area with 16:9 ratio */}
      <div className={`${isFullscreen ? 'm-0 p-0 w-full h-full' : 'p-4 w-full'}`}>
        <div className="overflow-hidden flex items-center justify-center w-full h-full relative" style={{ aspectRatio: '16/9', backgroundColor: '#f3f4f6' }}>
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
              <div className="text-center text-gray-500">
                <div className="text-5xl font-bold mb-4" data-testid="no-display-message">
                  NO DISPLAY
                </div>
                <p className="text-lg">Tiada media dimuatnaik</p>
              </div>
            </div>
          )}
          
          {/* Media indicator dots */}
          {mediaItems.length > 1 && (
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
              {mediaItems.map((_, index) => (
                <div
                  key={index}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentMediaIndex ? 'bg-white shadow-lg' : 'bg-white/50'
                  }`}
                  data-testid={`media-indicator-${index}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Right - Patient Names Header and History */}
      <div className={`text-white ${isFullscreen ? 'p-0 m-0 row-span-2' : 'p-4 row-span-2'} flex flex-col w-full h-full`}
           style={{
             ...getBackgroundStyle(headerBackgroundMode, headerBackgroundColor, headerBackgroundGradient, '#1d4ed8')
           }}>
        {/* Header */}
        <div className={`text-center ${isFullscreen ? 'mb-2 pt-4 px-4' : 'mb-4'}`}>
          {/* Logo Display - Use uploaded logo if enabled */}
          {showClinicLogo && settingsClinicLogo && (
            <div className="mb-4">
              <div className="bg-white rounded-lg p-4 shadow-lg w-full flex items-center justify-center">
                <img 
                  src={settingsClinicLogo} 
                  alt="Logo Klinik" 
                  className="h-32 w-auto object-contain"
                  style={{ maxWidth: '350px' }}
                  data-testid="clinic-logo"
                />
              </div>
            </div>
          )}
          <h1 className="font-bold text-[16px]" 
              style={{ 
                ...getTextGroupStyles('clinic_name', true), // Exclude color overrides so Settings can override
                ...getTextStyle(clinicNameTextMode, clinicNameTextColor, clinicNameTextGradient, '#ffffff'),
                fontSize: 'var(--tv-fs-2xl, 48px)' // Responsive: auto-scales from 28px to 64px based on screen
              }} 
              data-testid="clinic-name">
            {clinicName}
          </h1>
          <div className="px-4 py-2 rounded-lg mt-2"
               style={{
                 ...getBackgroundStyle(callBackgroundMode, callBackgroundColor, callBackgroundGradient, '#1e40af'),
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
          <div className={`${isFullscreen ? 'p-2 mx-4 rounded-md mb-2' : 'p-3 rounded-lg mb-3'} text-center`}
               style={{
                 ...getBackgroundStyle(callBackgroundMode, callBackgroundColor, callBackgroundGradient, '#2563eb')
               }}>
            <div className="font-bold"
                 style={{ 
                   fontSize: patientNameFontSize,
                   opacity: isBlinking ? (blinkVisible ? '1' : '0') : '1',
                   transition: isBlinking ? 'none' : 'opacity 300ms ease-in-out',
                   lineHeight: '1.1',
                   wordBreak: 'break-word',
                   overflow: 'hidden',
                   ...getTextStyle(callNameTextMode, callNameTextColor, callNameTextGradient, '#facc15')
                 }} 
                 data-testid="current-patient-display">
              {currentPatient.name}
            </div>
            <div
                 style={{ 
                   fontSize: roomNameFontSize,
                   opacity: isBlinking ? (blinkVisible ? '1' : '0') : '1',
                   transition: isBlinking ? 'none' : 'opacity 300ms ease-in-out',
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
          <div className={`${isFullscreen ? 'p-2 mx-4 rounded-md mb-2' : 'p-3 rounded-lg mb-3'} text-center`}
               style={{
                 ...getBackgroundStyle(callBackgroundMode, callBackgroundColor, callBackgroundGradient, '#2563eb')
               }}>
            <div className="text-white" style={{ fontSize: 'var(--tv-fs-2xl, 48px)' }}>N/A</div>
          </div>
        )}

        {/* History Section */}
        <div className="flex-1 mt-4">
          {/* History Header */}
          <div className="mb-4">
            <div className="grid grid-cols-2 gap-1">
              <div className="font-bold text-center" style={{ 
                fontSize: 'var(--tv-fs-lg, 24px)', // Responsive: auto-scales from 18px to 32px
                ...getHistoryNameStyle(),
                ...getTextGroupStyles('Token Label', true)
              }}>NAME</div>
              <div className="font-bold text-center" style={{ 
                fontSize: 'var(--tv-fs-lg, 24px)', // Responsive: auto-scales from 18px to 32px
                ...getHistoryNameStyle(),
                ...getTextGroupStyles('Token Label', true)
              }}>ROOM</div>
            </div>
          </div>
          
          {/* History Items */}
          <div className="space-y-1 overflow-y-auto flex-1" data-testid="queue-list">
            {queueHistory.length > 0 ? (
              queueHistory.slice(0, 4).map((item) => (
                <div key={item.id} className="grid grid-cols-2 gap-1 p-2 rounded-lg"
                     style={{
                       ...getBackgroundStyle(queueItemBackgroundMode, queueItemBackgroundColor, queueItemBackgroundGradient, '#2563eb')
                     }}>
                  <div className="text-center" 
                       style={{ 
                         ...getHistoryNameStyle(),
                         fontSize: historyFontSizes[item.id]?.name || 'var(--tv-fs-md, 20px)', // Responsive fallback
                         fontWeight: 'bold',
                         lineHeight: '1.1',
                         wordBreak: 'break-word',
                         overflow: 'hidden'
                       }}>
                    {item.name}
                  </div>
                  <div className="text-center" 
                       style={{ 
                         ...getHistoryNameStyle(),
                         fontSize: historyFontSizes[item.id]?.room || 'var(--tv-fs-md, 20px)', // Responsive fallback
                         fontWeight: 'normal',
                         lineHeight: '1.1',
                         wordBreak: 'break-word',
                         overflow: 'hidden'
                       }}>
                    {item.room}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p style={{ 
                  ...getTextGroupStyles('Patient History', true),
                  ...getHistoryNameStyle(),
                  fontSize: 'var(--tv-fs-xl, 32px)', // Responsive: auto-scales from 22px to 48px
                  fontWeight: 'bold'
                }} 
                data-testid="text-no-queue">N/A</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Second Row Left - Date & Prayer Times Expanded */}
      <div className={`${isFullscreen ? 'px-4 py-2 m-0' : 'px-4 py-2'} text-white w-full h-full flex flex-col justify-center`}
           style={{
             ...getBackgroundStyle(prayerTimesBackgroundMode, prayerTimesBackgroundColor, prayerTimesBackgroundGradient, '#1e40af')
           }}>
        {/* Date/Time Section - Larger */}
        <div className={`bg-white text-gray-900 p-6 ${isFullscreen ? 'rounded-md mb-6' : 'rounded-lg mb-6'} flex items-center justify-center space-x-8`}>
          <div className="text-center">
            <div className="text-6xl font-bold text-black">{dateInfo.day}</div>
          </div>
          <div className="text-center">
            <div className="font-bold text-4xl">{dateInfo.dayName}</div>
            <div className="text-3xl text-gray-600">{dateInfo.month} {dateInfo.year}</div>
          </div>
          <div className="text-center">
            <div className="font-mono font-bold text-6xl" data-testid="display-time">
              {formatTime(currentTime)}
            </div>
          </div>
        </div>

        {/* Prayer Times Section - Conditional with Loading/Error States */}
        {showPrayerTimes && (
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <span className="text-yellow-400 text-3xl">🕌</span>
              <span className="font-bold text-3xl" style={{ ...getTextStyle(prayerTimesTextMode, prayerTimesTextColor, prayerTimesTextGradient, '#facc15') }}>PRAYER TIME</span>
            </div>
            
            {prayerTimesLoading ? (
              <div className="text-white text-xl">
                Loading prayer times...
              </div>
            ) : null}
            
            {!prayerTimesLoading && displayPrayerTimes.length > 0 && (
              <div className="grid grid-cols-5 gap-4">
                {displayPrayerTimes.map((prayer, index) => {
                  const isCurrentPrayer = nextPrayer === prayer.key && shouldHighlight;
                  
                  return (
                    <div key={prayer.key || index} className="text-center">
                      <div className={`font-bold text-2xl ${isCurrentPrayer ? 'animate-pulse' : ''}`} style={{
                        ...(isCurrentPrayer ? getTextStyle(prayerTimesTextMode, prayerTimesTextColor, prayerTimesTextGradient, '#facc15') : getTextStyle(prayerTimesTextMode, prayerTimesTextColor, prayerTimesTextGradient, '#ffffff'))
                      }}>
                        {prayer.name}
                      </div>
                      <div className={`text-2xl ${isCurrentPrayer ? 'font-bold' : ''}`} style={{
                        ...(isCurrentPrayer ? getTextStyle(prayerTimesTextMode, prayerTimesTextColor, prayerTimesTextGradient, '#facc15') : getTextStyle(prayerTimesTextMode, prayerTimesTextColor, prayerTimesTextGradient, '#ffffff'))
                      }}>
                        {prayer.time}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            
            {!prayerTimesLoading && displayPrayerTimes.length === 0 && (
              <div className="text-white text-xl">
                Prayer times not available
              </div>
            )}
          </div>
        )}

        {/* Weather Section - Real Location-Based Weather */}
        {showWeather && (
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <span className="text-blue-400 text-3xl">🌤️</span>
              <span className="font-bold text-3xl" style={{ ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#60a5fa') }}>WEATHER</span>
            </div>
            
            {/* Fix rendering race condition - better conditional logic */}
            {!location ? (
              <div className="text-white text-xl">
                Detecting location...
              </div>
            ) : weatherLoading ? (
              <div className="text-white text-xl">
                Loading weather data...
              </div>
            ) : weatherData ? (
              <div className="space-y-4">
                {locationError && (
                  <div className="text-yellow-300 text-lg mb-2">
                    Using default location
                  </div>
                )}
                
                {/* Temperature and Icon */}
                <div className="flex items-center justify-center space-x-6">
                  <span className="text-6xl">{weatherData.current.icon}</span>
                  <div className="text-center">
                    <div className="text-5xl font-bold" style={{
                      ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#ffffff')
                    }}>
                      {weatherData.current.temperature}{weatherData.units.temperature}
                    </div>
                    <div className="text-xl" style={{
                      ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#bfdbfe')
                    }}>
                      {weatherData.current.description}
                    </div>
                  </div>
                </div>
                
                {/* Weather Details */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center">
                    <div className="text-lg font-semibold" style={{
                      ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#bfdbfe')
                    }}>Humidity</div>
                    <div className="text-2xl" style={{
                      ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#ffffff')
                    }}>{weatherData.current.humidity}{weatherData.units.humidity}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold" style={{
                      ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#bfdbfe')
                    }}>Wind Speed</div>
                    <div className="text-2xl" style={{
                      ...getTextStyle(weatherTextMode, weatherTextColor, weatherTextGradient, '#ffffff')
                    }}>{weatherData.current.windSpeed} {weatherData.units.windSpeed}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-white text-xl">
                Weather data unavailable, retrying...
              </div>
            )}
          </div>
        )}
      </div>

      
      {/* Floating Marquee Overlay */}
      {isFullscreen && enableMarquee && (
        <div 
          className="fixed bottom-0 left-0 w-full text-white py-2 z-50"
          style={{
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
                className="px-8 font-bold text-2xl" 
                style={{ 
                  fontSize: 'clamp(1.5rem, 2vw, 2rem)',
                  color: marqueeColor
                }}
              >
                {marqueeText}
              </span>
              <span 
                className="px-8 font-bold text-2xl" 
                style={{ 
                  fontSize: 'clamp(1.5rem, 2vw, 2rem)',
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

      {/* Highlight Card Overlay - Rectangle showing name and window */}
      {showHighlight && currentPatient && (
        <div className="fixed inset-0 flex items-center justify-center z-[100]" 
             style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}
             data-testid="highlight-overlay">
          {/* Modal Container with Lines Design */}
          <div className="relative p-12 rounded-lg shadow-2xl"
               style={{
                 backgroundColor: modalBackgroundColor,
                 minWidth: '700px',
                 maxWidth: '1200px'
               }}>
            
            {/* Corner Lines Design */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top-left corner */}
              <div className="absolute top-0 left-0 w-20 h-0.5" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              <div className="absolute top-0 left-0 w-0.5 h-20" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              
              {/* Top-right corner */}
              <div className="absolute top-0 right-0 w-20 h-0.5" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              <div className="absolute top-0 right-0 w-0.5 h-20" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              
              {/* Bottom-left corner */}
              <div className="absolute bottom-0 left-0 w-20 h-0.5" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              <div className="absolute bottom-0 left-0 w-0.5 h-20" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              
              {/* Bottom-right corner */}
              <div className="absolute bottom-0 right-0 w-20 h-0.5" 
                   style={{ backgroundColor: modalBorderColor }}></div>
              <div className="absolute bottom-0 right-0 w-0.5 h-20" 
                   style={{ backgroundColor: modalBorderColor }}></div>
            </div>

            {/* Modal Content */}
            <div className="text-center space-y-6 relative z-10">
              {/* NAME Label */}
              <div className="font-semibold tracking-wider mb-2" 
                   style={{ color: modalTextColor, opacity: 0.8, fontSize: 'var(--tv-fs-xl, 32px)' }}>
                NAME
              </div>
              
              {/* Patient Name */}
              <div className="px-8 py-4 rounded border-2"
                   style={{
                     borderColor: modalBorderColor,
                     backgroundColor: 'rgba(0, 0, 0, 0.2)'
                   }}>
                <div className="font-bold" 
                     style={{ 
                       fontSize: 'var(--tv-fs-4xl, 96px)', // Responsive with fallback for older TV browsers
                       color: modalTextColor
                     }}
                     data-testid="highlight-patient-name">
                  {currentPatient.name}
                </div>
              </div>

              {/* ROOM Label */}
              <div className="font-semibold tracking-wider mb-2" 
                   style={{ color: modalTextColor, opacity: 0.8, fontSize: 'var(--tv-fs-xl, 32px)' }}>
                ROOM
              </div>

              {/* Room Name */}
              <div className="px-8 py-4 rounded border-2"
                   style={{
                     borderColor: modalBorderColor,
                     backgroundColor: 'rgba(0, 0, 0, 0.2)'
                   }}>
                <div className="font-bold" 
                     style={{ 
                       fontSize: 'var(--tv-fs-3xl, 64px)', // Responsive with fallback for older TV browsers
                       color: modalTextColor
                     }}
                     data-testid="highlight-patient-room">
                  {currentPatient.room}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // Conditional wrapper: fullscreen uses viewport-centered 1920×1080 stage with black background
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-black overflow-hidden">
        <div 
          ref={stageRef}
          id="stage"
          className={wrapperClass}
          style={stageStyle} 
          data-testid="tv-display">
          {renderContent()}
        </div>
      </div>
    );
  }

  // Non-fullscreen: regular responsive layout
  return (
    <div className={wrapperClass}
         style={stageStyle} 
         data-testid="tv-display">
      {renderContent()}
    </div>
  );
}