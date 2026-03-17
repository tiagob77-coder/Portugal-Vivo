/**
 * Streak Tracker - Shows current streak, milestones, and weekly progress
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { API_BASE } from '../config/api';
import axios from 'axios';
import { palette, withOpacity } from '../theme/colors';

interface StreakTrackerProps {
  userId: string;
  compact?: boolean;
}

export default function StreakTracker({ userId, compact = false }: StreakTrackerProps) {
  const { data: streak } = useQuery({
    queryKey: ['streak', userId],
    queryFn: async () => {
      const res = await axios.get(`${API_BASE}/gamification/streaks/${userId}`);
      return res.data;
    },
    enabled: !!userId,
    staleTime: 60000,
  });

  if (!streak) return null;

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <MaterialIcons
          name="local-fire-department"
          size={18}
          color={streak.current_streak > 0 ? '#EF4444' : '#64748B'}
        />
        <Text style={[
          styles.compactStreak,
          { color: streak.current_streak > 0 ? '#EF4444' : '#64748B' },
        ]}>
          {streak.current_streak}
        </Text>
      </View>
    );
  }

  const nextMilestone = streak.streak_milestones?.find((m: any) => !m.earned);

  return (
    <View style={styles.container}>
      {/* Streak Header */}
      <View style={styles.header}>
        <View style={styles.streakInfo}>
          <MaterialIcons
            name="local-fire-department"
            size={32}
            color={streak.current_streak > 0 ? '#EF4444' : '#64748B'}
          />
          <View>
            <Text style={styles.streakCount}>{streak.current_streak} dias</Text>
            <Text style={styles.streakLabel}>
              {streak.streak_alive
                ? `Faltam ${Math.round(streak.hours_remaining)}h para manter`
                : 'Visita um local para começar!'}
            </Text>
          </View>
        </View>
        <View style={styles.longestStreak}>
          <Text style={styles.longestValue}>{streak.longest_streak}</Text>
          <Text style={styles.longestLabel}>Recorde</Text>
        </View>
      </View>

      {/* Weekly Progress */}
      <View style={styles.weeklySection}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>Semana</Text>
          <Text style={styles.weeklyCount}>
            {streak.weekly_visits}/{streak.weekly_goal}
          </Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(streak.weekly_progress_pct, 100)}%` },
            ]}
          />
        </View>
      </View>

      {/* Next Milestone */}
      {nextMilestone && (
        <View style={styles.milestoneSection}>
          <MaterialIcons name={nextMilestone.icon} size={20} color={nextMilestone.color} />
          <View style={styles.milestoneInfo}>
            <Text style={styles.milestoneName}>{nextMilestone.name}</Text>
            <Text style={styles.milestoneProgress}>
              {nextMilestone.progress}/{nextMilestone.days} dias ({nextMilestone.progress_pct}%)
            </Text>
          </View>
          <Text style={styles.milestoneXP}>+{nextMilestone.xp_bonus} XP</Text>
        </View>
      )}

      {/* Monthly Stats */}
      <View style={styles.monthlyRow}>
        <MaterialIcons name="calendar-today" size={16} color="#94A3B8" />
        <Text style={styles.monthlyText}>
          {streak.monthly_visits} visitas este mês
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactStreak: {
    fontSize: 14,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakCount: {
    color: palette.gray[50],
    fontSize: 20,
    fontWeight: '800',
  },
  streakLabel: {
    color: '#94A3B8',
    fontSize: 12,
  },
  longestStreak: {
    alignItems: 'center',
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  longestValue: {
    color: palette.terracotta[500],
    fontSize: 18,
    fontWeight: '700',
  },
  longestLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  weeklySection: {
    gap: 6,
  },
  weeklyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weeklyTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '600',
  },
  weeklyCount: {
    color: palette.terracotta[500],
    fontSize: 13,
    fontWeight: '700',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#334155',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#22C55E',
    borderRadius: 3,
  },
  milestoneSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  milestoneInfo: {
    flex: 1,
  },
  milestoneName: {
    color: palette.gray[50],
    fontSize: 13,
    fontWeight: '600',
  },
  milestoneProgress: {
    color: '#94A3B8',
    fontSize: 11,
  },
  milestoneXP: {
    color: palette.terracotta[500],
    fontSize: 13,
    fontWeight: '700',
  },
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  monthlyText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
