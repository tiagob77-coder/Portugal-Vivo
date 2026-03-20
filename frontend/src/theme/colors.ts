/**
 * Portugal Vivo - Unified Color System
 * Single source of truth for all colors in the app.
 *
 * Usage:
 *   import { palette, semantic, categoryColors, withOpacity } from '../theme/colors';
 */

// ============================================
// BASE PALETTE - Inspired by Portuguese landscape
// ============================================

export const palette = {
  forest: {
    50: '#E8F0ED',
    100: '#D1E1DB',
    200: '#A3C3B7',
    300: '#75A593',
    400: '#47876F',
    500: '#2E5E4E',
    600: '#264E41',
    700: '#1E3E34',
    800: '#162E27',
    900: '#0E1E1A',
  },
  mint: {
    50: '#F0F7F2',
    100: '#E1EFE5',
    200: '#C3DFCB',
    300: '#A5CFB1',
    400: '#87BF97',
    500: '#6BBF9A',
    600: '#55A67E',
    700: '#408D63',
    800: '#2A7448',
    900: '#155B2D',
  },
  terracotta: {
    50: '#FBF5EF',
    100: '#F7EBDF',
    200: '#EFD7BF',
    300: '#E7C39F',
    400: '#DFAF7F',
    500: '#C49A6C',
    600: '#B08556',
    700: '#8C6A44',
    800: '#684F32',
    900: '#443420',
  },
  ocean: {
    50: '#EBF0F5',
    100: '#D7E1EB',
    200: '#AFC3D7',
    300: '#87A5C3',
    400: '#5F87AF',
    500: '#1F4E79',
    600: '#1A4266',
    700: '#153653',
    800: '#102A40',
    900: '#0B1E2D',
  },
  rust: {
    50: '#FFF5F0',
    100: '#FFE8DD',
    200: '#FFD0BA',
    300: '#E8A080',
    400: '#E07B5A',
    500: '#C65D3B',
    600: '#A84D32',
    700: '#8A3D28',
    800: '#6C2E1E',
    900: '#4E1F14',
  },
  gray: {
    50: '#FAF8F3',
    100: '#F2EDE4',
    200: '#E5E0D5',
    300: '#D1CCBF',
    400: '#9A958A',
    500: '#6B665C',
    600: '#4A4A4A',
    700: '#3A3A3A',
    800: '#1C1F1C',
    900: '#111311',
  },
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ============================================
// SEMANTIC COLORS - Light & Dark mode
// ============================================

export interface SemanticColors {
  // Core
  primary: string;
  primaryMuted: string;
  secondary: string;
  accent: string;
  accentMuted: string;
  // Surfaces
  background: string;
  backgroundAlt: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;
  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;
  /** Alias for textPrimary — legacy shorthand used in some screens */
  text: string;
  /** Card/tile background — alias for surface */
  card: string;
  // Borders
  border: string;
  borderLight: string;
  // Overlay
  overlay: string;
  // Status
  success: string;
  warning: string;
  error: string;
  info: string;
}

export const lightColors: SemanticColors = {
  primary: palette.forest[500],
  primaryMuted: palette.forest[50],
  secondary: palette.ocean[500],
  accent: palette.terracotta[500],
  accentMuted: palette.terracotta[50],
  background: palette.gray[50],
  backgroundAlt: palette.gray[100],
  surface: palette.white,
  surfaceAlt: '#F7F4EE',
  surfaceElevated: palette.forest[600],
  textPrimary: palette.gray[800],
  textSecondary: palette.gray[600],
  textMuted: palette.gray[400],
  textOnPrimary: palette.gray[50],
  text: palette.gray[800],
  card: palette.white,
  border: palette.gray[200],
  borderLight: palette.gray[100],
  overlay: 'rgba(28, 31, 28, 0.5)',
  success: '#3FA66B',
  warning: '#E8A23A',
  error: '#C44536',
  info: '#2A6F97',
};

export const darkColors: SemanticColors = {
  primary: palette.forest[400],
  primaryMuted: palette.forest[800],
  secondary: palette.ocean[300],
  accent: palette.terracotta[400],
  accentMuted: palette.terracotta[900],
  background: palette.gray[900],
  backgroundAlt: palette.gray[800],
  surface: palette.forest[700],
  surfaceAlt: palette.forest[800],
  surfaceElevated: palette.forest[600],
  textPrimary: palette.gray[50],
  textSecondary: palette.gray[300],
  textMuted: palette.gray[400],
  textOnPrimary: palette.gray[50],
  text: palette.gray[50],
  card: palette.forest[700],
  border: palette.forest[700],
  borderLight: palette.forest[800],
  overlay: 'rgba(0, 0, 0, 0.6)',
  success: '#3CB371',
  warning: '#D4A574',
  error: '#D65A4A',
  info: '#7EC8E3',
};

// ============================================
// CATEGORY COLORS - Used across map, cards, badges
// ============================================

export const categoryColors: Record<string, string> = {
  // Nature
  natureza: '#3F6F4A',
  trilhos: '#6BBF9A',
  cascatas: '#4BA3C3',
  percursos: '#6BBF9A',
  ecovias: '#6BBF9A',
  // Heritage
  patrimonio: '#8C7A6B',
  aldeias: '#C49A6C',
  castelos: '#8C7A6B',
  arqueologia: '#78716C',
  religioso: '#6366F1',
  // Culture
  museus: '#6A4C93',
  arte: '#6A4C93',
  cultura: '#6A4C93',
  festas: '#E8B649',
  lendas: '#1C1F33',
  // Food & drink
  gastronomia: '#E8B649',
  vinho: '#7C3AED',
  pao: '#B08556',
  azeite: '#84CC16',
  // Sea & water
  praias: '#7EC8E3',
  piscinas: '#7EC8E3',
  surf: '#2A6F97',
  // Landscape
  miradouros: '#2A6F97',
  secretos: '#2F4F4F',
  geossitios: '#A67C52',
  // Routes
  rotas: '#6BBF9A',
  eventos: '#E8B649',
  cultural: '#EC4899',
};

// Widget state colors (tides, surf, status indicators)
export const stateColors = {
  tide: {
    rising: '#3B82F6',
    falling: '#C49A6C',
    high: '#22C55E',
    low: '#EF4444',
  },
  surf: {
    excellent: '#22C55E',
    good: '#3B82F6',
    fair: '#C49A6C',
    poor: '#EF4444',
    flat: '#6B7280',
  },
  event: {
    festas: '#C49A6C',
    religioso: '#8B5CF6',
    gastronomia: '#EF4444',
    natureza: '#22C55E',
    cultural: '#06B6D4',
    festival: '#EC4899',
  },
  rarity: {
    epico: '#EAB308',
    raro: '#8B5CF6',
    incomum: '#06B6D4',
  },
  contribution: {
    story: '#8B5CF6',
    correction: '#C49A6C',
    new_item: '#22C55E',
    photo: '#3B82F6',
  },
} as const;

// Map-specific colors (subset for clarity)
export const mapColors: Record<string, string> = {
  miradouros: '#2A6F97',
  trilhos: '#3F6F4A',
  cascatas: '#4BA3C3',
  aldeias: '#C49A6C',
  patrimonio: '#8C7A6B',
  praias: '#7EC8E3',
  museus: '#6A4C93',
  gastronomia: '#E8B649',
  secretos: '#2F4F4F',
};

// ============================================
// COLOR UTILITIES
// ============================================

/**
 * Add opacity to a hex color.
 * @example withOpacity('#2E5E4E', 0.2) => 'rgba(46, 94, 78, 0.2)'
 */
export function withOpacity(hex: string, opacity: number): string {
  const cleaned = hex.replace('#', '');
  const r = parseInt(cleaned.substring(0, 2), 16);
  const g = parseInt(cleaned.substring(2, 4), 16);
  const b = parseInt(cleaned.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * Get color for a category, with fallback.
 */
export function getCategoryColor(category: string): string {
  return categoryColors[category] || palette.forest[500];
}

/**
 * Get color with opacity for a category (useful for backgrounds).
 */
export function getCategoryBg(category: string, opacity = 0.12): string {
  return withOpacity(getCategoryColor(category), opacity);
}
