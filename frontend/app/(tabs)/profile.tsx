import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../src/context/AuthContext';
import { getFavorites, getStats, getUpcomingEvents } from '../../src/services/api';
import HeritageCard from '../../src/components/HeritageCard';
import { getCategories } from '../../src/services/api';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading, isAuthenticated, login, logout, sessionToken } = useAuth();

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: favorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ['favorites', sessionToken],
    queryFn: () => getFavorites(sessionToken!),
    enabled: isAuthenticated && !!sessionToken,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const handleLogout = () => {
    Alert.alert(
      'Terminar Sessão',
      'Tem a certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: logout },
      ]
    );
  };

  if (authLoading) {
    return (
      <View style={[styles.container, styles.centerContent, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Perfil</Text>
        </View>
        
        <View style={styles.loginContainer}>
          <View style={styles.loginIcon}>
            <MaterialIcons name="person-outline" size={64} color="#64748B" />
          </View>
          <Text style={styles.loginTitle}>Inicie Sessão</Text>
          <Text style={styles.loginSubtitle}>
            Aceda à sua conta para guardar favoritos, contribuir com histórias e personalizar a sua experiência.
          </Text>
          <TouchableOpacity style={styles.loginButton} onPress={login}>
            <MaterialIcons name="login" size={20} color="#0F172A" />
            <Text style={styles.loginButtonText}>Entrar com Google</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Card for non-authenticated users */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Património Vivo de Portugal</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats?.total_items || 0}</Text>
              <Text style={styles.statLabel}>Itens</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats?.total_routes || 0}</Text>
              <Text style={styles.statLabel}>Rotas</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>7</Text>
              <Text style={styles.statLabel}>Regiões</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil</Text>
      </View>

      {/* User Info */}
      <View style={styles.userCard}>
        <View style={styles.userInfo}>
          {user?.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user?.name?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>

      {/* Favorites Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="favorite" size={20} color="#F59E0B" />
          <Text style={styles.sectionTitle}>Os Meus Favoritos</Text>
          <Text style={styles.sectionCount}>({favorites.length})</Text>
        </View>

        {favoritesLoading ? (
          <ActivityIndicator size="small" color="#F59E0B" style={styles.loader} />
        ) : favorites.length > 0 ? (
          <View style={styles.favoritesContainer}>
            {favorites.slice(0, 5).map((item) => (
              <HeritageCard
                key={item.id}
                item={item}
                categories={categories}
                onPress={() => router.push(`/heritage/${item.id}`)}
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptyFavorites}>
            <MaterialIcons name="favorite-border" size={40} color="#64748B" />
            <Text style={styles.emptyText}>Ainda não tem favoritos</Text>
            <Text style={styles.emptySubtext}>
              Explore o património e guarde os seus locais preferidos
            </Text>
          </View>
        )}
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appInfoTitle}>Património Vivo de Portugal</Text>
        <Text style={styles.appInfoVersion}>Versão 1.0.0</Text>
        <Text style={styles.appInfoCopyright}>
          © 2024 - Preservando a memória cultural portuguesa
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
  },
  loginContainer: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
  },
  loginIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  loginSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F59E0B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  statsCard: {
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    marginTop: 40,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  userEmail: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EF444420',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sectionCount: {
    fontSize: 14,
    color: '#64748B',
  },
  favoritesContainer: {
    gap: 0,
  },
  loader: {
    marginVertical: 20,
  },
  emptyFavorites: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#94A3B8',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 24,
  },
  appInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  appInfoVersion: {
    fontSize: 12,
    color: '#475569',
    marginTop: 4,
  },
  appInfoCopyright: {
    fontSize: 11,
    color: '#475569',
    marginTop: 8,
  },
});
