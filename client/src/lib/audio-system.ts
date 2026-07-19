// Audio System Utility for Clinic Calling System  
// Handles preset audio notifications only

import type { SoundModeType, PresetSoundKeyType } from "@shared/schema";
import { getTtsName } from "@/lib/name-utils";

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
import kliaChime from "@assets/klia-chime-flight-announcement-bahasa-melayu-english_jSoPWQ5z_1775584093379.mp3";

export type TtsLanguageType = 'ms-MY' | 'en-US' | 'both';

export type TtsVoiceGenderType = 'FEMALE' | 'MALE';

export interface TtsPronunciationRule {
  original: string;
  replacementBM: string;
  replacementEN: string;
}

export interface AudioSettings {
  enableSound: boolean;
  volume: number;
  soundMode: SoundModeType; // Will always be 'preset'
  presetKey: PresetSoundKeyType;
  ttsEnabled?: boolean;
  ttsLanguage?: TtsLanguageType;
  ttsRate?: number;
  ttsVoiceGender?: TtsVoiceGenderType;
  ttsPronunciations?: TtsPronunciationRule[];
}

export interface CallInfo {
  patientName?: string;
  patientNumber: number;
  windowName: string;
  // Family/Batch group support
  groupMembers?: Array<{ name: string | null; number: number }>;
  groupName?: string | null;
}

export class AudioSystem {
  private static instance: AudioSystem;
  private audioContext: AudioContext | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private forceHTMLAudio: boolean = false; // Force HTMLAudio mode for TV displays
  private audioQueue: Array<{ callInfo: CallInfo; settings: AudioSettings }> = [];
  private isPlayingSequence: boolean = false;
  
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
    { key: 'trumpet_fanfare_2293', name: 'Trumpet Fanfare (2293)', src: trumpetFanfare2293 },
    { key: 'klia_chime', name: 'KLIA Flight Announcement Chime', src: kliaChime }
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


  private static readonly roomTranslations: Record<string, { bm: string; en: string }> = {
    'bilik': { bm: 'Bilik', en: 'Room' },
    'room': { bm: 'Bilik', en: 'Room' },
    'kaunter': { bm: 'Kaunter', en: 'Counter' },
    'counter': { bm: 'Kaunter', en: 'Counter' },
    'konsultasi': { bm: 'Konsultasi', en: 'Consultation' },
    'consultation': { bm: 'Konsultasi', en: 'Consultation' },
    'farmasi': { bm: 'Farmasi', en: 'Pharmacy' },
    'pharmacy': { bm: 'Farmasi', en: 'Pharmacy' },
    'dispensari': { bm: 'Dispensari', en: 'Dispensary' },
    'dispensary': { bm: 'Dispensari', en: 'Dispensary' },
    'makmal': { bm: 'Makmal', en: 'Laboratory' },
    'laboratory': { bm: 'Makmal', en: 'Laboratory' },
    'lab': { bm: 'Makmal', en: 'Lab' },
    'pendaftaran': { bm: 'Pendaftaran', en: 'Registration' },
    'registration': { bm: 'Pendaftaran', en: 'Registration' },
    'x-ray': { bm: 'X-Ray', en: 'X-Ray' },
    'xray': { bm: 'X-Ray', en: 'X-Ray' },
    'rawatan': { bm: 'Rawatan', en: 'Treatment' },
    'treatment': { bm: 'Rawatan', en: 'Treatment' },
    'suntikan': { bm: 'Suntikan', en: 'Injection' },
    'injection': { bm: 'Suntikan', en: 'Injection' },
    'dewan': { bm: 'Dewan', en: 'Hall' },
    'hall': { bm: 'Dewan', en: 'Hall' },
    'doktor': { bm: 'Doktor', en: 'Doctor' },
    'doctor': { bm: 'Doktor', en: 'Doctor' },
    'dr': { bm: 'Dr', en: 'Dr' },
    'bilik rawatan': { bm: 'Bilik Rawatan', en: 'Treatment Room' },
    'treatment room': { bm: 'Bilik Rawatan', en: 'Treatment Room' },
    'bilik suntikan': { bm: 'Bilik Suntikan', en: 'Injection Room' },
    'injection room': { bm: 'Bilik Suntikan', en: 'Injection Room' },
  };

  private translateRoomName(windowName: string, targetLang: 'ms-MY' | 'en-US'): string {
    if (!windowName) return '';
    const lower = windowName.toLowerCase().trim();

    const sortedKeys = Object.keys(AudioSystem.roomTranslations).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
      const regex = new RegExp(`^${key.replace(/[-/]/g, '\\$&')}\\b`, 'i');
      if (regex.test(lower)) {
        const translation = AudioSystem.roomTranslations[key];
        const translated = targetLang === 'ms-MY' ? translation.bm : translation.en;
        const suffix = windowName.substring(key.length).trim();
        return suffix ? `${translated} ${suffix}` : translated;
      }
    }

    return windowName;
  }

  private currentPronunciations: TtsPronunciationRule[] = [];

  private applyPronunciations(text: string, lang: 'ms-MY' | 'en-US'): string {
    if (!this.currentPronunciations || this.currentPronunciations.length === 0) {
      console.log('[TTS] No pronunciation rules to apply');
      return text;
    }
    let result = text;
    const sorted = [...this.currentPronunciations].sort((a, b) => b.original.length - a.original.length);
    console.log(`[TTS] Applying ${sorted.length} pronunciation rules to: "${text}" (lang: ${lang})`);
    for (const rule of sorted) {
      const replacement = lang === 'en-US' ? rule.replacementEN : rule.replacementBM;
      if (!rule.original || !replacement) {
        console.log(`[TTS] Skipping rule: original="${rule.original}", replacement="${replacement}"`);
        continue;
      }
      const escaped = rule.original.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      const before = result;
      result = result.replace(regex, replacement);
      if (before !== result) {
        console.log(`[TTS] Rule applied: "${rule.original}" → "${replacement}" | Result: "${result}"`);
      }
    }
    console.log(`[TTS] Final text after pronunciations: "${result}"`);
    return result;
  }

  private buildTtsText(callInfo: CallInfo, lang: 'ms-MY' | 'en-US'): string {
    const room = this.translateRoomName(callInfo.windowName || '', lang);

    let text: string;

    // Family/Batch group: multiple names
    if (callInfo.groupMembers && callInfo.groupMembers.length > 1) {
      const names = callInfo.groupMembers.map(m => getTtsName(m.name, lang));
      if (lang === 'ms-MY') {
        const namesPart = names.length === 2
          ? `${names[0]} dan ${names[1]}`
          : names.length > 2
            ? names.slice(0, -1).join(', ') + ` dan ${names[names.length - 1]}`
            : names[0];
        text = `${namesPart}, sila ke ${room}`;
      } else {
        const namesPart = names.length === 2
          ? `${names[0]} and ${names[1]}`
          : names.length > 2
            ? names.slice(0, -1).join(', ') + ` and ${names[names.length - 1]}`
            : names[0];
        text = `${namesPart}, please proceed to ${room}`;
      }
    } else {
      // Single patient
      const name = getTtsName(callInfo.patientName, lang);
      if (lang === 'ms-MY') {
        const parts: string[] = [];
        if (name) parts.push(name);
        if (room) parts.push(`sila ke ${room}`);
        text = parts.join(', ');
      } else {
        const parts: string[] = [];
        if (name) parts.push(name);
        if (room) parts.push(`please proceed to ${room}`);
        text = parts.join(', ');
      }
    }

    console.log(`[TTS] buildTtsText: raw="${callInfo.patientName}" groupMembers=${callInfo.groupMembers?.length || 0} → text="${text}" | pronunciations loaded: ${this.currentPronunciations?.length || 0}`);
    return this.applyPronunciations(text, lang);
  }

  private currentGender: TtsVoiceGenderType = 'FEMALE';

  private async synthesizeFromServer(text: string, language: 'ms-MY' | 'en-US'): Promise<string> {
    const response = await fetch('/api/tts/synthesize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, gender: this.currentGender }),
    });

    if (!response.ok) {
      throw new Error(`TTS server error: ${response.status}`);
    }

    const data = await response.json();
    return data.audioContent;
  }

  private async playBase64Audio(base64Audio: string, volume: number): Promise<void> {
    const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

    if (this.forceHTMLAudio) {
      return await this.playAudioWithHTMLAudio(audioUrl, volume);
    }

    try {
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const audioContext = this.getAudioContext();
      if (audioContext.state === 'suspended') {
        return await this.playAudioWithHTMLAudio(audioUrl, volume);
      }

      const audioBuffer = await audioContext.decodeAudioData(bytes.buffer);
      const source = audioContext.createBufferSource();
      const gainNode = audioContext.createGain();

      source.buffer = audioBuffer;
      source.connect(gainNode);
      gainNode.connect(audioContext.destination);
      gainNode.gain.value = volume / 100;

      return new Promise((resolve, reject) => {
        source.onended = () => resolve();
        try {
          source.start();
        } catch {
          this.playAudioWithHTMLAudio(audioUrl, volume).then(resolve).catch(reject);
        }
      });
    } catch {
      return await this.playAudioWithHTMLAudio(audioUrl, volume);
    }
  }

  private async prefetchTtsAudio(callInfo: CallInfo, settings: AudioSettings): Promise<Array<{ content: string }> | null> {
    const lang = settings.ttsLanguage || 'ms-MY';
    this.currentGender = settings.ttsVoiceGender || 'FEMALE';
    this.currentPronunciations = settings.ttsPronunciations || [];
    try {
      if (lang === 'both') {
        const [msAudio, enAudio] = await Promise.all([
          this.synthesizeFromServer(this.buildTtsText(callInfo, 'ms-MY'), 'ms-MY'),
          this.synthesizeFromServer(this.buildTtsText(callInfo, 'en-US'), 'en-US'),
        ]);
        return [{ content: msAudio }, { content: enAudio }];
      } else {
        const audio = await this.synthesizeFromServer(this.buildTtsText(callInfo, lang), lang);
        return [{ content: audio }];
      }
    } catch (error) {
      console.error('TTS prefetch error:', error);
      return null;
    }
  }

  public async playTts(callInfo: CallInfo, settings: AudioSettings): Promise<void> {
    if (!settings.ttsEnabled) return;

    const lang = settings.ttsLanguage || 'ms-MY';
    this.currentGender = settings.ttsVoiceGender || 'FEMALE';
    this.currentPronunciations = settings.ttsPronunciations || [];

    try {
      if (lang === 'both') {
        const msText = this.buildTtsText(callInfo, 'ms-MY');
        const msAudio = await this.synthesizeFromServer(msText, 'ms-MY');
        await this.playBase64Audio(msAudio, settings.volume);
        await new Promise(r => setTimeout(r, 600));
        const enText = this.buildTtsText(callInfo, 'en-US');
        const enAudio = await this.synthesizeFromServer(enText, 'en-US');
        await this.playBase64Audio(enAudio, settings.volume);
      } else {
        const text = this.buildTtsText(callInfo, lang);
        const audio = await this.synthesizeFromServer(text, lang);
        await this.playBase64Audio(audio, settings.volume);
      }
    } catch (error) {
      console.error('TTS playback error:', error);
    }
  }

  public async playCallingSequence(callInfo: CallInfo, settings: AudioSettings): Promise<void> {
    this.audioQueue.push({ callInfo, settings });
    if (!this.isPlayingSequence) {
      await this.processAudioQueue();
    }
  }

  private async processAudioQueue(): Promise<void> {
    if (this.isPlayingSequence || this.audioQueue.length === 0) return;
    this.isPlayingSequence = true;

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift()!;
      try {
        if (item.settings.enableSound && item.settings.ttsEnabled) {
          const ttsPromise = this.prefetchTtsAudio(item.callInfo, item.settings);
          await this.playNotificationSound(item.settings);
          const ttsData = await ttsPromise;
          if (ttsData) {
            for (const audio of ttsData) {
              await this.playBase64Audio(audio.content, item.settings.volume);
              if (ttsData.indexOf(audio) < ttsData.length - 1) {
                await new Promise(r => setTimeout(r, 600));
              }
            }
          }
        } else if (item.settings.enableSound) {
          await this.playNotificationSound(item.settings);
        } else if (item.settings.ttsEnabled) {
          await this.playTts(item.callInfo, item.settings);
        }
        if (this.audioQueue.length > 0) {
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (error) {
        console.error('Error in calling sequence:', error);
      }
    }

    this.isPlayingSequence = false;
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

  public async playTestSequence(settings: AudioSettings): Promise<void> {
    const testCallInfo: CallInfo = {
      patientName: "Ahmad Bin Ali",
      patientNumber: 123,
      windowName: "Kaunter 1"
    };

    return this.playCallingSequence(testCallInfo, settings);
  }

  public async playTestTts(settings: AudioSettings, customCallInfo?: Partial<CallInfo>): Promise<void> {
    const testCallInfo: CallInfo = {
      patientName: customCallInfo?.patientName ?? "Ahmad Bin Ali",
      patientNumber: customCallInfo?.patientNumber ?? 0,
      windowName: customCallInfo?.windowName ?? "Bilik 1"
    };

    await this.playTts(testCallInfo, { ...settings, ttsEnabled: true });
  }

  public async playTestSound(settings: AudioSettings): Promise<void> {
    return this.playNotificationSound(settings);
  }

  public getAvailableTtsVoices(): Array<{lang: string, name: string}> {
    return [
      { lang: 'ms-MY', name: 'Yasmin (BM - Perempuan)' },
      { lang: 'ms-MY', name: 'Osman (BM - Lelaki)' },
      { lang: 'en-US', name: 'Jenny (EN - Female)' },
      { lang: 'en-US', name: 'Guy (EN - Male)' },
    ];
  }
}

// Export singleton instance
export const audioSystem = AudioSystem.getInstance();