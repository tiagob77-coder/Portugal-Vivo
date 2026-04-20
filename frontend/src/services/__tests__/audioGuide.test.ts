// @ts-nocheck
/**
 * Tests for the AudioGuide Service
 * Covers: play, pause, stop, settings persistence, error handling
 */

// In-memory AsyncStorage mock
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

// Mock expo-speech
const mockSpeak = jest.fn((_text: string, options?: any) => {
  // Simulate async completion
  if (options?.onDone) setTimeout(options.onDone, 0);
  return Promise.resolve();
});
const mockStop = jest.fn(() => Promise.resolve());
const mockGetAvailableVoicesAsync = jest.fn(() =>
  Promise.resolve([
    { identifier: 'pt-PT', name: 'Portuguese', language: 'pt-PT', quality: 300 },
    { identifier: 'pt-BR', name: 'Portuguese Brazil', language: 'pt-BR', quality: 300 },
    { identifier: 'en-US', name: 'English', language: 'en-US', quality: 300 },
  ])
);

jest.mock('expo-speech', () => ({
  speak: mockSpeak,
  stop: mockStop,
  getAvailableVoicesAsync: mockGetAvailableVoicesAsync,
  __esModule: true,
}));

// Helper to create a fresh service instance (avoids singleton state bleed)
function createFreshService() {
  jest.resetModules();

  jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] || null)),
      setItem: jest.fn((key: string, value: string) => {
        mockStorage[key] = value;
        return Promise.resolve();
      }),
      removeItem: jest.fn((key: string) => {
        delete mockStorage[key];
        return Promise.resolve();
      }),
    },
  }));

  jest.mock('expo-speech', () => ({
    speak: mockSpeak,
    stop: mockStop,
    getAvailableVoicesAsync: mockGetAvailableVoicesAsync,
    __esModule: true,
  }));

  const mod = require('../audioGuide');
  return mod.audioGuideService;
}

describe('AudioGuideService', () => {
  let service: any;

  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    jest.clearAllMocks();
    // Reset speak mock to default (successful) behaviour
    mockSpeak.mockImplementation((_text: string, options?: any) => {
      if (options?.onDone) setTimeout(options.onDone, 0);
      return Promise.resolve();
    });
    mockStop.mockResolvedValue(undefined);
    service = createFreshService();
  });

  // ──────────────────────────────────────────────
  // Default settings
  // ──────────────────────────────────────────────
  describe('getSettings', () => {
    it('returns default settings on fresh instance', () => {
      const settings = service.getSettings();
      expect(settings.language).toBe('pt-PT');
      expect(settings.rate).toBeCloseTo(0.9);
      expect(settings.pitch).toBeCloseTo(1.0);
      expect(settings.autoPlay).toBe(false);
      expect(settings.volume).toBeCloseTo(1.0);
    });
  });

  // ──────────────────────────────────────────────
  // updateSettings / persistence
  // ──────────────────────────────────────────────
  describe('updateSettings', () => {
    it('merges partial settings correctly', async () => {
      await service.updateSettings({ rate: 1.5, autoPlay: true });
      const settings = service.getSettings();
      expect(settings.rate).toBeCloseTo(1.5);
      expect(settings.autoPlay).toBe(true);
      // Other defaults preserved
      expect(settings.language).toBe('pt-PT');
    });

    it('persists settings to AsyncStorage', async () => {
      await service.updateSettings({ language: 'en-GB' });
      const raw = mockStorage['audio_guide_settings'];
      expect(raw).toBeDefined();
      const stored = JSON.parse(raw);
      expect(stored.language).toBe('en-GB');
    });

    it('loads persisted settings on a fresh instance', async () => {
      // Pre-load settings in storage
      mockStorage['audio_guide_settings'] = JSON.stringify({
        language: 'en-US',
        rate: 1.2,
        pitch: 0.8,
        autoPlay: true,
        volume: 0.5,
      });

      service = createFreshService();
      // Allow the async constructor to finish loading
      await new Promise(r => setTimeout(r, 50));

      const settings = service.getSettings();
      expect(settings.language).toBe('en-US');
      expect(settings.rate).toBeCloseTo(1.2);
      expect(settings.autoPlay).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // play
  // ──────────────────────────────────────────────
  describe('play', () => {
    it('calls Speech.speak with the provided text', async () => {
      await service.play('poi-1', 'Welcome to Sintra!');
      expect(mockSpeak).toHaveBeenCalledWith(
        'Welcome to Sintra!',
        expect.objectContaining({ language: 'pt-PT' })
      );
    });

    it('sets isSpeaking to true immediately after play starts', async () => {
      // speak won't call onDone synchronously in this setup
      mockSpeak.mockImplementation(() => Promise.resolve());
      await service.play('poi-1', 'Some text');
      expect(service.isSpeaking()).toBe(true);
    });

    it('sets currentPoiId to the played POI', async () => {
      mockSpeak.mockImplementation(() => Promise.resolve());
      await service.play('poi-abc', 'Text');
      expect(service.getCurrentPoiId()).toBe('poi-abc');
    });

    it('calls onStart callback before speaking', async () => {
      const onStart = jest.fn();
      await service.play('poi-1', 'Text', { onStart });
      expect(onStart).toHaveBeenCalled();
    });

    it('strips HTML tags from text before speaking', async () => {
      await service.play('poi-1', '<p>Hello <b>World</b></p>');
      expect(mockSpeak).toHaveBeenCalledWith(
        'Hello World',
        expect.anything()
      );
    });

    it('caches the narrative for the POI', async () => {
      await service.play('poi-cache', 'Narrative text');
      expect(service.getCachedCount()).toBe(1);
    });

    it('stops current playback before starting a new one', async () => {
      mockSpeak.mockImplementation(() => Promise.resolve()); // never calls onDone
      await service.play('poi-1', 'First');
      await service.play('poi-2', 'Second');
      expect(mockStop).toHaveBeenCalled();
    });

    it('handles Speech.speak error via onError callback', async () => {
      mockSpeak.mockRejectedValueOnce(new Error('TTS unavailable'));
      const onError = jest.fn();
      await service.play('poi-err', 'Text', { onError });
      expect(onError).toHaveBeenCalledWith('TTS unavailable');
      expect(service.isSpeaking()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // stop
  // ──────────────────────────────────────────────
  describe('stop', () => {
    it('calls Speech.stop and resets state', async () => {
      mockSpeak.mockImplementation(() => Promise.resolve());
      await service.play('poi-1', 'Text');
      await service.stop();
      expect(mockStop).toHaveBeenCalled();
      expect(service.isSpeaking()).toBe(false);
      expect(service.getCurrentPoiId()).toBeNull();
    });

    it('handles Speech.stop error gracefully', async () => {
      mockStop.mockRejectedValueOnce(new Error('Stop failed'));
      await expect(service.stop()).resolves.not.toThrow();
      expect(service.isSpeaking()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // pause (delegates to stop in expo-speech)
  // ──────────────────────────────────────────────
  describe('pause', () => {
    it('calls stop because expo-speech has no pause support', async () => {
      mockSpeak.mockImplementation(() => Promise.resolve());
      await service.play('poi-1', 'Text');
      await service.pause();
      expect(mockStop).toHaveBeenCalled();
      expect(service.isSpeaking()).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // playCached
  // ──────────────────────────────────────────────
  describe('playCached', () => {
    it('returns false when no cached narrative exists', async () => {
      const result = await service.playCached('non-existent-poi');
      expect(result).toBe(false);
    });

    it('returns true and plays when cached narrative exists', async () => {
      mockSpeak.mockImplementation(() => Promise.resolve());
      await service.play('poi-1', 'Cached text');
      mockSpeak.mockClear();

      const result = await service.playCached('poi-1');
      expect(result).toBe(true);
      expect(mockSpeak).toHaveBeenCalledWith(
        'Cached text',
        expect.anything()
      );
    });
  });

  // ──────────────────────────────────────────────
  // clearCache
  // ──────────────────────────────────────────────
  describe('clearCache', () => {
    it('empties the in-memory cache', async () => {
      await service.play('poi-1', 'Text');
      expect(service.getCachedCount()).toBe(1);
      await service.clearCache();
      expect(service.getCachedCount()).toBe(0);
    });

    it('removes the cache key from AsyncStorage', async () => {
      await service.play('poi-1', 'Text');
      await service.clearCache();
      expect(mockStorage['audio_cached_narratives']).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // getAvailableVoices
  // ──────────────────────────────────────────────
  describe('getAvailableVoices', () => {
    it('returns Portuguese voices when available', async () => {
      const voices = await service.getAvailableVoices();
      // Our mock returns 2 pt voices and 1 en voice; service filters to pt
      expect(voices.length).toBe(2);
      voices.forEach((v: any) => expect(v.language).toMatch(/^pt/));
    });

    it('returns all voices when no Portuguese voices found', async () => {
      mockGetAvailableVoicesAsync.mockResolvedValueOnce([
        { identifier: 'en-US', name: 'English', language: 'en-US', quality: 300 },
        { identifier: 'fr-FR', name: 'French', language: 'fr-FR', quality: 300 },
      ]);
      const voices = await service.getAvailableVoices();
      expect(voices.length).toBe(2);
    });

    it('returns empty array when Speech.getAvailableVoicesAsync throws', async () => {
      mockGetAvailableVoicesAsync.mockRejectedValueOnce(new Error('Not available'));
      const voices = await service.getAvailableVoices();
      expect(voices).toEqual([]);
    });
  });

  // ──────────────────────────────────────────────
  // isAvailable
  // ──────────────────────────────────────────────
  describe('isAvailable', () => {
    it('returns true when voices are available', async () => {
      const available = await service.isAvailable();
      expect(available).toBe(true);
    });

    it('returns false when no voices are returned', async () => {
      mockGetAvailableVoicesAsync.mockResolvedValueOnce([]);
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });

    it('returns false when getAvailableVoicesAsync throws', async () => {
      mockGetAvailableVoicesAsync.mockRejectedValueOnce(new Error('Unavailable'));
      const available = await service.isAvailable();
      expect(available).toBe(false);
    });
  });

  // ──────────────────────────────────────────────
  // generateIntroduction
  // ──────────────────────────────────────────────
  describe('generateIntroduction', () => {
    const basePoi = {
      name: 'Termas de Monchique',
      category: 'termas',
      description: 'Famous thermal spa in the Algarve mountains.',
    };

    it('includes the POI name and category intro', () => {
      const text = service.generateIntroduction(basePoi);
      expect(text).toContain('Termas de Monchique');
      expect(text).toContain('Bem-vindo às termas');
    });

    it('includes address when provided', () => {
      const text = service.generateIntroduction({ ...basePoi, address: 'Monchique, Algarve' });
      expect(text).toContain('Monchique, Algarve');
    });

    it('includes special tags when present', () => {
      const text = service.generateIntroduction({
        ...basePoi,
        tags: ['Bandeira Azul', 'outro-tag'],
      });
      expect(text).toContain('Bandeira Azul');
    });

    it('includes metadata temperature when present', () => {
      const text = service.generateIntroduction({
        ...basePoi,
        metadata: { temperature: '32°C' },
      });
      expect(text).toContain('32°C');
    });

    it('uses generic intro for unknown category', () => {
      const text = service.generateIntroduction({ ...basePoi, category: 'unknown_cat' });
      expect(text).toContain('Bem-vindo a este ponto de interesse');
    });
  });

  // ──────────────────────────────────────────────
  // generateWelcomeMessage
  // ──────────────────────────────────────────────
  describe('generateWelcomeMessage', () => {
    it('includes the username when provided', () => {
      const message = service.generateWelcomeMessage('João');
      expect(message).toContain('João');
      expect(message).toContain('Portugal Vivo');
    });

    it('works without a username', () => {
      const message = service.generateWelcomeMessage();
      expect(message).toContain('Portugal Vivo');
    });

    it('includes nearest POI info when provided', () => {
      const message = service.generateWelcomeMessage('Ana', {
        name: 'Cascata do Arado',
        distance: 0.5,
        category: 'cascatas',
      });
      expect(message).toContain('Cascata do Arado');
      expect(message).toContain('500 metros');
    });

    it('shows distance in km when >= 1km', () => {
      const message = service.generateWelcomeMessage(undefined, {
        name: 'Miradouro do Gerês',
        distance: 3.2,
        category: 'miradouros',
      });
      expect(message).toContain('3.2 quilómetros');
    });
  });

  // ──────────────────────────────────────────────
  // speakQuick
  // ──────────────────────────────────────────────
  describe('speakQuick', () => {
    it('calls Speech.speak at a slightly higher rate', async () => {
      await service.speakQuick('Quick message');
      expect(mockSpeak).toHaveBeenCalledWith(
        'Quick message',
        expect.objectContaining({ language: 'pt-PT' })
      );
      // Rate should be slightly higher than default (0.9 * 1.1 ≈ 0.99)
      const callArgs = mockSpeak.mock.calls[0][1];
      expect(callArgs.rate).toBeGreaterThan(0.9);
    });
  });

  // ──────────────────────────────────────────────
  // AsyncStorage error handling
  // ──────────────────────────────────────────────
  describe('error handling', () => {
    it('handles AsyncStorage.setItem failure during saveSettings gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));
      await expect(service.updateSettings({ rate: 1.0 })).resolves.not.toThrow();
    });

    it('handles AsyncStorage.setItem failure during saveCachedNarratives gracefully', async () => {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      AsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));
      await expect(service.play('poi-1', 'Text')).resolves.not.toThrow();
    });
  });
});
