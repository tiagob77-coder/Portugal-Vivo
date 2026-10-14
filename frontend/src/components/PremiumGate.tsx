/**
 * PremiumGate - Soft gate for premium-only features.
 *
 * Free users see a preview of the content (children) with a gradient fade
 * and a small unlock badge. Tapping opens a paywall bottom sheet that shows
 * the feature benefits and pricing tiers, with a CTA to the premium page.
 *
 * Usage:
 *   <PremiumGate feature="ai_itinerary">
 *     <PremiumContent />
 *   </PremiumGate>
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { shadows, palette, withOpacity, fontFamilies } from '../theme';

const serif = fontFamilies.serif;

// i18n keys, translated at render time.
type FeatureLabelKeys = { titleKey: string; descKey: string; icon: string; bulletKeys: string[] };

const FEATURE_LABELS: Record<string, FeatureLabelKeys> = {
  ai_itinerary: {
    titleKey: 'components.premiumGate.features.aiItinerary.title',
    descKey: 'components.premiumGate.features.aiItinerary.desc',
    icon: 'auto-awesome',
    bulletKeys: [
      'components.premiumGate.features.aiItinerary.bullet1',
      'components.premiumGate.features.aiItinerary.bullet2',
      'components.premiumGate.features.aiItinerary.bullet3',
    ],
  },
  audio_guides: {
    titleKey: 'components.premiumGate.features.audioGuides.title',
    descKey: 'components.premiumGate.features.audioGuides.desc',
    icon: 'headphones',
    bulletKeys: [
      'components.premiumGate.features.audioGuides.bullet1',
      'components.premiumGate.features.audioGuides.bullet2',
      'components.premiumGate.features.audioGuides.bullet3',
    ],
  },
  offline: {
    titleKey: 'components.premiumGate.features.offline.title',
    descKey: 'components.premiumGate.features.offline.desc',
    icon: 'cloud-download',
    bulletKeys: [
      'components.premiumGate.features.offline.bullet1',
      'components.premiumGate.features.offline.bullet2',
      'components.premiumGate.features.offline.bullet3',
    ],
  },
  epochs: {
    titleKey: 'components.premiumGate.features.epochs.title',
    descKey: 'components.premiumGate.features.epochs.desc',
    icon: 'history',
    bulletKeys: [
      'components.premiumGate.features.epochs.bullet1',
      'components.premiumGate.features.epochs.bullet2',
      'components.premiumGate.features.epochs.bullet3',
    ],
  },
  collections: {
    titleKey: 'components.premiumGate.features.collections.title',
    descKey: 'components.premiumGate.features.collections.desc',
    icon: 'collections-bookmark',
    bulletKeys: [
      'components.premiumGate.features.collections.bullet1',
      'components.premiumGate.features.collections.bullet2',
      'components.premiumGate.features.collections.bullet3',
    ],
  },
  custom_routes: {
    titleKey: 'components.premiumGate.features.customRoutes.title',
    descKey: 'components.premiumGate.features.customRoutes.desc',
    icon: 'route',
    bulletKeys: [
      'components.premiumGate.features.customRoutes.bullet1',
      'components.premiumGate.features.customRoutes.bullet2',
      'components.premiumGate.features.customRoutes.bullet3',
    ],
  },
  export: {
    titleKey: 'components.premiumGate.features.export.title',
    descKey: 'components.premiumGate.features.export.desc',
    icon: 'file-download',
    bulletKeys: [
      'components.premiumGate.features.export.bullet1',
      'components.premiumGate.features.export.bullet2',
      'components.premiumGate.features.export.bullet3',
    ],
  },
};

interface PremiumGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  inline?: boolean;
  /** How many dp of children to show before the fade. Default: 120 */
  previewHeight?: number;
}

export default function PremiumGate({
  feature,
  children,
  fallback,
  inline,
  previewHeight = 120,
}: PremiumGateProps) {
  const { t } = useTranslation();
  const { isPremium } = useAuth();
  const { colors: tc } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);

  if (isPremium) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  const labelKeys: FeatureLabelKeys = FEATURE_LABELS[feature] || {
    titleKey: 'components.premiumGate.features.fallback.title',
    descKey: 'components.premiumGate.features.fallback.desc',
    icon: 'diamond',
    bulletKeys: ['components.premiumGate.features.fallback.bullet1'],
  };
  const info = {
    title: t(labelKeys.titleKey),
    desc: t(labelKeys.descKey),
    icon: labelKeys.icon,
    bullets: labelKeys.bulletKeys.map((key) => t(key)),
  };

  if (inline) {
    return (
      <TouchableOpacity
        style={[styles.inlineGate, { backgroundColor: tc.surface, borderColor: tc.borderLight }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="lock" size={16} color={palette.filigrana[500]} />
        <Text style={[styles.inlineText, { color: tc.textMuted }]}>
          {info.title} —{' '}
          <Text style={{ color: palette.filigrana[500], fontWeight: '700' }}>Premium</Text>
        </Text>
        <MaterialIcons name="arrow-forward-ios" size={12} color={palette.filigrana[500]} />
        <PaywallSheet
          visible={sheetVisible}
          onClose={() => setSheetVisible(false)}
          onUpgrade={() => { setSheetVisible(false); router.push('/premium'); }}
          info={info}
          insets={insets}
          tc={tc}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.softGate, { minHeight: previewHeight + 60 }]}>
      {/* Clipped preview */}
      <View style={[styles.previewClip, { maxHeight: previewHeight }]} pointerEvents="none">
        {children}
      </View>

      {/* Gradient fade */}
      <LinearGradient
        colors={[withOpacity(tc.background || palette.white, 0), tc.background || palette.white]}
        style={[styles.fadeGradient, { height: previewHeight * 0.7 }]}
        pointerEvents="none"
      />

      {/* Unlock badge */}
      <TouchableOpacity
        style={[styles.unlockBadge, { backgroundColor: tc.surface, borderColor: tc.borderLight }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
      >
        <MaterialIcons name="lock" size={14} color={palette.filigrana[500]} />
        <Text style={[styles.unlockText, { color: tc.textPrimary }]}>{info.title}</Text>
        <View style={styles.unlockCta}>
          <Text style={styles.unlockCtaText}>{t('components.premiumGate.unlock')}</Text>
          <MaterialIcons name="arrow-forward-ios" size={10} color="#fff" />
        </View>
      </TouchableOpacity>

      <PaywallSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onUpgrade={() => { setSheetVisible(false); router.push('/premium'); }}
        info={info}
        insets={insets}
        tc={tc}
      />
    </View>
  );
}

// ─── Paywall Bottom Sheet ────────────────────────────────────────────────────

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  info: { title: string; desc: string; icon: string; bullets: string[] };
  insets: { bottom: number };
  tc: any;
}

function PaywallSheet({ visible, onClose, onUpgrade, info, insets, tc }: SheetProps) {
  const { t } = useTranslation();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: tc.surface, paddingBottom: Math.max(insets.bottom, 20) },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: tc.borderLight }]} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <View style={styles.sheetIconWrap}>
            <MaterialIcons name={info.icon as any} size={28} color={palette.filigrana[500]} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sheetTitle, { color: tc.textPrimary }]}>{info.title}</Text>
            <Text style={[styles.sheetDesc, { color: tc.textMuted }]}>{info.desc}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <MaterialIcons name="close" size={22} color={tc.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Bullets */}
        <View style={styles.sheetBullets}>
          {info.bullets.map((b) => (
            <View key={b} style={styles.sheetBulletRow}>
              <MaterialIcons name="check-circle" size={16} color={palette.filigrana[500]} />
              <Text style={[styles.sheetBulletText, { color: tc.textSecondary }]}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingRow}>
          <View style={[styles.priceCard, { backgroundColor: tc.background, borderColor: tc.borderLight }]}>
            <Text style={[styles.priceLabel, { color: tc.textMuted }]}>{t('components.premiumGate.monthly')}</Text>
            <Text style={[styles.priceAmount, { color: tc.textPrimary }]}>€4.99</Text>
            <Text style={[styles.pricePer, { color: tc.textMuted }]}>{t('components.premiumGate.perMonth')}</Text>
          </View>
          <View
            style={[
              styles.priceCard,
              styles.priceCardHighlight,
              { borderColor: palette.filigrana[500] },
            ]}
          >
            <Text style={[styles.priceLabel, { color: palette.filigrana[500] }]}>{t('components.premiumGate.yearly')}</Text>
            <Text style={[styles.priceAmount, { color: tc.textPrimary }]}>€39.99</Text>
            <Text style={[styles.pricePer, { color: palette.filigrana[400] }]}>{t('components.premiumGate.perYear')}</Text>
          </View>
        </View>

        {/* Trial note */}
        <Text style={[styles.trialNote, { color: tc.textMuted }]}>
          {t('components.premiumGate.trialNote')}
        </Text>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} onPress={onUpgrade} activeOpacity={0.85}>
          <MaterialIcons name="diamond" size={18} color="#fff" />
          <Text style={styles.ctaBtnText}>{t('components.premiumGate.cta')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Soft gate
  softGate: {
    overflow: 'hidden',
    position: 'relative',
  },
  previewClip: {
    overflow: 'hidden',
  },
  fadeGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 44,
  },
  unlockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    ...shadows.sm,
  },
  unlockText: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  unlockCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.filigrana[500],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  unlockCtaText: {
    color: palette.white,
    fontSize: 12,
    fontWeight: '700',
  },

  // Inline
  inlineGate: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  inlineText: {
    flex: 1,
    fontSize: 13,
  },

  // Modal backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },

  // Bottom sheet
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    ...shadows.xl,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  sheetIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: withOpacity(palette.filigrana[500], 0.12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
    fontFamily: serif,
    marginBottom: 4,
  },
  sheetDesc: {
    fontSize: 13,
    lineHeight: 19,
  },
  sheetBullets: {
    gap: 10,
    marginBottom: 20,
  },
  sheetBulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetBulletText: {
    fontSize: 14,
    lineHeight: 20,
  },

  // Pricing
  pricingRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  priceCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  priceCardHighlight: {
    backgroundColor: withOpacity(palette.filigrana[500], 0.06),
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  priceAmount: {
    fontSize: 22,
    fontWeight: '800',
  },
  pricePer: {
    fontSize: 11,
    marginTop: 2,
  },

  // Trial note
  trialNote: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
  },

  // CTA
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.filigrana[500],
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  ctaBtnText: {
    color: palette.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
