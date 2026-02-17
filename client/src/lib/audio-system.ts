// Audio System Utility for Clinic Calling System  
// Handles preset audio notifications only

import type { SoundModeType, PresetSoundKeyType } from "@shared/schema";

// Import preset audio files via @assets
// Original 5 files
import notificationSound from "@assets/notification-sound-3-262896_1759056866786.mp3";
import subwayChime from "@assets/subway-station-chime-100558_1759056866786.mp3";
import headerTone from "@assets/header-39344_1759056866787.mp3";
import airportChime from "@assets/airport-announcement-call-chime-start-and-finish-342984_1759056866787.mp3";
import airportCall from "@assets/airport-call-157168_1759056866787.mp3";

// New 8 WAV files
import airportDing1569 from "@assets/mixkit-airport-announcement-ding-1569_1759142829288.wav";
import melodicAirportDing1570 from "@assets/mixkit-melodic-airport-announcement-ding-1570_1759142829292.wav";
import flutePhoneAlert2316 from "@assets/mixkit-flute-mobile-phone-notification-alert-2316_1759142829291.wav";
import happyBells937 from "@assets/mixkit-happy-bells-notification-937_1759142829291.wav";
import orchestraTriumphant2285 from "@assets/mixkit-orchestra-triumphant-trumpets-2285_1759142829292.wav";
import orchestraEnding2292 from "@assets/mixkit-orchestra-trumpets-ending-2292_1759142829294.wav";
import softwareRemove2576 from "@assets/mixkit-software-interface-remove-2576_1759142829294.wav";
import trumpetFanfare2293 from "@assets/mixkit-trumpet-fanfare-2293_1759142829294.wav";

export interface AudioSettings {
  enableSound: boolean;
  volume: number;
  soundMode: SoundModeType; // Will always be 'preset'
  presetKey: PresetSoundKeyType;
}

export interface CallInfo {
  patientName?: string;
  patientNumber: number;
  windowName: string;
}

export class AudioSystem {
  private static instance: AudioSystem;
  private audioContext: AudioContext | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private forceHTMLAudio: boolean = false; // Force HTMLAudio mode for TV displays
  
  // Centralized preset definitions
  private static readonly PRESET_DEFS: Array<{key: PresetSoundKeyType, name: string, src: string}> = [
    // Original 5 files
    { key: 'notification_sound', name: 'Notification Sound', src: notificationSound },
    { key: 'subway_chime', name: 'Subway Station Chime', src: subwayChime },
    { key: 'header_tone', name: 'Header Tone', src: headerTone },
    { key: 'airport_chime', name: 'Airport Announcement Chime', src: airportChime },
    { key: 'airport_call', name: 'Airport Call', src: airportCall },
    
    // New 8 WAV files
    { key: 'airport_ding_1569', name: 'Airport Ding (1569)', src: airportDing1569 },
    { key: 'melodic_airport_ding_1570', name: 'Melodic Airport Ding (1570)', src: melodicAirportDing1570 },
    { key: 'flute_phone_alert_2316', name: 'Flute Phone Alert (2316)', src: flutePhoneAlert2316 },
    { key: 'happy_bells_937', name: 'Happy Bells (937)', src: happyBells937 },
    { key: 'orchestra_trumpets_triumphant_2285', name: 'Orchestra Trumpets – Triumphant (2285)', src: orchestraTriumphant2285 },
    { key: 'orchestra_trumpets_ending_2292', name: 'Orchestra Trumpets – Ending (2292)', src: orchestraEnding2292 },
    { key: 'software_remove_2576', name: 'Interface Remove (2576)', src: softwareRemove2576 },
    { key: 'trumpet_fanfare_2293', name: 'Trumpet Fanfare (2293)', src: trumpetFanfare2293 }
  ];

  // Build preset sound mappings from centralized definitions
  private presetSounds: Record<PresetSoundKeyType, string> = Object.fromEntries(
    AudioSystem.PRESET_DEFS.map(def => [def.key, def.src])
  ) as Record<PresetSoundKeyType, string>;

  // Check codec capability (prefer MP3 on TVs)
  private checkCodecSupport(): { mp3: boolean; wav: boolean } {
    try {
      const audio = new Audio();
      return {
        mp3: !!audio.canPlayType('audio/mpeg'),
        wav: !!audio.canPlayType('audio/wav')
      };
    } catch {
      return { mp3: true, wav: true }; // Assume support if check fails
    }
  }

  private constructor() {}

  public static getInstance(): AudioSystem {
    if (!AudioSystem.instance) {
      AudioSystem.instance = new AudioSystem();
    }
    return AudioSystem.instance;
  }

  private getAudioContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return this.audioContext;
  }

  // Load and cache audio file
  private async loadAudioFile(url: string): Promise<AudioBuffer> {
    // Check cache first
    if (this.audioBufferCache.has(url)) {
      return this.audioBufferCache.get(url)!;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch audio file: ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioContext = this.getAudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      // Cache the buffer for future use
      this.audioBufferCache.set(url, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Error loading audio file:', error);
      throw error;
    }
  }

  // HTMLAudio fallback for TVs with limited Web Audio support (with retry logic)
  private async playAudioWithHTMLAudio(url: string, volume: number, retries: number = 2): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      
      // Set up audio element
      audio.volume = Math.max(0, Math.min(1, volume / 100)); // Clamp volume 0-1
      audio.preload = 'auto'; // Preload for faster playback
      audio.src = url;
      
      let attemptCount = 0;
      
      const attemptPlay = async () => {
        try {
          attemptCount++;
          await audio.play();
          console.log(`✅ HTMLAudio playback started (attempt ${attemptCount})`);
        } catch (error) {
          console.error(`❌ HTMLAudio playback failed (attempt ${attemptCount}):`, error);
          
          // Retry if attempts remaining
          if (attemptCount < retries) {
            console.log(`🔄 Retrying HTMLAudio playback...`);
            setTimeout(() => attemptPlay(), 100); // Wait 100ms before retry
          } else {
            reject(new Error(`HTMLAudio playback failed after ${retries} attempts`));
          }
        }
      };
      
      // Event handlers
      audio.onended = () => {
        console.log('✅ HTMLAudio playback completed');
        resolve();
      };
      
      audio.onerror = (event) => {
        console.error('❌ HTMLAudio error event:', event);
        reject(new Error('HTMLAudio playback error'));
      };
      
      // Start playback
      attemptPlay();
    });
  }

  // Play audio file from buffer with HTMLAudio fallback
  private async playAudioFile(url: string, volume: number): Promise<void> {
    // FORCE HTMLAudio mode for TV displays (more stable & reliable)
    if (this.forceHTMLAudio) {
      console.log('🔊 Using HTMLAudio (TV mode) for stable playback');
      return await this.playAudioWithHTMLAudio(url, volume);
    }

    try {
      const audioContext = this.getAudioContext();
      
      // Check if AudioContext is suspended (autoplay blocked)
      if (audioContext.state === 'suspended') {
        console.warn('AudioContext suspended, trying HTMLAudio fallback');
        return await this.playAudioWithHTMLAudio(url, volume);
      }

      const audioBuffer = await this.loadAudioFile(url);
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();
      
      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Set volume
      gainNode.gain.value = volume / 100;
      
      return new Promise((resolve, reject) => {
        source.onended = () => resolve();
        try {
          source.start();
        } catch (error) {
          reject(new Error('Audio playback failed'));
        }
      });
    } catch (error) {
      console.error('Error playing audio file, trying HTMLAudio fallback:', error);
      // Fallback to HTMLAudio if Web Audio fails
      try {
        return await this.playAudioWithHTMLAudio(url, volume);
      } catch (fallbackError) {
        console.error('HTMLAudio fallback also failed:', fallbackError);
        throw fallbackError;
      }
    }
  }


  // Play notification sound using preset audio files with codec-aware fallback
  public async playNotificationSound(settings: AudioSettings): Promise<void> {
    try {
      if (!settings.enableSound) {
        return;
      }

      let presetUrl = this.presetSounds[settings.presetKey];
      if (!presetUrl) {
        console.warn(`Preset sound '${settings.presetKey}' not found`);
        return;
      }

      // Check codec support and prefer MP3 on TVs with limited WAV support
      const codecSupport = this.checkCodecSupport();
      const isWav = presetUrl.endsWith('.wav');
      
      if (isWav && !codecSupport.wav && codecSupport.mp3) {
        // Fallback to MP3 preset (notification_sound is reliable MP3)
        console.warn(`WAV not supported, using MP3 fallback`);
        presetUrl = this.presetSounds['notification_sound'];
      }

      return await this.playAudioFile(presetUrl, settings.volume);
    } catch (error) {
      console.error('Error playing notification sound:', error);
      throw error;
    }
  }


  // Complete calling sequence - plays preset audio notification only
  public async playCallingSequence(callInfo: CallInfo, settings: AudioSettings): Promise<void> {
    try {
      if (settings.enableSound) {
        await this.playNotificationSound(settings);
      }
    } catch (error) {
      console.error('Error in calling sequence:', error);
      throw error;
    }
  }

  // Get available preset sounds from centralized definitions
  public getAvailablePresets(): Array<{key: PresetSoundKeyType, name: string}> {
    return AudioSystem.PRESET_DEFS.map(({key, name}) => ({key, name}));
  }

  // Unlock audio for TV/fullscreen - must be called from user gesture
  public async unlock(): Promise<void> {
    try {
      // ENABLE HTMLAudio mode for TV displays (more stable than Web Audio API)
      this.forceHTMLAudio = true;
      console.log('🔊 TV Mode: Enabled HTMLAudio for stable playback');

      const audioContext = this.getAudioContext();
      
      // Resume AudioContext if suspended (autoplay policy) - SYNC ONLY
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        console.log('✅ AudioContext resumed successfully');
      }
      
      // Skip bulk preloading on TV - audio loads on-demand and caches after first use
      
      console.log('✅ Audio system unlocked and ready for TV');
    } catch (error) {
      console.error('❌ Failed to unlock audio:', error);
      throw error;
    }
  }

  public async preloadPresets(onlyKey?: PresetSoundKeyType): Promise<void> {
    try {
      const codecSupport = this.checkCodecSupport();
      
      const presetsToLoad = AudioSystem.PRESET_DEFS.filter(def => {
        if (onlyKey && def.key !== onlyKey) return false;
        const isWav = def.src.endsWith('.wav');
        const isMp3 = def.src.endsWith('.mp3');
        if (isWav && !codecSupport.wav) return false;
        if (isMp3 && !codecSupport.mp3) return false;
        return true;
      });
      
      const preloadPromises = presetsToLoad.map(def => 
        this.loadAudioFile(def.src).catch(error => {
          console.warn(`Failed to preload preset sound ${def.name}:`, error);
        })
      );
      
      await Promise.allSettled(preloadPromises);
      console.log(`Preset sounds preloading completed - ${presetsToLoad.length} sounds loaded`);
    } catch (error) {
      console.error('Error preloading preset sounds:', error);
    }
  }

  // Test function for settings preview
  public async playTestSequence(settings: AudioSettings): Promise<void> {
    const testCallInfo: CallInfo = {
      patientName: "Ahmad Bin Ali",
      patientNumber: 123,
      windowName: "Kaunter 1"
    };

    return this.playCallingSequence(testCallInfo, settings);
  }

  // Test individual sound modes for settings UI
  public async playTestSound(settings: AudioSettings): Promise<void> {
    return this.playNotificationSound(settings);
  }
}

// Export singleton instance
export const audioSystem = AudioSystem.getInstance();