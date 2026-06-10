/**
 * useResponsive — hook reativo de layout mobile-first.
 *
 * Substitui o anti-padrão `const { width } = Dimensions.get('window')` a nível
 * de módulo (calculado uma vez, não reage a rotação/resize). Usa
 * `useWindowDimensions`, que re-renderiza quando o ecrã muda de tamanho ou
 * orientação — essencial para web e para rotação em tablet/telemóvel.
 *
 * Usage:
 *   const { width, isPhone, isTablet, columns, contentMaxWidth } = useResponsive();
 *   const cols = columns(160, spacing.md);   // nº de colunas que cabem
 */
import { useWindowDimensions } from 'react-native';
import {
  BREAKPOINTS,
  CONTENT_MAX_WIDTH,
  CONTENT_MAX_WIDTH_WIDE,
} from '../theme/breakpoints';

export type DeviceSize = 'phone' | 'tablet' | 'desktop';

export interface ResponsiveInfo {
  /** Largura atual da janela (reativa). */
  width: number;
  /** Altura atual da janela (reativa). */
  height: number;
  /** < 768px */
  isPhone: boolean;
  /** Telemóvel grande / phablet (>= 480px e < 768px). */
  isPhoneLarge: boolean;
  /** >= 768px e < 1024px */
  isTablet: boolean;
  /** >= 1024px */
  isDesktop: boolean;
  /** Orientação landscape (largura > altura). */
  isLandscape: boolean;
  /** Classe de dispositivo. */
  size: DeviceSize;
  /** Largura útil do conteúdo, limitada para leitura confortável em ecrãs largos. */
  contentMaxWidth: number;
  /** Largura útil para grids largas (cards/dashboards). */
  contentMaxWidthWide: number;
  /**
   * Nº de colunas que cabem dado um tamanho mínimo de item.
   * @param minItemWidth largura mínima desejada por item (px)
   * @param gap espaço entre colunas (px)
   * @param max limite máximo de colunas
   */
  columns: (minItemWidth: number, gap?: number, max?: number) => number;
  /** Escolhe um valor consoante a classe de dispositivo (mobile-first). */
  select: <T>(values: { phone: T; tablet?: T; desktop?: T }) => T;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useWindowDimensions();

  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet && width < BREAKPOINTS.desktop;
  const isPhone = width < BREAKPOINTS.tablet;
  const isPhoneLarge = width >= BREAKPOINTS.phoneLarge && width < BREAKPOINTS.tablet;
  const isLandscape = width > height;
  const size: DeviceSize = isDesktop ? 'desktop' : isTablet ? 'tablet' : 'phone';

  const contentMaxWidth = Math.min(width, CONTENT_MAX_WIDTH);
  const contentMaxWidthWide = Math.min(width, CONTENT_MAX_WIDTH_WIDE);

  const columns = (minItemWidth: number, gap = 0, max = 6): number => {
    const usable = Math.min(width, contentMaxWidthWide) + gap;
    const fit = Math.floor(usable / (minItemWidth + gap));
    return Math.max(1, Math.min(max, fit));
  };

  const select = <T,>(values: { phone: T; tablet?: T; desktop?: T }): T => {
    if (isDesktop && values.desktop !== undefined) return values.desktop;
    if ((isTablet || isDesktop) && values.tablet !== undefined) return values.tablet;
    return values.phone;
  };

  return {
    width,
    height,
    isPhone,
    isPhoneLarge,
    isTablet,
    isDesktop,
    isLandscape,
    size,
    contentMaxWidth,
    contentMaxWidthWide,
    columns,
    select,
  };
}

export default useResponsive;
