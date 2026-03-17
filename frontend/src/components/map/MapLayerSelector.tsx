/**
 * MapLayerSelector - Layer and subcategory selection for the map.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface MapLayer {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Subcategory {
  id: string;
  name: string;
  icon: string;
  comingSoon?: boolean;
}

interface MapLayerSelectorProps {
  layers: MapLayer[];
  subcategories: Record<string, Subcategory[]>;
  activeSubcategories: string[];
  expandedLayer: string | null;
  onToggleLayer: (layerId: string) => void;
  onToggleSubcategory: (subcatId: string, layerId: string) => void;
  onExpandLayer: (layerId: string | null) => void;
  getLayerSubcategories: (layerId: string) => string[];
  isNative?: boolean;
}

export default function MapLayerSelector({
  layers,
  subcategories,
  activeSubcategories,
  expandedLayer,
  onToggleLayer,
  onToggleSubcategory,
  onExpandLayer,
  getLayerSubcategories,
  isNative = false,
}: MapLayerSelectorProps) {
  return (
    <View>
      {!isNative && (
        <View style={styles.sectionHeader}>
          <MaterialIcons name="layers" size={20} color="#8B5CF6" />
          <Text style={styles.sectionTitle}>Camadas</Text>
          <Text style={styles.subcatCount}>
            {activeSubcategories.length} de 44
          </Text>
        </View>
      )}

      {/* Main category chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerContent}
      >
        {layers.map((layer) => {
          const layerSubs = getLayerSubcategories(layer.id);
          const activeCount = layerSubs.filter((s) =>
            activeSubcategories.includes(s)
          ).length;
          const isActive = activeCount > 0;
          const isExpanded = expandedLayer === layer.id;

          return (
            <TouchableOpacity
              key={layer.id}
              style={[
                styles.layerChip,
                isActive && { backgroundColor: layer.color },
                !isNative && isExpanded && styles.layerChipExpanded,
              ]}
              onPress={() =>
                isNative
                  ? onToggleLayer(layer.id)
                  : onExpandLayer(isExpanded ? null : layer.id)
              }
              onLongPress={!isNative ? () => onToggleLayer(layer.id) : undefined}
              data-testid={`layer-${layer.id}`}
            >
              <MaterialIcons
                name={layer.icon as any}
                size={18}
                color={isActive ? '#FFFFFF' : '#94A3B8'}
              />
              <Text
                style={[styles.layerText, isActive && styles.layerTextActive]}
              >
                {layer.name}
              </Text>
              {isActive && (
                <View style={styles.layerBadge}>
                  <Text style={styles.layerBadgeText}>
                    {isNative ? activeCount : `${activeCount}/${layerSubs.length}`}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Expanded subcategories (web only) */}
      {!isNative && expandedLayer && subcategories[expandedLayer] && (
        <View style={styles.subcatContainer}>
          <View style={styles.subcatHeader}>
            <Text style={styles.subcatLabel}>
              {layers.find((l) => l.id === expandedLayer)?.name} — subcategorias
            </Text>
            <TouchableOpacity
              onPress={() => onToggleLayer(expandedLayer)}
              data-testid="toggle-all-subcats"
            >
              <Text style={styles.toggleAllText}>
                {getLayerSubcategories(expandedLayer).every((s) =>
                  activeSubcategories.includes(s)
                )
                  ? 'Desmarcar tudo'
                  : 'Selecionar tudo'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.subcatGrid}>
            {subcategories[expandedLayer].map((sub) => {
              const isSubActive = activeSubcategories.includes(sub.id);
              const layerColor =
                layers.find((l) => l.id === expandedLayer)?.color || '#64748B';
              const isComingSoon = sub.comingSoon === true;
              return (
                <TouchableOpacity
                  key={sub.id}
                  style={[
                    styles.subcatChip,
                    {
                      backgroundColor: isComingSoon
                        ? 'rgba(255,255,255,0.03)'
                        : isSubActive
                        ? layerColor
                        : 'rgba(255,255,255,0.06)',
                      borderColor: isComingSoon
                        ? 'rgba(255,255,255,0.06)'
                        : isSubActive
                        ? layerColor
                        : 'rgba(255,255,255,0.12)',
                      opacity: isComingSoon ? 0.6 : 1,
                    },
                  ]}
                  onPress={() => {
                    if (isComingSoon) {
                      Alert.alert(
                        'Brevemente disponivel',
                        `${sub.name} estara disponivel na fase de parcerias. Fique atento!`,
                        [{ text: 'OK' }]
                      );
                      return;
                    }
                    onToggleSubcategory(sub.id, expandedLayer);
                  }}
                  data-testid={`subcat-${sub.id}`}
                >
                  <MaterialIcons
                    name={(isComingSoon ? 'lock-clock' : sub.icon) as any}
                    size={14}
                    color={
                      isSubActive
                        ? '#FFFFFF'
                        : isComingSoon
                        ? '#64748B'
                        : '#94A3B8'
                    }
                  />
                  <Text
                    style={[
                      styles.subcatText,
                      {
                        color: isSubActive
                          ? '#FFFFFF'
                          : isComingSoon
                          ? '#64748B'
                          : '#94A3B8',
                        fontWeight: isSubActive ? '600' : '400',
                      },
                    ]}
                  >
                    {sub.name}
                    {isComingSoon ? ' (em breve)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  sectionTitle: {
    color: '#E2DFD6',
    fontSize: 16,
    fontWeight: '700',
  },
  subcatCount: {
    color: '#64748B',
    fontSize: 12,
    marginLeft: 8,
  },
  layerContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  layerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    gap: 6,
  },
  layerChipExpanded: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  layerText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '500',
  },
  layerTextActive: {
    color: '#FFFFFF',
  },
  layerBadge: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 2,
  },
  layerBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  subcatContainer: {
    marginTop: 8,
    paddingHorizontal: 4,
  },
  subcatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  subcatLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  toggleAllText: {
    color: '#8B5CF6',
    fontSize: 11,
    fontWeight: '700',
  },
  subcatGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  subcatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  subcatText: {
    fontSize: 11,
    marginLeft: 4,
  },
});
