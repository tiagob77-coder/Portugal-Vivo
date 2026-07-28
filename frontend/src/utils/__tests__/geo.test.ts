import { haversineKm, formatDistance, nearest } from '../geo';

const LISBOA = { lat: 38.7223, lng: -9.1393 };
const PORTO = { lat: 41.1579, lng: -8.6291 };
const FARO = { lat: 37.0194, lng: -7.9322 };

describe('utils/geo — haversineKm', () => {
  it('mede Lisboa–Porto com precisão razoável (~274 km)', () => {
    expect(haversineKm(LISBOA, PORTO)).toBeCloseTo(274, 0);
  });

  it('é simétrica', () => {
    expect(haversineKm(LISBOA, PORTO)).toBeCloseTo(haversineKm(PORTO, LISBOA), 6);
  });

  it('devolve 0 para o mesmo ponto', () => {
    expect(haversineKm(LISBOA, LISBOA)).toBeCloseTo(0, 6);
  });

  it('respeita a desigualdade triangular', () => {
    const direta = haversineKm(PORTO, FARO);
    const viaLisboa = haversineKm(PORTO, LISBOA) + haversineKm(LISBOA, FARO);
    expect(direta).toBeLessThanOrEqual(viaLisboa);
  });
});

describe('utils/geo — formatDistance', () => {
  it('usa metros abaixo de 1 km, arredondados a 50 m', () => {
    expect(formatDistance(0.42)).toBe('a 400 m');
    expect(formatDistance(0.63)).toBe('a 650 m');
  });

  it('trata distâncias muito curtas', () => {
    expect(formatDistance(0.01)).toBe('a menos de 50 m');
    expect(formatDistance(0)).toBe('a menos de 50 m');
  });

  it('usa uma casa decimal com vírgula até 10 km', () => {
    expect(formatDistance(2.34)).toBe('a 2,3 km');
    expect(formatDistance(9.99)).toBe('a 10,0 km');
  });

  it('usa quilómetros inteiros acima de 10 km', () => {
    expect(formatDistance(12.4)).toBe('a 12 km');
    expect(formatDistance(274.2)).toBe('a 274 km');
  });

  it('devolve vazio para valores inválidos', () => {
    expect(formatDistance(NaN)).toBe('');
    expect(formatDistance(-5)).toBe('');
    expect(formatDistance(Infinity)).toBe('');
  });
});

describe('utils/geo — nearest', () => {
  const pontos = [
    { id: 'porto', ...PORTO },
    { id: 'faro', ...FARO },
    { id: 'lisboa', ...LISBOA },
  ];

  it('ordena por proximidade', () => {
    // Faro (~195 km) fica mais perto de Lisboa do que o Porto (~274 km)
    const r = nearest(LISBOA, pontos);
    expect(r.map(x => x.point.id)).toEqual(['lisboa', 'faro', 'porto']);
  });

  it('respeita o limite', () => {
    expect(nearest(LISBOA, pontos, 2)).toHaveLength(2);
  });

  it('devolve a distância junto com o ponto', () => {
    const [primeiro] = nearest(PORTO, pontos, 1);
    expect(primeiro.point.id).toBe('porto');
    expect(primeiro.km).toBeCloseTo(0, 6);
  });

  it('lida com lista vazia', () => {
    expect(nearest(LISBOA, [])).toEqual([]);
  });
});
