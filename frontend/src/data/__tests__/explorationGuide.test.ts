import {
  guideRegions,
  guideModuleLenses,
  guideExperiences,
  getGuideRegion,
  getGuideExperiences,
  getGuideAngle,
} from '../explorationGuide';
import { MODULE_SLUGS } from '../moduleNarratives';

const REGION_IDS = ['norte', 'centro', 'lisboa', 'alentejo', 'algarve', 'acores', 'madeira'];

describe('data/explorationGuide — regiões', () => {
  it('cobre as 7 regiões turísticas canónicas', () => {
    expect(guideRegions.map(r => r.id)).toEqual(REGION_IDS);
  });

  it('cada região traz informação prática completa', () => {
    const problemas: string[] = [];
    guideRegions.forEach(r => {
      if (!r.label || !r.chip || !r.sub) problemas.push(`${r.id}: rótulos`);
      if (r.hook.length < 40) problemas.push(`${r.id}: hook curto`);
      if (r.transports.length < 3) problemas.push(`${r.id}: ${r.transports.length} transportes`);
      if (!r.best) problemas.push(`${r.id}: sem melhor época`);
      if (r.alerts.length === 0) problemas.push(`${r.id}: sem alertas`);
      if (!r.mobility || !r.kids || !r.pets) problemas.push(`${r.id}: acessibilidade incompleta`);
    });
    expect(problemas).toEqual([]);
  });

  it('cada nota de transporte tem rótulo e texto', () => {
    const vazias = guideRegions.flatMap(r =>
      r.transports.filter(t => !t.label || t.text.length < 20).map(t => `${r.id}: ${t.label}`),
    );
    expect(vazias).toEqual([]);
  });

  it('getGuideRegion resolve por id', () => {
    expect(getGuideRegion('alentejo')?.label).toBe('Alentejo');
    expect(getGuideRegion('inexistente')).toBeUndefined();
  });
});

describe('data/explorationGuide — lentes e ângulos', () => {
  it('cobre os 12 módulos', () => {
    const semLente = MODULE_SLUGS.filter(s => !guideModuleLenses[s]);
    expect(semLente).toEqual([]);
  });

  it('cada módulo tem ângulo para as 7 regiões', () => {
    const faltas = Object.entries(guideModuleLenses).flatMap(([slug, m]) =>
      REGION_IDS.filter(r => !m.angles[r]).map(r => `${slug}/${r}`),
    );
    expect(faltas).toEqual([]);
  });

  it('getGuideAngle recai na lente quando falta o ângulo', () => {
    expect(getGuideAngle('costa', 'norte')).toBeTruthy();
    // região inexistente → lente do módulo
    expect(getGuideAngle('costa', 'inexistente')).toBe(guideModuleLenses.costa.lens);
    // módulo inexistente → string vazia, sem rebentar
    expect(getGuideAngle('inexistente', 'norte')).toBe('');
  });
});

describe('data/explorationGuide — experiências', () => {
  it('tem 84 combinações módulo × região', () => {
    const combos = Object.values(guideExperiences)
      .reduce((n, byRegion) => n + Object.keys(byRegion).length, 0);
    expect(combos).toBe(84);
  });

  it('tem 252 experiências (3 por combinação)', () => {
    const total = Object.values(guideExperiences)
      .flatMap(byRegion => Object.values(byRegion))
      .reduce((n, exps) => n + exps.length, 0);
    expect(total).toBe(252);
  });

  it('cada combinação tem exactamente 3 experiências', () => {
    const erradas = Object.entries(guideExperiences).flatMap(([slug, byRegion]) =>
      Object.entries(byRegion)
        .filter(([, exps]) => exps.length !== 3)
        .map(([r, exps]) => `${slug}/${r} = ${exps.length}`),
    );
    expect(erradas).toEqual([]);
  });

  it('nenhuma experiência tem título ou descrição pobres', () => {
    const fracas = Object.entries(guideExperiences).flatMap(([slug, byRegion]) =>
      Object.entries(byRegion).flatMap(([r, exps]) =>
        exps
          .filter(e => e.title.length < 8 || e.desc.length < 40)
          .map(e => `${slug}/${r}: ${e.title}`),
      ),
    );
    expect(fracas).toEqual([]);
  });

  it('getGuideExperiences devolve vazio para combinações inexistentes', () => {
    expect(getGuideExperiences('costa', 'norte')).toHaveLength(3);
    expect(getGuideExperiences('inexistente', 'norte')).toEqual([]);
    expect(getGuideExperiences('costa', 'inexistente')).toEqual([]);
  });
});
