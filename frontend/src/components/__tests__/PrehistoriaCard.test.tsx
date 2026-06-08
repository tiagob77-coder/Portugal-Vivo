import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PrehistoriaCard, { PrehistoriaSite } from '../PrehistoriaCard';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      card: '#FFF',
      border: '#EEE',
      textPrimary: '#000',
      textSecondary: '#555',
      textMuted: '#999',
    },
  }),
}));

const mockSite: PrehistoriaSite = {
  id: 's1',
  name: 'Cromeleque dos Almendres',
  category: 'megalito',
  period: 'Neolitico',
  region: 'Alentejo',
  municipality: 'Évora',
  lat: 38.5,
  lng: -8.06,
  description_short: 'Maior conjunto megalítico da Península Ibérica.',
  description_long: 'Conjunto de menires datado do Neolítico.',
  motifs_findings: ['Menires', 'Gravuras'],
  age_years: 6000,
  astronomical_type: 'solar',
  alignment_azimuth: 90,
  iq_score: 95,
  distance_km: 12.3,
};

describe('PrehistoriaCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome e descrição do sítio', () => {
    const { getByText } = render(<PrehistoriaCard site={mockSite} onPress={onPress} />);
    expect(getByText('Cromeleque dos Almendres')).toBeTruthy();
    expect(getByText('Maior conjunto megalítico da Península Ibérica.')).toBeTruthy();
  });

  it('mostra labels de categoria e período', () => {
    const { getByText } = render(<PrehistoriaCard site={mockSite} onPress={onPress} />);
    expect(getByText('Megalito')).toBeTruthy();
    expect(getByText('Neolítico')).toBeTruthy();
  });

  it('mostra região e distância', () => {
    const { getByText } = render(<PrehistoriaCard site={mockSite} onPress={onPress} />);
    expect(getByText('Alentejo')).toBeTruthy();
    expect(getByText('12.3 km')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<PrehistoriaCard site={mockSite} onPress={onPress} />);
    fireEvent.press(getByText('Cromeleque dos Almendres'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra descrição longa quando expandido', () => {
    const { getByText } = render(<PrehistoriaCard site={mockSite} onPress={onPress} expanded />);
    expect(getByText('Conjunto de menires datado do Neolítico.')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: PrehistoriaSite = {
      id: 's2',
      name: 'Gruta X',
      category: 'geositio',
      period: 'Paleolitico',
      region: 'Centro',
      lat: 40,
      lng: -8,
      description_short: 'Gruta paleolítica.',
    };
    const { getByText } = render(<PrehistoriaCard site={minimal} onPress={onPress} />);
    expect(getByText('Gruta X')).toBeTruthy();
  });
});
