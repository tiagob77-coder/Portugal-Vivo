/**
 * Tests for routeUtils — pins the MAP-008 fix: trails opened from the Rotas
 * list start with an empty waypoint array (because /trails list excludes
 * `points`) and get filled in once the /trails/{id} detail resolves.
 */
import {
  buildTrailShellRoute,
  hydrateTrailWaypoints,
  trailPointsToWaypoints,
} from '../routeUtils';
import type { RouteDetail } from '../RouteDetailSheet';

// ── buildTrailShellRoute ─────────────────────────────────────────────────────

describe('buildTrailShellRoute', () => {
  const trail = {
    id: 't1',
    name: 'PR1 - Serra da Estrela',
    description: 'desc',
    distance_km: 12.4,
    estimated_hours: 4.5,
    difficulty: 'moderado',
    elevation_gain: 600,
    color: '#22C55E',
  };

  it('marks the route as a trail with empty waypoints', () => {
    const out = buildTrailShellRoute(trail);
    expect(out.type).toBe('trail');
    expect(out.waypoints).toEqual([]);
  });

  it('passes the visible metadata through', () => {
    const out = buildTrailShellRoute(trail);
    expect(out.name).toBe('PR1 - Serra da Estrela');
    expect(out.description_short).toBe('desc');
    expect(out.distance_km).toBe(12.4);
    expect(out.duration_hours).toBe(4.5);
    expect(out.difficulty).toBe('moderado');
    expect(out.elevation_gain).toBe(600);
    expect(out.color).toBe('#22C55E');
  });

  it('defaults the color when missing so the polyline is never undefined', () => {
    const out = buildTrailShellRoute({ ...trail, color: undefined });
    expect(out.color).toBe('#22C55E');
  });
});

// ── trailPointsToWaypoints ──────────────────────────────────────────────────

describe('trailPointsToWaypoints', () => {
  it('maps each point with a 1-based order', () => {
    const out = trailPointsToWaypoints([
      { lat: 1, lng: 2 },
      { lat: 3, lng: 4 },
    ]);
    expect(out).toEqual([
      { lat: 1, lng: 2, name: 'Ponto 1', order: 1 },
      { lat: 3, lng: 4, name: 'Ponto 2', order: 2 },
    ]);
  });

  it('preserves a point name when present', () => {
    const out = trailPointsToWaypoints([{ lat: 1, lng: 2, name: 'Start' }]);
    expect(out[0].name).toBe('Start');
  });
});

// ── hydrateTrailWaypoints ──────────────────────────────────────────────────

describe('hydrateTrailWaypoints', () => {
  const shell = (overrides: Partial<RouteDetail> = {}): RouteDetail => ({
    name: 'X', type: 'trail', waypoints: [], color: '#22C55E', ...overrides,
  });
  const points = [
    { lat: 1, lng: 2 },
    { lat: 3, lng: 4 },
  ];

  it('returns null when selectedRoute is null', () => {
    expect(hydrateTrailWaypoints(null, points)).toBeNull();
  });

  it('returns null for non-trail routes (cultural/passadico/etc)', () => {
    // Cultural routes carry their own stops; they must NOT be overwritten.
    const cultural = shell({ type: 'cultural' });
    expect(hydrateTrailWaypoints(cultural, points)).toBeNull();
  });

  it('returns null when the trail already has waypoints', () => {
    const already = shell({
      waypoints: [{ lat: 1, lng: 2, name: 'P1', order: 1 }],
    });
    expect(hydrateTrailWaypoints(already, points)).toBeNull();
  });

  it('returns null when points are undefined (detail not yet resolved)', () => {
    expect(hydrateTrailWaypoints(shell(), undefined)).toBeNull();
  });

  it('returns null when points is not an array (defensive against API shape drift)', () => {
    expect(hydrateTrailWaypoints(shell(), 'garbage' as any)).toBeNull();
  });

  it('returns null when fewer than 2 points (cannot draw a polyline)', () => {
    expect(hydrateTrailWaypoints(shell(), [{ lat: 1, lng: 2 }])).toBeNull();
  });

  it('hydrates waypoints for a trail with at least 2 points', () => {
    const out = hydrateTrailWaypoints(shell(), points);
    expect(out).not.toBeNull();
    expect(out!.waypoints).toHaveLength(2);
    expect(out!.waypoints[0].order).toBe(1);
    expect(out!.waypoints[1].order).toBe(2);
  });

  it('preserves the rest of the shell (color, distance, etc) on hydration', () => {
    const original = shell({ distance_km: 12.4, color: '#FF0000', difficulty: 'dificil' });
    const out = hydrateTrailWaypoints(original, points)!;
    expect(out.color).toBe('#FF0000');
    expect(out.distance_km).toBe(12.4);
    expect(out.difficulty).toBe('dificil');
  });

  it('does not mutate the input selectedRoute (React state guarantee)', () => {
    const input = shell();
    hydrateTrailWaypoints(input, points);
    expect(input.waypoints).toEqual([]);
  });
});
