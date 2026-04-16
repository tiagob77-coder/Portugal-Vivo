/**
 * CulturalHubMap — native fallback (React Native)
 * Shows route stops as a colour-coded pin grid.
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface HubStop {
  name: string;
  lat: number;
  lng: number;
  municipality: string;
  type: string;
  family?: string;
  color?: string;
}

export interface HubMapLayer {
  id: string;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  active: boolean;
}

export interface CulturalHubMapProps {
  stops: HubStop[];
  layers: HubMapLayer[];
  onLayerToggle: (id: string) => void;
}

export default function CulturalHubMap({ stops, layers, onLayerToggle }: CulturalHubMapProps) {
  const visibleStops = stops.slice(0, 12);

  return (
    <View style={styles.container}>
      {/* Layer chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.layerScroll}
        contentContainerStyle={styles.layerContent}
      >
        {layers.map((l) => (
          <View
            key={l.id}
            style={[styles.layerChip, l.active && { backgroundColor: l.color + '30', borderColor: l.color }]}
          >
            <MaterialIcons name={l.icon} size={12} color={l.active ? l.color : '#6B7280'} />
            <Text style={[styles.layerLabel, l.active && { color: l.color }]}>{l.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Stops grid */}
      <View style={styles.grid}>
        {visibleStops.map((stop, idx) => (
          <View key={idx} style={styles.stopItem}>
            <View style={[styles.stopDot, { backgroundColor: stop.color || '#A855F7' }]} />
            <View style={styles.stopTextWrap}>
              <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
              <Text style={styles.stopMunic} numberOfLines={1}>{stop.municipality}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.nativeNote}>
        <MaterialIcons name="map" size={12} color="#6B7280" />
        <Text style={styles.nativeNoteText}>Mapa 3D disponível na versão web</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#120828',
    borderRadius: 16,
    overflow: 'hidden',
    padding: 12,
    minHeight: 200,
  },
  layerScroll: { marginBottom: 12 },
  layerContent: { gap: 6 },
  layerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: '#1A0E30', borderWidth: 1, borderColor: '#2A1A50',
  },
  layerLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stopItem: { flexDirection: 'row', alignItems: 'center', gap: 6, width: '46%' },
  stopDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stopTextWrap: { flex: 1 },
  stopName: { fontSize: 11, fontWeight: '600', color: '#E2D9F3' },
  stopMunic: { fontSize: 10, color: '#7C6BA0' },

  nativeNote: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 12, justifyContent: 'center',
  },
  nativeNoteText: { fontSize: 10, color: '#6B7280', fontStyle: 'italic' },
});
