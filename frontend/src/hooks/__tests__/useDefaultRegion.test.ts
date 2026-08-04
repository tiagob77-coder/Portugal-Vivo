import { regionFromCoords, isKnownRegion, FALLBACK_REGION } from '../useDefaultRegion';

describe('useDefaultRegion — regionFromCoords', () => {
  it('classifica cidades do continente', () => {
    expect(regionFromCoords(41.1579, -8.6291)).toBe('norte');    // Porto
    expect(regionFromCoords(40.2033, -8.4103)).toBe('centro');   // Coimbra
    expect(regionFromCoords(38.7223, -9.1393)).toBe('lisboa');   // Lisboa
    expect(regionFromCoords(38.5714, -7.9135)).toBe('alentejo'); // Évora
    expect(regionFromCoords(37.0194, -7.9322)).toBe('algarve');  // Faro
  });

  it('classifica os arquipélagos', () => {
    expect(regionFromCoords(37.7412, -25.6756)).toBe('acores');  // Ponta Delgada
    expect(regionFromCoords(32.6669, -16.9241)).toBe('madeira'); // Funchal
  });

  it('devolve null fora de Portugal', () => {
    expect(regionFromCoords(40.4168, -3.7038)).toBeNull();  // Madrid
    expect(regionFromCoords(48.8566, 2.3522)).toBeNull();   // Paris
    expect(regionFromCoords(0, 0)).toBeNull();
  });

  it('não confunde Açores com Madeira (longitudes distintas)', () => {
    expect(regionFromCoords(32.75, -16.95)).toBe('madeira');
    expect(regionFromCoords(38.5, -28.6)).toBe('acores');
  });
});

describe('useDefaultRegion — isKnownRegion', () => {
  it('aceita as 7 regiões e rejeita o resto', () => {
    ['norte', 'centro', 'lisboa', 'alentejo', 'algarve', 'acores', 'madeira']
      .forEach(r => expect(isKnownRegion(r)).toBe(true));
    expect(isKnownRegion('inexistente')).toBe(false);
    expect(isKnownRegion('')).toBe(false);
    expect(isKnownRegion(null)).toBe(false);
    expect(isKnownRegion(undefined)).toBe(false);
  });

  it('o fallback é uma região válida', () => {
    expect(isKnownRegion(FALLBACK_REGION)).toBe(true);
  });
});
