/**
 * Grid clustering for native map markers — dependency-free.
 *
 * react-native-maps has no built-in clustering, so dense categories render
 * thousands of <Marker>s and jank the map. This groups points into a grid whose
 * cell size scales with the visible region (zoom): zoomed out → big cells → few
 * clusters; zoomed in → small cells → points separate into individual markers.
 *
 * Render cost is bounded by the grid (≤ gridDivisions² markers) regardless of
 * input size. Pure + deterministic so it can be unit-tested.
 */
export interface ClusterableItem {
  id: string;
  location?: { lat: number; lng: number } | null;
}

export interface MarkerCluster<T> {
  id: string;
  lat: number;
  lng: number;
  count: number;
  items: T[];
}

const DEFAULT_DELTA = 6; // Portugal-wide fallback when a region delta is missing

export function clusterMarkers<T extends ClusterableItem>(
  items: T[],
  latDelta: number,
  lngDelta: number,
  gridDivisions = 12,
): MarkerCluster<T>[] {
  const cellLat = (latDelta > 0 ? latDelta : DEFAULT_DELTA) / gridDivisions;
  const cellLng = (lngDelta > 0 ? lngDelta : DEFAULT_DELTA) / gridDivisions;

  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const loc = item.location;
    if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') continue;
    const cy = Math.floor(loc.lat / cellLat);
    const cx = Math.floor(loc.lng / cellLng);
    const key = `${cy}:${cx}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const clusters: MarkerCluster<T>[] = [];
  for (const [key, group] of buckets) {
    let sumLat = 0;
    let sumLng = 0;
    for (const it of group) {
      sumLat += it.location!.lat;
      sumLng += it.location!.lng;
    }
    clusters.push({
      id: group.length === 1 ? group[0].id : `cluster_${key}`,
      lat: sumLat / group.length,
      lng: sumLng / group.length,
      count: group.length,
      items: group,
    });
  }
  return clusters;
}
