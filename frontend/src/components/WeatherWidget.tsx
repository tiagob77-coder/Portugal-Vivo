import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getWeatherForecast, getWeatherAlerts } from '../services/api';
import { colors, typography, spacing, borders, shadows } from '../theme';

interface WeatherWidgetProps {
  location?: string;
  onPress?: () => void;
}

const WEATHER_ICONS: Record<number, string> = {
  1: 'wb-sunny',        // Céu limpo
  2: 'wb-sunny',        // Céu pouco nublado
  3: 'cloud-queue',     // Parcialmente nublado
  4: 'cloud',           // Muito nublado
  5: 'filter-drama',    // Nuvens altas
  6: 'grain',           // Aguaceiros
  7: 'grain',           // Aguaceiros fracos
  8: 'grain',           // Aguaceiros moderados
  9: 'water-drop',      // Chuva
  10: 'water-drop',     // Chuva fraca
  11: 'water-drop',     // Chuva moderada
  12: 'thunderstorm',   // Chuva forte
  13: 'water-drop',     // Chuva intermitente
  14: 'flash-on',       // Trovoada
  15: 'ac-unit',        // Neve
  16: 'blur-on',        // Nevoeiro
  17: 'blur-on',        // Neblina
};

export const WeatherWidget: React.FC<WeatherWidgetProps> = ({ 
  location = 'lisboa',
  onPress 
}) => {
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['weather-forecast', location],
    queryFn: () => getWeatherForecast(location),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });

  const { data: alertsData } = useQuery({
    queryKey: ['weather-alerts'],
    queryFn: getWeatherAlerts,
    staleTime: 15 * 60 * 1000, // 15 minutes
  });

  if (forecastLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.terracotta[500]} />
      </View>
    );
  }

  const today = forecastData?.forecasts?.[0];
  const activeAlerts = alertsData?.alerts?.filter(a => a.level !== 'green') || [];
  const hasWarning = activeAlerts.length > 0;

  if (!today) {
    return null;
  }

  const weatherIcon = WEATHER_ICONS[today.weather_type] || 'wb-sunny';

  return (
    <TouchableOpacity 
      style={[styles.container, hasWarning && styles.containerWarning]} 
      onPress={onPress}
      activeOpacity={0.8}
      data-testid="weather-widget"
    >
      <View style={styles.mainRow}>
        <View style={styles.iconContainer}>
          <MaterialIcons 
            name={weatherIcon as any} 
            size={32} 
            color={hasWarning ? colors.terracotta[500] : colors.ocean[500]} 
          />
        </View>
        <View style={styles.tempContainer}>
          <Text style={styles.tempText}>
            {Math.round(today.temp_min)}° - {Math.round(today.temp_max)}°
          </Text>
          <Text style={styles.descText} numberOfLines={1}>
            {today.weather_description}
          </Text>
        </View>
        <View style={styles.locationContainer}>
          <Text style={styles.locationText}>{location.charAt(0).toUpperCase() + location.slice(1)}</Text>
          <Text style={styles.sourceText}>IPMA</Text>
        </View>
      </View>

      {hasWarning && (
        <View style={styles.alertRow}>
          <MaterialIcons name="warning" size={14} color={colors.terracotta[500]} />
          <Text style={styles.alertText} numberOfLines={1}>
            {activeAlerts[0]?.title || 'Alerta meteorológico ativo'}
          </Text>
        </View>
      )}

      {today.precipitation_prob > 30 && (
        <View style={styles.rainRow}>
          <MaterialIcons name="water-drop" size={12} color={colors.ocean[500]} />
          <Text style={styles.rainText}>
            {Math.round(today.precipitation_prob)}% probabilidade de chuva
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  containerWarning: {
    borderWidth: 1,
    borderColor: colors.terracotta[300],
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borders.radius.lg,
    backgroundColor: colors.mint[100],
    justifyContent: 'center',
    alignItems: 'center',
  },
  tempContainer: {
    flex: 1,
    marginLeft: spacing[3],
  },
  tempText: {
    fontSize: typography.fontSize.xl,
    fontWeight: '700',
    color: colors.gray[800],
  },
  descText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: 2,
  },
  locationContainer: {
    alignItems: 'flex-end',
  },
  locationText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.gray[700],
  },
  sourceText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
    marginTop: 2,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: colors.terracotta[100],
    gap: 6,
  },
  alertText: {
    fontSize: typography.fontSize.xs,
    color: colors.terracotta[600],
    flex: 1,
  },
  rainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[2],
    gap: 4,
  },
  rainText: {
    fontSize: typography.fontSize.xs,
    color: colors.ocean[500],
  },
});

export default WeatherWidget;
