import {
  LUZ_PERIODS,
  LUZ_OPTIONS,
  LUZ_GRADIENT_LOCATIONS,
  luzPeriodForHour,
  luzNow,
  resolveLuz,
  luzDefinition,
  luzHint,
} from '../luz';

const at = (hour: number) => new Date(2026, 6, 28, hour, 0, 0);

describe('theme/luz', () => {
  it('cobre as 24 horas sem lacunas nem sobreposições', () => {
    for (let h = 0; h < 24; h++) {
      const matches = LUZ_PERIODS.filter(p => h >= p.hours[0] && h < p.hours[1]);
      expect(matches).toHaveLength(1);
    }
  });

  it('mapeia as horas para o período correcto', () => {
    expect(luzPeriodForHour(0)).toBe('madrugada');
    expect(luzPeriodForHour(5)).toBe('madrugada');
    expect(luzPeriodForHour(6)).toBe('manha');
    expect(luzPeriodForHour(11)).toBe('manha');
    expect(luzPeriodForHour(12)).toBe('tarde');
    expect(luzPeriodForHour(17)).toBe('tarde');
    expect(luzPeriodForHour(18)).toBe('anoitecer');
    expect(luzPeriodForHour(20)).toBe('anoitecer');
    expect(luzPeriodForHour(21)).toBe('noite');
    expect(luzPeriodForHour(23)).toBe('noite');
  });

  it('cai em tarde para horas fora do intervalo', () => {
    expect(luzPeriodForHour(99)).toBe('tarde');
    expect(luzPeriodForHour(-1)).toBe('tarde');
  });

  it('luzNow usa a hora da data fornecida', () => {
    expect(luzNow(at(7))).toBe('manha');
    expect(luzNow(at(22))).toBe('noite');
  });

  describe('resolveLuz', () => {
    it('devolve off quando desligada, independentemente da hora', () => {
      expect(resolveLuz('off', at(9))).toBe('off');
      expect(resolveLuz('off', at(23))).toBe('off');
    });

    it('segue a hora em automático', () => {
      expect(resolveLuz('auto', at(3))).toBe('madrugada');
      expect(resolveLuz('auto', at(19))).toBe('anoitecer');
    });

    it('respeita um período fixo, ignorando a hora', () => {
      expect(resolveLuz('noite', at(9))).toBe('noite');
      expect(resolveLuz('manha', at(23))).toBe('manha');
    });
  });

  it('cada período tem 3 cores e 3 posições de gradiente', () => {
    LUZ_PERIODS.forEach(p => {
      expect(p.colors).toHaveLength(3);
      p.colors.forEach(c => expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/));
      expect(LUZ_GRADIENT_LOCATIONS[p.id]).toHaveLength(3);
    });
  });

  it('a opacidade nativa é mais contida que a da web (sem soft-light)', () => {
    LUZ_PERIODS.forEach(p => {
      expect(p.opacityNative).toBeLessThan(p.opacity);
      expect(p.opacityNative).toBeGreaterThan(0);
      expect(p.opacity).toBeLessThanOrEqual(1);
    });
  });

  it('as opções do Perfil são auto + 5 períodos + off', () => {
    expect(LUZ_OPTIONS.map(o => o.id)).toEqual([
      'auto', 'madrugada', 'manha', 'tarde', 'anoitecer', 'noite', 'off',
    ]);
  });

  it('luzDefinition devolve tarde para um período desconhecido', () => {
    expect(luzDefinition('inexistente' as never).id).toBe('tarde');
  });

  it('luzHint descreve o modo activo', () => {
    expect(luzHint('off', at(9))).toBe('Desligada · cores neutras');
    expect(luzHint('auto', at(9))).toBe('Automático · agora manhã');
    expect(luzHint('noite', at(9))).toBe('Fixa em noite');
  });
});
