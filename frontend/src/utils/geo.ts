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
