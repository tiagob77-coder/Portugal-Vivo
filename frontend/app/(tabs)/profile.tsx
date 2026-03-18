import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/context/AuthContext';
import { getFavorites, getStats, getBadges, getCategories, getGamificationProfile, getSubscriptionStatus } from '../../src/services/api';
import { pushNotificationService } from '../../src/services/pushNotifications';
import {
  registerBackgroundTasks,
  unregisterBackgroundTasks,
  startWebProximityPolling,
  stopWebProximityPolling,
} from '../../src/services/backgroundTasks';
import type { GamificationProfile, SubscriptionStatus } from '../../src/services/api';
import EmptyState from '../../src/components/EmptyState';
import HeritageCard from '../../src/components/HeritageCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LANGUAGES } from '../../src/i18n';
import { GeofenceControl } from '../../src/components/GeofenceControl';
import { LinearGradient } from 'expo-linear-gradient';
import { shadows } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { colors, isDark, toggleTheme } = useTheme();
  const { user, isLoading: authLoading, isAuthenticated, login, logout, sessionToken, isPremium, premiumTier } = useAuth();
  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ['favorites', sessionToken], queryFn: () => getFavorites(sessionToken!), enabled: isAuthenticated && !!sessionToken,
  });
  const { data: stats } = useQuery({ queryKey: ['stats'], queryFn: getStats });
  const { data: badges = [], isLoading: badgesLoading } = useQuery({ queryKey: ['badges'], queryFn: getBadges });
  const userId = (user as any)?.user_id || (user as any)?.id;
  const { data: gamProfile } = useQuery<GamificationProfile>({
    queryKey: ['gamification-profile', userId],
    queryFn: () => getGamificationProfile(userId || 'default_user'),
    enabled: isAuthenticated && !!userId,
  });
  const { data: subStatus } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status', userId],
    queryFn: () => getSubscriptionStatus(userId),
    enabled: isAuthenticated && !!userId,
  });
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [advancedExpanded, setAdvancedExpanded] = useState(false);

  // Load notification preference
  useEffect(() => {
    AsyncStorage.getItem('notifications_enabled').then(v => { if (v === 'true') setNotificationsEnabled(true); });
  }, []);

  const toggleNotifications = async () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    await AsyncStorage.setItem('notifications_enabled', String(newVal));

    if (newVal) {
      // Enable: request permission, get token, register with backend
      const token = await pushNotificationService.initialize();
      if (token) {
        await pushNotificationService.registerTokenWithBackend();
        // Start proximity background task / web polling
        if (Platform.OS === 'web') {
          startWebProximityPolling();
        } else {
          await registerBackgroundTasks();
        }
      } else {
        // Permission denied — revert the toggle
        setNotificationsEnabled(false);
        await AsyncStorage.setItem('notifications_enabled', 'false');
        Alert.alert(
          'Notificações bloqueadas',
          'Ativa as notificações nas definições do dispositivo para receber alertas.',
        );
      }
    } else {
      // Disable: cancel local notifications + background task
      await pushNotificationService.cancelAllNotifications();
      if (Platform.OS === 'web') {
        stopWebProximityPolling();
      } else {
        await unregisterBackgroundTasks();
      }
    }
  };

  const handleLogout = () => {
    Alert.alert('Terminar Sessao', 'Tem a certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: logout },
    ]);
  };

  if (authLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  // Acções principais — visíveis a todos os utilizadores autenticados
  const primaryMenuItems = [
    { icon: 'analytics', label: 'O Meu Progresso', color: colors.accent, route: '/dashboard' },
    { icon: 'near-me', label: 'Perto de Mim', color: colors.success, route: '/nearby' },
    { icon: 'alt-route', label: 'Planear Viagem', color: colors.info, route: '/route-planner' },
  ];

  // Ferramentas avançadas — colapsável, visível em sub-menu
  const advancedMenuItems = [
    { icon: 'insights', label: 'IQ Monitor', color: colors.accent, route: '/iq-overview', testId: 'profile-iq-overview-link' },
    { icon: 'dashboard', label: 'Painel Admin', color: '#1E3A3F', route: '/admin' },
    { icon: 'admin-panel-settings', label: 'IQ Admin Panel', color: colors.secondary, route: '/iq-admin', testId: 'profile-iq-admin-link' },
    { icon: 'cloud-upload', label: 'Importador Excel', color: colors.info, route: '/importer' },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Perfil</Text>
      </View>

      {!isAuthenticated ? (
        <View>
          {/* Login CTA */}
          <View style={styles.loginContainer}>
            <View style={[styles.loginIcon, { backgroundColor: colors.primary + '15' }]}>
              <MaterialIcons name="person-outline" size={64} color={colors.primary} />
            </View>
            <Text style={[styles.loginTitle, { color: colors.textPrimary }]}>Inicie Sessao</Text>
            <Text style={[styles.loginSubtitle, { color: colors.textSecondary }]}>
              Aceda a sua conta para guardar favoritos, contribuir com historias e personalizar a sua experiencia.
            </Text>
            <TouchableOpacity style={[styles.loginButton, { backgroundColor: colors.accent }]} onPress={login}>
              <MaterialIcons name="login" size={20} color="#FFFFFF" />
              <Text style={styles.loginButtonText}>Entrar com Google</Text>
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={[styles.statsCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <Text style={[styles.statsTitle, { color: colors.textMuted }]}>Portugal Vivo</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accent }]}>{stats?.total_items || 0}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Itens</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accent }]}>{stats?.total_routes || 0}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Rotas</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: colors.accent }]}>7</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Regioes</Text>
              </View>
            </View>
          </View>

          {/* Theme Toggle - Not Authenticated */}
          <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.borderLight }}>
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }} onPress={toggleTheme} testID="theme-toggle">
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary + '15' }]}>
                <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={colors.secondary} />
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{isDark ? 'Modo Claro' : 'Modo Escuro'}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginHorizontal: 16 }} />
            <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 }} onPress={() => router.push('/settings/language' as any)}>
              <View style={[styles.actionIcon, { backgroundColor: colors.info + '15' }]}>
                <MaterialIcons name="language" size={24} color={colors.info} />
              </View>
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: colors.textPrimary }}>{currentLang.flag} {currentLang.name}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View>
          {/* User Info */}
          <View style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={styles.userInfo}>
              {user?.picture ? (
                <Image source={{ uri: user.picture }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.accent }]}>
                  <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.userDetails}>
                <Text style={[styles.userName, { color: colors.textPrimary }]}>{user?.name}</Text>
                <Text style={[styles.userEmail, { color: colors.textMuted }]}>{user?.email}</Text>
              </View>
            </View>
            <TouchableOpacity style={[styles.logoutButton, { backgroundColor: colors.error + '12' }]} onPress={handleLogout}>
              <MaterialIcons name="logout" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>

          {/* Acções Principais */}
          <View style={[styles.quickActions, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            {primaryMenuItems.map((item, idx) => (
              <TouchableOpacity
                key={item.label}
                style={[styles.actionButton, idx < primaryMenuItems.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}
                onPress={() => router.push(item.route as any)}
                accessibilityLabel={item.label}
                accessibilityRole="button"
              >
                <View style={[styles.actionIcon, { backgroundColor: item.color + '15' }]}>
                  <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                </View>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>{item.label}</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Ferramentas Avançadas — colapsável */}
          <TouchableOpacity
            style={[styles.advancedHeader, { borderColor: colors.borderLight }]}
            onPress={() => setAdvancedExpanded(prev => !prev)}
            accessibilityLabel="Ferramentas avançadas"
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedExpanded }}
          >
            <MaterialIcons name="build" size={18} color={colors.textMuted} />
            <Text style={[styles.advancedHeaderText, { color: colors.textMuted }]}>Ferramentas Avançadas</Text>
            <MaterialIcons name={advancedExpanded ? 'expand-less' : 'expand-more'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
          {advancedExpanded && (
            <View style={[styles.quickActions, { backgroundColor: colors.surface, borderColor: colors.borderLight, marginTop: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 }]}>
              {advancedMenuItems.map((item, idx) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.actionButton, idx < advancedMenuItems.length - 1 && { borderBottomColor: colors.borderLight, borderBottomWidth: 1 }]}
                  onPress={() => router.push(item.route as any)}
                  data-testid={(item as any).testId}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                >
                  <View style={[styles.actionIcon, { backgroundColor: item.color + '15' }]}>
                    <MaterialIcons name={item.icon as any} size={24} color={item.color} />
                  </View>
                  <Text style={[styles.actionText, { color: colors.textPrimary }]}>{item.label}</Text>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Theme Toggle - Authenticated */}
          <View style={[styles.quickActions, { backgroundColor: colors.surface, borderColor: colors.borderLight, marginTop: 16 }]}>
            <TouchableOpacity style={styles.actionButton} onPress={toggleTheme} testID="theme-toggle">
              <View style={[styles.actionIcon, { backgroundColor: colors.secondary + '15' }]}>
                <MaterialIcons name={isDark ? 'light-mode' : 'dark-mode'} size={24} color={colors.secondary} />
              </View>
              <Text style={[styles.actionText, { color: colors.textPrimary }]}>{isDark ? 'Modo Claro' : 'Modo Escuro'}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/settings/language' as any)}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.info + '15' }]}>
                <MaterialIcons name="language" size={24} color={colors.info} />
              </View>
              <View style={styles.languageInfo}>
                <Text style={[styles.actionText, { color: colors.textPrimary }]}>{t('profile.language')}</Text>
                <Text style={[styles.languageCurrent, { color: colors.textMuted }]}>{currentLang.flag} {currentLang.name}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Geofence Control + Notification Toggle */}
      {isAuthenticated && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="notifications" size={18} color={colors.success} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notificações</Text>
          </View>
          <TouchableOpacity
            style={[styles.notifToggle, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
            onPress={toggleNotifications}
            data-testid="notification-toggle"
          >
            <MaterialIcons
              name={notificationsEnabled ? 'notifications-active' : 'notifications-off'}
              size={22}
              color={notificationsEnabled ? '#22c55e' : colors.textMuted}
            />
            <Text style={[styles.actionText, { flex: 1, color: colors.textPrimary }]}>Push Notifications</Text>
            <View style={[styles.toggleTrack, notificationsEnabled && styles.toggleTrackActive]}>
              <View style={[styles.toggleThumb, notificationsEnabled && styles.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
          <GeofenceControl />
        </View>
      )}

      {/* Badges */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="emoji-events" size={18} color={colors.accent} />
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            {isAuthenticated ? 'As Minhas Conquistas' : 'Conquistas Disponiveis'}
          </Text>
          {isAuthenticated && gamProfile ? (
            <Text style={[styles.sectionCount, { color: colors.accent }]}>
              {gamProfile.earned_badges_count}/{gamProfile.total_badges}
            </Text>
          ) : (
            <Text style={[styles.sectionCount, { color: colors.textMuted }]}>({badges?.length || 0})</Text>
          )}
        </View>

        {/* XP Progress Bar (authenticated) */}
        {isAuthenticated && gamProfile && (
          <View style={[styles.xpBar, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={styles.xpInfo}>
              <Text style={[styles.xpLevel, { color: colors.textPrimary }]}>
                Nivel {gamProfile.level}
              </Text>
              <Text style={[styles.xpText, { color: colors.textMuted }]}>
                {gamProfile.xp} / {gamProfile.xp + gamProfile.xp_to_next_level} XP
              </Text>
            </View>
            <View style={[styles.xpTrack, { backgroundColor: isDark ? '#333' : '#E5E7EB' }]}>
              <View style={[styles.xpFill, {
                width: `${gamProfile.xp_to_next_level > 0 ? Math.min(100, (gamProfile.xp % 100) / 100 * 100) : 100}%`,
                backgroundColor: colors.accent,
              }]} />
            </View>
          </View>
        )}

        {badgesLoading ? (
          <ActivityIndicator size="small" color={colors.accent} />
        ) : isAuthenticated && gamProfile?.badges ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
            {gamProfile.badges
              .sort((a: any, b: any) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0))
              .map((badge: any) => (
              <View
                key={badge.id}
                style={[
                  styles.badgeCard,
                  { backgroundColor: colors.surface, borderColor: badge.earned ? badge.color + '40' : colors.borderLight },
                  badge.earned && { borderWidth: 2 },
                ]}
                data-testid={`badge-${badge.id}`}
              >
                <View style={[styles.badgeIcon, {
                  backgroundColor: badge.color + (badge.earned ? '25' : '08'),
                  opacity: badge.earned ? 1 : 0.5,
                }]}>
                  <MaterialIcons name={badge.icon || 'emoji-events'} size={28} color={badge.earned ? badge.color : colors.textMuted} />
                  {badge.earned && (
                    <View style={styles.badgeCheckmark}>
                      <MaterialIcons name="check-circle" size={14} color="#22C55E" />
                    </View>
                  )}
                </View>
                <Text style={[styles.badgeName, { color: badge.earned ? colors.textPrimary : colors.textMuted }]} numberOfLines={2}>
                  {badge.name}
                </Text>
                {/* Progress bar for unearned badges */}
                {!badge.earned && badge.progress_pct != null && (
                  <View style={[styles.badgeProgress, { backgroundColor: isDark ? '#333' : '#E5E7EB' }]}>
                    <View style={[styles.badgeProgressFill, {
                      width: `${Math.min(100, badge.progress_pct)}%`,
                      backgroundColor: badge.color,
                    }]} />
                  </View>
                )}
              </View>
            ))}
          </ScrollView>
        ) : badges && badges.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.badgesRow}>
            {badges.slice(0, 6).map((badge: any) => (
              <View key={badge.id} style={[styles.badgeCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]} data-testid={`badge-${badge.id}`}>
                <View style={[styles.badgeIcon, { backgroundColor: badge.color + (isDark ? '25' : '15') }]}>
                  <MaterialIcons name={badge.icon} size={28} color={badge.color} />
                </View>
                <Text style={[styles.badgeName, { color: colors.textPrimary }]} numberOfLines={2}>{badge.name}</Text>
                <View style={[styles.badgeLocked, { backgroundColor: colors.surfaceAlt }]}>
                  <MaterialIcons name="lock" size={12} color={colors.textMuted} />
                  <Text style={[styles.badgeLockedText, { color: colors.textMuted }]}>Bloqueado</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        ) : null}
        {!isAuthenticated && <Text style={[styles.badgesHint, { color: colors.textMuted }]}>Inicie sessao para desbloquear conquistas</Text>}
      </View>

      {/* Favorites */}
      {isAuthenticated && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="favorite" size={18} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Os Meus Favoritos</Text>
            <Text style={[styles.sectionCount, { color: colors.textMuted }]}>({favorites.length})</Text>
          </View>
          {favoritesLoading ? (
            <ActivityIndicator size="small" color={colors.accent} style={styles.loader} />
          ) : favorites.length > 0 ? (
            <View style={styles.favoritesContainer}>
              {favorites.slice(0, 5).map((item: any) => (
                <HeritageCard key={item.id} item={item} categories={categories} onPress={() => router.push(`/heritage/${item.id}`)} />
              ))}
            </View>
          ) : (
            <EmptyState
              icon="favorite-border"
              title="Ainda não tem favoritos"
              subtitle="Explore o património e guarde os seus locais preferidos"
              actionLabel="Descobrir locais"
              onAction={() => router.push('/(tabs)/descobrir')}
            />
          )}
        </View>
      )}

      {/* Premium Status / CTA */}
      {isPremium && subStatus ? (
        <TouchableOpacity
          style={[styles.premiumActive, { backgroundColor: colors.surface, borderColor: '#C49A6C' }]}
          onPress={() => router.push('/premium')}
        >
          <LinearGradient
            colors={['rgba(196,154,108,0.15)', 'rgba(196,154,108,0.05)']}
            style={styles.premiumActiveInner}
          >
            <MaterialIcons name="verified" size={28} color="#C49A6C" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.premiumCtaTitle, { color: '#C49A6C' }]}>
                {subStatus.tier_name} — Ativo
              </Text>
              <Text style={[styles.premiumCtaDesc, { color: colors.textMuted }]}>
                Todas as funcionalidades desbloqueadas
              </Text>
            </View>
            <MaterialIcons name="settings" size={20} color="#C49A6C" />
          </LinearGradient>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[styles.premiumCta, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
          onPress={() => router.push('/premium')}
        >
          <MaterialIcons name="diamond" size={24} color="#C49A6C" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.premiumCtaTitle, { color: colors.textPrimary }]}>Premium</Text>
            <Text style={[styles.premiumCtaDesc, { color: colors.textMuted }]}>
              Roteiros IA, áudio guias, offline • desde 4,99€
            </Text>
          </View>
          <MaterialIcons name="arrow-forward" size={20} color="#C49A6C" />
        </TouchableOpacity>
      )}

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={[styles.appInfoTitle, { color: colors.textMuted }]}>Portugal Vivo</Text>
        <Text style={[styles.appInfoVersion, { color: colors.textMuted }]}>Versao 3.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16 },
  headerTitle: { fontSize: 28, fontWeight: '800', fontFamily: serif },
  loginContainer: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 40 },
  loginIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  loginTitle: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  loginSubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  loginButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 14, gap: 8 },
  loginButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  statsCard: { marginHorizontal: 20, marginTop: 40, borderRadius: 18, padding: 20, borderWidth: 1, ...shadows.md },
  statsTitle: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 16 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  userCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, borderRadius: 18, padding: 16, borderWidth: 1, ...shadows.md },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, fontWeight: '700', color: '#FFF' },
  userDetails: { marginLeft: 12, flex: 1 },
  userName: { fontSize: 18, fontWeight: '700' },
  userEmail: { fontSize: 13, marginTop: 2 },
  logoutButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  quickActions: { marginHorizontal: 20, marginTop: 16, borderRadius: 18, overflow: 'hidden', borderWidth: 1, ...shadows.md },
  advancedHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 20, marginTop: 8, paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  advancedHeaderText: { flex: 1, fontSize: 13, fontWeight: '600' },
  actionButton: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  actionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  actionText: { flex: 1, fontSize: 15, fontWeight: '600' },
  languageInfo: { flex: 1 },
  languageCurrent: { fontSize: 13, marginTop: 2 },
  notifToggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  toggleTrack: { width: 44, height: 24, borderRadius: 12, backgroundColor: '#475569', justifyContent: 'center', padding: 2 },
  toggleTrackActive: { backgroundColor: '#22c55e' },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFFFF' },
  toggleThumbActive: { alignSelf: 'flex-end' },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', fontFamily: serif },
  sectionCount: { fontSize: 14 },
  favoritesContainer: { gap: 0 },
  loader: { marginVertical: 20 },
  emptyFavorites: { alignItems: 'center', paddingVertical: 40, borderRadius: 18, borderWidth: 1, ...shadows.sm },
  emptyText: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptySubtext: { fontSize: 13, marginTop: 4, textAlign: 'center', paddingHorizontal: 20 },
  badgesRow: { paddingHorizontal: 0, gap: 12 },
  badgeCard: { width: 110, borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, ...shadows.sm },
  badgeIcon: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  badgeName: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 16, minHeight: 32 },
  badgeLocked: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  badgeLockedText: { fontSize: 10, fontWeight: '500' },
  badgeCheckmark: { position: 'absolute', bottom: -2, right: -2 },
  badgeProgress: { width: '80%', height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  badgeProgressFill: { height: '100%', borderRadius: 2 },
  xpBar: { marginHorizontal: 20, marginBottom: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  xpInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  xpLevel: { fontSize: 14, fontWeight: '700' },
  xpText: { fontSize: 12 },
  xpTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3 },
  badgesHint: { fontSize: 12, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  premiumCta: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 24,
    padding: 16, borderRadius: 12, borderWidth: 1,
  },
  premiumActive: {
    marginHorizontal: 20, marginTop: 24, borderRadius: 12, borderWidth: 2, overflow: 'hidden',
  },
  premiumActiveInner: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
  },
  premiumCtaTitle: { fontSize: 15, fontWeight: '700' },
  premiumCtaDesc: { fontSize: 12, marginTop: 2 },
  appInfo: { alignItems: 'center', paddingVertical: 32, marginTop: 24, marginBottom: 40 },
  appInfoTitle: { fontSize: 14, fontWeight: '600' },
  appInfoVersion: { fontSize: 12, marginTop: 4 },
});
