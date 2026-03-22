/**
 * NativeMap - Native platform implementation
 * Now uses Leaflet WebView for better compatibility (no Google API key needed)
 */
import React, { useRef } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { palette } from '../theme';

const { width: _width, height: _height } = Dimensions.get('window');

// Leaflet Map via WebView for native platforms
interface MapItem {
  id: string;
  name: string;
  category: string;
  region: string;
  location: { lat: number; lng: number };
  description?: string;
  iq_score?: number;
}

interface LeafletMapProps {
  items: MapItem[];
  onItemPress?: (item: MapItem) => void;
  getMarkerColor: (category: string) => string;
  getLayerIcon: (category: string) => string;
  mapMode?: string;
  trailPoints?: { lat: number; lng: number; ele?: number }[];
  trailColor?: string;
  style?: any;
  children?: React.ReactNode;
}

const ICON_MAP: Record<string, string> = {
  terrain: 'terrain', 'account-balance': 'account_balance',
  restaurant: 'restaurant', event: 'event',
  'beach-access': 'beach_access', hiking: 'hiking', place: 'place',
};

export const LeafletMapComponent = ({ 
  items, 
  onItemPress, 
  getMarkerColor, 
  getLayerIcon, 
  mapMode: _mapMode = 'markers',
  trailPoints,
  trailColor = palette.terracotta[500],
  style 
}: LeafletMapProps) => {
  const webViewRef = useRef<WebView>(null);

  // Build markers data
  const markersData = (items || []).filter(i => i.location?.lat && i.location?.lng).map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    region: item.region,
    lat: item.location.lat,
    lng: item.location.lng,
    color: getMarkerColor(item.category),
    icon: ICON_MAP[getLayerIcon(item.category)] || 'place',
    description: item.description?.slice(0, 100) || '',
    iq_score: item.iq_score || 0,
  }));

  const trailData = trailPoints ? trailPoints.map(p => [p.lat, p.lng]) : [];

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-container { background: #E8E4E0 !important; }
    
    .marker-cluster-small { background-color: rgba(196,154,108,0.6); }
    .marker-cluster-small div { background-color: rgba(196,154,108,1); }
    .marker-cluster-medium { background-color: rgba(198,93,59,0.6); }
    .marker-cluster-medium div { background-color: rgba(198,93,59,1); }
    .marker-cluster-large { background-color: rgba(178,62,52,0.6); }
    .marker-cluster-large div { background-color: rgba(178,62,52,1); }
    .marker-cluster {
      background-clip: padding-box;
      border-radius: 50%;
    }
    .marker-cluster div {
      width: 32px; height: 32px; margin: 5px;
      text-align: center; border-radius: 50%;
      font-size: 13px; font-weight: 700; color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.25);
    }
    
    .poi-marker {
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 2px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .poi-marker .material-icons { font-size: 14px; color: #fff; }
    
    .leaflet-popup-content-wrapper {
      background: ${palette.forest[600]}; border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .leaflet-popup-content { margin: 12px 16px; min-width: 200px; }
    .leaflet-popup-tip { background: ${palette.forest[600]}; }
    .popup-title { color: #fff; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .popup-meta { color: #C8C3B8; font-size: 11px; text-transform: capitalize; }
    .popup-link {
      display: block; margin-top: 10px; padding: 8px 12px;
      background: ${palette.terracotta[500]}; color: #000; text-align: center;
      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const markers = ${JSON.stringify(markersData)};
    const trailData = ${JSON.stringify(trailData)};
    const trailColor = '${trailColor}';
    
    const map = L.map('map', {
      center: [39.5, -8.0],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    if (markers.length > 0) {
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 14,
      });
      
      markers.forEach(m => {
        const icon = L.divIcon({
          className: 'poi-marker',
          html: '<span class="material-icons">' + m.icon + '</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        
        const marker = L.marker([m.lat, m.lng], { icon })
          .on('add', function() {
            const el = this.getElement();
            if (el) { el.style.background = m.color; }
          });
        
        const popup = '<div class="popup-title">' + m.name + '</div>' +
          '<div class="popup-meta">' + m.category + ' • ' + m.region + '</div>' +
          '<a class="popup-link" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:\\'navigate\\',id:\\'' + m.id + '\\'}))">Ver Detalhes</a>';
        
        marker.bindPopup(popup);
        marker.on('click', () => {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'select', item: m}));
        });
        
        cluster.addLayer(marker);
      });
      
      map.addLayer(cluster);
      
      // Fit bounds
      const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
    }
    
    // Draw trail if provided
    if (trailData.length > 1) {
      // Shadow for contrast on any tile
      L.polyline(trailData, { color: '#000', weight: 6, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      // Main trail line
      L.polyline(trailData, { color: trailColor, weight: 4, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }).addTo(map);
      // Start marker (green)
      const startIcon = L.divIcon({ className: '', html: '<div style="background:#22C55E;width:28px;height:28px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);font-family:Material+Icons,sans-serif;font-size:14px;color:#fff">flag</div>', iconSize:[28,28], iconAnchor:[14,14] });
      // End marker (red)
      const endIcon = L.divIcon({ className: '', html: '<div style="background:#EF4444;width:28px;height:28px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.4);font-family:Material+Icons,sans-serif;font-size:14px;color:#fff">sports_score</div>', iconSize:[28,28], iconAnchor:[14,14] });
      L.marker(trailData[0], { icon: startIcon }).bindPopup('Partida').addTo(map);
      L.marker(trailData[trailData.length-1], { icon: endIcon }).bindPopup('Chegada').addTo(map);
      map.fitBounds(L.latLngBounds(trailData), { padding: [40, 40] });
    }
  </script>
</body>
</html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'select' && onItemPress) {
        // Reconstruct item with location
        const item: MapItem = {
          ...data.item,
          location: { lat: data.item.lat, lng: data.item.lng }
        };
        onItemPress(item);
      }
    } catch (_e) {
      // Ignore parse errors
    }
  };

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: htmlContent }}
        style={styles.webview}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        mixedContentMode="compatibility"
        originWhitelist={['*']}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
  webview: {
    flex: 1,
    backgroundColor: '#1d2c4d',
  },
});

// Fallback components for compatibility
const MapViewFallback = (_props: any) => null;
const MarkerFallback = (_props: any) => null;
const CalloutFallback = (_props: any) => null;

export default MapViewFallback;
export { LeafletMapComponent as LeafletMap };
export const Marker = MarkerFallback;
export const Callout = CalloutFallback;
export const PROVIDER_GOOGLE = null;
export const isMapAvailable = false; // Force web fallback to use LeafletMapComponent
