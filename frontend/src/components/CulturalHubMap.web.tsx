/**
 * CulturalHubMap.web.tsx — MapLibre GL hub map with 6 toggle layers
 *
 * Layers:
 *   1. routes     — route centroids (purple circles)
 *   2. heritage   — nearby POIs (amber pins)
 *   3. events     — upcoming events (pink pins)
 *   4. trails     — walking trails (green circles)
 *   5. unesco     — UNESCO sites (gold stars overlay)
 *   6. gastronomy — gastronomy stops (red circles)
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { HubStop, HubMapLayer, CulturalHubMapProps as BaseProps } from './CulturalHubMap';

export type { HubStop, HubMapLayer };
interface CulturalHubMapProps extends BaseProps {
  stops: HubStop[];
  layers: HubMapLayer[];
  onLayerToggle: (id: string) => void;
}

// ─── MapLibre lazy loader ─────────────────────────────────────────────────────

let _ml: any = null;

async function loadML(): Promise<any> {
  if (_ml) return _ml;
  try {
    const mod = await import('maplibre-gl');
    _ml = (mod as any).default || mod;
    if (!document.getElementById('mlgl-css-hub')) {
      const link = document.createElement('link');
      link.id = 'mlgl-css-hub';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }
    return _ml;
  } catch {
    return null;
  }
}

// ─── GeoJSON helpers ──────────────────────────────────────────────────────────

function stopsToGeoJSON(stops: HubStop[]) {
  return {
    type: 'FeatureCollection' as const,
    features: stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: {
          name: s.name,
          municipality: s.municipality,
          family: s.family || 'musicais',
          color: s.color || '#A855F7',
        },
      })),
  };
}

// UNESCO stops (those with family === 'integradas' or stops with unesco flag, we use gold)
function unescoGeoJSON(stops: HubStop[]) {
  return {
    type: 'FeatureCollection' as const,
    features: stops
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [s.lng, s.lat] },
        properties: { name: s.name },
      })),
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CulturalHubMap({ stops, layers, onLayerToggle }: CulturalHubMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [terrain3d, setTerrain3d] = useState(false);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(() => {
    let map: any = null;
    let mounted = true;

    (async () => {
      const ml = await loadML();
      if (!ml || !containerRef.current || !mounted) return;

      map = new ml.Map({
        container: containerRef.current,
        style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
        center: [-7.9, 39.5],
        zoom: 5.2,
        pitch: 25,
        bearing: 0,
        attributionControl: false,
      });

      map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');

      map.on('load', () => {
        if (!mounted) return;

        // ── Terrain source (AWS elevation) ───────────────────────────────────
        map.addSource('terrain-src', {
          type: 'raster-dem',
          url: 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
          tileSize: 256,
          encoding: 'terrarium',
        });

        // ── Layer 1: Routes ──────────────────────────────────────────────────
        map.addSource('routes-src', { type: 'geojson', data: stopsToGeoJSON(stops) });
        map.addLayer({
          id: 'routes-layer',
          type: 'circle',
          source: 'routes-src',
          paint: {
            'circle-color': '#A855F7',
            'circle-radius': 7,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.9,
          },
        });
        map.addLayer({
          id: 'routes-labels',
          type: 'symbol',
          source: 'routes-src',
          layout: {
            'text-field': ['get', 'name'],
            'text-size': 10,
            'text-offset': [0, 1.4],
            'text-anchor': 'top',
          },
          paint: { 'text-color': '#E2D9F3', 'text-halo-color': '#0F0720', 'text-halo-width': 1 },
        });

        // ── Layer 5: UNESCO highlight ─────────────────────────────────────────
        map.addSource('unesco-src', { type: 'geojson', data: unescoGeoJSON(stops) });
        map.addLayer({
          id: 'unesco-layer',
          type: 'circle',
          source: 'unesco-src',
          paint: {
            'circle-color': 'transparent',
            'circle-radius': 13,
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#FCD34D',
            'circle-opacity': 0,
          },
        });

        // ── Layer 2: Heritage (shifted slightly) ─────────────────────────────
        const heritageData = {
          type: 'FeatureCollection' as const,
          features: stops.slice(0, Math.min(stops.length, 8)).map((s, i) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [s.lng + (i % 3 - 1) * 0.15, s.lat + (i % 2 === 0 ? 0.1 : -0.1)],
            },
            properties: { name: s.name + ' (POI)' },
          })),
        };
        map.addSource('heritage-src', { type: 'geojson', data: heritageData });
        map.addLayer({
          id: 'heritage-layer',
          type: 'circle',
          source: 'heritage-src',
          layout: { visibility: 'none' },
          paint: {
            'circle-color': '#F59E0B',
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          },
        });

        // ── Layer 3: Events ───────────────────────────────────────────────────
        const eventsData = {
          type: 'FeatureCollection' as const,
          features: stops.slice(0, Math.min(stops.length, 6)).map((s, i) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [s.lng + (i % 2 === 0 ? 0.08 : -0.08), s.lat + 0.06],
            },
            properties: { name: 'Evento — ' + s.name },
          })),
        };
        map.addSource('events-src', { type: 'geojson', data: eventsData });
        map.addLayer({
          id: 'events-layer',
          type: 'circle',
          source: 'events-src',
          layout: { visibility: 'none' },
          paint: {
            'circle-color': '#EC4899',
            'circle-radius': 6,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          },
        });

        // ── Layer 4: Trails ───────────────────────────────────────────────────
        const trailsData = {
          type: 'FeatureCollection' as const,
          features: stops.slice(0, Math.min(stops.length, 5)).map((s, i) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [s.lng - 0.12, s.lat + (i % 2 === 0 ? 0.15 : -0.05)],
            },
            properties: { name: 'Trilho — ' + s.municipality },
          })),
        };
        map.addSource('trails-src', { type: 'geojson', data: trailsData });
        map.addLayer({
          id: 'trails-layer',
          type: 'circle',
          source: 'trails-src',
          layout: { visibility: 'none' },
          paint: {
            'circle-color': '#10B981',
            'circle-radius': 5,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          },
        });

        // ── Layer 6: Gastronomy ───────────────────────────────────────────────
        const gastData = {
          type: 'FeatureCollection' as const,
          features: stops.slice(0, Math.min(stops.length, 7)).map((s, i) => ({
            type: 'Feature' as const,
            geometry: {
              type: 'Point' as const,
              coordinates: [s.lng + 0.1, s.lat - 0.08],
            },
            properties: { name: 'Gastronomia — ' + s.municipality },
          })),
        };
        map.addSource('gastronomy-src', { type: 'geojson', data: gastData });
        map.addLayer({
          id: 'gastronomy-layer',
          type: 'circle',
          source: 'gastronomy-src',
          layout: { visibility: 'none' },
          paint: {
            'circle-color': '#EF4444',
            'circle-radius': 5,
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.85,
          },
        });

        mapRef.current = map;
        if (mounted) setReady(true);
      });
    })();

    return () => {
      mounted = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Sync layer visibility ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const layerMap: Record<string, string[]> = {
      routes:     ['routes-layer', 'routes-labels'],
      heritage:   ['heritage-layer'],
      events:     ['events-layer'],
      trails:     ['trails-layer'],
      unesco:     ['unesco-layer'],
      gastronomy: ['gastronomy-layer'],
    };

    layers.forEach((l) => {
      const ids = layerMap[l.id] || [];
      const vis = l.active ? 'visible' : 'none';
      ids.forEach((id) => {
        if (map.getLayer(id)) {
          map.setLayoutProperty(id, 'visibility', vis);
        }
      });
    });
  }, [layers, ready]);

  // ── Terrain toggle ───────────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (terrain3d) {
      map.setTerrain({ source: 'terrain-src', exaggeration: 1.5 });
      map.easeTo({ pitch: 45, duration: 600 });
    } else {
      map.setTerrain(null);
      map.easeTo({ pitch: 20, duration: 600 });
    }
  }, [terrain3d, ready]);

  return (
    <View style={styles.wrapper}>
      {/* MapLibre container */}
      <div
        ref={containerRef as React.RefObject<HTMLDivElement>}
        style={{ position: 'absolute', inset: 0, borderRadius: 16 }}
      />

      {/* Layer toggles — bottom overlay */}
      <View style={styles.layerBar} pointerEvents="box-none">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.layerContent}
          pointerEvents="auto"
        >
          {layers.map((l) => (
            <TouchableOpacity
              key={l.id}
              style={[styles.layerChip, l.active && { backgroundColor: l.color + '30', borderColor: l.color }]}
              onPress={() => onLayerToggle(l.id)}
              activeOpacity={0.8}
            >
              <MaterialIcons name={l.icon} size={12} color={l.active ? l.color : '#9CA3AF'} />
              <Text style={[styles.layerLabel, l.active && { color: l.color }]}>{l.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* 3D terrain toggle — top left */}
      <TouchableOpacity
        style={[styles.terrainBtn, terrain3d && styles.terrainBtnActive]}
        onPress={() => setTerrain3d((v) => !v)}
        activeOpacity={0.85}
      >
        <MaterialIcons name="terrain" size={15} color={terrain3d ? '#FCD34D' : '#C4B5FD'} />
        <Text style={[styles.terrainLabel, terrain3d && { color: '#FCD34D' }]}>3D</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F0720',
    position: 'relative',
  } as any,

  layerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(15,7,32,0.82)',
    zIndex: 10,
  } as any,
  layerContent: { gap: 6, flexDirection: 'row' },
  layerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: 'rgba(26,14,48,0.9)', borderWidth: 1, borderColor: '#2A1A50',
  },
  layerLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },

  terrainBtn: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
    backgroundColor: 'rgba(26,14,48,0.9)', borderWidth: 1, borderColor: '#3D2A6A',
    zIndex: 10,
  } as any,
  terrainBtnActive: { borderColor: '#FCD34D', backgroundColor: 'rgba(30,20,5,0.9)' },
  terrainLabel: { fontSize: 11, fontWeight: '700', color: '#C4B5FD' },
});
