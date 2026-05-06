import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import OptimizedImage from './OptimizedImage';

export interface POI {
  id: string;
  name: string;
  category: string;
  municipality?: string;
  distance_km?: number;
  cover_image?: string;
}

interface POICardProps {
  poi: POI;
  onPress?: (id: string) => void;
}

export default function POICard({ poi, onPress }: POICardProps) {
  return (
    <TouchableOpacity
      testID="poi-card"
      style={styles.card}
      onPress={() => onPress?.(poi.id)}
      activeOpacity={0.8}
    >
      {poi.cover_image && (
        <View style={styles.thumbWrap}>
          <OptimizedImage uri={poi.cover_image} style={styles.thumb} contentFit="cover" />
        </View>
      )}
      <View style={styles.content}>
        <Text style={styles.name}>{poi.name}</Text>
        <Text style={styles.category}>{poi.category}</Text>
        {poi.distance_km !== undefined && (
          <Text style={styles.distance}>{poi.distance_km.toFixed(1)} km</Text>
        )}
        {poi.municipality !== undefined && (
          <Text style={styles.municipality}>{poi.municipality}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  thumbWrap: {
    width: 56,
    height: 56,
    borderRadius: 10,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  category: {
    fontSize: 13,
    color: '#666',
    textTransform: 'capitalize',
  },
  distance: {
    fontSize: 13,
    color: '#2e7d32',
    fontWeight: '500',
  },
  municipality: {
    fontSize: 12,
    color: '#999',
  },
});
