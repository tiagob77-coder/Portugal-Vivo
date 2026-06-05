import { palette } from '../theme/colors';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Category } from '../types';
import PressableScale from './PressableScale';
import { useTheme, withOpacity } from '../theme';
import { getCategoryImage } from '../theme/categoryImages';
import { getCulturalIcon } from '../theme/culturalIcons';
import { hapticLight } from '../utils/microInteractions';

interface CategoryCardProps {
  category: Category;
  count?: number;
  onPress: () => void;
}

function CategoryCard({ category, onPress }: CategoryCardProps) {
  const { colors } = useTheme();
  const imageUrl = getCategoryImage(category.id);
  const culturalIcon = getCulturalIcon(category.id);
  
  // Use cultural icon if available, otherwise fallback to category icon
  const iconName = category.icon || culturalIcon.icon;
  const iconColor = category.color || culturalIcon.color;
  
  const handlePress = () => {
    hapticLight();
    onPress();
  };

  return (
    <View style={styles.cardWrapper}>
      <PressableScale
        onPress={handlePress}
        style={styles.card}
        accessibilityLabel={`${category.name}${(category as any).count ? `, ${(category as any).count} itens` : ''}`}
        accessibilityRole="button"
        accessibilityHint="Toque para ver itens desta categoria"
      >
      {/* Background Image */}
      <Image
        source={{ uri: imageUrl }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      
      {/* Gradient Overlay - only at bottom */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      />
      
      {/* Emoji badge in top-right corner */}
      {culturalIcon.emoji && (
        <View style={styles.emojiBadge}>
          <Text style={styles.emoji}>{culturalIcon.emoji}</Text>
        </View>
      )}
      
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
        <Text style={styles.count}>{(category as any).count || 0} itens</Text>
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
  emojiBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 14,
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
