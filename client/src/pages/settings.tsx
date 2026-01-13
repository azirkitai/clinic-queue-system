import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Monitor, Volume2, Palette, Upload, Save, RefreshCw, CheckCircle, Plus, ChevronLeft, ChevronRight, Eye, Trash2, Edit, Star, Upload as UploadIcon, Brush, X, Image, Type, LayoutGrid, Clock, Cloud, List, MessageSquare } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { GradientPicker } from "@/components/ui/gradient-picker";
import type { Setting, Media, Theme } from "@shared/schema";
import { audioSystem } from "@/lib/audio-system";

import type { PresetSoundKeyType } from "@shared/schema";

interface SettingsState {
  mediaType: string;
  dashboardMediaType: string; // "own" or "youtube"
  youtubeUrl: string; // YouTube video URL
  theme: string;
  showPrayerTimes: boolean;
  showWeather: boolean;
  enableMarquee: boolean;
  marqueeText: string;
  // Clinic logo settings
  clinicLogo: string;
  showClinicLogo: string;
  marqueeColor: string;
  marqueeTextMode: 'solid' | 'gradient';
  marqueeTextGradient: string;
  marqueeBackgroundColor: string;
  clinicName: string;
  clinicNameTextColor: string;
  clinicNameTextMode: 'solid' | 'gradient';
  clinicNameTextGradient: string;
  enableSound: boolean;
  volume: number;
  // Simplified audio system - preset only
  soundMode: 'preset';
  presetKey: PresetSoundKeyType;
  // Individual section colors
  headerTextColor: string;
  headerTextMode: 'solid' | 'gradient';
  headerTextGradient: string;
  headerBackgroundColor: string;
  headerBackgroundMode: 'solid' | 'gradient';
  headerBackgroundGradient: string;
  callNameTextColor: string;
  callNameTextMode: 'solid' | 'gradient';
  callNameTextGradient: string;
  callBackgroundColor: string;
  callBackgroundMode: 'solid' | 'gradient';
  callBackgroundGradient: string;
  windowTextColor: string;
  windowTextMode: 'solid' | 'gradient';
  windowTextGradient: string;
  callBorderColor: string;
  // Highlight box modal colors
  modalBackgroundColor: string;
  modalBorderColor: string;
  modalTextColor: string;
  prayerTimesTextColor: string;
  prayerTimesTextMode: 'solid' | 'gradient';
  prayerTimesTextGradient: string;
  prayerTimesBackgroundColor: string;
  prayerTimesBackgroundMode: 'solid' | 'gradient';
  prayerTimesBackgroundGradient: string;
  prayerTimesHighlightColor: string;
  weatherTextColor: string;
  weatherTextMode: 'solid' | 'gradient';
  weatherTextGradient: string;
  weatherBackgroundColor: string;
  weatherBackgroundMode: 'solid' | 'gradient';
  weatherBackgroundGradient: string;
  queueTextColor: string;
  queueTextMode: 'solid' | 'gradient';
  queueTextGradient: string;
  queueBackgroundColor: string;
  queueBackgroundMode: 'solid' | 'gradient';
  queueBackgroundGradient: string;
  queueItemBackgroundColor: string;
  queueItemBackgroundMode: 'solid' | 'gradient';
  queueItemBackgroundGradient: string;
  historyNameColor: string;
  historyNameMode: 'solid' | 'gradient';
  historyNameGradient: string;
  queueHighlightColor: string;
  queueBorderColor: string;
  marqueeBackgroundMode: 'solid' | 'gradient';
  marqueeBackgroundGradient: string;
}

export default function Settings() {
  const { toast } = useToast();
  const [unsavedChanges, setUnsavedChanges] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // TV Mode state (separate from Settings API - stored in localStorage)
  const [tvMode, setTvMode] = useState(() => {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem('tvMode') === 'true';
    }
    return false;
  });
  
  // Handle TV Mode toggle
  const handleTvModeToggle = (checked: boolean) => {
    setTvMode(checked);
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem('tvMode', String(checked));
      window.dispatchEvent(new Event('tvModeChanged'));
    }
  };
  
  // Gradient picker states
  const [gradientPickers, setGradientPickers] = useState<{
    header: boolean;
    headerText: boolean;
    call: boolean;
    callNameText: boolean;
    windowText: boolean;
    prayer: boolean;
    prayerText: boolean;
    weather: boolean;
    weatherText: boolean;
    queue: boolean;
    queueText: boolean;
    queueItem: boolean;
    historyName: boolean;
    marquee: boolean;
    marqueeText: boolean;
    clinicNameText: boolean;
  }>({
    header: false,
    headerText: false,
    call: false,
    callNameText: false,
    windowText: false,
    prayer: false,
    prayerText: false,
    weather: false,
    weatherText: false,
    queue: false,
    queueText: false,
    queueItem: false,
    historyName: false,
    marquee: false,
    marqueeText: false,
    clinicNameText: false
  });
  
  // Fetch current settings from database
  // Settings page is admin-only, use longer staleTime to reduce bandwidth
  const { data: settings = [], isLoading, refetch } = useQuery<Setting[]>({
    queryKey: ['/api/settings'],
    staleTime: 5 * 60 * 1000, // 5 minutes - admin page doesn't need real-time updates
    refetchOnWindowFocus: false, // Disable aggressive refetching
    refetchOnMount: false, // Don't refetch on every mount
  });

  // Convert settings array to object for easier access
  const settingsObj = settings.reduce((acc: Record<string, string>, setting: Setting) => {
    acc[setting.key] = setting.value;
    return acc;
  }, {});

  // Current settings state
  const [currentSettings, setCurrentSettings] = useState<SettingsState>({
    mediaType: 'image',
    dashboardMediaType: 'own',
    youtubeUrl: '',
    theme: 'blue',
    showPrayerTimes: false,
    showWeather: false,
    enableMarquee: false,
    marqueeText: '',
    // Clinic logo defaults
    clinicLogo: '',
    showClinicLogo: 'false',
    marqueeColor: '#ffffff',
    marqueeTextMode: 'solid' as 'solid' | 'gradient',
    marqueeTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    marqueeBackgroundColor: '#000000',
    clinicName: 'MAIN CLINIC 24 HOURS',
    clinicNameTextColor: '#ffffff',
    clinicNameTextMode: 'solid' as 'solid' | 'gradient',
    clinicNameTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    enableSound: false,
    volume: 50,
    soundMode: 'preset',
    presetKey: 'notification_sound',
    // Individual section colors with defaults
    headerTextColor: '#ffffff',
    headerTextMode: 'solid' as 'solid' | 'gradient',
    headerTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    headerBackgroundColor: '#1e40af',
    headerBackgroundMode: 'solid' as 'solid' | 'gradient',
    headerBackgroundGradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    callNameTextColor: '#ffffff',
    callNameTextMode: 'solid' as 'solid' | 'gradient',
    callNameTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    callBackgroundColor: '#16a34a',
    callBackgroundMode: 'solid' as 'solid' | 'gradient',
    callBackgroundGradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    windowTextColor: '#ffffff',
    windowTextMode: 'solid' as 'solid' | 'gradient',
    windowTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    callBorderColor: '#22c55e',
    // Highlight box modal defaults
    modalBackgroundColor: '#1e293b',
    modalBorderColor: '#fbbf24',
    modalTextColor: '#ffffff',
    prayerTimesTextColor: '#ffffff',
    prayerTimesTextMode: 'solid' as 'solid' | 'gradient',
    prayerTimesTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    prayerTimesBackgroundColor: '#7c3aed',
    prayerTimesBackgroundMode: 'solid' as 'solid' | 'gradient',
    prayerTimesBackgroundGradient: 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
    prayerTimesHighlightColor: '#facc15',
    weatherTextColor: '#ffffff',
    weatherTextMode: 'solid' as 'solid' | 'gradient',
    weatherTextGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    weatherBackgroundColor: '#f97316',
    weatherBackgroundMode: 'solid' as 'solid' | 'gradient',
    weatherBackgroundGradient: 'linear-gradient(135deg, #fdcb6e 0%, #e84393 100%)',
    queueTextColor: '#1f2937',
    queueTextMode: 'solid' as 'solid' | 'gradient',
    queueTextGradient: 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
    queueBackgroundColor: '#f3f4f6',
    queueBackgroundMode: 'solid' as 'solid' | 'gradient',
    queueBackgroundGradient: 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
    queueItemBackgroundColor: '#2563eb',
    queueItemBackgroundMode: 'solid' as 'solid' | 'gradient',
    queueItemBackgroundGradient: 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
    historyNameColor: '#facc15',
    historyNameMode: 'solid' as 'solid' | 'gradient',
    historyNameGradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    queueHighlightColor: '#ef4444',
    queueBorderColor: '#d1d5db',
    marqueeBackgroundMode: 'solid' as 'solid' | 'gradient',
    marqueeBackgroundGradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
  });

  // Update settings state when data is loaded
  useEffect(() => {
    if (settings.length > 0) {
      const newSettings = {
        mediaType: settingsObj.mediaType || 'image',
        dashboardMediaType: settingsObj.dashboardMediaType || 'own',
        youtubeUrl: settingsObj.youtubeUrl || '',
        theme: settingsObj.theme || 'blue',
        showPrayerTimes: settingsObj.showPrayerTimes === 'true',
        showWeather: settingsObj.showWeather === 'true',
        enableMarquee: settingsObj.enableMarquee === 'true',
        marqueeText: settingsObj.marqueeText || '',
        // Clinic logo settings
        clinicLogo: settingsObj.clinicLogo || '',
        showClinicLogo: settingsObj.showClinicLogo || 'false',
        marqueeColor: settingsObj.marqueeColor || '#ffffff',
        marqueeTextMode: (settingsObj.marqueeTextMode as 'solid' | 'gradient') || 'solid',
        marqueeTextGradient: settingsObj.marqueeTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        marqueeBackgroundColor: settingsObj.marqueeBackgroundColor || '#000000',
        clinicName: settingsObj.clinicName || 'MAIN CLINIC 24 HOURS',
        clinicNameTextColor: settingsObj.clinicNameTextColor || '#ffffff',
        clinicNameTextMode: (settingsObj.clinicNameTextMode as 'solid' | 'gradient') || 'solid',
        clinicNameTextGradient: settingsObj.clinicNameTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        enableSound: settingsObj.enableSound === 'true',
        volume: parseInt(settingsObj.volume || '50'),
        soundMode: 'preset' as const,
        presetKey: (settingsObj.presetKey as PresetSoundKeyType) || 'notification_sound',
        // Individual section colors with defaults
        headerTextColor: settingsObj.headerTextColor || '#ffffff',
        headerTextMode: (settingsObj.headerTextMode as 'solid' | 'gradient') || 'solid',
        headerTextGradient: settingsObj.headerTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        headerBackgroundColor: settingsObj.headerBackgroundColor || '#1e40af',
        headerBackgroundMode: (settingsObj.headerBackgroundMode as 'solid' | 'gradient') || 'solid',
        headerBackgroundGradient: settingsObj.headerBackgroundGradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        callNameTextColor: settingsObj.callNameTextColor || '#ffffff',
        callNameTextMode: (settingsObj.callNameTextMode as 'solid' | 'gradient') || 'solid',
        callNameTextGradient: settingsObj.callNameTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        callBackgroundColor: settingsObj.callBackgroundColor || '#16a34a',
        callBackgroundMode: (settingsObj.callBackgroundMode as 'solid' | 'gradient') || 'solid',
        callBackgroundGradient: settingsObj.callBackgroundGradient || 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        windowTextColor: settingsObj.windowTextColor || '#ffffff',
        windowTextMode: (settingsObj.windowTextMode as 'solid' | 'gradient') || 'solid',
        windowTextGradient: settingsObj.windowTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        callBorderColor: settingsObj.callBorderColor || '#22c55e',
        // Highlight box modal settings
        modalBackgroundColor: settingsObj.modalBackgroundColor || '#1e293b',
        modalBorderColor: settingsObj.modalBorderColor || '#fbbf24',
        modalTextColor: settingsObj.modalTextColor || '#ffffff',
        prayerTimesTextColor: settingsObj.prayerTimesTextColor || '#ffffff',
        prayerTimesTextMode: (settingsObj.prayerTimesTextMode as 'solid' | 'gradient') || 'solid',
        prayerTimesTextGradient: settingsObj.prayerTimesTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        prayerTimesBackgroundColor: settingsObj.prayerTimesBackgroundColor || '#7c3aed',
        prayerTimesBackgroundMode: (settingsObj.prayerTimesBackgroundMode as 'solid' | 'gradient') || 'solid',
        prayerTimesBackgroundGradient: settingsObj.prayerTimesBackgroundGradient || 'linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%)',
        prayerTimesHighlightColor: settingsObj.prayerTimesHighlightColor || '#facc15',
        weatherTextColor: settingsObj.weatherTextColor || '#ffffff',
        weatherTextMode: (settingsObj.weatherTextMode as 'solid' | 'gradient') || 'solid',
        weatherTextGradient: settingsObj.weatherTextGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        weatherBackgroundColor: settingsObj.weatherBackgroundColor || '#f97316',
        weatherBackgroundMode: (settingsObj.weatherBackgroundMode as 'solid' | 'gradient') || 'solid',
        weatherBackgroundGradient: settingsObj.weatherBackgroundGradient || 'linear-gradient(135deg, #fdcb6e 0%, #e84393 100%)',
        queueTextColor: settingsObj.queueTextColor || '#1f2937',
        queueTextMode: (settingsObj.queueTextMode as 'solid' | 'gradient') || 'solid',
        queueTextGradient: settingsObj.queueTextGradient || 'linear-gradient(135deg, #1f2937 0%, #4b5563 100%)',
        queueBackgroundColor: settingsObj.queueBackgroundColor || '#f3f4f6',
        queueBackgroundMode: (settingsObj.queueBackgroundMode as 'solid' | 'gradient') || 'solid',
        queueBackgroundGradient: settingsObj.queueBackgroundGradient || 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)',
        queueItemBackgroundColor: settingsObj.queueItemBackgroundColor || '#2563eb',
        queueItemBackgroundMode: (settingsObj.queueItemBackgroundMode as 'solid' | 'gradient') || 'solid',
        queueItemBackgroundGradient: settingsObj.queueItemBackgroundGradient || 'linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)',
        historyNameColor: settingsObj.historyNameColor || '#facc15',
        historyNameMode: (settingsObj.historyNameMode as 'solid' | 'gradient') || 'solid',
        historyNameGradient: settingsObj.historyNameGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
        queueHighlightColor: settingsObj.queueHighlightColor || '#ef4444',
        queueBorderColor: settingsObj.queueBorderColor || '#d1d5db',
        marqueeBackgroundMode: (settingsObj.marqueeBackgroundMode as 'solid' | 'gradient') || 'solid',
        marqueeBackgroundGradient: settingsObj.marqueeBackgroundGradient || 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
      };
      
      setCurrentSettings(prev => {
        // Only update if there are actual changes to prevent infinite loops
        const hasChanges = Object.keys(newSettings).some(key => 
          prev[key as keyof SettingsState] !== newSettings[key as keyof typeof newSettings]
        );
        return hasChanges ? { ...prev, ...newSettings } : prev;
      });
    }
  }, [settings.length, 
    // Basic settings
    settingsObj.mediaType, settingsObj.dashboardMediaType, settingsObj.youtubeUrl, settingsObj.theme, 
    settingsObj.showPrayerTimes, settingsObj.showWeather, settingsObj.enableMarquee, settingsObj.marqueeText, settingsObj.marqueeColor,
    // Logo dependencies
    settingsObj.clinicLogo, settingsObj.showClinicLogo, 
    settingsObj.marqueeBackgroundColor, settingsObj.clinicName, settingsObj.enableSound, settingsObj.volume, settingsObj.presetKey,
    // Header text and background
    settingsObj.headerTextColor, settingsObj.headerTextMode, settingsObj.headerTextGradient,
    settingsObj.headerBackgroundColor, settingsObj.headerBackgroundMode, settingsObj.headerBackgroundGradient,
    // Call name text and background
    settingsObj.callNameTextColor, settingsObj.callNameTextMode, settingsObj.callNameTextGradient,
    settingsObj.callBackgroundColor, settingsObj.callBackgroundMode, settingsObj.callBackgroundGradient,
    // Window text and call border
    settingsObj.windowTextColor, settingsObj.windowTextMode, settingsObj.windowTextGradient,
    settingsObj.callBorderColor,
    // Modal highlight colors
    settingsObj.modalBackgroundColor, settingsObj.modalBorderColor, settingsObj.modalTextColor,
    // Prayer times text and background
    settingsObj.prayerTimesTextColor, settingsObj.prayerTimesTextMode, settingsObj.prayerTimesTextGradient,
    settingsObj.prayerTimesBackgroundColor, settingsObj.prayerTimesBackgroundMode, settingsObj.prayerTimesBackgroundGradient,
    // Weather text and background
    settingsObj.weatherTextColor, settingsObj.weatherTextMode, settingsObj.weatherTextGradient,
    settingsObj.weatherBackgroundColor, settingsObj.weatherBackgroundMode, settingsObj.weatherBackgroundGradient,
    // Queue text and background
    settingsObj.queueTextColor, settingsObj.queueTextMode, settingsObj.queueTextGradient,
    settingsObj.queueBackgroundColor, settingsObj.queueBackgroundMode, settingsObj.queueBackgroundGradient,
    // Queue item background
    settingsObj.queueItemBackgroundColor, settingsObj.queueItemBackgroundMode, settingsObj.queueItemBackgroundGradient,
    // History name
    settingsObj.historyNameColor, settingsObj.historyNameMode, settingsObj.historyNameGradient,
    // Queue styling
    settingsObj.queueHighlightColor, settingsObj.queueBorderColor,
    // Marquee text and background
    settingsObj.marqueeTextMode, settingsObj.marqueeTextGradient,
    settingsObj.marqueeBackgroundMode, settingsObj.marqueeBackgroundGradient,
    // Clinic name text
    settingsObj.clinicNameTextColor, settingsObj.clinicNameTextMode, settingsObj.clinicNameTextGradient
  ]);

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refresh",
      description: "Settings refreshed successfully",
    });
  };

  const updateDisplaySetting = (key: string, value: any) => {
    setCurrentSettings(prev => ({ ...prev, [key]: value }));
    if (!unsavedChanges.includes('display')) {
      setUnsavedChanges(prev => [...prev, 'display']);
    }
  };

  const updateSoundSetting = (key: string, value: any) => {
    setCurrentSettings(prev => ({ ...prev, [key]: value }));
    if (!unsavedChanges.includes('sound')) {
      setUnsavedChanges(prev => [...prev, 'sound']);
    }
  };

  // Upload media mutation to database
  const uploadMediaMutation = useMutation({
    mutationFn: async (file: File) => {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      
      // Upload directly to database
      const uploadResponse = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file');
      }
      
      return uploadResponse.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to upload image",
        variant: "destructive",
      });
    }
  });

  // Delete media mutation
  const deleteMediaMutation = useMutation({
    mutationFn: async (mediaId: string) => {
      const response = await apiRequest('DELETE', `/api/media/${mediaId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Success",
        description: "Image has been deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: "Failed to delete image",
        variant: "destructive",
      });
    }
  });

  // Handle delete media
  const handleDeleteMedia = (mediaId: string, filename: string) => {
    if (confirm(`Are you sure you want to delete '${filename}'?`)) {
      deleteMediaMutation.mutate(mediaId);
    }
  };

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings: Array<{key: string, value: string, category: string}>) => {
      return apiRequest('PUT', '/api/settings', { settings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast({
        title: "Success",
        description: "Settings saved successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save settings",
        variant: "destructive",
      });
    }
  });

  const handleSaveDisplay = async () => {
    const settingsToSave = [
      { key: 'theme', value: currentSettings.theme, category: 'display' },
      { key: 'showPrayerTimes', value: currentSettings.showPrayerTimes.toString(), category: 'display' },
      { key: 'showWeather', value: currentSettings.showWeather.toString(), category: 'display' },
      { key: 'enableMarquee', value: currentSettings.enableMarquee.toString(), category: 'display' },
      { key: 'marqueeText', value: currentSettings.marqueeText, category: 'display' },
      // Clinic logo settings
      { key: 'clinicLogo', value: currentSettings.clinicLogo, category: 'display' },
      { key: 'showClinicLogo', value: currentSettings.showClinicLogo, category: 'display' },
      { key: 'marqueeColor', value: currentSettings.marqueeColor, category: 'display' },
      { key: 'marqueeBackgroundColor', value: currentSettings.marqueeBackgroundColor, category: 'display' },
      { key: 'clinicName', value: currentSettings.clinicName, category: 'display' },
      { key: 'dashboardMediaType', value: currentSettings.dashboardMediaType, category: 'display' },
      { key: 'youtubeUrl', value: currentSettings.youtubeUrl, category: 'display' },
      // Individual section colors with gradient support
      { key: 'headerTextColor', value: currentSettings.headerTextColor, category: 'display' },
      { key: 'headerTextMode', value: currentSettings.headerTextMode, category: 'display' },
      { key: 'headerTextGradient', value: currentSettings.headerTextGradient, category: 'display' },
      { key: 'clinicNameTextColor', value: currentSettings.clinicNameTextColor, category: 'display' },
      { key: 'clinicNameTextMode', value: currentSettings.clinicNameTextMode, category: 'display' },
      { key: 'clinicNameTextGradient', value: currentSettings.clinicNameTextGradient, category: 'display' },
      { key: 'headerBackgroundColor', value: currentSettings.headerBackgroundColor, category: 'display' },
      { key: 'headerBackgroundMode', value: currentSettings.headerBackgroundMode, category: 'display' },
      { key: 'headerBackgroundGradient', value: currentSettings.headerBackgroundGradient, category: 'display' },
      { key: 'callNameTextColor', value: currentSettings.callNameTextColor, category: 'display' },
      { key: 'callNameTextMode', value: currentSettings.callNameTextMode, category: 'display' },
      { key: 'callNameTextGradient', value: currentSettings.callNameTextGradient, category: 'display' },
      { key: 'callBackgroundColor', value: currentSettings.callBackgroundColor, category: 'display' },
      { key: 'callBackgroundMode', value: currentSettings.callBackgroundMode, category: 'display' },
      { key: 'callBackgroundGradient', value: currentSettings.callBackgroundGradient, category: 'display' },
      { key: 'windowTextColor', value: currentSettings.windowTextColor, category: 'display' },
      { key: 'windowTextMode', value: currentSettings.windowTextMode, category: 'display' },
      { key: 'windowTextGradient', value: currentSettings.windowTextGradient, category: 'display' },
      { key: 'callBorderColor', value: currentSettings.callBorderColor, category: 'display' },
      // Modal highlight settings
      { key: 'modalBackgroundColor', value: currentSettings.modalBackgroundColor, category: 'display' },
      { key: 'modalBorderColor', value: currentSettings.modalBorderColor, category: 'display' },
      { key: 'modalTextColor', value: currentSettings.modalTextColor, category: 'display' },
      { key: 'prayerTimesTextColor', value: currentSettings.prayerTimesTextColor, category: 'display' },
      { key: 'prayerTimesTextMode', value: currentSettings.prayerTimesTextMode, category: 'display' },
      { key: 'prayerTimesTextGradient', value: currentSettings.prayerTimesTextGradient, category: 'display' },
      { key: 'prayerTimesBackgroundColor', value: currentSettings.prayerTimesBackgroundColor, category: 'display' },
      { key: 'prayerTimesBackgroundMode', value: currentSettings.prayerTimesBackgroundMode, category: 'display' },
      { key: 'prayerTimesBackgroundGradient', value: currentSettings.prayerTimesBackgroundGradient, category: 'display' },
      { key: 'weatherTextColor', value: currentSettings.weatherTextColor, category: 'display' },
      { key: 'weatherTextMode', value: currentSettings.weatherTextMode, category: 'display' },
      { key: 'weatherTextGradient', value: currentSettings.weatherTextGradient, category: 'display' },
      { key: 'weatherBackgroundColor', value: currentSettings.weatherBackgroundColor, category: 'display' },
      { key: 'weatherBackgroundMode', value: currentSettings.weatherBackgroundMode, category: 'display' },
      { key: 'weatherBackgroundGradient', value: currentSettings.weatherBackgroundGradient, category: 'display' },
      { key: 'queueTextColor', value: currentSettings.queueTextColor, category: 'display' },
      { key: 'queueTextMode', value: currentSettings.queueTextMode, category: 'display' },
      { key: 'queueTextGradient', value: currentSettings.queueTextGradient, category: 'display' },
      { key: 'queueBackgroundColor', value: currentSettings.queueBackgroundColor, category: 'display' },
      { key: 'queueBackgroundMode', value: currentSettings.queueBackgroundMode, category: 'display' },
      { key: 'queueBackgroundGradient', value: currentSettings.queueBackgroundGradient, category: 'display' },
      { key: 'queueItemBackgroundColor', value: currentSettings.queueItemBackgroundColor, category: 'display' },
      { key: 'queueItemBackgroundMode', value: currentSettings.queueItemBackgroundMode, category: 'display' },
      { key: 'queueItemBackgroundGradient', value: currentSettings.queueItemBackgroundGradient, category: 'display' },
      { key: 'queueHighlightColor', value: currentSettings.queueHighlightColor, category: 'display' },
      { key: 'queueBorderColor', value: currentSettings.queueBorderColor, category: 'display' },
      { key: 'marqueeBackgroundMode', value: currentSettings.marqueeBackgroundMode, category: 'display' },
      { key: 'marqueeBackgroundGradient', value: currentSettings.marqueeBackgroundGradient, category: 'display' },
      { key: 'marqueeTextMode', value: currentSettings.marqueeTextMode, category: 'display' },
      { key: 'marqueeTextGradient', value: currentSettings.marqueeTextGradient, category: 'display' },
      { key: 'historyNameColor', value: currentSettings.historyNameColor, category: 'display' },
      { key: 'historyNameMode', value: currentSettings.historyNameMode, category: 'display' },
      { key: 'historyNameGradient', value: currentSettings.historyNameGradient, category: 'display' },
    ];
    
    await saveSettingsMutation.mutateAsync(settingsToSave);
    setUnsavedChanges(prev => prev.filter(item => item !== 'display'));
  };

  const handleSaveSound = async () => {
    const settingsToSave = [
      { key: 'enableSound', value: currentSettings.enableSound.toString(), category: 'audio' },
      { key: 'volume', value: currentSettings.volume.toString(), category: 'audio' },
      { key: 'presetKey', value: currentSettings.presetKey, category: 'audio' },
    ];
    
    await saveSettingsMutation.mutateAsync(settingsToSave);
    setUnsavedChanges(prev => prev.filter(item => item !== 'sound'));
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      // Validate all file types
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];
      
      files.forEach(file => {
        if (file.type === 'image/png' || file.type === 'image/jpeg') {
          validFiles.push(file);
        } else {
          invalidFiles.push(file.name);
        }
      });
      
      if (validFiles.length > 0) {
        setSelectedFiles(validFiles);
      }
      
      if (invalidFiles.length > 0) {
        toast({
          title: "Unsupported format",
          description: `The following files are not supported: ${invalidFiles.join(', ')}. Please select PNG or JPEG files only.`,
          variant: "destructive",
        });
      }
    }
  };

  // Handle upload button click
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  // Handle upload files
  const handleUploadFiles = async () => {
    if (selectedFiles.length > 0) {
      try {
        for (const file of selectedFiles) {
          await uploadMediaMutation.mutateAsync(file);
        }
        
        // Clear selected files after successful upload
        setSelectedFiles([]);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        
        toast({
          title: "Upload Successful",
          description: `${selectedFiles.length} images uploaded`,
        });
      } catch (error) {
        toast({
          title: "Upload Error",
          description: "Failed to upload some images",
          variant: "destructive",
        });
      }
    }
  };

  // Media files query
  const { data: mediaFiles = [], isLoading: mediaLoading, refetch: refetchMedia } = useQuery<Media[]>({
    queryKey: ['/api/media'],
    staleTime: 30000,
  });

  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const totalPages = Math.max(1, Math.ceil(mediaFiles.length / 3));
  
  // Clamp currentMediaIndex to valid range
  useEffect(() => {
    if (currentMediaIndex >= totalPages) {
      setCurrentMediaIndex(Math.max(0, totalPages - 1));
    }
  }, [mediaFiles.length, totalPages, currentMediaIndex]);
  
  const nextMedia = () => {
    setCurrentMediaIndex((prev) => Math.min(prev + 1, totalPages - 1));
  };
  
  const prevMedia = () => {
    setCurrentMediaIndex((prev) => Math.max(prev - 1, 0));
  };

  // Test audio function
  const playTestSequence = useCallback(async () => {
    try {
      if (!currentSettings.enableSound) {
        toast({
          title: "Sound Disabled",
          description: "Please enable sound first to test audio",
          variant: "destructive",
        });
        return;
      }

      console.log('Testing audio preset:', currentSettings.presetKey, 'at volume:', currentSettings.volume);
      
      // Play test sound using audio system
      await audioSystem.playNotificationSound({
        enableSound: currentSettings.enableSound,
        volume: currentSettings.volume,
        soundMode: 'preset',
        presetKey: currentSettings.presetKey || 'notification_sound'
      });

      toast({
        title: "Sound Test",
        description: `Test sound ${currentSettings.presetKey} at volume ${currentSettings.volume}% played`,
      });
    } catch (error) {
      console.error('Error playing test sound:', error);
      toast({
        title: "Error",
        description: "Failed to play test sound. Please check audio settings.",
        variant: "destructive",
      });
    }
  }, [currentSettings.enableSound, currentSettings.presetKey, currentSettings.volume, toast]);

  // Active settings tab state
  const [activeTab, setActiveTab] = useState("media");

  if (isLoading || mediaLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>Loading settings...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure display, sound and system settings</p>
          
          {/* Current Settings Status */}
          <div className="mt-2 flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-muted-foreground">Current Settings: {(settings as Setting[]).length} active configurations</span>
            </div>
            
            {unsavedChanges.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-orange-600">
                <Save className="h-4 w-4" />
                <span>{unsavedChanges.length} unsaved changes</span>
              </div>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isLoading}
          data-testid="button-refresh-settings"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* SETTINGS TABS - Simplified */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 h-auto gap-1">
          <TabsTrigger value="media" className="flex items-center gap-1 text-xs" data-testid="tab-media">
            <Image className="h-3 w-3" />
            <span className="hidden sm:inline">Media</span>
          </TabsTrigger>
          <TabsTrigger value="display" className="flex items-center gap-1 text-xs" data-testid="tab-display">
            <Palette className="h-3 w-3" />
            <span className="hidden sm:inline">Display</span>
          </TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-1 text-xs" data-testid="tab-info">
            <Monitor className="h-3 w-3" />
            <span className="hidden sm:inline">Info</span>
          </TabsTrigger>
          <TabsTrigger value="sound" className="flex items-center gap-1 text-xs" data-testid="tab-sound">
            <Volume2 className="h-3 w-3" />
            <span className="hidden sm:inline">Sound</span>
          </TabsTrigger>
          <TabsTrigger value="system" className="flex items-center gap-1 text-xs" data-testid="tab-system">
            <RefreshCw className="h-3 w-3" />
            <span className="hidden sm:inline">System</span>
          </TabsTrigger>
        </TabsList>

        {/* TAB: MEDIA MANAGEMENT */}
        <TabsContent value="media" className="mt-4">
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Media Management
          </h2>
          <p className="text-sm text-muted-foreground">Media settings and image gallery</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Media Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Show in Dashboard Section */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Media Options for Dashboard:</Label>
              <div className="flex space-x-6">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="own-media"
                    name="dashboardMedia"
                    value="own"
                    checked={currentSettings.dashboardMediaType === "own"}
                    onChange={(e) => updateDisplaySetting('dashboardMediaType', e.target.value)}
                    className="w-4 h-4 text-blue-600"
                    data-testid="radio-own-media"
                  />
                  <Label htmlFor="own-media">Upload Images (PNG/JPEG)</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="youtube-media"
                    name="dashboardMedia"
                    value="youtube"
                    checked={currentSettings.dashboardMediaType === "youtube"}
                    onChange={(e) => updateDisplaySetting('dashboardMediaType', e.target.value)}
                    className="w-4 h-4 text-blue-600"
                    data-testid="radio-youtube-media"
                  />
                  <Label htmlFor="youtube-media">YouTube Video</Label>
                </div>
              </div>

              {currentSettings.dashboardMediaType === "youtube" && (
                <div className="mt-4 space-y-2">
                  <Label htmlFor="youtube-url">YouTube URL:</Label>
                  <Input
                    id="youtube-url"
                    type="url"
                    value={currentSettings.youtubeUrl}
                    onChange={(e) => updateDisplaySetting('youtubeUrl', e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    data-testid="input-youtube-url"
                  />
                  <div className="flex space-x-2 mt-2">
                    <Button 
                      onClick={handleSaveDisplay} 
                      className="w-full" 
                      data-testid="button-save-youtube"
                      disabled={saveSettingsMutation.isPending}
                    >
                      {saveSettingsMutation.isPending ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save YouTube URL
                    </Button>
                  </div>

                  {currentSettings.youtubeUrl && (
                    <div className="mt-4 p-4 border-2 border-green-200 rounded-lg bg-green-50">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-20 h-15 bg-gray-200 rounded flex items-center justify-center">
                            <Monitor className="h-8 w-8 text-gray-400" />
                          </div>
                        </div>
                        <div className="flex-grow">
                          <div className="flex items-center space-x-2 mb-2">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span className="font-medium text-green-800">Active YouTube Video</span>
                          </div>
                          <p className="text-sm text-green-700">
                            This video will be displayed on the dashboard as background.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Media Gallery Section - Only show if "own" media is selected */}
            {currentSettings.dashboardMediaType === "own" && (
              <div className="space-y-4">
                <Label className="text-base font-semibold">Media Gallery:</Label>
                
                <div className="space-y-4 p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <div className="text-center space-y-4">
                    <div className="flex flex-col items-center space-y-2">
                      <Upload className="h-12 w-12 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600 font-medium">Upload New Images</p>
                        <p className="text-xs text-gray-500 mt-1">Supported formats: PNG, JPEG only (Max 2MB)</p>
                      </div>
                    </div>
                    
                    {selectedFiles.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm font-medium text-gray-700 text-center">
                          {selectedFiles.length} images selected
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-2">
                          {selectedFiles.map((file, index) => (
                            <div key={index} className="flex items-center space-x-2 p-3 bg-white border rounded-lg">
                              <div className="w-8 h-8 bg-blue-100 rounded flex items-center justify-center">
                                <Upload className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="flex-1 text-left min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button 
                            onClick={handleUploadFiles}
                            disabled={uploadMediaMutation.isPending}
                            className="flex-1"
                            data-testid="button-upload-files"
                          >
                            {uploadMediaMutation.isPending ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-2" />
                            )}
                            {uploadMediaMutation.isPending ? 'Uploading...' : `Upload ${selectedFiles.length} Images`}
                          </Button>
                          <Button 
                            variant="outline" 
                            onClick={() => {
                              setSelectedFiles([]);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            disabled={uploadMediaMutation.isPending}
                            data-testid="button-cancel-upload"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button 
                        onClick={handleUploadClick}
                        variant="outline"
                        className="w-full"
                        data-testid="button-select-file"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Select Images (Multiple)
                      </Button>
                    )}
                    
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                  </div>
                </div>

                {mediaFiles.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Media Files ({mediaFiles.length})</span>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {Array.from({ length: 3 }).map((_, index) => {
                        const actualIndex = currentMediaIndex * 3 + index;
                        const media = mediaFiles[actualIndex];
                        
                        return media ? (
                          <div key={media.id} className="relative group">
                            <div className="bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors flex items-center justify-center"
                                 style={{ aspectRatio: '16/9', minHeight: '120px' }}>
                              
                              <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 ${media.type === 'image' ? 'hidden' : ''}`}>
                                <div className="text-center p-2">
                                  <Upload className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                                  <p className="text-xs text-blue-600 font-medium">{media.filename}</p>
                                </div>
                              </div>
                              
                              {media.type === 'image' && (
                                <img 
                                  src={media.url || `/api/media/${media.id}/file`} 
                                  alt={media.filename}
                                  className="w-full h-full object-cover" 
                                />
                              )}
                            </div>
                            
                            {/* Delete button - appears on hover */}
                            <Button
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0"
                              onClick={() => handleDeleteMedia(media.id, media.filename)}
                              disabled={deleteMediaMutation.isPending}
                              data-testid={`button-delete-media-${media.id}`}
                              title={`Delete ${media.filename}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div key={`empty-${index}`} className="bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center"
                               style={{ aspectRatio: '16/9', minHeight: '120px' }}>
                            <span className="text-gray-400 text-sm">Empty Slot</span>
                          </div>
                        );
                      })}
                    </div>

                    {totalPages > 1 && (
                      <div className="pt-6 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-600">
                              Page {currentMediaIndex + 1} of {totalPages}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              onClick={prevMedia}
                              disabled={currentMediaIndex === 0}
                              data-testid="button-prev-media"
                            >
                              <ChevronLeft className="h-4 w-4" />
                              Previous
                            </Button>
                            <Button
                              variant="outline"
                              onClick={nextMedia}
                              disabled={currentMediaIndex >= totalPages - 1}
                              data-testid="button-next-media"
                            >
                              Next
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No media found. Use the "Select Images" button above to upload images.</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        {/* TAB: DISPLAY SETTINGS (Theme & Colors) */}
        <TabsContent value="display" className="mt-4">
      {/* SECTION 2: THEME & COLOR SETTINGS */}
      <div className="space-y-3">
        <div className="border-b pb-2">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme & Color Settings
          </h2>
          <p className="text-xs text-muted-foreground">Customize each section of the screen individually</p>
        </div>
        
        {/* Grid Layout for Compact Cards - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          
          {/* Compact 2-column cards layout enabled */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                Clinic Name Settings
              </CardTitle>
              <p className="text-xs text-muted-foreground">Set the clinic name to be displayed on the TV screen</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Clinic Name</Label>
                <Input
                  type="text"
                  value={currentSettings.clinicName || "MAIN CLINIC 24 HOURS"}
                  onChange={(e) => updateDisplaySetting('clinicName', e.target.value)}
                  placeholder="Enter clinic name"
                  data-testid="input-clinic-name"
                  className="text-sm"
                />
              </div>
              <Button 
                onClick={handleSaveDisplay} 
                className="w-full" 
                size="sm"
                data-testid="button-save-clinic-name-settings"
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save
              </Button>
            </CardContent>
          </Card>

          {/* Clinic Logo Upload */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Clinic Logo
              </CardTitle>
              <p className="text-xs text-muted-foreground">Upload clinic logo to be displayed on TV screen</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Logo Preview */}
              <div className="flex items-center justify-center">
                {currentSettings.clinicLogo ? (
                  <div className="relative group">
                    <img 
                      src={currentSettings.clinicLogo} 
                      alt="Clinic Logo" 
                      className="h-16 w-16 object-contain rounded-lg border-2 border-border"
                      data-testid="img-clinic-logo-preview"
                    />
                    <Button
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => updateDisplaySetting('clinicLogo', '')}
                      data-testid="button-remove-clinic-logo"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <div className="h-16 w-16 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              
              {/* Upload Button */}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      // Upload to database
                      const formData = new FormData();
                      formData.append('file', file);
                      formData.append('name', 'clinic-logo');
                      
                      const uploadResponse = await fetch('/api/media/upload', {
                        method: 'POST',
                        body: formData,
                      });
                      
                      if (!uploadResponse.ok) {
                        throw new Error('Failed to upload logo');
                      }
                      
                      const media = await uploadResponse.json();
                      
                      // Use media ID as reference (will be served via /api/media/:id/file)
                      updateDisplaySetting('clinicLogo', `/api/media/${media.id}/file`);
                      
                      toast({
                        title: "Success",
                        description: "Logo uploaded successfully",
                      });
                    } catch (error) {
                      toast({
                        title: "Error",
                        description: "Failed to upload logo",
                        variant: "destructive",
                      });
                    }
                  }
                }}
                className="text-xs"
                data-testid="input-clinic-logo-upload"
              />
              
              {/* Enable/Disable Logo Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Logo on TV</Label>
                <Switch
                  checked={currentSettings.showClinicLogo === 'true'}
                  onCheckedChange={(checked) => updateDisplaySetting('showClinicLogo', checked.toString())}
                  data-testid="switch-show-clinic-logo"
                />
              </div>

              <Button 
                onClick={handleSaveDisplay} 
                className="w-full" 
                size="sm"
                data-testid="button-save-clinic-logo"
                disabled={saveSettingsMutation.isPending}
              >
                {saveSettingsMutation.isPending ? (
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Save className="h-3 w-3 mr-1" />
                )}
                Save Logo
              </Button>
            </CardContent>
          </Card>
        
          {/* Header Section Colors */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                Header Display
              </CardTitle>
              <p className="text-xs text-muted-foreground">Colors for TV screen header section</p>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="space-y-2">
                <Label>Background Header</Label>
                
                {/* Toggle between solid and gradient */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.headerBackgroundMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('headerBackgroundMode', 'solid')}
                    data-testid="button-header-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.headerBackgroundMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('headerBackgroundMode', 'gradient')}
                    data-testid="button-header-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.headerBackgroundMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.headerBackgroundColor || '#1e40af'}
                    onChange={(e) => updateDisplaySetting('headerBackgroundColor', e.target.value)}
                    data-testid="input-header-bg-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setGradientPickers(prev => ({ ...prev, header: true }))}
                      data-testid="button-header-gradient-picker"
                      style={{
                        background: currentSettings.headerBackgroundGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-4 w-4 mr-2" />
                      Select Gradient
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Preview: {currentSettings.headerBackgroundGradient}
                    </p>
                  </div>
                )}
              </div>
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-header-colors"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Header Colors
            </Button>
          </CardContent>
        </Card>

        {/* Clinic Name Text Colors - Compact Layout */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              Clinic Name Text
            </CardTitle>
            <p className="text-sm text-muted-foreground">Colors for clinic name text on TV screen</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Compact clinic name text control */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Clinic Name Text</Label>
              <div className="flex items-center gap-2">
                <div className="flex border rounded-md">
                  <Button
                    variant={currentSettings.clinicNameTextMode === 'solid' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs rounded-r-none"
                    onClick={() => updateDisplaySetting('clinicNameTextMode', 'solid')}
                    data-testid="button-clinic-name-text-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.clinicNameTextMode === 'gradient' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 px-2 text-xs rounded-l-none border-l"
                    onClick={() => updateDisplaySetting('clinicNameTextMode', 'gradient')}
                    data-testid="button-clinic-name-text-gradient"
                  >
                    <Brush className="h-3 w-3" />
                  </Button>
                </div>
                {currentSettings.clinicNameTextMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.clinicNameTextColor || '#ffffff'}
                    onChange={(e) => updateDisplaySetting('clinicNameTextColor', e.target.value)}
                    className="w-12 p-0 border-2"
                    data-testid="input-clinic-name-text-color"
                  />
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-12 p-0"
                    onClick={() => setGradientPickers(prev => ({ ...prev, clinicNameText: true }))}
                    data-testid="button-clinic-name-text-gradient-picker"
                    style={{
                      background: currentSettings.clinicNameTextGradient,
                      border: '2px solid #e5e7eb'
                    }}
                  >
                  </Button>
                )}
              </div>
            </div>
            
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-clinic-name-text"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Clinic Name Text
            </Button>
          </CardContent>
        </Card>

        {/* Current Call Display Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Current Call Display
            </CardTitle>
            <p className="text-sm text-muted-foreground">Colors for current call display</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Patient Name Color</Label>
                
                {/* Toggle between solid and gradient for call name text */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.callNameTextMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('callNameTextMode', 'solid')}
                    data-testid="button-call-name-text-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.callNameTextMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('callNameTextMode', 'gradient')}
                    data-testid="button-call-name-text-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.callNameTextMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.callNameTextColor || '#ffffff'}
                    onChange={(e) => updateDisplaySetting('callNameTextColor', e.target.value)}
                    data-testid="input-call-name-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setGradientPickers(prev => ({ ...prev, callNameText: true }))}
                      data-testid="button-call-name-text-gradient-picker"
                      style={{
                        background: currentSettings.callNameTextGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-3 w-3 mr-1" />
                      Select Gradient Text
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Call Background</Label>
                
                {/* Toggle between solid and gradient */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.callBackgroundMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('callBackgroundMode', 'solid')}
                    data-testid="button-call-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.callBackgroundMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('callBackgroundMode', 'gradient')}
                    data-testid="button-call-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.callBackgroundMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.callBackgroundColor || '#16a34a'}
                    onChange={(e) => updateDisplaySetting('callBackgroundColor', e.target.value)}
                    data-testid="input-call-bg-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setGradientPickers(prev => ({ ...prev, call: true }))}
                      data-testid="button-call-gradient-picker"
                      style={{
                        background: currentSettings.callBackgroundGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-4 w-4 mr-2" />
                      Select Gradient
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Preview: {currentSettings.callBackgroundGradient}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Window/Counter Color</Label>
                
                {/* Toggle between solid and gradient for window text */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.windowTextMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('windowTextMode', 'solid')}
                    data-testid="button-window-text-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.windowTextMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('windowTextMode', 'gradient')}
                    data-testid="button-window-text-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.windowTextMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.windowTextColor || '#ffffff'}
                    onChange={(e) => updateDisplaySetting('windowTextColor', e.target.value)}
                    data-testid="input-window-text-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setGradientPickers(prev => ({ ...prev, windowText: true }))}
                      data-testid="button-window-text-gradient-picker"
                      style={{
                        background: currentSettings.windowTextGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-3 w-3 mr-1" />
                      Select Gradient Text
                    </Button>
                  </div>
                )}
              </div>
            </div>
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-call-colors"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Call Colors
            </Button>
          </CardContent>
        </Card>

        {/* Highlight Box Modal Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Highlight Box (Patient Calling)
            </CardTitle>
            <p className="text-sm text-muted-foreground">Colors for highlight box when calling patient</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Background Color</Label>
                <Input
                  type="color"
                  value={currentSettings.modalBackgroundColor || '#1e293b'}
                  onChange={(e) => updateDisplaySetting('modalBackgroundColor', e.target.value)}
                  data-testid="input-modal-background-color"
                />
              </div>
              <div className="space-y-2">
                <Label>Border Color (Corner Lines)</Label>
                <Input
                  type="color"
                  value={currentSettings.modalBorderColor || '#fbbf24'}
                  onChange={(e) => updateDisplaySetting('modalBorderColor', e.target.value)}
                  data-testid="input-modal-border-color"
                />
              </div>
              <div className="space-y-2">
                <Label>Text Color</Label>
                <Input
                  type="color"
                  value={currentSettings.modalTextColor || '#ffffff'}
                  onChange={(e) => updateDisplaySetting('modalTextColor', e.target.value)}
                  data-testid="input-modal-text-color"
                />
              </div>
            </div>
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-highlight-colors"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Highlight Box Colors
            </Button>
          </CardContent>
        </Card>

        {/* Prayer Times Section Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Prayer Times Display
            </CardTitle>
            <p className="text-sm text-muted-foreground">Colors for prayer times display</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prayer Times Text Color</Label>
                
                {/* Toggle between solid and gradient for prayer times text */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.prayerTimesTextMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('prayerTimesTextMode', 'solid')}
                    data-testid="button-prayer-text-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.prayerTimesTextMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('prayerTimesTextMode', 'gradient')}
                    data-testid="button-prayer-text-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.prayerTimesTextMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.prayerTimesTextColor || '#ffffff'}
                    onChange={(e) => updateDisplaySetting('prayerTimesTextColor', e.target.value)}
                    data-testid="input-prayer-text-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setGradientPickers(prev => ({ ...prev, prayerText: true }))}
                      data-testid="button-prayer-text-gradient-picker"
                      style={{
                        background: currentSettings.prayerTimesTextGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-3 w-3 mr-1" />
                      Select Gradient Text
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Prayer Times Background</Label>
                
                {/* Toggle between solid and gradient */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.prayerTimesBackgroundMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('prayerTimesBackgroundMode', 'solid')}
                    data-testid="button-prayer-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.prayerTimesBackgroundMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('prayerTimesBackgroundMode', 'gradient')}
                    data-testid="button-prayer-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.prayerTimesBackgroundMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.prayerTimesBackgroundColor || '#7c3aed'}
                    onChange={(e) => updateDisplaySetting('prayerTimesBackgroundColor', e.target.value)}
                    data-testid="input-prayer-bg-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setGradientPickers(prev => ({ ...prev, prayer: true }))}
                      data-testid="button-prayer-gradient-picker"
                      style={{
                        background: currentSettings.prayerTimesBackgroundGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-4 w-4 mr-2" />
                      Select Gradient
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Preview: {currentSettings.prayerTimesBackgroundGradient}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Prayer Times Highlight Color */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-semibold mb-2 block">Prayer Times Highlight Color</Label>
              <p className="text-xs text-muted-foreground mb-3">Color for upcoming prayer time (slow pulse effect)</p>
              <Input
                type="color"
                value={currentSettings.prayerTimesHighlightColor || '#facc15'}
                onChange={(e) => updateDisplaySetting('prayerTimesHighlightColor', e.target.value)}
                data-testid="input-prayer-highlight-color"
              />
            </div>
            
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-prayer-colors"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Prayer Times Colors
            </Button>
          </CardContent>
        </Card>

        {/* Weather Section Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Weather Display
            </CardTitle>
            <p className="text-sm text-muted-foreground">Colors for weather display</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Weather Text Color</Label>
                
                {/* Toggle between solid and gradient for weather text */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.weatherTextMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('weatherTextMode', 'solid')}
                    data-testid="button-weather-text-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.weatherTextMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('weatherTextMode', 'gradient')}
                    data-testid="button-weather-text-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.weatherTextMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.weatherTextColor || '#ffffff'}
                    onChange={(e) => updateDisplaySetting('weatherTextColor', e.target.value)}
                    data-testid="input-weather-text-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setGradientPickers(prev => ({ ...prev, weatherText: true }))}
                      data-testid="button-weather-text-gradient-picker"
                      style={{
                        background: currentSettings.weatherTextGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-3 w-3 mr-1" />
                      Select Gradient Text
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Weather Background</Label>
                
                {/* Toggle between solid and gradient */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.weatherBackgroundMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('weatherBackgroundMode', 'solid')}
                    data-testid="button-weather-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.weatherBackgroundMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('weatherBackgroundMode', 'gradient')}
                    data-testid="button-weather-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.weatherBackgroundMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.weatherBackgroundColor || '#f97316'}
                    onChange={(e) => updateDisplaySetting('weatherBackgroundColor', e.target.value)}
                    data-testid="input-weather-bg-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setGradientPickers(prev => ({ ...prev, weather: true }))}
                      data-testid="button-weather-gradient-picker"
                      style={{
                        background: currentSettings.weatherBackgroundGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-4 w-4 mr-2" />
                      Select Gradient
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Preview: {currentSettings.weatherBackgroundGradient}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-weather-colors"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Weather Colors
            </Button>
          </CardContent>
        </Card>

        {/* Queue List Colors - Compact Layout */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              Queue List Display
            </CardTitle>
            <p className="text-sm text-muted-foreground">Colors for patient queue list</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Compact grid layout */}
            <div className="grid grid-cols-2 gap-3">
              {/* Text Color Section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">List Text</Label>
                <div className="flex items-center gap-2">
                  <div className="flex border rounded-md">
                    <Button
                      variant={currentSettings.queueTextMode === 'solid' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs rounded-r-none"
                      onClick={() => updateDisplaySetting('queueTextMode', 'solid')}
                      data-testid="button-queue-text-solid"
                    >
                      Solid
                    </Button>
                    <Button
                      variant={currentSettings.queueTextMode === 'gradient' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs rounded-l-none border-l"
                      onClick={() => updateDisplaySetting('queueTextMode', 'gradient')}
                      data-testid="button-queue-text-gradient"
                    >
                      <Brush className="h-3 w-3" />
                    </Button>
                  </div>
                  {currentSettings.queueTextMode === 'solid' ? (
                    <Input
                      type="color"
                      value={currentSettings.queueTextColor || '#1f2937'}
                      onChange={(e) => updateDisplaySetting('queueTextColor', e.target.value)}
                      className="w-12 p-0 border-2"
                      data-testid="input-queue-text-color"
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-12 p-0"
                      onClick={() => setGradientPickers(prev => ({ ...prev, queueText: true }))}
                      data-testid="button-queue-text-gradient-picker"
                      style={{
                        background: currentSettings.queueTextGradient,
                        border: '2px solid #e5e7eb'
                      }}
                    >
                    </Button>
                  )}
                </div>
              </div>

              {/* Background Color Section */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">List Background</Label>
                <div className="flex items-center gap-2">
                  <div className="flex border rounded-md">
                    <Button
                      variant={currentSettings.queueBackgroundMode === 'solid' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs rounded-r-none"
                      onClick={() => updateDisplaySetting('queueBackgroundMode', 'solid')}
                      data-testid="button-queue-solid"
                    >
                      Solid
                    </Button>
                    <Button
                      variant={currentSettings.queueBackgroundMode === 'gradient' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-7 px-2 text-xs rounded-l-none border-l"
                      onClick={() => updateDisplaySetting('queueBackgroundMode', 'gradient')}
                      data-testid="button-queue-gradient"
                    >
                      <Brush className="h-3 w-3" />
                    </Button>
                  </div>
                  {currentSettings.queueBackgroundMode === 'solid' ? (
                    <Input
                      type="color"
                      value={currentSettings.queueBackgroundColor || '#f3f4f6'}
                      onChange={(e) => updateDisplaySetting('queueBackgroundColor', e.target.value)}
                      className="w-12 p-0 border-2"
                      data-testid="input-queue-bg-color"
                    />
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-12 p-0"
                      onClick={() => setGradientPickers(prev => ({ ...prev, queue: true }))}
                      data-testid="button-queue-gradient-picker"
                      style={{
                        background: currentSettings.queueBackgroundGradient,
                        border: '2px solid #e5e7eb'
                      }}
                    >
                    </Button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Queue Item Background Controls */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-semibold mb-2 block">Queue Item Background (Box for each patient)</Label>
              
              {/* Toggle between solid and gradient for queue items */}
              <div className="flex space-x-2 mb-2">
                <Button
                  variant={currentSettings.queueItemBackgroundMode === 'solid' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateDisplaySetting('queueItemBackgroundMode', 'solid')}
                  data-testid="button-queue-item-solid"
                >
                  Solid
                </Button>
                <Button
                  variant={currentSettings.queueItemBackgroundMode === 'gradient' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => updateDisplaySetting('queueItemBackgroundMode', 'gradient')}
                  data-testid="button-queue-item-gradient"
                >
                  <Brush className="h-3 w-3 mr-1" />
                  Gradient
                </Button>
              </div>

              {currentSettings.queueItemBackgroundMode === 'solid' ? (
                <Input
                  type="color"
                  value={currentSettings.queueItemBackgroundColor || '#2563eb'}
                  onChange={(e) => updateDisplaySetting('queueItemBackgroundColor', e.target.value)}
                  data-testid="input-queue-item-bg-color"
                />
              ) : (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setGradientPickers(prev => ({ ...prev, queueItem: true }))}
                    data-testid="button-queue-item-gradient-picker"
                    style={{
                      background: currentSettings.queueItemBackgroundGradient,
                      color: 'white',
                      border: '2px solid #e5e7eb'
                    }}
                  >
                    <Brush className="h-4 w-4 mr-2" />
                    Select Gradient untuk Item
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Preview: {currentSettings.queueItemBackgroundGradient}
                  </p>
                </div>
              )}
            </div>
            
            {/* History Name Text Controls */}
            <div className="border-t pt-4 mt-4">
              <Label className="text-sm font-semibold mb-2 block">Patient Name Color (History Name)</Label>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Name Text Color</Label>
                  <Input
                    type="color"
                    value={currentSettings.historyNameColor || '#facc15'}
                    onChange={(e) => updateDisplaySetting('historyNameColor', e.target.value)}
                    data-testid="input-history-name-color"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Patient Name Style</Label>
                  
                  {/* Toggle between solid and gradient for history name text */}
                  <div className="flex space-x-2 mb-2">
                    <Button
                      variant={currentSettings.historyNameMode === 'solid' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateDisplaySetting('historyNameMode', 'solid')}
                      data-testid="button-history-name-solid"
                    >
                      Solid
                    </Button>
                    <Button
                      variant={currentSettings.historyNameMode === 'gradient' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => updateDisplaySetting('historyNameMode', 'gradient')}
                      data-testid="button-history-name-gradient"
                    >
                      <Brush className="h-3 w-3 mr-1" />
                      Gradient
                    </Button>
                  </div>

                  {currentSettings.historyNameMode === 'gradient' && (
                    <div className="space-y-2">
                      <Button
                        variant="outline"
                        className="w-full text-xs"
                        onClick={() => setGradientPickers(prev => ({ ...prev, historyName: true }))}
                        data-testid="button-history-name-gradient-picker"
                        style={{
                          background: currentSettings.historyNameGradient || 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
                          color: 'white',
                          border: '2px solid #e5e7eb'
                        }}
                      >
                        <Brush className="h-3 w-3 mr-1" />
                        Select Gradient Text
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-queue-colors"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Queue List Colors
            </Button>
          </CardContent>
        </Card>
        </div>
      </div>
        </TabsContent>

        {/* TAB: INFO SETTINGS (Prayer, Weather, Marquee) */}
        <TabsContent value="info" className="mt-4">
      {/* SECTION 3: INFORMATION DISPLAY SETTINGS */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Information Display Settings
          </h2>
          <p className="text-sm text-muted-foreground">Display information and marquee settings</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Display Information Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Toggle Options */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Prayer Times</Label>
                  <div className="text-sm text-muted-foreground">
                    Display prayer times on TV screen
                  </div>
                </div>
                <Switch
                  checked={currentSettings.showPrayerTimes}
                  onCheckedChange={(checked) => {
                    updateDisplaySetting('showPrayerTimes', checked);
                    if (checked) {
                      updateDisplaySetting('showWeather', false);
                    }
                  }}
                  data-testid="switch-prayer-times"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weather</Label>
                  <div className="text-sm text-muted-foreground">
                    Display current weather information
                  </div>
                </div>
                <Switch
                  checked={currentSettings.showWeather}
                  onCheckedChange={(checked) => {
                    updateDisplaySetting('showWeather', checked);
                    if (checked) {
                      updateDisplaySetting('showPrayerTimes', false);
                    }
                  }}
                  data-testid="switch-weather"
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>TV Mode</Label>
                  <div className="text-sm text-muted-foreground">
                    Optimize display for Smart TV browsers (brighter colors, larger text)
                  </div>
                </div>
                <Switch
                  checked={tvMode}
                  onCheckedChange={handleTvModeToggle}
                  data-testid="switch-tv-mode"
                />
              </div>
            </div>

            {/* Marquee Settings */}
            <div className="space-y-4">
              {/* Enable Marquee Switch */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Marquee</Label>
                  <div className="text-sm text-muted-foreground">
                    Enable scrolling text display at the bottom of the screen
                  </div>
                </div>
                <Switch
                  checked={currentSettings.enableMarquee}
                  onCheckedChange={(checked) => updateDisplaySetting('enableMarquee', checked)}
                  data-testid="switch-enable-marquee"
                />
              </div>

              {currentSettings.enableMarquee && (
                <div className="space-y-4">
                  <Label>Marquee Text</Label>
                  <Textarea
                    value={currentSettings.marqueeText}
                    onChange={(e) => updateDisplaySetting('marqueeText', e.target.value)}
                    placeholder="Enter text that will scroll at the bottom of the screen"
                    data-testid="textarea-marquee-text"
                  />
              <div className="space-y-2">
                <Label>Marquee Text Color</Label>
                
                {/* Toggle between solid and gradient for marquee text */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.marqueeTextMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('marqueeTextMode', 'solid')}
                    data-testid="button-marquee-text-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.marqueeTextMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('marqueeTextMode', 'gradient')}
                    data-testid="button-marquee-text-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.marqueeTextMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.marqueeColor}
                    onChange={(e) => updateDisplaySetting('marqueeColor', e.target.value)}
                    data-testid="input-marquee-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full text-xs"
                      onClick={() => setGradientPickers(prev => ({ ...prev, marqueeText: true }))}
                      data-testid="button-marquee-text-gradient-picker"
                      style={{
                        background: currentSettings.marqueeTextGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-3 w-3 mr-1" />
                      Select Gradient Text
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Marquee Background</Label>
                
                {/* Toggle between solid and gradient */}
                <div className="flex space-x-2 mb-2">
                  <Button
                    variant={currentSettings.marqueeBackgroundMode === 'solid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('marqueeBackgroundMode', 'solid')}
                    data-testid="button-marquee-solid"
                  >
                    Solid
                  </Button>
                  <Button
                    variant={currentSettings.marqueeBackgroundMode === 'gradient' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => updateDisplaySetting('marqueeBackgroundMode', 'gradient')}
                    data-testid="button-marquee-gradient"
                  >
                    <Brush className="h-3 w-3 mr-1" />
                    Gradient
                  </Button>
                </div>

                {currentSettings.marqueeBackgroundMode === 'solid' ? (
                  <Input
                    type="color"
                    value={currentSettings.marqueeBackgroundColor}
                    onChange={(e) => updateDisplaySetting('marqueeBackgroundColor', e.target.value)}
                    data-testid="input-marquee-background-color"
                  />
                ) : (
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setGradientPickers(prev => ({ ...prev, marquee: true }))}
                      data-testid="button-marquee-gradient-picker"
                      style={{
                        background: currentSettings.marqueeBackgroundGradient,
                        color: 'white',
                        border: '2px solid #e5e7eb'
                      }}
                    >
                      <Brush className="h-4 w-4 mr-2" />
                      Select Gradient
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Preview: {currentSettings.marqueeBackgroundGradient}
                    </p>
                  </div>
                )}
              </div>
                </div>
              )}
            </div>

            <Button 
              onClick={handleSaveDisplay} 
              className="w-full" 
              data-testid="button-save-display"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Display Settings
            </Button>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        {/* TAB: SOUND SETTINGS */}
        <TabsContent value="sound" className="mt-4">
      {/* SECTION 4: AUDIO SETTINGS */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Audio Settings
          </h2>
          <p className="text-sm text-muted-foreground">Sound and audio settings</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Volume2 className="h-5 w-5 mr-2" />
              Audio Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable Sound */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Sound</Label>
                <div className="text-sm text-muted-foreground">
                  Enable sound for calls
                </div>
              </div>
              <Switch
                checked={currentSettings.enableSound}
                onCheckedChange={(checked) => updateSoundSetting('enableSound', checked)}
                data-testid="switch-enable-sound"
              />
            </div>

            {currentSettings.enableSound && (
              <div className="space-y-4">
                {/* Preset Sound Selection */}
                <div className="space-y-4">
                  <Label>Audio Preset Selection</Label>
                  <Select
                    value={currentSettings.presetKey}
                    onValueChange={(value) => updateSoundSetting('presetKey', value)}
                  >
                    <SelectTrigger data-testid="select-preset-sound">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {audioSystem.getAvailablePresets().map((preset) => (
                        <SelectItem key={preset.key} value={preset.key}>
                          {preset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Volume Control */}
                <div className="space-y-2">
                  <Label>Volume: {currentSettings.volume}%</Label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={currentSettings.volume}
                    onChange={(e) => {
                      const newVolume = parseInt(e.target.value);
                      updateSoundSetting('volume', newVolume);
                    }}
                    className="w-full"
                    data-testid="slider-volume"
                  />
                </div>

                {/* Test Audio Button */}
                <div className="space-y-4">
                  <Button
                    variant="outline"
                    onClick={() => playTestSequence()}
                    className="w-full"
                    data-testid="button-test-audio"
                  >
                    <Volume2 className="h-4 w-4 mr-2" />
                    Test Audio Preset
                  </Button>
                </div>
              </div>
            )}

            <Button 
              onClick={handleSaveSound} 
              className="w-full" 
              data-testid="button-save-sound"
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Sound Settings
            </Button>
          </CardContent>
        </Card>
        
      </div>
        </TabsContent>

        {/* TAB: SYSTEM TOOLS */}
        <TabsContent value="system" className="mt-4">
      {/* SECTION 5: SYSTEM TOOLS */}
      <div className="space-y-4">
        <div className="border-b pb-2">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            System Tools
          </h2>
          <p className="text-sm text-muted-foreground">Admin tools for system maintenance</p>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <RefreshCw className="h-5 w-5 mr-2" />
              Force Refresh All Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Force all connected browsers (staff PC & TV displays) to reload. 
              Use this after deploying updates to ensure all clients get the latest version.
            </p>
            <Button 
              variant="destructive"
              onClick={async () => {
                try {
                  const response = await fetch('/api/system/force-refresh', {
                    method: 'POST',
                    credentials: 'include'
                  });
                  const data = await response.json();
                  if (response.ok) {
                    toast({
                      title: "Success",
                      description: data.message,
                    });
                  } else {
                    toast({
                      title: "Error",
                      description: data.error || "Failed to send force refresh",
                      variant: "destructive",
                    });
                  }
                } catch (error) {
                  toast({
                    title: "Error",
                    description: "Failed to send force refresh signal",
                    variant: "destructive",
                  });
                }
              }}
              className="w-full"
              data-testid="button-force-refresh-clients"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Force Refresh All Clients
            </Button>
          </CardContent>
        </Card>
      </div>
        </TabsContent>
      </Tabs>
      
      {/* Gradient Picker Modals */}
      <GradientPicker
        isOpen={gradientPickers.header}
        onClose={() => setGradientPickers(prev => ({ ...prev, header: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('headerBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, header: false }));
        }}
        title="Header Background Gradient"
        currentValue={currentSettings.headerBackgroundGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.call}
        onClose={() => setGradientPickers(prev => ({ ...prev, call: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('callBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, call: false }));
        }}
        title="Call Background Gradient"
        currentValue={currentSettings.callBackgroundGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.prayer}
        onClose={() => setGradientPickers(prev => ({ ...prev, prayer: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('prayerTimesBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, prayer: false }));
        }}
        title="Prayer Times Background Gradient"
        currentValue={currentSettings.prayerTimesBackgroundGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.weather}
        onClose={() => setGradientPickers(prev => ({ ...prev, weather: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('weatherBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, weather: false }));
        }}
        title="Weather Background Gradient"
        currentValue={currentSettings.weatherBackgroundGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.queue}
        onClose={() => setGradientPickers(prev => ({ ...prev, queue: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('queueBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, queue: false }));
        }}
        title="Queue Background Gradient"
        currentValue={currentSettings.queueBackgroundGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.queueItem}
        onClose={() => setGradientPickers(prev => ({ ...prev, queueItem: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('queueItemBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, queueItem: false }));
        }}
        title="Queue Item Background Gradient"
        currentValue={currentSettings.queueItemBackgroundGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.historyName}
        onClose={() => setGradientPickers(prev => ({ ...prev, historyName: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('historyNameGradient', gradient);
          setGradientPickers(prev => ({ ...prev, historyName: false }));
        }}
        title="History Name Text Gradient"
        currentValue={currentSettings.historyNameGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.marquee}
        onClose={() => setGradientPickers(prev => ({ ...prev, marquee: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('marqueeBackgroundGradient', gradient);
          setGradientPickers(prev => ({ ...prev, marquee: false }));
        }}
        title="Marquee Background Gradient"
        currentValue={currentSettings.marqueeBackgroundGradient}
      />
      
      {/* Text Gradient Pickers */}
      <GradientPicker
        isOpen={gradientPickers.headerText}
        onClose={() => setGradientPickers(prev => ({ ...prev, headerText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('headerTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, headerText: false }));
        }}
        title="Header Text Gradient"
        currentValue={currentSettings.headerTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.callNameText}
        onClose={() => setGradientPickers(prev => ({ ...prev, callNameText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('callNameTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, callNameText: false }));
        }}
        title="Call Name Text Gradient"
        currentValue={currentSettings.callNameTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.windowText}
        onClose={() => setGradientPickers(prev => ({ ...prev, windowText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('windowTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, windowText: false }));
        }}
        title="Window Text Gradient"
        currentValue={currentSettings.windowTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.prayerText}
        onClose={() => setGradientPickers(prev => ({ ...prev, prayerText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('prayerTimesTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, prayerText: false }));
        }}
        title="Prayer Times Text Gradient"
        currentValue={currentSettings.prayerTimesTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.weatherText}
        onClose={() => setGradientPickers(prev => ({ ...prev, weatherText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('weatherTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, weatherText: false }));
        }}
        title="Weather Text Gradient"
        currentValue={currentSettings.weatherTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.queueText}
        onClose={() => setGradientPickers(prev => ({ ...prev, queueText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('queueTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, queueText: false }));
        }}
        title="Queue Text Gradient"
        currentValue={currentSettings.queueTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.marqueeText}
        onClose={() => setGradientPickers(prev => ({ ...prev, marqueeText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('marqueeTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, marqueeText: false }));
        }}
        title="Marquee Text Gradient"
        currentValue={currentSettings.marqueeTextGradient}
      />
      
      <GradientPicker
        isOpen={gradientPickers.clinicNameText}
        onClose={() => setGradientPickers(prev => ({ ...prev, clinicNameText: false }))}
        onApply={(gradient) => {
          updateDisplaySetting('clinicNameTextGradient', gradient);
          setGradientPickers(prev => ({ ...prev, clinicNameText: false }));
        }}
        title="Clinic Name Text Gradient"
        currentValue={currentSettings.clinicNameTextGradient}
      />
    </div>
  );
}