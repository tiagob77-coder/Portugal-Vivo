import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getRoutes } from '../../src/services/api';
import RouteCard from '../../src/components/RouteCard';
import { Route } from '../../src/types';
import { useTheme } from '../../src/context/ThemeContext';

const ROUTE_CATEGORIES = [
  { id: 'all', nameKey: 'coreTabs.routes.categories.all', icon: 'route' },
  { id: 'peregrino', nameKey: 'coreTabs.routes.categories.pilgrim', icon: 'directions-walk' },
  { id: 'road_trip', nameKey: 'coreTabs.routes.categories.roadTrip', icon: 'directions-car' },
  { id: 'caminhada', nameKey: 'coreTabs.routes.categories.trails', icon: 'hiking' },
  { id: 'patrimonio', nameKey: 'coreTabs.routes.categories.heritage', icon: 'castle' },
  { id: 'natureza', nameKey: 'coreTabs.routes.categories.nature', icon: 'forest' },
  { id: 'gastronomia', nameKey: 'coreTabs.routes.categories.gastronomy', icon: 'restaurant' },
  { id: 'cultural', nameKey: 'coreTabs.routes.categories.cultural', icon: 'museum' },
  { id: 'bem-estar', nameKey: 'coreTabs.routes.categories.wellness', icon: 'spa' },
  { id: 'vinho', nameKey: 'coreTabs.routes.categories.wine', icon: 'local-bar' },
  { id: 'religioso', nameKey: 'coreTabs.routes.categories.religious', icon: 'church' },
];

export default function RoutesScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { data: routes = [], isLoading, refetch: _refetch } = useQuery({
    queryKey: ['routes', selectedCategory],
    queryFn: () => getRoutes({
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
    }),
  });

  const handleRoutePress = (route: Route) => {
    router.push(`/route/${route.id}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('routes.title')}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>{t('coreTabs.routes.subtitle')}</Text>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        {ROUTE_CATEGORIES.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[
              styles.filterChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              selectedCategory === category.id && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(category.id)}
            accessibilityLabel={t('coreTabs.routes.filterBy', { name: t(category.nameKey) })}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedCategory === category.id }}
          >
            <MaterialIcons
              name={category.icon as any}
              size={16}
              color={selectedCategory === category.id ? colors.accent : colors.textMuted}
            />
            <Text style={[
              styles.filterChipText,
              { color: colors.textMuted },
              selectedCategory === category.id && { color: colors.accent },
            ]}>
              {t(category.nameKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Routes List */}
      <FlatList
        data={routes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <RouteCard
            route={item}
            onPress={() => handleRoutePress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={colors.accent} style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="route" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('coreTabs.routes.empty')}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
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
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  filtersScroll: {
    maxHeight: 52,
    marginBottom: 12,
  },
  filtersContent: {
    paddingHorizontal: 20,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 10,
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#F59E0B20',
    borderColor: '#F59E0B',
  },
  filterChipText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#F59E0B',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
});
