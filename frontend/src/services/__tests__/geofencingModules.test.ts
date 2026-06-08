/**
 * Tests for buildModuleAlerts — the pure helper that turns nearby POIs into
 * module-interest proximity alerts (cooldown + radius + interest filtering).
 */
import { buildModuleAlerts, NearbyPOI } from '../geofencing';

const poi = (over: Partial<NearbyPOI>): NearbyPOI => ({
  id: 'p1',
  name: 'POI',
  category: 'gastronomia',
  module: 'gastronomia',
  region: 'norte',
  iq_score: 0,
  distance_km: 0.3,
  distance_m: 300,
  ...over,
});

const RADIUS = 1200;
const COOLDOWN = 30 * 60 * 1000;

describe('buildModuleAlerts', () => {
  it('returns nothing when no interest modules are set', () => {
    const out = buildModuleAlerts([poi({})], [], RADIUS, new Map(), COOLDOWN, 1000);
    expect(out).toEqual([]);
  });

  it('emits an alert for a POI in an enabled module within radius', () => {
    const out = buildModuleAlerts([poi({})], ['gastronomia'], RADIUS, new Map(), COOLDOWN, 1000);
    expect(out).toHaveLength(1);
    expect(out[0].poi_id).toBe('p1');
    expect(out[0].alert_type).toBe('module');
    expect(out[0].module).toBe('gastronomia');
    expect(out[0].message).toContain('300 m');
  });

  it('filters out POIs whose module is not of interest', () => {
    const out = buildModuleAlerts(
      [poi({ module: 'fauna' })], ['gastronomia'], RADIUS, new Map(), COOLDOWN, 1000,
    );
    expect(out).toEqual([]);
  });

  it('filters out POIs beyond the radius', () => {
    const out = buildModuleAlerts(
      [poi({ distance_m: 1500 })], ['gastronomia'], RADIUS, new Map(), COOLDOWN, 1000,
    );
    expect(out).toEqual([]);
  });

  it('respects the per-POI cooldown', () => {
    const cooldowns = new Map<string, number>([['p1', 1000]]);
    // within cooldown window -> suppressed
    expect(
      buildModuleAlerts([poi({})], ['gastronomia'], RADIUS, cooldowns, COOLDOWN, 1000 + COOLDOWN - 1),
    ).toEqual([]);
    // past cooldown window -> emitted
    expect(
      buildModuleAlerts([poi({})], ['gastronomia'], RADIUS, cooldowns, COOLDOWN, 1000 + COOLDOWN + 1),
    ).toHaveLength(1);
  });

  it('skips POIs without a module tag', () => {
    const out = buildModuleAlerts(
      [poi({ module: undefined })], ['gastronomia'], RADIUS, new Map(), COOLDOWN, 1000,
    );
    expect(out).toEqual([]);
  });
});
