/**
 * Store billing for the iOS and Android apps (StoreKit 2 / Play Billing via
 * expo-iap). Apple and Google require digital subscriptions bought in the app
 * to go through their stores; the web keeps Stripe.
 *
 * Every purchase is confirmed by the backend (/iap/verify) before the
 * transaction is finished, so a purchase the server never saw is replayed by
 * the store and verified on the next sync instead of being lost.
 */
import { Platform } from 'react-native';
import {
  deepLinkToSubscriptions,
  fetchProducts,
  finishTransaction,
  getAvailablePurchases,
  initConnection,
  isUserCancelledError,
  purchaseErrorListener,
  purchaseUpdatedListener,
  requestPurchase,
  restorePurchases,
  type ProductSubscription,
  type Purchase,
} from 'expo-iap';
import { getIapProducts, verifyStorePurchase, type StoreVerifyResponse } from './api';
import logger from '../utils/logger';
import type { PurchaseOutcome, StoreCatalog, StoreProduct } from './iap.types';

export type { PurchaseOutcome, StoreCatalog, StoreProduct, StoreTier } from './iap.types';

const PURCHASE_TIMEOUT_MS = 5 * 60_000;
const ANDROID_PACKAGE = 'pt.portugalvivo';

let connection: Promise<unknown> | null = null;

function ensureConnection(): Promise<unknown> {
  if (!connection) {
    connection = initConnection().catch((error: unknown) => {
      connection = null;
      throw error;
    });
  }
  return connection;
}

export const isStoreBillingAvailable = (): boolean => Platform.OS === 'ios' || Platform.OS === 'android';

const storePlatform = (): 'ios' | 'android' => (Platform.OS === 'ios' ? 'ios' : 'android');

/** Our products with the store's localised prices. Products the store doesn't know are left out. */
export async function loadStoreCatalog(): Promise<StoreCatalog> {
  const catalog = await getIapProducts();
  await ensureConnection();
  const skus = catalog.products.map((p) => p.product_id);
  const found = ((await fetchProducts({ skus, type: 'subs' })) ?? []) as ProductSubscription[];
  const byId = new Map(found.map((p) => [p.id, p]));
  const products: StoreProduct[] = [];
  for (const entry of catalog.products) {
    const product = byId.get(entry.product_id);
    if (!product) continue;
    const offerToken = product.platform === 'android'
      ? product.subscriptionOffers?.find((o) => o.offerTokenAndroid)?.offerTokenAndroid ?? null
      : null;
    products.push({
      tier: entry.tier,
      productId: entry.product_id,
      title: product.displayName || product.title,
      displayPrice: product.displayPrice,
      offerToken,
    });
  }
  return { products, accountToken: catalog.account_token };
}

/** Resolves with the store's purchase result for `productId` (purchases are event-based). */
function listenForPurchase(productId: string): { result: Promise<Purchase>; stop: () => void } {
  let stop = () => {};
  const result = new Promise<Purchase>((resolve, reject) => {
    const updated = purchaseUpdatedListener((purchase) => {
      if (purchase.productId !== productId) return;
      stop();
      resolve(purchase);
    });
    const failed = purchaseErrorListener((error) => {
      stop();
      reject(error);
    });
    const timer = setTimeout(() => {
      stop();
      reject(new Error('Store purchase timed out'));
    }, PURCHASE_TIMEOUT_MS);
    stop = () => {
      updated.remove();
      failed.remove();
      clearTimeout(timer);
    };
  });
  return { result, stop };
}

/** Verify on the server, then finish the transaction (acknowledges it on Play). */
async function confirmPurchase(purchase: Purchase): Promise<StoreVerifyResponse> {
  if (!purchase.purchaseToken) throw new Error('Store purchase without a token');
  const verified = await verifyStorePurchase({
    platform: storePlatform(),
    product_id: purchase.productId,
    purchase_token: purchase.purchaseToken,
  });
  await finishTransaction({ purchase, isConsumable: false });
  return verified;
}

export async function purchaseStoreProduct(product: StoreProduct, accountToken?: string): Promise<PurchaseOutcome> {
  await ensureConnection();
  const pending = listenForPurchase(product.productId);
  let purchase: Purchase;
  try {
    await requestPurchase({
      type: 'subs',
      request: {
        apple: { sku: product.productId, appAccountToken: accountToken ?? null },
        google: {
          skus: [product.productId],
          obfuscatedAccountId: accountToken ?? null,
          subscriptionOffers: product.offerToken
            ? [{ sku: product.productId, offerToken: product.offerToken }]
            : null,
        },
      },
    });
    purchase = await pending.result;
  } catch (error) {
    pending.stop();
    if (isUserCancelledError(error)) return { status: 'cancelled' };
    throw error;
  }
  if (purchase.purchaseState === 'pending') return { status: 'pending' };
  const verified = await confirmPurchase(purchase);
  return verified.active ? { status: 'success', tier: verified.tier } : { status: 'inactive' };
}

async function verifyHeldPurchases(): Promise<number> {
  const [catalog, purchases] = await Promise.all([getIapProducts(), getAvailablePurchases()]);
  const ours = new Set(catalog.products.map((p) => p.product_id));
  let active = 0;
  for (const purchase of purchases ?? []) {
    if (!ours.has(purchase.productId) || purchase.purchaseState === 'pending') continue;
    try {
      if ((await confirmPurchase(purchase)).active) active += 1;
    } catch (error) {
      logger.warn('[iap] could not verify a held purchase', error);
    }
  }
  return active;
}

/** "Restaurar compras": asks the store to sync (may prompt for the Apple ID), then re-verifies. */
export async function restoreStorePurchases(): Promise<number> {
  await ensureConnection();
  await restorePurchases();
  return verifyHeldPurchases();
}

/**
 * Silent sync at sign-in: re-sends the purchases the store still holds, which
 * credits a purchase whose verification failed and refreshes renewals when a
 * store notification was missed. Never prompts and never throws.
 */
export async function syncStorePurchases(): Promise<number> {
  try {
    await ensureConnection();
    return await verifyHeldPurchases();
  } catch (error) {
    logger.warn('[iap] store sync skipped', error);
    return 0;
  }
}

/** Opens the store's subscription management page. */
export async function openStoreSubscriptions(productId?: string): Promise<void> {
  await ensureConnection();
  await deepLinkToSubscriptions({ skuAndroid: productId ?? null, packageNameAndroid: ANDROID_PACKAGE });
}
