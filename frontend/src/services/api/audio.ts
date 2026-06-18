import api from './client';

// ========================
// AUDIO GUIDES (TTS)
// ========================

export interface AudioGuideResult {
  success: boolean;
  audio_base64?: string;
  audio_format?: string;
  voice?: string;
  speed?: number;
  model?: string;
  cached?: boolean;
  duration_estimate_seconds?: number;
  poi_id?: string;
  poi_name?: string;
  language?: string;
  error?: string;
  audio_available?: boolean;
  // Graceful fallback: when no remote TTS provider is configured the backend
  // returns the narration text so the client can read it with on-device speech.
  text?: string;
  fallback?: string;
  tts_provider?: string | null;
}

export interface AudioVoice {
  id: string;
  name: string;
  description: string;
  best_for: string[];
}

export interface AudioVoicesResponse {
  voices: AudioVoice[];
  models: { id: string; name: string; description: string }[];
  speeds: { id: string; value: number; description: string }[];
  supported_languages: string[];
}

export const generateAudioGuide = async (
  text: string,
  poiName: string,
  poiId: string,
  category?: string,
  language?: string,
  useHd?: boolean,
  speed?: string
): Promise<AudioGuideResult> => {
  const response = await api.post('/audio/generate', {
    text,
    poi_name: poiName,
    poi_id: poiId,
    category,
    language: language || 'pt',
    use_hd: useHd || false,
    speed: speed || 'normal',
  });
  return response.data;
};

export const getAudioGuideForItem = async (
  itemId: string,
  useHd?: boolean,
  speed?: string
): Promise<AudioGuideResult> => {
  const response = await api.get(`/audio/guide/${itemId}`, {
    params: { use_hd: useHd, speed },
  });
  return response.data;
};

export const getAvailableVoices = async (): Promise<AudioVoicesResponse> => {
  const response = await api.get('/audio/voices');
  return response.data;
};
