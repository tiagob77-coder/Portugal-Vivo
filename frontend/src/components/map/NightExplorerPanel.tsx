/**
 * NightExplorerPanel - Night activity exploration panel with filters.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export const NIGHT_FILTERS = [
  { id: 'all', label: 'Todos', icon: 'nightlight-round', color: '#8B5CF6' },
  { id: 'Gastronomia Noturna', label: 'Tascas', icon: 'restaurant', color: '#F97316' },
  { id: 'Sabores Nocturnos', label: 'Gastronomia', icon: 'local-dining', color: '#EAB308' },
  { id: 'Evento/Festa', label: 'Festas', icon: 'celebration', color: '#EC4899' },
  { id: 'Arte & Cultura', label: 'Arte', icon: 'palette', color: '#3B82F6' },
  { id: 'Iluminacao Patrimonial', label: 'Patrimonio', icon: 'church', color: '#14B8A6' },
  { id: 'Miradouro/Lenda', label: 'Miradouros', icon: 'visibility', color: '#A78BFA' },
];

interface NightExplorerPanelProps {
  isLoading: boolean;
  itemCount: number;
  activeFilter: string;
  onFilterChange: (filterId: string) => void;
}

export default function NightExplorerPanel({
  isLoading,
  itemCount,
  activeFilter,
  onFilterChange,
}: NightExplorerPanelProps) {
  return (
    <View style={styles.panel} data-testid="night-explorer-panel">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.moon}>
            <MaterialIcons name="nightlight-round" size={20} color="#FDE68A" />
          </View>
          <View>
            <Text style={styles.title}>Explorador Noturno</Text>
            <Text style={styles.subtitle}>
              {isLoading
                ? 'A carregar...'
                : `${itemCount} locais para explorar de noite`}
            </Text>
          </View>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {NIGHT_FILTERS.map((f) => {
          const isActive = activeFilter === f.id;
          return (
            <TouchableOpacity
              key={f.id}
              style={[styles.chip, isActive && { backgroundColor: f.color }]}
              onPress={() => onFilterChange(f.id)}
              data-testid={`night-filter-${f.id}`}
            >
              <MaterialIcons
                name={f.icon as any}
                size={14}
                color={isActive ? '#FFF' : f.color}
              />
              <Text style={[styles.chipText, isActive && { color: '#FFF' }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(30,20,50,0.6)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  moon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: '#E2DFD6',
    fontSize: 15,
    fontWeight: '700',
  },
  subtitle: {
    color: '#8A8A8A',
    fontSize: 12,
  },
  filters: {
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 4,
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500',
  },
});
