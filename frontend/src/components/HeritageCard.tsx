import React from 'react';
import { View, Text, StyleSheet, Dimensions, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HeritageItem, Category } from '../types';
import PressableScale from './PressableScale';
import { useTheme, typography, spacing, borders, shadows, getCategoryColor, getCategoryBg } from '../theme';

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

// Default category images from Unsplash
const CATEGORY_IMAGES: Record<string, string> = {
  lendas: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
  festas: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80',
  saberes: 'https://images.unsplash.com/photo-1568288796888-a0fa7b6ebd17?w=400&q=80',
  crencas: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
  gastronomia: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
  produtos: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
  termas: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
  florestas: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80',
  rios: 'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=400&q=80',
  minerais: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
  aldeias: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=400&q=80',
  percursos: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  rotas: 'https://images.unsplash.com/photo-1583228540722-4a7b013ac356?w=400&q=80',
  piscinas: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  cogumelos: 'https://images.unsplash.com/photo-1504545102780-26774c1bb073?w=400&q=80',
  arqueologia: 'https://images.unsplash.com/photo-1539650116574-75c0c6d73f6e?w=400&q=80',
  fauna: 'https://images.unsplash.com/photo-1474511320723-9a56873571b7?w=400&q=80',
  arte: 'https://images.unsplash.com/photo-1570561477977-32d429ab3da4?w=400&q=80',
  religioso: 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=400&q=80',
  comunidade: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
};

export default function HeritageCard({ item, categories, onPress, variant = 'default' }: HeritageCardProps) {
  const { colors } = useTheme();
  const category = categories.find(c => c.id === item.category);
  const imageUrl = item.image_url || CATEGORY_IMAGES[item.category] || CATEGORY_IMAGES.lendas;
  const catColor = getCategoryColor(category?.color ? item.category : item.category);
  const actualColor = category?.color || catColor;

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
        <Image source={{ uri: imageUrl }} style={[styles.compactImage, { backgroundColor: colors.border }]} />
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
        <Image source={{ uri: imageUrl }} style={[styles.thumbnail, { backgroundColor: colors.border }]} />
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
