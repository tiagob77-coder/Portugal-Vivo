/**
 * Municipal (B2G) screens: access guard in app/municipio/_layout, impact
 * dashboard, plan, public profile editor, POI audio action and the public
 * /destino pages.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { changeLanguage } from 'i18next';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as municipalModule from '../../src/services/api/municipal';
import * as barrelModule from '../../src/services/api';
import { trackImpact } from '../../src/services/impactTracking';
import Layout from '../municipio/_layout';
import Impacto from '../municipio/impacto';
import Plano from '../municipio/plano';
import Perfil from '../municipio/perfil';
import Pois from '../municipio/pois';
import Destinos from '../destino/index';
import Destino from '../destino/[slug]';

// Seven screens rendered in one suite: the first render pays the lazy
// react-native module loading, which under coverage on a busy CI runner has
// exceeded Jest's 5 s default (passes in <300 ms locally).
jest.setTimeout(20000);

// ─── expo-router ──────────────────────────────────────────────────────────────
const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) };
let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  return {
    useRouter: () => mockRouter,
    useLocalSearchParams: () => mockParams,
    usePathname: () => '/municipio',
    Slot: () => <RNText>SLOT_CONTENT</RNText>,
    Stack: { Screen: () => null },
  };
});
jest.mock('expo-router/head', () => ({ __esModule: true, default: ({ children }: any) => children }));

// ─── UI deps ──────────────────────────────────────────────────────────────────
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('expo-linear-gradient', () => {
  const { View } = jest.requireActual('react-native');
  return { LinearGradient: ({ children, ...p }: any) => <View {...p}>{children}</View> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../src/theme', () => ({ shadows: { sm: {}, md: {} } }));
jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff', surface: '#fff', borderLight: '#eee', textPrimary: '#111',
      textSecondary: '#444', textMuted: '#999', primary: '#2E5E4E',
    },
    isDark: false,
  }),
}));

// ─── Auth ─────────────────────────────────────────────────────────────────────
let mockAuth: any = {};
jest.mock('../../src/context/AuthContext', () => ({ useAuth: () => mockAuth }));

// ─── Services ─────────────────────────────────────────────────────────────────
jest.mock('../../src/services/impactTracking', () => ({ trackImpact: jest.fn(() => Promise.resolve()) }));
jest.mock('../../src/services/api', () => ({
  __esModule: true,
  default: { get: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getRoutes: jest.fn(() => Promise.resolve([{ id: 'r1', name: 'Rota do Românico', region: 'norte' }])),
  getCategories: jest.fn(() => Promise.resolve([{ id: 'castelos', name: 'Castelos', icon: 'x', color: '#000' }])),
}));
jest.mock('../../src/services/api/municipal', () => ({
  ...jest.requireActual('../../src/services/api/municipal'),
  getMySubscription: jest.fn(),
  getMunicipalPlans: jest.fn(),
  getMyImpact: jest.fn(),
  downloadMonthlyReport: jest.fn(),
  getMyProfile: jest.fn(),
  updateMyProfile: jest.fn(),
  getFeaturedAudioGuides: jest.fn(),
  featureAudioGuide: jest.fn(),
  unfeatureAudioGuide: jest.fn(),
  getPartnerPois: jest.fn(),
  getPartnerMunicipalities: jest.fn(),
  getPublicMunicipality: jest.fn(),
}));

const municipal = municipalModule as unknown as Record<string, jest.Mock>;
const barrel = barrelModule as unknown as { default: Record<string, jest.Mock> };

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const httpError = (status: number, detail: any = 'erro') =>
  Object.assign(new Error(`HTTP ${status}`), { response: { status, data: { detail } } });

const PLAN = {
  id: 'essencial', name: 'Essencial', audience: 'Até 20 mil habitantes', price_eur_year: 2900,
  max_pois: 80, max_audio_guides: 10, white_label: false, setup_fee_eur: 2500,
};
const SUBSCRIPTION = {
  municipality_id: 'arcos-de-valdevez',
  subscription: { plan: 'essencial', status: 'pilot', starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-12-01T00:00:00Z', concelhos: [] },
  active: true,
  plan: PLAN,
  usage: { curated_pois: 3, max_pois: 80, featured_audio_guides: 1, max_audio_guides: 10, territory_pois_total: 42 },
};
const IMPACT = {
  municipality_id: 'arcos-de-valdevez',
  from: '2026-09-15',
  to: '2026-10-14',
  totals: {
    poi_views: 120, audio_plays: 30, audio_completes: 12, route_views: 9, route_starts: 4, directions: 7,
    shares: 3, favorites: 5, qr_scans: 11, profile_views: 2, unique_visitors: 1234,
  },
  origin: [
    { country: 'PT', sessions: 800, pct: 64.8 },
    { country: 'ES', sessions: 300, pct: 24.3 },
    { country: 'ZZ', sessions: 134, pct: 10.9 },
  ],
  national_vs_international: { national_sessions: 800, international_sessions: 300, unknown_sessions: 134, international_pct: 27.3 },
  top_pois: [{ poi_id: 'p1', name: 'Paço de Giela', views: 50, audio_plays: 10, interactions: 70 }],
  top_routes: [{ route_id: 'r1', name: 'Ecovia do Vez', views: 9, starts: 4 }],
  daily: [{ date: '2026-10-01', poi_view: 10, audio_play: 2 }],
  platforms: { ios: 10, android: 20, web: 5 },
  methodology: 'Eventos anónimos da app.',
};
const PROFILE = {
  municipality_id: 'arcos-de-valdevez',
  profile: {
    display_name: 'Arcos de Valdevez', tagline: 'Onde o Minho começa', description: 'Texto',
    hero_image_url: null, logo_url: null, brand_color: '#2E5E4E', website: null, contact_email: null,
    featured_poi_ids: [], featured_route_ids: [],
  },
};
const PARTNER_POIS = {
  pois: [
    { id: 'p1', name: 'Paço de Giela', category: 'castelos', region: 'norte', content_health_score: 80, status: 'published' },
    { id: 'p2', name: 'Ponte Medieval', category: 'arqueologia', region: 'norte', content_health_score: 40, status: 'draft' },
  ],
  items: [], total: 2, page: 1, page_size: 100,
};

const clients: QueryClient[] = [];
function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: 0, gcTime: 0 } },
  });
  clients.push(client);
  const utils = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return {
    ...utils,
    rerender: (next: React.ReactElement) =>
      utils.rerender(<QueryClientProvider client={client}>{next}</QueryClientProvider>),
  };
}

afterEach(() => {
  clients.splice(0).forEach((c) => c.clear());
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockAuth = {
    user: { user_id: 'u1', name: 'Ana', email: 'ana@cm.pt' },
    isAuthenticated: true,
    isLoading: false,
    sessionToken: 'tok',
    logout: jest.fn(),
  };
  municipal.getMySubscription.mockResolvedValue(SUBSCRIPTION);
  municipal.getMyProfile.mockResolvedValue(PROFILE);
  municipal.getMunicipalPlans.mockResolvedValue({
    plans: [PLAN], setup_fee_eur: 2500, pilot_months: 3, currency: 'EUR', vat_included: false, notes: '',
  });
  municipal.getFeaturedAudioGuides.mockResolvedValue({
    items: [{ id: 'p1', name: 'Paço de Giela', category: 'castelos', audio_featured_at: '2026-10-01T10:00:00Z' }],
    used: 1,
    max: 10,
  });
  municipal.getPartnerPois.mockResolvedValue(PARTNER_POIS);
});

// ─── Layout ───────────────────────────────────────────────────────────────────

describe('municipio/_layout', () => {
  it('renders the panel for a municipal user', async () => {
    renderWithClient(<Layout />);
    expect(await screen.findByText('SLOT_CONTENT')).toBeTruthy();
    expect(screen.getByText('Impacto')).toBeTruthy();
    expect(screen.getByText('Plano')).toBeTruthy();
  });

  it('shows the no-access state on 403', async () => {
    municipal.getMySubscription.mockRejectedValue(httpError(403, 'Utilizador sem município associado'));
    renderWithClient(<Layout />);
    expect(await screen.findByText('Sem acesso ao painel municipal')).toBeTruthy();
    fireEvent.press(screen.getByText('Voltar à app'));
    expect(mockRouter.replace).toHaveBeenCalledWith('/(tabs)/profile');
  });

  it('redirects to /auth on 401', async () => {
    municipal.getMySubscription.mockRejectedValue(httpError(401));
    renderWithClient(<Layout />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth'));
  });

  it('redirects to /auth when logged out', async () => {
    mockAuth = { ...mockAuth, user: null, isAuthenticated: false };
    renderWithClient(<Layout />);
    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/auth'));
    expect(municipal.getMySubscription).not.toHaveBeenCalled();
  });
});

// ─── Impacto ──────────────────────────────────────────────────────────────────

describe('municipio/impacto', () => {
  it('renders KPIs, origin and top lists', async () => {
    municipal.getMyImpact.mockResolvedValue(IMPACT);
    renderWithClient(<Impacto />);
    expect(await screen.findByText('1 234')).toBeTruthy();
    expect(screen.getByText('Visitantes únicos')).toBeTruthy();
    expect(screen.getByText('Paço de Giela')).toBeTruthy();
    expect(screen.getByText('Ecovia do Vez')).toBeTruthy();
    expect(screen.getByText('Espanha')).toBeTruthy();
    expect(screen.getByText('Desconhecida')).toBeTruthy();
    const [first] = municipal.getMyImpact.mock.calls[0];
    expect(first).toEqual({ from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/), to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });

  it('switching preset refetches with a new range', async () => {
    municipal.getMyImpact.mockResolvedValue(IMPACT);
    renderWithClient(<Impacto />);
    await screen.findByText('1 234');
    fireEvent.press(screen.getByText('7 dias'));
    await waitFor(() => expect(municipal.getMyImpact).toHaveBeenCalledTimes(2));
  });

  it('shows the plan card on 402', async () => {
    municipal.getMyImpact.mockRejectedValue(httpError(402));
    renderWithClient(<Impacto />);
    expect(await screen.findByText('O painel de impacto faz parte dos planos municipais')).toBeTruthy();
    fireEvent.press(screen.getByText('Ver planos'));
    expect(mockRouter.push).toHaveBeenCalledWith('/municipio/plano');
  });

  it('on native the PDF button explains it is available on the web panel', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    municipal.getMyImpact.mockResolvedValue(IMPACT);
    municipal.downloadMonthlyReport.mockResolvedValue(false);
    renderWithClient(<Impacto />);
    await screen.findByText('1 234');
    fireEvent.press(screen.getByText('Descarregar relatório PDF'));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Relatório PDF', expect.stringContaining('versão web')));
    expect(municipal.downloadMonthlyReport.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}$/);
    alertSpy.mockRestore();
  });
});

// ─── Plano ────────────────────────────────────────────────────────────────────

describe('municipio/plano', () => {
  it('shows the current plan, quotas and featured audio guides', async () => {
    renderWithClient(<Plano />);
    expect(await screen.findByText('Piloto')).toBeTruthy();
    expect(screen.getByText('3 / 80')).toBeTruthy();
    expect(await screen.findByText('Paço de Giela')).toBeTruthy();
    expect(await screen.findByText('Plano atual')).toBeTruthy();
  });

  it('removes a featured audio guide after confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons: any) => {
      buttons?.find((b: any) => b.text === 'Remover')?.onPress?.();
    });
    municipal.unfeatureAudioGuide.mockResolvedValue(undefined);
    renderWithClient(<Plano />);
    fireEvent.press(await screen.findByText('Remover'));
    await waitFor(() => expect(municipal.unfeatureAudioGuide).toHaveBeenCalledWith('p1'));
    alertSpy.mockRestore();
  });

  it('shows the contact CTA when there is no active plan', async () => {
    municipal.getMySubscription.mockResolvedValue({
      ...SUBSCRIPTION, subscription: null, plan: null, active: false,
      usage: { ...SUBSCRIPTION.usage, max_pois: null, max_audio_guides: null },
    });
    renderWithClient(<Plano />);
    expect(await screen.findByText('Sem plano ativo')).toBeTruthy();
    expect(screen.getByText('Contactar')).toBeTruthy();
  });
});

// ─── Perfil ───────────────────────────────────────────────────────────────────

describe('municipio/perfil', () => {
  it('validates the brand colour before saving', async () => {
    renderWithClient(<Perfil />);
    const color = await screen.findByLabelText('Cor da marca');
    fireEvent.changeText(color, 'verde');
    fireEvent.press(screen.getByText('Guardar alterações'));
    expect(await screen.findByText('Use o formato #RRGGBB (ex.: #2E5E4E).')).toBeTruthy();
    expect(municipal.updateMyProfile).not.toHaveBeenCalled();
  });

  it('saves the profile with the selected featured POIs', async () => {
    municipal.updateMyProfile.mockResolvedValue(PROFILE.profile);
    renderWithClient(<Perfil />);
    fireEvent.press(await screen.findByText('Ponte Medieval'));
    fireEvent.press(screen.getByText('Guardar alterações'));
    await waitFor(() => expect(municipal.updateMyProfile).toHaveBeenCalled());
    const payload = municipal.updateMyProfile.mock.calls[0][0];
    expect(payload.display_name).toBe('Arcos de Valdevez');
    expect(payload.featured_poi_ids).toEqual(['p2']);
    expect(payload.website).toBeNull();
    expect(await screen.findByText('Página pública guardada.')).toBeTruthy();
  });

  it('shows the role message on 403', async () => {
    municipal.updateMyProfile.mockRejectedValue(httpError(403, "Só o perfil 'municipio' pode editar a página pública"));
    renderWithClient(<Perfil />);
    fireEvent.press(await screen.findByText('Guardar alterações'));
    expect(await screen.findByText("Só o perfil 'municipio' pode editar a página pública")).toBeTruthy();
  });

  it('links to the public page', async () => {
    renderWithClient(<Perfil />);
    fireEvent.press(await screen.findByText('Ver página pública'));
    expect(mockRouter.push).toHaveBeenCalledWith('/destino/arcos-de-valdevez');
  });
});

// ─── POIs audio action ────────────────────────────────────────────────────────

describe('municipio/pois audio action', () => {
  beforeEach(() => {
    barrel.default.get.mockResolvedValue({ data: PARTNER_POIS });
  });

  it('features a POI audio guide', async () => {
    municipal.featureAudioGuide.mockResolvedValue({ poi_id: 'p2', featured: true, used: 2, max: 10 });
    renderWithClient(<Pois />);
    expect(await screen.findByText('Remover destaque')).toBeTruthy(); // p1 already featured
    fireEvent.press(screen.getByText('Destacar áudio'));
    await waitFor(() => expect(municipal.featureAudioGuide).toHaveBeenCalledWith('p2'));
  });

  it('shows the quota error', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    municipal.featureAudioGuide.mockRejectedValue(httpError(403, 'Quota de áudio-guias esgotada (10/10).'));
    renderWithClient(<Pois />);
    fireEvent.press(await screen.findByText('Destacar áudio'));
    await waitFor(() =>
      expect(alertSpy).toHaveBeenCalledWith('Quota de áudio-guias', 'Quota de áudio-guias esgotada (10/10).'),
    );
    alertSpy.mockRestore();
  });

  it('hides the audio action when audio guides are unavailable', async () => {
    municipal.getFeaturedAudioGuides.mockRejectedValue(httpError(403));
    renderWithClient(<Pois />);
    expect(await screen.findByText('Ponte Medieval')).toBeTruthy();
    expect(screen.queryByText('Destacar áudio')).toBeNull();
  });
});

// ─── Destino (public) ─────────────────────────────────────────────────────────

describe('destino', () => {
  it('lists partner municipalities', async () => {
    municipal.getPartnerMunicipalities.mockResolvedValue({
      municipalities: [{ slug: 'arcos-de-valdevez', municipality_id: 'arcos-de-valdevez', display_name: 'Arcos de Valdevez', tagline: 'Onde o Minho começa', brand_color: '#123456' }],
      total: 1,
    });
    renderWithClient(<Destinos />);
    fireEvent.press(await screen.findByText('Arcos de Valdevez'));
    expect(mockRouter.push).toHaveBeenCalledWith('/destino/arcos-de-valdevez');
  });

  it('shows the empty state', async () => {
    municipal.getPartnerMunicipalities.mockResolvedValue({ municipalities: [], total: 0 });
    renderWithClient(<Destinos />);
    expect(await screen.findByText('Ainda não há municípios parceiros')).toBeTruthy();
  });

  it('renders the public page and tracks one profile view', async () => {
    mockParams = { slug: 'arcos-de-valdevez' };
    municipal.getPublicMunicipality.mockResolvedValue({
      slug: 'arcos-de-valdevez',
      profile: { ...PROFILE.profile, website: 'https://www.cmav.pt' },
      stats: { pois: 42, audio_guides: 3, categories: [{ category: 'castelos', count: 5 }] },
      featured_pois: [{ id: 'p1', name: 'Paço de Giela', category: 'castelos', image_url: null, micro_pitch: 'Torre medieval' }],
      featured_routes: [
        { id: 'r1', name: 'Ecovia do Vez', description: 'Ao longo do rio', image_url: null, duration_hours: 2.5, kind: 'route' },
        { id: 't1', name: 'PR3 Trilho do Sistelo', description: null, image_url: null, duration_hours: 3, kind: 'trail' },
      ],
      plan_white_label: false,
    });
    const { rerender } = renderWithClient(<Destino />);
    expect(await screen.findByText('Arcos de Valdevez')).toBeTruthy();
    expect(screen.getByText('Página oficial do município no Portugal Vivo')).toBeTruthy();
    fireEvent.press(screen.getByText('Paço de Giela'));
    expect(mockRouter.push).toHaveBeenCalledWith('/heritage/p1');
    fireEvent.press(screen.getByText('Ecovia do Vez'));
    expect(mockRouter.push).toHaveBeenCalledWith('/route/r1');
    fireEvent.press(screen.getByText('PR3 Trilho do Sistelo'));
    expect(mockRouter.push).toHaveBeenCalledWith('/trail/t1');
    rerender(<Destino />);
    expect(trackImpact).toHaveBeenCalledTimes(1);
    expect(trackImpact).toHaveBeenCalledWith({ event_type: 'profile_view', municipality: 'arcos-de-valdevez' });
  });

  it('shows the not-partner message on 404', async () => {
    mockParams = { slug: 'lisboa' };
    municipal.getPublicMunicipality.mockRejectedValue(httpError(404, 'Município sem página no Portugal Vivo'));
    renderWithClient(<Destino />);
    expect(await screen.findByText('Este município ainda não tem página no Portugal Vivo')).toBeTruthy();
    expect(trackImpact).not.toHaveBeenCalled();
  });

  describe('in English', () => {
    afterEach(async () => {
      await act(() => changeLanguage('pt'));
    });

    it('shows the partner list empty state in English', async () => {
      await act(() => changeLanguage('en'));
      municipal.getPartnerMunicipalities.mockResolvedValue({ municipalities: [], total: 0 });
      renderWithClient(<Destinos />);
      expect(await screen.findByText('No partner municipalities yet')).toBeTruthy();
      expect(screen.getByText('Partner municipalities')).toBeTruthy();
    });
  });
});
