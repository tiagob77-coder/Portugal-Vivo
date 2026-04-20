import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Category } from '../types';
import PressableScale from './PressableScale';
import { useTheme, typography, spacing, borders, withOpacity } from '../theme';
import { getCategoryImage } from '../theme/categoryImages';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface CategoryCardProps {
  category: Category;
  count?: number;
  onPress: () => void;
}

export default function CategoryCard({ category, onPress }: CategoryCardProps) {
  const { colors } = useTheme();
  const imageUrl = getCategoryImage(category.id);

  return (
    <PressableScale
      onPress={onPress}
      style={styles.card}
      accessibilityLabel={`${category.name}${(category as any).count ? `, ${(category as any).count} itens` : ''}`}
      accessibilityRole="button"
      accessibilityHint="Toque para ver itens desta categoria"
    >
      <ImageBackground
        source={{ uri: imageUrl }}
        style={styles.imageBackground}
        imageStyle={styles.image}
      >
        <View style={[styles.overlay, { backgroundColor: withOpacity(colors.textPrimary, 0.82) }]}>
          <View style={[styles.iconContainer, { backgroundColor: withOpacity(category.color, 0.3) }]}>
            <MaterialIcons
              name={category.icon as any}
              size={24}
              color={category.color}
            />
          </View>
          <Text style={[styles.name, { color: colors.textOnPrimary }]} numberOfLines={2}>{category.name}</Text>
          <View style={styles.countContainer}>
            <Text style={[styles.count, { color: colors.textMuted }]}>{(category as any).count} itens</Text>
            <MaterialIcons name="arrow-forward" size={14} color={colors.accent} />
          </View>
        </View>
      </ImageBackground>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: 160,
    borderRadius: borders.radius.xl,
    overflow: 'hidden',
    marginBottom: spacing[3],
  },
  imageBackground: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  image: {
    borderRadius: borders.radius.xl,
  },
  overlay: {
    padding: spacing[3],
    borderBottomLeftRadius: borders.radius.xl,
    borderBottomRightRadius: borders.radius.xl,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: borders.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[2],
  },
  name: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[1],
  },
  countContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  count: {
    fontSize: typography.fontSize.sm,
  },
});
