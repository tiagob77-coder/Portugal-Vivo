/**
 * Unit tests — Narrative & Favorites API functions
 *
 * Covers: generateNarrative, addFavorite, removeFavorite, getAudioGuideForItem
 * Uses the same axios mock pattern as api.test.ts.
 */
import axios from 'axios';
import {
  generateNarrative,
  addFavorite,
  removeFavorite,
  getAudioGuideForItem,
} from '../api';

// ─── axios mock (same pattern as api.test.ts) ────────────────────────────────
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    create: jest.fn(() => mockInstance),
    __mockInstance: mockInstance,
  };
});

const mockAxios = (axios as any).__mockInstance;

// ─── generateNarrative ───────────────────────────────────────────────────────
describe('generateNarrative', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /narrative with correct payload (storytelling style)', async () => {
    const mockResponse = {
      narrative: 'Era uma vez um mosteiro...',
      item_name: 'Mosteiro da Batalha',
      generated_at: '2026-03-18T10:00:00Z',
    };
    mockAxios.post.mockResolvedValueOnce({ data: mockResponse });

    const result = await generateNarrative('poi-001', 'storytelling');

    expect(mockAxios.post).toHaveBeenCalledWith('/narrative', {
      item_id: 'poi-001',
      style: 'storytelling',
      language: 'pt',
    });
    expect(result.narrative).toBe('Era uma vez um mosteiro...');
    expect(result.item_name).toBe('Mosteiro da Batalha');
    expect(result).toHaveProperty('generated_at');
  });

  it('posts with educational style', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { narrative: 'Contexto histórico...', item_name: 'POI', generated_at: '' },
    });

    await generateNarrative('poi-002', 'educational');

    expect(mockAxios.post).toHaveBeenCalledWith('/narrative', {
      item_id: 'poi-002',
      style: 'educational',
      language: 'pt',
    });
  });

  it('posts with brief style (used for free resume)', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { narrative: 'Breve resumo.', item_name: 'POI', generated_at: '' },
    });

    await generateNarrative('poi-003', 'brief');

    expect(mockAxios.post).toHaveBeenCalledWith('/narrative', {
      item_id: 'poi-003',
      style: 'brief',
      language: 'pt',
    });
  });

  it('defaults to storytelling style when no style provided', async () => {
    mockAxios.post.mockResolvedValueOnce({
      data: { narrative: 'Default story...', item_name: 'POI', generated_at: '' },
    });

    await generateNarrative('poi-004');

    expect(mockAxios.post).toHaveBeenCalledWith('/narrative', {
      item_id: 'poi-004',
      style: 'storytelling',
      language: 'pt',
    });
  });

  it('returns narrative text in response', async () => {
    const narrative = 'A lenda da Ericeira começou com um ouriço...';
    mockAxios.post.mockResolvedValueOnce({
      data: { narrative, item_name: 'Ericeira', generated_at: '2026-03-18T12:00:00Z' },
    });

    const result = await generateNarrative('poi-ericeira', 'storytelling');
    expect(result.narrative).toBe(narrative);
  });

  it('propagates HTTP 429 rate-limit errors', async () => {
    const error = new Error('Too Many Requests');
    (error as any).response = { status: 429, data: { detail: 'Rate limit exceeded' } };
    mockAxios.post.mockRejectedValueOnce(error);

    await expect(generateNarrative('poi-001', 'storytelling')).rejects.toThrow('Too Many Requests');
  });

  it('propagates HTTP 401 unauthenticated errors', async () => {
    const error = new Error('Unauthorized');
    (error as any).response = { status: 401, data: { detail: 'Not authenticated' } };
    mockAxios.post.mockRejectedValueOnce(error);

    await expect(generateNarrative('poi-001', 'storytelling')).rejects.toThrow('Unauthorized');
  });
});

// ─── addFavorite ─────────────────────────────────────────────────────────────
describe('addFavorite', () => {
  beforeEach(() => jest.clearAllMocks());

  it('posts to /favorites/:id with auth token', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: { success: true } });

    await addFavorite('poi-001', 'test-session-token');

    expect(mockAxios.post).toHaveBeenCalledWith(
      '/favorites/poi-001',
      {},
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-session-token' }),
      })
    );
  });

  it('resolves without error on success', async () => {
    mockAxios.post.mockResolvedValueOnce({ data: undefined });
    // addFavorite returns void — just verify it doesn't throw
    await expect(addFavorite('poi-001', 'token')).resolves.toBeUndefined();
  });

  it('propagates 401 when token is invalid', async () => {
    const error = new Error('Unauthorized');
    (error as any).response = { status: 401 };
    mockAxios.post.mockRejectedValueOnce(error);

    await expect(addFavorite('poi-001', 'bad-token')).rejects.toThrow('Unauthorized');
  });

  it('propagates 409 when item already favorited', async () => {
    const error = new Error('Conflict');
    (error as any).response = { status: 409, data: { detail: 'Already favorited' } };
    mockAxios.post.mockRejectedValueOnce(error);

    await expect(addFavorite('poi-001', 'token')).rejects.toThrow();
  });
});

// ─── removeFavorite ──────────────────────────────────────────────────────────
describe('removeFavorite', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends DELETE to /favorites/:id with auth token', async () => {
    mockAxios.delete.mockResolvedValueOnce({ data: undefined });

    await removeFavorite('poi-001', 'test-session-token');

    expect(mockAxios.delete).toHaveBeenCalledWith(
      '/favorites/poi-001',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-session-token' }),
      })
    );
  });

  it('resolves without error on success', async () => {
    mockAxios.delete.mockResolvedValueOnce({ data: undefined });
    await expect(removeFavorite('poi-001', 'token')).resolves.toBeUndefined();
  });

  it('propagates 404 when item was not favorited', async () => {
    const error = new Error('Not Found');
    (error as any).response = { status: 404 };
    mockAxios.delete.mockRejectedValueOnce(error);

    await expect(removeFavorite('poi-not-fav', 'token')).rejects.toThrow();
  });
});

// ─── getAudioGuideForItem ────────────────────────────────────────────────────
describe('getAudioGuideForItem', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends GET to /audio/guide/:id', async () => {
    const mockAudio = {
      success: true,
      audio_base64: 'SGVsbG8gV29ybGQ=',
      duration: 12.5,
    };
    mockAxios.get.mockResolvedValueOnce({ data: mockAudio });

    const result = await getAudioGuideForItem('poi-001');

    expect(mockAxios.get).toHaveBeenCalledWith(
      '/audio/guide/poi-001',
      expect.objectContaining({ params: expect.objectContaining({}) })
    );
    expect(result.success).toBe(true);
    expect(result.audio_base64).toBeDefined();
  });

  it('passes use_hd and speed params when provided', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: { success: true, audio_base64: 'abc' } });

    await getAudioGuideForItem('poi-001', true, '1.2');

    expect(mockAxios.get).toHaveBeenCalledWith('/audio/guide/poi-001', {
      params: { use_hd: true, speed: '1.2' },
    });
  });

  it('returns error response when TTS service is unavailable', async () => {
    const mockFail = { success: false, error: 'TTS service unavailable' };
    mockAxios.get.mockResolvedValueOnce({ data: mockFail });

    const result = await getAudioGuideForItem('poi-001');
    expect(result.success).toBe(false);
    expect(result.error).toBe('TTS service unavailable');
  });

  it('propagates network errors', async () => {
    mockAxios.get.mockImplementationOnce(() => Promise.reject(new Error('Network Error')));

    await expect(getAudioGuideForItem('poi-001')).rejects.toThrow();
  });
});
