import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';

const AMBASSADOR_ROLE_COLORS: Record<string, string> = {
  local_guide: '#10B981',
  heritage_keeper: '#C49A6C',
  trail_master: '#2E5E4E',
  gastro_expert: '#EF4444',
  nature_warden: '#22C55E',
  photo_curator: '#8B5CF6',
};

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const _router = useRouter();
  const _insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user, sessionToken } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'contributions' | 'badges'>('contributions');

  const isOwnProfile = user?.user_id === id;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['public-profile', id],
    queryFn: async () => {
      const res = await api.get(`/community/profiles/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: ambassador } = useQuery({
    queryKey: ['ambassador-profile', id],
    queryFn: async () => {
      try {
        const res = await api.get(`/ambassadors/${id}`);
        return res.data;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });

  const { data: contributions } = useQuery({
    queryKey: ['user-contributions', id],
    queryFn: async () => {
      const res = await api.get('/community/contributions', {
        params: { status: 'approved', limit: 20 },
      });
      return res.data.items?.filter((c: any) => c.user_id === id) || [];
    },
    enabled: !!id,
  });

  const { data: badges } = useQuery({
    queryKey: ['user-community-badges', id],
    queryFn: async () => {
      const res = await api.get(`/community/community-badges/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  const { data: followStatus, refetch: refetchFollow } = useQuery({
    queryKey: ['follow-status', id],
    queryFn: async () => {
      if (!sessionToken || isOwnProfile) return { following: false };
      const res = await api.get(`/community/profiles/${id}/followers`);
      return { following: res.data.followers?.some((f: any) => f.follower_id === user?.user_id) };
    },
    enabled: !!id && !!sessionToken && !isOwnProfile,
  });

  const followMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/community/profiles/${id}/follow`);
      return res.data;
    },
    onSuccess: () => {
      refetchFollow();
      queryClient.invalidateQueries({ queryKey: ['public-profile', id] });
    },
  });

  if (profileLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary || '#2E5E4E'} />
      </View>
    );
  }

  const stats = profile?.stats || {};
  const ambassadorColor = ambassador ? AMBASSADOR_ROLE_COLORS[ambassador.role] || '#C49A6C' : null;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: profile?.user_name || 'Perfil', headerShown: true }} />

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.surface }]}>
          <View style={styles.avatarWrap}>
            {profile?.user_picture ? (
              <Image source={{ uri: profile.user_picture }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: '#2E5E4E' }]}>
                <Text style={styles.avatarInitial}>
                  {(profile?.user_name || '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {ambassador && (
              <View style={[styles.ambassadorDot, { backgroundColor: ambassadorColor! }]}>
                <MaterialIcons name="military-tech" size={12} color="#FFF" />
              </View>
            )}
          </View>

          <Text style={[styles.name, { color: colors.textPrimary }]}>
            {profile?.user_name || 'Utilizador'}
          </Text>

          {ambassador && (
            <View style={[styles.ambassadorBadge, { backgroundColor: ambassadorColor! + '20', borderColor: ambassadorColor! }]}>
              <MaterialIcons name="military-tech" size={14} color={ambassadorColor!} />
              <Text style={[styles.ambassadorText, { color: ambassadorColor! }]}>
                {ambassador.role_name} · {ambassador.region}
              </Text>
            </View>
          )}

          {profile?.bio && (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.bio}</Text>
          )}

          {profile?.favorite_region && (
            <View style={styles.regionRow}>
              <MaterialIcons name="place" size={14} color={colors.textMuted} />
              <Text style={[styles.regionText, { color: colors.textMuted }]}>
                {profile.favorite_region}
              </Text>
            </View>
          )}

          {/* Stats row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Contribuições', value: stats.contributions ?? 0 },
              { label: 'Seguidores', value: stats.followers ?? 0 },
              { label: 'A seguir', value: stats.following ?? 0 },
            ].map((s) => (
              <View key={s.label} style={styles.statItem}>
                <Text style={[styles.statVal, { color: colors.textPrimary }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Follow button */}
          {!isOwnProfile && sessionToken && (
            <TouchableOpacity
              style={[styles.followBtn, {
                backgroundColor: followStatus?.following ? colors.surface : '#2E5E4E',
                borderColor: '#2E5E4E',
              }]}
              onPress={() => followMutation.mutate()}
              disabled={followMutation.isPending}
            >
              {followMutation.isPending
                ? <ActivityIndicator size="small" color={followStatus?.following ? '#2E5E4E' : '#FFF'} />
                : (
                  <>
                    <MaterialIcons
                      name={followStatus?.following ? 'person-remove' : 'person-add'}
                      size={16}
                      color={followStatus?.following ? '#2E5E4E' : '#FFF'}
                    />
                    <Text style={[styles.followBtnText, {
                      color: followStatus?.following ? '#2E5E4E' : '#FFF'
                    }]}>
                      {followStatus?.following ? 'A Seguir' : 'Seguir'}
                    </Text>
                  </>
                )
              }
            </TouchableOpacity>
          )}
        </View>

        {/* Ambassador section */}
        {ambassador && (
          <View style={[styles.ambassadorCard, { backgroundColor: colors.surface, borderLeftColor: ambassadorColor! }]}>
            <Text style={[styles.ambassadorTitle, { color: colors.textPrimary }]}>
              Embaixador Local
            </Text>
            <Text style={[styles.ambassadorBio, { color: colors.textSecondary }]}>
              {ambassador.bio}
            </Text>
            {ambassador.local_expertise && (
              <Text style={[styles.ambassadorExpertise, { color: colors.textMuted }]}>
                💡 {ambassador.local_expertise}
              </Text>
            )}
          </View>
        )}

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.surface }]}>
          {(['contributions', 'badges'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { borderBottomColor: '#2E5E4E', borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, {
                color: activeTab === tab ? '#2E5E4E' : colors.textMuted,
                fontWeight: activeTab === tab ? '700' : '400',
              }]}>
                {tab === 'contributions' ? 'Contribuições' : 'Badges'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Contributions tab */}
        {activeTab === 'contributions' && (
          <View style={styles.tabContent}>
            {!contributions || contributions.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Ainda sem contribuições aprovadas.
              </Text>
            ) : contributions.map((c: any) => (
              <View key={c.id} style={[styles.contribCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={styles.contribHeader}>
                  <View style={[styles.typePill, { backgroundColor: '#2E5E4E20' }]}>
                    <Text style={[styles.typeText, { color: '#2E5E4E' }]}>{c.type}</Text>
                  </View>
                  {c.region && (
                    <Text style={[styles.contribRegion, { color: colors.textMuted }]}>{c.region}</Text>
                  )}
                </View>
                <Text style={[styles.contribTitle, { color: colors.textPrimary }]}>{c.title}</Text>
                <Text style={[styles.contribContent, { color: colors.textSecondary }]} numberOfLines={2}>
                  {c.content}
                </Text>
                <View style={styles.contribFooter}>
                  <MaterialIcons name="thumb-up" size={14} color={colors.textMuted} />
                  <Text style={[styles.contribVotes, { color: colors.textMuted }]}>{c.votes}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Badges tab */}
        {activeTab === 'badges' && (
          <View style={styles.tabContent}>
            {!badges?.earned_badges || badges.earned_badges.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Ainda sem badges de comunidade.
              </Text>
            ) : (
              <View style={styles.badgesGrid}>
                {badges.earned_badges.map((badgeId: string) => (
                  <View key={badgeId} style={[styles.badgePill, { backgroundColor: '#2E5E4E15', borderColor: '#2E5E4E40' }]}>
                    <MaterialIcons name="military-tech" size={16} color="#2E5E4E" />
                    <Text style={[styles.badgePillText, { color: '#2E5E4E' }]}>{badgeId}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { padding: 24, alignItems: 'center', gap: 10 },
  avatarWrap: { position: 'relative', marginBottom: 4 },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarPlaceholder: { width: 88, height: 88, borderRadius: 44, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { fontSize: 36, fontWeight: '700', color: '#FFF' },
  ambassadorDot: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF' },

  name: { fontSize: 22, fontWeight: '700' },
  bio: { fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  regionText: { fontSize: 13 },

  ambassadorBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  ambassadorText: { fontSize: 12, fontWeight: '700' },

  statsRow: { flexDirection: 'row', gap: 32, marginTop: 8 },
  statItem: { alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },

  followBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, marginTop: 4 },
  followBtnText: { fontSize: 14, fontWeight: '600' },

  ambassadorCard: { margin: 16, borderRadius: 14, padding: 16, borderLeftWidth: 4, gap: 6 },
  ambassadorTitle: { fontSize: 15, fontWeight: '700' },
  ambassadorBio: { fontSize: 14, lineHeight: 20 },
  ambassadorExpertise: { fontSize: 13, lineHeight: 18, fontStyle: 'italic' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabText: { fontSize: 14 },

  tabContent: { padding: 16, gap: 12 },
  emptyText: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },

  contribCard: { borderRadius: 12, padding: 14, borderWidth: 1, gap: 8 },
  contribHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  typeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  contribRegion: { fontSize: 12, marginLeft: 'auto' },
  contribTitle: { fontSize: 15, fontWeight: '600' },
  contribContent: { fontSize: 13, lineHeight: 19 },
  contribFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  contribVotes: { fontSize: 12 },

  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  badgePillText: { fontSize: 12, fontWeight: '600' },
});
