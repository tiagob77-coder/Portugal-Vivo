/**
 * GoogleMapComponent.tsx - Google Maps implementation for web
 * 
 * Simple, reliable map component using Google Maps JavaScript API
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Text, ActivityIndicator } from 'react-native';
import { API_BASE } from '../config/api';

const GOOGLE_MAPS_API_KEY = 'AIzaSyCZWPxRxRCobqJW-X1pcXim3HCCaJt1OgY';

// Portugal center
const PT_CENTER = { lat: 39.5, lng: -8.0 };
const PT_ZOOM = 6;

// Category colors
const CATEGORY_COLORS: Record<string, string> = {
  castelos: '#8B4513',
  mosteiros: '#4A90A4',
  igrejas: '#9B59B6',
  palacios: '#E67E22',
  museus: '#3498DB',
  miradouros: '#27AE60',
  praias: '#1ABC9C',
  parques: '#2ECC71',
  aldeias: '#E74C3C',
  gastronomia: '#F39C12',
  vinhos: '#8E44AD',
  default: '#C49A6C',
};

interface MapItem {
  id: string;
  name: string;
  category: string;
  region: string;
  location: { lat: number; lng: number };
  description?: string;
}

interface GoogleMapComponentProps {
  onItemPress?: (item: MapItem) => void;
  style?: any;
}

export function GoogleMapComponent({ onItemPress, style }: GoogleMapComponentProps) {
  console.log('[GoogleMapComponent] Rendering component');
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [itemCount, setItemCount] = useState(0);

  // Load Google Maps script
  useEffect(() => {
    const loadGoogleMaps = () => {
      return new Promise<void>((resolve, reject) => {
        if (window.google && window.google.maps) {
          resolve();
          return;
        }

        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Google Maps'));
        document.head.appendChild(script);
      });
    };

    const initMap = async () => {
      try {
        await loadGoogleMaps();
        
        if (!mapRef.current) return;

        // Create map
        const map = new window.google.maps.Map(mapRef.current, {
          center: PT_CENTER,
          zoom: PT_ZOOM,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        });

        googleMapRef.current = map;

        // Fetch and display items
        const response = await fetch(`${API_BASE}/map/items`);
        if (!response.ok) throw new Error('Failed to fetch items');
        
        const items: MapItem[] = await response.json();
        console.log('[GoogleMap] Fetched', items.length, 'items');
        setItemCount(items.length);

        // Create markers
        const bounds = new window.google.maps.LatLngBounds();
        
        items.forEach((item) => {
          if (!item.location?.lat || !item.location?.lng) return;
          
          const position = { lat: item.location.lat, lng: item.location.lng };
          bounds.extend(position);

          const color = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.default;
          
          const marker = new window.google.maps.Marker({
            position,
            map,
            title: item.name,
            icon: {
              path: window.google.maps.SymbolPath.CIRCLE,
              fillColor: color,
              fillOpacity: 0.9,
              strokeColor: '#ffffff',
              strokeWeight: 2,
              scale: 8,
            },
          });

          // Info window on click
          const infoWindow = new window.google.maps.InfoWindow({
            content: `
              <div style="padding: 8px; max-width: 200px;">
                <h3 style="margin: 0 0 4px 0; font-size: 14px; color: #264E41;">${item.name}</h3>
                <p style="margin: 0; font-size: 12px; color: #666; text-transform: capitalize;">${item.category?.replace(/_/g, ' ')} • ${item.region}</p>
              </div>
            `,
          });

          marker.addListener('click', () => {
            infoWindow.open(map, marker);
            onItemPress?.(item);
          });

          markersRef.current.push(marker);
        });

        // Fit bounds to show Portugal
        if (items.length > 0) {
          // Keep focused on Portugal continental
          map.setCenter(PT_CENTER);
          map.setZoom(PT_ZOOM);
        }

        setLoading(false);
      } catch (err: any) {
        console.error('[GoogleMap] Error:', err);
        setError(err.message || 'Erro ao carregar o mapa');
        setLoading(false);
      }
    };

    initMap();

    return () => {
      // Cleanup markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, [onItemPress]);

  if (error) {
    return (
      <View style={[styles.container, styles.center, style]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#C49A6C" />
          <Text style={styles.loadingText}>A carregar mapa...</Text>
        </View>
      )}
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
        }} 
      />
      {!loading && itemCount > 0 && (
        <View style={styles.counter}>
          <Text style={styles.counterText}>📍 {itemCount} locais</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(250, 248, 245, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorText: {
    fontSize: 14,
    color: '#E74C3C',
    textAlign: 'center',
    padding: 20,
  },
  counter: {
    position: 'absolute',
    top: 10,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: 'rgba(38, 78, 65, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 5,
  },
  counterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

// Type declaration for Google Maps
declare global {
  interface Window {
    google: any;
  }
}

export default GoogleMapComponent;
