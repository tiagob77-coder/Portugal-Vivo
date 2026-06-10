/**
 * Tests for the gastronomy adapter — pins the backend→CoastalDish mapping
 * (type/technique enums, month-array→range with wrap, iq 0–100→0–1) and the
 * merge policy (static curated base, enriched-only backend extras, name dedup).
 */
import {
  BackendGastronomyItem,
  mapGastronomyItem,
  mergeDishes,
  monthsToRange,
  normaliseName,
} from '../gastronomyAdapter';

const backend = (over: Partial<BackendGastronomyItem>): BackendGastronomyItem => ({
  id: 'g_x',
  name: 'Prato Teste',
  type: 'prato',
  region: 'Algarve',
  seasonality: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  techniques: ['guisado'],
  description: 'desc',
  iq_score: 90,
  ...over,
});

describe('normaliseName', () => {
  it('strips accents and case for dedup', () => {
    expect(normaliseName('Amêijoas à Bulhão Pato')).toBe('ameijoas a bulhao pato');
    expect(normaliseName('  Caldo Verde ')).toBe('caldo verde');
  });
});

describe('monthsToRange', () => {
  it('returns undefined for year-round, empty or missing', () => {
    expect(monthsToRange([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBeUndefined();
    expect(monthsToRange([])).toBeUndefined();
    expect(monthsToRange(undefined)).toBeUndefined();
  });

  it('maps a contiguous run', () => {
    expect(monthsToRange([3, 4, 5, 6, 7, 8])).toEqual({ start_month: 3, end_month: 8 });
  });

  it('handles wrap-around runs (Nov–Mar)', () => {
    expect(monthsToRange([11, 12, 1, 2, 3])).toEqual({ start_month: 11, end_month: 3 });
  });

  it('handles a single month', () => {
    expect(monthsToRange([6])).toEqual({ start_month: 6, end_month: 6 });
  });

  it('ignores out-of-range values', () => {
    expect(monthsToRange([0, 13, 6, 7])).toEqual({ start_month: 6, end_month: 7 });
  });
});

describe('mapGastronomyItem', () => {
  it('maps enums into card-safe values', () => {
    const dish = mapGastronomyItem(
      backend({ type: 'queijo', techniques: ['curado'] }),
    );
    expect(dish.type).toBe('tradicional'); // queijo has no tab of its own
    expect(dish.recipe_type).toBe('fumado'); // curado → valid RECIPE_LABEL key
  });

  it('falls back to tradicional/guisado for unknown enums', () => {
    const dish = mapGastronomyItem(
      backend({ type: 'inexistente', techniques: ['fermentado'] }),
    );
    expect(dish.type).toBe('tradicional');
    expect(dish.recipe_type).toBe('guisado');
  });

  it('rescales iq_score from 0–100 to 0–1 (card multiplies by 100)', () => {
    expect(mapGastronomyItem(backend({ iq_score: 97 })).iq_score).toBeCloseTo(0.97);
    expect(mapGastronomyItem(backend({ iq_score: 0.8 })).iq_score).toBeCloseTo(0.8);
    expect(mapGastronomyItem(backend({ iq_score: 0 })).iq_score).toBeUndefined();
  });

  it('derives environmental_status from sustainability_score', () => {
    expect(mapGastronomyItem(backend({ sustainability_score: 85 })).environmental_status).toBe('seguro');
    expect(mapGastronomyItem(backend({ sustainability_score: 55 })).environmental_status).toBe('moderado');
    expect(mapGastronomyItem(backend({ sustainability_score: 20 })).environmental_status).toBe('risco');
    expect(mapGastronomyItem(backend({ sustainability_score: 0 })).environmental_status).toBeUndefined();
  });

  it('prefers subregion for the region label and description for story_short', () => {
    const dish = mapGastronomyItem(
      backend({ region: 'Algarve', subregion: 'Ria Formosa', description: 'd', cultural_context: 'c' }),
    );
    expect(dish.region).toBe('Ria Formosa');
    expect(dish.story_short).toBe('d');
    expect(dish.story_long).toBe('c');
  });
});

describe('mergeDishes', () => {
  const staticDishes = [
    mapGastronomyItem(backend({ id: 's1', name: 'Caldeirada de Peixe' })),
  ];

  it('returns static list untouched when backend is empty/missing', () => {
    expect(mergeDishes(staticDishes, undefined)).toBe(staticDishes);
    expect(mergeDishes(staticDishes, [])).toBe(staticDishes);
  });

  it('appends new enriched backend items after the static base', () => {
    const out = mergeDishes(staticDishes, [
      backend({ id: 'g_new', name: 'Queijo Serra da Estrela', enriched: true }),
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('s1'); // static stays first
    expect(out[1].name).toBe('Queijo Serra da Estrela');
  });

  it('dedupes by accent-insensitive name (static wins)', () => {
    const out = mergeDishes(staticDishes, [
      backend({ id: 'g_dup', name: 'caldeirada de peixe', enriched: true }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('s1');
  });

  it('excludes lite ingest rows (enriched === false)', () => {
    const out = mergeDishes(staticDishes, [
      backend({ id: 'g_lite', name: 'Prato Lite', enriched: false }),
      backend({ id: 'g_ok', name: 'Prato Curado', enriched: true }),
    ]);
    expect(out.map((d) => d.id)).toEqual(['s1', 'g_ok']);
  });
});
