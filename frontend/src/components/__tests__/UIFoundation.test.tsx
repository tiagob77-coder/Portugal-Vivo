/**
 * Tests for UI foundation components:
 *   EmptyState, ErrorState, LoadingState, ScreenWrapper
 *
 * These are used on every screen — smoke tests + interaction tests.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

// ── shared mocks ──────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme/colors', () => ({
  getModuleTheme: (_mod: string) => ({
    bg: '#FFFFFF',
    accent: '#3FA66B',
    accentMuted: '#D4EDDA',
    textPrimary: '#1A1A1A',
    textSecondary: '#555555',
    textMuted: '#999999',
  }),
  palette: { white: '#FFFFFF' },
}));

jest.mock('../../theme', () => ({
  typography: {
    fontSize: { base: 14, lg: 18 },
    fontWeight: { semibold: '600' },
    lineHeight: { normal: 1.5 },
  },
  spacing: Array.from({ length: 12 }, (_, i) => i * 4),
  borders: { radius: { lg: 8 } },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// ── imports (after mocks) ─────────────────────────────────────────────────────

import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import LoadingState from '../ui/LoadingState';
import ScreenWrapper from '../ui/ScreenWrapper';

// ── EmptyState ────────────────────────────────────────────────────────────────

describe('EmptyState', () => {
  it('renders title', () => {
    const { getByText } = render(<EmptyState title="Sem resultados" />);
    expect(getByText('Sem resultados')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByText } = render(
      <EmptyState title="Vazio" subtitle="Tente outra pesquisa" />
    );
    expect(getByText('Tente outra pesquisa')).toBeTruthy();
  });

  it('does not render subtitle when omitted', () => {
    const { queryByText } = render(<EmptyState title="Vazio" />);
    expect(queryByText('Tente outra pesquisa')).toBeNull();
  });

  it('renders action button when actionLabel + onAction provided', () => {
    const onAction = jest.fn();
    const { getByText } = render(
      <EmptyState title="Vazio" actionLabel="Limpar filtros" onAction={onAction} />
    );
    fireEvent.press(getByText('Limpar filtros'));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button without onAction', () => {
    const { queryByText } = render(
      <EmptyState title="Vazio" actionLabel="Limpar filtros" />
    );
    expect(queryByText('Limpar filtros')).toBeNull();
  });

  it('accepts module prop without crashing', () => {
    const { getByText } = render(
      <EmptyState title="Vazio" module="biodiversidade" />
    );
    expect(getByText('Vazio')).toBeTruthy();
  });
});

// ── ErrorState ────────────────────────────────────────────────────────────────

describe('ErrorState', () => {
  it('renders default message when none provided', () => {
    const { getByText } = render(<ErrorState />);
    expect(getByText('Ocorreu um erro. Tente novamente.')).toBeTruthy();
  });

  it('renders custom message', () => {
    const { getByText } = render(<ErrorState message="Falha de rede" />);
    expect(getByText('Falha de rede')).toBeTruthy();
  });

  it('renders retry button when onRetry provided', () => {
    const onRetry = jest.fn();
    const { getByText } = render(<ErrorState onRetry={onRetry} />);
    fireEvent.press(getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not render retry button when onRetry omitted', () => {
    const { queryByText } = render(<ErrorState />);
    expect(queryByText('Tentar novamente')).toBeNull();
  });

  it('accepts module prop', () => {
    const { getByText } = render(<ErrorState module="costa" />);
    expect(getByText('Ocorreu um erro. Tente novamente.')).toBeTruthy();
  });
});

// ── LoadingState ──────────────────────────────────────────────────────────────

describe('LoadingState', () => {
  it('renders default loading message', () => {
    const { getByText } = render(<LoadingState />);
    expect(getByText('A carregar...')).toBeTruthy();
  });

  it('renders custom message', () => {
    const { getByText } = render(<LoadingState message="A sincronizar dados..." />);
    expect(getByText('A sincronizar dados...')).toBeTruthy();
  });

  it('renders with module theme prop', () => {
    const { getByText } = render(<LoadingState module="fauna" message="Loading fauna..." />);
    expect(getByText('Loading fauna...')).toBeTruthy();
  });

  it('renders ActivityIndicator', () => {
    const { UNSAFE_getByType } = render(<LoadingState />);
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});

// ── ScreenWrapper ─────────────────────────────────────────────────────────────

describe('ScreenWrapper', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ScreenWrapper>
        <Text>Conteúdo</Text>
      </ScreenWrapper>
    );
    expect(getByText('Conteúdo')).toBeTruthy();
  });

  it('accepts module prop', () => {
    const { getByText } = render(
      <ScreenWrapper module="prehistoria">
        <Text>Pré-história</Text>
      </ScreenWrapper>
    );
    expect(getByText('Pré-história')).toBeTruthy();
  });

  it('renders without padding when padded=false', () => {
    const { getByText } = render(
      <ScreenWrapper padded={false}>
        <Text>Sem padding</Text>
      </ScreenWrapper>
    );
    expect(getByText('Sem padding')).toBeTruthy();
  });

  it('renders with bottom edge inset', () => {
    const { getByText } = render(
      <ScreenWrapper edges={['top', 'bottom']}>
        <Text>Com insets</Text>
      </ScreenWrapper>
    );
    expect(getByText('Com insets')).toBeTruthy();
  });
});
