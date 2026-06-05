import api from './client';
import type { Stats } from '../../types';

// AI Narrative
export const generateNarrative = async (
  itemId: string,
  style: 'storytelling' | 'educational' | 'brief' = 'storytelling'
): Promise<{ narrative: string; item_name: string; generated_at: string }> => {
  const response = await api.post('/narrative', {
    item_id: itemId,
    style,
    language: 'pt',
  });
  return response.data;
};

// Content Strategy — depth-adapted narratives (snackable/historia/enciclopedico/criancas)
export type ContentDepth = 'snackable' | 'historia' | 'enciclopedico' | 'criancas';
export type CognitiveProfile = 'gourmet' | 'familia' | 'arquitetura' | 'natureza_radical' | 'historia_profunda' | 'criancas';

export const getDepthContent = async (
  poiId: string,
  depth: ContentDepth = 'snackable',
  cognitiveProfile?: CognitiveProfile,
): Promise<{
  poi_id: string; depth: string; cognitive_profile: string | null;
  content: string; generated_at: string; source: string;
  credibility: { source_type: string; confidence_level: number };
}> => {
  const response = await api.post('/content/depth', {
    poi_id: poiId,
    depth,
    cognitive_profile: cognitiveProfile || null,
    language: 'pt',
  });
  return response.data;
};

export const getMicroStories = async (
  poiIds: string[],
  cognitiveProfile?: CognitiveProfile,
  contextTrigger?: string,
): Promise<{
  stories: Array<{ poi_id: string; poi_name: string; text: string; estimated_read_seconds: number }>;
  total: number;
}> => {
  const response = await api.post('/content/micro-stories', {
    poi_ids: poiIds,
    cognitive_profile: cognitiveProfile || null,
    context_trigger: contextTrigger || null,
  });
  return response.data;
};

export const getCognitiveProfiles = async (): Promise<{
  profiles: Array<{ id: string; label: string; emoji: string; micro_story_hook: string }>;
}> => {
  const response = await api.get('/content/profiles');
  return response.data;
};

export const getDepthLevels = async (): Promise<{
  levels: Array<{ id: string; label: string; icon: string; read_time: string; description: string }>;
}> => {
  const response = await api.get('/content/depth-levels');
  return response.data;
};

// Stats
export const getStats = async (): Promise<Stats> => {
  const response = await api.get('/stats');
  return response.data;
};
