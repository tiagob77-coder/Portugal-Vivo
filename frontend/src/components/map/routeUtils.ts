/**
 * Pure helpers for the Rotas mode flow. Extracted from mapa.tsx so the
 * MAP-008 fix (trail-list selection had no geometry because the /trails
 * list endpoint excludes the `points` field) is unit-testable.
 */
import type { RouteDetail, RouteWaypoint } from './RouteDetailSheet';

export interface TrailListItem {
  id: string;
  name: string;
  description?: string;
  distance_km?: number;
  estimated_hours?: number;
  difficulty?: string;
  elevation_gain?: number;
  color?: string;
}

export interface TrailPoint {
  lat: number;
  lng: number;
  name?: string;
  ele?: number;
}

/** Build the shell RouteDetail emitted when the user taps a trail in the
 *  Rotas list. Geometry is left empty; hydrateTrailWaypoints fills it once
 *  the detail fetch resolves. */
export function buildTrailShellRoute(trail: TrailListItem): RouteDetail {
  return {
    name: trail.name,
    type: 'trail',
    description_short: trail.description,
    distance_km: trail.distance_km,
    duration_hours: trail.estimated_hours,
    difficulty: trail.difficulty,
    elevation_gain: trail.elevation_gain,
    color: trail.color || '#22C55E',
    waypoints: [],
  };
}

/** Map a list of GPX points (from /trails/{id}) onto the waypoint shape
 *  the map polyline + numbered markers expect. */
export function trailPointsToWaypoints(points: TrailPoint[]): RouteWaypoint[] {
  return points.map((p, i) => ({
    lat: p.lat,
    lng: p.lng,
    name: p.name || `Ponto ${i + 1}`,
    order: i + 1,
  }));
}

/** Decide whether to refresh selectedRoute with hydrated waypoints. Returns
 *  the new RouteDetail to commit, or null when no change is needed (route
 *  not a trail / already hydrated / detail not ready / detail too short). */
export function hydrateTrailWaypoints(
  selectedRoute: RouteDetail | null,
  points: TrailPoint[] | undefined,
): RouteDetail | null {
  if (!selectedRoute || selectedRoute.type !== 'trail') return null;
  if (selectedRoute.waypoints.length > 0) return null;
  if (!Array.isArray(points) || points.length < 2) return null;
  return { ...selectedRoute, waypoints: trailPointsToWaypoints(points) };
}
