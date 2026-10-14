import axios from 'axios';
import {
  getApiPlans,
  createAccessRequest,
  listApiKeys,
  createApiKey,
  updateApiKey,
  revokeApiKey,
  listAccessRequests,
  getMunicipalPlans,
  listMunicipalSubscriptions,
  upsertMunicipalSubscription,
  partnerApiErrorMessage,
} from '../api/partnerApi';

// Mock axios
jest.mock('axios', () => {
  const mockInstance = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
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

describe('partnerApi — Partner API (B2B)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getApiPlans', () => {
    it('fetches the public plan catalogue', async () => {
      const payload = {
        plans: [
          {
            id: 'explorador', name: 'Explorador', price_eur_month: 0,
            price_eur_month_billed_annually: 0, monthly_quota: 500,
            features: ['heritage', 'map', 'routes'], sla: null, white_label: false,
          },
          {
            id: 'enterprise', name: 'Enterprise', price_eur_month: 500,
            price_eur_month_billed_annually: 400, monthly_quota: null,
            features: ['audio', 'events', 'heritage', 'map', 'narratives', 'routes', 'weather'],
            sla: 'personalizado', white_label: true,
          },
        ],
        annual_discount: 0.2, currency: 'EUR', vat_included: false, auth_header: 'X-API-Key',
      };
      mockAxios.get.mockResolvedValueOnce({ data: payload });

      const result = await getApiPlans();
      expect(mockAxios.get).toHaveBeenCalledWith('/v1/plans');
      expect(result.plans).toHaveLength(2);
      expect(result.plans[1].monthly_quota).toBeNull();
      expect(result.auth_header).toBe('X-API-Key');
    });

    it('propagates network errors', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Network Error'));
      await expect(getApiPlans()).rejects.toThrow('Network Error');
    });
  });

  describe('createAccessRequest', () => {
    const base = {
      org_name: 'Agência Lusa Tours',
      contact_name: 'Ana Silva',
      contact_email: 'ana@lusatours.pt',
      use_case: 'Integrar património na nossa app de viagens.',
      desired_plan: 'parceiro' as const,
    };

    it('posts the request and returns the pending id', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { request_id: 'req-1', status: 'pending' } });

      const result = await createAccessRequest({ ...base, website: 'https://lusatours.pt' });
      expect(mockAxios.post).toHaveBeenCalledWith('/v1/access-requests', {
        ...base, website: 'https://lusatours.pt',
      });
      expect(result).toEqual({ request_id: 'req-1', status: 'pending' });
    });

    it('omits an empty website', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { request_id: 'req-2', status: 'pending' } });

      await createAccessRequest({ ...base, website: '' });
      expect(mockAxios.post).toHaveBeenCalledWith('/v1/access-requests', base);
    });

    it('propagates 422 validation errors', async () => {
      const error = new Error('Request failed with status code 422');
      (error as any).response = { status: 422, data: { detail: [{ loc: ['body', 'use_case'], msg: 'too short' }] } };
      mockAxios.post.mockRejectedValueOnce(error);
      await expect(createAccessRequest({ ...base, use_case: 'curto' })).rejects.toThrow('422');
    });
  });

  describe('listApiKeys', () => {
    it('lists all keys without a status filter', async () => {
      const payload = { keys: [{ key_id: 'k1', plan: 'pro', status: 'active' }], total: 1, mrr_eur_list_price: 149 };
      mockAxios.get.mockResolvedValueOnce({ data: payload });

      const result = await listApiKeys();
      expect(mockAxios.get).toHaveBeenCalledWith('/admin/api-keys', { params: undefined });
      expect(result.mrr_eur_list_price).toBe(149);
      expect(result.keys[0].key_id).toBe('k1');
    });

    it('passes the status filter', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { keys: [], total: 0, mrr_eur_list_price: 0 } });

      await listApiKeys('suspended');
      expect(mockAxios.get).toHaveBeenCalledWith('/admin/api-keys', { params: { status: 'suspended' } });
    });
  });

  describe('createApiKey', () => {
    it('returns the plaintext key once', async () => {
      const created = {
        key_id: 'k9', key_prefix: 'pv_live_abc123', name: 'Produção', org_name: 'Hotel X',
        plan: 'parceiro', status: 'active', created_at: '2026-10-01T00:00:00Z',
        api_key: 'pv_live_abc123secret', warning: 'Guarde esta chave agora — não volta a ser mostrada.',
      };
      mockAxios.post.mockResolvedValueOnce({ data: created });

      const result = await createApiKey({
        name: 'Produção', org_name: 'Hotel X', contact_email: 'it@hotelx.pt', plan: 'parceiro', request_id: 'req-1',
      });
      expect(mockAxios.post).toHaveBeenCalledWith('/admin/api-keys', {
        name: 'Produção', org_name: 'Hotel X', contact_email: 'it@hotelx.pt', plan: 'parceiro', request_id: 'req-1',
      });
      expect(result.api_key).toBe('pv_live_abc123secret');
      expect(result.warning).toMatch(/Guarde/);
    });

    it('drops empty optional fields', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { key_id: 'k10', api_key: 'pv_live_x', warning: '' } });

      await createApiKey({ name: 'Teste', org_name: 'Org', contact_email: '', plan: 'explorador', request_id: '' });
      expect(mockAxios.post).toHaveBeenCalledWith('/admin/api-keys', {
        name: 'Teste', org_name: 'Org', plan: 'explorador',
      });
    });
  });

  describe('updateApiKey', () => {
    it('patches plan and status', async () => {
      mockAxios.patch.mockResolvedValueOnce({ data: { key_id: 'k1', plan: 'pro', status: 'suspended' } });

      const result = await updateApiKey('k1', { plan: 'pro', status: 'suspended' });
      expect(mockAxios.patch).toHaveBeenCalledWith('/admin/api-keys/k1', { plan: 'pro', status: 'suspended' });
      expect(result.status).toBe('suspended');
    });

    it('propagates 409 for revoked keys', async () => {
      const error = new Error('Request failed with status code 409');
      (error as any).response = { status: 409, data: { detail: 'Chave revogada — emita uma nova' } };
      mockAxios.patch.mockRejectedValueOnce(error);
      await expect(updateApiKey('k1', { status: 'active' })).rejects.toThrow('409');
    });
  });

  describe('revokeApiKey', () => {
    it('sends DELETE and resolves on 204', async () => {
      mockAxios.delete.mockResolvedValueOnce({ status: 204, data: '' });

      await expect(revokeApiKey('k1')).resolves.toBeUndefined();
      expect(mockAxios.delete).toHaveBeenCalledWith('/admin/api-keys/k1');
    });

    it('encodes the key id in the path', async () => {
      mockAxios.delete.mockResolvedValueOnce({ status: 204, data: '' });

      await revokeApiKey('a/b');
      expect(mockAxios.delete).toHaveBeenCalledWith('/admin/api-keys/a%2Fb');
    });
  });

  describe('listAccessRequests', () => {
    it('defaults to pending requests', async () => {
      mockAxios.get.mockResolvedValueOnce({ data: { requests: [{ request_id: 'req-1' }], total: 1 } });

      const result = await listAccessRequests();
      expect(mockAxios.get).toHaveBeenCalledWith('/admin/api-keys/requests', { params: { status: 'pending' } });
      expect(result.total).toBe(1);
    });
  });
});

describe('partnerApi — Municipal contracts (B2G)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getMunicipalPlans fetches the public catalogue', async () => {
    const payload = {
      plans: [{ id: 'essencial', name: 'Essencial', audience: '…', price_eur_year: 2900, max_pois: 80, max_audio_guides: 10, white_label: false, setup_fee_eur: 2500 }],
      setup_fee_eur: 2500, pilot_months: 3,
    };
    mockAxios.get.mockResolvedValueOnce({ data: payload });

    const result = await getMunicipalPlans();
    expect(mockAxios.get).toHaveBeenCalledWith('/municipal/plans');
    expect(result.pilot_months).toBe(3);
    expect(result.plans[0].id).toBe('essencial');
  });

  it('listMunicipalSubscriptions returns subscriptions with KPIs', async () => {
    const payload = { subscriptions: [{ municipality_id: 'braga', plan: 'destino', status: 'active' }], total: 1, active: 1, arr_eur_list_price: 9900 };
    mockAxios.get.mockResolvedValueOnce({ data: payload });

    const result = await listMunicipalSubscriptions();
    expect(mockAxios.get).toHaveBeenCalledWith('/admin/municipal/subscriptions');
    expect(result.arr_eur_list_price).toBe(9900);
  });

  it('upsertMunicipalSubscription PUTs the contract and strips empty optionals', async () => {
    mockAxios.put.mockResolvedValueOnce({ data: { municipality_id: 'arcos-de-valdevez', plan: 'essencial', status: 'pilot' } });

    const result = await upsertMunicipalSubscription('arcos-de-valdevez', {
      plan: 'essencial',
      status: 'pilot',
      ends_at: '',
      concelhos: ['Arcos de Valdevez'],
      municipality_aliases: ['arcos_de_valdevez'],
      contract_ref: 'CT-2026-01',
      notes: '',
    });
    expect(mockAxios.put).toHaveBeenCalledWith('/admin/municipal/subscriptions/arcos-de-valdevez', {
      plan: 'essencial',
      status: 'pilot',
      concelhos: ['Arcos de Valdevez'],
      municipality_aliases: ['arcos_de_valdevez'],
      contract_ref: 'CT-2026-01',
    });
    expect(result.status).toBe('pilot');
  });
});

describe('partnerApiErrorMessage', () => {
  it('returns string detail', () => {
    expect(partnerApiErrorMessage({ response: { data: { detail: 'Sem acesso' } } }, 'x')).toBe('Sem acesso');
  });

  it('formats the first pydantic validation error', () => {
    const err = { response: { data: { detail: [{ loc: ['body', 'contact_email'], msg: 'value is not a valid email address' }] } } };
    expect(partnerApiErrorMessage(err, 'x')).toBe('contact_email: value is not a valid email address');
  });

  it('falls back when there is no detail', () => {
    expect(partnerApiErrorMessage(new Error('boom'), 'Erro genérico')).toBe('Erro genérico');
  });
});
