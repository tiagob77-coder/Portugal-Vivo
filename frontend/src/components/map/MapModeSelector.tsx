/**
 * MapModeSelector - Map visualization mode switcher.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { palette, withOpacity } from '../../theme';

const MAP_MODES = [
  { id: 'markers', icon: 'place', label: 'Camadas' },
  { id: 'explorador', icon: 'explore', label: 'Explorador' },
  { id: 'heatmap', icon: 'whatshot', label: 'Densidade' },
  { id: 'trails', icon: 'hiking', label: 'Trilhos' },
  { id: 'epochs', icon: 'history', label: 'Épocas históricas' },
  { id: 'timeline', icon: 'slow-motion-video', label: 'Linha do tempo' },
  { id: 'proximity', icon: 'near-me', label: 'Proximidade' },
  { id: 'noturno', icon: 'nightlight-round', label: 'Modo noturno' },
  { id: 'satellite', icon: 'satellite', label: 'Satélite' },
  { id: 'tecnico', icon: 'my-location', label: 'Vista técnica' },
  { id: 'premium', icon: 'auto-awesome', label: 'Premium' },
] as const;

export type MapMode = typeof MAP_MODES[number]['id'];

interface MapModeSelectorProps {
  activeMode: string;
  onModeChange: (mode: MapMode) => void;
}

export default function MapModeSelector({ activeMode, onModeChange }: MapModeSelectorProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
      <View style={styles.container}>
        {MAP_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.id}
            style={[styles.btn, activeMode === mode.id && styles.btnActive]}
            onPress={() => onModeChange(mode.id)}
            data-testid={`map-mode-${mode.id}`}
          >
            <MaterialIcons
              name={mode.icon as any}
              size={15}
              color={activeMode === mode.id ? palette.white : palette.gray[500]}
            />
            <Text
              style={[
                styles.btnText,
                activeMode === mode.id && styles.btnTextActive,
              ]}
            >
              {mode.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    marginBottom: 8,
  },
  container: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 4,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: withOpacity(palette.white, 0.05),
    gap: 4,
  },
  btnActive: {
    backgroundColor: palette.forest[600],
  },
  btnText: {
    color: palette.gray[500],
    fontSize: 11,
    fontWeight: '500',
  },
  btnTextActive: {
    color: palette.white,
    fontWeight: '600',
  },
});
