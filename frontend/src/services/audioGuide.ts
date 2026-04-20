/**
 * Audio Guide Service
 * Provides text-to-speech narration for POIs
 */

import * as Speech from 'expo-speech';
// import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
  AUDIO_SETTINGS: 'audio_guide_settings',
  CACHED_NARRATIVES: 'audio_cached_narratives',
};

interface AudioSettings {
  language: string;
  rate: number; // 0.5 to 2.0
  pitch: number; // 0.5 to 2.0
  autoPlay: boolean;
  volume: number; // 0 to 1
}

interface CachedNarrative {
  poiId: string;
  text: string;
  language: string;
  timestamp: number;
}

const DEFAULT_SETTINGS: AudioSettings = {
  language: 'pt-PT',
  rate: 0.9,
  pitch: 1.0,
  autoPlay: false,
  volume: 1.0,
};

class AudioGuideService {
  private settings: AudioSettings = DEFAULT_SETTINGS;
  private isPlaying: boolean = false;
  private currentPoiId: string | null = null;
  private cachedNarratives: Map<string, CachedNarrative> = new Map();

  constructor() {
    this.loadSettings();
    this.loadCachedNarratives();
  }

  /**
   * Load settings from storage
   */
  private async loadSettings(): Promise<void> {
    // Skip AsyncStorage in SSR context
    if (typeof window === 'undefined') return;
    
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.AUDIO_SETTINGS);
      if (raw) {
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch (error) {
      console.error('Error loading audio settings:', error);
    }
  }

  /**
   * Save settings to storage
   */
  private async saveSettings(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUDIO_SETTINGS, JSON.stringify(this.settings));
    } catch (error) {
      console.error('Error saving audio settings:', error);
    }
  }

  /**
   * Load cached narratives
   */
  private async loadCachedNarratives(): Promise<void> {
    // Skip AsyncStorage in SSR context
    if (typeof window === 'undefined') return;
    
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_NARRATIVES);
      if (raw) {
        const narratives: CachedNarrative[] = JSON.parse(raw);
        narratives.forEach(n => this.cachedNarratives.set(n.poiId, n));
      }
    } catch (error) {
      console.error('Error loading cached narratives:', error);
    }
  }

  /**
   * Save cached narratives
   */
  private async saveCachedNarratives(): Promise<void> {
    try {
      const narratives = Array.from(this.cachedNarratives.values());
      await AsyncStorage.setItem(STORAGE_KEYS.CACHED_NARRATIVES, JSON.stringify(narratives));
    } catch (error) {
      console.error('Error saving cached narratives:', error);
    }
  }

  /**
   * Get available voices
   */
  async getAvailableVoices(): Promise<Speech.Voice[]> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      // Filter for Portuguese voices
      const ptVoices = voices.filter(v => 
        v.language.startsWith('pt') || 
        v.language.includes('Portuguese')
      );
      return ptVoices.length > 0 ? ptVoices : voices;
    } catch (error) {
      console.error('Error getting voices:', error);
      return [];
    }
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings: Partial<AudioSettings>): Promise<void> {
    this.settings = { ...this.settings, ...newSettings };
    await this.saveSettings();
  }

  /**
   * Get current settings
   */
  getSettings(): AudioSettings {
    return { ...this.settings };
  }

  /**
   * Generate introduction text for a POI
   */
  generateIntroduction(poi: {
    name: string;
    category: string;
    description: string;
    address?: string;
    tags?: string[];
    metadata?: any;
  }): string {
    const categoryIntros: Record<string, string> = {
      termas: 'Bem-vindo às termas',
      piscinas: 'Bem-vindo a esta praia fluvial',
      miradouros: 'Bem-vindo a este miradouro',
      cascatas: 'Bem-vindo a esta cascata',
      aldeias: 'Bem-vindo a esta aldeia histórica',
      gastronomia: 'Bem-vindo a este ponto gastronómico',
      religioso: 'Bem-vindo a este local de património religioso',
      lendas: 'Bem-vindo a este local lendário',
      festas: 'Bem-vindo a este local de tradições',
    };

    const intro = categoryIntros[poi.category] || 'Bem-vindo a este ponto de interesse';
    
    let text = `${intro}. ${poi.name}. `;
    
    // Add location
    if (poi.address) {
      text += `Localizado em ${poi.address}. `;
    }
    
    // Add description
    text += poi.description;
    
    // Add special tags
    if (poi.tags && poi.tags.length > 0) {
      const specialTags = poi.tags.filter(t => 
        t.includes('Bandeira Azul') || 
        t.includes('qualidade') || 
        t.includes('acessível') ||
        t.includes('histórico')
      );
      if (specialTags.length > 0) {
        text += ` Este local é reconhecido por: ${specialTags.join(', ')}.`;
      }
    }
    
    // Add metadata info
    if (poi.metadata) {
      if (poi.metadata.founded) {
        text += ` Fundado em ${poi.metadata.founded}.`;
      }
      if (poi.metadata.temperature) {
        text += ` A água atinge temperaturas de ${poi.metadata.temperature}.`;
      }
      if (poi.metadata.specialties && Array.isArray(poi.metadata.specialties)) {
        text += ` Especializado em tratamentos de ${poi.metadata.specialties.join(' e ')}.`;
      }
    }
    
    return text;
  }

  /**
   * Play audio guide for a POI
   */
  async play(
    poiId: string,
    text: string,
    options?: {
      onStart?: () => void;
      onDone?: () => void;
      onError?: (error: string) => void;
      onPause?: () => void;
      onResume?: () => void;
    }
  ): Promise<void> {
    // Stop any current playback
    if (this.isPlaying) {
      await this.stop();
    }

    this.isPlaying = true;
    this.currentPoiId = poiId;

    // Cache the narrative
    this.cachedNarratives.set(poiId, {
      poiId,
      text,
      language: this.settings.language,
      timestamp: Date.now(),
    });
    await this.saveCachedNarratives();

    // Prepare text for speech (clean up any HTML or special characters)
    const cleanText = text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, 'e')
      .replace(/\s+/g, ' ')
      .trim();

    try {
      options?.onStart?.();

      await Speech.speak(cleanText, {
        language: this.settings.language,
        rate: this.settings.rate,
        pitch: this.settings.pitch,
        volume: this.settings.volume,
        onDone: () => {
          this.isPlaying = false;
          this.currentPoiId = null;
          options?.onDone?.();
        },
        onError: (error) => {
          this.isPlaying = false;
          this.currentPoiId = null;
          options?.onError?.(error.message || 'Unknown error');
        },
        onStopped: () => {
          this.isPlaying = false;
          this.currentPoiId = null;
        },
      });
    } catch (error: any) {
      this.isPlaying = false;
      this.currentPoiId = null;
      options?.onError?.(error.message || 'Failed to play audio');
    }
  }

  /**
   * Play cached narrative
   */
  async playCached(
    poiId: string,
    options?: {
      onStart?: () => void;
      onDone?: () => void;
      onError?: (error: string) => void;
    }
  ): Promise<boolean> {
    const cached = this.cachedNarratives.get(poiId);
    if (cached) {
      await this.play(poiId, cached.text, options);
      return true;
    }
    return false;
  }

  /**
   * Stop playback
   */
  async stop(): Promise<void> {
    try {
      await Speech.stop();
    } catch (error) {
      console.error('Error stopping speech:', error);
    }
    this.isPlaying = false;
    this.currentPoiId = null;
  }

  /**
   * Pause playback (note: pause is not supported in expo-speech, we stop instead)
   */
  async pause(): Promise<void> {
    // expo-speech doesn't support pause, so we just stop
    await this.stop();
  }

  /**
   * Check if currently playing
   */
  isSpeaking(): boolean {
    return this.isPlaying;
  }

  /**
   * Get current POI being narrated
   */
  getCurrentPoiId(): string | null {
    return this.currentPoiId;
  }

  /**
   * Check if speech is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Try to get voices to verify speech is available
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get cached narratives count
   */
  getCachedCount(): number {
    return this.cachedNarratives.size;
  }

  /**
   * Clear cached narratives
   */
  async clearCache(): Promise<void> {
    this.cachedNarratives.clear();
    await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_NARRATIVES);
  }

  /**
   * Generate contextual welcome message based on time and location
   */
  generateWelcomeMessage(
    userName?: string,
    nearestPOI?: { name: string; distance: number; category: string }
  ): string {
    const hour = new Date().getHours();
    let greeting = 'Olá';
    
    if (hour >= 5 && hour < 12) {
      greeting = 'Bom dia';
    } else if (hour >= 12 && hour < 19) {
      greeting = 'Boa tarde';
    } else {
      greeting = 'Boa noite';
    }

    let message = userName ? `${greeting}, ${userName}!` : `${greeting}!`;
    message += ' Bem-vindo ao Portugal Vivo.';

    if (nearestPOI) {
      const distanceText = nearestPOI.distance < 1 
        ? `${Math.round(nearestPOI.distance * 1000)} metros`
        : `${nearestPOI.distance.toFixed(1)} quilómetros`;
      
      message += ` O ponto de interesse mais próximo é ${nearestPOI.name}, a apenas ${distanceText} de distância.`;
    }

    return message;
  }

  /**
   * Speak a quick message
   */
  async speakQuick(text: string): Promise<void> {
    await Speech.speak(text, {
      language: this.settings.language,
      rate: this.settings.rate * 1.1, // Slightly faster for quick messages
      pitch: this.settings.pitch,
    });
  }
}

// Export singleton instance
export const audioGuideService = new AudioGuideService();
export default audioGuideService;
