// import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { getAccessibilityFilters } from '../services/api';
import { colors, typography, spacing, borders, shadows } from '../theme';
import { palette } from '../theme/colors';

interface AccessibilityFiltersProps {
  selectedFilters: string[];
  onFiltersChange: (filters: string[]) => void;
  compact?: boolean;
}

const FILTER_ICONS: Record<string, string> = {
  wheelchair: 'accessible',
  reduced_mobility: 'elderly',
  visual: 'visibility',
  hearing: 'hearing',
  pet_friendly: 'pets',
  child_friendly: 'child-care',
  senior_friendly: 'elderly-woman',
  parking: 'local-parking',
  public_transport: 'directions-bus',
  wc_accessible: 'wc',
};

export const AccessibilityFilters: React.FC<AccessibilityFiltersProps> = ({
  selectedFilters,
  onFiltersChange,
  compact = false,
}) => {
  const { data: filtersData, isLoading } = useQuery({
    queryKey: ['accessibility-filters'],
    queryFn: getAccessibilityFilters,
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const toggleFilter = (filterId: string) => {
    if (selectedFilters.includes(filterId)) {
      onFiltersChange(selectedFilters.filter(f => f !== filterId));
    } else {
      onFiltersChange([...selectedFilters, filterId]);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.terracotta[500]} />
      </View>
    );
  }

  const filters = filtersData?.filters || [];

  if (compact) {
    return (
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactContainer}
      >
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter.id);
          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.compactChip, isSelected && styles.compactChipActive]}
              onPress={() => toggleFilter(filter.id)}
              activeOpacity={0.7}
              data-testid={`filter-${filter.id}`}
            >
              <MaterialIcons
                name={FILTER_ICONS[filter.id] as any || 'check-circle'}
                size={16}
                color={isSelected ? palette.white : colors.gray[600]}
              />
              <Text style={[styles.compactText, isSelected && styles.compactTextActive]}>
                {filter.name.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialIcons name="accessibility-new" size={20} color={colors.ocean[500]} />
        <Text style={styles.title}>Acessibilidade</Text>
        {selectedFilters.length > 0 && (
          <TouchableOpacity 
            onPress={() => onFiltersChange([])}
            style={styles.clearButton}
          >
            <Text style={styles.clearText}>Limpar</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.filtersGrid}>
        {filters.map((filter) => {
          const isSelected = selectedFilters.includes(filter.id);
          return (
            <TouchableOpacity
              key={filter.id}
              style={[styles.filterChip, isSelected && styles.filterChipActive]}
              onPress={() => toggleFilter(filter.id)}
              activeOpacity={0.7}
              data-testid={`filter-${filter.id}`}
            >
              <MaterialIcons
                name={FILTER_ICONS[filter.id] as any || 'check-circle'}
                size={20}
                color={isSelected ? palette.white : colors.gray[600]}
              />
              <Text 
                style={[styles.filterText, isSelected && styles.filterTextActive]}
                numberOfLines={2}
              >
                {filter.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {selectedFilters.length > 0 && (
        <View style={styles.selectedInfo}>
          <MaterialIcons name="info" size={14} color={colors.ocean[500]} />
          <Text style={styles.selectedText}>
            {selectedFilters.length} {selectedFilters.length === 1 ? 'filtro selecionado' : 'filtros selecionados'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background.secondary,
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    ...shadows.sm,
  },
  loadingContainer: {
    padding: spacing[4],
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing[3],
    gap: spacing[2],
  },
  title: {
    fontSize: typography.fontSize.base,
    fontWeight: '600',
    color: colors.gray[800],
    flex: 1,
  },
  clearButton: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  clearText: {
    fontSize: typography.fontSize.sm,
    color: colors.terracotta[500],
    fontWeight: '500',
  },
  filtersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borders.radius.lg,
    gap: spacing[2],
    minWidth: '45%',
    flexGrow: 1,
  },
  filterChipActive: {
    backgroundColor: colors.ocean[500],
  },
  filterText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[700],
    flex: 1,
  },
  filterTextActive: {
    color: palette.white,
    fontWeight: '500',
  },
  selectedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    gap: 6,
  },
  selectedText: {
    fontSize: typography.fontSize.sm,
    color: colors.ocean[500],
  },
  // Compact styles
  compactContainer: {
    paddingHorizontal: spacing[1],
    gap: spacing[2],
  },
  compactChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: borders.radius.full,
    gap: 6,
    marginRight: spacing[2],
  },
  compactChipActive: {
    backgroundColor: colors.ocean[500],
  },
  compactText: {
    fontSize: typography.fontSize.sm,
    color: colors.gray[600],
    fontWeight: '500',
  },
  compactTextActive: {
    color: palette.white,
  },
});

export default AccessibilityFilters;
