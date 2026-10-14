/**
 * Premium screen in the iOS / Android apps: store prices, purchase through the
 * App Store / Google Play (services/iap), restore and the auto-renew terms.
 */
import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from 'i18next';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('../../src/theme', () => ({
  shadows: { sm: {} },
  fontFamilies: { serif: 'serif' },
}));

jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: { background: '#000', surface: '#111', textPrimary: '#fff', textMuted: '#aaa', borderLight: '#333' },
  }),
}));

const mockRefreshSubscription = jest.fn(() => Promise.resolve());
let mockAuthenticated = true;
jest.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockAuthenticated,
    user: mockAuthenticated ? { id: 'u-ana', email: 'ana@pv.pt' } : null,
    refreshSubscription: mockRefreshSubscription,
    isPremium: false,
  }),
}));

const FREE_FEATURES = [
  { id: 'map', name: 'Mapa Interativo', description: '6 camadas e clustering', included: true },
  { id: 'offline', name: 'Modo Offline', description: 'Download de regiões', included: false },
];
jest.mock('../../src/services/api', () => ({
  getPremiumTiers: jest.fn(() => Promise.resolve({
    tiers: [
      { id: 'free', name: 'Explorador', price: 0, price_label: 'Grátis', features: FREE_FEATURES },
      { id: 'premium', name: 'Descobridor', price: 4.99, price_label: '4,99€/mês',
        features: FREE_FEATURES.map((f) => ({ ...f, included: true })) },
    ],
    currency: 'EUR',
    trial_days: 7,
    stripe_enabled: true,
    payment_methods: [],
  })),
  getSubscriptionStatus: jest.fn(() => Promise.resolve({ user_id: 'u-ana', tier: 'free', tier_name: 'Explorador', status: 'active', features: [] })),
  createCheckoutSession: jest.fn(),
  createCheckoutMBWay: jest.fn(),
  createCheckoutMultibanco: jest.fn(),
  createCustomerPortal: jest.fn(),
  logPaywallIntent: jest.fn(),
}));

const MONTHLY = { tier: 'premium', productId: 'pt.portugalvivo.premium.monthly', title: 'Mensal', displayPrice: '4,99 €' };
const ANNUAL = { tier: 'annual', productId: 'pt.portugalvivo.premium.annual', title: 'Anual', displayPrice: '39,99 €' };
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
jest.mock('../../src/services/iap', () => ({
  isStoreBillingAvailable: () => true,
  loadStoreCatalog: jest.fn(() => Promise.resolve({ products: [MONTHLY, ANNUAL], accountToken: 'acct-token' })),
  purchaseStoreProduct: (...args: unknown[]) => mockPurchase(...args),
  restoreStorePurchases: () => mockRestore(),
  openStoreSubscriptions: jest.fn(),
}));

import PremiumScreen from '../premium';

let client: QueryClient;

function renderScreen() {
  // gcTime: Infinity keeps React Query from leaving garbage-collection timers
  // behind, which would hold Jest open after the run.
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return render(
    <QueryClientProvider client={client}>
      <PremiumScreen />
    </QueryClientProvider>,
  );
}

describe('Premium screen — store billing', () => {
  beforeEach(() => {
    mockAuthenticated = true;
    mockPurchase.mockReset();
    mockRestore.mockReset();
    mockRefreshSubscription.mockClear();
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    client?.clear();
    await act(() => i18n.changeLanguage('pt'));
    jest.restoreAllMocks();
  });

  it('shows store prices and the auto-renew terms, not the web payment methods', async () => {
    renderScreen();
    expect(await screen.findByText('4,99 €/mês')).toBeTruthy();
    expect(screen.getByText('39,99 €/ano')).toBeTruthy();
    expect(screen.queryByText('Método de Pagamento')).toBeNull();
    expect(screen.queryByText(/dias grátis/)).toBeNull(); // store trials come from the store itself
    expect(screen.getByText(/renova automaticamente/)).toBeTruthy();
    expect(screen.getByText('Restaurar compras')).toBeTruthy();
    fireEvent.press(screen.getByText('Termos de Utilização'));
    expect(mockPush).toHaveBeenCalledWith('/terms');
  });

  it('buys the selected tier through the store with the account token', async () => {
    mockPurchase.mockResolvedValue({ status: 'success', tier: 'annual' });
    renderScreen();
    fireEvent.press(await screen.findByText('Anual'));
    fireEvent.press(screen.getByText('Subscrever Premium'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith(ANNUAL, 'acct-token'));
    expect(await screen.findByText('Subscrição ativada com sucesso! Bem-vindo ao Premium.')).toBeTruthy();
    expect(mockRefreshSubscription).toHaveBeenCalled();
  });

  it('says so when the payment is pending and stays quiet when the user cancels', async () => {
    mockPurchase.mockResolvedValueOnce({ status: 'pending' }).mockResolvedValueOnce({ status: 'cancelled' });
    renderScreen();
    fireEvent.press(await screen.findByText('Subscrever Premium'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Pagamento pendente', expect.any(String)));
    (Alert.alert as jest.Mock).mockClear();
    fireEvent.press(screen.getByText('Subscrever Premium'));
    await waitFor(() => expect(mockPurchase).toHaveBeenCalledTimes(2));
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('restores purchases and reports when there is nothing to restore', async () => {
    mockRestore.mockResolvedValue(0);
    renderScreen();
    fireEvent.press(await screen.findByText('Restaurar compras'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith(
      'Restaurar compras', 'Não encontrámos subscrições ativas nesta conta App Store.'));
  });

  it('asks to sign in before buying', async () => {
    mockAuthenticated = false;
    renderScreen();
    fireEvent.press(await screen.findByText('Subscrever Premium'));
    expect(Alert.alert).toHaveBeenCalledWith('Iniciar Sessão', 'Precisa de iniciar sessão para subscrever.', expect.any(Array));
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('renders in English', async () => {
    await act(() => i18n.changeLanguage('en'));
    renderScreen();
    expect(await screen.findByText('4,99 €/month')).toBeTruthy();
    expect(screen.getByText('Restore purchases')).toBeTruthy();
    expect(screen.getByText('Interactive Map')).toBeTruthy();
    expect(screen.getByText('Subscribe to Premium')).toBeTruthy();
  });
});
