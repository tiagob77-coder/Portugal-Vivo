import axios from 'axios';
import { Platform } from 'react-native';
import {
  getMunicipalPlans,
  getMySubscription,
  getMyImpact,
  downloadMonthlyReport,
  getMyProfile,
  updateMyProfile,
  getFeaturedAudioGuides,
  featureAudioGuide,
  unfeatureAudioGuide,
  getPartnerPois,
  getPartnerMunicipalities,
  getPublicMunicipality,
  getApiErrorStatus,
  getApiErrorMessage,
  countryLabel,
  prettifyMunicipalitySlug,
  formatCount,
} from '../api/municipal';

// Mock axios (same convention as api.test.ts)
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

describe('municipal API service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getMunicipalPlans hits the public catalogue', async () => {
    const payload = { plans: [{ id: 'essencial', price_eur_year: 2900 }], setup_fee_eur: 2500, pilot_months: 3 };
    mockAxios.get.mockResolvedValueOnce({ data: payload });
    await expect(getMunicipalPlans()).resolves.toEqual(payload);
    expect(mockAxios.get).toHaveBeenCalledWith('/municipal/plans');
  });

  it('getMySubscription returns the subscription payload', async () => {
    const payload = { municipality_id: 'arcos-de-valdevez', active: true, subscription: { plan: 'territorio', status: 'pilot' } };
    mockAxios.get.mockResolvedValueOnce({ data: payload });
    await expect(getMySubscription()).resolves.toEqual(payload);
    expect(mockAxios.get).toHaveBeenCalledWith('/municipal/me/subscription');
  });

  it('getMySubscription propagates 403 errors', async () => {
    const err = Object.assign(new Error('Forbidden'), { response: { status: 403, data: { detail: 'Utilizador sem município associado' } } });
    mockAxios.get.mockRejectedValueOnce(err);
    await expect(getMySubscription()).rejects.toBe(err);
  });

  it('getMyImpact sends only the defined date params', async () => {
    mockAxios.get.mockResolvedValue({ data: { totals: {} } });
    await getMyImpact({ from: '2026-09-15', to: '2026-10-14' });
    expect(mockAxios.get).toHaveBeenLastCalledWith('/municipal/me/impact', {
      params: { from: '2026-09-15', to: '2026-10-14' },
    });
    await getMyImpact();
    expect(mockAxios.get).toHaveBeenLastCalledWith('/municipal/me/impact', { params: {} });
  });

  it('profile get / update use the tenant endpoints', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: { municipality_id: 'x', profile: null } });
    await expect(getMyProfile()).resolves.toEqual({ municipality_id: 'x', profile: null });
    expect(mockAxios.get).toHaveBeenCalledWith('/municipal/me/profile');

    const body = { display_name: 'Arcos de Valdevez', featured_poi_ids: ['p1'], featured_route_ids: [] };
    mockAxios.put.mockResolvedValueOnce({ data: body });
    await expect(updateMyProfile(body)).resolves.toEqual(body);
    expect(mockAxios.put).toHaveBeenCalledWith('/municipal/me/profile', body);
  });

  it('audio guide endpoints', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: { items: [], used: 0, max: 10 } });
    await expect(getFeaturedAudioGuides()).resolves.toEqual({ items: [], used: 0, max: 10 });
    expect(mockAxios.get).toHaveBeenCalledWith('/municipal/me/audio-guides');

    mockAxios.post.mockResolvedValueOnce({ data: { poi_id: 'p 1', featured: true, used: 1, max: 10 } });
    await featureAudioGuide('p 1');
    expect(mockAxios.post).toHaveBeenCalledWith('/municipal/me/audio-guides/p%201');

    mockAxios.delete.mockResolvedValueOnce({ status: 204 });
    await expect(unfeatureAudioGuide('p1')).resolves.toBeUndefined();
    expect(mockAxios.delete).toHaveBeenCalledWith('/municipal/me/audio-guides/p1');
  });

  it('getPartnerPois forwards paging params', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: { pois: [], items: [], total: 0 } });
    await getPartnerPois({ page_size: 100 });
    expect(mockAxios.get).toHaveBeenCalledWith('/partner/pois', { params: { page_size: 100 } });
  });

  it('public municipality endpoints', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: { municipalities: [], total: 0 } });
    await expect(getPartnerMunicipalities()).resolves.toEqual({ municipalities: [], total: 0 });
    expect(mockAxios.get).toHaveBeenCalledWith('/municipios');

    mockAxios.get.mockResolvedValueOnce({ data: { slug: 'porto' } });
    await getPublicMunicipality('porto');
    expect(mockAxios.get).toHaveBeenLastCalledWith('/municipios/porto');
  });

  describe('downloadMonthlyReport', () => {
    const originalOS = Platform.OS;
    afterEach(() => {
      (Platform as any).OS = originalOS;
    });

    it('rejects malformed periods without calling the API', async () => {
      await expect(downloadMonthlyReport('2026-13')).rejects.toThrow('Período inválido');
      await expect(downloadMonthlyReport('outubro')).rejects.toThrow('Período inválido');
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('returns false on native without a request', async () => {
      (Platform as any).OS = 'ios';
      await expect(downloadMonthlyReport('2026-09')).resolves.toBe(false);
      expect(mockAxios.get).not.toHaveBeenCalled();
    });

    it('downloads the blob on web through an anchor element', async () => {
      (Platform as any).OS = 'web';
      const click = jest.fn();
      const anchor: any = { click, style: {} };
      const g: any = globalThis as any;
      const originalDocument = g.document;
      const originalURL = g.URL;
      g.document = {
        createElement: jest.fn(() => anchor),
        body: { appendChild: jest.fn(), removeChild: jest.fn() },
      };
      g.URL = { createObjectURL: jest.fn(() => 'blob:report'), revokeObjectURL: jest.fn() };
      jest.useFakeTimers();
      try {
        const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
        mockAxios.get.mockResolvedValueOnce({
          data: blob,
          headers: { 'content-disposition': 'attachment; filename="portugal-vivo-impacto-porto-2026-09.pdf"' },
        });
        await expect(downloadMonthlyReport('2026-09')).resolves.toBe(true);
        expect(mockAxios.get).toHaveBeenCalledWith('/municipal/me/reports/2026-09.pdf', {
          responseType: 'blob',
          timeout: 60000,
        });
        expect(anchor.download).toBe('portugal-vivo-impacto-porto-2026-09.pdf');
        expect(anchor.href).toBe('blob:report');
        expect(click).toHaveBeenCalled();
        jest.runAllTimers();
        expect(g.URL.revokeObjectURL).toHaveBeenCalledWith('blob:report');
      } finally {
        jest.useRealTimers();
        g.document = originalDocument;
        g.URL = originalURL;
      }
    });

    it('decodes JSON error bodies returned as Blob', async () => {
      (Platform as any).OS = 'web';
      const g: any = globalThis as any;
      const originalDocument = g.document;
      g.document = g.document ?? {};
      try {
        const body = new Blob([JSON.stringify({ detail: 'Funcionalidade incluída nos planos municipais.' })], {
          type: 'application/json',
        });
        // jsdom/node Blobs may lack .text(); provide it for the decoder.
        if (typeof (body as any).text !== 'function') {
          (body as any).text = () => Promise.resolve(JSON.stringify({ detail: 'Funcionalidade incluída nos planos municipais.' }));
        }
        const err: any = Object.assign(new Error('Payment Required'), { response: { status: 402, data: body } });
        mockAxios.get.mockRejectedValueOnce(err);
        await expect(downloadMonthlyReport('2026-09')).rejects.toBe(err);
        expect(getApiErrorStatus(err)).toBe(402);
        expect(getApiErrorMessage(err, 'x')).toBe('Funcionalidade incluída nos planos municipais.');
      } finally {
        g.document = originalDocument;
      }
    });
  });

  describe('helpers', () => {
    it('getApiErrorMessage handles string, array and missing details', () => {
      expect(getApiErrorMessage({ response: { data: { detail: 'Quota esgotada' } } }, 'fallback')).toBe('Quota esgotada');
      expect(
        getApiErrorMessage(
          { response: { data: { detail: [{ loc: ['body', 'brand_color'], msg: 'Value error, brand_color deve ser #RRGGBB' }] } } },
          'fallback',
        ),
      ).toBe('brand_color: brand_color deve ser #RRGGBB');
      expect(getApiErrorMessage(new Error('Network Error'), 'fallback')).toBe('fallback');
      expect(getApiErrorStatus(new Error('Network Error'))).toBeUndefined();
    });

    it('countryLabel maps common codes to Portuguese names', () => {
      expect(countryLabel('PT')).toBe('Portugal');
      expect(countryLabel('gb')).toBe('Reino Unido');
      expect(countryLabel('ZZ')).toBe('Desconhecida');
      expect(countryLabel('JP')).toBe('JP');
    });

    it('prettifyMunicipalitySlug and formatCount', () => {
      expect(prettifyMunicipalitySlug('arcos-de-valdevez')).toBe('Arcos de Valdevez');
      expect(prettifyMunicipalitySlug('vila_nova_de_gaia')).toBe('Vila Nova de Gaia');
      expect(formatCount(1234567)).toBe('1 234 567');
      expect(formatCount(42)).toBe('42');
      expect(formatCount(undefined)).toBe('—');
    });
  });
});
