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
import { useEffect, useState } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
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

/**
 * Dimensões com que a exportação estática renderiza: no servidor não há janela
 * e o react-native-web devolve 0×0 (layout de telemóvel).
 */
const SERVER_WINDOW = { width: 0, height: 0 };

/** Passa a true depois da primeira montagem no browser (fim da hidratação). */
let hydrationDone = false;

/** @internal Só para testes: volta ao estado de antes da hidratação. */
export const resetHydrationStateForTests = () => {
  hydrationDone = false;
};

/**
 * Na web, o primeiro render no browser hidrata o HTML gerado no servidor e
 * tem de produzir exatamente o mesmo — senão o React acusa erro de hidratação
 * (#418) e volta a desenhar tudo no cliente. Por isso esse render usa as
 * dimensões do servidor e só depois da montagem passa às reais. Componentes
 * montados mais tarde (navegação no cliente) já não hidratam e usam logo as
 * dimensões reais, sem salto de layout. No nativo não há hidratação.
 */
function useHydratedWindow() {
  const real = useWindowDimensions();
  const [hydrated, setHydrated] = useState(Platform.OS !== 'web' || hydrationDone);
  useEffect(() => {
    hydrationDone = true;
    setHydrated(true);
  }, []);
  return hydrated ? real : SERVER_WINDOW;
}

export function useResponsive(): ResponsiveInfo {
  const { width, height } = useHydratedWindow();

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
