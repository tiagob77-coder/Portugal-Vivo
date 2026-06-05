/**
 * NativeMap.native.tsx — Native map using react-native-maps
 *
 * Loaded by Metro bundler for iOS and Android.
 * Supports: POI markers, route polylines, numbered waypoint markers, fitBounds.
 */
import { palette } from '../theme/colors';
import React, { useEffect } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import MapView, { Marker, Callout, Polyline, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from 'react-native-maps';
import type { MapItem, LeafletMapProps, WaypointMarker } from './NativeMap.types';

// Re-export types
export type { MapItem, LeafletMapProps, WaypointMarker };

// Re-export components
export { Marker, Callout, Polyline, PROVIDER_GOOGLE };

export const isMapAvailable = true;

const PORTUGAL_REGION = {
  latitude: 39.5,
  longitude: -8.0,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

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

export function LeafletMapComponent({
  items = [],
  onItemPress,
  getMarkerColor,
  mapMode = 'light',
  trailPoints,
  trailColor = '#22C55E',
  waypoints,
  style,
  onMapReady,
  ...props
}: LeafletMapProps) {
  const mapRef = React.useRef<MapView>(null);
  const safeItems = Array.isArray(items) ? items : [];

  const validItems = safeItems.filter(
    item => item?.location?.lat && item?.location?.lng &&
    Math.abs(item.location.lat) <= 90 &&
    Math.abs(item.location.lng) <= 180
  );

  const isDark = mapMode === 'dark' || mapMode === 'noturno';
  const provider = Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT;

  // Auto-fitBounds to waypoints when they change
  useEffect(() => {
    if (!mapRef.current) return;
    const wps: WaypointMarker[] = Array.isArray(waypoints) ? waypoints : [];
    if (wps.length > 0) {
      const coords = wps.map(wp => ({ latitude: wp.lat, longitude: wp.lng }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 320, left: 40 },
        animated: true,
      });
      return;
    }
    // Fallback to trailPoints
    if (trailPoints && trailPoints.length > 1) {
      const coords = trailPoints.map(p => ({ latitude: p.lat, longitude: p.lng }));
      mapRef.current.fitToCoordinates(coords, {
        edgePadding: { top: 80, right: 40, bottom: 240, left: 40 },
        animated: true,
      });
    }
  }, [waypoints, trailPoints]);

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
        onMapReady={() => onMapReady?.()}
        mapPadding={{ top: 0, right: 0, bottom: 100, left: 0 }}
        {...props}
      >
        {/* POI markers */}
        {validItems.map((item) => (
          <Marker
            key={item.id}
            coordinate={{ latitude: item.location.lat, longitude: item.location.lng }}
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

        {/* Trail polyline (from raw trailPoints — no named waypoints) */}
        {trailPoints && trailPoints.length > 1 && (
          <Polyline
            coordinates={trailPoints.map(p => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={trailColor}
            strokeWidth={5}
          />
        )}

        {/* Route polyline through named waypoints */}
        {Array.isArray(waypoints) && waypoints.length > 1 && (
          <Polyline
            coordinates={waypoints
              .sort((a, b) => a.order - b.order)
              .map(wp => ({ latitude: wp.lat, longitude: wp.lng }))}
            strokeColor={trailColor}
            strokeWidth={5}
          />
        )}

        {/* Numbered waypoint markers */}
        {Array.isArray(waypoints) && waypoints.map((wp) => (
          <Marker
            key={`wp-${wp.order}`}
            coordinate={{ latitude: wp.lat, longitude: wp.lng }}
            tracksViewChanges={false}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={[styles.waypointMarker, { backgroundColor: trailColor }]}>
              <Text style={styles.waypointNum}>{wp.order}</Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

export default MapView;

const styles = StyleSheet.create({
  container: { flex: 1, overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },
  markerOuter: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: palette.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 4,
    borderWidth: 2, borderColor: palette.white,
  },
  markerInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.white },
  waypointMarker: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: palette.white,
    shadowColor: palette.black, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 5,
  },
  waypointNum: { fontSize: 12, fontWeight: '700', color: palette.white },
  calloutContainer: {
    backgroundColor: palette.forest[600], borderRadius: 12,
    padding: 12, minWidth: 180, maxWidth: 250,
  },
  calloutTitle: { fontSize: 14, fontWeight: '600', color: palette.white, marginBottom: 4 },
  calloutCategory: { fontSize: 12, color: '#C8C3B8', textTransform: 'capitalize', marginBottom: 6 },
  calloutAction: { fontSize: 11, color: palette.terracotta[500], fontWeight: '500' },
});
