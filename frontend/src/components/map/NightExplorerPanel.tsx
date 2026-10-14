/**
 * NightExplorerPanel - Night activity exploration panel with filters.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { stateColors, palette } from '../../../src/theme';

export const NIGHT_FILTERS = [
  { id: 'all', labelKey: 'mapScreen.night.filters.all', icon: 'nightlight-round', color: stateColors.rarity.raro },
  { id: 'Gastronomia Noturna', labelKey: 'mapScreen.night.filters.tascas', icon: 'restaurant', color: '#F97316' },
  { id: 'Sabores Nocturnos', labelKey: 'mapScreen.night.filters.gastronomia', icon: 'local-dining', color: '#EAB308' },
  { id: 'Evento/Festa', labelKey: 'mapScreen.night.filters.festas', icon: 'celebration', color: stateColors.event.festival },
  { id: 'Arte & Cultura', labelKey: 'mapScreen.night.filters.arte', icon: 'palette', color: stateColors.surf.good },
  { id: 'Iluminacao Patrimonial', labelKey: 'mapScreen.night.filters.patrimonio', icon: 'church', color: '#14B8A6' },
  { id: 'Miradouro/Lenda', labelKey: 'mapScreen.night.filters.miradouros', icon: 'visibility', color: '#A78BFA' },
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
  const { t } = useTranslation();
  return (
    <View style={styles.panel} data-testid="night-explorer-panel">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.moon}>
            <MaterialIcons name="nightlight-round" size={20} color="#FDE68A" />
          </View>
          <View>
            <Text style={styles.title}>{t('mapScreen.night.title')}</Text>
            <Text style={styles.subtitle}>
              {isLoading
                ? t('common.loading')
                : itemCount === 1
                ? t('mapScreen.night.countOne', { count: itemCount })
                : t('mapScreen.night.count', { count: itemCount })}
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
                color={isActive ? palette.white : f.color}
              />
              <Text style={[styles.chipText, isActive && { color: palette.white }]}>
                {t(f.labelKey)}
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
    borderColor: 'rgba(139,92,246,0.2)', // stateColors.rarity.raro @ 20% opacity
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
    backgroundColor: 'rgba(139,92,246,0.2)', // stateColors.rarity.raro @ 20% opacity
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: palette.gray[200],
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
