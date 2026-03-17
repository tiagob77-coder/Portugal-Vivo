/**
 * Portugal Vivo - Design System & Theme v3
 *
 * Single source of truth for colors, typography, spacing, and component styles.
 * All colors come from ./colors.ts. ThemeContext provides light/dark mode.
 */

// Re-export color system (single source of truth)
export {
  palette,
  lightColors,
  darkColors,
  categoryColors,
  mapColors,
  withOpacity,
  getCategoryColor,
  getCategoryBg,
} from './colors';
export type { SemanticColors } from './colors';

// Re-export ThemeContext (runtime light/dark)
export { useTheme, ThemeProvider } from '../context/ThemeContext';
export type { ThemeMode } from '../context/ThemeContext';

// Backward compat: `colors` merges palette scales with flat semantic keys
// that the old theme/index.ts exported (background, success, error, categories, etc.)
import { palette as _palette, categoryColors as _catColors } from './colors';

export const colors = {
  ..._palette,
  background: {
    primary: _palette.gray[50],       // #FAF8F3
    secondary: _palette.white,        // #FFFFFF
    tertiary: '#F7F4EE',
    dark: _palette.forest[500],       // #2E5E4E
  },
  success: '#3FA66B',
  warning: '#E8A23A',
  error: '#C44536',
  info: '#2A6F97',
  categories: _catColors,
} as const;

// ============================================
// TYPOGRAPHY
// ============================================

export const typography = {
  fontFamily: {
    sans: 'System',
    heading: 'System',
  },
  fontSize: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
    '5xl': 40,
  },
  fontWeight: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
};

// ============================================
// SPACING (4px grid)
// ============================================

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
};

// ============================================
// BORDERS & RADII
// ============================================

export const borders = {
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
    '2xl': 20,
    '3xl': 24,
    full: 9999,
  },
};

// ============================================
// SHADOWS
// ============================================

export const shadows = {
  sm: {
    shadowColor: '#1C1F1C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#1C1F1C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  lg: {
    shadowColor: '#1C1F1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  xl: {
    shadowColor: '#1C1F1C',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
};

// ============================================
// REGION IMAGES
// ============================================

export const regionImages = {
  hero: 'https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/io31y0td_hero-portugal.jpg',
  norte: 'https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/0122scd6_regiao-norte.jpg',
  centro: 'https://customer-assets.emergentagent.com/job_24ca32ce-1389-47f3-a7d2-be353c2637e3/artifacts/l8xewvuk_regiao-centro.jpg',
  lisboa: 'https://customer-assets.emergentagent.com/job_24ca32ce-1389-47f3-a7d2-be353c2637e3/artifacts/ny3oen96_regiao-lisboa.jpg',
  alentejo: 'https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/jylr9nd1_regiao-alentejo.jpg',
  algarve: 'https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/ey1o5cfg_regiao-algarve.jpg',
  acores: 'https://customer-assets.emergentagent.com/job_3262e738-25ea-4984-9682-d41451888e20/artifacts/ctr0hkwp_regiao-acores.jpg',
  madeira: 'https://customer-assets.emergentagent.com/job_24ca32ce-1389-47f3-a7d2-be353c2637e3/artifacts/zik2moq4_regiao-madeira.jpg',
};

// ============================================
// COMPONENT DEFAULTS (light-mode baseline)
// ============================================

import { palette } from './colors';

export const components = {
  buttonPrimary: {
    backgroundColor: palette.terracotta[500],
    color: '#FFFFFF',
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borders.radius.lg,
  },
  buttonSecondary: {
    backgroundColor: palette.forest[50],
    color: palette.forest[500],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borders.radius.lg,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: borders.radius.xl,
    padding: spacing[4],
    ...shadows.md,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: palette.gray[200],
    borderWidth: 1,
    borderRadius: borders.radius.lg,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    color: palette.gray[800],
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
    borderTopColor: palette.gray[200],
    borderTopWidth: 1,
  },
  chip: {
    backgroundColor: palette.forest[50],
    color: palette.forest[500],
    paddingVertical: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: borders.radius.full,
  },
};

// ============================================
// DEFAULT EXPORT
// ============================================

const theme = {
  palette,
  typography,
  spacing,
  borders,
  shadows,
  regionImages,
  components,
};

export default theme;
