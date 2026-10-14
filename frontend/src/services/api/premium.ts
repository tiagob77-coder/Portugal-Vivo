import api from './client';
import logger from '../../utils/logger';

// =============================================================================
// PREMIUM / SUBSCRIPTION
// =============================================================================

export interface PremiumTierFeature {
  id: string;
  name: string;
  description: string;
  included: boolean;
  limit?: number;
}

export interface PremiumTier {
  id: string;
  name: string;
  price: number;
  price_label: string;
  features: PremiumTierFeature[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  recurring: boolean;
}

export interface PremiumTiersResponse {
  tiers: PremiumTier[];
  currency: string;
  trial_days: number;
  stripe_enabled: boolean;
  payment_methods: PaymentMethod[];
}

export interface SubscriptionStatus {
  user_id: string;
  tier: string;
  tier_name: string;
  status: string;
  features: PremiumTierFeature[];
  started_at?: string;
  expires_at?: string;
  stripe_subscription_id?: string;
  payment_method?: string;
  requires_manual_renewal?: boolean;
  days_until_expiry?: number | null;
  /** Set when the subscription was bought in the App Store / Google Play. */
  store?: 'app_store' | 'google_play' | null;
  auto_renew?: boolean | null;
}

export interface CheckoutResponse {
  checkout_url: string;
  session_id: string;
  payment_method?: string;
}

export const getPremiumTiers = async (): Promise<PremiumTiersResponse> => {
  const response = await api.get('/premium/tiers');
  return response.data;
};

export const getSubscriptionStatus = async (userId: string): Promise<SubscriptionStatus> => {
  const response = await api.get(`/premium/status/${userId}`);
  return response.data;
};

export const createCheckoutSession = async (
  userId: string, userEmail: string, tier: string
): Promise<CheckoutResponse> => {
  const response = await api.post('/premium/create-checkout', {
    user_id: userId, user_email: userEmail, tier,
  });
  return response.data;
};

export const createCheckoutMBWay = async (
  userId: string, userEmail: string, tier: string
): Promise<CheckoutResponse> => {
  const response = await api.post('/premium/create-checkout-mbway', {
    user_id: userId, user_email: userEmail, tier,
  });
  return response.data;
};

export const createCheckoutMultibanco = async (
  userId: string, userEmail: string, tier: string
): Promise<CheckoutResponse> => {
  const response = await api.post('/premium/create-checkout-multibanco', {
    user_id: userId, user_email: userEmail, tier,
  });
  return response.data;
};

export const createCustomerPortal = async (userId: string): Promise<{ portal_url: string }> => {
  const response = await api.post('/premium/create-portal', { user_id: userId });
  return response.data;
};

// ─── Paywall Intent Tracking (validation signal) ─────────────────────────────

/**
 * Logs a paywall intent event without completing payment.
 * Used during the pre-Stripe validation phase to measure real purchase intent.
 * Falls back to console.log when the endpoint is unavailable.
 */
export const logPaywallIntent = async (payload: {
  tier: string;
  payment_method: string;
  source: 'premium_screen' | 'premium_gate';
  feature?: string;
}): Promise<void> => {
  try {
    await api.post('/premium/intent', payload);
  } catch {
    // Non-blocking: log locally if backend not ready
    logger.info('[paywall_intent]', JSON.stringify(payload));
  }
};

export const checkFeatureAccess = async (
  _userId: string, featureId: string
): Promise<{ has_access: boolean; user_tier: string; upgrade_needed: boolean }> => {
  const response = await api.get(`/premium/check-feature/${featureId}`);
  return response.data;
};

// ─── In-app purchases (App Store / Google Play) ──────────────────────────────

export interface IapCatalogResponse {
  products: { tier: 'premium' | 'annual'; product_id: string; name: string; reference_price_eur: number }[];
  /** Only for signed-in users: passed to the store so the purchase is tied to this account. */
  account_token?: string;
}

export interface StoreVerifyResponse {
  active: boolean;
  status: 'active' | 'inactive';
  tier: string;
  store: 'app_store' | 'google_play';
  expires_at: string | null;
  auto_renew: boolean | null;
}

export const getIapProducts = async (): Promise<IapCatalogResponse> => {
  const response = await api.get('/iap/products');
  return response.data;
};

/** Server-side check of a store purchase; grants the tier when the store confirms it. */
export const verifyStorePurchase = async (payload: {
  platform: 'ios' | 'android';
  product_id: string;
  purchase_token: string;
}): Promise<StoreVerifyResponse> => {
  const response = await api.post('/iap/verify', payload);
  return response.data;
};
