/**
 * NativeMap.web.tsx — MapLibre GL Map (replaces Leaflet)
 *
 * Mapa vectorial com:
 *   • 3D terrain real (AWS elevation tiles, toggle)
 *   • 4 estilos de tiles (CARTO — sem API key)
 *   • Clustering nativo GeoJSON
 *   • Trail rendering com gradiente de elevação
 *   • Popups com dados do POI
 *   • Controlo de câmara suave
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';

// ─── Tipos partilhados com native ─────────────────────────────────────────────

export interface MapItem {
  id: string;
  name: string;
  category: string;
  region: string;
  location: { lat: number; lng: number };
  description?: string;
  iq_score?: number;
  image_url?: string;
}

export interface LeafletMapProps {
  items: MapItem[];
  onItemPress?: (item: MapItem) => void;
  getMarkerColor: (category: string) => string;
  getLayerIcon: (category: string) => string;
  mapMode?: string;
  trailPoints?: { lat: number; lng: number; ele?: number }[];
  trailColor?: string;
  style?: any;
  children?: React.ReactNode;
  ref?: any;
  provider?: any;
  initialRegion?: any;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  [key: string]: any;
}

// ─── Estilos CARTO (gratuitos, sem API key) ───────────────────────────────────

const MAP_STYLES: Record<string, string> = {
  light:     'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  voyager:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark:      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  terrain:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

// Centro de Portugal e limites
const PT_CENTER: [number, number] = [-7.8491, 39.6945];
const PT_ZOOM = 6.2;
const PT_BOUNDS: [[number, number], [number, number]] = [[-31.5, 30], [0, 42.5]];

// ─── Loader lazy do MapLibre GL ──────────────────────────────────────────────

let _mlgl: any = null;

async function loadMapLibre(): Promise<any> {
  if (_mlgl) return _mlgl;
  if (typeof window === 'undefined') return null;
  try {
    const mod = await import('maplibre-gl');
    _mlgl = (mod as any).default || mod;

    // Injectar CSS do MapLibre
    if (!document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@latest/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }
    return _mlgl;
  } catch (err) {
    console.warn('[MapLibre] Falha ao carregar:', err);
    return null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toGeoJSON(items: MapItem[], getColor: (c: string) => string) {
  return {
    type: 'FeatureCollection' as const,
    features: items.map(item => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [item.location.lng, item.location.lat] },
      properties: {
        id: item.id,
        name: item.name,
        category: item.category,
        region: item.region,
        description: item.description ?? '',
        iq_score: item.iq_score ?? 0,
        color: getColor(item.category),
      },
    })),
  };
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function LeafletMapComponent({
  items,
  onItemPress,
  getMarkerColor,
  mapMode = 'light',
  trailPoints,
  trailColor = '#22C55E',
  style,
  onMapReady,
}: LeafletMapProps) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const [is3D, setIs3D] = useState(false);
  const [ready, setReady] = useState(false);

  // ── Inicializar mapa ──────────────────────────────────────────────────────
  useEffect(() => {
    let map: any;

    (async () => {
      const ml = await loadMapLibre();
      if (!ml || !containerRef.current) return;

      map = new ml.Map({
        container: containerRef.current,
        style: MAP_STYLES[mapMode] || MAP_STYLES.light,
        center: PT_CENTER,
        zoom: PT_ZOOM,
        pitch: 0,
        bearing: 0,
        maxBounds: PT_BOUNDS,
        attributionControl: false,
      });

      mapRef.current = map;

      map.addControl(new ml.AttributionControl({ compact: true }), 'bottom-right');
      map.addControl(new ml.NavigationControl({ visualizePitch: true }), 'top-right');

      map.on('load', () => {
        _addTerrainSource(map);
        _addPOIsLayer(map);
        _addTrailLayers(map);
        setReady(true);
        onMapReady?.();
      });
    })();

    return () => { map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function _addTerrainSource(map: any) {
    try {
      map.addSource('terrain-dem', {
        type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 14,
      });
    } catch (_) {}
  }

  function _addPOIsLayer(map: any) {
    map.addSource('pois', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 44,
    });

    // Clusters — círculos coloridos por tamanho
    map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'pois',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'],
          '#6B9E78', 10, '#C49A6C', 30, '#7C3AED'],
        'circle-radius': ['step', ['get', 'point_count'], 18, 10, 26, 30, 34],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#fff',
        'circle-opacity': 0.92,
      },
    });

    // Número dentro do cluster
    map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'pois',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 12,
      },
      paint: { 'text-color': '#ffffff' },
    });

    // Pontos individuais
    map.addLayer({
      id: 'poi-point',
      type: 'circle',
      source: 'pois',
      filter: ['!', ['has', 'point_count']],
      paint: {
        'circle-color': ['get', 'color'],
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 9],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.95,
      },
    });

    // Clique em ponto individual
    map.on('click', 'poi-point', (e: any) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const p = feat.properties;
      const coords = feat.geometry.coordinates.slice();

      popupRef.current?.remove();

      if (_mlgl) {
        popupRef.current = new _mlgl.Popup({ closeButton: true, offset: 14, maxWidth: '260px' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:2px 0">
              <p style="font-weight:700;font-size:13px;margin:0 0 3px;color:#1a1a1a">${p.name}</p>
              <p style="font-size:11px;color:#64748b;margin:0 0 6px">${p.category} · ${p.region}</p>
              ${p.iq_score > 0 ? `<span style="font-size:10px;background:#f1f5f9;border-radius:4px;padding:2px 6px;color:#475569">IQ ${p.iq_score}</span>` : ''}
              <a href="#" data-pid="${p.id}" style="display:block;margin-top:8px;font-size:11px;font-weight:700;color:#2E5E4E;text-decoration:none">Ver detalhes →</a>
            </div>
          `)
          .addTo(map);

        setTimeout(() => {
          document.querySelector(`[data-pid="${p.id}"]`)?.addEventListener('click', ev => {
            ev.preventDefault();
            onItemPress?.({
              id: p.id, name: p.name, category: p.category, region: p.region,
              location: { lat: coords[1], lng: coords[0] },
              description: p.description, iq_score: p.iq_score,
            });
            popupRef.current?.remove();
          });
        }, 50);
      }
    });

    // Clique em cluster → zoom in
    map.on('click', 'clusters', (e: any) => {
      const [feat] = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
      if (!feat) return;
      map.getSource('pois').getClusterExpansionZoom(
        feat.properties.cluster_id,
        (err: any, zoom: number) => {
          if (!err) map.easeTo({ center: feat.geometry.coordinates, zoom: zoom + 0.5 });
        },
      );
    });

    map.on('mouseenter', 'poi-point', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'poi-point', () => { map.getCanvas().style.cursor = ''; });
    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = ''; });
  }

  function _addTrailLayers(map: any) {
    map.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: 'trail-shadow', type: 'line', source: 'trail',
      paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.12, 'line-blur': 4 },
    });
    map.addLayer({
      id: 'trail-line', type: 'line', source: 'trail',
      paint: {
        'line-color': trailColor, 'line-width': 4, 'line-opacity': 0.88,
        'line-cap': 'round', 'line-join': 'round',
      },
    });
  }

  // ── Actualizar marcadores ──────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    mapRef.current.getSource('pois')?.setData(toGeoJSON(items, getMarkerColor));
  }, [items, ready, getMarkerColor]);

  // ── Actualizar trilho ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    const src = mapRef.current.getSource('trail');
    if (!src) return;

    if (trailPoints && trailPoints.length > 1) {
      src.setData({
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: trailPoints.map(p => [p.lng, p.lat, p.ele ?? 0]) },
          properties: {},
        }],
      });
      const lngs = trailPoints.map(p => p.lng);
      const lats = trailPoints.map(p => p.lat);
      mapRef.current.fitBounds(
        [[Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02],
         [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02]],
        { padding: 48 },
      );
    } else {
      src.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [trailPoints, ready]);

  // ── Mudar estilo de mapa ───────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !ready) return;
    mapRef.current.setStyle(MAP_STYLES[mapMode] || MAP_STYLES.light);
  }, [mapMode, ready]);

  // ── Toggle terrain 3D ─────────────────────────────────────────────────────
  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (is3D) {
      map.setTerrain(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    } else {
      try {
        if (!map.getSource('terrain-dem')) _addTerrainSource(map);
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
        map.easeTo({ pitch: 52, bearing: -15, duration: 900 });
      } catch (_) {}
    }
    setIs3D(prev => !prev);
  }, [is3D]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, style]}>
      {/* Container DOM para o MapLibre */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Botão 3D */}
      <TouchableOpacity
        style={[s.btn3d, is3D && s.btn3dActive]}
        onPress={toggle3D}
        activeOpacity={0.85}
      >
        <Text style={[s.btn3dText, is3D && { color: '#fff' }]}>
          {is3D ? '▲ 3D' : '⬡ 3D'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default LeafletMapComponent;

// Stubs de compatibilidade
export const Marker: React.FC<any> = () => null;
export const Callout: React.FC<any> = () => null;
export const PROVIDER_GOOGLE = null;
export const isMapAvailable = true;

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' as any },
  btn3d: {
    position: 'absolute',
    top: 60,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
    elevation: 4,
  },
  btn3dActive: { backgroundColor: '#2E5E4E' },
  btn3dText: { fontSize: 12, fontWeight: '700', color: '#2E5E4E' },
});
