import { AREAS, BASE_LOCALES, SUPPORTED_LANGUAGES, resources } from '../resources';

type Dict = Record<string, unknown>;

function flatten(obj: Dict, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(out, flatten(value as Dict, path));
    } else {
      out[path] = value;
    }
  }
  return out;
}

const placeholders = (text: string) => (text.match(/{{\s*[\w.]+\s*}}/g) || []).map((p) => p.replace(/\s/g, '')).sort();

const sources: [string, Record<string, Dict>][] = [
  ['base locale files', BASE_LOCALES],
  ...Object.entries(AREAS).map(([name, area]) => [`area "${name}"`, area] as [string, Record<string, Dict>]),
];

describe.each(sources)('%s', (_name, byLanguage) => {
  const pt = flatten(byLanguage.pt);

  it.each(SUPPORTED_LANGUAGES.filter((l) => l !== 'pt'))('has every Portuguese key translated to %s', (lang) => {
    const other = flatten(byLanguage[lang]);
    expect(Object.keys(other).sort()).toEqual(Object.keys(pt).sort());
  });

  it.each([...SUPPORTED_LANGUAGES])('has only non-empty strings in %s', (lang) => {
    for (const [key, value] of Object.entries(flatten(byLanguage[lang]))) {
      expect([key, typeof value]).toEqual([key, 'string']);
      expect([key, (value as string).trim().length > 0]).toEqual([key, true]);
    }
  });

  it.each(SUPPORTED_LANGUAGES.filter((l) => l !== 'pt'))('keeps the {{placeholders}} of each key in %s', (lang) => {
    const other = flatten(byLanguage[lang]);
    for (const [key, value] of Object.entries(pt)) {
      if (typeof value !== 'string' || typeof other[key] !== 'string') continue;
      expect([key, placeholders(other[key] as string)]).toEqual([key, placeholders(value)]);
    }
  });
});

it('mounts every area under its own namespace', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    for (const name of Object.keys(AREAS)) {
      expect(resources[lang].translation[name]).toBe(AREAS[name][lang]);
    }
  }
});
