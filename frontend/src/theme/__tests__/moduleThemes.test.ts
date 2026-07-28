import {
  moduleThemes,
  getModuleTheme,
  contrastRatio,
  luminance,
  onColor,
} from '../colors';

/** Módulos temáticos que a app expõe ao utilizador. */
const EXPECTED_MODULES = [
  'biodiversidade',
  'costa',
  'fauna',
  'flora',
  'gastronomia',
  'cultura-maritima',
  'infraestrutura',
  'economia',
  'prehistoria',
  'musica',
  'rotas-culturais',
  'inclusivo',
];

describe('theme/moduleThemes', () => {
  it('define os 12 módulos temáticos', () => {
    EXPECTED_MODULES.forEach(m => {
      expect(moduleThemes[m]).toBeDefined();
    });
    expect(Object.keys(moduleThemes)).toHaveLength(EXPECTED_MODULES.length);
  });

  it('cada módulo traz a paleta completa', () => {
    const missing: string[] = [];
    Object.entries(moduleThemes).forEach(([name, t]) => {
      (['bg', 'card', 'accent', 'accentMuted', 'textPrimary', 'textSecondary', 'textMuted'] as const)
        .forEach(key => {
          if (!t[key]) missing.push(`${name}.${key}`);
        });
    });
    expect(missing).toEqual([]);
  });

  // WCAG AA para texto normal = 4.5:1
  it('textPrimary cumpre AA sobre bg e card', () => {
    const offenders = Object.entries(moduleThemes).flatMap(([name, t]) => [
      ...(contrastRatio(t.textPrimary, t.bg) < 4.5
        ? [`${name}: textPrimary/bg = ${contrastRatio(t.textPrimary, t.bg).toFixed(2)}`] : []),
      ...(contrastRatio(t.textPrimary, t.card) < 4.5
        ? [`${name}: textPrimary/card = ${contrastRatio(t.textPrimary, t.card).toFixed(2)}`] : []),
    ]);
    expect(offenders).toEqual([]);
  });

  it('textSecondary cumpre AA sobre card', () => {
    const offenders = Object.entries(moduleThemes)
      .filter(([, t]) => contrastRatio(t.textSecondary, t.card) < 4.5)
      .map(([name, t]) => `${name} = ${contrastRatio(t.textSecondary, t.card).toFixed(2)}`);
    expect(offenders).toEqual([]);
  });

  it('o accent destaca-se do card (AA para texto grande, 3:1)', () => {
    const offenders = Object.entries(moduleThemes)
      .filter(([, t]) => contrastRatio(t.accent, t.card) < 3)
      .map(([name, t]) => `${name} = ${contrastRatio(t.accent, t.card).toFixed(2)}`);
    expect(offenders).toEqual([]);
  });

  it('onColor devolve sempre um par legível sobre o accent', () => {
    const offenders = Object.entries(moduleThemes)
      .filter(([, t]) => contrastRatio(onColor(t.accent), t.accent) < 4.5)
      .map(([name, t]) => `${name} = ${contrastRatio(onColor(t.accent), t.accent).toFixed(2)}`);
    expect(offenders).toEqual([]);
  });

  it('costa e economia são temas escuros', () => {
    // Regressão: ambos eram claros e desalinhavam dos restantes módulos
    expect(luminance(moduleThemes.costa.bg)).toBeLessThan(0.1);
    expect(luminance(moduleThemes.economia.bg)).toBeLessThan(0.1);
  });

  it('getModuleTheme cai no tema claro por omissão', () => {
    const fallback = getModuleTheme('modulo-inexistente');
    expect(fallback.bg).toBeTruthy();
    expect(contrastRatio(fallback.textPrimary, fallback.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('theme/colors — utilitários de contraste', () => {
  it('luminance nos extremos', () => {
    expect(luminance('#000000')).toBeCloseTo(0, 5);
    expect(luminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('contrastRatio é simétrico e limitado a 21:1', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#123456', '#123456')).toBeCloseTo(1, 5);
  });

  it('onColor escolhe texto escuro sobre accents claros', () => {
    expect(onColor('#F59E0B')).toBe('#0E1E1A'); // âmbar → ink de marca
    expect(onColor('#38BDF8')).toBe('#0E1E1A'); // azul-céu → ink de marca
    expect(onColor('#0F0720')).toBe('#FFFFFF'); // roxo profundo → branco
  });

  it('onColor escala para preto puro quando o ink de marca não chega a AA', () => {
    // Os roxos de luminância média deixam o ink de marca abaixo de 4.5:1
    expect(onColor('#8B5CF6')).toBe('#000000');
    expect(onColor('#A855F7')).toBe('#000000');
  });
});
