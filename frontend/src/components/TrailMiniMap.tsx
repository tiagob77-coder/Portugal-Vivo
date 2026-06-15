/**
 * TrailMiniMap — non-interactive preview of a trail's polyline, reusing the
 * production NativeMap/MapView (MapLibre on web, react-native-maps on native).
 * Mirrors the dual rendering used in app/(tabs)/mapa.tsx: `trailPoints` drives
 * the web map while a <Polyline> child draws the route on native. Renders
 * nothing until real geometry exists (>= 2 points), so it degrades gracefully
 * to the "Geometria por confirmar" state while geometry is being backfilled.
 */
import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Polyline } from './NativeMap';

interface TrailPoint {
  lat: number;
  lng: number;
  ele?: number;
}

interface Waypoint {
  lat: number;
  lng: number;
  name: string;
  order: number;
}

interface TrailMiniMapProps {
  points?: TrailPoint[];
  /** Optional numbered stops (e.g. cultural-route paragens) — rendered as pins. */
  waypoints?: Waypoint[];
  color?: string;
  height?: number;
}

function TrailMiniMap({ points, waypoints, color = '#22C55E', height = 200 }: TrailMiniMapProps) {
  if (!points || points.length < 2) return null;

  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const region = {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.01),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.01),
  };

  return (
    <View style={[styles.wrap, { height }]} pointerEvents="none">
      <MapView
        style={StyleSheet.absoluteFill}
        items={[]}
        getMarkerColor={() => color}
        trailPoints={points}
        trailColor={color}
        waypoints={waypoints}
        initialRegion={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        {Platform.OS !== 'web' ? (
          <Polyline
            coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))}
            strokeColor={color}
            strokeWidth={4}
          />
        ) : null}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E5E7EB',
    marginTop: 8,
  },
});

export default React.memo(TrailMiniMap);
