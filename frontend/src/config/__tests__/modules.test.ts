/**
 * Tests for the thematic module registry. Pins parity with the backend module
 * slugs (ingest_thematic_pois.py MODULE_BY_SHEET values) and the helpers used
 * by geofencing + notification settings.
 */
// Per-file in-memory AsyncStorage mock — the global jest.setup mock always
// returns null, which can't exercise the set→get round-trip below.
jest.mock('@react-native-async-storage/async-storage', () => {
  let store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
      setItem: jest.fn((k: string, v: string) => {
        store[k] = v;
        return Promise.resolve();
      }),
      removeItem: jest.fn((k: string) => {
        delete store[k];
        return Promise.resolve();
      }),
      clear: jest.fn(() => {
        store = {};
        return Promise.resolve();
      }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  MODULES,
  getModuleConfig,
  loadInterestModules,
  NOTIFICATION_PREFS_KEY,
} from '../modules';

// Every slug the backend can tag on heritage_items.module
const BACKEND_SLUGS = [
  'gastronomia', 'economia', 'saberes', 'trilhos', 'infraestrutura',
  'fauna', 'flora', 'biodiversidade', 'cultura', 'patrimonio',
  'miradouros', 'costa', 'natureza', 'termas', 'aldeias',
  'aventura', 'festas', 'rotas',
];

describe('module registry', () => {
  it('covers every backend module slug exactly once', () => {
    const slugs = MODULES.map((m) => m.slug);
    for (const s of BACKEND_SLUGS) {
      expect(slugs).toContain(s);
    }
    expect(new Set(slugs).size).toBe(slugs.length); // no duplicates
  });

  it('every module has a label, icon and colour', () => {
    for (const m of MODULES) {
      expect(m.label).toBeTruthy();
      expect(m.icon).toBeTruthy();
      expect(m.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('getModuleConfig', () => {
  it('resolves a known slug', () => {
    expect(getModuleConfig('gastronomia').label).toBe('Gastronomia');
  });

  it('falls back gracefully for unknown / nullish slugs', () => {
    const fb = getModuleConfig('does-not-exist');
    expect(fb.icon).toBe('place');
    expect(fb.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(getModuleConfig(null).label).toBe('Outros');
    expect(getModuleConfig(undefined).slug).toBe('outros');
  });
});

describe('loadInterestModules', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns [] when nothing stored', async () => {
    expect(await loadInterestModules()).toEqual([]);
  });

  it('reads interestModules from the notification prefs blob', async () => {
    await AsyncStorage.setItem(
      NOTIFICATION_PREFS_KEY,
      JSON.stringify({ interestModules: ['flora', 'fauna'], proximityEnabled: true }),
    );
    expect(await loadInterestModules()).toEqual(['flora', 'fauna']);
  });

  it('ignores malformed data', async () => {
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, 'not-json');
    expect(await loadInterestModules()).toEqual([]);
    await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify({ interestModules: 'x' }));
    expect(await loadInterestModules()).toEqual([]);
  });
});
