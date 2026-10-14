/**
 * Premium Subscription Page
 * Shows tier comparison and takes the payment:
 * - iOS / Android: App Store / Google Play subscriptions (required by both
 *   stores for digital content), verified by the backend (services/iap).
 * - Web: payment method selection (Card, PayPal, MB Way, Multibanco) and
 *   Stripe Checkout.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Alert,
  Linking as RNLinking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { shadows, fontFamilies } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import {
  getPremiumTiers,
  createCheckoutSession,
  createCheckoutMBWay,
  createCheckoutMultibanco,
  createCustomerPortal,
  getSubscriptionStatus,
  logPaywallIntent,
} from '../src/services/api';
import {
  isStoreBillingAvailable,
  loadStoreCatalog,
  openStoreSubscriptions,
  purchaseStoreProduct,
  restoreStorePurchases,
} from '../src/services/iap';

const serif = fontFamilies.serif;

const PAYMENT_METHODS = [
  { id: 'card', nameKey: 'premiumScreen.payment.card', icon: 'credit-card', descriptionKey: 'premiumScreen.payment.cardDesc' },
  { id: 'paypal', nameKey: 'premiumScreen.payment.paypal', icon: 'account-balance-wallet', descriptionKey: 'premiumScreen.payment.paypalDesc' },
  { id: 'mb_way', nameKey: 'premiumScreen.payment.mbway', icon: 'phone-android', descriptionKey: 'premiumScreen.payment.mbwayDesc' },
  { id: 'multibanco', nameKey: 'premiumScreen.payment.multibanco', icon: 'account-balance', descriptionKey: 'premiumScreen.payment.multibancoDesc' },
];

const STORE_NAME = Platform.OS === 'ios' ? 'App Store' : 'Google Play';

function errorDetail(error: unknown, t: TFunction, fallbackKey: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : t(fallbackKey);
}

export default function PremiumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const storeBilling = isStoreBillingAvailable();
  const { isAuthenticated, user, refreshSubscription, isPremium: _isPremium } = useAuth();
  const [selectedTier, setSelectedTier] = useState<string>('premium');
  const [selectedPayment, setSelectedPayment] = useState<string>('card');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['premium-tiers'],
    queryFn: getPremiumTiers,
  });

  const userId = (user as any)?.id || '';
  const userEmail = (user as any)?.email || '';

  const { data: subStatus } = useQuery({
    queryKey: ['subscription-status', userId],
    queryFn: () => getSubscriptionStatus(userId),
    enabled: !!userId,
  });

  // Store products with localised prices (native only). Keyed by user so the
  // account token is fetched again after signing in.
  const { data: storeCatalog } = useQuery({
    queryKey: ['store-catalog', userId],
    queryFn: loadStoreCatalog,
    enabled: storeBilling,
    retry: false,
  });
  const storeProducts = useMemo(() => storeCatalog?.products ?? [], [storeCatalog]);
  const storeProduct = storeProducts.find((p) => p.tier === selectedTier);
  const storePrice = (tier: string) => storeProducts.find((p) => p.tier === tier)?.displayPrice;

  const onSubscriptionChanged = async () => {
    setShowSuccess(true);
    await refreshSubscription();
    queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
    queryClient.invalidateQueries({ queryKey: ['premium-my-features'] });
  };

  // Handle success redirect from Stripe
  useEffect(() => {
    if (params.success === 'true') {
      setShowSuccess(true);
      refreshSubscription();
      // Clean URL
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, '/premium');
      }
    }
  }, [params.success, refreshSubscription]);

  const handleStorePurchase = async () => {
    if (!storeProduct) {
      // Store products not set up yet: same validation signal as the web paywall
      logPaywallIntent({
        tier: selectedTier,
        payment_method: Platform.OS === 'ios' ? 'app_store' : 'google_play',
        source: 'premium_screen',
      });
      Alert.alert(t('premiumScreen.comingSoonTitle'), t('premiumScreen.comingSoonMessage'), [{ text: 'OK' }]);
      return;
    }
    setCheckoutLoading(true);
    try {
      const outcome = await purchaseStoreProduct(storeProduct, storeCatalog?.accountToken);
      if (outcome.status === 'success') {
        await onSubscriptionChanged();
      } else if (outcome.status === 'pending') {
        Alert.alert(t('premiumScreen.pendingTitle'), t('premiumScreen.pendingMessage'));
      } else if (outcome.status === 'inactive') {
        Alert.alert(t('premiumScreen.errorTitle'), t('premiumScreen.storeInactive', { store: STORE_NAME }));
      }
    } catch (error) {
      Alert.alert(t('premiumScreen.errorTitle'), errorDetail(error, t, 'premiumScreen.storeError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!isAuthenticated) {
      router.push('/auth');
      return;
    }
    setCheckoutLoading(true);
    try {
      const active = await restoreStorePurchases();
      if (active > 0) {
        await onSubscriptionChanged();
      } else {
        Alert.alert(t('premiumScreen.restoreTitle'), t('premiumScreen.restoreNone', { store: STORE_NAME }));
      }
    } catch (error) {
      Alert.alert(t('premiumScreen.errorTitle'), errorDetail(error, t, 'premiumScreen.storeError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      Alert.alert(t('premiumScreen.signInTitle'), t('premiumScreen.signInMessage'), [
        { text: t('premiumScreen.cancel'), style: 'cancel' },
        { text: t('premiumScreen.login'), onPress: () => router.push('/auth') },
      ]);
      return;
    }

    if (storeBilling) {
      await handleStorePurchase();
      return;
    }

    if (!data?.stripe_enabled) {
      // Track intent signal for revenue model validation
      logPaywallIntent({
        tier: selectedTier,
        payment_method: selectedPayment,
        source: 'premium_screen',
      });
      Alert.alert(
        t('premiumScreen.comingSoonTitle'),
        t('premiumScreen.comingSoonMessage'),
        [{ text: 'OK' }]
      );
      return;
    }

    setCheckoutLoading(true);
    try {
      let result;
      if (selectedPayment === 'mb_way') {
        result = await createCheckoutMBWay(userId, userEmail, selectedTier);
      } else if (selectedPayment === 'multibanco') {
        result = await createCheckoutMultibanco(userId, userEmail, selectedTier);
      } else {
        // card + paypal go through standard checkout
        result = await createCheckoutSession(userId, userEmail, selectedTier);
      }

      if (result.checkout_url) {
        if (Platform.OS === 'web') {
          window.location.href = result.checkout_url;
        } else {
          await RNLinking.openURL(result.checkout_url);
        }
      }
    } catch (error) {
      Alert.alert(t('premiumScreen.errorTitle'), errorDetail(error, t, 'premiumScreen.checkoutError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    if (subStatus?.store) {
      // Store subscriptions are managed (and cancelled) in the store itself
      try {
        await openStoreSubscriptions(storeProducts.find((p) => p.tier === subStatus.tier)?.productId);
      } catch {
        Alert.alert(t('premiumScreen.errorTitle'), t('premiumScreen.manageStoreError', { store: STORE_NAME }));
      }
      return;
    }
    try {
      setCheckoutLoading(true);
      const result = await createCustomerPortal(userId);
      if (result.portal_url) {
        if (Platform.OS === 'web') {
          window.location.href = result.portal_url;
        } else {
          await RNLinking.openURL(result.portal_url);
        }
      }
    } catch {
      Alert.alert(t('premiumScreen.errorTitle'), t('premiumScreen.portalError'));
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
        <ActivityIndicator size="large" color="#C9A24B" style={{ marginTop: 100 }} />
      </View>
    );
  }

  const tiers = data?.tiers || [];
  const freeTier = tiers.find(t => t.id === 'free');
  const isSubscribed = subStatus && subStatus.tier !== 'free';
  const canManage = subStatus?.store ? storeBilling : !!data?.stripe_enabled;
  // The stores run their own trials (introductory offers); the web trial is Stripe's.
  const trialDays = storeBilling ? 0 : data?.trial_days;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <LinearGradient
          colors={['#1E3A3F', '#2A5F6B']}
          style={styles.hero}
        >
          <MaterialIcons name="diamond" size={48} color="#C9A24B" />
          <Text style={styles.heroTitle}>Portugal Vivo Premium</Text>
          <Text style={styles.heroSubtitle}>
            {t('premiumScreen.heroSubtitle')}
          </Text>
          {trialDays && !isSubscribed ? (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>{t('premiumScreen.trialDays', { days: trialDays })}</Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Success Message */}
        {showSuccess && (
          <View style={styles.successBanner}>
            <MaterialIcons name="check-circle" size={24} color="#FFF" />
            <Text style={styles.successText}>{t('premiumScreen.success')}</Text>
          </View>
        )}

        {/* Already Subscribed */}
        {isSubscribed && (
          <View style={[styles.subscribedCard, { backgroundColor: tc.surface }]}>
            <MaterialIcons name="verified" size={28} color="#C9A24B" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.subscribedTitle, { color: tc.textPrimary }]}>
                {t('premiumScreen.activePlan', { name: subStatus.tier_name })}
              </Text>
              <Text style={[styles.subscribedDesc, { color: tc.textMuted }]}>
                {subStatus.store
                  ? t('premiumScreen.activeViaStore', { store: subStatus.store === 'app_store' ? 'App Store' : 'Google Play' })
                  : t('premiumScreen.activeDesc')}
              </Text>
            </View>
            {canManage && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={handleManageSubscription}
                disabled={checkoutLoading}
              >
                <Text style={styles.manageBtnText}>{t('premiumScreen.manage')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* MB Way / Multibanco renewal warning */}
        {isSubscribed && subStatus?.requires_manual_renewal && (
          <View style={[styles.renewalWarning, {
            backgroundColor: (subStatus?.days_until_expiry ?? 99) <= 7 ? '#FEF3C7' : '#FFF7ED',
            borderColor: (subStatus?.days_until_expiry ?? 99) <= 7 ? '#F59E0B' : '#FDBA74',
          }]}>
            <MaterialIcons
              name={(subStatus?.days_until_expiry ?? 99) <= 7 ? 'warning' : 'info'}
              size={18}
              color={(subStatus?.days_until_expiry ?? 99) <= 7 ? '#D97706' : '#EA580C'}
            />
            <Text style={[styles.renewalWarningText, {
              color: (subStatus?.days_until_expiry ?? 99) <= 7 ? '#92400E' : '#9A3412',
            }]}>
              {(subStatus?.days_until_expiry ?? 99) <= 7
                ? t('premiumScreen.expiresSoon', { days: subStatus?.days_until_expiry ?? 0 })
                : t('premiumScreen.manualRenewal')}
            </Text>
          </View>
        )}

        {/* Tier Toggle */}
        {!isSubscribed && (
          <>
            <View style={styles.tierToggle}>
              <TouchableOpacity
                style={[styles.tierTab, selectedTier === 'premium' && styles.tierTabActive]}
                onPress={() => setSelectedTier('premium')}
              >
                <Text style={[styles.tierTabText, selectedTier === 'premium' && styles.tierTabTextActive]}>
                  {t('premiumScreen.monthly')}
                </Text>
                <Text style={[styles.tierTabPrice, selectedTier === 'premium' && styles.tierTabTextActive]}>
                  {storePrice('premium')
                    ? t('premiumScreen.pricePerMonth', { price: storePrice('premium') })
                    : t('premiumScreen.monthlyPrice')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tierTab, selectedTier === 'annual' && styles.tierTabActive]}
                onPress={() => setSelectedTier('annual')}
              >
                <Text style={[styles.tierTabText, selectedTier === 'annual' && styles.tierTabTextActive]}>
                  {t('premiumScreen.annual')}
                </Text>
                <Text style={[styles.tierTabPrice, selectedTier === 'annual' && styles.tierTabTextActive]}>
                  {storePrice('annual')
                    ? t('premiumScreen.pricePerYear', { price: storePrice('annual') })
                    : t('premiumScreen.annualPrice')}
                </Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>-33%</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Payment Method Selector (web only: the stores take the payment in the apps) */}
            {!storeBilling && (
            <View style={styles.paymentSection}>
              <Text style={[styles.sectionTitle, { color: tc.textPrimary }]}>{t('premiumScreen.paymentMethod')}</Text>
              <View style={styles.paymentGrid}>
                {PAYMENT_METHODS.map((pm) => (
                  <TouchableOpacity
                    key={pm.id}
                    style={[
                      styles.paymentCard,
                      { backgroundColor: tc.surface, borderColor: tc.borderLight },
                      selectedPayment === pm.id && styles.paymentCardActive,
                    ]}
                    onPress={() => setSelectedPayment(pm.id)}
                  >
                    <MaterialIcons
                      name={pm.icon as any}
                      size={24}
                      color={selectedPayment === pm.id ? '#C9A24B' : tc.textMuted}
                    />
                    <Text style={[
                      styles.paymentName,
                      { color: selectedPayment === pm.id ? '#C9A24B' : tc.textPrimary },
                    ]}>
                      {t(pm.nameKey)}
                    </Text>
                    <Text style={[styles.paymentDesc, { color: tc.textMuted }]}>
                      {t(pm.descriptionKey)}
                    </Text>
                    {selectedPayment === pm.id && (
                      <View style={styles.paymentCheck}>
                        <MaterialIcons name="check-circle" size={18} color="#C9A24B" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {(selectedPayment === 'mb_way' || selectedPayment === 'multibanco') && (
                <Text style={[styles.paymentNote, { color: tc.textMuted }]}>
                  {selectedPayment === 'mb_way'
                    ? t('premiumScreen.payment.mbwayNote')
                    : t('premiumScreen.payment.multibancoNote')}
                </Text>
              )}
            </View>
            )}
          </>
        )}

        {/* Feature Comparison */}
        <View style={styles.comparison}>
          <Text style={[styles.sectionTitle, { color: tc.textPrimary }]}>
            {t('premiumScreen.comparison')}
          </Text>

          {/* Column headers */}
          <View style={styles.compHeader}>
            <View style={styles.featureInfo} />
            <View style={styles.featureChecks}>
              <Text style={styles.headerLabel}>{t('premiumScreen.free')}</Text>
              <Text style={[styles.headerLabel, { color: '#C9A24B', fontWeight: '700' }]}>Premium</Text>
            </View>
          </View>

          {/* Feature rows */}
          {freeTier?.features.map((feature) => {
            const activeTier = tiers.find(t => t.id === (isSubscribed ? subStatus?.tier : selectedTier));
            const premiumFeature = activeTier?.features.find(f => f.id === feature.id);
            const isPremiumOnly = !feature.included && premiumFeature?.included;

            return (
              <View key={feature.id} style={[styles.featureRow, isPremiumOnly && styles.featureRowHighlight]}>
                <View style={styles.featureInfo}>
                  <Text style={[styles.featureName, { color: tc.textPrimary }]}>
                    {t(`premiumScreen.features.${feature.id}.name`, { defaultValue: feature.name })}
                  </Text>
                  <Text style={[styles.featureDesc, { color: tc.textMuted }]}>
                    {t(`premiumScreen.features.${feature.id}.description`, { defaultValue: feature.description })}
                  </Text>
                </View>
                <View style={styles.featureChecks}>
                  <View style={styles.checkCol}>
                    <MaterialIcons
                      name={feature.included ? 'check-circle' : 'cancel'}
                      size={20}
                      color={feature.included ? '#22C55E' : '#CBD5E1'}
                    />
                  </View>
                  <View style={styles.checkCol}>
                    <MaterialIcons
                      name={premiumFeature?.included ? 'check-circle' : 'cancel'}
                      size={20}
                      color={premiumFeature?.included ? '#C9A24B' : '#CBD5E1'}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* CTA */}
        {!isSubscribed && (
          <>
            <TouchableOpacity
              style={[styles.ctaButton, checkoutLoading && { opacity: 0.6 }]}
              onPress={handleSubscribe}
              activeOpacity={0.8}
              disabled={checkoutLoading}
            >
              <LinearGradient
                colors={['#C9A24B', '#B08B3C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {checkoutLoading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <MaterialIcons name="diamond" size={22} color="#FFF" />
                    <Text style={styles.ctaText}>
                      {trialDays
                        ? t('premiumScreen.startTrial', { days: trialDays })
                        : t('premiumScreen.subscribe')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.legalText, { color: tc.textMuted }]}>
              {t('premiumScreen.cancelAnytime')}
            </Text>

            {/* Payment Security */}
            <View style={styles.securityRow}>
              <MaterialIcons name="lock" size={14} color={tc.textMuted} />
              <Text style={[styles.securityText, { color: tc.textMuted }]}>
                {storeBilling ? t('premiumScreen.storeSecure', { store: STORE_NAME }) : t('premiumScreen.stripeSecure')}
              </Text>
            </View>

            {storeBilling ? (
              <>
                {/* Auto-renewal terms the stores require next to the purchase button */}
                <Text style={[styles.disclosureText, { color: tc.textMuted }]}>
                  {t('premiumScreen.autoRenewDisclosure', { store: STORE_NAME })}
                </Text>
                <View style={styles.legalLinks}>
                  <TouchableOpacity onPress={() => router.push('/terms')} accessibilityRole="link">
                    <Text style={styles.legalLink}>{t('premiumScreen.terms')}</Text>
                  </TouchableOpacity>
                  <Text style={[styles.legalSeparator, { color: tc.textMuted }]}>·</Text>
                  <TouchableOpacity onPress={() => router.push('/privacy')} accessibilityRole="link">
                    <Text style={styles.legalLink}>{t('premiumScreen.privacy')}</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* Payment Icons Row */
              <View style={styles.paymentIconsRow}>
                <MaterialIcons name="credit-card" size={20} color={tc.textMuted} />
                <MaterialIcons name="account-balance-wallet" size={20} color={tc.textMuted} />
                <MaterialIcons name="phone-android" size={20} color={tc.textMuted} />
                <MaterialIcons name="account-balance" size={20} color={tc.textMuted} />
              </View>
            )}
          </>
        )}

        {/* Restore purchases (required by Apple for subscriptions) */}
        {storeBilling && (
          <TouchableOpacity
            style={styles.restoreBtn}
            onPress={handleRestore}
            disabled={checkoutLoading}
            accessibilityRole="button"
          >
            <Text style={[styles.restoreText, { color: tc.textMuted }]}>{t('premiumScreen.restore')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingBottom: 40 },
  backBtn: { position: 'absolute', top: 12, left: 16, zIndex: 10, padding: 8 },
  hero: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 12,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFF',
    fontFamily: serif,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 22,
  },
  trialBadge: {
    backgroundColor: '#C9A24B',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
  },
  trialText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22C55E',
    marginHorizontal: 20,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  successText: { color: '#FFF', fontWeight: '600', fontSize: 14, flex: 1 },
  subscribedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    gap: 12,
    ...shadows.sm,
  },
  subscribedTitle: { fontSize: 16, fontWeight: '700' },
  subscribedDesc: { fontSize: 12, marginTop: 2 },
  manageBtn: {
    backgroundColor: '#C9A24B',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
  renewalWarning: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 20, marginTop: 10,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  renewalWarningText: { flex: 1, fontSize: 13, lineHeight: 18 },
  tierToggle: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
  },
  tierTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 2,
  },
  tierTabActive: { backgroundColor: '#FFF', ...shadows.sm },
  tierTabText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  tierTabTextActive: { color: '#1F2937' },
  tierTabPrice: { fontSize: 12, color: '#94A3B8' },
  saveBadge: {
    position: 'absolute',
    top: -4,
    right: 8,
    backgroundColor: '#22C55E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  saveText: { color: '#FFF', fontSize: 9, fontWeight: '700' },
  // Payment Methods
  paymentSection: { marginTop: 24, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  paymentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  paymentCard: {
    width: '48%' as any,
    flexBasis: '47%',
    flexGrow: 0,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  paymentCardActive: {
    borderColor: '#C9A24B',
    borderWidth: 2,
    backgroundColor: 'rgba(201,162,75,0.05)',
  },
  paymentName: { fontSize: 14, fontWeight: '700' },
  paymentDesc: { fontSize: 10, textAlign: 'center' },
  paymentCheck: { position: 'absolute', top: 6, right: 6 },
  paymentNote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 16,
  },
  // Comparison
  comparison: { marginTop: 24, paddingHorizontal: 20 },
  compHeader: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  headerLabel: { width: 60, textAlign: 'center', fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  featureRowHighlight: { backgroundColor: 'rgba(201,162,75,0.06)', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
  featureInfo: { flex: 1 },
  featureName: { fontSize: 14, fontWeight: '600' },
  featureDesc: { fontSize: 11, marginTop: 2 },
  featureChecks: { flexDirection: 'row', gap: 20 },
  checkCol: { width: 40, alignItems: 'center' },
  // CTA
  ctaButton: { marginHorizontal: 20, marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  ctaText: { fontSize: 18, fontWeight: '700', color: '#FFF' },
  legalText: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 12,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  securityText: { fontSize: 11 },
  disclosureText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  legalLink: { fontSize: 12, color: '#C9A24B', fontWeight: '600', textDecorationLine: 'underline' },
  legalSeparator: { fontSize: 12 },
  restoreBtn: { alignSelf: 'center', marginTop: 16, marginBottom: 24, padding: 8 },
  restoreText: { fontSize: 13, textDecorationLine: 'underline' },
  paymentIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 20,
  },
});
