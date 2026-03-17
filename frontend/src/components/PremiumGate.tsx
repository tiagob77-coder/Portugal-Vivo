/**
 * PremiumGate - Feature gating component for premium-only features.
 * Shows an upgrade prompt with CTA to the premium page when a free user
 * tries to access a locked feature.
 *
 * Usage:
 *   <PremiumGate feature="ai_itinerary" fallback={<LockedCard />}>
 *     <PremiumContent />
 *   </PremiumGate>
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { shadows } from '../theme';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

const FEATURE_LABELS: Record<string, { title: string; desc: string; icon: string }> = {
  ai_itinerary: {
    title: 'Roteiros IA',
    desc: 'Gere itinerários personalizados com inteligência artificial',
    icon: 'auto-awesome',
  },
  audio_guides: {
    title: 'Áudio Guias',
    desc: 'Ouça narrativas em 9 vozes diferentes',
    icon: 'headphones',
  },
  offline: {
    title: 'Modo Offline',
    desc: 'Faça download de regiões para usar sem internet',
    icon: 'cloud-download',
  },
  epochs: {
    title: 'Épocas Históricas',
    desc: 'Explore a timeline interativa de Portugal',
    icon: 'history',
  },
  collections: {
    title: 'Coleções Completas',
    desc: 'Aceda a 12 coleções temáticas exclusivas',
    icon: 'collections-bookmark',
  },
  custom_routes: {
    title: 'Rotas Personalizadas',
    desc: 'Crie e partilhe as suas próprias rotas',
    icon: 'route',
  },
  export: {
    title: 'Exportar Roteiros',
    desc: 'Exporte em PDF e GPX para navegação',
    icon: 'file-download',
  },
};

interface PremiumGateProps {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  inline?: boolean; // Show inline card instead of replacing children
}

export default function PremiumGate({ feature, children, fallback, inline }: PremiumGateProps) {
  const { isPremium } = useAuth();
  const { colors: tc } = useTheme();
  const router = useRouter();

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
  };

  if (inline) {
    return (
      <TouchableOpacity
        style={[styles.inlineGate, { backgroundColor: tc.surface, borderColor: tc.borderLight }]}
        onPress={() => router.push('/premium')}
        activeOpacity={0.7}
      >
        <MaterialIcons name="lock" size={16} color="#C49A6C" />
        <Text style={[styles.inlineText, { color: tc.textMuted }]}>
          {info.title} — <Text style={{ color: '#C49A6C', fontWeight: '700' }}>Premium</Text>
        </Text>
        <MaterialIcons name="arrow-forward-ios" size={12} color="#C49A6C" />
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.gate, { backgroundColor: tc.surface }]}>
      <LinearGradient
        colors={['rgba(196,154,108,0.1)', 'rgba(196,154,108,0.03)']}
        style={styles.gateGradient}
      >
        <View style={styles.lockBadge}>
          <MaterialIcons name="lock" size={24} color="#C49A6C" />
        </View>
        <MaterialIcons name={info.icon as any} size={40} color="#C49A6C" style={{ opacity: 0.6 }} />
        <Text style={[styles.gateTitle, { color: tc.textPrimary }]}>{info.title}</Text>
        <Text style={[styles.gateDesc, { color: tc.textMuted }]}>{info.desc}</Text>
        <TouchableOpacity
          style={styles.gateCta}
          onPress={() => router.push('/premium')}
          activeOpacity={0.8}
        >
          <MaterialIcons name="diamond" size={16} color="#FFF" />
          <Text style={styles.gateCtaText}>Desbloquear com Premium</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  gate: {
    marginHorizontal: 20,
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.md,
  },
  gateGradient: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  lockBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(196,154,108,0.15)',
    borderRadius: 20,
    padding: 6,
  },
  gateTitle: {
    fontSize: 20,
    fontWeight: '800',
    fontFamily: serif,
    textAlign: 'center',
  },
  gateDesc: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  gateCta: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#C49A6C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    marginTop: 8,
  },
  gateCtaText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
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
});
