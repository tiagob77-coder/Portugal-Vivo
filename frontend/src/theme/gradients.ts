/**
 * Gradient System — Portugal Vivo
 *
 * Presets nomeados para substituir gradientes pretos puros (rgba(0,0,0,…))
 * espalhados pela app. A base escura é o verde-pinhal (forest[900]) em vez de
 * preto, dando calor terroso e coesão com a cor primária da marca.
 *
 * Usage:
 *   import { gradients } from '../theme/gradients';
 *   <LinearGradient colors={[...gradients.cardScrim.colors]}
 *                   locations={[...gradients.cardScrim.locations]} />
 */

export interface GradientPreset {
  colors: readonly [string, string, string];
  locations: readonly [number, number, number];
}

// Base escura quente (forest[900] = #0E1E1A → rgb(14,30,26))
const PINE = '14,30,26';

export const gradients = {
  /** Scrim vertical para cartões com imagem — legível e quente (não preto). */
  cardScrim: {
    colors: ['transparent', `rgba(${PINE},0.45)`, `rgba(${PINE},0.88)`],
    locations: [0, 0.5, 1],
  },

  /** Scrim mais suave para cartões altos / heros secundários. */
  cardScrimSoft: {
    colors: ['transparent', `rgba(${PINE},0.25)`, `rgba(${PINE},0.7)`],
    locations: [0, 0.55, 1],
  },

  /** Hero do modo escuro — pinhal profundo a desvanecer. */
  heroDark: {
    colors: [`rgba(${PINE},0.85)`, `rgba(${PINE},0.5)`, 'transparent'],
    locations: [0, 0.5, 1],
  },
} as const satisfies Record<string, GradientPreset>;

/**
 * Gradientes do hero que "respiram" com a hora do dia.
 * Manhã dourada → tarde terracota → noite azul-cobalto (azulejo).
 * A cor forte fica no topo (onde costuma estar o texto), desvanecendo em baixo.
 */
export const heroPeriods = {
  morning: {
    colors: ['rgba(193,138,42,0.82)', 'rgba(193,138,42,0.40)', 'transparent'],
    locations: [0, 0.55, 1],
  },
  afternoon: {
    colors: ['rgba(168,77,50,0.82)', 'rgba(168,77,50,0.40)', 'transparent'],
    locations: [0, 0.55, 1],
  },
  evening: {
    colors: ['rgba(19,69,103,0.86)', 'rgba(19,69,103,0.45)', 'transparent'],
    locations: [0, 0.55, 1],
  },
} as const satisfies Record<string, GradientPreset>;

export type HeroPeriod = keyof typeof heroPeriods;

/**
 * Cor de scrim verde-pinhal a uma dada opacidade. Substitui os scrims pretos
 * planos (`rgba(0,0,0,X)`) usados em overlays de cartões/heros, preservando a
 * opacidade original mas dando a temperatura quente da marca (coeso com cardScrim).
 *
 * @example <LinearGradient colors={['transparent', scrimPine(0.85)]} />
 */
export const scrimPine = (opacity: number): string => `rgba(${PINE},${opacity})`;

export default gradients;
