/**
 * Gastronomy adapter — maps backend `gastronomy_items` documents into the
 * frontend `CoastalDish` shape consumed by GastronomyDishCard.
 *
 * The two models differ fundamentally (see PR #206): type enums, seasonality
 * as month-array vs {start,end}, iq_score 0–100 vs 0–1, and narrative fields
 * under different names. The static DISHES_DATA is also *richer* than the
 * backend seed (species_related, best_restaurants), so we never replace it —
 * `mergeDishes` keeps the curated static list as the base and appends backend
 * items (enriched only) that aren't already present, deduped by normalised
 * name. Pure functions, unit-tested.
 */
import { CoastalDish } from '../components/GastronomyDishCard';

export interface BackendGastronomyItem {
  id: string;
  name: string;
  type?: string;
  region?: string;
  subregion?: string;
  seasonality?: number[];
  ingredients?: string[];
  techniques?: string[];
  description?: string;
  cultural_context?: string;
  sustainability_score?: number;
  iq_score?: number;
  enriched?: boolean;
}

// Backend type → CoastalDish.type (tabs filter on these; unknown → tradicional
// so the dish still shows under "Todos" and "Tradicionais").
const TYPE_MAP: Record<string, CoastalDish['type']> = {
  peixe: 'peixe',
  marisco: 'marisco',
  sopa: 'sopa',
  doce: 'doce',
  prato: 'tradicional',
  queijo: 'tradicional',
  vinho: 'tradicional',
};

// Backend technique → CoastalDish.recipe_type (feeds RECIPE_LABEL chip; must
// always be a valid enum value or the card renders an undefined label).
const TECHNIQUE_MAP: Record<string, CoastalDish['recipe_type']> = {
  guisado: 'guisado',
  estufado: 'guisado',
  cataplana: 'guisado',
  cozido: 'guisado',
  assado: 'assado',
  forno: 'assado',
  grelhado: 'assado',
  frito: 'frito',
  mexido: 'frito',
  escabeche: 'escabeche',
  caldeirada: 'caldeirada',
  cru: 'cru',
  fumado: 'fumado',
  curado: 'fumado',
};

/** Strip accents + lowercase for name-based dedup. */
export function normaliseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Month array → contiguous {start_month, end_month}, handling wrap-around
 * (e.g. [11,12,1,2,3] → {11,3}). Year-round or empty → undefined (the card
 * hides the seasonality strip, which reads better than highlighting all 12).
 */
export function monthsToRange(
  months: number[] | undefined,
): CoastalDish['seasonality'] {
  if (!Array.isArray(months) || months.length === 0 || months.length >= 12) {
    return undefined;
  }
  const sorted = [...new Set(months)].filter((m) => m >= 1 && m <= 12).sort((a, b) => a - b);
  if (sorted.length === 0) return undefined;
  if (sorted.length >= 12) return undefined;

  // Find the largest gap between consecutive months (cyclically); the range
  // starts right after that gap.
  let maxGap = -1;
  let startIdx = 0;
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const next = sorted[(i + 1) % sorted.length];
    const gap = (next - current + 12) % 12;
    if (gap > maxGap) {
      maxGap = gap;
      startIdx = (i + 1) % sorted.length;
    }
  }
  const start = sorted[startIdx];
  const end = sorted[(startIdx - 1 + sorted.length) % sorted.length];
  return { start_month: start, end_month: end };
}

/** Map one backend item into the CoastalDish shape the card renders. */
export function mapGastronomyItem(item: BackendGastronomyItem): CoastalDish {
  const technique = (item.techniques || []).map((t) => TECHNIQUE_MAP[t]).find(Boolean);
  const sust = item.sustainability_score ?? 0;
  const rawIq = item.iq_score;
  return {
    id: item.id,
    name: item.name,
    region: item.subregion || item.region || '',
    type: TYPE_MAP[item.type || ''] || 'tradicional',
    recipe_type: technique || 'guisado',
    seasonality: monthsToRange(item.seasonality),
    story_short: item.description || item.cultural_context || '',
    story_long:
      item.cultural_context && item.cultural_context !== item.description
        ? item.cultural_context
        : undefined,
    ingredients: item.ingredients?.length ? item.ingredients : undefined,
    environmental_status:
      sust >= 70 ? 'seguro' : sust >= 40 ? 'moderado' : sust > 0 ? 'risco' : undefined,
    // Backend scores are 0–100; the card multiplies by 100 (expects 0–1).
    iq_score:
      typeof rawIq === 'number' && rawIq > 0
        ? rawIq > 1
          ? Math.min(rawIq / 100, 1)
          : rawIq
        : undefined,
  };
}

/**
 * Curated static dishes first (richer), then enriched backend items not
 * already present by normalised name. Lite ingest rows (enriched === false)
 * are excluded — they only carry name + coords and would render empty cards.
 */
export function mergeDishes(
  staticDishes: CoastalDish[],
  backendItems: BackendGastronomyItem[] | undefined,
): CoastalDish[] {
  if (!Array.isArray(backendItems) || backendItems.length === 0) {
    return staticDishes;
  }
  const seen = new Set(staticDishes.map((d) => normaliseName(d.name)));
  const extras: CoastalDish[] = [];
  for (const item of backendItems) {
    if (item.enriched === false) continue;
    if (!item?.name) continue;
    const key = normaliseName(item.name);
    if (seen.has(key)) continue;
    seen.add(key);
    extras.push(mapGastronomyItem(item));
  }
  return [...staticDishes, ...extras];
}
