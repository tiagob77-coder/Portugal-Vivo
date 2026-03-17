/**
 * Surf Conditions Widget
 * Shows real-time wave conditions from Open-Meteo API
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { getAllSpotsConditions, getSurfSpotConditions } from '../services/api';

interface SurfWidgetProps {
  spotId?: string; // Specific spot, or show best conditions
  compact?: boolean;
  onPress?: () => void;
}

const QUALITY_CONFIG: Record<string, { color: string; gradient: string[]; label: string; icon: string }> = {
  excellent: { color: '#22C55E', gradient: ['#166534', '#22C55E'], label: 'Excelente', icon: 'sentiment-very-satisfied' },
  good: { color: '#3B82F6', gradient: ['#1D4ED8', '#3B82F6'], label: 'Bom', icon: 'sentiment-satisfied' },
  fair: { color: '#C49A6C', gradient: ['#B45309', '#C49A6C'], label: 'Razoável', icon: 'sentiment-neutral' },
  poor: { color: '#EF4444', gradient: ['#B91C1C', '#EF4444'], label: 'Fraco', icon: 'sentiment-dissatisfied' },
  flat: { color: '#6B7280', gradient: ['#374151', '#6B7280'], label: 'Flat', icon: 'waves' },
};

export function SurfConditionsWidget({ spotId, compact = false, onPress }: SurfWidgetProps) {
  const { data, isLoading, error } = useQuery<any>({
    queryKey: spotId ? ['surf-spot', spotId] : ['surf-all'],
    queryFn: () => spotId ? getSurfSpotConditions(spotId) : getAllSpotsConditions(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Refetch every 10 minutes
  });

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  }

  if (error || !data) {
    return null; // Silently fail
  }

  // Get best spot or specific spot data
  let spotData: any;
  let spotName: string;
  
  if (spotId && 'current' in (data as any)) {
    spotData = data;
    spotName = (data as any).spot?.name || spotId;
  } else if ('spots' in (data as any) && (data as any).spots.length > 0) {
    // Get the best quality spot
    spotData = (data as any).spots[0];
    spotName = spotData.spot?.name || 'Melhor Spot';
  } else {
    return null;
  }

  const waveHeight = spotId ? spotData.current?.wave_height_m : spotData.wave_height_m;
  const wavePeriod = spotId ? spotData.current?.wave_period_s : spotData.wave_period_s;
  const waveDirection = spotId ? spotData.current?.wave_direction_cardinal : spotData.wave_direction;
  const quality = spotId ? spotData.current?.surf_quality : spotData.surf_quality;
  
  const config = QUALITY_CONFIG[quality] || QUALITY_CONFIG.fair;

  if (compact) {
    return (
      <TouchableOpacity 
        style={styles.compactContainer} 
        onPress={onPress}
        activeOpacity={0.8}
        data-testid="surf-widget-compact"
      >
        <View style={[styles.qualityBadge, { backgroundColor: config.color }]}>
          <MaterialIcons name="waves" size={14} color="#FFF" />
        </View>
        <Text style={styles.compactText}>{waveHeight?.toFixed(1)}m</Text>
        <Text style={styles.compactLabel}>{config.label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container} 
      onPress={onPress}
      activeOpacity={0.8}
      data-testid="surf-widget"
    >
      <LinearGradient
        colors={config.gradient as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="waves" size={24} color="#FFF" />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Condições de Surf</Text>
            <Text style={styles.spotName}>{spotName}</Text>
          </View>
          <View style={styles.qualityContainer}>
            <MaterialIcons name={config.icon as any} size={20} color="#FFF" />
            <Text style={styles.qualityText}>{config.label}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{waveHeight?.toFixed(1) || '--'}</Text>
            <Text style={styles.statUnit}>m</Text>
            <Text style={styles.statLabel}>Altura</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{wavePeriod?.toFixed(0) || '--'}</Text>
            <Text style={styles.statUnit}>s</Text>
            <Text style={styles.statLabel}>Período</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{waveDirection || '--'}</Text>
            <Text style={styles.statUnit}></Text>
            <Text style={styles.statLabel}>Direção</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <MaterialIcons name="info-outline" size={12} color="rgba(255,255,255,0.6)" />
          <Text style={styles.footerText}>Dados em tempo real • Open-Meteo</Text>
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
    backgroundColor: '#264E41',
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
  spotName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  qualityText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statUnit: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: -4,
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
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
    backgroundColor: '#264E41',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  qualityBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compactText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  compactLabel: {
    fontSize: 12,
    color: '#94A3B8',
  },
});

export default SurfConditionsWidget;
