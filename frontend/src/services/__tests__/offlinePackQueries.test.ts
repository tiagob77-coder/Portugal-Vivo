import {
  allPois, compassDirection, findPoi, findRoute, nearbyPois,
  packageCategories, queryPois, queryRoutes, routeItems,
  type QueryablePackage,
} from '../offlinePackQueries';
import type { HeritageItem, Route } from '../../types';

const poi = (over: Partial<HeritageItem>): HeritageItem => ({
  id: 'x', name: 'x', description: '', category: 'monumentos', region: 'norte',
  tags: [], related_items: [], metadata: {}, created_at: '2026-01-01',
  ...over,
});
const route = (over: Partial<Route>): Route => ({
  id: 'r', name: 'r', description: '', items: [], tags: [], created_at: '2026-01-01',
  ...over,
});

const BRAGA = { lat: 41.5454, lng: -8.4265 };
const GUIMARAES = { lat: 41.4425, lng: -8.2918 };
const PORTO = { lat: 41.1579, lng: -8.6291 };

const norte: QueryablePackage = {
  heritage_items: [
    poi({ id: 'bom-jesus', name: 'Bom Jesus do Monte', category: 'religioso', location: BRAGA, tags: ['barroco'] }),
    poi({ id: 'castelo-gmr', name: 'Castelo de Guimarães', category: 'castelos', location: GUIMARAES }),
    poi({ id: 'sem-coords', name: 'Lenda do Galo', category: 'lendas' }),
  ],
  routes: [route({ id: 'romanico', name: 'Rota do Românico', region: 'Norte', category: 'religioso', items: ['castelo-gmr', 'nao-descarregado', 'bom-jesus'] })],
  categories: [{ id: 'religioso', name: 'Religioso', icon: 'church', color: '#000' }],
};
const centro: QueryablePackage = {
  heritage_items: [
    poi({ id: 'castelo-gmr', name: 'duplicado de fronteira', region: 'centro' }),
    poi({ id: 'conimbriga', name: 'Conímbriga', category: 'arqueologia', region: 'centro', location: { lat: 40.099, lng: -8.493 } }),
  ],
  routes: [route({ id: 'romanico', name: 'duplicada' })],
  categories: [],
};

describe('offlinePackQueries — POIs', () => {
  it('junta os POIs de todos os pacotes sem repetir os da fronteira', () => {
    const ids = allPois([norte, centro]).map((p) => p.id);
    expect(ids).toEqual(['bom-jesus', 'castelo-gmr', 'sem-coords', 'conimbriga']);
  });

  it('encontra um POI por id em qualquer pacote', () => {
    expect(findPoi([norte, centro], 'conimbriga')?.name).toBe('Conímbriga');
    expect(findPoi([norte, centro], 'inexistente')).toBeNull();
  });

  it('filtra por categoria, lista de categorias e região (sem diferenciar maiúsculas)', () => {
    expect(queryPois([norte, centro], { category: 'castelos' }).map((p) => p.id)).toEqual(['castelo-gmr']);
    expect(queryPois([norte, centro], { categories: ['religioso', 'arqueologia'] }).map((p) => p.id))
      .toEqual(['bom-jesus', 'conimbriga']);
    expect(queryPois([norte, centro], { region: 'CENTRO' }).map((p) => p.id)).toEqual(['conimbriga']);
  });

  it('pesquisa no nome, na descrição e nas etiquetas, como a API', () => {
    expect(queryPois([norte], { search: 'castelo' }).map((p) => p.id)).toEqual(['castelo-gmr']);
    expect(queryPois([norte], { search: 'BARROCO' }).map((p) => p.id)).toEqual(['bom-jesus']);
    expect(queryPois([norte], { search: 'nada disto' })).toEqual([]);
  });

  it('respeita skip e limit', () => {
    expect(queryPois([norte, centro], { skip: 1, limit: 2 }).map((p) => p.id)).toEqual(['castelo-gmr', 'sem-coords']);
  });
});

describe('offlinePackQueries — perto de mim', () => {
  it('devolve só o que cabe no raio, ordenado pela distância', () => {
    const r = nearbyPois([norte, centro], BRAGA, 20);
    expect(r.map((p) => p.id)).toEqual(['bom-jesus', 'castelo-gmr']);
    expect(r[0].distance_km).toBe(0);
    expect(r[1].distance_km).toBeGreaterThan(14);
    expect(r[1].distance_km).toBeLessThan(18);
  });

  it('ignora POIs sem coordenadas e aplica categoria e limite', () => {
    expect(nearbyPois([norte], BRAGA, 500).some((p) => p.id === 'sem-coords')).toBe(false);
    expect(nearbyPois([norte], BRAGA, 500, { category: 'castelos' }).map((p) => p.id)).toEqual(['castelo-gmr']);
    expect(nearbyPois([norte, centro], BRAGA, 500, { limit: 1 })).toHaveLength(1);
  });

  it('indica o rumo em pontos cardeais portugueses', () => {
    expect(compassDirection(BRAGA, GUIMARAES)).toBe('SE');
    expect(compassDirection(BRAGA, PORTO)).toBe('S');
    expect(compassDirection(PORTO, BRAGA)).toBe('N');
  });
});

describe('offlinePackQueries — rotas e categorias', () => {
  it('lista rotas sem repetidos e filtra por região e categoria', () => {
    expect(queryRoutes([norte, centro]).map((r) => r.name)).toEqual(['Rota do Românico']);
    expect(queryRoutes([norte], { region: 'norte', category: 'religioso' })).toHaveLength(1);
    expect(queryRoutes([norte], { region: 'algarve' })).toEqual([]);
  });

  it('dá os POIs da rota pela ordem dela, saltando os que não foram descarregados', () => {
    expect(findRoute([norte], 'romanico')?.name).toBe('Rota do Românico');
    expect(routeItems([norte], 'romanico')?.map((p) => p.id)).toEqual(['castelo-gmr', 'bom-jesus']);
    expect(routeItems([norte], 'outra')).toBeNull();
  });

  it('usa as categorias do primeiro pacote que as tenha', () => {
    expect(packageCategories([centro, norte])?.map((c) => c.id)).toEqual(['religioso']);
    expect(packageCategories([centro])).toBeNull();
  });
});
