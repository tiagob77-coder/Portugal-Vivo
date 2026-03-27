/**
 * NativeMap.native.tsx — MapLibre GL via WebView (iOS + Android)
 *
 * Usa React Native WebView com MapLibre GL JS (CDN) injectado via HTML string.
 * Mesmo protocolo de mensagens da versão anterior.
 *
 * Comunicação:
 *   WebView → RN:  postMessage({ type: 'select' | 'ready', item?, id? })
 *   RN → WebView:  injectedJavaScriptBeforeContentLoaded com MARKERS_DATA global
 */
import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapItem, LeafletMapProps } from './NativeMap.web';

export type { MapItem, LeafletMapProps };

// ─── Estilos de mapa ──────────────────────────────────────────────────────────

const MAP_STYLES: Record<string, string> = {
  light:     'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  voyager:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
  dark:      'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  satellite: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  terrain:   'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

// ─── HTML do mapa (MapLibre GL JS via CDN) ────────────────────────────────────

function buildMapHTML(styleUrl: string, trailColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; overflow:hidden; }
  .maplibregl-ctrl-attrib { font-size:9px !important; }
  .poi-popup { font-family: system-ui, sans-serif; padding: 4px 0; }
  .poi-popup h4 { font-size: 13px; font-weight: 700; margin: 0 0 3px; color: #1a1a1a; }
  .poi-popup p  { font-size: 11px; color: #64748b; margin: 0 0 6px; }
  .poi-popup .iq { font-size:10px; background:#f1f5f9; border-radius:4px; padding:2px 6px; color:#475569; }
  .poi-popup a  { display:block; margin-top:8px; font-size:11px; font-weight:700; color:#2E5E4E; text-decoration:none; }
  #btn3d { position:absolute; top:60px; left:10px; z-index:10; background:rgba(255,255,255,0.92);
           border:none; border-radius:6px; padding:6px 10px; font-size:12px; font-weight:700;
           color:#2E5E4E; cursor:pointer; box-shadow:0 1px 4px rgba(0,0,0,0.2); }
  #btn3d.active { background:#2E5E4E; color:#fff; }
</style>
</head>
<body>
<div id="map"></div>
<button id="btn3d">⬡ 3D</button>

<script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<script>
var STYLE_URL = ${JSON.stringify(styleUrl)};
var TRAIL_COLOR = ${JSON.stringify(trailColor)};
var PT_CENTER = [-7.8491, 39.6945];
var is3D = false;
var currentPopup = null;

var map = new maplibregl.Map({
  container: 'map',
  style: STYLE_URL,
  center: PT_CENTER,
  zoom: 6.2,
  pitch: 0,
  bearing: 0,
  attributionControl: false,
});

map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

map.on('load', function() {
  map.addSource('terrain-dem', {
    type: 'raster-dem',
    tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
    encoding: 'terrarium', tileSize: 256, maxzoom: 14,
  });

  map.addSource('pois', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true, clusterMaxZoom: 13, clusterRadius: 44,
  });

  map.addLayer({
    id: 'clusters', type: 'circle', source: 'pois',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': ['step', ['get', 'point_count'], '#6B9E78', 10, '#C49A6C', 30, '#7C3AED'],
      'circle-radius': ['step', ['get', 'point_count'], 18, 10, 26, 30, 34],
      'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 0.92,
    },
  });

  map.addLayer({
    id: 'cluster-count', type: 'symbol', source: 'pois',
    filter: ['has', 'point_count'],
    layout: { 'text-field': '{point_count_abbreviated}',
              'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'], 'text-size': 12 },
    paint: { 'text-color': '#ffffff' },
  });

  map.addLayer({
    id: 'poi-point', type: 'circle', source: 'pois',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 9],
      'circle-stroke-width': 2, 'circle-stroke-color': '#fff', 'circle-opacity': 0.95,
    },
  });

  map.addSource('trail', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  map.addLayer({ id: 'trail-shadow', type: 'line', source: 'trail',
    paint: { 'line-color': '#000', 'line-width': 6, 'line-opacity': 0.12, 'line-blur': 4 } });
  map.addLayer({ id: 'trail-line', type: 'line', source: 'trail',
    paint: { 'line-color': TRAIL_COLOR, 'line-width': 4, 'line-opacity': 0.88,
             'line-cap': 'round', 'line-join': 'round' } });

  if (window.MARKERS_DATA) window.updateMarkers(window.MARKERS_DATA);
  if (window.TRAIL_DATA && window.TRAIL_DATA.length > 1) window.updateTrail(window.TRAIL_DATA);

  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  }
});

map.on('click', 'poi-point', function(e) {
  var feat = e.features && e.features[0];
  if (!feat) return;
  var p = feat.properties;
  var coords = feat.geometry.coordinates.slice();
  if (currentPopup) currentPopup.remove();
  currentPopup = new maplibregl.Popup({ closeButton: true, offset: 14, maxWidth: '240px' })
    .setLngLat(coords)
    .setHTML('<div class="poi-popup"><h4>' + p.name + '</h4><p>' + p.category + ' · ' + p.region + '</p>' +
             (p.iq_score > 0 ? '<span class="iq">IQ ' + p.iq_score + '</span>' : '') +
             '<a href="#" onclick="selectPOI(\'' + encodeURIComponent(JSON.stringify(p)) + '\');return false">Ver detalhes →</a></div>')
    .addTo(map);
});

map.on('click', 'clusters', function(e) {
  var feats = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
  if (!feats[0]) return;
  map.getSource('pois').getClusterExpansionZoom(feats[0].properties.cluster_id, function(err, zoom) {
    if (!err) map.easeTo({ center: feats[0].geometry.coordinates, zoom: zoom + 0.5 });
  });
});

window.selectPOI = function(encoded) {
  try {
    var p = JSON.parse(decodeURIComponent(encoded));
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', item: p }));
    }
  } catch(e) {}
};

window.updateMarkers = function(data) {
  if (!map.getSource || !map.getSource('pois')) return;
  var features = (data || []).map(function(m) {
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [m.lng, m.lat] },
             properties: { id: m.id, name: m.name, category: m.category, region: m.region,
                           description: m.description || '', iq_score: m.iq_score || 0, color: m.color } };
  });
  map.getSource('pois').setData({ type: 'FeatureCollection', features: features });
};

window.updateTrail = function(points) {
  if (!map.getSource('trail') || !points || points.length < 2) return;
  map.getSource('trail').setData({
    type: 'FeatureCollection',
    features: [{ type: 'Feature',
      geometry: { type: 'LineString', coordinates: points.map(function(p) { return [p.lng, p.lat, p.ele || 0]; }) },
      properties: {} }],
  });
  var lngs = points.map(function(p){return p.lng;});
  var lats = points.map(function(p){return p.lat;});
  map.fitBounds([[Math.min.apply(null,lngs)-0.02, Math.min.apply(null,lats)-0.02],
                 [Math.max.apply(null,lngs)+0.02, Math.max.apply(null,lats)+0.02]], { padding: 40 });
};

document.getElementById('btn3d').addEventListener('click', function() {
  if (is3D) {
    map.setTerrain(null);
    map.easeTo({ pitch: 0, bearing: 0, duration: 700 });
    this.textContent = '⬡ 3D';
    this.classList.remove('active');
  } else {
    map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 });
    map.easeTo({ pitch: 52, bearing: -15, duration: 900 });
    this.textContent = '▲ 3D';
    this.classList.add('active');
  }
  is3D = !is3D;
});
</script>
</body>
</html>`;
}

// ─── Componente React Native ──────────────────────────────────────────────────

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
  const webViewRef = useRef<any>(null);

  const safeItems = items || [];

  const markersJSON = JSON.stringify(
    safeItems.filter(item => item?.location?.lat && item?.location?.lng).map(item => ({
      id: item.id, name: item.name, category: item.category, region: item.region,
      description: item.description ?? '', iq_score: item.iq_score ?? 0,
      lat: item.location.lat, lng: item.location.lng, color: getMarkerColor(item.category),
    })),
  );

  const trailJSON = trailPoints ? JSON.stringify(trailPoints) : 'null';

  const injectedJS = `
    window.MARKERS_DATA = ${markersJSON};
    window.TRAIL_DATA = ${trailJSON};
    true;
  `;

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'ready') onMapReady?.();
        else if (data.type === 'select' && data.item) {
          const p = data.item;
          onItemPress?.({
            id: p.id, name: p.name, category: p.category, region: p.region,
            location: { lat: p.lat ?? 0, lng: p.lng ?? 0 },
            description: p.description, iq_score: p.iq_score,
          });
        }
      } catch (_) {}
    },
    [onItemPress, onMapReady],
  );

  const handleLoadEnd = useCallback(() => {
    webViewRef.current?.injectJavaScript(`
      if (window.updateMarkers) window.updateMarkers(${markersJSON});
      ${trailJSON !== 'null' ? `if (window.updateTrail) window.updateTrail(${trailJSON});` : ''}
      true;
    `);
  }, [markersJSON, trailJSON]);

  const styleUrl = MAP_STYLES[mapMode] || MAP_STYLES.light;

  return (
    <View style={[s.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: buildMapHTML(styleUrl, trailColor) }}
        style={s.webView}
        injectedJavaScriptBeforeContentLoaded={injectedJS}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        originWhitelist={['*']}
        mixedContentMode="always"
      />
    </View>
  );
}

export default LeafletMapComponent;

export const Marker: React.FC<any> = () => null;
export const Callout: React.FC<any> = () => null;
export const PROVIDER_GOOGLE = null;
export const isMapAvailable = true;

const s = StyleSheet.create({
  container: { flex: 1 },
  webView: { flex: 1, backgroundColor: 'transparent' },
});
