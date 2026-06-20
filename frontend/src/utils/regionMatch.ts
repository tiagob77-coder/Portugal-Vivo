/**
 * Region normalization for cross-linking events → thematic modules.
 *
 * Thematic modules tag content with free-text, granular regions
 * ("Minho", "Trás-os-Montes", "Beira Interior", "Costa Vicentina",
 * arrays like ["Açores","Madeira"]). This maps those to the 7 tourism
 * regions so a `?region=norte` deep-link can match "Minho" too.
 */

const strip = (s: string): string =>
  Array.from((s || '').normalize('NFD'))
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c < 0x0300 || c > 0x036f; // drop combining diacritical marks
    })
    .join('')
    .toLowerCase()
    .trim();

export const TOURISM_REGIONS: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

// Granular / free-text region token (accent-stripped) → tourism region id.
const REGION_ALIASES: Record<string, string> = {
  norte: 'norte', minho: 'norte', 'tras-os-montes': 'norte', 'tras os montes': 'norte',
  douro: 'norte', porto: 'norte', braga: 'norte', 'alto minho': 'norte', 'vinho verde': 'norte',
  centro: 'centro', beira: 'centro', 'beira interior': 'centro', 'beira litoral': 'centro',
  'beira alta': 'centro', 'beira baixa': 'centro', coimbra: 'centro', aveiro: 'centro',
  leiria: 'centro', viseu: 'centro', guarda: 'centro', 'serra da estrela': 'centro', dao: 'centro',
  lisboa: 'lisboa', 'vale do tejo': 'lisboa', 'lisboa e vale do tejo': 'lisboa',
  setubal: 'lisboa', oeste: 'lisboa', ribatejo: 'lisboa', sintra: 'lisboa',
  alentejo: 'alentejo', 'alentejo litoral': 'alentejo', 'alto alentejo': 'alentejo',
  'baixo alentejo': 'alentejo', 'costa vicentina': 'alentejo', evora: 'alentejo', beja: 'alentejo',
  algarve: 'algarve', faro: 'algarve',
  acores: 'acores', azores: 'acores',
  madeira: 'madeira', funchal: 'madeira', 'porto santo': 'madeira',
};

/** Map a single free-text region value to a tourism region id, or null. */
export function toTourismRegion(value?: string): string | null {
  const n = strip(value || '');
  if (!n) return null;
  if (TOURISM_REGIONS[n]) return n;
  if (REGION_ALIASES[n]) return REGION_ALIASES[n];
  for (const key of Object.keys(REGION_ALIASES)) {
    if (n.includes(key)) return REGION_ALIASES[key];
  }
  return null;
}

/**
 * True if an item's region field (string, composite "A / B", or string[])
 * belongs to the target tourism region id.
 */
export function matchesRegion(itemRegion: string | string[] | undefined, targetId: string): boolean {
  if (!itemRegion) return false;
  const fields = Array.isArray(itemRegion) ? itemRegion : [itemRegion];
  for (const field of fields) {
    for (const part of String(field).split(/\s*[\/,&]\s*|\s+e\s+/)) {
      if (toTourismRegion(part) === targetId) return true;
    }
  }
  return false;
}

/**
 * Filter a list by tourism region id. Returns the original list unchanged when
 * no region is set, or when the filter would empty it (so it never looks broken).
 */
export function filterByRegion<T>(
  items: T[],
  regionId: string | null,
  getRegion: (item: T) => string | string[] | undefined,
): T[] {
  if (!regionId) return items;
  const f = items.filter((i) => matchesRegion(getRegion(i), regionId));
  return f.length ? f : items;
}
