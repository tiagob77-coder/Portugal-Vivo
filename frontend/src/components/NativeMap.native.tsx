/**
 * NativeMap.native.tsx — Leaflet via WebView (iOS + Android)
 *
 * Uses React Native WebView with Leaflet.js (CDN) for RELIABLE raster maps.
 * No WebGL dependency — works on ALL Android/iOS WebView versions.
 *
 * Communication:
 *   WebView → RN:  postMessage({ type: 'select' | 'ready', item?, id? })
 *   RN → WebView:  injectedJavaScriptBeforeContentLoaded with MARKERS_DATA global
 */
import React, { useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import type { MapItem, LeafletMapProps } from './NativeMap.types';

export type { MapItem, LeafletMapProps };

// ─── Build Leaflet HTML (raster tiles, no WebGL) ──────────────────────────────

function buildMapHTML(trailColor: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
<link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body, #map { width:100%; height:100%; overflow:hidden; }
  .leaflet-control-attribution { font-size:9px !important; }
  .custom-marker {
    width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid #fff; box-shadow: 0 1px 4px rgba(0,0,0,0.3);
  }
  .marker-cluster-small, .marker-cluster-medium, .marker-cluster-large {
    background-color: rgba(107, 158, 120, 0.6) !important;
  }
  .marker-cluster-small div, .marker-cluster-medium div, .marker-cluster-large div {
    background-color: rgba(107, 158, 120, 0.8) !important;
    color: #fff; font-weight: 700; font-size: 12px;
  }
  .marker-cluster-medium { background-color: rgba(196, 154, 108, 0.6) !important; }
  .marker-cluster-medium div { background-color: rgba(196, 154, 108, 0.8) !important; }
  .marker-cluster-large { background-color: rgba(124, 58, 237, 0.6) !important; }
  .marker-cluster-large div { background-color: rgba(124, 58, 237, 0.8) !important; }
  .poi-popup h4 { font-size: 14px; font-weight: 700; margin: 0 0 4px; color: #1a1a1a; font-family: system-ui; }
  .poi-popup p  { font-size: 12px; color: #64748b; margin: 0 0 6px; font-family: system-ui; }
  .poi-popup a  { font-size: 12px; font-weight: 700; color: #2E5E4E; text-decoration: none; font-family: system-ui; }
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
<script>
var map = L.map('map', { zoomControl: true }).setView([39.6945, -7.8491], 7);
L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://osm.org/">OSM</a>', maxZoom: 19, subdomains: 'abcd'
}).addTo(map);

var markers = L.markerClusterGroup({ maxClusterRadius: 44, spiderfyOnMaxZoom: true, showCoverageOnHover: false });
map.addLayer(markers);
var trailLayer = null;

window.updateMarkers = function(data) {
  markers.clearLayers();
  if (!data || !Array.isArray(data)) return;
  data.forEach(function(p) {
    if (!p.lat || !p.lng) return;
    var icon = L.divIcon({
      className: '', iconSize: [14, 14], iconAnchor: [7, 7],
      html: '<div class="custom-marker" style="background:' + (p.color || '#6B9E78') + '"><\/div>'
    });
    var m = L.marker([p.lat, p.lng], { icon: icon });
    m.bindPopup(
      '<div class="poi-popup"><h4>' + (p.name||'') + '<\/h4>' +
      '<p>' + (p.category||'') + ' \\u00b7 ' + (p.region||'') + '<\/p>' +
      '<a href="#" onclick="selectPOI(\\'' + p.id + '\\');return false">Ver detalhes \\u2192<\/a><\/div>',
      { maxWidth: 240 }
    );
    m._poiData = p;
    markers.addLayer(m);
  });
};

window.updateTrail = function(points) {
  if (trailLayer) { map.removeLayer(trailLayer); trailLayer = null; }
  if (!points || points.length < 2) return;
  var ll = points.map(function(p) { return [p.lat, p.lng]; });
  trailLayer = L.polyline(ll, { color: '${trailColor}', weight: 4, opacity: 0.85 }).addTo(map);
  map.fitBounds(trailLayer.getBounds(), { padding: [30, 30] });
};

window.selectPOI = function(id) {
  var found = null;
  markers.eachLayer(function(l) { if (l._poiData && l._poiData.id === id) found = l._poiData; });
  if (found && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'select', item: found }));
  }
};

if (window.MARKERS_DATA) window.updateMarkers(window.MARKERS_DATA);
if (window.TRAIL_DATA && window.TRAIL_DATA.length > 1) window.updateTrail(window.TRAIL_DATA);
if (window.ReactNativeWebView) {
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
}
<\/script>
</body>
</html>`;
}

// ─── React Native Component ──────────────────────────────────────────────────

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

  return (
    <View style={[s.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: buildMapHTML(trailColor) }}
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
export const isMapAvailable = false;

const s = StyleSheet.create({
  container: { flex: 1 },
  webView: { flex: 1, backgroundColor: 'transparent' },
});
