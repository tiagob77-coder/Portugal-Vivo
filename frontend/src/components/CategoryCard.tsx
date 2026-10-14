import { palette } from '../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Category } from '../types';
import PressableScale from './PressableScale';
import { withOpacity, gradients } from '../theme';
import { getCategoryImage } from '../theme/categoryImages';
import { getCulturalIcon } from '../theme/culturalIcons';
import { hapticLight } from '../utils/microInteractions';

interface CategoryCardProps {
  category: Category;
  count?: number;
  onPress: () => void;
}

function CategoryCard({ category, onPress }: CategoryCardProps) {
  const { t } = useTranslation();
  const imageUrl = getCategoryImage(category.id);
  const culturalIcon = getCulturalIcon(category.id);
  
  // Use cultural icon if available, otherwise fallback to category icon
  const iconName = category.icon || culturalIcon.icon;
  const iconColor = category.color || culturalIcon.color;
  
  const itemCount = (category as any).count || 0;
  const itemsLabel = t(itemCount === 1 ? 'components.categoryCard.itemsOne' : 'components.categoryCard.items', { count: itemCount });

  const handlePress = () => {
    hapticLight();
    onPress();
  };

  return (
    <View style={styles.cardWrapper}>
      <PressableScale
        onPress={handlePress}
        style={styles.card}
        accessibilityLabel={`${category.name}${(category as any).count ? `, ${itemsLabel}` : ''}`}
        accessibilityRole="button"
        accessibilityHint={t('components.categoryCard.a11yHint')}
      >
      {/* Background Image */}
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      
      {/* Gradient Overlay — warm pine scrim (shared preset) */}
      <LinearGradient
        colors={[...gradients.cardScrim.colors]}
        locations={[...gradients.cardScrim.locations]}
        style={styles.gradient}
      />

      {/* Content at bottom */}
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: withOpacity(iconColor, 0.3) }]}>
          <MaterialIcons
            name={iconName as any}
            size={18}
            color={iconColor}
          />
        </View>
        <Text style={styles.name} numberOfLines={2}>{category.name}</Text>
        <Text style={styles.count}>{itemsLabel}</Text>
      </View>
    </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  cardWrapper: {
    width: '48%',
    marginBottom: 12,
  },
  card: {
    height: 180,
    borderRadius: 16,
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    color: palette.white,
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  count: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: '500',
  },
});

export default React.memo(CategoryCard);
