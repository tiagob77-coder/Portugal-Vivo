import React from 'react';
import { render, screen } from '@testing-library/react-native';
import Badge from '../Badge';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../../theme', () => ({
  useTheme: () => ({
    colors: {
      primary: '#C49A6C',
      textOnPrimary: '#FFFFFF',
    },
  }),
  typography: {
    fontSize: { xs: 10, sm: 12 },
    fontWeight: { semibold: '600' },
  },
  spacing: { 2: 8, 3: 12 },
  borders: { radius: { md: 8 } },
  withOpacity: (color: string, _opacity: number) => color,
}));

describe('Badge', () => {
  it('renders the label text', () => {
    render(<Badge label="Monumento" />);
    expect(screen.getByText('Monumento')).toBeTruthy();
  });

  it('renders with a custom color prop', () => {
    render(<Badge label="Castelo" color="#3B82F6" />);
    expect(screen.getByText('Castelo')).toBeTruthy();
  });

  it('renders "filled" variant without crashing', () => {
    expect(() => render(<Badge label="Preenchido" variant="filled" />)).not.toThrow();
  });

  it('renders "soft" variant without crashing', () => {
    expect(() => render(<Badge label="Suave" variant="soft" />)).not.toThrow();
  });

  it('renders "outline" variant without crashing', () => {
    expect(() => render(<Badge label="Contorno" variant="outline" />)).not.toThrow();
  });

  it('renders "sm" size without crashing', () => {
    expect(() => render(<Badge label="Pequeno" size="sm" />)).not.toThrow();
  });

  it('renders "md" size without crashing', () => {
    expect(() => render(<Badge label="Médio" size="md" />)).not.toThrow();
  });

  it('renders with an icon without crashing', () => {
    expect(() =>
      render(<Badge label="Com ícone" icon="star" />)
    ).not.toThrow();
  });

  it('renders with icon and all props combined', () => {
    render(<Badge label="Raro" color="#8B5CF6" icon="auto-awesome" variant="filled" size="md" />);
    expect(screen.getByText('Raro')).toBeTruthy();
  });

  it('applies a custom style without crashing', () => {
    expect(() =>
      render(<Badge label="Estilizado" style={{ margin: 4 }} />)
    ).not.toThrow();
  });
});
