import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getRoutes } from '../../src/services/api';
import RouteCard from '../../src/components/RouteCard';
import { Route } from '../../src/types';

const ROUTE_CATEGORIES = [
  { id: 'all', name: 'Todas', icon: 'route' },
  { id: 'peregrino', name: 'Santiago', icon: 'directions-walk' },
  { id: 'road_trip', name: 'Road Trip', icon: 'directions-car' },
  { id: 'caminhada', name: 'Trilhos', icon: 'hiking' },
  { id: 'patrimonio', name: 'Patrimônio', icon: 'castle' },
  { id: 'natureza', name: 'Natureza', icon: 'forest' },
  { id: 'gastronomia', name: 'Gastronomia', icon: 'restaurant' },
  { id: 'cultural', name: 'Cultural', icon: 'museum' },
  { id: 'bem-estar', name: 'Bem-estar', icon: 'spa' },
  { id: 'vinho', name: 'Vinho', icon: 'local-bar' },
  { id: 'religioso', name: 'Religioso', icon: 'church' },
];

export default function RoutesScreen() {
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rotas Temáticas</Text>
        <Text style={styles.headerSubtitle}>Percursos para descobrir Portugal</Text>
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
              selectedCategory === category.id && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(category.id)}
          >
            <MaterialIcons 
              name={category.icon as any} 
              size={16} 
              color={selectedCategory === category.id ? '#F59E0B' : '#94A3B8'} 
            />
            <Text style={[
              styles.filterChipText,
              selectedCategory === category.id && styles.filterChipTextActive,
            ]}>
              {category.name}
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
            <ActivityIndicator size="large" color="#F59E0B" style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="route" size={48} color="#64748B" />
              <Text style={styles.emptyText}>Nenhuma rota encontrada</Text>
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
