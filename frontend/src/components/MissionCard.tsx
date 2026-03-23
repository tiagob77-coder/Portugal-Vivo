/**
 * MissionCard — Card de missão semanal de gamificação
 *
 * Mostra o título, descrição, progresso e recompensa.
 * Botão de "Reclamar" quando completa.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { shadows, palette } from '../theme';
import { useTheme } from '../context/ThemeContext';

export interface Mission {
  mission_id: string;
  title: string;
  description: string;
  icon: string;            // MaterialIcons name
  type: string;
  target_value: number;
  reward_xp: number;
  reward_badge?: string;
  expires_at: string;      // ISO date
  progress?: number;       // 0..target_value
  completed?: boolean;
  claimed?: boolean;
}

interface MissionCardProps {
  mission: Mission;
  onClaim?: (missionId: string) => void;
  onPress?: (mission: Mission) => void;
}

export default function MissionCard({ mission, onClaim, onPress }: MissionCardProps) {
  const { colors } = useTheme();
  const progress = mission.progress ?? 0;
  const pct = Math.min((progress / mission.target_value) * 100, 100);
  const isComplete = mission.completed || pct >= 100;
  const isClaimed = mission.claimed ?? false;

  // Dias restantes
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(mission.expires_at).getTime() - Date.now()) / 86_400_000
  ));

  const accentColor = isComplete
    ? '#22C55E'
    : daysLeft <= 1
      ? '#EF4444'
      : palette.terracotta[500];

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: colors.surface }, isClaimed && s.cardClaimed]}
      onPress={() => onPress?.(mission)}
      activeOpacity={0.85}
    >
      {/* Ícone + header */}
      <View style={s.top}>
        <View style={[s.iconWrap, { backgroundColor: accentColor + '20' }]}>
          <MaterialIcons name={mission.icon as any} size={22} color={accentColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.title, { color: colors.textPrimary }]} numberOfLines={1}>
            {mission.title}
          </Text>
          <Text style={[s.desc, { color: colors.textMuted }]} numberOfLines={2}>
            {mission.description}
          </Text>
        </View>
        {/* Badge de expiração */}
        {!isComplete && (
          <View style={[s.expiry, { backgroundColor: daysLeft <= 1 ? '#FEE2E2' : colors.background }]}>
            <Text style={[s.expiryText, { color: daysLeft <= 1 ? '#EF4444' : colors.textMuted }]}>
              {daysLeft === 0 ? 'Hoje!' : `${daysLeft}d`}
            </Text>
          </View>
        )}
      </View>

      {/* Barra de progresso */}
      <View style={s.progressWrap}>
        <View style={[s.progressTrack, { backgroundColor: colors.borderLight }]}>
          <View style={[s.progressFill, { width: `${pct}%` as any, backgroundColor: accentColor }]} />
        </View>
        <Text style={[s.progressText, { color: colors.textMuted }]}>
          {progress}/{mission.target_value}
        </Text>
      </View>

      {/* Footer: recompensa + botão */}
      <View style={s.footer}>
        {/* Recompensa */}
        <View style={s.rewards}>
          <View style={s.rewardChip}>
            <MaterialIcons name="bolt" size={13} color="#F59E0B" />
            <Text style={s.rewardText}>{mission.reward_xp} XP</Text>
          </View>
          {mission.reward_badge && (
            <View style={[s.rewardChip, { backgroundColor: '#EDE9FE' }]}>
              <MaterialIcons name="military-tech" size={13} color="#7C3AED" />
              <Text style={[s.rewardText, { color: '#7C3AED' }]}>Badge</Text>
            </View>
          )}
        </View>

        {/* Estado / Botão */}
        {isClaimed ? (
          <View style={s.claimedBadge}>
            <MaterialIcons name="check-circle" size={14} color="#22C55E" />
            <Text style={s.claimedText}>Completo</Text>
          </View>
        ) : isComplete ? (
          <TouchableOpacity
            style={[s.claimBtn, { backgroundColor: accentColor }]}
            onPress={() => onClaim?.(mission.mission_id)}
          >
            <MaterialIcons name="card-giftcard" size={14} color="#fff" />
            <Text style={s.claimBtnText}>Reclamar</Text>
          </TouchableOpacity>
        ) : (
          <LinearGradient
            colors={[accentColor + '30', accentColor + '10']}
            style={s.inProgress}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={[s.inProgressText, { color: accentColor }]}>{Math.round(pct)}%</Text>
          </LinearGradient>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 14, gap: 10, ...shadows.sm,
    marginBottom: 10,
  },
  cardClaimed: { opacity: 0.65 },

  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  iconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  desc: { fontSize: 12, lineHeight: 17 },
  expiry: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  expiryText: { fontSize: 11, fontWeight: '700' },

  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  progressText: { fontSize: 11, width: 44, textAlign: 'right' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rewards: { flexDirection: 'row', gap: 6 },
  rewardChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FEF3C7', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8,
  },
  rewardText: { fontSize: 11, fontWeight: '600', color: '#92400E' },

  claimedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  claimedText: { fontSize: 12, color: '#22C55E', fontWeight: '600' },

  claimBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  claimBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  inProgress: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
  },
  inProgressText: { fontSize: 12, fontWeight: '700' },
});
