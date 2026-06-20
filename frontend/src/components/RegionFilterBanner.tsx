/**
 * Small banner shown on thematic modules when arriving via an event deep-link
 * with a `?region=` filter. Makes the active region explicit and clearable.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { TOURISM_REGIONS } from '../utils/regionMatch';

interface Props {
  regionId: string;
  onClear: () => void;
  accent?: string;
}

export default function RegionFilterBanner({ regionId, onClear, accent = '#2E5E4E' }: Props) {
  const label = TOURISM_REGIONS[regionId] || regionId;
  return (
    <View style={[styles.bar, { backgroundColor: accent + '14', borderColor: accent + '33' }]}>
      <MaterialIcons name="place" size={16} color={accent} />
      <Text style={[styles.text, { color: accent }]} numberOfLines={1}>
        A mostrar: {label}
      </Text>
      <TouchableOpacity
        onPress={onClear}
        style={[styles.button, { backgroundColor: accent }]}
        accessibilityRole="button"
        accessibilityLabel="Ver todas as regiões"
      >
        <Text style={styles.buttonText}>Ver todos</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
