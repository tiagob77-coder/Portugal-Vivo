import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getSafetyCheck, getActiveFires } from '../services/api';
import { colors, typography, spacing, borders, shadows } from '../theme';

interface SafetyWidgetProps {
  lat?: number;
  lng?: number;
  onPress?: () => void;
  compact?: boolean;
}

export const SafetyWidget: React.FC<SafetyWidgetProps> = ({ 
  lat = 38.7223,  // Default: Lisboa
  lng = -9.1393,
  onPress,
  compact = false
}) => {
  const { data: safetyData, isLoading } = useQuery({
    queryKey: ['safety-check', lat, lng],
    queryFn: () => getSafetyCheck(lat, lng),
    staleTime: 10 * 60 * 1000, // 10 minutes
    enabled: !!lat && !!lng,
  });

  const { data: firesData } = useQuery({
    queryKey: ['active-fires'],
    queryFn: () => getActiveFires(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <View style={[styles.container, compact && styles.containerCompact]}>
        <ActivityIndicator size="small" color={colors.terracotta[500]} />
      </View>
    );
  }

  const safetyLevel = safetyData?.safety_level || 'safe';
  const totalFires = firesData?.total || 0;
  const activeFires = firesData?.active_count || 0;

  const getStatusConfig = () => {
    switch (safetyLevel) {
      case 'danger':
        return {
          icon: 'error',
          color: '#DC2626',
          bgColor: '#FEE2E2',
          title: 'Perigo',
          subtitle: 'Riscos na área',
        };
      case 'warning':
        return {
          icon: 'warning',
          color: colors.terracotta[500],
          bgColor: colors.terracotta[100],
          title: 'Atenção',
          subtitle: 'Alertas ativos',
        };
      default:
        return {
          icon: 'check-circle',
          color: '#16A34A',
          bgColor: '#DCFCE7',
          title: 'Seguro',
          subtitle: 'Sem alertas',
        };
    }
  };

  const config = getStatusConfig();

  if (compact) {
    return (
      <TouchableOpacity 
        style={[styles.containerCompact, { backgroundColor: config.bgColor }]}
        onPress={onPress}
        activeOpacity={0.8}
        data-testid="safety-widget-compact"
      >
        <MaterialIcons name={config.icon as any} size={20} color={config.color} />
        <Text style={[styles.compactText, { color: config.color }]}>{config.title}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.8}
      data-testid="safety-widget"
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
          <MaterialIcons name={config.icon as any} size={24} color={config.color} />
        </View>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: config.color }]}>{config.title}</Text>
          <Text style={styles.subtitle}>{config.subtitle}</Text>
        </View>
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <MaterialIcons name="local-fire-department" size={16} color={colors.gray[500]} />
            <Text style={styles.statText}>{activeFires}</Text>
          </View>
        </View>
      </View>

      {safetyData?.message && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageText}>{safetyData.message}</Text>
        </View>
      )}

      {totalFires > 0 && (
        <View style={styles.firesInfo}>
          <Text style={styles.firesText}>
            {totalFires} {totalFires === 1 ? 'ocorrência' : 'ocorrências'} em Portugal
          </Text>
          <Text style={styles.sourceText}>Fonte: Fogos.pt / Proteção Civil</Text>
        </View>
      )}

      {(safetyData?.weather_alerts?.length ?? 0) > 0 && (
        <View style={styles.alertsContainer}>
          {safetyData?.weather_alerts?.slice(0, 2).map((alert: any, index: number) => (
            <View key={index} style={styles.alertItem}>
              <MaterialIcons name="cloud" size={14} color={colors.terracotta[500]} />
              <Text style={styles.alertItemText} numberOfLines={1}>{alert.title}</Text>
            </View>
          ))}
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
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borders.radius.full,
    gap: 6,
  },
  compactText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: borders.radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    flex: 1,
    marginLeft: spacing[3],
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[500],
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: spacing[2],
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: borders.radius.full,
    gap: 4,
  },
  statText: {
    fontSize: typography.fontSize.sm,
    fontWeight: '600',
    color: colors.gray[700],
  },
  messageContainer: {
    marginTop: spacing[3],
    padding: spacing[3],
    backgroundColor: colors.mint[50],
    borderRadius: borders.radius.lg,
  },
  messageText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    lineHeight: 20,
  },
  firesInfo: {
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  firesText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
  },
  sourceText: {
    fontSize: typography.fontSize.xs,
    color: colors.gray[400],
    marginTop: 4,
  },
  alertsContainer: {
    marginTop: spacing[3],
    gap: spacing[2],
  },
  alertItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  alertItemText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    flex: 1,
  },
});

export default SafetyWidget;
