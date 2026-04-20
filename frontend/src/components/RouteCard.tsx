import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Route } from '../types';
import PressableScale from './PressableScale';
import { useTheme, typography, spacing, borders, getCategoryColor, getCategoryBg } from '../theme';

interface RouteCardProps {
  route: Route;
  onPress: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  vinho: 'local-bar',
  pao: 'bakery-dining',
  azeite: 'local-florist',
  cultural: 'museum',
  religioso: 'church',
  arqueologia: 'architecture',
  natureza: 'forest',
};

export default function RouteCard({ route, onPress }: RouteCardProps) {
  const { colors } = useTheme();
  const color = getCategoryColor(route.category);
  const icon = CATEGORY_ICONS[route.category] || 'route';

  return (
    <PressableScale onPress={onPress} style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={[styles.iconContainer, { backgroundColor: getCategoryBg(route.category) }]}>
        <MaterialIcons name={icon as any} size={28} color={color} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.name, { color: colors.textOnPrimary }]} numberOfLines={2}>{route.name}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>{route.description}</Text>

        <View style={styles.meta}>
          <View style={[styles.badge, { backgroundColor: getCategoryBg(route.category) }]}>
            <Text style={[styles.badgeText, { color }]}>
              {route.category.charAt(0).toUpperCase() + route.category.slice(1)}
            </Text>
          </View>
          {route.region && (
            <View style={styles.regionBadge}>
              <MaterialIcons name="place" size={12} color={colors.textMuted} />
              <Text style={[styles.regionText, { color: colors.textMuted }]}>{route.region}</Text>
            </View>
          )}
        </View>
      </View>

      <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    marginBottom: spacing[3],
    borderWidth: 1,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: borders.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing[3],
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[1],
  },
  description: {
    fontSize: typography.fontSize.sm + 1,
    lineHeight: 18,
    marginBottom: spacing[2],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  badge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borders.radius.sm + 2,
  },
  badgeText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.semibold,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  regionText: {
    fontSize: typography.fontSize.xs + 1,
  },
});
