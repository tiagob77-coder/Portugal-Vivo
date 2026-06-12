/**
 * Spacing System - Portugal Vivo
 * 
 * Sistema de espaçamento baseado em múltiplos de 4px.
 * Grid base: 4px | Escala: 4, 8, 12, 16, 24, 32, 48, 64
 * 
 * Usage:
 *   import { spacing, containers } from '../theme/spacing';
 *   <View style={{ padding: spacing.md, marginTop: spacing.lg }} />
 */

/**
 * Base spacing scale (4px grid)
 * Usar apenas estes valores para consistência
 */
export const spacing = {
  /** 4px - Espaçamento mínimo entre elementos inline */
  xs: 4,
  
  /** 8px - Espaçamento entre elementos pequenos (badges, chips) */
  sm: 8,
  
  /** 12px - Espaçamento entre cards numa grid */
  md: 12,
  
  /** 16px - Padding padrão de containers e cards */
  base: 16,
  
  /** 20px - Espaçamento entre seções menores */
  lg: 20,
  
  /** 24px - Espaçamento entre seções principais */
  xl: 24,
  
  /** 32px - Espaçamento entre blocos de conteúdo */
  '2xl': 32,
  
  /** 48px - Espaçamento entre seções major */
  '3xl': 48,
  
  /** 64px - Espaçamento hero/landing */
  '4xl': 64,
} as const;

/**
 * Container paddings consistentes
 */
export const containers = {
  /** Padding padrão de página/tela */
  page: {
    paddingHorizontal: spacing.base,  // 16px
    paddingVertical: spacing.lg,      // 20px
  },
  
  /** Padding de card standard */
  card: {
    padding: spacing.base,  // 16px
  },
  
  /** Padding de card compacto */
  cardCompact: {
    padding: spacing.md,  // 12px
  },
  
  /** Padding de card grande (features, promos) */
  cardLarge: {
    padding: spacing.xl,  // 24px
  },
  
  /** Margin entre seções de conteúdo */
  section: {
    marginBottom: spacing.xl,  // 24px
  },
  
  /** Margin entre blocos principais */
  block: {
    marginBottom: spacing['2xl'],  // 32px
  },
};

/**
 * Insets para SafeAreaView e bottom tabs
 */
export const insets = {
  /** Top safe area (status bar) */
  top: 44,
  
  /** Bottom safe area (home indicator iOS) */
  bottom: 34,
  
  /** Bottom tab bar height */
  tabBar: 60,
};

/**
 * Border radius consistency
 */
export const borderRadius = {
  /** Nenhum radius */
  none: 0,
  
  /** Subtle radius para inputs, badges */
  sm: 8,
  
  /** Standard radius para cards, botões */
  md: 12,
  
  /** Large radius para cards de destaque */
  lg: 16,
  
  /** Extra large para modais, sheets */
  xl: 24,
  
  /** Pill shape para chips, tags */
  pill: 999,
  
  /** Circular para avatares, icons */
  full: 9999,
} as const;

/**
 * Border widths
 */
export const borderWidth = {
  none: 0,
  hairline: 0.5,  // StyleSheet.hairlineWidth equivalent
  thin: 1,
  medium: 2,
  thick: 4,
} as const;

/**
 * Icon sizes consistency
 */
export const iconSizes = {
  /** Tiny icons em badges, labels */
  xs: 12,
  
  /** Small icons em botões secundários */
  sm: 16,
  
  /** Medium icons em botões, inputs */
  md: 20,
  
  /** Default icons em navegação, cards */
  base: 24,
  
  /** Large icons em headers */
  lg: 28,
  
  /** Extra large em features, empty states */
  xl: 32,
  
  /** Hero icons em landing, splash */
  '2xl': 48,
  
  /** Display icons */
  '3xl': 64,
} as const;

/**
 * Touch targets (WCAG compliance)
 */
export const touchTargets = {
  /** Minimum touch target iOS */
  iosMin: 44,

  /** Minimum touch target Android */
  androidMin: 48,

  /** Recommended comfortable touch target */
  comfortable: 56,
} as const;

/**
 * hitSlop padrão para expandir a área tocável de botões com ícone pequenos
 * (36-40px) até ao mínimo recomendado de 44px, sem alterar o layout visual.
 *
 * Usage:
 *   <TouchableOpacity hitSlop={HIT_SLOP} ...>
 */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/**
 * Elevation/Shadow depths
 * Para uso com shadow props ou elevation (Android)
 */
export const elevation = {
  none: 0,
  sm: 2,    // Cards, chips
  md: 4,    // Buttons, floating elements
  lg: 8,    // Modals, popovers
  xl: 16,   // Drawers, major overlays
  '2xl': 24, // Full-screen modals
} as const;

/**
 * Shadow presets para iOS
 * Usar com shadowColor, shadowOffset, shadowOpacity, shadowRadius
 */
export const shadows = {
  none: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
  },
  
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
} as const;

/**
 * Helper: Apply consistent card shadow
 * Works on both iOS and Android
 */
export const cardShadow = {
  ...shadows.md,
  elevation: elevation.md,
};

/**
 * Helper: Apply button shadow
 */
export const buttonShadow = {
  ...shadows.sm,
  elevation: elevation.sm,
};

export default spacing;
