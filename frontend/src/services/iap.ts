/**
 * Store billing on web: none. The web keeps Stripe checkout (app/premium.tsx);
 * the native implementation lives in iap.native.ts.
 */
import type { PurchaseOutcome, StoreCatalog, StoreProduct } from './iap.types';

export type { PurchaseOutcome, StoreCatalog, StoreProduct, StoreTier } from './iap.types';

export const isStoreBillingAvailable = (): boolean => false;

export async function loadStoreCatalog(): Promise<StoreCatalog> {
  return { products: [] };
}

export async function purchaseStoreProduct(_product: StoreProduct, _accountToken?: string): Promise<PurchaseOutcome> {
  throw new Error('Store billing is only available in the iOS and Android apps');
}

export async function restoreStorePurchases(): Promise<number> {
  return 0;
}

export async function syncStorePurchases(): Promise<number> {
  return 0;
}

export async function openStoreSubscriptions(_productId?: string): Promise<void> {}
