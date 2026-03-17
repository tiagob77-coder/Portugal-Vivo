import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HeritageItem, Category } from '../types';

const { width } = Dimensions.get('window');

interface HeritageCardProps {
  item: HeritageItem;
  categories: Category[];
  onPress: () => void;
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

export default function HeritageCard({ item, categories, onPress }: HeritageCardProps) {
  const category = categories.find(c => c.id === item.category);
  
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: (category?.color || '#6366F1') + '20' }]}>
          <MaterialIcons 
            name={(category?.icon || 'place') as any} 
            size={16} 
            color={category?.color || '#6366F1'} 
          />
          <Text style={[styles.categoryText, { color: category?.color || '#6366F1' }]}>
            {category?.name || item.category}
          </Text>
        </View>
        {item.location && (
          <MaterialIcons name="location-on" size={16} color="#94A3B8" />
        )}
      </View>
      
      <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
      <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      
      <View style={styles.footer}>
        <View style={styles.regionBadge}>
          <Text style={styles.regionText}>{REGION_NAMES[item.region] || item.region}</Text>
        </View>
        {item.address && (
          <Text style={styles.address} numberOfLines={1}>{item.address}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    color: '#94A3B8',
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionBadge: {
    backgroundColor: '#334155',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  regionText: {
    fontSize: 12,
    color: '#CBD5E1',
    fontWeight: '500',
  },
  address: {
    fontSize: 12,
    color: '#64748B',
    flex: 1,
  },
});
