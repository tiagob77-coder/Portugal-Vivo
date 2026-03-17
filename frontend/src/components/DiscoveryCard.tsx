import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { enrichEvent, getEventToNatureItinerary } from '../services/api';
import { palette, stateColors, withOpacity } from '../theme';

interface DiscoveryCardProps {
  eventName: string;
  lat: number;
  lng: number;
  onTransportPress?: (stop: any) => void;
  onNaturePress?: (suggestion: any) => void;
  showItinerary?: boolean;
}

const DiscoveryCard: React.FC<DiscoveryCardProps> = ({
  eventName,
  lat,
  lng,
  onTransportPress,
  onNaturePress,
  showItinerary = false,
}) => {
  const [enrichment, setEnrichment] = useState<any>(null);
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [lat, lng, eventName]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    setLoading(true);
    try {
      const [enrichData, itineraryData] = await Promise.all([
        enrichEvent(lat, lng, eventName),
        showItinerary ? getEventToNatureItinerary(lat, lng, eventName) : Promise.resolve(null),
      ]);
      setEnrichment(enrichData);
      setItinerary(itineraryData);
    } catch (_e) {
      // silent fail
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color="#8B5CF6" />
      </View>
    );
  }

  if (!enrichment) return null;

  return (
    <ScrollView style={styles.container}>
      {/* Geo Context */}
      {enrichment.geo_context && (
        <View style={styles.geoBar}>
          <MaterialIcons name="place" size={14} color={palette.gray[500]} />
          <Text style={styles.geoText}>
            {enrichment.geo_context.freguesia}, {enrichment.geo_context.concelho}, {enrichment.geo_context.distrito}
          </Text>
        </View>
      )}

      {/* Protected Area */}
      {enrichment.protected_area && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => onNaturePress?.(enrichment.protected_area)}
        >
          <View style={styles.sectionHeader}>
            <MaterialIcons name="park" size={18} color={stateColors.surf.excellent} />
            <Text style={styles.sectionTitle}>Área Protegida Próxima</Text>
          </View>
          <Text style={styles.areaName}>{enrichment.protected_area.area.name}</Text>
          <Text style={styles.areaDesignation}>{enrichment.protected_area.area.designation}</Text>
          <Text style={styles.distance}>{enrichment.protected_area.distance_km} km</Text>
        </TouchableOpacity>
      )}

      {/* Biodiversity Station */}
      {enrichment.biodiversity_station && (
        <TouchableOpacity
          style={styles.section}
          onPress={() => onNaturePress?.(enrichment.biodiversity_station)}
        >
          <View style={styles.sectionHeader}>
            <MaterialIcons name="biotech" size={18} color="#3B82F6" />
            <Text style={styles.sectionTitle}>Estação de Biodiversidade</Text>
          </View>
          <Text style={styles.areaName}>{enrichment.biodiversity_station.station.name}</Text>
          <View style={styles.highlightsRow}>
            {(enrichment.biodiversity_station.station.highlights || []).slice(0, 3).map((h: string, i: number) => (
              <View key={i} style={styles.chip}>
                <Text style={styles.chipText}>{h}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.distance}>{enrichment.biodiversity_station.distance_km} km</Text>
        </TouchableOpacity>
      )}

      {/* Transport */}
      {enrichment.transport && enrichment.transport.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="directions-transit" size={18} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Transportes Próximos</Text>
          </View>
          {enrichment.transport.slice(0, 3).map((stop: any, i: number) => (
            <TouchableOpacity
              key={stop.id || i}
              style={styles.transportItem}
              onPress={() => onTransportPress?.(stop)}
            >
              <MaterialIcons
                name={stop.transport_type === 'metro' ? 'subway' : 'train'}
                size={16}
                color={palette.gray[500]}
              />
              <View style={styles.transportInfo}>
                <Text style={styles.transportName}>{stop.name}</Text>
                <Text style={styles.transportOperator}>{stop.operator}</Text>
              </View>
              <Text style={styles.transportDistance}>{stop.distance_m}m</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Nature Suggestions */}
      {enrichment.nature_suggestions && enrichment.nature_suggestions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="eco" size={18} color={stateColors.surf.excellent} />
            <Text style={styles.sectionTitle}>Sugestões de Natureza</Text>
          </View>
          {enrichment.nature_suggestions.map((sug: any, i: number) => (
            <TouchableOpacity
              key={i}
              style={styles.suggestionCard}
              onPress={() => onNaturePress?.(sug)}
            >
              <Text style={styles.suggestionTitle}>{sug.title}</Text>
              <Text style={styles.suggestionDesc} numberOfLines={2}>{sug.description}</Text>
              {sug.highlights && sug.highlights.length > 0 && (
                <View style={styles.highlightsRow}>
                  {sug.highlights.slice(0, 3).map((h: string, j: number) => (
                    <View key={j} style={styles.chipGreen}>
                      <Text style={styles.chipGreenText}>{h}</Text>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 2-Day Itinerary */}
      {itinerary && itinerary.day_2_morning && (
        <View style={styles.itinerarySection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event-note" size={18} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Itinerário Sustentável (2 dias)</Text>
          </View>

          <View style={styles.dayCard}>
            <Text style={styles.dayLabel}>Dia 1 - Noite</Text>
            <Text style={styles.dayActivity}>{itinerary.day_1_evening.activity}</Text>
          </View>

          {itinerary.transport_between && (
            <View style={styles.transportArrow}>
              <MaterialIcons name="arrow-downward" size={20} color="#8B5CF6" />
              <Text style={styles.transportNote}>
                {itinerary.transport_between.direct_distance_km} km por transporte público
              </Text>
            </View>
          )}

          <View style={styles.dayCard}>
            <Text style={styles.dayLabel}>Dia 2 - Manhã</Text>
            <Text style={styles.dayActivity}>{itinerary.day_2_morning.activity}</Text>
            {itinerary.day_2_morning.notable_species && (
              <View style={styles.highlightsRow}>
                {itinerary.day_2_morning.notable_species.slice(0, 3).map((sp: any, i: number) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{sp.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {itinerary.sustainability_tips && (
            <View style={styles.tipsBox}>
              <MaterialIcons name="lightbulb" size={16} color={stateColors.surf.excellent} />
              <Text style={styles.tipsTitle}>Dicas de Sustentabilidade</Text>
              {itinerary.sustainability_tips.slice(0, 3).map((tip: string, i: number) => (
                <Text key={i} style={styles.tipText}>- {tip}</Text>
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { padding: 20, alignItems: 'center' },
  geoBar: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: palette.gray[50],
  },
  geoText: { fontSize: 12, color: palette.gray[500] },
  section: {
    backgroundColor: palette.white, marginHorizontal: 12, marginTop: 10, borderRadius: 12,
    padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: palette.gray[700] },
  areaName: { fontSize: 15, fontWeight: '600', color: palette.gray[800] },
  areaDesignation: { fontSize: 12, color: palette.gray[500], marginTop: 2 },
  distance: { fontSize: 12, color: stateColors.surf.excellent, fontWeight: '700', marginTop: 6 },
  highlightsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  chip: {
    backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1, borderColor: '#BFDBFE',
  },
  chipText: { fontSize: 11, color: '#1E40AF' },
  chipGreen: {
    backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  chipGreenText: { fontSize: 11, color: '#166534' },
  transportItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  transportInfo: { flex: 1 },
  transportName: { fontSize: 14, fontWeight: '600', color: palette.gray[800] },
  transportOperator: { fontSize: 11, color: palette.gray[400] },
  transportDistance: { fontSize: 13, fontWeight: '700', color: '#F59E0B' },
  suggestionCard: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 8,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  suggestionTitle: { fontSize: 14, fontWeight: '700', color: '#166534' },
  suggestionDesc: { fontSize: 12, color: palette.gray[500], marginTop: 4, lineHeight: 17 },
  itinerarySection: {
    backgroundColor: '#FAF5FF', marginHorizontal: 12, marginTop: 10, borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: '#E9D5FF',
  },
  dayCard: {
    backgroundColor: palette.white, borderRadius: 10, padding: 12, marginTop: 8,
  },
  dayLabel: { fontSize: 12, fontWeight: '700', color: '#8B5CF6', textTransform: 'uppercase' },
  dayActivity: { fontSize: 14, fontWeight: '600', color: palette.gray[800], marginTop: 4 },
  transportArrow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12,
  },
  transportNote: { fontSize: 12, color: '#8B5CF6' },
  tipsBox: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, marginTop: 10,
  },
  tipsTitle: { fontSize: 13, fontWeight: '700', color: '#166534', marginBottom: 6 },
  tipText: { fontSize: 12, color: palette.gray[500], lineHeight: 18 },
});

export default DiscoveryCard;
