/**
 * ProximityPanel - Nearby POI discovery panel.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '../../../src/theme';

interface ProximityPOI {
  id: string;
  name: string;
  category: string;
  region: string;
  distance_m: number;
  distance_km: number;
  iq_score: number;
}

interface ProximityPanelProps {
  isLoading: boolean;
  total: number;
  pois: ProximityPOI[];
  getMarkerColor: (category: string) => string;
  getLayerIcon: (category: string) => string;
  onPoiPress: (poiId: string) => void;
  onRefresh: () => void;
}

export default function ProximityPanel({
  isLoading,
  total,
  pois,
  getMarkerColor,
  getLayerIcon,
  onPoiPress,
  onRefresh,
}: ProximityPanelProps) {
  return (
    <View style={styles.panel} data-testid="proximity-panel">
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.pulse}>
            <MaterialIcons name="near-me" size={18} color="#FFF" />
          </View>
          <View>
            <Text style={styles.title}>POIs Perto de Si</Text>
            <Text style={styles.subtitle}>
              {isLoading
                ? 'A localizar...'
                : `${total} locais num raio de 5km`}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.refreshBtn}
          onPress={onRefresh}
          data-testid="proximity-refresh-btn"
        >
          <MaterialIcons name="refresh" size={18} color={colors.terracotta[500]} />
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color="#C49A6C" />
          <Text style={styles.loadingText}>A procurar POIs próximos...</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
        >
          {pois.slice(0, 10).map((poi, idx) => (
            <TouchableOpacity
              key={poi.id}
              style={styles.card}
              onPress={() => onPoiPress(poi.id)}
              activeOpacity={0.8}
              data-testid={`proximity-poi-${idx}`}
            >
              <View
                style={[
                  styles.cardHeader,
                  { backgroundColor: getMarkerColor(poi.category) + '20' },
                ]}
              >
                <MaterialIcons
                  name={getLayerIcon(poi.category) as any}
                  size={20}
                  color={getMarkerColor(poi.category)}
                />
                <View style={styles.distance}>
                  <Text style={styles.distanceText}>
                    {poi.distance_m < 1000
                      ? `${poi.distance_m}m`
                      : `${poi.distance_km}km`}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardName} numberOfLines={2}>
                {poi.name}
              </Text>
              <Text style={styles.cardMeta}>
                {poi.category} - {poi.region}
              </Text>
              {poi.iq_score > 0 && (
                <View
                  style={[
                    styles.iq,
                    {
                      backgroundColor:
                        poi.iq_score >= 60 ? '#7C3AED20' : '#C49A6C20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.iqText,
                      {
                        color: poi.iq_score >= 60 ? '#7C3AED' : '#C49A6C',
                      },
                    ]}
                  >
                    IQ {poi.iq_score.toFixed(0)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
  pulse: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#264E41',
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
  refreshBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  loading: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    color: '#8A8A8A',
    fontSize: 12,
  },
  list: {
    gap: 10,
    paddingRight: 8,
  },
  card: {
    width: 140,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    padding: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  distance: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  distanceText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  cardName: {
    color: '#E2DFD6',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardMeta: {
    color: '#64748B',
    fontSize: 10,
    marginBottom: 4,
  },
  iq: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  iqText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
