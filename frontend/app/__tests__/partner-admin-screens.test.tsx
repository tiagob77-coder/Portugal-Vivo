/**
 * Partner API (B2B) + municipal contracts (B2G) screens:
 * admin-api-keys, admin-municipios, api-docs.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AdminApiKeysScreen from '../admin-api-keys';
import AdminMunicipiosScreen from '../admin-municipios';
import ApiDocsScreen from '../api-docs';

// ─── expo-router ──────────────────────────────────────────────────────────────
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({}),
  Stack: { Screen: () => null },
}));

// ─── Auth (mutable per test) ──────────────────────────────────────────────────
let mockUser: any = { user_id: 'u1', role: 'admin', is_admin: true };
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isLoading: false, isAuthenticated: !!mockUser }),
}));

// ─── Theme ────────────────────────────────────────────────────────────────────
jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#FAF8F3', surface: '#FFFFFF', primary: '#2E5E4E', accent: '#C49A6C',
      textPrimary: '#1C1F1C', textSecondary: '#4A4A4A', textMuted: '#9A958A',
      border: '#E5E0D5', borderLight: '#F2EDE4',
      success: '#22C55E', warning: '#F59E0B', error: '#EF4444', info: '#2A6F97',
    },
    isDark: false,
  }),
}));
jest.mock('../../src/theme', () => ({
  shadows: { sm: {} },
  fontFamilies: { serif: 'serif', sans: 'System' },
}));
jest.mock('../../src/config/api', () => ({
  API_BASE: 'http://localhost:8001/api',
  API_URL: 'http://localhost:8001',
}));

// ─── Native deps ──────────────────────────────────────────────────────────────
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

// ─── Partner API service ──────────────────────────────────────────────────────
jest.mock('../../src/services/api/partnerApi', () => ({
  getApiPlans: jest.fn(),
  createAccessRequest: jest.fn(),
  listApiKeys: jest.fn(),
  createApiKey: jest.fn(),
  updateApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
  listAccessRequests: jest.fn(),
  getMunicipalPlans: jest.fn(),
  listMunicipalSubscriptions: jest.fn(),
  upsertMunicipalSubscription: jest.fn(),
  partnerApiErrorMessage: (err: any, fallback: string) =>
    (typeof err?.response?.data?.detail === 'string' ? err.response.data.detail : fallback),
}));

const partnerApi = jest.requireMock('../../src/services/api/partnerApi');

const PLANS = {
  plans: [
    { id: 'explorador', name: 'Explorador', price_eur_month: 0, price_eur_month_billed_annually: 0, monthly_quota: 500, features: ['heritage', 'map', 'routes'], sla: null, white_label: false },
    { id: 'parceiro', name: 'Parceiro', price_eur_month: 49, price_eur_month_billed_annually: 39.2, monthly_quota: 10000, features: ['events', 'heritage', 'map', 'narratives', 'routes', 'weather'], sla: '99%', white_label: false },
    { id: 'pro', name: 'Pro', price_eur_month: 149, price_eur_month_billed_annually: 119.2, monthly_quota: 100000, features: ['audio', 'events', 'heritage', 'map', 'narratives', 'routes', 'weather'], sla: '99,5%', white_label: true },
    { id: 'enterprise', name: 'Enterprise', price_eur_month: 500, price_eur_month_billed_annually: 400, monthly_quota: null, features: ['audio', 'events', 'heritage', 'map', 'narratives', 'routes', 'weather'], sla: 'personalizado', white_label: true },
  ],
  annual_discount: 0.2, currency: 'EUR', vat_included: false, auth_header: 'X-API-Key',
};

const mockClients: QueryClient[] = [];
const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } },
  });
  mockClients.push(client);
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => {
  mockClients.splice(0).forEach((c) => c.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { user_id: 'u1', role: 'admin', is_admin: true };
  partnerApi.getApiPlans.mockResolvedValue(PLANS);
  partnerApi.listApiKeys.mockResolvedValue({
    keys: [{
      key_id: 'k1', key_prefix: 'pv_live_abc123', name: 'Produção', org_name: 'Hotel Atlântico',
      contact_email: 'it@atlantico.pt', plan: 'pro', status: 'active',
      created_at: '2026-09-01T10:00:00Z', last_used_at: '2026-10-13T08:30:00Z',
      usage: { period: '2026-10', used: 1200, quota: 100000 },
    }],
    total: 1,
    mrr_eur_list_price: 149,
  });
  partnerApi.listAccessRequests.mockResolvedValue({
    requests: [{
      request_id: 'req-123456789', org_name: 'Agência Lusa Tours', contact_name: 'Ana Silva',
      contact_email: 'ana@lusatours.pt', use_case: 'Roteiros culturais para turistas.',
      desired_plan: 'parceiro', website: null, status: 'pending', created_at: '2026-10-10T09:00:00Z',
    }],
    total: 1,
  });
  partnerApi.getMunicipalPlans.mockResolvedValue({
    plans: [
      { id: 'essencial', name: 'Essencial', audience: 'Até 20 mil habitantes', price_eur_year: 2900, max_pois: 80, max_audio_guides: 10, white_label: false, setup_fee_eur: 2500 },
      { id: 'territorio', name: 'Território', audience: '20 a 100 mil habitantes', price_eur_year: 4900, max_pois: 150, max_audio_guides: 20, white_label: false, setup_fee_eur: 2500 },
      { id: 'destino', name: 'Destino', audience: 'Mais de 100 mil habitantes', price_eur_year: 9900, max_pois: null, max_audio_guides: 40, white_label: true, setup_fee_eur: 2500 },
    ],
    setup_fee_eur: 2500,
    pilot_months: 3,
  });
  partnerApi.listMunicipalSubscriptions.mockResolvedValue({
    subscriptions: [{
      municipality_id: 'arcos-de-valdevez', plan: 'essencial', status: 'pilot',
      starts_at: '2026-09-01T00:00:00', ends_at: '2026-12-02T00:00:00',
      concelhos: ['Arcos de Valdevez'], municipality_aliases: [], contract_ref: 'CT-2026-01',
      notes: null, updated_at: '2026-09-01T00:00:00',
    }],
    total: 1,
    active: 1,
    arr_eur_list_price: 0,
  });
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('admin-api-keys', () => {
  const Screen = AdminApiKeysScreen;

  it('lists keys, usage and pending requests', async () => {
    const { findByText, getByText } = renderWithClient(<Screen />);
    expect(await findByText('Hotel Atlântico')).toBeTruthy();
    expect(getByText('Chaves ativas')).toBeTruthy();
    expect(getByText('MRR (preço de tabela)')).toBeTruthy();
    expect(getByText('pv_live_abc123…')).toBeTruthy();
    expect(await findByText('Agência Lusa Tours')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('issues a key from an access request and shows the plaintext key once', async () => {
    partnerApi.createApiKey.mockResolvedValue({
      key_id: 'k2', key_prefix: 'pv_live_xyz789', name: 'Agência Lusa Tours — produção',
      org_name: 'Agência Lusa Tours', plan: 'parceiro', status: 'active', created_at: '2026-10-14T00:00:00Z',
      api_key: 'pv_live_xyz789SECRET', warning: 'Guarde esta chave agora — não volta a ser mostrada.',
    });
    const { findByText, getAllByText, getByDisplayValue } = renderWithClient(<Screen />);
    await findByText('Agência Lusa Tours');

    // "Emitir chave" on the request card (the only one before the form opens)
    fireEvent.press(getAllByText('Emitir chave')[0]);
    expect(getByDisplayValue('ana@lusatours.pt')).toBeTruthy();

    // Submit button in the form is now the first "Emitir chave"
    fireEvent.press(getAllByText('Emitir chave')[0]);

    await waitFor(() => expect(partnerApi.createApiKey).toHaveBeenCalled());
    expect(partnerApi.createApiKey.mock.calls[0][0]).toEqual({
      name: 'Agência Lusa Tours — produção',
      org_name: 'Agência Lusa Tours',
      contact_email: 'ana@lusatours.pt',
      plan: 'parceiro',
      request_id: 'req-123456789',
    });
    expect(await findByText('pv_live_xyz789SECRET')).toBeTruthy();
    expect(getAllByText(/não volta a ser mostrada/).length).toBeGreaterThan(0);
  });

  it('suspends an active key', async () => {
    partnerApi.updateApiKey.mockResolvedValue({ key_id: 'k1', status: 'suspended' });
    const { findByText } = renderWithClient(<Screen />);
    fireEvent.press(await findByText('Suspender'));
    await waitFor(() => expect(partnerApi.updateApiKey).toHaveBeenCalledWith('k1', { status: 'suspended' }));
  });

  it('redirects non-admins and does not load admin data', () => {
    mockUser = { user_id: 'u2', role: 'user' };
    renderWithClient(<Screen />);
    expect(mockReplace).toHaveBeenCalledWith('/');
    expect(partnerApi.listApiKeys).not.toHaveBeenCalled();
  });
});

describe('admin-municipios', () => {
  const Screen = AdminMunicipiosScreen;

  it('lists subscriptions with KPIs', async () => {
    const { findByText, getByText } = renderWithClient(<Screen />);
    expect(await findByText('arcos-de-valdevez')).toBeTruthy();
    expect(getByText('ARR (preço de tabela)')).toBeTruthy();
    expect(getByText('Arcos de Valdevez')).toBeTruthy();
  });

  it('creates a subscription from the form', async () => {
    partnerApi.upsertMunicipalSubscription.mockResolvedValue({
      municipality_id: 'ponte-de-lima', plan: 'territorio', status: 'active', ends_at: '2027-10-14T00:00:00',
    });
    const { findByText, getByPlaceholderText, getAllByPlaceholderText, getByText } = renderWithClient(<Screen />);
    await findByText('arcos-de-valdevez');

    fireEvent.changeText(getByPlaceholderText('arcos-de-valdevez'), 'ponte-de-lima');
    fireEvent.press(getByText('Território'));
    fireEvent.press(getByText('Ativo'));
    fireEvent.changeText(getAllByPlaceholderText('AAAA-MM-DD')[1], '2027-10-14');
    fireEvent.changeText(getByPlaceholderText('Arcos de Valdevez, Ponte da Barca'), 'Ponte de Lima, , Arcozelo');
    fireEvent.press(getByText('Criar contrato'));

    await waitFor(() => expect(partnerApi.upsertMunicipalSubscription).toHaveBeenCalled());
    const [id, payload] = partnerApi.upsertMunicipalSubscription.mock.calls[0];
    expect(id).toBe('ponte-de-lima');
    expect(payload).toEqual(expect.objectContaining({
      plan: 'territorio',
      status: 'active',
      ends_at: '2027-10-14T23:59:59Z',
      concelhos: ['Ponte de Lima', 'Arcozelo'],
      municipality_aliases: [],
    }));
  });

  it('rejects an invalid end date', async () => {
    const { findByText, getByPlaceholderText, getAllByPlaceholderText, getByText } = renderWithClient(<Screen />);
    await findByText('arcos-de-valdevez');
    fireEvent.changeText(getByPlaceholderText('arcos-de-valdevez'), 'braga');
    fireEvent.changeText(getAllByPlaceholderText('AAAA-MM-DD')[1], '14/10/2027');
    fireEvent.press(getByText('Criar contrato'));
    expect(await findByText(/Data de fim inválida/)).toBeTruthy();
    expect(partnerApi.upsertMunicipalSubscription).not.toHaveBeenCalled();
  });
});

describe('api-docs', () => {
  const Screen = ApiDocsScreen;

  it('documents the v1 base URL, header and plans', async () => {
    const { getByText, findByText, getAllByText } = renderWithClient(<Screen />);
    expect(getByText('http://localhost:8001/api/v1')).toBeTruthy();
    expect(getByText('X-API-Key: pv_live_…')).toBeTruthy();
    expect(getByText('/v1/heritage')).toBeTruthy();
    expect(getByText('429')).toBeTruthy();
    expect(await findByText('99,5%')).toBeTruthy();
    expect(getAllByText('Enterprise').length).toBeGreaterThan(0);
    expect(getByText(/não estão licenciados a terceiros/i)).toBeTruthy();
  });

  it('validates and submits an access request', async () => {
    partnerApi.createAccessRequest.mockResolvedValue({ request_id: 'abcdef1234567890', status: 'pending' });
    const { getByLabelText, getByText, getAllByText, findByText } = renderWithClient(<Screen />);
    await findByText('99,5%');

    fireEvent.changeText(getByLabelText('Organização'), 'Agência Lusa Tours');
    fireEvent.changeText(getByLabelText('Nome do contacto'), 'Ana Silva');
    fireEvent.changeText(getByLabelText('Email'), 'ana@lusatours.pt');
    fireEvent.changeText(getByLabelText('Caso de uso'), 'curto');
    fireEvent.press(getByText('Enviar pedido'));
    expect(await findByText(/mín\. 10 caracteres/)).toBeTruthy();
    expect(partnerApi.createAccessRequest).not.toHaveBeenCalled();

    fireEvent.changeText(getByLabelText('Caso de uso'), 'Integrar rotas culturais na nossa app de reservas.');
    // "Parceiro" also appears in the plans table — the chip is rendered last.
    const parceiro = getAllByText('Parceiro');
    fireEvent.press(parceiro[parceiro.length - 1]);
    fireEvent.press(getByText('Enviar pedido'));

    await waitFor(() => expect(partnerApi.createAccessRequest).toHaveBeenCalled());
    expect(partnerApi.createAccessRequest.mock.calls[0][0]).toEqual({
      org_name: 'Agência Lusa Tours',
      contact_name: 'Ana Silva',
      contact_email: 'ana@lusatours.pt',
      use_case: 'Integrar rotas culturais na nossa app de reservas.',
      desired_plan: 'parceiro',
      website: undefined,
    });
    expect(await findByText('Pedido recebido')).toBeTruthy();
  });

  it('shows the server error when the request fails', async () => {
    partnerApi.createAccessRequest.mockRejectedValue({ response: { status: 422, data: { detail: 'Email inválido' } } });
    const { getByLabelText, getByText, findByText } = renderWithClient(<Screen />);
    fireEvent.changeText(getByLabelText('Organização'), 'Org');
    fireEvent.changeText(getByLabelText('Nome do contacto'), 'Ana');
    fireEvent.changeText(getByLabelText('Email'), 'ana@x.pt');
    fireEvent.changeText(getByLabelText('Caso de uso'), 'Um caso de uso suficientemente longo.');
    fireEvent.press(getByText('Enviar pedido'));
    expect(await findByText('Email inválido')).toBeTruthy();
  });
});
