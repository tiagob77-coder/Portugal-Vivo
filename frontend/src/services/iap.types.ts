/** Shared types for the store billing service (iap.native.ts / iap.ts). */
export type StoreTier = 'premium' | 'annual';

export interface StoreProduct {
  tier: StoreTier;
  productId: string;
  title: string;
  /** Localised price from the store, e.g. "4,99 €" or "$4.99". */
  displayPrice: string;
  /** Android base-plan offer token required by Play Billing for subscriptions. */
  offerToken?: string | null;
}

export interface StoreCatalog {
  products: StoreProduct[];
  accountToken?: string;
}

export type PurchaseOutcome =
  | { status: 'success'; tier: string }
  /** Payment awaiting approval (Ask to Buy, slow payment method). */
  | { status: 'pending' }
  | { status: 'cancelled' }
  /** The store answered but the subscription is not active (expired, on hold). */
  | { status: 'inactive' };
