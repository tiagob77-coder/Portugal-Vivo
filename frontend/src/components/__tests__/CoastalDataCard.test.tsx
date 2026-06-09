import React from 'react';
import { render } from '@testing-library/react-native';
import CoastalDataCard from '../CoastalDataCard';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      card: '#FFF',
      surface: '#F5F5F5',
      border: '#EEE',
      textPrimary: '#000',
      textSecondary: '#555',
      textMuted: '#999',
    },
  }),
}));

const mockZone = {
  condicoes: {
    ondas_media_m: 1.5,
    vento_predominante: 'Nortada',
    melhor_epoca: 'Verão',
    seguranca: 'muito_alta',
  },
};

describe('CoastalDataCard', () => {
  it('renderiza sem crashar com props válidas', () => {
    const { getByText } = render(<CoastalDataCard zone={mockZone} />);
    expect(getByText('Marés')).toBeTruthy();
  });

  it('mostra altura das ondas e vento predominante', () => {
    const { getByText, getAllByText } = render(<CoastalDataCard zone={mockZone} />);
    // The simulated tide height can also render "1.5 m" depending on the clock,
    // so assert at least one match instead of a unique one (flaky otherwise).
    expect(getAllByText('1.5 m').length).toBeGreaterThan(0);
    expect(getByText('Nortada')).toBeTruthy();
  });

  it('mostra a melhor época', () => {
    const { getByText } = render(<CoastalDataCard zone={mockZone} />);
    expect(getByText('Verão')).toBeTruthy();
  });

  it('mostra label de segurança "Segura" para muito_alta', () => {
    const { getByText } = render(<CoastalDataCard zone={mockZone} />);
    expect(getByText(/🟢 Segura/)).toBeTruthy();
  });

  it('mostra label "Perigosa" quando segurança é baixa', () => {
    const zone = { condicoes: { ...mockZone.condicoes, seguranca: 'baixa' } };
    const { getByText } = render(<CoastalDataCard zone={zone} />);
    expect(getByText(/🔴 Perigosa/)).toBeTruthy();
  });

  it('renderiza variante compacta sem crashar', () => {
    const { getByText } = render(<CoastalDataCard zone={mockZone} compact />);
    expect(getByText('Ondas')).toBeTruthy();
  });
});
