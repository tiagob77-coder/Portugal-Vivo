/**
 * Breakpoints - Portugal Vivo (mobile-first)
 *
 * A app é desenhada primeiro para telemóvel. Estes breakpoints servem para
 * adaptar grids e limitar a largura do conteúdo em ecrãs maiores (tablet/web)
 * para que a leitura se mantenha confortável e "phone-shaped".
 *
 * Usage:
 *   import { BREAKPOINTS, CONTENT_MAX_WIDTH } from '../theme/breakpoints';
 *   import { useResponsive } from '../hooks/useResponsive';
 */

/** Largura mínima (px) a partir da qual cada classe de dispositivo começa. */
export const BREAKPOINTS = {
  /** Telemóvel — base mobile-first */
  phone: 0,
  /** Telemóvel grande / phablet */
  phoneLarge: 480,
  /** Tablet (portrait) */
  tablet: 768,
  /** Desktop / tablet landscape */
  desktop: 1024,
  /** Ecrã largo */
  wide: 1440,
} as const;

export type BreakpointKey = keyof typeof BREAKPOINTS;

/**
 * Largura máxima do conteúdo principal em ecrãs largos.
 * Mantém a coluna de leitura com proporções de telemóvel mesmo no browser.
 */
export const CONTENT_MAX_WIDTH = 640;

/** Largura máxima para layouts mais largos (grids de cards, dashboards). */
export const CONTENT_MAX_WIDTH_WIDE = 1080;

export default BREAKPOINTS;
