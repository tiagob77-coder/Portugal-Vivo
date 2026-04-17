import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import OptimizedImage from './OptimizedImage';
import { MaterialIcons } from '@expo/vector-icons';
import { HeritageItem, Category } from '../types';
import PressableScale from './PressableScale';
import { useTheme, typography, spacing, borders, getCategoryColor, getCategoryBg } from '../theme';
import { useFavorites } from '../context/FavoritesContext';
import { getCategoryImage } from '../theme/categoryImages';

const { width: _width } = Dimensions.get('window');

interface HeritageCardProps {
  item: HeritageItem;
  categories: Category[];
  onPress: () => void;
  variant?: 'default' | 'compact' | 'featured';
}

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

export default function HeritageCard({ item, categories, onPress, variant = 'default' }: HeritageCardProps) {
  const { colors } = useTheme();
  const { isFavorite, toggleFavorite } = useFavorites();
  const category = categories.find(c => c.id === item.category);
  const imageUrl = item.image_url || getCategoryImage(item.category);
  const catColor = getCategoryColor(category?.color ? item.category : item.category);
  const actualColor = category?.color || catColor;
  const faved = isFavorite(item.id);

  // Compact variant
  if (variant === 'compact') {
    return (
      <PressableScale
        onPress={onPress}
        style={[styles.compactCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        accessibilityLabel={`${item.name}, ${REGION_NAMES[item.region] || item.region}`}
        accessibilityRole="button"
        accessibilityHint="Toque para ver detalhes"
      >
        <OptimizedImage uri={imageUrl} style={[styles.compactImage, { backgroundColor: colors.border }]} />
        <View style={styles.compactContent}>
          <View style={[styles.smallBadge, { backgroundColor: getCategoryBg(item.category) }]}>
            <MaterialIcons
              name={(category?.icon || 'place') as any}
              size={12}
              color={actualColor}
            />
          </View>
          <Text style={[styles.compactName, { color: colors.textOnPrimary }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.compactRegion, { color: colors.textMuted }]}>{REGION_NAMES[item.region] || item.region}</Text>
        </View>
      </PressableScale>
    );
  }

  // Default variant with small image thumbnail
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
      accessibilityLabel={`${item.name}. ${category?.name || item.category}. ${REGION_NAMES[item.region] || item.region}`}
      accessibilityRole="button"
      accessibilityHint="Toque para ver detalhes"
    >
      <View style={styles.cardContent}>
        <OptimizedImage uri={imageUrl} style={[styles.thumbnail, { backgroundColor: colors.border }]} />
        <View style={styles.cardText}>
          <View style={styles.header}>
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryBg(item.category) }]}>
              <MaterialIcons
                name={(category?.icon || 'place') as any}
                size={14}
                color={actualColor}
              />
              <Text style={[styles.categoryText, { color: actualColor }]}>
                {category?.name || item.category}
              </Text>
            </View>
            {item.location && (
              <MaterialIcons name="location-on" size={14} color={colors.success} />
            )}
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
              style={{ padding: 4, marginLeft: 4 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcons
                name={faved ? 'favorite' : 'favorite-border'}
                size={18}
                color={faved ? '#EF4444' : colors.textMuted}
              />
            </TouchableOpacity>
          </View>

          <Text style={[styles.name, { color: colors.textOnPrimary }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>{item.description}</Text>

          <View style={styles.footer}>
            <View style={[styles.regionBadge, { backgroundColor: colors.border }]}>
              <Text style={[styles.regionText, { color: colors.textSecondary }]}>{REGION_NAMES[item.region] || item.region}</Text>
            </View>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  // Default card styles
  card: {
    borderRadius: borders.radius.xl,
    marginBottom: spacing[3],
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
  },
  thumbnail: {
    width: 100,
    height: 120,
  },
  cardText: {
    flex: 1,
    padding: spacing[3],
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borders.radius.md,
    gap: 4,
  },
  categoryText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.semibold,
  },
  name: {
    fontSize: typography.fontSize.base + 1,
    fontWeight: typography.fontWeight.bold,
    marginBottom: 4,
    lineHeight: 20,
  },
  description: {
    fontSize: typography.fontSize.sm,
    lineHeight: 16,
    marginBottom: spacing[2],
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: 3,
    borderRadius: borders.radius.md,
    gap: 4,
  },
  regionText: {
    fontSize: typography.fontSize.xs + 1,
    fontWeight: typography.fontWeight.medium,
  },

  // Compact card styles
  compactCard: {
    width: 140,
    borderRadius: borders.radius.lg,
    marginRight: spacing[3],
    overflow: 'hidden',
    borderWidth: 1,
  },
  compactImage: {
    width: '100%',
    height: 90,
  },
  compactContent: {
    padding: spacing[3] - 2,
  },
  smallBadge: {
    width: 24,
    height: 24,
    borderRadius: borders.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  compactName: {
    fontSize: typography.fontSize.sm + 1,
    fontWeight: typography.fontWeight.semibold,
    marginBottom: 4,
    lineHeight: 16,
  },
  compactRegion: {
    fontSize: typography.fontSize.xs + 1,
  },
});
