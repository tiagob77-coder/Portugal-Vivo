import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import Button from '../Button';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// Mock PressableScale so we can just test through it
jest.mock('../../PressableScale', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return function MockPressableScale({ children, onPress, disabled, style }: any) {
    return React.createElement(
      TouchableOpacity,
      { onPress, disabled, style },
      children
    );
  };
});

jest.mock('../../../theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#C49A6C',
      primaryMuted: '#F5EBE0',
      accent: '#2E5E4E',
      textOnPrimary: '#FFFFFF',
      textMuted: '#9CA3AF',
      border: '#E5E7EB',
    },
  }),
  typography: {
    fontSize: { sm: 12, base: 14, md: 16 },
    fontWeight: { semibold: '600' },
  },
  spacing: { 1: 4, 3: 12, 4: 16, 5: 20, 6: 24, 2: 8 },
  borders: { radius: { lg: 12 } },
}));

describe('Button', () => {
  const onPress = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the button title', () => {
    render(<Button title="Explorar" onPress={onPress} />);
    expect(screen.getByText('Explorar')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    render(<Button title="Guardar" onPress={onPress} />);
    fireEvent.press(screen.getByText('Guardar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renders "primary" variant without crashing', () => {
    expect(() =>
      render(<Button title="Principal" onPress={onPress} variant="primary" />)
    ).not.toThrow();
  });

  it('renders "secondary" variant without crashing', () => {
    expect(() =>
      render(<Button title="Secundário" onPress={onPress} variant="secondary" />)
    ).not.toThrow();
  });

  it('renders "ghost" variant without crashing', () => {
    expect(() =>
      render(<Button title="Ghost" onPress={onPress} variant="ghost" />)
    ).not.toThrow();
  });

  it('renders "accent" variant without crashing', () => {
    expect(() =>
      render(<Button title="Destaque" onPress={onPress} variant="accent" />)
    ).not.toThrow();
  });

  it('renders "sm" size', () => {
    expect(() =>
      render(<Button title="Pequeno" onPress={onPress} size="sm" />)
    ).not.toThrow();
  });

  it('renders "lg" size', () => {
    expect(() =>
      render(<Button title="Grande" onPress={onPress} size="lg" />)
    ).not.toThrow();
  });

  it('shows ActivityIndicator when loading=true', () => {
    const { UNSAFE_getByType } = render(
      <Button title="Guardar" onPress={onPress} loading />
    );
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('does not render title text when loading', () => {
    render(<Button title="Guardar" onPress={onPress} loading />);
    expect(screen.queryByText('Guardar')).toBeNull();
  });

  it('does not call onPress when disabled', () => {
    render(<Button title="Desactivado" onPress={onPress} disabled />);
    fireEvent.press(screen.queryByText('Desactivado') || screen.getByText('Desactivado'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders with left icon without crashing', () => {
    expect(() =>
      render(<Button title="Com ícone" onPress={onPress} icon="place" iconPosition="left" />)
    ).not.toThrow();
  });

  it('renders with right icon without crashing', () => {
    expect(() =>
      render(<Button title="Seta" onPress={onPress} icon="chevron-right" iconPosition="right" />)
    ).not.toThrow();
  });
});
