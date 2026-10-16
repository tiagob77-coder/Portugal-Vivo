import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useResponsive, resetHydrationStateForTests } from '../useResponsive';
import { CONTENT_MAX_WIDTH } from '../../theme/breakpoints';

jest.mock('react-native', () => ({
  useWindowDimensions: jest.fn(),
  Platform: { OS: 'ios' },
}));
// O mesmo objeto que o hook lê — os casos web mudam-lhe o OS.
const mockPlatform = (jest.requireMock('react-native') as { Platform: { OS: string } }).Platform;

const mockDims = (width: number, height: number) => {
  (useWindowDimensions as jest.Mock).mockReturnValue({ width, height, scale: 2, fontScale: 1 });
};

describe('useResponsive', () => {
  it('classifies a phone width', () => {
    mockDims(375, 812);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isPhone).toBe(true);
    expect(result.current.isTablet).toBe(false);
    expect(result.current.isDesktop).toBe(false);
    expect(result.current.size).toBe('phone');
  });

  it('classifies a tablet width', () => {
    mockDims(800, 1100);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isTablet).toBe(true);
    expect(result.current.size).toBe('tablet');
  });

  it('classifies a desktop width', () => {
    mockDims(1440, 900);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.isDesktop).toBe(true);
    expect(result.current.isLandscape).toBe(true);
    expect(result.current.size).toBe('desktop');
  });

  it('caps content width on large screens', () => {
    mockDims(1920, 1080);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.contentMaxWidth).toBe(CONTENT_MAX_WIDTH);
  });

  it('computes responsive columns that fit the content area', () => {
    mockDims(375, 812);
    const { result } = renderHook(() => useResponsive());
    // 375px / ~180px item → 2 columns on a phone
    expect(result.current.columns(160, 12, 4)).toBe(2);
  });

  it('adds more columns on wide screens', () => {
    mockDims(1440, 900);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.columns(160, 12, 4)).toBe(4);
  });

  it('select() returns the mobile-first fallback on phone', () => {
    mockDims(375, 812);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.select({ phone: 'a', tablet: 'b', desktop: 'c' })).toBe('a');
  });

  it('select() prefers desktop value on desktop', () => {
    mockDims(1440, 900);
    const { result } = renderHook(() => useResponsive());
    expect(result.current.select({ phone: 'a', tablet: 'b', desktop: 'c' })).toBe('c');
  });
});

describe('useResponsive — hidratação na web', () => {
  // O módulo guarda se a hidratação já aconteceu: cada caso começa do zero.
  const loadWebHook = () => {
    mockPlatform.OS = 'web';
    resetHydrationStateForTests();
    return useResponsive;
  };

  afterEach(() => { mockPlatform.OS = 'ios'; });

  it('o render de hidratação usa as dimensões do servidor (0×0) e depois as reais', () => {
    mockDims(1440, 900);
    const useWebResponsive = loadWebHook();
    const widths: number[] = [];
    const { result } = renderHook(() => {
      const r = useWebResponsive();
      widths.push(r.width);
      return r;
    });

    expect(widths[0]).toBe(0); // igual ao HTML exportado → sem erro de hidratação
    expect(result.current.width).toBe(1440);
    expect(result.current.isDesktop).toBe(true);
  });

  it('depois da hidratação, um ecrã novo monta já com as dimensões reais', () => {
    mockDims(1440, 900);
    const useWebResponsive = loadWebHook();
    renderHook(() => useWebResponsive()); // hidratação da página inicial

    const widths: number[] = [];
    renderHook(() => {
      const r = useWebResponsive();
      widths.push(r.width);
      return r;
    });
    expect(widths[0]).toBe(1440); // navegação no cliente: sem salto de layout
  });

  it('no nativo não há hidratação: usa logo as dimensões reais', () => {
    mockDims(800, 1100);
    const widths: number[] = [];
    renderHook(() => {
      const r = useResponsive();
      widths.push(r.width);
      return r;
    });
    expect(widths[0]).toBe(800);
  });
});
