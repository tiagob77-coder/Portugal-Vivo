/**
 * NativeMap.web.tsx - Interactive Leaflet Map for Web
 * Features: Light/Dark tiles, MarkerCluster, Heatmap, IQ score popups
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

let L: any = null;

// Load Leaflet only on client-side (not during SSR)
function loadLeaflet(): Promise<any> {
  if (L) return Promise.resolve(L);
  if (typeof window === 'undefined') return Promise.resolve(null);
  
  return new Promise((resolve) => {
    L = require('leaflet'); // eslint-disable-line @typescript-eslint/no-require-imports
    require('leaflet.markercluster'); // eslint-disable-line @typescript-eslint/no-require-imports
    resolve(L);
  });
}

// Tile layers
const TILES = {
  light: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  voyager: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
};

// Inject CSS once
let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof window === 'undefined' || typeof document === 'undefined') return;
  cssInjected = true;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.appendChild(link);

  const clusterLink = document.createElement('link');
  clusterLink.rel = 'stylesheet';
  clusterLink.href = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css';
  document.head.appendChild(clusterLink);

  const iconLink = document.createElement('link');
  iconLink.rel = 'stylesheet';
  iconLink.href = 'https://fonts.googleapis.com/icon?family=Material+Icons';
  document.head.appendChild(iconLink);

  // Load leaflet.heat from CDN
  const heatScript = document.createElement('script');
  heatScript.src = 'https://unpkg.com/leaflet.heat@0.2.0/dist/leaflet-heat.js';
  document.head.appendChild(heatScript);

  const style = document.createElement('style');
  style.textContent = `
    .leaflet-container { background: #F1F5F9 !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    /* Cluster styles */
    .marker-cluster-small { background-color: rgba(245,158,11,0.25); }
    .marker-cluster-small div { background-color: rgba(245,158,11,0.85); }
    .marker-cluster-medium { background-color: rgba(234,88,12,0.25); }
    .marker-cluster-medium div { background-color: rgba(234,88,12,0.85); }
    .marker-cluster-large { background-color: rgba(220,38,38,0.25); }
    .marker-cluster-large div { background-color: rgba(220,38,38,0.85); }
    .marker-cluster {
      background-clip: padding-box;
      border-radius: 50%;
    }
    .marker-cluster div {
      width: 32px; height: 32px; margin: 5px;
      text-align: center; border-radius: 50%;
      font-size: 13px; font-weight: 700; color: #fff;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }
    .marker-cluster span { line-height: 1; }

    /* POI marker */
    .poi-marker {
      display: flex; align-items: center; justify-content: center;
      border-radius: 50%; border: 2.5px solid #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      cursor: pointer;
      transition: box-shadow 0.15s ease, border-color 0.15s ease;
    }
    .poi-marker:hover { box-shadow: 0 3px 14px rgba(0,0,0,0.35); border-color: #FFD700; z-index: 9999 !important; }
    .poi-marker .m-icon { font-family: 'Material Icons'; font-size: 14px; color: #fff; line-height: 1; }

    /* Popup - high z-index to stay above markers and clusters */
    .poi-popup .leaflet-popup-content-wrapper {
      background: #fff; border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18);
      border: 1px solid #F2EDE4;
    }
    .poi-popup .leaflet-popup-content { margin: 0; padding: 0; min-width: 240px; }
    .poi-popup .leaflet-popup-tip { background: #fff; }
    .poi-popup .leaflet-popup-close-button { color: #64748B !important; top: 8px !important; right: 10px !important; font-size: 18px !important; z-index: 999 !important; }
    .leaflet-popup-pane { z-index: 900 !important; }
    .leaflet-popup { z-index: 900 !important; }
    .leaflet-marker-pane { z-index: 600 !important; }

    /* Fix React Native Web overflow clipping */
    .leaflet-container { overflow: visible !important; }
    [data-testid="map-container"] { overflow: visible !important; }
    [data-testid="map-container"] > div { overflow: visible !important; }

    .popup-inner { padding: 16px; }
    .popup-inner h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #2E5E4E; line-height: 1.35; }
    .popup-inner .popup-cat { font-size: 12px; color: #64748B; text-transform: capitalize; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
    .popup-inner .popup-cat .cat-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .popup-inner .popup-desc { font-size: 12px; color: #3D4A3D; line-height: 1.55; margin-bottom: 10px; max-height: 50px; overflow: hidden; }
    .popup-inner .popup-badges { display: flex; gap: 6px; margin-bottom: 10px; flex-wrap: wrap; }
    .popup-inner .popup-badge {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600;
    }
    .popup-inner .badge-iq { background: #FEF3C7; color: #B08556; }
    .popup-inner .badge-region { background: #EDE9FE; color: #7C3AED; }
    .popup-inner .popup-link {
      display: block; width: 100%; padding: 9px; text-align: center;
      background: linear-gradient(135deg, #C49A6C, #B08556);
      border: none; border-radius: 10px; color: #fff; font-weight: 600;
      font-size: 13px; cursor: pointer; text-decoration: none;
      transition: opacity 0.15s;
    }
    .popup-inner .popup-link:hover { opacity: 0.9; }

    /* Map mode switcher */
    .map-mode-control {
      background: rgba(255,255,255,0.95); backdrop-filter: blur(8px);
      border-radius: 10px; padding: 4px; box-shadow: 0 2px 12px rgba(0,0,0,0.1);
      display: flex; gap: 2px; border: 1px solid #F2EDE4;
    }
    .map-mode-btn {
      padding: 6px 10px; border: none; border-radius: 8px;
      font-size: 11px; font-weight: 600; cursor: pointer;
      background: transparent; color: #64748B; transition: all 0.15s;
      display: flex; align-items: center; gap: 4px;
    }
    .map-mode-btn:hover { background: #F1F5F9; color: #2E5E4E; }
    .map-mode-btn.active { background: #C49A6C; color: #fff; }
    .map-mode-btn .m-icon { font-family: 'Material Icons'; font-size: 15px; }
  `;
  document.head.appendChild(style);
}

const ICON_MAP: Record<string, string> = {
  terrain: 'terrain', 'account-balance': 'account_balance',
  restaurant: 'restaurant', event: 'event',
  'beach-access': 'beach_access', hiking: 'hiking', place: 'place',
  pets: 'pets', 'local-florist': 'local_florist', park: 'park',
  visibility: 'visibility', panorama: 'panorama', water: 'water',
  waves: 'waves', pool: 'pool', diamond: 'diamond', settings: 'settings',
  'directions-walk': 'directions_walk', fort: 'fort', villa: 'villa',
  museum: 'museum', handyman: 'handyman', 'hot-tub': 'hot_tub',
  train: 'train', palette: 'palette', 'local-bar': 'local_bar',
  storefront: 'storefront', agriculture: 'agriculture', 'wine-bar': 'wine_bar',
  'lunch-dining': 'lunch_dining', cake: 'cake', 'music-note': 'music_note',
  celebration: 'celebration', festival: 'festival', surfing: 'surfing',
  flag: 'flag', route: 'route', explore: 'explore', star: 'star',
  cottage: 'cottage', 'holiday-village': 'holiday_village', hotel: 'hotel',
  'support-agent': 'support_agent', business: 'business', 'menu-book': 'menu_book',
  'directions-bus': 'directions_bus', eco: 'eco',
};

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
  ref?: any;
  provider?: any;
  initialRegion?: any;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  showsMyLocationButton?: boolean;
  showsCompass?: boolean;
  customMapStyle?: any;
  mapPadding?: any;
  [key: string]: any;
}

const LeafletMapComponent = ({ items, onItemPress, getMarkerColor, getLayerIcon, mapMode = 'markers', trailPoints, trailColor = '#C49A6C', style }: LeafletMapProps) => {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const tileRef = useRef<any>(null);
  const clusterRef = useRef<any>(null);
  const heatRef = useRef<any>(null);
  const trailRef = useRef<any>(null);
  const _modeControlRef = useRef<any>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  // Store callbacks in refs to avoid re-triggering the marker useEffect
  const onItemPressRef = useRef(onItemPress);
  const getMarkerColorRef = useRef(getMarkerColor);
  const getLayerIconRef = useRef(getLayerIcon);
  onItemPressRef.current = onItemPress;
  getMarkerColorRef.current = getMarkerColor;
  getLayerIconRef.current = getLayerIcon;

  // Load Leaflet on mount (client-side only)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    loadLeaflet().then((leaflet) => {
      if (leaflet) setLeafletLoaded(true);
    });
  }, []);

  // Initialize map once
  useEffect(() => {
    if (!leafletLoaded || !L) return;
    injectCSS();

    const el = containerRef.current;
    if (!el || mapRef.current) return;
    const domNode = el instanceof HTMLElement ? el : el;
    if (!domNode || typeof domNode.getAttribute !== 'function') return;

    const map = L.map(domNode, {
      center: [37.0, -17.0],
      zoom: 5,
      zoomControl: false,
      attributionControl: false,
      maxBounds: [[30, -35], [44, -5]],
      minZoom: 5,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; CartoDB &copy; OSM')
      .addTo(map);

    // Start with light tiles
    tileRef.current = L.tileLayer(TILES.light, { maxZoom: 19, crossOrigin: 'anonymous', attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      clusterRef.current = null;
      heatRef.current = null;
    };
  }, [leafletLoaded]);

  // Update tile layer when mapMode changes
  useEffect(() => {
    if (!mapRef.current || !tileRef.current || !L) return;

    const tileUrl = mapMode === 'satellite' ? TILES.satellite
      : mapMode === 'heatmap' ? TILES.light
      : TILES.light;

    tileRef.current.setUrl(tileUrl);
  }, [mapMode]);

  // Update markers/heatmap when items or mode change
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const map = mapRef.current;

    // Clear previous layers
    if (clusterRef.current) {
      map.removeLayer(clusterRef.current);
      clusterRef.current = null;
    }
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    if (!items || items.length === 0) return;

    const validItems = items.filter(i => i.location?.lat && i.location?.lng);

    if (mapMode === 'heatmap') {
      // Heatmap mode - wait for leaflet-heat to load
      let heatRetries = 0;
      const tryHeat = () => {
        if ((L as any).heatLayer) {
          const heatData = validItems.map(i => [
            i.location.lat,
            i.location.lng,
            (i.iq_score || 40) / 100 // Normalize score to 0-1 intensity
          ]);
          heatRef.current = (L as any).heatLayer(heatData, {
            radius: 25,
            blur: 20,
            maxZoom: 12,
            max: 0.8,
            gradient: {
              0.2: '#3B82F6',
              0.4: '#22D3EE',
              0.5: '#22C55E',
              0.65: '#C49A6C',
              0.8: '#EF4444',
              1.0: '#DC2626',
            },
          }).addTo(map);
        } else {
          if (++heatRetries < 25) setTimeout(tryHeat, 200);
        }
      };
      tryHeat();

      // Also show small dots for context
      const dotCluster = (L as any).markerClusterGroup({
        maxClusterRadius: 40,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: 'marker-cluster marker-cluster-' + (count < 20 ? 'small' : count < 50 ? 'medium' : 'large'),
            iconSize: L.point(42, 42),
          });
        },
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 14,
      });

      validItems.forEach(item => {
        const color = getMarkerColorRef.current(item.category);
        const icon = L.divIcon({
          className: 'poi-marker',
          html: `<span class="m-icon" style="font-size:10px">place</span>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          popupAnchor: [0, -12],
        });

        const marker = L.marker([item.location.lat, item.location.lng], { icon })
          .on('add', function(this: any) {
            const el = this.getElement(); // eslint-disable-line react/no-this-in-sfc
            if (el) { el.style.background = color; el.style.width = '18px'; el.style.height = '18px'; el.style.opacity = '0.7'; }
          });

        marker.on('click', (e: any) => {
          L.DomEvent.stopPropagation(e);
          L.popup({ className: 'poi-popup', maxWidth: 280, closeButton: true, autoPan: true })
            .setLatLng(marker.getLatLng())
            .setContent(buildPopup(item, color))
            .openOn(mapRef.current!);
          if (onItemPressRef.current) onItemPressRef.current(item);
        });
        dotCluster.addLayer(marker);
      });

      clusterRef.current = dotCluster;
      map.addLayer(dotCluster);

    } else {
      // Standard marker cluster mode
      const markerCluster = (L as any).markerClusterGroup({
        maxClusterRadius: 50,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          const size = count < 20 ? 'small' : count < 80 ? 'medium' : 'large';
          const dim = count < 20 ? 42 : count < 80 ? 48 : 56;
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(dim, dim),
          });
        },
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 15,
        animateAddingMarkers: false,
      });

      validItems.forEach(item => {
        const color = getMarkerColorRef.current(item.category);
        const iconName = getLayerIconRef.current(item.category);
        const materialIcon = ICON_MAP[iconName] || 'place';

        const icon = L.divIcon({
          className: 'poi-marker',
          html: `<span class="m-icon">${materialIcon}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        });

        const marker = L.marker([item.location.lat, item.location.lng], { icon })
          .on('add', function(this: any) {
            const el = this.getElement(); // eslint-disable-line react/no-this-in-sfc
            if (el) { el.style.background = color; el.style.width = '30px'; el.style.height = '30px'; }
          });

        // Bind popup directly to marker for better reliability
        marker.bindPopup(buildPopup(item, color), {
          className: 'poi-popup',
          maxWidth: 280,
          closeButton: true,
          autoPan: true,
          autoPanPadding: L.point(60, 60),
          keepInView: true,
        });

        marker.on('click', () => {
          if (onItemPressRef.current) onItemPressRef.current(item);
        });

        markerCluster.addLayer(marker);
      });

      clusterRef.current = markerCluster;
      map.addLayer(markerCluster);
    }

    // Fit bounds
    if (validItems.length > 0) {
      const bounds = L.latLngBounds(validItems.map(i => [i.location.lat, i.location.lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
    }
  }, [items, mapMode]);

  // Draw trail polyline when trailPoints change
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const map = mapRef.current;

    // Clear previous trail
    if (trailRef.current) {
      map.removeLayer(trailRef.current);
      trailRef.current = null;
    }

    if (!trailPoints || trailPoints.length < 2) return;

    const latlngs = trailPoints.map(p => [p.lat, p.lng]);

    // Draw a shadow line first for better visibility
    const shadow = L.polyline(latlngs, {
      color: '#000',
      weight: 6,
      opacity: 0.2,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    // Main trail line
    const line = L.polyline(latlngs, {
      color: trailColor,
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: null,
    }).addTo(map);

    // Start/End markers
    const startIcon = L.divIcon({
      className: 'poi-marker',
      html: '<span class="m-icon" style="font-size:14px">flag</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
    const endIcon = L.divIcon({
      className: 'poi-marker',
      html: '<span class="m-icon" style="font-size:14px">sports_score</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const startMarker = L.marker(latlngs[0], { icon: startIcon })
      .on('add', function(this: any) {
        const el = this.getElement(); // eslint-disable-line react/no-this-in-sfc
        if (el) { el.style.background = '#22C55E'; el.style.width = '28px'; el.style.height = '28px'; }
      })
      .bindPopup('<div class="popup-inner"><h3>Ponto de Partida</h3></div>', { className: 'poi-popup' })
      .addTo(map);

    const endMarker = L.marker(latlngs[latlngs.length - 1], { icon: endIcon })
      .on('add', function(this: any) {
        const el = this.getElement(); // eslint-disable-line react/no-this-in-sfc
        if (el) { el.style.background = '#EF4444'; el.style.width = '28px'; el.style.height = '28px'; }
      })
      .bindPopup('<div class="popup-inner"><h3>Ponto de Chegada</h3></div>', { className: 'poi-popup' })
      .addTo(map);

    // Group for removal
    trailRef.current = L.layerGroup([shadow, line, startMarker, endMarker]).addTo(map);

    // Fit to trail bounds
    map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50], maxZoom: 12 });

    return () => {
      if (trailRef.current) {
        map.removeLayer(trailRef.current);
        trailRef.current = null;
      }
    };
  }, [trailPoints, trailColor]);

  if (typeof window === 'undefined' || Platform.OS !== 'web') {
    return <View style={[styles.container, style]} />;
  }

  return (
    <View
      ref={containerRef}
      style={[styles.container, style]}
      data-testid="leaflet-map"
    />
  );
};

function buildPopup(item: MapItem, color: string): string {
  const desc = item.description ? item.description.slice(0, 100) + (item.description.length > 100 ? '...' : '') : '';
  const iqBadge = item.iq_score
    ? `<span class="popup-badge badge-iq">IQ ${item.iq_score.toFixed(1)}</span>`
    : '';
  const regionBadge = item.region
    ? `<span class="popup-badge badge-region">${item.region}</span>`
    : '';

  return `
    <div class="popup-inner">
      <h3>${item.name}</h3>
      <div class="popup-cat">
        <span class="cat-dot" style="background:${color}"></span>
        ${item.category}
      </div>
      <div class="popup-badges">${iqBadge}${regionBadge}</div>
      ${desc ? `<div class="popup-desc">${desc}</div>` : ''}
      <a class="popup-link" href="/heritage/${item.id}">Ver Detalhes</a>
    </div>
  `;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 500,
  },
});

const MarkerFallback = (_props: any) => null;
const CalloutFallback = (_props: any) => null;

export default LeafletMapComponent;
export { LeafletMapComponent };
export const Marker = MarkerFallback;
export const Callout = CalloutFallback;
export const PROVIDER_GOOGLE = null;
export const isMapAvailable = false;
