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
import type { MapItem, LeafletMapProps } from './NativeMap.types';
import { API_BASE } from '../config/api';

console.log('[NativeMap.web.tsx] Module loaded');

// Re-export types for backwards compatibility
export type { MapItem, LeafletMapProps };

// ─── Estilos CARTO (gratuitos, sem API key) ───────────────────────────────────

const MAP_STYLES: Record<string, string> = {
  light:     'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  voyager:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark:      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  terrain:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  tecnico:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  premium:   'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
};

// Centro de Portugal e limites
const PT_CENTER: [number, number] = [-7.8491, 39.6945];
const PT_ZOOM = 6.2;
const PT_BOUNDS: [[number, number], [number, number]] = [[-31.5, 30], [0, 42.5]];

// ─── Loader lazy do MapLibre GL ──────────────────────────────────────────────

let _mlgl: any = null;

function isWebGLSupported(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

async function loadMapLibre(): Promise<any> {
  if (_mlgl) return _mlgl;
  if (typeof window === 'undefined') return null;
  if (!isWebGLSupported()) {
    console.warn('[MapLibre] WebGL not supported in this browser');
    return null;
  }
  try {
    const mod = await import('maplibre-gl');
    _mlgl = (mod as any).default || mod;

    // Injectar CSS do MapLibre (versão fixa para cache do browser)
    if (!document.getElementById('maplibre-gl-css')) {
      const link = document.createElement('link');
      link.id = 'maplibre-gl-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
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
  const safeItems = items || [];
  const validItems = safeItems.filter(item => {
    const hasCoords = item?.location?.lat != null && item?.location?.lng != null;
    if (!hasCoords && safeItems.length < 20) {
      console.log('[toGeoJSON] Invalid item:', item?.id, item?.location);
    }
    return hasCoords;
  });
  console.log('[toGeoJSON] Valid items:', validItems.length, 'of', safeItems.length);
  return {
    type: 'FeatureCollection' as const,
    features: validItems.map(item => ({
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

export function LeafletMapComponent(props: LeafletMapProps) {
  // Debug: Log ALL props as object
  console.log('[NativeMap] ALL PROPS:', JSON.stringify(Object.keys(props)));
  console.log('[NativeMap] props.items:', props.items?.length);
  console.log('[NativeMap] props.mapMode:', props.mapMode);
  
  const {
    items,
    onItemPress,
    getMarkerColor,
    mapMode = 'light',
    trailPoints,
    trailColor = '#22C55E',
    style,
    onMapReady,
  } = props;
  
  console.log('[NativeMap] DESTRUCTURED - items:', items?.length, 'mapMode:', mapMode);
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const popupRef = useRef<any>(null);
  const [is3D, setIs3D] = useState(false);
  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{lng: number; lat: number} | null>(null);
  const [isTecnico, setIsTecnico] = useState(false);
  
  // Store items in ref to access in effects
  const itemsRef = useRef(items);
  const getMarkerColorRef = useRef(getMarkerColor);
  itemsRef.current = items;
  getMarkerColorRef.current = getMarkerColor;

  // ── Inicializar mapa ──────────────────────────────────────────────────────
  useEffect(() => {
    let map: any;

    (async () => {
      const ml = await loadMapLibre();
      if (!ml) {
        setMapError('Mapa indisponível — o browser não suporta WebGL.');
        return;
      }
      if (!containerRef.current) return;

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

      // Inject popup styles
      if (!document.getElementById('pv-popup-style')) {
        const style = document.createElement('style');
        style.id = 'pv-popup-style';
        style.textContent = `
          .pv-popup .maplibregl-popup-content { padding: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.15); }
          .pv-popup .maplibregl-popup-close-button { color: white; font-size: 18px; padding: 4px 8px; z-index: 1; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }
        `;
        document.head.appendChild(style);
      }

      map.on('load', () => {
        console.log('[NativeMap] Map loaded, adding layers...');
        _addTerrainSource(map);
        _addPOIsLayer(map);
        _addTrailLayers(map);
        _applySolarLight(map);
        console.log('[NativeMap] Layers added, setting ready=true');
        setReady(true);
        onMapReady?.();
        map.on('mousemove', (e: any) => {
          setCoords({ lng: parseFloat(e.lngLat.lng.toFixed(5)), lat: parseFloat(e.lngLat.lat.toFixed(5)) });
        });
      });
    })();

    return () => { map?.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function _applySolarLight(map: any) {
    try {
      const now = new Date();
      const hour = now.getHours() + now.getMinutes() / 60;
      const isDay = hour >= 6 && hour < 20;
      if (!isDay) return;
      // Azimuth: 90° (east, 6h) → 180° (south, 12h) → 270° (west, 18h)
      const azimuth = 90 + ((hour - 6) / 12) * 180;
      // Altitude: peaks at noon (60°), low at dawn/dusk (10°)
      const altitude = 10 + Math.sin(((hour - 6) / 14) * Math.PI) * 50;
      map.setLight({
        anchor: 'viewport',
        color: hour < 8 || hour > 17 ? '#FFD580' : '#FFFFFF',
        intensity: hour < 8 || hour > 17 ? 0.25 : 0.35,
        position: [1.5, azimuth, altitude],
      });
    } catch (_) {}
  }

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
    try {
      map.addLayer({
        id: 'hillshade',
        type: 'hillshade',
        source: 'terrain-dem',
        paint: {
          'hillshade-exaggeration': 0.5,
          'hillshade-shadow-color': '#000',
          'hillshade-illumination-direction': 335,
        },
        layout: { visibility: 'none' },
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
        popupRef.current = new _mlgl.Popup({ closeButton: true, offset: 16, maxWidth: '260px', className: 'pv-popup' })
          .setLngLat(coords)
          .setHTML(`
            <div style="font-family:system-ui,-apple-system,sans-serif;min-width:200px;max-width:240px">
              <div style="position:relative;overflow:hidden;border-radius:8px 8px 0 0;height:80px;background:#E5E7EB">
                ${p.image_url ? `<img src="${p.image_url}" style="width:100%;height:100%;object-fit:cover;display:block" loading="lazy" onerror="this.style.display='none'"/>` : ''}
                <div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.5))"></div>
                <span style="position:absolute;bottom:6px;left:8px;font-size:10px;font-weight:700;color:#fff;background:rgba(0,0,0,0.35);padding:2px 6px;border-radius:4px;text-transform:capitalize">${p.category.replace(/_/g,' ')}</span>
              </div>
              <div style="padding:10px 12px 12px">
                <p style="font-weight:700;font-size:13px;margin:0 0 2px;color:#111827;line-height:1.3">${p.name}</p>
                <p style="font-size:11px;color:#6B7280;margin:0 0 8px">${p.region}</p>
                <div style="display:flex;align-items:center;justify-content:space-between">
                  ${p.iq_score > 0 ? `<span style="font-size:10px;background:#F0FDF4;border-radius:6px;padding:2px 7px;color:#15803D;font-weight:700">IQ ${p.iq_score}</span>` : '<span></span>'}
                  <a href="#" data-pid="${p.id}" style="font-size:11px;font-weight:700;color:#2E5E4E;text-decoration:none;background:#F0FDF4;padding:4px 10px;border-radius:6px;display:inline-block">Ver →</a>
                </div>
              </div>
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
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': trailColor, 'line-width': 4, 'line-opacity': 0.88,
      },
    });
  }

  // Update markers when items change or map becomes ready
  useEffect(() => {
    console.log('[NativeMap] Items effect triggered - ready:', ready, 'items:', items?.length);
    if (!ready || !mapRef.current) {
      console.log('[NativeMap] Skipping - not ready or no mapRef');
      return;
    }
    
    const source = mapRef.current.getSource('pois');
    if (!source) {
      console.warn('[NativeMap] POIs source not found');
      return;
    }
    
    const safeItems = Array.isArray(items) ? items : [];
    const currentColor = getMarkerColorRef.current || ((cat: string) => '#C49A6C');
    const geoJSON = toGeoJSON(safeItems, currentColor);
    console.log('[NativeMap] Updating map with', geoJSON.features.length, 'features');
    console.log('[NativeMap] Source type:', typeof source.setData);
    source.setData(geoJSON);
    
    // Force map to re-render
    mapRef.current?.triggerRepaint?.();
    console.log('[NativeMap] Data set successfully, first feature coords:', geoJSON.features[0]?.geometry?.coordinates);
  }, [items, ready]);

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
    const map = mapRef.current;
    if (mapMode === 'premium') {
      map.setStyle(MAP_STYLES.premium);
      setTimeout(() => {
        try {
          map.setPaintProperty('background', 'background-color', '#F5F0E8');
        } catch (_) {}
      }, 500);
      return;
    }
    map.setStyle(MAP_STYLES[mapMode] || MAP_STYLES.light);
  }, [mapMode, ready]);

  // ── Toggle terrain 3D ─────────────────────────────────────────────────────
  const toggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    if (is3D) {
      try { map.setFog(null); } catch (_) {}
      map.setTerrain(null);
      map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    } else {
      try {
        if (!map.getSource('terrain-dem')) _addTerrainSource(map);
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
        try {
          map.setFog({
            color: 'rgb(220, 230, 240)',
            'high-color': 'rgb(180, 210, 240)',
            'horizon-blend': 0.08,
            'space-color': 'rgb(15, 30, 60)',
            'star-intensity': 0.3,
          });
        } catch (_fogErr) {}
        map.easeTo({ pitch: 52, bearing: -15, duration: 900 });
      } catch (_) {}
    }
    setIs3D(prev => !prev);
  }, [is3D]);

  // ── Toggle Técnico ────────────────────────────────────────────────────────
  const toggleTecnico = useCallback(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const next = !isTecnico;
    setIsTecnico(next);
    try {
      map.setLayoutProperty('hillshade', 'visibility', next ? 'visible' : 'none');
    } catch (_) {}
    if (next && !is3D) {
      if (!map.getSource('terrain-dem')) _addTerrainSource(map);
      try {
        map.setTerrain({ source: 'terrain-dem', exaggeration: 1.2 });
      } catch (_) {}
    } else if (!next && !is3D) {
      try { map.setTerrain(null); } catch (_) {}
    }
  }, [isTecnico, is3D, ready]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[s.container, style]}>
      {/* Container DOM para o MapLibre */}
      <div
        ref={containerRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      />

      {/* Fallback quando WebGL não está disponível */}
      {mapError && (
        <View style={s.errorOverlay}>
          <Text style={s.errorText}>{mapError}</Text>
        </View>
      )}

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

      {/* Botão Técnico */}
      <TouchableOpacity
        style={[s.btn3d, { top: 95 }, isTecnico && s.btn3dActive]}
        onPress={toggleTecnico}
        activeOpacity={0.85}
      >
        <Text style={[s.btn3dText, isTecnico && { color: '#fff' }]}>
          {isTecnico ? '◎ TEC' : '◎ TEC'}
        </Text>
      </TouchableOpacity>

      {/* Coordinate HUD (Technical mode) */}
      {isTecnico && coords && (
        <View style={s.coordHUD}>
          <Text style={s.coordText}>{coords.lat}° N  {Math.abs(coords.lng)}° W</Text>
        </View>
      )}
    </View>
  );
}

export default LeafletMapComponent;

// Stubs de compatibilidade
export const Marker: React.FC<any> = () => null;
export const Callout: React.FC<any> = () => null;
export const PROVIDER_GOOGLE = null;
// On web, MapView is not actually available (we use LeafletMapComponent instead)
// So we set isMapAvailable to false to use the web fallback rendering path
export const isMapAvailable = false;

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
  coordHUD: {
    position: 'absolute', bottom: 32, left: 10, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  coordText: { color: '#00FF88', fontSize: 11, fontFamily: 'monospace', fontWeight: '600' },
  errorOverlay: {
    position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F2EDE4', zIndex: 20,
  } as any,
  errorText: { fontSize: 15, color: '#6B665C', textAlign: 'center', paddingHorizontal: 32 },
});
