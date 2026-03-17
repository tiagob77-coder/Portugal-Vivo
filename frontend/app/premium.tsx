/**
 * Premium Subscription Page
 * Shows tier comparison, payment method selection (Card, PayPal, MB Way, Multibanco),
 * and integrates with Stripe Checkout for real payments.
 */
import React, { useState, useEffect } from 'react';
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
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { shadows } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import { useAuth } from '../src/context/AuthContext';
import {
  getPremiumTiers,
  createCheckoutSession,
  createCheckoutMBWay,
  createCheckoutMultibanco,
  createCustomerPortal,
  getSubscriptionStatus,
} from '../src/services/api';
import type { PremiumTiersResponse, SubscriptionStatus } from '../src/services/api';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

const PAYMENT_METHODS = [
  { id: 'card', name: 'Cartão', icon: 'credit-card', description: 'Visa, Mastercard, Amex' },
  { id: 'paypal', name: 'PayPal', icon: 'account-balance-wallet', description: 'Conta PayPal' },
  { id: 'mb_way', name: 'MB Way', icon: 'phone-android', description: 'Pagamento por telemóvel' },
  { id: 'multibanco', name: 'Multibanco', icon: 'account-balance', description: 'Referência MB' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const { isAuthenticated, user, refreshSubscription, isPremium } = useAuth();
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
  }, [params.success]);

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      Alert.alert('Iniciar Sessão', 'Precisa de iniciar sessão para subscrever.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Login', onPress: () => router.push('/auth') },
      ]);
      return;
    }

    if (!data?.stripe_enabled) {
      Alert.alert(
        'Brevemente',
        'O sistema de pagamentos será ativado em breve. Obrigado pelo seu interesse!',
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
    } catch (error: any) {
      const msg = error?.response?.data?.detail || 'Erro ao criar sessão de pagamento';
      Alert.alert('Erro', msg);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleManageSubscription = async () => {
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
    } catch (error: any) {
      Alert.alert('Erro', 'Não foi possível abrir o portal de gestão');
    } finally {
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
        <ActivityIndicator size="large" color="#C49A6C" style={{ marginTop: 100 }} />
      </View>
    );
  }

  const tiers = data?.tiers || [];
  const freeTier = tiers.find(t => t.id === 'free');
  const isSubscribed = subStatus && subStatus.tier !== 'free';

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
          <MaterialIcons name="diamond" size={48} color="#C49A6C" />
          <Text style={styles.heroTitle}>Portugal Vivo Premium</Text>
          <Text style={styles.heroSubtitle}>
            Desbloqueie roteiros IA, áudio guias, modo offline e muito mais
          </Text>
          {data?.trial_days && !isSubscribed ? (
            <View style={styles.trialBadge}>
              <Text style={styles.trialText}>{data.trial_days} dias grátis</Text>
            </View>
          ) : null}
        </LinearGradient>

        {/* Success Message */}
        {showSuccess && (
          <View style={styles.successBanner}>
            <MaterialIcons name="check-circle" size={24} color="#FFF" />
            <Text style={styles.successText}>Subscrição ativada com sucesso! Bem-vindo ao Premium.</Text>
          </View>
        )}

        {/* Already Subscribed */}
        {isSubscribed && (
          <View style={[styles.subscribedCard, { backgroundColor: tc.surface }]}>
            <MaterialIcons name="verified" size={28} color="#C49A6C" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.subscribedTitle, { color: tc.textPrimary }]}>
                Plano {subStatus.tier_name} ativo
              </Text>
              <Text style={[styles.subscribedDesc, { color: tc.textMuted }]}>
                Tem acesso a todas as funcionalidades premium
              </Text>
            </View>
            {data?.stripe_enabled && (
              <TouchableOpacity
                style={styles.manageBtn}
                onPress={handleManageSubscription}
                disabled={checkoutLoading}
              >
                <Text style={styles.manageBtnText}>Gerir</Text>
              </TouchableOpacity>
            )}
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
                  Mensal
                </Text>
                <Text style={[styles.tierTabPrice, selectedTier === 'premium' && styles.tierTabTextActive]}>
                  4,99€/mês
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tierTab, selectedTier === 'annual' && styles.tierTabActive]}
                onPress={() => setSelectedTier('annual')}
              >
                <Text style={[styles.tierTabText, selectedTier === 'annual' && styles.tierTabTextActive]}>
                  Anual
                </Text>
                <Text style={[styles.tierTabPrice, selectedTier === 'annual' && styles.tierTabTextActive]}>
                  39,99€/ano
                </Text>
                <View style={styles.saveBadge}>
                  <Text style={styles.saveText}>-33%</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Payment Method Selector */}
            <View style={styles.paymentSection}>
              <Text style={[styles.sectionTitle, { color: tc.textPrimary }]}>Método de Pagamento</Text>
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
                      color={selectedPayment === pm.id ? '#C49A6C' : tc.textMuted}
                    />
                    <Text style={[
                      styles.paymentName,
                      { color: selectedPayment === pm.id ? '#C49A6C' : tc.textPrimary },
                    ]}>
                      {pm.name}
                    </Text>
                    <Text style={[styles.paymentDesc, { color: tc.textMuted }]}>
                      {pm.description}
                    </Text>
                    {selectedPayment === pm.id && (
                      <View style={styles.paymentCheck}>
                        <MaterialIcons name="check-circle" size={18} color="#C49A6C" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
              {(selectedPayment === 'mb_way' || selectedPayment === 'multibanco') && (
                <Text style={[styles.paymentNote, { color: tc.textMuted }]}>
                  {selectedPayment === 'mb_way'
                    ? 'Pagamento único via MB Way. Renovação manual necessária.'
                    : 'Será gerada uma referência Multibanco para pagamento em ATM ou homebanking.'}
                </Text>
              )}
            </View>
          </>
        )}

        {/* Feature Comparison */}
        <View style={styles.comparison}>
          <Text style={[styles.sectionTitle, { color: tc.textPrimary }]}>
            Comparação de Planos
          </Text>

          {/* Column headers */}
          <View style={styles.compHeader}>
            <View style={styles.featureInfo} />
            <View style={styles.featureChecks}>
              <Text style={styles.headerLabel}>Grátis</Text>
              <Text style={[styles.headerLabel, { color: '#C49A6C', fontWeight: '700' }]}>Premium</Text>
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
                  <Text style={[styles.featureName, { color: tc.textPrimary }]}>{feature.name}</Text>
                  <Text style={[styles.featureDesc, { color: tc.textMuted }]}>{feature.description}</Text>
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
                      color={premiumFeature?.included ? '#C49A6C' : '#CBD5E1'}
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
                colors={['#C49A6C', '#B08556']}
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
                      {data?.trial_days
                        ? `Começar ${data.trial_days} Dias Grátis`
                        : 'Subscrever Premium'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={[styles.legalText, { color: tc.textMuted }]}>
              Cancele a qualquer momento. Sem compromisso.
            </Text>

            {/* Payment Security */}
            <View style={styles.securityRow}>
              <MaterialIcons name="lock" size={14} color={tc.textMuted} />
              <Text style={[styles.securityText, { color: tc.textMuted }]}>
                Pagamento seguro via Stripe. Os seus dados estão protegidos.
              </Text>
            </View>

            {/* Payment Icons Row */}
            <View style={styles.paymentIconsRow}>
              <MaterialIcons name="credit-card" size={20} color={tc.textMuted} />
              <MaterialIcons name="account-balance-wallet" size={20} color={tc.textMuted} />
              <MaterialIcons name="phone-android" size={20} color={tc.textMuted} />
              <MaterialIcons name="account-balance" size={20} color={tc.textMuted} />
            </View>
          </>
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
    backgroundColor: '#C49A6C',
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
    backgroundColor: '#C49A6C',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  manageBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },
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
    borderColor: '#C49A6C',
    borderWidth: 2,
    backgroundColor: 'rgba(196,154,108,0.05)',
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
  featureRowHighlight: { backgroundColor: 'rgba(196,154,108,0.06)', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
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
  paymentIconsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 10,
    marginBottom: 20,
  },
});
