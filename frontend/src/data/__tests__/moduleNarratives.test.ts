import { changeLanguage, t } from 'i18next';
import {
  moduleNarratives,
  MODULE_SLUGS,
  getModuleNarrative,
  getLinkedModules,
  localizeModuleNarrative,
} from '../moduleNarratives';
import {
  moduleHighlights,
  highlightDetails,
  getHighlight,
  getHighlightDetail,
  localizeHighlight,
  localizeHighlightDetail,
} from '../moduleHighlights';
import { moduleThemes } from '../../theme/colors';

describe('data/moduleNarratives', () => {
  it('cobre os 12 módulos temáticos', () => {
    expect(MODULE_SLUGS).toHaveLength(12);
  });

  it('todo o módulo com narrativa tem paleta correspondente', () => {
    const semPaleta = MODULE_SLUGS.filter(s => !moduleThemes[s]);
    expect(semPaleta).toEqual([]);
  });

  it('toda a paleta tem narrativa correspondente', () => {
    const semNarrativa = Object.keys(moduleThemes).filter(s => !moduleNarratives[s]);
    expect(semNarrativa).toEqual([]);
  });

  it('cada módulo traz história, 3 ligações e marcos', () => {
    const problemas: string[] = [];
    Object.entries(moduleNarratives).forEach(([slug, n]) => {
      if (n.story.length < 40) problemas.push(`${slug}: story curta`);
      if (n.links.length !== 3) problemas.push(`${slug}: ${n.links.length} ligações`);
      if (n.milestones.length < 3) problemas.push(`${slug}: ${n.milestones.length} marcos`);
      if (n.categories.length === 0) problemas.push(`${slug}: sem categorias`);
    });
    expect(problemas).toEqual([]);
  });

  it('as ligações apontam sempre para módulos existentes', () => {
    const orfas = Object.entries(moduleNarratives).flatMap(([slug, n]) =>
      n.links.filter(l => !moduleNarratives[l]).map(l => `${slug} → ${l}`),
    );
    expect(orfas).toEqual([]);
  });

  it('nenhum módulo se liga a si próprio', () => {
    const autos = Object.entries(moduleNarratives)
      .filter(([slug, n]) => n.links.includes(slug))
      .map(([slug]) => slug);
    expect(autos).toEqual([]);
  });

  it('getLinkedModules devolve os 3 módulos resolvidos', () => {
    const linked = getLinkedModules('biodiversidade');
    expect(linked.map(m => m.slug)).toEqual(['costa', 'cultura-maritima', 'gastronomia']);
    linked.forEach(m => {
      expect(m.label).toBeTruthy();
      expect(String(m.route).startsWith('/')).toBe(true);
    });
  });

  it('getLinkedModules devolve vazio para um módulo desconhecido', () => {
    expect(getLinkedModules('inexistente')).toEqual([]);
    expect(getModuleNarrative('inexistente')).toBeUndefined();
  });

  it('cada rota é única e começa por /', () => {
    const routes = Object.values(moduleNarratives).map(n => String(n.route));
    expect(new Set(routes).size).toBe(routes.length);
    routes.forEach(r => expect(r.startsWith('/')).toBe(true));
  });
});

describe('data/moduleHighlights', () => {
  it('cada módulo tem destaques', () => {
    const semDestaques = MODULE_SLUGS.filter(s => !moduleHighlights[s]?.length);
    expect(semDestaques).toEqual([]);
  });

  it('tem 44 fichas curadas', () => {
    expect(Object.keys(highlightDetails)).toHaveLength(44);
  });

  it('as coordenadas caem dentro do enquadramento de Portugal', () => {
    // Inclui arquipélagos: Açores a oeste (-31.3), Madeira a sul (32.4)
    const fora = Object.entries(highlightDetails)
      .filter(([, d]) => d.lat < 32 || d.lat > 42.2 || d.lng < -31.5 || d.lng > -6)
      .map(([name, d]) => `${name} (${d.lat}, ${d.lng})`);
    expect(fora).toEqual([]);
  });

  it('cada ficha tem "onde ver" e história com substância', () => {
    const fracas = Object.entries(highlightDetails)
      .filter(([, d]) => !d.where || d.history.length < 60)
      .map(([name]) => name);
    expect(fracas).toEqual([]);
  });

  it('getHighlight resolve pelo módulo e nome', () => {
    const h = getHighlight('biodiversidade', 'Sardinha-europeia');
    expect(h?.emoji).toBeTruthy();
    expect(getHighlight('biodiversidade', 'inexistente')).toBeUndefined();
  });

  it('destaques sem ficha curada degradam para undefined, não rebentam', () => {
    // 4 destaques (praias acessíveis, etc.) não têm ficha — o ecrã recai no módulo
    expect(getHighlightDetail('Praias acessíveis')).toBeUndefined();
    expect(getHighlightDetail('Sardinha-europeia')).toBeDefined();
    // a ficha está registada com o mesmo nome do destaque (antes: "Procissiões")
    expect(getHighlightDetail('Procissões do mar')).toBeDefined();
  });
});

describe('tradução do conteúdo editorial', () => {
  afterEach(async () => {
    await changeLanguage('pt');
  });

  it('em português devolve exatamente o texto dos ficheiros de dados', () => {
    MODULE_SLUGS.forEach(slug => {
      const n = moduleNarratives[slug];
      expect(localizeModuleNarrative(slug, n, t)).toEqual({
        label: n.label,
        story: n.story,
        milestones: n.milestones,
      });
    });
    Object.entries(moduleHighlights).forEach(([slug, hs]) =>
      hs.forEach(h => expect(localizeHighlight(slug, h, t)).toEqual({ name: h.name, meta: h.meta })),
    );
    Object.entries(highlightDetails).forEach(([name, d]) =>
      expect(localizeHighlightDetail(name, d, t)).toEqual({ where: d.where, history: d.history }),
    );
  });

  it('em inglês traduz narrativa, destaque e ficha', async () => {
    await changeLanguage('en');
    const costa = localizeModuleNarrative('costa', moduleNarratives.costa, t);
    expect(costa.label).toBe('Coast & Shoreline');
    expect(costa.milestones[1].title).toBe('Blue Flag');

    const sardinha = getHighlight('biodiversidade', 'Sardinha-europeia')!;
    expect(localizeHighlight('biodiversidade', sardinha, t).name).toBe('European sardine');
    expect(localizeHighlightDetail('Sardinha-europeia', highlightDetails['Sardinha-europeia'], t).where)
      .toBe('Atlantic coast — Peniche, Matosinhos, Setúbal');
  });
});
