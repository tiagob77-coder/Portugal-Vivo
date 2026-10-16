/**
 * Consultas sobre os pacotes de região descarregados.
 *
 * Respondem às mesmas perguntas que os endpoints da API (`/heritage`,
 * `/map/items`, `/proximity/nearby`, `/routes`…) usando só o que está no
 * dispositivo, para a app continuar útil sem rede. São funções puras: recebem
 * os pacotes e devolvem resultados, sem I/O.
 */
import type { Category, HeritageItem, Route } from '../types';
import { haversineKm } from '../utils/geo';

/** O que um pacote de região precisa de ter para ser consultado. */
export interface QueryablePackage {
  heritage_items: HeritageItem[];
  routes: Route[];
  categories: Category[];
}

export interface PoiQuery {
  category?: string;
  /** Lista de categorias (o mapa pede várias de uma vez). */
  categories?: string[];
  region?: string;
  search?: string;
  limit?: number;
  skip?: number;
}

export interface RouteQuery {
  category?: string;
  region?: string;
}

export interface NearbyOfflinePoi extends HeritageItem {
  distance_km: number;
  direction: string;
}

const sameText = (a: string | undefined, b: string) =>
  (a ?? '').toLocaleLowerCase('pt') === b.toLocaleLowerCase('pt');

const contains = (haystack: string | undefined, needle: string) =>
  (haystack ?? '').toLocaleLowerCase('pt').includes(needle);

/** Todos os POIs dos pacotes, sem repetidos (regiões vizinhas podem partilhar). */
export function allPois(packages: QueryablePackage[]): HeritageItem[] {
  const seen = new Set<string>();
  const out: HeritageItem[] = [];
  for (const pkg of packages) {
    for (const poi of pkg.heritage_items ?? []) {
      if (!poi?.id || seen.has(poi.id)) continue;
      seen.add(poi.id);
      out.push(poi);
    }
  }
  return out;
}

export function findPoi(packages: QueryablePackage[], id: string): HeritageItem | null {
  for (const pkg of packages) {
    const hit = pkg.heritage_items?.find((p) => p.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Equivalente offline de GET /heritage (e de /map/items com `categories`). */
export function queryPois(packages: QueryablePackage[], q: PoiQuery = {}): HeritageItem[] {
  const wanted = q.categories?.length ? new Set(q.categories) : null;
  const needle = q.search?.trim().toLocaleLowerCase('pt');

  const matches = allPois(packages).filter((poi) => {
    if (q.category && poi.category !== q.category) return false;
    if (wanted && !wanted.has(poi.category)) return false;
    if (q.region && !sameText(poi.region, q.region)) return false;
    if (needle) {
      const inTags = (poi.tags ?? []).some((t) => contains(t, needle));
      if (!contains(poi.name, needle) && !contains(poi.description, needle) && !inTags) return false;
    }
    return true;
  });

  const skip = Math.max(0, q.skip ?? 0);
  return q.limit ? matches.slice(skip, skip + q.limit) : matches.slice(skip);
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

/** Rumo aproximado (8 pontos, PT) de `from` para `to`. */
export function compassDirection(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return COMPASS[Math.round(((bearing + 360) % 360) / 45) % 8];
}

/** Equivalente offline de GET /proximity/nearby: ordenado por distância. */
export function nearbyPois(
  packages: QueryablePackage[],
  origin: { lat: number; lng: number },
  radiusKm: number,
  opts: { category?: string; limit?: number } = {},
): NearbyOfflinePoi[] {
  const out: NearbyOfflinePoi[] = [];
  for (const poi of allPois(packages)) {
    if (!poi.location) continue;
    if (opts.category && poi.category !== opts.category) continue;
    const km = haversineKm(origin, poi.location);
    if (km > radiusKm) continue;
    out.push({
      ...poi,
      distance_km: Math.round(km * 100) / 100,
      direction: compassDirection(origin, poi.location),
    });
  }
  out.sort((a, b) => a.distance_km - b.distance_km);
  return opts.limit ? out.slice(0, opts.limit) : out;
}

export function findRoute(packages: QueryablePackage[], id: string): Route | null {
  for (const pkg of packages) {
    const hit = pkg.routes?.find((r) => r.id === id);
    if (hit) return hit;
  }
  return null;
}

/** Equivalente offline de GET /routes. */
export function queryRoutes(packages: QueryablePackage[], q: RouteQuery = {}): Route[] {
  const seen = new Set<string>();
  const out: Route[] = [];
  for (const pkg of packages) {
    for (const route of pkg.routes ?? []) {
      if (!route?.id || seen.has(route.id)) continue;
      if (q.category && route.category !== q.category) continue;
      if (q.region && !sameText(route.region, q.region)) continue;
      seen.add(route.id);
      out.push(route);
    }
  }
  return out;
}

/** POIs de uma rota, pela ordem da rota; ignora os que não estão descarregados. */
export function routeItems(packages: QueryablePackage[], routeId: string): HeritageItem[] | null {
  const route = findRoute(packages, routeId);
  if (!route) return null;
  return (route.items ?? [])
    .map((id) => findPoi(packages, id))
    .filter((poi): poi is HeritageItem => poi !== null);
}

/** Categorias guardadas no primeiro pacote que as tenha (são globais). */
export function packageCategories(packages: QueryablePackage[]): Category[] | null {
  const pkg = packages.find((p) => p.categories?.length);
  return pkg ? pkg.categories : null;
}
