/**
 * Tides Widget
 * Shows real-time tide conditions from astronomical calculations or Stormglass API
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';

import { API_URL } from '../config/api';
import { palette, stateColors } from '../theme';

interface TideData {
  source: string;
  api_type: string;
  latitude: number;
  longitude: number;
  station?: string;
  current?: {
    height_m: number;
    state: string;
  };
  next_high_tide?: {
    type: string;
    datetime: string;
    height_m: number;
  };
  next_low_tide?: {
    type: string;
    datetime: string;
    height_m: number;
  };
  moon_phase?: number;
  tide_type?: string;
  timestamp: string;
}

interface TidesWidgetProps {
  latitude: number;
  longitude: number;
  compact?: boolean;
  onPress?: () => void;
  showStationPicker?: boolean;
}

const TIDE_STATE_CONFIG: Record<string, { color: string; gradient: string[]; label: string; icon: string }> = {
  rising: { color: stateColors.tide.rising, gradient: ['#1E40AF', stateColors.tide.rising], label: 'Subindo', icon: 'arrow-upward' },
  falling: { color: stateColors.tide.falling, gradient: ['#B45309', stateColors.tide.falling], label: 'Descendo', icon: 'arrow-downward' },
  high: { color: stateColors.tide.high, gradient: ['#166534', stateColors.tide.high], label: 'Preia-mar', icon: 'vertical-align-top' },
  low: { color: stateColors.tide.low, gradient: ['#B91C1C', stateColors.tide.low], label: 'Baixa-mar', icon: 'vertical-align-bottom' },
};

const MOON_PHASES = [
  { name: 'Lua Nova', icon: 'brightness-3', rotation: 180 },
  { name: 'Quarto Crescente', icon: 'brightness-2', rotation: 90 },
  { name: 'Lua Cheia', icon: 'brightness-5', rotation: 0 },
  { name: 'Quarto Minguante', icon: 'brightness-2', rotation: 270 },
];

const STATIONS = [
  { id: 'nazare', name: 'Nazaré', lat: 39.6021, lng: -9.0710 },
  { id: 'cascais', name: 'Cascais', lat: 38.6929, lng: -9.4215 },
  { id: 'lisboa', name: 'Lisboa', lat: 38.7074, lng: -9.1365 },
  { id: 'peniche', name: 'Peniche', lat: 39.3563, lng: -9.3810 },
  { id: 'figueira', name: 'Figueira da Foz', lat: 40.1486, lng: -8.8691 },
  { id: 'leixoes', name: 'Leixões/Porto', lat: 41.1820, lng: -8.7028 },
  { id: 'viana', name: 'Viana do Castelo', lat: 41.6938, lng: -8.8327 },
  { id: 'aveiro', name: 'Aveiro', lat: 40.6405, lng: -8.7539 },
  { id: 'setubal', name: 'Setúbal', lat: 38.5244, lng: -8.8925 },
  { id: 'sines', name: 'Sines', lat: 37.9505, lng: -8.8727 },
  { id: 'lagos', name: 'Lagos', lat: 37.1028, lng: -8.6728 },
  { id: 'faro', name: 'Faro', lat: 36.9990, lng: -7.9344 },
  { id: 'funchal', name: 'Funchal', lat: 32.6411, lng: -16.9188 },
  { id: 'ponta_delgada', name: 'Ponta Delgada', lat: 37.7396, lng: -25.6687 },
];

const getMoonPhaseInfo = (phase: number) => {
  const idx = Math.floor(phase * 4) % 4;
  return MOON_PHASES[idx];
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

const getTideData = async (lat: number, lng: number): Promise<TideData> => {
  const response = await fetch(`${API_URL}/api/marine/tides?lat=${lat}&lng=${lng}`);
  if (!response.ok) {
    throw new Error('Failed to fetch tide data');
  }
  return response.json();
};

export function TidesWidget({ latitude, longitude, compact = false, onPress, showStationPicker = false }: TidesWidgetProps) {
  const [selectedStation, setSelectedStation] = useState<{ lat: number; lng: number } | null>(null);
  const activeLat = selectedStation?.lat ?? latitude;
  const activeLng = selectedStation?.lng ?? longitude;

  const { data, isLoading, error } = useQuery({
    queryKey: ['tides', activeLat, activeLng],
    queryFn: () => getTideData(activeLat, activeLng),
    staleTime: 15 * 60 * 1000, // 15 minutes
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    enabled: !!activeLat && !!activeLng,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  if (error || !data || !data.current) {
    return null; // Silently fail
  }

  const tideState = data.current.state;
  const config = TIDE_STATE_CONFIG[tideState] || TIDE_STATE_CONFIG.rising;
  const moonInfo = getMoonPhaseInfo(data.moon_phase || 0);

  if (compact) {
    return (
      <TouchableOpacity
        style={styles.compactContainer}
        onPress={onPress}
        activeOpacity={0.8}
        data-testid="tides-widget-compact"
      >
        <View style={[styles.tideBadge, { backgroundColor: config.color }]}>
          <MaterialIcons name={config.icon as any} size={14} color={palette.white} />
        </View>
        <Text style={styles.compactText}>{data.current.height_m.toFixed(1)}m</Text>
        <Text style={styles.compactLabel}>{config.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
      data-testid="tides-widget"
    >
      {showStationPicker && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.stationPicker}
          contentContainerStyle={styles.stationPickerContent}
        >
          {STATIONS.map((station) => {
            const isActive = activeLat === station.lat && activeLng === station.lng;
            return (
              <TouchableOpacity
                key={station.id}
                style={[styles.stationChip, isActive && styles.stationChipActive]}
                onPress={() => setSelectedStation({ lat: station.lat, lng: station.lng })}
              >
                <Text style={[styles.stationChipText, isActive && styles.stationChipTextActive]}>
                  {station.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      <LinearGradient
        colors={config.gradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="waves" size={24} color={palette.white} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Marés</Text>
            <Text style={styles.stationName}>{data.station || 'Costa Portuguesa'}</Text>
          </View>
          <View style={styles.stateContainer}>
            <MaterialIcons name={config.icon as any} size={20} color={palette.white} />
            <Text style={styles.stateText}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.currentRow}>
          <View style={styles.currentHeight}>
            <Text style={styles.heightValue}>{data.current.height_m.toFixed(2)}</Text>
            <Text style={styles.heightUnit}>metros</Text>
          </View>

          <View style={styles.moonPhase}>
            <View style={{ transform: [{ rotate: `${moonInfo.rotation}deg` }] }}>
              <MaterialIcons name={moonInfo.icon as any} size={28} color="rgba(255,255,255,0.8)" />
            </View>
            <Text style={styles.moonText}>{moonInfo.name}</Text>
            {data.tide_type && (
              <Text style={styles.tideTypeText}>
                Maré {data.tide_type === 'spring' ? 'Viva' : data.tide_type === 'neap' ? 'Morta' : 'Moderada'}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.nextTides}>
          {data.next_high_tide && (
            <View style={styles.nextTideItem}>
              <MaterialIcons name="vertical-align-top" size={16} color="rgba(255,255,255,0.8)" />
              <View style={styles.nextTideInfo}>
                <Text style={styles.nextTideLabel}>Preia-mar</Text>
                <Text style={styles.nextTideTime}>{formatTime(data.next_high_tide.datetime)}</Text>
                <Text style={styles.nextTideHeight}>{data.next_high_tide.height_m?.toFixed(2)}m</Text>
              </View>
            </View>
          )}

          {data.next_low_tide && (
            <View style={styles.nextTideItem}>
              <MaterialIcons name="vertical-align-bottom" size={16} color="rgba(255,255,255,0.8)" />
              <View style={styles.nextTideInfo}>
                <Text style={styles.nextTideLabel}>Baixa-mar</Text>
                <Text style={styles.nextTideTime}>{formatTime(data.next_low_tide.datetime)}</Text>
                <Text style={styles.nextTideHeight}>{data.next_low_tide.height_m?.toFixed(2)}m</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.footer}>
          <MaterialIcons name="info-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={styles.footerText}>
            {data.api_type === 'real' ? 'Dados Stormglass' : 'Cálculo astronómico'} • Atualizado
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  containerCompact: {
    backgroundColor: palette.forest[600],
    padding: 8,
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  stationName: {
    fontSize: 16,
    color: palette.white,
    fontWeight: '700',
  },
  stateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  stateText: {
    fontSize: 12,
    color: palette.white,
    fontWeight: '600',
  },
  currentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  currentHeight: {
    alignItems: 'center',
  },
  heightValue: {
    fontSize: 36,
    fontWeight: '700',
    color: palette.white,
  },
  heightUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -4,
  },
  moonPhase: {
    alignItems: 'center',
    gap: 4,
  },
  moonText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  tideTypeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  nextTides: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  nextTideItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  nextTideInfo: {
    flex: 1,
  },
  nextTideLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },
  nextTideTime: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.white,
  },
  nextTideHeight: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    gap: 4,
  },
  footerText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.forest[600],
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  tideBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.white,
  },
  compactLabel: {
    fontSize: 12,
    color: palette.gray[400],
  },
  stationPicker: {
    marginBottom: 12,
  },
  stationPickerContent: {
    gap: 8,
    paddingHorizontal: 4,
  },
  stationChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stationChipActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  stationChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  stationChipTextActive: {
    color: palette.white,
    fontWeight: '700',
  },
});

export default TidesWidget;
