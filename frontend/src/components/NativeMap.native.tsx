/**
 * NativeMap.native.tsx - Leaflet Map via WebView for iOS/Android
 * No Google API key needed - uses OpenStreetMap tiles
 * Adapted from Portugal-Vivo-Emergent
 */
import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface MapItem {
  id: string;
  name: string;
  category: string;
  region: string;
  location: { lat: number; lng: number };
  description?: string;
  address?: string;
}

interface LeafletMapProps {
  items: MapItem[];
  onItemPress?: (item: MapItem) => void;
  getCategoryColor: (category: string) => string;
  getCategoryIcon: (category: string) => string;
  style?: any;
  children?: React.ReactNode;
}

const ICON_MAP: Record<string, string> = {
  'auto-stories': 'auto_stories', celebration: 'celebration', construction: 'construction',
  nightlight: 'nightlight', restaurant: 'restaurant', storefront: 'storefront',
  pool: 'pool', forest: 'park', water: 'water', hexagon: 'hexagon',
  'home-work': 'home_work', hiking: 'hiking', route: 'route',
  waves: 'waves', eco: 'eco', 'account-balance': 'account_balance',
  pets: 'pets', palette: 'palette', church: 'church', groups: 'groups',
  place: 'place',
};

export const LeafletMapComponent = ({ 
  items, 
  onItemPress, 
  getCategoryColor, 
  getCategoryIcon,
  style 
}: LeafletMapProps) => {
  const webViewRef = useRef<WebView>(null);

  const markersData = (items || []).filter(i => i.location?.lat && i.location?.lng).map(item => ({
    id: item.id,
    name: item.name,
    category: item.category,
    region: item.region,
    lat: item.location.lat,
    lng: item.location.lng,
    color: getCategoryColor(item.category),
    icon: ICON_MAP[getCategoryIcon(item.category)] || 'place',
    description: item.description?.slice(0, 100) || '',
  }));

  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css" />
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; }
    .leaflet-container { background: #0F172A !important; }
    
    .marker-cluster-small { background-color: rgba(245,158,11,0.4); }
    .marker-cluster-small div { background-color: rgba(245,158,11,0.9); }
    .marker-cluster-medium { background-color: rgba(234,88,12,0.4); }
    .marker-cluster-medium div { background-color: rgba(234,88,12,0.9); }
    .marker-cluster-large { background-color: rgba(220,38,38,0.4); }
    .marker-cluster-large div { background-color: rgba(220,38,38,0.9); }
    .marker-cluster { background-clip: padding-box; border-radius: 50%; }
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
      background: #1E293B; border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .leaflet-popup-content { margin: 12px 16px; min-width: 200px; }
    .leaflet-popup-tip { background: #1E293B; }
    .leaflet-popup-close-button { color: #94A3B8 !important; }
    .popup-title { color: #F8FAFC; font-size: 14px; font-weight: 600; margin-bottom: 4px; }
    .popup-meta { color: #94A3B8; font-size: 11px; text-transform: capitalize; }
    .popup-link { 
      display: block; margin-top: 10px; padding: 8px 12px;
      background: #F59E0B; color: #0F172A; text-align: center;
      text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 12px;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var markers = ${JSON.stringify(markersData)};
    
    var map = L.map('map', {
      center: [39.5, -8.0],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);
    
    if (markers.length > 0) {
      var cluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 14,
      });
      
      markers.forEach(function(m) {
        var icon = L.divIcon({
          className: 'poi-marker',
          html: '<span class="material-icons">' + m.icon + '</span>',
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        
        var marker = L.marker([m.lat, m.lng], { icon: icon })
          .on('add', function() {
            var el = this.getElement();
            if (el) { el.style.background = m.color; }
          });
        
        var popup = '<div class="popup-title">' + m.name + '</div>' +
          '<div class="popup-meta">' + m.category + ' · ' + m.region + '</div>' +
          '<a class="popup-link" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:\'navigate\',id:\'' + m.id + '\'})); return false;">Ver Detalhes</a>';
        
        marker.bindPopup(popup);
        marker.on('click', function() {
          window.ReactNativeWebView.postMessage(JSON.stringify({type: 'select', item: m}));
        });
        
        cluster.addLayer(marker);
      });
      
      map.addLayer(cluster);
      
      var bounds = L.latLngBounds(markers.map(function(m) { return [m.lat, m.lng]; }));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 10 });
    }
  <\/script>
</body>
</html>
  `;

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'select' && onItemPress) {
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
    backgroundColor: '#0F172A',
  },
});

const MapViewFallback = (_props: any) => null;
const MarkerFallback = (_props: any) => null;
const CalloutFallback = (_props: any) => null;

export default MapViewFallback;
export const Marker = MarkerFallback;
export const Callout = CalloutFallback;
export const PROVIDER_GOOGLE = null;
export const isMapAvailable = false;
