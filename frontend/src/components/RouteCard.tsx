import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Route } from '../types';

interface RouteCardProps {
  route: Route;
  onPress: () => void;
}

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

export default function RouteCard({ route, onPress }: RouteCardProps) {
  const color = CATEGORY_COLORS[route.category] || '#6366F1';
  const icon = CATEGORY_ICONS[route.category] || 'route';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon as any} size={28} color={color} />
      </View>
      
      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={2}>{route.name}</Text>
        <Text style={styles.description} numberOfLines={2}>{route.description}</Text>
        
        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: color + '20' }]}>
            <Text style={[styles.badgeText, { color }]}>
              {route.category.charAt(0).toUpperCase() + route.category.slice(1)}
            </Text>
          </View>
          {route.region && (
            <View style={styles.regionBadge}>
              <MaterialIcons name="place" size={12} color="#94A3B8" />
              <Text style={styles.regionText}>{route.region}</Text>
            </View>
          )}
        </View>
      </View>
      
      <MaterialIcons name="chevron-right" size={24} color="#64748B" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 8,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  regionText: {
    fontSize: 11,
    color: '#94A3B8',
  },
});
