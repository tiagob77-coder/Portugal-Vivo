/**
 * Surf Forecast Widget
 * Shows 24h wave forecast for Portuguese surf spots
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import api from '../services/api';

interface ForecastPoint {
  time: string;
  wave_height_m: number;
  wave_direction: string;
  wave_period_s: number;
}

interface SpotForecast {
  spot: { name: string; type: string };
  current: { wave_height_m: number; surf_quality: string; wave_direction_cardinal: string };
  forecast_3h: ForecastPoint[];
}

interface SurfForecastWidgetProps {
  spotId?: string;
  onSpotPress?: (spotId: string) => void;
}

const QUALITY_CONFIG: Record<string, { color: string; gradient: [string, string]; label: string }> = {
  excellent: { color: '#22C55E', gradient: ['#166534', '#22C55E'], label: 'Excelente' },
  good: { color: '#3B82F6', gradient: ['#1D4ED8', '#3B82F6'], label: 'Bom' },
  fair: { color: '#C49A6C', gradient: ['#B45309', '#C49A6C'], label: 'Razoável' },
  poor: { color: '#EF4444', gradient: ['#B91C1C', '#EF4444'], label: 'Fraco' },
  flat: { color: '#6B7280', gradient: ['#374151', '#6B7280'], label: 'Flat' },
};

const SPOTS = [
  { id: 'nazare', name: 'Nazaré' },
  { id: 'peniche_supertubos', name: 'Peniche' },
  { id: 'ericeira_ribeira', name: 'Ericeira' },
  { id: 'sagres', name: 'Sagres' },
  { id: 'costa_caparica', name: 'Caparica' },
];

const getSpotForecast = async (spotId: string): Promise<SpotForecast> => {
  const response = await api.get(`/marine/spot/${spotId}`);
  return response.data;
};

const formatTime = (isoTime: string) => {
  const date = new Date(isoTime);
  return date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
};

const getTimeOfDay = (isoTime: string) => {
  const hour = new Date(isoTime).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 21) return 'evening';
  return 'night';
};

const TIME_ICONS: Record<string, string> = {
  morning: 'wb-sunny',
  afternoon: 'wb-sunny',
  evening: 'wb-twilight',
  night: 'nights-stay',
};

export function SurfForecastWidget({ spotId = 'nazare', onSpotPress }: SurfForecastWidgetProps) {
  const [selectedSpot, setSelectedSpot] = useState(spotId);

  const { data, isLoading, error } = useQuery({
    queryKey: ['surf-forecast', selectedSpot],
    queryFn: () => getSpotForecast(selectedSpot),
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchInterval: 30 * 60 * 1000, // 30 minutes
  });

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#3B82F6" />
        <Text style={styles.loadingText}>A carregar previsão...</Text>
      </View>
    );
  }

  if (error || !data) {
    // Show fallback UI instead of returning null
    return (
      <View style={styles.errorContainer} data-testid="surf-forecast-widget-error">
        <LinearGradient
          colors={['#374151', '#6B7280']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MaterialIcons name="surfing" size={24} color="#FFF" />
              <Text style={styles.title}>Previsão Surf 24h</Text>
            </View>
          </View>
          <View style={styles.errorContent}>
            <MaterialIcons name="cloud-off" size={32} color="rgba(255,255,255,0.5)" />
            <Text style={styles.errorText}>Não foi possível carregar a previsão</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => {}}>
              <Text style={styles.retryText}>Toque para tentar novamente</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  }

  const quality = data.current?.surf_quality || 'fair';
  const config = QUALITY_CONFIG[quality] || QUALITY_CONFIG.fair;

  return (
    <View style={styles.container} data-testid="surf-forecast-widget">
      <LinearGradient
        colors={config.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <MaterialIcons name="surfing" size={24} color="#FFF" />
            <Text style={styles.title}>Previsão Surf 24h</Text>
          </View>
          <View style={styles.qualityBadge}>
            <Text style={styles.qualityText}>{config.label}</Text>
          </View>
        </View>

        {/* Spot Selector */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.spotSelector}
          contentContainerStyle={styles.spotSelectorContent}
        >
          {SPOTS.map((spot) => (
            <TouchableOpacity
              key={spot.id}
              style={[
                styles.spotChip,
                selectedSpot === spot.id && styles.spotChipSelected,
              ]}
              onPress={() => setSelectedSpot(spot.id)}
            >
              <Text style={[
                styles.spotChipText,
                selectedSpot === spot.id && styles.spotChipTextSelected,
              ]}>
                {spot.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Current Conditions */}
        <View style={styles.currentSection}>
          <View style={styles.currentMain}>
            <Text style={styles.currentHeight}>
              {data.current?.wave_height_m?.toFixed(1) || '--'}
            </Text>
            <Text style={styles.currentUnit}>metros</Text>
          </View>
          <View style={styles.currentDetails}>
            <View style={styles.detailRow}>
              <MaterialIcons name="explore" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.detailText}>{data.current?.wave_direction_cardinal || '--'}</Text>
            </View>
            <View style={styles.detailRow}>
              <MaterialIcons name="timer" size={16} color="rgba(255,255,255,0.8)" />
              <Text style={styles.detailText}>{data.spot?.type?.replace('_', ' ') || 'beach'}</Text>
            </View>
          </View>
        </View>

        {/* Forecast Timeline */}
        <View style={styles.forecastSection}>
          <Text style={styles.forecastTitle}>Próximas horas</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.forecastContent}
          >
            {data.forecast_3h?.map((point, index) => {
              const timeOfDay = getTimeOfDay(point.time);
              return (
                <View key={index} style={styles.forecastItem}>
                  <Text style={styles.forecastTime}>{formatTime(point.time)}</Text>
                  <MaterialIcons 
                    name={TIME_ICONS[timeOfDay] as any} 
                    size={18} 
                    color="rgba(255,255,255,0.7)" 
                  />
                  <Text style={styles.forecastHeight}>{point.wave_height_m.toFixed(1)}m</Text>
                  <Text style={styles.forecastDirection}>{point.wave_direction}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Footer */}
        <TouchableOpacity 
          style={styles.footer}
          onPress={() => onSpotPress?.(selectedSpot)}
        >
          <Text style={styles.footerText}>Ver detalhes completos</Text>
          <MaterialIcons name="arrow-forward" size={16} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  loadingContainer: {
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
  },
  gradient: {
    padding: 16,
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
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  qualityBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  qualityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  spotSelector: {
    marginBottom: 16,
    marginHorizontal: -16,
  },
  spotSelectorContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  spotChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginRight: 8,
  },
  spotChipSelected: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  spotChipText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  spotChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  currentSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  currentMain: {
    alignItems: 'center',
  },
  currentHeight: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  currentUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -4,
  },
  currentDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  forecastSection: {
    marginBottom: 12,
  },
  forecastTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 10,
  },
  forecastContent: {
    gap: 4,
  },
  forecastItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginRight: 8,
    minWidth: 60,
    gap: 4,
  },
  forecastTime: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  forecastHeight: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  forecastDirection: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
  },
  footerText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '500',
  },
  // Error/Loading styles
  loadingText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 8,
  },
  errorContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginVertical: 8,
  },
  errorContent: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  errorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  retryText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
});

export default SurfForecastWidget;
