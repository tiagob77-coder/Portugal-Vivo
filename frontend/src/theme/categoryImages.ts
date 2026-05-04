/**
 * Shared category image map. Single source of truth for fallbacks
 * used by HeritageCard, CategoryCard and any future card that needs a
 * category-driven hero image.
 *
 * Keep keys in sync with backend category IDs. Legacy IDs stay at the bottom
 * for backwards compatibility until the data migration is complete.
 */
export const CATEGORY_IMAGES: Record<string, string> = {
  // ── Natureza ──────────────────────────────────────────────
  percursos_pedestres: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  aventura_natureza: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
  natureza_especializada: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
  fauna_autoctone: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&q=80', // Lobo ibérico
  flora_autoctone: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&q=80', // Floresta portuguesa
  flora_botanica: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=400&q=80', // Jardim botânico
  biodiversidade: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=400&q=80', // Biodiversidade
  biodiversidade_avistamentos: 'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?w=400&q=80', // Observação de aves
  miradouros: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  barragens_albufeiras: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=400&q=80',
  cascatas_pocos: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80',
  praias_fluviais: 'https://images.unsplash.com/photo-1504858700536-882c978a3464?w=400&q=80', // Praia fluvial Portugal
  ecovias_passadicos: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',

  // ── História & Património ─────────────────────────────────
  arqueologia_geologia: 'https://images.unsplash.com/photo-1531177071211-ed1b7991958b?w=400&q=80', // Ruínas arqueológicas
  moinhos_azenhas: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&q=80', // Moinho tradicional
  castelos: 'https://images.unsplash.com/photo-1570168007204-dfb528c6958f?w=400&q=80', // Castelo Portugal
  palacios_solares: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=400&q=80', // Palácio da Pena
  museus: 'https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=400&q=80', // Interior museu
  oficios_artesanato: 'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?w=400&q=80',
  termas_banhos: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&q=80',
  patrimonio_ferroviario: 'https://images.unsplash.com/photo-1474487548417-781cb71495f3?w=400&q=80',
  arte_urbana: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=400&q=80', // Street art

  // ── Gastronomia ───────────────────────────────────────────
  restaurantes_gastronomia: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400&q=80',
  tabernas_historicas: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&q=80',
  mercados_feiras: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=400&q=80',
  produtores_dop: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
  agroturismo_enoturismo: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?w=400&q=80',
  pratos_tipicos: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&q=80', // Prato típico português
  docaria_regional: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=400&q=80',
  sopas_tipicas: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?w=400&q=80',

  // ── Cultura ───────────────────────────────────────────────
  musica_tradicional: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&q=80',
  festivais_musica: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=400&q=80',
  festas_romarias: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80', // Festas populares

  // ── Mar & Praias ──────────────────────────────────────────
  surf: 'https://images.unsplash.com/photo-1502680390548-bdbac40b3e1a?w=400&q=80', // Surf
  praias_bandeira_azul: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  farois: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&q=80',

  // ── Experiências & Rotas ──────────────────────────────────
  rotas_tematicas: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  grande_expedicao: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  perolas_portugal: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80',
  alojamentos_rurais: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=400&q=80',
  parques_campismo: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=400&q=80',
  pousadas_juventude: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=400&q=80',
  agentes_turisticos: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
  entidades_operadores: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
  guia_viajante: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=400&q=80', // Guia de viagem
  transportes: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=400&q=80', // Transportes

  // ── Legacy IDs (keep until backend migration is complete) ─
  lendas: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80',
  festas: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
  gastronomia: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&q=80',
  percursos: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=400&q=80',
  rotas: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&q=80',
  tascas: 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=400&q=80',
  termas: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
  comunidade: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&q=80',
  fauna: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=400&q=80',
  arte: 'https://images.unsplash.com/photo-1499781350541-7783f6c6a0c8?w=400&q=80',
  produtos: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=80',
  cascatas: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=400&q=80',
  aventura: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=400&q=80',
  moinhos: 'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?w=400&q=80',
  areas_protegidas: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&q=80',
  piscinas: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=400&q=80',
  religioso: 'https://images.unsplash.com/photo-1548625149-fc4a29cf7092?w=400&q=80',
  saberes: 'https://images.unsplash.com/photo-1568288796888-a0fa7b6ebd17?w=400&q=80',
  arqueologia: 'https://images.unsplash.com/photo-1531177071211-ed1b7991958b?w=400&q=80',
  aldeias: 'https://images.unsplash.com/photo-1600786705579-08b369d25d7d?w=400&q=80',
};

export const DEFAULT_CATEGORY_IMAGE = CATEGORY_IMAGES.lendas;

export function getCategoryImage(categoryId?: string | null): string {
  if (!categoryId) return DEFAULT_CATEGORY_IMAGE;
  return CATEGORY_IMAGES[categoryId] ?? DEFAULT_CATEGORY_IMAGE;
}
