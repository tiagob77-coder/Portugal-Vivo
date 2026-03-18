import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  getProtectedAreas,
  getBiodiversityStations,
  getNotableSpecies,
  getNatura2000Sites as _getNatura2000Sites,
  getNatureMapLayers,
} from '../services/api';
import { stateColors, palette } from '../theme';

interface NatureExplorerProps {
  lat?: number;
  lng?: number;
  onAreaPress?: (area: any) => void;
  onStationPress?: (station: any) => void;
  onSpeciesPress?: (species: any) => void;
}

const NatureExplorer: React.FC<NatureExplorerProps> = ({
  lat,
  lng,
  onAreaPress,
  onStationPress,
  onSpeciesPress,
}) => {
  const [areas, setAreas] = useState<any[]>([]);
  const [stations, setStations] = useState<any[]>([]);
  const [species, setSpecies] = useState<any[]>([]);
  const [_mapLayers, setMapLayers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'areas' | 'stations' | 'species'>('areas');

  useEffect(() => {
    loadData();
  }, [lat, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      const params = lat && lng ? { lat, lng, radius_km: 100 } : {};
      const [areasRes, stationsRes, speciesRes, layersRes] = await Promise.all([
        getProtectedAreas(params),
        getBiodiversityStations(params),
        getNotableSpecies(),
        getNatureMapLayers(),
      ]);
      setAreas(areasRes.areas || []);
      setStations(stationsRes.stations || []);
      setSpecies(speciesRes.species || []);
      setMapLayers(layersRes.layers || []);
    } catch (_e) {
      // Offline fallback handled by cachedGet
    }
    setLoading(false);
  };

  const tabs = [
    { key: 'areas' as const, label: 'Áreas Protegidas', icon: 'park' as const, count: areas.length },
    { key: 'stations' as const, label: 'Biodiversidade', icon: 'biotech' as const, count: stations.length },
    { key: 'species' as const, label: 'Espécies', icon: 'pets' as const, count: species.length },
  ];

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={stateColors.event.natureza} />
        <Text style={styles.loadingText}>A carregar natureza...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="eco" size={24} color={stateColors.event.natureza} />
        <Text style={styles.title}>Natureza & Biodiversidade</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <MaterialIcons
              name={tab.icon}
              size={18}
              color={activeTab === tab.key ? palette.white : stateColors.event.natureza}
            />
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label} ({tab.count})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.content}>
        {activeTab === 'areas' && areas.map((area, i) => (
          <TouchableOpacity
            key={area.id || i}
            style={styles.card}
            onPress={() => onAreaPress?.(area)}
          >
            <View style={styles.cardHeader}>
              <MaterialIcons name="landscape" size={20} color={stateColors.event.natureza} />
              <Text style={styles.cardTitle}>{area.name}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{area.designation}</Text>
            <Text style={styles.cardDescription} numberOfLines={2}>{area.description}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.metaText}>{area.region}</Text>
              {area.area_km2 && <Text style={styles.metaText}>{area.area_km2} km2</Text>}
              {area.distance_km !== undefined && (
                <Text style={styles.distanceBadge}>{area.distance_km} km</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {activeTab === 'stations' && stations.map((station, i) => (
          <TouchableOpacity
            key={station.id || i}
            style={styles.card}
            onPress={() => onStationPress?.(station)}
          >
            <View style={styles.cardHeader}>
              <MaterialIcons name="biotech" size={20} color={stateColors.surf.good} />
              <Text style={styles.cardTitle}>{station.name}</Text>
            </View>
            <Text style={styles.cardSubtitle}>{station.habitat_type}</Text>
            {station.species_count && (
              <Text style={styles.speciesCount}>{station.species_count} espécies registadas</Text>
            )}
            <View style={styles.highlightsRow}>
              {(station.highlights || []).slice(0, 3).map((h: string, j: number) => (
                <View key={j} style={styles.highlightChip}>
                  <Text style={styles.highlightText}>{h}</Text>
                </View>
              ))}
            </View>
            {station.distance_km !== undefined && (
              <Text style={styles.distanceBadge}>{station.distance_km} km</Text>
            )}
          </TouchableOpacity>
        ))}

        {activeTab === 'species' && species.map((sp, i) => (
          <TouchableOpacity
            key={sp.taxon_key || i}
            style={styles.card}
            onPress={() => onSpeciesPress?.(sp)}
          >
            <View style={styles.cardHeader}>
              <MaterialIcons name="pets" size={20} color="#F59E0B" />
              <Text style={styles.cardTitle}>{sp.name}</Text>
            </View>
            <Text style={styles.scientificName}>{sp.scientific}</Text>
            <View style={styles.cardMeta}>
              <View style={[styles.iucnBadge, { backgroundColor: getIUCNColor(sp.iucn) }]}>
                <Text style={styles.iucnText}>{sp.iucn}</Text>
              </View>
              <Text style={styles.metaText}>{sp.habitat}</Text>
            </View>
            <View style={styles.highlightsRow}>
              {(sp.regions || []).map((r: string, j: number) => (
                <View key={j} style={styles.regionChip}>
                  <Text style={styles.highlightText}>{r}</Text>
                </View>
              ))}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const getIUCNColor = (status: string): string => {
  switch (status) {
    case 'CR': return '#DC2626';
    case 'EN': return '#EA580C';
    case 'VU': return '#F59E0B';
    case 'NT': return '#84CC16';
    case 'LC': return stateColors.event.natureza;
    default: return '#9CA3AF';
  }
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FDF4' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  loadingText: { marginTop: 12, color: stateColors.surf.flat, fontSize: 14 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 8 },
  title: { fontSize: 20, fontWeight: '700', color: '#166534' },
  tabBar: { paddingHorizontal: 12, maxHeight: 44 },
  tab: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, marginRight: 8, backgroundColor: '#DCFCE7', gap: 6,
  },
  tabActive: { backgroundColor: stateColors.event.natureza },
  tabText: { fontSize: 13, color: '#166534', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  content: { flex: 1, padding: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1F2937', flex: 1 },
  cardSubtitle: { fontSize: 13, color: stateColors.surf.flat, marginBottom: 4 },
  cardDescription: { fontSize: 13, color: '#4B5563', marginBottom: 8, lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  metaText: { fontSize: 12, color: '#9CA3AF' },
  distanceBadge: {
    fontSize: 12, color: stateColors.event.natureza, fontWeight: '700',
    backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10,
  },
  speciesCount: { fontSize: 13, color: stateColors.surf.good, fontWeight: '600', marginBottom: 6 },
  highlightsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  highlightChip: {
    backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  highlightText: { fontSize: 11, color: '#166534' },
  regionChip: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  scientificName: { fontSize: 13, color: stateColors.surf.flat, fontStyle: 'italic', marginBottom: 6 },
  iucnBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  iucnText: { fontSize: 11, color: '#fff', fontWeight: '700' },
});

export default NatureExplorer;
