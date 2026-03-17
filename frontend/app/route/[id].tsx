import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, FlatList } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getRoute, getRouteItems, getCategories } from '../../src/services/api';
import HeritageCard from '../../src/components/HeritageCard';

const CATEGORY_COLORS: Record<string, string> = {
  vinho: '#7C3AED',
  pao: '#D97706',
  azeite: '#84CC16',
  cultural: '#EC4899',
  religioso: '#6366F1',
  arqueologia: '#78716C',
  natureza: '#22C55E',
};

const CATEGORY_ICONS: Record<string, string> = {
  vinho: 'local-bar',
  pao: 'bakery-dining',
  azeite: 'local-florist',
  cultural: 'museum',
  religioso: 'church',
  arqueologia: 'architecture',
  natureza: 'forest',
};

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ['route', id],
    queryFn: () => getRoute(id!),
    enabled: !!id,
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['routeItems', id],
    queryFn: () => getRouteItems(id!),
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const color = CATEGORY_COLORS[route?.category || ''] || '#6366F1';
  const icon = CATEGORY_ICONS[route?.category || ''] || 'route';

  if (routeLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!route) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Rota não encontrada</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Detalhes da Rota</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Route Icon */}
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <MaterialIcons name={icon as any} size={48} color={color} />
        </View>

        {/* Category Badge */}
        <View style={[styles.categoryBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.categoryText, { color }]}>
            {route.category.charAt(0).toUpperCase() + route.category.slice(1)}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{route.name}</Text>

        {/* Region */}
        {route.region && (
          <View style={styles.regionBadge}>
            <MaterialIcons name="map" size={14} color="#64748B" />
            <Text style={styles.regionText}>{route.region}</Text>
          </View>
        )}

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sobre esta Rota</Text>
          <Text style={styles.description}>{route.description}</Text>
        </View>

        {/* Route Info */}
        <View style={styles.infoGrid}>
          {route.duration_hours && (
            <View style={styles.infoItem}>
              <MaterialIcons name="schedule" size={24} color="#F59E0B" />
              <Text style={styles.infoValue}>{route.duration_hours}h</Text>
              <Text style={styles.infoLabel}>Duração</Text>
            </View>
          )}
          {route.distance_km && (
            <View style={styles.infoItem}>
              <MaterialIcons name="straighten" size={24} color="#22C55E" />
              <Text style={styles.infoValue}>{route.distance_km} km</Text>
              <Text style={styles.infoLabel}>Distância</Text>
            </View>
          )}
          <View style={styles.infoItem}>
            <MaterialIcons name="place" size={24} color="#3B82F6" />
            <Text style={styles.infoValue}>{items.length}</Text>
            <Text style={styles.infoLabel}>Pontos</Text>
          </View>
        </View>

        {/* Route Points */}
        {items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pontos de Interesse</Text>
            {items.map((item) => (
              <HeritageCard
                key={item.id}
                item={item}
                categories={categories}
                onPress={() => router.push(`/heritage/${item.id}`)}
              />
            ))}
          </View>
        )}

        {/* Tags */}
        {route.tags && route.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {route.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
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
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0F172A',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  categoryBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 32,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    alignSelf: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginBottom: 24,
  },
  regionText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#CBD5E1',
    lineHeight: 26,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginTop: 8,
  },
  infoLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});
