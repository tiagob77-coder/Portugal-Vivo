/**
 * Pacotes de região: guardar, voltar a ler e responder sem rede.
 *
 * O AsyncStorage e o expo-file-system são substituídos por versões em memória
 * para se ver exatamente onde cada byte foi parar.
 */
import type { OfflineRegionPackage } from '../offlineStorage';

// ─── AsyncStorage em memória ─────────────────────────────────────────────────
const mockKv = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => mockKv.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockKv.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockKv.delete(k); }),
    getAllKeys: jest.fn(async () => [...mockKv.keys()]),
    multiRemove: jest.fn(async (ks: string[]) => { ks.forEach((k) => mockKv.delete(k)); }),
  },
}));

// ─── expo-file-system em memória (API File/Directory/Paths do SDK 54) ────────
const mockFiles = new Map<string, string>();
jest.mock('expo-file-system', () => {
  const join = (parts: unknown[]) =>
    parts.map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri)).join('/');
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    create() { /* diretórios são implícitos no mapa */ }
  }
  class File {
    uri: string;
    constructor(...parts: unknown[]) { this.uri = join(parts); }
    get exists() { return mockFiles.has(this.uri); }
    get size() { return (mockFiles.get(this.uri) ?? '').length; }
    create() { mockFiles.set(this.uri, ''); }
    write(text: string) { mockFiles.set(this.uri, text); }
    async text() { return mockFiles.get(this.uri) ?? ''; }
    delete() { mockFiles.delete(this.uri); }
  }
  return { __esModule: true, File, Directory, Paths: { document: { uri: 'doc:' } } };
});

const mockAxiosGet = jest.fn();
jest.mock('axios', () => {
  const instance = {
    get: (...args: unknown[]) => mockAxiosGet(...args),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  };
  return { __esModule: true, default: { ...instance, create: () => instance } };
});

const PKG: OfflineRegionPackage = {
  region: 'norte', region_name: 'Norte', version_hash: 'v1', downloaded_at: '2026-10-16',
  heritage_items: [{
    id: 'bom-jesus', name: 'Bom Jesus do Monte', description: '', category: 'religioso',
    region: 'norte', location: { lat: 41.5545, lng: -8.3772 }, tags: [], related_items: [],
    metadata: {}, created_at: '2026-01-01',
  }],
  routes: [], events: [], categories: [],
  counts: { heritage_items: 1, routes: 0, events: 0, categories: 0 },
};

const setPlatform = (os: 'ios' | 'android' | 'web') => {
  jest.doMock('react-native', () => ({ Platform: { OS: os } }));
};

/** Módulo novo a cada teste: a instância exportada lê a plataforma ao nascer. */
const loadStorage = (os: 'ios' | 'android' | 'web') => {
  setPlatform(os);
  let mod: typeof import('../offlineStorage') | undefined;
  jest.isolateModules(() => { mod = require('../offlineStorage'); }); // eslint-disable-line @typescript-eslint/no-require-imports
  return mod!.offlineStorage;
};

beforeEach(() => {
  mockKv.clear();
  mockFiles.clear();
  mockAxiosGet.mockReset();
  mockAxiosGet.mockResolvedValue({ data: PKG });
});

describe('offlineStorage — onde fica o pacote', () => {
  it('no nativo grava num ficheiro, não no AsyncStorage', async () => {
    const storage = loadStorage('android');
    const meta = await storage.downloadRegion('norte');

    expect([...mockFiles.keys()]).toEqual(['doc:/offline-packages/norte.json']);
    expect(mockKv.has('offline_region_norte')).toBe(false);
    // Metadados continuam no AsyncStorage: o ecrã de gestão lê-os sem abrir pacotes
    expect(JSON.parse(mockKv.get('offline_meta_norte')!).poiCount).toBe(1);
    expect(meta.sizeBytes).toBe(JSON.stringify(PKG).length);
  });

  it('no web continua no AsyncStorage', async () => {
    const storage = loadStorage('web');
    await storage.downloadRegion('norte');

    expect(mockFiles.size).toBe(0);
    expect(mockKv.has('offline_region_norte')).toBe(true);
  });

  it('lê pacotes descarregados antes desta versão (ainda no AsyncStorage)', async () => {
    mockKv.set('offline_regions_list', JSON.stringify(['norte']));
    mockKv.set('offline_region_norte', JSON.stringify(PKG));
    const storage = loadStorage('ios');

    const pois = await storage.getOfflinePOIs();
    expect(pois.map((p) => p.id)).toEqual(['bom-jesus']);
  });

  it('apagar remove o ficheiro, o legado e os metadados', async () => {
    const storage = loadStorage('ios');
    await storage.downloadRegion('norte');
    mockKv.set('offline_region_norte', 'legado');

    await storage.deleteRegion('norte');

    expect(mockFiles.size).toBe(0);
    expect(mockKv.has('offline_region_norte')).toBe(false);
    expect(mockKv.has('offline_meta_norte')).toBe(false);
    expect(await storage.getPackages()).toEqual([]);
  });
});

describe('offlineStorage — leitura', () => {
  it('depois de lido, o pacote fica em memória', async () => {
    const storage = loadStorage('ios');
    await storage.downloadRegion('norte');
    mockFiles.clear(); // se voltasse ao disco, já não encontrava nada

    expect((await storage.getPackages()).map((p) => p.region)).toEqual(['norte']);
  });

  it('um pacote corrompido é ignorado em vez de partir as consultas', async () => {
    mockKv.set('offline_regions_list', JSON.stringify(['norte', 'centro']));
    mockFiles.set('doc:/offline-packages/norte.json', JSON.stringify(PKG));
    mockFiles.set('doc:/offline-packages/centro.json', '{ isto não é json');
    const storage = loadStorage('android');

    expect((await storage.getPackages()).map((p) => p.region)).toEqual(['norte']);
  });
});

describe('cachedGet — recurso aos pacotes', () => {
  const loadClient = () => {
    setPlatform('android');
    jest.doMock('../offlineCache', () => ({
      __esModule: true,
      default: { setCache: jest.fn(async () => {}), getCache: jest.fn(async () => null) },
    }));
    jest.doMock('../../utils/secureStorage', () => ({ secureStorage: { getItem: jest.fn(async () => null) } }));
    let client: typeof import('../api/client') | undefined;
    let storage: typeof import('../offlineStorage') | undefined;
    jest.isolateModules(() => {
      client = require('../api/client'); // eslint-disable-line @typescript-eslint/no-require-imports
      storage = require('../offlineStorage'); // eslint-disable-line @typescript-eslint/no-require-imports
    });
    return { cachedGet: client!.cachedGet, storage: storage!.offlineStorage };
  };

  const offlineError = new Error('Network Error');

  it('sem rede e sem cache, responde a partir dos pacotes', async () => {
    const { cachedGet, storage } = loadClient();
    await storage.downloadRegion('norte');

    const result = await cachedGet('k', () => Promise.reject(offlineError), {
      offline: (packs) => packs.flatMap((p) => p.heritage_items).map((p) => p.name),
    });
    expect(result).toEqual(['Bom Jesus do Monte']);
  });

  it('com rede, não toca nos pacotes', async () => {
    const { cachedGet } = loadClient();
    const offline = jest.fn(() => ['não devia']);

    await expect(cachedGet('k', async () => ['da API'], { offline })).resolves.toEqual(['da API']);
    expect(offline).not.toHaveBeenCalled();
  });

  it('sem pacotes, ou sem resposta neles, o erro original sobe', async () => {
    const { cachedGet, storage } = loadClient();
    await expect(cachedGet('k', () => Promise.reject(offlineError), { offline: () => ['x'] }))
      .rejects.toBe(offlineError);

    await storage.downloadRegion('norte');
    await expect(cachedGet('k', () => Promise.reject(offlineError), { offline: () => null }))
      .rejects.toBe(offlineError);
  });

  it('a forma antiga (TTL como número) continua a funcionar', async () => {
    const { cachedGet } = loadClient();
    await expect(cachedGet('k', async () => 42, 1000)).resolves.toBe(42);
  });
});
