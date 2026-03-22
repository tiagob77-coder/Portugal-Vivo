import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Card from '../Card';

jest.mock('../../../theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFFFFF',
      surfaceElevated: '#F8FAFC',
      border: '#E5E7EB',
      borderLight: '#F3F4F6',
    },
  }),
  borders: { radius: { xl: 16 } },
  shadows: { sm: {}, md: {} },
  spacing: { 4: 16, 2: 8, 6: 24, 0: 0 },
}));

describe('Card', () => {
  it('renders children content', () => {
    render(
      <Card>
        <Text>Conteúdo do card</Text>
      </Card>
    );
    expect(screen.getByText('Conteúdo do card')).toBeTruthy();
  });

  it('renders "default" variant without crashing', () => {
    expect(() =>
      render(
        <Card variant="default">
          <Text>Default</Text>
        </Card>
      )
    ).not.toThrow();
  });

  it('renders "elevated" variant without crashing', () => {
    expect(() =>
      render(
        <Card variant="elevated">
          <Text>Elevado</Text>
        </Card>
      )
    ).not.toThrow();
  });

  it('renders "outlined" variant without crashing', () => {
    expect(() =>
      render(
        <Card variant="outlined">
          <Text>Contorno</Text>
        </Card>
      )
    ).not.toThrow();
  });

  it('renders with custom padding prop', () => {
    expect(() =>
      render(
        <Card padding={2}>
          <Text>Padding pequeno</Text>
        </Card>
      )
    ).not.toThrow();
  });

  it('renders with custom style prop', () => {
    expect(() =>
      render(
        <Card style={{ margin: 8 }}>
          <Text>Com margem</Text>
        </Card>
      )
    ).not.toThrow();
  });

  it('renders multiple children', () => {
    render(
      <Card>
        <Text>Título</Text>
        <Text>Subtítulo</Text>
        <Text>Descrição</Text>
      </Card>
    );
    expect(screen.getByText('Título')).toBeTruthy();
    expect(screen.getByText('Subtítulo')).toBeTruthy();
    expect(screen.getByText('Descrição')).toBeTruthy();
  });

  it('renders with all props combined without crashing', () => {
    expect(() =>
      render(
        <Card variant="elevated" padding={6} style={{ borderWidth: 2 }}>
          <Text>Completo</Text>
        </Card>
      )
    ).not.toThrow();
  });
});
