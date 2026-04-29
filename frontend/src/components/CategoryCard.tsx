import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Category } from '../types';
import PressableScale from './PressableScale';
import { useTheme, withOpacity } from '../theme';
import { getCategoryImage } from '../theme/categoryImages';

interface CategoryCardProps {
  category: Category;
  count?: number;
  onPress: () => void;
}

function CategoryCard({ category, onPress }: CategoryCardProps) {
  const { colors } = useTheme();
  const imageUrl = getCategoryImage(category.id);

  return (
    <View style={styles.cardWrapper}>
      <PressableScale
        onPress={onPress}
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
        colors={['transparent', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.6, 1]}
        style={styles.gradient}
      />
      
      {/* Content at bottom */}
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: withOpacity(category.color, 0.25) }]}>
          <MaterialIcons
            name={category.icon as any}
            size={20}
            color={category.color}
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
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  count: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
});

export default React.memo(CategoryCard);
