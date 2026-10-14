/**
 * Utilitários geográficos partilhados pelo frontend.
 *
 * O backend tem a sua própria Haversine em Python; esta é a contraparte para
 * cálculos locais (distância a destaques, ordenação de POIs próximos) sem ida
 * ao servidor.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Distância em quilómetros entre dois pontos (Haversine). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/**
 * Distância legível em PT-PT.
 *
 * Abaixo de 1 km mostra metros arredondados à centena; acima, quilómetros
 * inteiros (com uma casa decimal até 10 km, onde a precisão ainda importa).
 */
export function formatDistance(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '';
  if (km < 1) {
    const metres = Math.round((km * 1000) / 50) * 50;
    return metres < 50 ? 'a menos de 50 m' : `a ${metres} m`;
  }
  if (km < 10) return `a ${km.toFixed(1).replace('.', ',')} km`;
  return `a ${Math.round(km)} km`;
}

/** Os `limit` pontos mais próximos de `origin`, já com a distância calculada. */
export function nearest<T extends LatLng>(
  origin: LatLng,
  points: T[],
  limit = 5,
): { point: T; km: number }[] {
  return points
    .map((point) => ({ point, km: haversineKm(origin, point) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/**
 * Distância em km de um ponto ao segmento [a, b].
 *
 * Usa projeção equirretangular local: a poucas dezenas de km o erro é
 * desprezável e evita a trigonometria da Haversine dentro de um ciclo que corre
 * por milhares de POIs × dezenas de segmentos.
 */
export function distanceToSegmentKm(point: LatLng, a: LatLng, b: LatLng): number {
  // Escala de graus → km à latitude média do segmento
  const kx = 111.32 * Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const ky = 110.57;

  const dx = (b.lng - a.lng) * kx;
  const dy = (b.lat - a.lat) * ky;
  const qx = (point.lng - a.lng) * kx;
  const qy = (point.lat - a.lat) * ky;

  const lenSq = dx * dx + dy * dy;
  // Segmento degenerado (a === b) → distância ao próprio ponto
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, (qx * dx + qy * dy) / lenSq));

  const ex = qx - t * dx;
  const ey = qy - t * dy;
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Distância em km de um ponto a uma polilinha (o eixo de uma estrada).
 *
 * Devolve Infinity para polilinhas com menos de 2 pontos.
 */
export function distanceToPathKm(point: LatLng, path: LatLng[]): number {
  if (path.length < 2) return Infinity;
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = distanceToSegmentKm(point, path[i - 1], path[i]);
    if (d < best) best = d;
    if (best <= 1) break; // já suficientemente perto — não vale afinar mais
  }
  return best;
}

/** Pontos a menos de `widthKm` do eixo, com o desvio calculado. */
export function withinCorridor<T extends LatLng>(
  points: T[],
  path: LatLng[],
  widthKm: number,
): { point: T; offsetKm: number }[] {
  const out: { point: T; offsetKm: number }[] = [];
  for (const point of points) {
    const offsetKm = distanceToPathKm(point, path);
    if (offsetKm <= widthKm) out.push({ point, offsetKm });
  }
  return out;
}
