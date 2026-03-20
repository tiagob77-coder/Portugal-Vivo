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
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { shadows, palette, withOpacity } from '../theme';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

const FEATURE_LABELS: Record<string, { title: string; desc: string; icon: string; bullets: string[] }> = {
  ai_itinerary: {
    title: 'Roteiros IA',
    desc: 'Gere itinerários personalizados com inteligência artificial',
    icon: 'auto-awesome',
    bullets: ['Roteiros adaptados ao teu perfil', 'Atualização em tempo real', 'Exportação PDF e GPX'],
  },
  audio_guides: {
    title: 'Áudio Guias',
    desc: 'Ouça narrativas imersivas em 9 vozes diferentes',
    icon: 'headphones',
    bullets: ['9 vozes e estilos narrativos', 'Funciona offline', 'Narração em português e inglês'],
  },
  offline: {
    title: 'Modo Offline',
    desc: 'Faça download de regiões para explorar sem internet',
    icon: 'cloud-download',
    bullets: ['Download de mapas e POIs', 'Narrativas disponíveis offline', 'Sincronização automática'],
  },
  epochs: {
    title: 'Épocas Históricas',
    desc: 'Explore a timeline interativa de Portugal',
    icon: 'history',
    bullets: ['Da pré-história ao séc. XXI', 'Filtros por período no mapa', 'Conteúdo exclusivo por época'],
  },
  collections: {
    title: 'Coleções Completas',
    desc: 'Aceda a 12 coleções temáticas exclusivas',
    icon: 'collections-bookmark',
    bullets: ['12 coleções temáticas', 'Rotas pré-definidas', 'Actualizadas mensalmente'],
  },
  custom_routes: {
    title: 'Rotas Personalizadas',
    desc: 'Crie e partilhe as suas próprias rotas',
    icon: 'route',
    bullets: ['Editor de rotas arrastar-e-largar', 'Partilha com amigos', 'Importação de GPX'],
  },
  export: {
    title: 'Exportar Roteiros',
    desc: 'Exporte em PDF e GPX para navegação',
    icon: 'file-download',
    bullets: ['PDF formatado para impressão', 'GPX para GPS e Garmin', 'Histórico de exportações'],
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

  const info = FEATURE_LABELS[feature] || {
    title: 'Funcionalidade Premium',
    desc: 'Esta funcionalidade requer uma subscrição premium',
    icon: 'diamond',
    bullets: ['Acesso completo a todas as funcionalidades'],
  };

  if (inline) {
    return (
      <TouchableOpacity
        style={[styles.inlineGate, { backgroundColor: tc.surface, borderColor: tc.borderLight }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="lock" size={16} color={palette.terracotta[500]} />
        <Text style={[styles.inlineText, { color: tc.textMuted }]}>
          {info.title} —{' '}
          <Text style={{ color: palette.terracotta[500], fontWeight: '700' }}>Premium</Text>
        </Text>
        <MaterialIcons name="arrow-forward-ios" size={12} color={palette.terracotta[500]} />
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
        colors={[withOpacity(tc.background || '#fff', 0), tc.background || '#fff']}
        style={[styles.fadeGradient, { height: previewHeight * 0.7 }]}
        pointerEvents="none"
      />

      {/* Unlock badge */}
      <TouchableOpacity
        style={[styles.unlockBadge, { backgroundColor: tc.surface, borderColor: tc.borderLight }]}
        onPress={() => setSheetVisible(true)}
        activeOpacity={0.85}
      >
        <MaterialIcons name="lock" size={14} color={palette.terracotta[500]} />
        <Text style={[styles.unlockText, { color: tc.textPrimary }]}>{info.title}</Text>
        <View style={styles.unlockCta}>
          <Text style={styles.unlockCtaText}>Desbloquear</Text>
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
            <MaterialIcons name={info.icon as any} size={28} color={palette.terracotta[500]} />
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
              <MaterialIcons name="check-circle" size={16} color={palette.terracotta[500]} />
              <Text style={[styles.sheetBulletText, { color: tc.textSecondary }]}>{b}</Text>
            </View>
          ))}
        </View>

        {/* Pricing */}
        <View style={styles.pricingRow}>
          <View style={[styles.priceCard, { backgroundColor: tc.background, borderColor: tc.borderLight }]}>
            <Text style={[styles.priceLabel, { color: tc.textMuted }]}>MENSAL</Text>
            <Text style={[styles.priceAmount, { color: tc.textPrimary }]}>€4.99</Text>
            <Text style={[styles.pricePer, { color: tc.textMuted }]}>/mês</Text>
          </View>
          <View
            style={[
              styles.priceCard,
              styles.priceCardHighlight,
              { borderColor: palette.terracotta[500] },
            ]}
          >
            <Text style={[styles.priceLabel, { color: palette.terracotta[500] }]}>ANUAL</Text>
            <Text style={[styles.priceAmount, { color: tc.textPrimary }]}>€39.99</Text>
            <Text style={[styles.pricePer, { color: palette.terracotta[400] }]}>/ano · -33%</Text>
          </View>
        </View>

        {/* Trial note */}
        <Text style={[styles.trialNote, { color: tc.textMuted }]}>
          7 dias grátis · Cancela quando quiseres
        </Text>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaBtn} onPress={onUpgrade} activeOpacity={0.85}>
          <MaterialIcons name="diamond" size={18} color="#fff" />
          <Text style={styles.ctaBtnText}>Experimentar Descobridor</Text>
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
    backgroundColor: palette.terracotta[500],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 4,
  },
  unlockCtaText: {
    color: '#fff',
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
    backgroundColor: withOpacity(palette.terracotta[500], 0.12),
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
    backgroundColor: withOpacity(palette.terracotta[500], 0.06),
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
    backgroundColor: palette.terracotta[500],
    paddingVertical: 14,
    borderRadius: 14,
    gap: 10,
  },
  ctaBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
