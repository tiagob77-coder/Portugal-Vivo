/**
 * NativeMap.native.tsx — Native map using react-native-maps
 * 
 * This file is loaded by Metro bundler for iOS and Android platforms.
 * Uses Google Maps on Android and Apple Maps on iOS.
 */
import React from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import type { MapItem, LeafletMapProps } from './NativeMap.types';

console.log('[NativeMap.native.tsx] NATIVE MODULE LOADED - should NOT appear on web!');

// Re-export types for backwards compatibility
export type { MapItem, LeafletMapProps };

// Re-export components from react-native-maps
export { Marker, Callout, PROVIDER_GOOGLE };

// Map is available on native platforms
export const isMapAvailable = true;

// Default map region (Portugal)
const PORTUGAL_REGION = {
  latitude: 39.5,
  longitude: -8.0,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

// Dark map style for Google Maps
const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'administrative.country', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'administrative.province', elementType: 'geometry.stroke', stylers: [{ color: '#4b6878' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#17263c' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#515c6d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2c6675' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#283d6a' }] },
  { featureType: 'poi.park', elementType: 'geometry.fill', stylers: [{ color: '#023e58' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
];

/**
 * LeafletMapComponent - Compatibility wrapper for native map
 * 
 * On native platforms, this renders a react-native-maps MapView
 * with the same props interface as the web Leaflet version.
 */
export function LeafletMapComponent({
  items = [],
  onItemPress,
  getMarkerColor,
  mapMode = 'light',
  trailPoints,
  trailColor = '#22C55E',
  style,
  onMapReady,
  ...props
}: LeafletMapProps) {
  const mapRef = React.useRef<MapView>(null);
  const safeItems = Array.isArray(items) ? items : [];
  
  // Filter items with valid coordinates
  const validItems = safeItems.filter(
    item => item?.location?.lat && item?.location?.lng &&
    Math.abs(item.location.lat) <= 90 &&
    Math.abs(item.location.lng) <= 180
  );

  // Determine if dark mode
  const isDark = mapMode === 'dark' || mapMode === 'noturno';

  // Provider: Use Google Maps on Android for better performance
  const provider = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  return (
    <View style={[styles.container, style]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={provider}
        initialRegion={PORTUGAL_REGION}
        customMapStyle={isDark ? darkMapStyle : undefined}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        onMapReady={() => {
          onMapReady?.();
        }}
        mapPadding={{ top: 0, right: 0, bottom: 100, left: 0 }}
        {...props}
      >
        {validItems.map((item) => (
          <Marker
            key={item.id}
            coordinate={{
              latitude: item.location.lat,
              longitude: item.location.lng,
            }}
            onPress={() => onItemPress?.(item)}
            tracksViewChanges={false}
          >
            <View style={[styles.markerOuter, { backgroundColor: getMarkerColor(item.category) }]}>
              <View style={styles.markerInner} />
            </View>
            <Callout tooltip onPress={() => onItemPress?.(item)}>
              <View style={styles.calloutContainer}>
                <Text style={styles.calloutTitle} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.calloutCategory}>
                  {item.category?.replace(/_/g, ' ')} • {item.region}
                </Text>
                <Text style={styles.calloutAction}>Ver detalhes →</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

// Default export is the MapView component itself
export default MapView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerOuter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  markerInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  calloutContainer: {
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 12,
    minWidth: 180,
    maxWidth: 250,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  calloutCategory: {
    fontSize: 12,
    color: '#C8C3B8',
    textTransform: 'capitalize',
    marginBottom: 6,
  },
  calloutAction: {
    fontSize: 11,
    color: '#C49A6C',
    fontWeight: '500',
  },
});
