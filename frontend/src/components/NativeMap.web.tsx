/**
 * NativeMap.web.tsx - Interactive Leaflet Map for Web
 * Uses a single effect to load Leaflet, create map, and add markers
 * to avoid timing issues between separate effects.
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

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
}

const ICON_MAP: Record<string, string> = {
  'auto-stories': 'auto_stories', celebration: 'celebration', construction: 'construction',
  nightlight: 'nightlight', restaurant: 'restaurant', storefront: 'storefront',
  pool: 'pool', forest: 'park', water: 'water', hexagon: 'hexagon',
  'home-work': 'home_work', hiking: 'hiking', route: 'route',
  waves: 'waves', eco: 'eco', 'account-balance': 'account_balance',
  pets: 'pets', palette: 'palette', church: 'church', groups: 'groups',
  place: 'place', terrain: 'terrain', explore: 'explore',
};

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte', centro: 'Centro', lisboa: 'Lisboa',
  alentejo: 'Alentejo', algarve: 'Algarve',
  acores: 'Acores', madeira: 'Madeira',
};

let cssInjected = false;
function injectLeafletCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  cssInjected = true;

  const links = [
    'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
    'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
  ];
  links.forEach(href => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  });

  const style = document.createElement('style');
  style.textContent = `
    .leaflet-container { background: #0F172A !important; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .marker-cluster-small { background-color: rgba(245,158,11,.3); }
    .marker-cluster-small div { background-color: rgba(245,158,11,.85); }
    .marker-cluster-medium { background-color: rgba(234,88,12,.3); }
    .marker-cluster-medium div { background-color: rgba(234,88,12,.85); }
    .marker-cluster-large { background-color: rgba(220,38,38,.3); }
    .marker-cluster-large div { background-color: rgba(220,38,38,.85); }
    .marker-cluster { background-clip: padding-box; border-radius: 50%; }
    .marker-cluster div { width: 32px; height: 32px; margin: 5px; text-align: center; border-radius: 50%; font-size: 13px; font-weight: 700; color: #fff; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
    .poi-marker { display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 2.5px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,.25); cursor: pointer; transition: box-shadow .15s; }
    .poi-marker:hover { box-shadow: 0 3px 14px rgba(0,0,0,.4); border-color: #F59E0B; z-index: 9999 !important; }
    .poi-marker .material-icons { font-size: 14px; color: #fff; line-height: 1; }
    .leaflet-popup-content-wrapper { background: #1E293B; border-radius: 14px; box-shadow: 0 8px 32px rgba(0,0,0,.35); border: 1px solid #334155; }
    .leaflet-popup-content { margin: 0; padding: 0; min-width: 220px; }
    .leaflet-popup-tip { background: #1E293B; }
    .leaflet-popup-close-button { color: #94A3B8 !important; top: 8px !important; right: 10px !important; font-size: 18px !important; }
    .popup-inner { padding: 16px; }
    .popup-inner h3 { margin: 0 0 4px; font-size: 15px; font-weight: 700; color: #F8FAFC; line-height: 1.35; }
    .popup-inner .popup-cat { font-size: 12px; color: #94A3B8; text-transform: capitalize; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
    .popup-inner .cat-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .popup-inner .popup-desc { font-size: 12px; color: #CBD5E1; line-height: 1.55; margin-bottom: 10px; max-height: 50px; overflow: hidden; }
    .popup-inner .popup-badges { display: flex; gap: 6px; margin-bottom: 10px; }
    .popup-inner .popup-badge { display: inline-flex; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #334155; color: #94A3B8; }
    .popup-inner .popup-link { display: block; width: 100%; padding: 9px; text-align: center; background: linear-gradient(135deg, #F59E0B, #D97706); border: none; border-radius: 10px; color: #0F172A; font-weight: 600; font-size: 13px; cursor: pointer; text-decoration: none; }
    .popup-inner .popup-link:hover { opacity: .9; }
  `;
  document.head.appendChild(style);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof document === 'undefined') return reject('No document');
    // Check if already loaded
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const LeafletMapComponent = ({
  items,
  onItemPress,
  getCategoryColor,
  getCategoryIcon,
  style,
}: LeafletMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const clusterLayerRef = useRef<any>(null);
  const mountedRef = useRef(true);

  // Store latest callbacks in refs
  const onItemPressRef = useRef(onItemPress);
  const getCategoryColorRef = useRef(getCategoryColor);
  const getCategoryIconRef = useRef(getCategoryIcon);
  onItemPressRef.current = onItemPress;
  getCategoryColorRef.current = getCategoryColor;
  getCategoryIconRef.current = getCategoryIcon;

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (mapInstanceRef.current) {
        try { mapInstanceRef.current.remove(); } catch (_) {}
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Single unified effect: load Leaflet, create map, add markers
  useEffect(() => {
    if (typeof window === 'undefined' || Platform.OS !== 'web') return;
    if (!items || items.length === 0) return;

    const validItems = items.filter(i => i.location?.lat && i.location?.lng);
    if (validItems.length === 0) return;

    let cancelled = false;

    const initMap = async () => {
      try {
        // Step 1: Inject CSS
        injectLeafletCSS();

        // Step 2: Load Leaflet JS from CDN
        await loadScript('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');
        if (cancelled || !mountedRef.current) return;

        // Step 3: Load MarkerCluster plugin
        await loadScript('https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js');
        if (cancelled || !mountedRef.current) return;

        const L = (window as any).L;
        if (!L || !L.markerClusterGroup) {
          console.warn('Leaflet or MarkerCluster not available');
          return;
        }

        // Step 4: Get the container DOM element
        const el = containerRef.current;
        if (!el) return;

        // Get the actual DOM node (React Native Web wraps in a div)
        let domNode: HTMLElement = el;
        if (typeof domNode.querySelector === 'function') {
          // Sometimes RN Web wraps in nested divs
          domNode = el;
        }

        // Step 5: Create or reuse map instance
        if (mapInstanceRef.current) {
          // Map already exists, just update markers
          updateMarkers(L, mapInstanceRef.current, validItems);
          return;
        }

        // Create new map - we need a raw DOM element
        // React Native Web's View renders as a div, so containerRef should work
        const mapDiv = document.createElement('div');
        mapDiv.style.width = '100%';
        mapDiv.style.height = '100%';
        mapDiv.style.position = 'absolute';
        mapDiv.style.top = '0';
        mapDiv.style.left = '0';

        // Clear any existing content and append map div
        while (domNode.firstChild) {
          domNode.removeChild(domNode.firstChild);
        }
        domNode.appendChild(mapDiv);
        domNode.style.position = 'relative';

        const map = L.map(mapDiv, {
          center: [39.5, -8.0],
          zoom: 7,
          zoomControl: false,
          attributionControl: false,
          maxBounds: [[30, -35], [44, -5]],
          minZoom: 5,
        });

        L.control.zoom({ position: 'topright' }).addTo(map);
        L.control.attribution({ position: 'bottomright', prefix: false })
          .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; CartoDB')
          .addTo(map);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          crossOrigin: 'anonymous',
        }).addTo(map);

        mapInstanceRef.current = map;

        // Invalidate size after a short delay
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 500);

        // Step 6: Add markers
        updateMarkers(L, map, validItems);

      } catch (err) {
        console.error('Leaflet map init error:', err);
      }
    };

    const updateMarkers = (L: any, map: any, validItems: MapItem[]) => {
      // Remove existing cluster layer
      if (clusterLayerRef.current) {
        map.removeLayer(clusterLayerRef.current);
        clusterLayerRef.current = null;
      }

      const cluster = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        disableClusteringAtZoom: 14,
        animateAddingMarkers: false,
        iconCreateFunction: (cl: any) => {
          const count = cl.getChildCount();
          const size = count < 20 ? 'small' : count < 80 ? 'medium' : 'large';
          const dim = count < 20 ? 42 : count < 80 ? 48 : 56;
          return L.divIcon({
            html: `<div><span>${count}</span></div>`,
            className: `marker-cluster marker-cluster-${size}`,
            iconSize: L.point(dim, dim),
          });
        },
      });

      validItems.forEach(item => {
        const color = getCategoryColorRef.current(item.category);
        const iconKey = getCategoryIconRef.current(item.category);
        const materialIcon = ICON_MAP[iconKey] || 'place';
        const regionName = REGION_NAMES[item.region] || item.region;
        const desc = item.description ? escapeHtml(item.description.slice(0, 120)) : '';

        const icon = L.divIcon({
          className: 'poi-marker',
          html: `<span class="material-icons">${materialIcon}</span>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
          popupAnchor: [0, -18],
        });

        const marker = L.marker([item.location.lat, item.location.lng], { icon })
          .on('add', function(this: any) {
            const el = this.getElement();
            if (el) {
              el.style.background = color;
              el.style.width = '30px';
              el.style.height = '30px';
            }
          });

        const popupHtml = `
          <div class="popup-inner">
            <h3>${escapeHtml(item.name)}</h3>
            <div class="popup-cat">
              <span class="cat-dot" style="background:${color}"></span>
              ${escapeHtml(item.category)}
            </div>
            <div class="popup-badges">
              <span class="popup-badge">${regionName}</span>
            </div>
            ${desc ? `<div class="popup-desc">${desc}</div>` : ''}
          </div>
        `;

        marker.bindPopup(popupHtml, {
          maxWidth: 280,
          closeButton: true,
          autoPan: true,
        });

        marker.on('click', () => {
          if (onItemPressRef.current) {
            onItemPressRef.current(item);
          }
        });

        cluster.addLayer(marker);
      });

      map.addLayer(cluster);
      clusterLayerRef.current = cluster;

      // Fit bounds to mainland Portugal (exclude Acores/Madeira for initial view)
      const mainland = validItems.filter(i => i.location.lng > -15);
      const boundsItems = mainland.length > 0 ? mainland : validItems;
      const bounds = L.latLngBounds(boundsItems.map((i: MapItem) => [i.location.lat, i.location.lng]));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
    };

    initMap();

    return () => {
      cancelled = true;
    };
  }, [items]);

  if (typeof window === 'undefined' || Platform.OS !== 'web') {
    return <View style={[styles.container, style]} />;
  }

  return (
    <View
      ref={containerRef as any}
      style={[styles.container, style]}
      data-testid="leaflet-map"
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 400,
  },
});

const MarkerFallback = (_props: any) => null;
const CalloutFallback = (_props: any) => null;

export default LeafletMapComponent;
export const Marker = MarkerFallback;
export const Callout = CalloutFallback;
export const PROVIDER_GOOGLE = null;
export const isMapAvailable = false;
