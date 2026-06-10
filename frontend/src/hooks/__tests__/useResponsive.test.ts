import { renderHook } from '@testing-library/react-native';
import { useWindowDimensions } from 'react-native';
import { useResponsive } from '../useResponsive';
import { CONTENT_MAX_WIDTH } from '../../theme/breakpoints';

jest.mock('react-native', () => ({
  useWindowDimensions: jest.fn(),
}));

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
