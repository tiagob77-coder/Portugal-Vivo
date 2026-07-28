/**
 * Luz de Portugal — camada de luz natural por período do dia
 *
 * Uma película de cor sobre toda a app que acompanha a hora real, evocando
 * a luz de Portugal ao longo do dia. Aplica-se por cima do conteúdo em
 * `soft-light` (web) ou com opacidade reduzida (nativo, sem blend modes).
 *
 * O onboarding fica de fora — essas imagens já trazem luz própria.
 */

export type LuzPeriod = 'madrugada' | 'manha' | 'tarde' | 'anoitecer' | 'noite';
export type LuzMode = LuzPeriod | 'auto' | 'off';

export interface LuzDefinition {
  id: LuzPeriod;
  label: string;
  /** Nome do ícone MaterialIcons */
  icon: string;
  /** Intervalo horário [início, fim) em horas locais */
  hours: [number, number];
  /** Paragens do gradiente, de cima para baixo */
  colors: [string, string, string];
  /** Opacidade da película em `soft-light` (web) */
  opacity: number;
  /**
   * Opacidade em nativo, onde não há `mix-blend-mode`. Mais baixa porque a
   * sobreposição direta é bastante mais agressiva do que o soft-light.
   */
  opacityNative: number;
}

export const LUZ_PERIODS: LuzDefinition[] = [
  {
    id: 'madrugada',
    label: 'Madrugada',
    icon: 'bedtime',
    hours: [0, 6],
    colors: ['#0A1B36', '#173250', '#254463'],
    opacity: 0.62,
    opacityNative: 0.22,
  },
  {
    id: 'manha',
    label: 'Manhã',
    icon: 'wb-sunny',
    hours: [6, 12],
    colors: ['#FFE6BC', '#FFF7E8', '#EAF6FF'],
    opacity: 0.5,
    opacityNative: 0.16,
  },
  {
    id: 'tarde',
    label: 'Tarde',
    icon: 'light-mode',
    hours: [12, 18],
    colors: ['#FFF4D8', '#FFE3B2', '#FFD196'],
    opacity: 0.44,
    opacityNative: 0.14,
  },
  {
    id: 'anoitecer',
    label: 'Anoitecer',
    icon: 'wb-twilight',
    hours: [18, 21],
    colors: ['#FFB271', '#E76F49', '#6E4A85'],
    opacity: 0.5,
    opacityNative: 0.18,
  },
  {
    id: 'noite',
    label: 'Noite',
    icon: 'nights-stay',
    hours: [21, 24],
    colors: ['#0C1A31', '#1A2A4A', '#22345B'],
    opacity: 0.55,
    opacityNative: 0.2,
  },
];

/** Posições das paragens do gradiente (cima → baixo), por período. */
export const LUZ_GRADIENT_LOCATIONS: Record<LuzPeriod, [number, number, number]> = {
  madrugada: [0, 0.48, 1],
  manha: [0, 0.52, 1],
  tarde: [0, 0.58, 1],
  anoitecer: [0, 0.44, 1],
  noite: [0, 0.58, 1],
};

/** Período correspondente a uma hora local (default: agora). */
export function luzPeriodForHour(hour: number): LuzPeriod {
  const found = LUZ_PERIODS.find((p) => hour >= p.hours[0] && hour < p.hours[1]);
  return (found ?? LUZ_PERIODS[2]).id; // fallback: tarde
}

/** Período ativo neste momento. */
export function luzNow(now: Date = new Date()): LuzPeriod {
  return luzPeriodForHour(now.getHours());
}

/** Resolve o modo escolhido pelo utilizador no período efetivamente pintado. */
export function resolveLuz(mode: LuzMode, now: Date = new Date()): LuzPeriod | 'off' {
  if (mode === 'off') return 'off';
  if (mode === 'auto') return luzNow(now);
  return mode;
}

export function luzDefinition(period: LuzPeriod): LuzDefinition {
  return LUZ_PERIODS.find((p) => p.id === period) ?? LUZ_PERIODS[2];
}

/** Opções apresentadas no Perfil, pela ordem em que aparecem. */
export const LUZ_OPTIONS: { id: LuzMode; label: string; icon: string }[] = [
  { id: 'auto', label: 'Automático', icon: 'schedule' },
  ...LUZ_PERIODS.map((p) => ({ id: p.id as LuzMode, label: p.label, icon: p.icon })),
  { id: 'off', label: 'Desligar', icon: 'do-not-disturb-on' },
];

/** Texto de apoio mostrado por baixo do título no Perfil. */
export function luzHint(mode: LuzMode, now: Date = new Date()): string {
  if (mode === 'off') return 'Desligada · cores neutras';
  const current = luzDefinition(luzNow(now));
  if (mode === 'auto') return `Automático · agora ${current.label.toLowerCase()}`;
  return `Fixa em ${luzDefinition(mode as LuzPeriod).label.toLowerCase()}`;
}
