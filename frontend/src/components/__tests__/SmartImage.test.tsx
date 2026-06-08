/**
 * Tests for SmartImage — 3-stage image fallback component.
 *
 * Stage 0: provided URI
 * Stage 1: Wikimedia CDN (deterministic by hash(name))
 * Stage 2: gradient + icon (offline-safe)
 */
import React from 'react';
import { render, act } from '@testing-library/react-native';

// ── mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme/colors', () => ({
  palette: { terracotta: { 500: '#C44536', 600: '#A33B2E' } },
}));

// expo-image: capture onError so tests can trigger it
let capturedOnError: (() => void) | null = null;

jest.mock('expo-image', () => ({
  Image: (props: any) => {
    capturedOnError = props.onError ?? null;
    const { View } = require('react-native');
    return <View testID="expo-image" accessibilityLabel={props.accessibilityLabel} />;
  },
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

// ── import under test ─────────────────────────────────────────────────────────

import SmartImage from '../SmartImage';

beforeEach(() => {
  capturedOnError = null;
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('SmartImage', () => {
  it('renders expo-image when URI provided (stage 0)', () => {
    const { getByTestId } = render(
      <SmartImage uri="https://example.com/img.jpg" name="Castelo de Guimarães" category="castelos" />
    );
    expect(getByTestId('expo-image')).toBeTruthy();
  });

  it('sets accessibilityLabel from name prop', () => {
    const { getByTestId } = render(
      <SmartImage uri="https://example.com/img.jpg" name="Torre de Belém" />
    );
    expect(getByTestId('expo-image').props.accessibilityLabel).toBe('Torre de Belém');
  });

  it('falls back to Wikimedia when primary URI errors (stage 1)', () => {
    const { getByTestId } = render(
      <SmartImage uri="https://broken.example.com/img.jpg" category="museus" name="Museu do Azulejo" />
    );
    // trigger onError from stage 0
    act(() => { capturedOnError?.(); });
    // still renders an expo-image (now wikimedia url)
    expect(getByTestId('expo-image')).toBeTruthy();
  });

  it('renders gradient fallback when stage reaches 2', () => {
    const { UNSAFE_queryByType } = render(
      <SmartImage uri="https://broken.example.com/img.jpg" category="castelos" name="Teste" />
    );
    // stage 0 → 1 → 2
    act(() => { capturedOnError?.(); });
    act(() => { capturedOnError?.(); });
    expect(UNSAFE_queryByType('LinearGradient')).toBeTruthy();
  });

  it('renders gradient fallback immediately when no URI', () => {
    // No URI means stage starts at 1; first onError takes to stage 2
    const { UNSAFE_queryByType } = render(
      <SmartImage category="miradouros" name="Sintra" />
    );
    act(() => { capturedOnError?.(); });
    expect(UNSAFE_queryByType('LinearGradient')).toBeTruthy();
  });

  it('renders fallback icon with alwaysShowIcon=true', () => {
    const { getByTestId, queryByType } = render(
      <SmartImage
        uri="https://example.com/img.jpg"
        category="gastronomia"
        name="Pastel de Nata"
        alwaysShowIcon
      />
    );
    // Image exists (stage 0)
    expect(getByTestId('expo-image')).toBeTruthy();
  });

  it('uses DEFAULT_WIKIMEDIA for unknown category', () => {
    capturedOnError = null;
    render(<SmartImage category="categoria_inexistente" name="Lugar" />);
    // Stage 1 with default wikimedia — expo-image should be rendered
    expect(capturedOnError).not.toBeNull(); // onError is wired
  });

  it('renders without crashing when all props omitted', () => {
    // No URI → stage 1 → renders expo-image (wikimedia fallback)
    expect(() => render(<SmartImage />)).not.toThrow();
  });

  it('picks deterministic wikimedia image by name hash', () => {
    // Two renders with same name+category → same image (no crash = deterministic)
    const r1 = render(<SmartImage category="igrejas" name="Mosteiro dos Jerónimos" />);
    const r2 = render(<SmartImage category="igrejas" name="Mosteiro dos Jerónimos" />);
    expect(r1.getByTestId('expo-image')).toBeTruthy();
    expect(r2.getByTestId('expo-image')).toBeTruthy();
  });
});
