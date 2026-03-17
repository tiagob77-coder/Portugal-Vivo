import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Category } from '../types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface CategoryCardProps {
  category: Category;
  count?: number;
  onPress: () => void;
}

export default function CategoryCard({ category, count, onPress }: CategoryCardProps) {
  return (
    <TouchableOpacity 
      style={[styles.card, { borderColor: category.color }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.iconContainer, { backgroundColor: category.color + '20' }]}>
        <MaterialIcons 
          name={category.icon as any} 
          size={28} 
          color={category.color} 
        />
      </View>
      <Text style={styles.name} numberOfLines={2}>{category.name}</Text>
      {count !== undefined && (
        <Text style={styles.count}>{count} itens</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
    marginBottom: 4,
  },
  count: {
    fontSize: 12,
    color: '#94A3B8',
  },
});
