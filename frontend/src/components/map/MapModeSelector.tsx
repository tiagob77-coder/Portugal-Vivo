/**
 * MapModeSelector - Map visualization mode switcher.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { palette, withOpacity } from '../../theme';

// Top-bar map modes. Held to 7 so the row fits without horizontal scroll on
// phones ≥ 360 px.
// Removed from earlier 12-mode lineup:
//   - `tecnico` — duplicated the floating TEC button in NativeMap.web.tsx
//     (terrain + coord HUD); the top-bar tab had no `mode === 'tecnico'`
//     branch in mapa.tsx so clicking it did nothing.
//   - `premium` — only tinted background tiles; no overlay UI was wired.
//   - `epochs` / `timeline` — historical-discovery features whose home is
//     /descobrir, not the map mode selector.
//   - `satellite` — only swapped the basemap tiles (Esri imagery) while
//     sharing the markers POI flow; it is orthogonal to the visualization
//     mode, so it now lives as a basemap toggle (the "SAT" floating button
//     in NativeMap.web.tsx) that can overlay any mode.
// `rotas` (narrative + cultural routes, infra) and `trails` (hiking trails
// from /trails) are distinct data sources — the labels stay distinct too
// ("Rotas" vs "Trilhos") to avoid the earlier "Rotas & Trilhos" overlap
// that read as a duplicate of the adjacent Trilhos tab.
const MAP_MODES = [
  { id: 'markers', icon: 'place', label: 'Camadas' },
  { id: 'rotas', icon: 'route', label: 'Rotas' },
  { id: 'explorador', icon: 'explore', label: 'Explorador' },
  { id: 'heatmap', icon: 'whatshot', label: 'Densidade' },
  { id: 'trails', icon: 'hiking', label: 'Trilhos' },
  { id: 'proximity', icon: 'near-me', label: 'Proximidade' },
  { id: 'noturno', icon: 'nightlight-round', label: 'Modo noturno' },
] as const;

export type MapMode = typeof MAP_MODES[number]['id'];

// Modes whose POI items come from the user's MapLayerSelector subcategory
// choices. Other modes (trails / proximity / noturno / rotas) drive their
// items from a mode-specific data fetch and ignore the layer selector, so
// callers should hide it to avoid a "filter looks active but is being
// ignored" UX trap.
//
// Satellite is no longer a mode — it is a basemap toggle handled inside
// NativeMap.web.tsx, so it never appears here. The layer selector's
// visibility is governed purely by the active visualization mode.
export const LAYER_RESPECTING_MODES: ReadonlyArray<MapMode> = [
  'markers',
  'heatmap',
  'explorador',
];

interface MapModeSelectorProps {
  activeMode: string;
  onModeChange: (mode: MapMode) => void;
  // Optional subset of modes to show, in MAP_MODES order. The native map
  // (mobile) passes the modes it supports end-to-end; web omits it to show
  // the full lineup. Unknown ids are ignored.
  modes?: ReadonlyArray<MapMode>;
}

export default function MapModeSelector({ activeMode, onModeChange, modes }: MapModeSelectorProps) {
  const items = modes ? MAP_MODES.filter((m) => modes.includes(m.id)) : MAP_MODES;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      accessibilityRole="tablist"
      accessibilityLabel="Modos de mapa"
    >
      <View style={styles.container}>
        {items.map((mode) => {
          const isActive = activeMode === mode.id;
          return (
            <TouchableOpacity
              key={mode.id}
              style={[styles.btn, isActive && styles.btnActive]}
              onPress={() => onModeChange(mode.id)}
              data-testid={`map-mode-${mode.id}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={`Modo de mapa: ${mode.label}`}
              // 44×44 minimum recommended by WCAG 2.5.5; the visual button
              // stays compact because the hitSlop expands the touch area.
              hitSlop={{ top: 12, bottom: 12, left: 6, right: 6 }}
            >
              <MaterialIcons
                name={mode.icon as any}
                size={15}
                color={isActive ? palette.white : palette.gray[500]}
              />
              <Text
                style={[
                  styles.btnText,
                  isActive && styles.btnTextActive,
                ]}
              >
                {mode.label}
              </Text>
            </TouchableOpacity>
          );
        })}
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
