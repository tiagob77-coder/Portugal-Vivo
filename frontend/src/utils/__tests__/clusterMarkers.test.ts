import { clusterMarkers, ClusterableItem } from '../clusterMarkers';

const p = (id: string, lat: number, lng: number): ClusterableItem => ({
  id,
  location: { lat, lng },
});

describe('clusterMarkers', () => {
  it('returns one single-item cluster per point when far apart', () => {
    const items = [p('a', 41.0, -8.0), p('b', 37.0, -8.5)];
    const clusters = clusterMarkers(items, 6, 6, 12);
    expect(clusters).toHaveLength(2);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
    // single-item clusters keep the original id (so they render as normal markers)
    expect(clusters.map((c) => c.id).sort()).toEqual(['a', 'b']);
  });

  it('groups nearby points into one cluster at low zoom', () => {
    // cell size = 6/12 = 0.5; these three sit well inside one cell (not on a
    // 0.5 boundary) so they group together.
    const items = [
      p('a', 41.10, -8.10),
      p('b', 41.11, -8.11),
      p('c', 41.12, -8.12),
    ];
    const clusters = clusterMarkers(items, 6, 6, 12); // big cells
    expect(clusters).toHaveLength(1);
    expect(clusters[0].count).toBe(3);
    expect(clusters[0].id).toContain('cluster_');
    // centroid is the average position
    expect(clusters[0].lat).toBeCloseTo(41.11, 3);
    expect(clusters[0].lng).toBeCloseTo(-8.11, 3);
  });

  it('separates the same points into individual markers at high zoom', () => {
    const items = [
      p('a', 41.000, -8.000),
      p('b', 41.05, -8.05),
      p('c', 41.10, -8.10),
    ];
    // small deltas → small cells → points fall into distinct cells
    const clusters = clusterMarkers(items, 0.2, 0.2, 12);
    expect(clusters).toHaveLength(3);
    expect(clusters.every((c) => c.count === 1)).toBe(true);
  });

  it('render count is bounded by the grid regardless of input size', () => {
    const items = Array.from({ length: 5000 }, (_, i) =>
      p(`x${i}`, 39 + (i % 50) * 0.0001, -8 + (i % 50) * 0.0001),
    );
    const clusters = clusterMarkers(items, 6, 6, 12);
    expect(clusters.length).toBeLessThanOrEqual(12 * 12);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(5000); // no points lost
  });

  it('skips items without valid coordinates', () => {
    const items: ClusterableItem[] = [
      p('a', 41, -8),
      { id: 'b', location: null },
      { id: 'c', location: undefined },
      { id: 'd', location: { lat: NaN as any, lng: -8 } as any },
    ];
    const clusters = clusterMarkers(items, 0.2, 0.2, 12);
    const total = clusters.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(1);
  });

  it('falls back to a sane cell size when delta is 0', () => {
    const items = [p('a', 41, -8), p('b', 37, -8)];
    expect(() => clusterMarkers(items, 0, 0, 12)).not.toThrow();
    const clusters = clusterMarkers(items, 0, 0, 12);
    expect(clusters.length).toBe(2);
  });
});
