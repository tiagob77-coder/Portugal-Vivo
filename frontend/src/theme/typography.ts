/**
 * Typography System - Portugal Vivo
 * 
 * Escala tipográfica consistente para todo o app.
 * Baseada em múltiplos de 4px com ratios de linha adequados.
 * 
 * Usage:
 *   import { typography } from '../theme/typography';
 *   <Text style={[typography.h2, { color: colors.textPrimary }]}>Título</Text>
 */

import { Platform, TextStyle } from 'react-native';

/**
 * Famílias tipográficas.
 * Serif (Cormorant Garamond) dá voz editorial/histórica aos títulos — é
 * carregada em web via <link> no _layout; em nativo cai num serif do sistema.
 * Corpo e UI mantêm-se no humanista do sistema para legibilidade.
 */
export const fontFamilies = {
  serif: Platform.select({
    web: '"Cormorant Garamond", Georgia, serif',
    ios: 'Georgia',
    android: 'serif',
    default: 'serif',
  }) as string,
  sans: 'System',
};

export interface TypographyScale {
  // Display (Hero sections)
  display: TextStyle;
  
  // Headings
  h1: TextStyle;
  h2: TextStyle;
  h3: TextStyle;
  h4: TextStyle;
  
  // Body text
  body: TextStyle;
  bodyLarge: TextStyle;
  bodyBold: TextStyle;
  bodySmall: TextStyle;
  
  // UI elements
  button: TextStyle;
  buttonSmall: TextStyle;
  caption: TextStyle;
  label: TextStyle;
  overline: TextStyle;
  
  // Special
  stat: TextStyle;
  quote: TextStyle;
}

/**
 * Core typography scale
 * Todas as medidas em pixels, line-heights calculados para legibilidade
 */
export const typography: TypographyScale = {
  // Display - Hero sections, landing pages
  display: {
    fontFamily: fontFamilies.serif,
    fontSize: 40,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -0.8,
  },

  // Headings - Hierarquia clara
  h1: {
    fontFamily: fontFamilies.serif,
    fontSize: 32,
    lineHeight: 40,
    fontWeight: '700',
    letterSpacing: -0.5,
  },

  h2: {
    fontFamily: fontFamilies.serif,
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  
  h3: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '600',
    letterSpacing: 0,
  },
  
  h4: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  
  // Body text - Leitura confortável
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
    letterSpacing: 0,
  },
  
  bodyLarge: {
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0,
  },
  
  bodyBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: 0,
  },
  
  bodySmall: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    letterSpacing: 0,
  },
  
  // UI elements - Consistência funcional
  button: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  buttonSmall: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '400',
    letterSpacing: 0.2,
  },
  
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  
  overline: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  
  // Special use cases
  stat: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  
  quote: {
    fontFamily: fontFamilies.serif,
    fontSize: 18,
    lineHeight: 28,
    fontWeight: '400',
    letterSpacing: 0,
    fontStyle: 'italic',
  },
};

/**
 * Font weights helper
 * Para uso direto quando necessário override
 */
export const fontWeights = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

/**
 * Font sizes helper
 * Para casos edge onde typography predefinido não se aplica
 */
export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 40,
};

/**
 * Line heights helper
 */
export const lineHeights = {
  tight: 1.25,
  normal: 1.5,
  relaxed: 1.75,
};

/**
 * Letter spacing helper (em)
 */
export const letterSpacing = {
  tighter: -0.05,
  tight: -0.025,
  normal: 0,
  wide: 0.025,
  wider: 0.05,
  widest: 0.1,
};

export default typography;
