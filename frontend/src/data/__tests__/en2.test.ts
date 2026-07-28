import {
  EN2_WAYPOINTS, EN2_SECTIONS, EN2_MUST_SEE, EN2_DISTRICTS, EN2_HISTORY,
  EN2_START, EN2_END, EN2_LENGTH_KM, sectionWaypoints,
} from '../en2';
import { haversineKm, distanceToPathKm } from '../../utils/geo';

describe('data/en2 — pontos de passagem', () => {
  it('tem 22 pontos, de Chaves a Faro', () => {
    expect(EN2_WAYPOINTS).toHaveLength(22);
    expect(EN2_START.name).toBe('Chaves');
    expect(EN2_END.name).toBe('Faro');
  });

  it('a quilometragem cresce monotonicamente de norte para sul', () => {
    const quebras = EN2_WAYPOINTS
      .map((w, i) => (i > 0 && w.km <= EN2_WAYPOINTS[i - 1].km ? w.name : null))
      .filter(Boolean);
    expect(quebras).toEqual([]);
  });

  it('a latitude desce de norte para sul', () => {
    expect(EN2_START.lat).toBeGreaterThan(EN2_END.lat);
    const subidas = EN2_WAYPOINTS
      .map((w, i) => (i > 0 && w.lat > EN2_WAYPOINTS[i - 1].lat ? w.name : null))
      .filter(Boolean);
    expect(subidas).toEqual([]);
  });

  it('o último km aproxima o comprimento oficial', () => {
    // A estrada tem 738,5 km; o último ponto de passagem fica lá perto
    expect(EN2_END.km).toBeGreaterThan(EN2_LENGTH_KM - 20);
    expect(EN2_END.km).toBeLessThanOrEqual(EN2_LENGTH_KM);
  });

  it('todos os pontos caem dentro de Portugal continental', () => {
    const fora = EN2_WAYPOINTS
      .filter(w => w.lat < 36.9 || w.lat > 42.2 || w.lng < -9.6 || w.lng > -6.1)
      .map(w => w.name);
    expect(fora).toEqual([]);
  });

  it('a soma dos saltos entre pontos é compatível com o traçado', () => {
    // Linha recta entre pontos subestima a estrada, mas deve andar na ordem certa
    let total = 0;
    for (let i = 1; i < EN2_WAYPOINTS.length; i++) {
      total += haversineKm(EN2_WAYPOINTS[i - 1], EN2_WAYPOINTS[i]);
    }
    expect(total).toBeGreaterThan(500);
    expect(total).toBeLessThan(EN2_LENGTH_KM);
  });
});

describe('data/en2 — troços', () => {
  it('tem 6 troços numerados 01–06', () => {
    expect(EN2_SECTIONS.map(s => s.n)).toEqual(['01', '02', '03', '04', '05', '06']);
  });

  it('os troços cobrem a estrada de ponta a ponta, sem lacunas', () => {
    expect(EN2_SECTIONS[0].fromIdx).toBe(0);
    expect(EN2_SECTIONS[EN2_SECTIONS.length - 1].toIdx).toBe(EN2_WAYPOINTS.length - 1);
    const lacunas = EN2_SECTIONS
      .map((s, i) => (i > 0 && s.fromIdx !== EN2_SECTIONS[i - 1].toIdx ? s.n : null))
      .filter(Boolean);
    expect(lacunas).toEqual([]);
  });

  it('cada troço tem 3 destaques e descrição', () => {
    const problemas = EN2_SECTIONS
      .filter(s => s.highlights.length !== 3 || s.desc.length < 50)
      .map(s => s.n);
    expect(problemas).toEqual([]);
  });

  it('sectionWaypoints devolve os pontos do troço, inclusive', () => {
    const first = sectionWaypoints(EN2_SECTIONS[0]);
    expect(first[0].name).toBe('Chaves');
    expect(first).toHaveLength(EN2_SECTIONS[0].toIdx - EN2_SECTIONS[0].fromIdx + 1);
  });
});

describe('data/en2 — locais e passaporte', () => {
  it('tem 13 locais a não perder, todos com marco quilométrico', () => {
    expect(EN2_MUST_SEE).toHaveLength(13);
    const semKm = EN2_MUST_SEE.filter(m => !/^km \d+$/.test(m.km)).map(m => m.name);
    expect(semKm).toEqual([]);
  });

  it('os locais a não perder ficam perto do eixo da estrada', () => {
    const longe = EN2_MUST_SEE
      .map(m => ({ name: m.name, km: distanceToPathKm(m, EN2_WAYPOINTS) }))
      .filter(x => x.km > 12)
      .map(x => `${x.name} (${x.km.toFixed(1)} km)`);
    expect(longe).toEqual([]);
  });

  it('tem 11 distritos, sem repetições', () => {
    expect(EN2_DISTRICTS).toHaveLength(11);
    expect(new Set(EN2_DISTRICTS.map(d => d.name)).size).toBe(11);
  });

  it('tem 4 marcos históricos', () => {
    expect(EN2_HISTORY).toHaveLength(4);
    expect(EN2_HISTORY[0].year).toBe('1945');
  });
});
