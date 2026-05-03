/**
 * Portugal Vivo - Cultural Icons System
 * 
 * Custom icon mappings for Portuguese cultural categories.
 * Uses MaterialIcons as base with cultural-specific mappings.
 */

// Category to icon mapping with Portuguese cultural context
export const CULTURAL_ICONS: Record<string, { icon: string; emoji?: string; color: string }> = {
  // ── Natureza ──────────────────────────────────────────────
  percursos_pedestres: { icon: 'hiking', emoji: '🥾', color: '#84CC16' },
  aventura_natureza: { icon: 'terrain', emoji: '⛰️', color: '#DC2626' },
  natureza_especializada: { icon: 'science', emoji: '🔬', color: '#7C3AED' },
  fauna_autoctone: { icon: 'pets', emoji: '🐺', color: '#65A30D' },
  flora_autoctone: { icon: 'park', emoji: '🌲', color: '#22C55E' },
  flora_botanica: { icon: 'local-florist', emoji: '🌸', color: '#A3E635' },
  biodiversidade_avistamentos: { icon: 'visibility', emoji: '🦅', color: '#10B981' },
  miradouros: { icon: 'landscape', emoji: '🏔️', color: '#0284C7' },
  barragens_albufeiras: { icon: 'water', emoji: '💧', color: '#3B82F6' },
  cascatas_pocos: { icon: 'water-drop', emoji: '🌊', color: '#0891B2' },
  praias_fluviais: { icon: 'pool', emoji: '🏊', color: '#0EA5E9' },
  ecovias_passadicos: { icon: 'directions-walk', emoji: '🚶', color: '#84CC16' },

  // ── História & Património ─────────────────────────────────
  arqueologia_geologia: { icon: 'account-balance', emoji: '🏛️', color: '#78716C' },
  moinhos_azenhas: { icon: 'settings', emoji: '⚙️', color: '#78716C' },
  castelos: { icon: 'castle', emoji: '🏰', color: '#92400E' },
  palacios_solares: { icon: 'villa', emoji: '🏛️', color: '#D97706' },
  museus: { icon: 'museum', emoji: '🖼️', color: '#F59E0B' },
  oficios_artesanato: { icon: 'handyman', emoji: '🧵', color: '#10B981' },
  termas_banhos: { icon: 'hot-tub', emoji: '♨️', color: '#06B6D4' },
  patrimonio_ferroviario: { icon: 'train', emoji: '🚂', color: '#6366F1' },
  arte_urbana: { icon: 'brush', emoji: '🎨', color: '#E11D48' },

  // ── Gastronomia ───────────────────────────────────────────
  restaurantes_gastronomia: { icon: 'restaurant', emoji: '🍽️', color: '#EF4444' },
  tabernas_historicas: { icon: 'local-bar', emoji: '🍷', color: '#B45309' },
  mercados_feiras: { icon: 'storefront', emoji: '🏪', color: '#F97316' },
  produtores_dop: { icon: 'verified', emoji: '✅', color: '#F97316' },
  agroturismo_enoturismo: { icon: 'wine-bar', emoji: '🍇', color: '#7C2D12' },
  pratos_tipicos: { icon: 'lunch-dining', emoji: '🍲', color: '#EF4444' },
  docaria_regional: { icon: 'cake', emoji: '🍰', color: '#EC4899' },
  sopas_tipicas: { icon: 'soup-kitchen', emoji: '🥣', color: '#F97316' },

  // ── Cultura ───────────────────────────────────────────────
  musica_tradicional: { icon: 'music-note', emoji: '🎵', color: '#8B5CF6' },
  festivais_musica: { icon: 'celebration', emoji: '🎉', color: '#D946EF' },
  festas_romarias: { icon: 'groups', emoji: '🎊', color: '#F59E0B' },

  // ── Mar & Praias ──────────────────────────────────────────
  surf: { icon: 'surfing', emoji: '🏄', color: '#0EA5E9' },
  praias_bandeira_azul: { icon: 'beach-access', emoji: '🏖️', color: '#2563EB' },
  farois: { icon: 'highlight', emoji: '🗼', color: '#F59E0B' },

  // ── Experiências & Rotas ──────────────────────────────────
  rotas_tematicas: { icon: 'route', emoji: '🗺️', color: '#EC4899' },
  grande_expedicao: { icon: 'explore', emoji: '🧭', color: '#F59E0B' },
  perolas_portugal: { icon: 'diamond', emoji: '💎', color: '#D946EF' },
  alojamentos_rurais: { icon: 'cottage', emoji: '🏡', color: '#92400E' },
  parques_campismo: { icon: 'camping', emoji: '⛺', color: '#22C55E' },
  pousadas_juventude: { icon: 'hotel', emoji: '🏨', color: '#3B82F6' },
  guia_viajante: { icon: 'menu-book', emoji: '📖', color: '#F97316' },
  transportes: { icon: 'directions-bus', emoji: '🚌', color: '#78716C' },
};

// Get icon data for a category
export function getCulturalIcon(categoryId: string): { icon: string; emoji?: string; color: string } {
  return CULTURAL_ICONS[categoryId] || { icon: 'place', emoji: '📍', color: '#6B7280' };
}

// Portuguese region colors
export const REGION_COLORS: Record<string, string> = {
  norte: '#2E8B57',      // Forest green - Douro vineyards
  centro: '#8B4513',     // Saddle brown - Serra da Estrela
  lisboa: '#FFD700',     // Gold - Sun and tiles
  alentejo: '#DAA520',   // Goldenrod - Cork and wheat
  algarve: '#00CED1',    // Dark turquoise - Ocean
  acores: '#4169E1',     // Royal blue - Atlantic
  madeira: '#228B22',    // Forest green - Laurisilva
};

// Get region color
export function getRegionColor(region: string): string {
  const normalized = region?.toLowerCase().replace(/[^a-z]/g, '') || '';
  return REGION_COLORS[normalized] || '#6B7280';
}

// IQ Score color mapping
export function getIQScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'; // Excellent - Green
  if (score >= 60) return '#84CC16'; // Good - Lime
  if (score >= 40) return '#F59E0B'; // Medium - Amber
  if (score >= 20) return '#F97316'; // Low - Orange
  return '#EF4444'; // Critical - Red
}

// IQ Score label
export function getIQScoreLabel(score: number): string {
  if (score >= 80) return 'Excelente';
  if (score >= 60) return 'Bom';
  if (score >= 40) return 'Médio';
  if (score >= 20) return 'Básico';
  return 'Incompleto';
}
