import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import InfrastructureCard, { Infrastructure } from '../InfrastructureCard';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../OptimizedImage', () => 'OptimizedImage');
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

const mockItem: Infrastructure = {
  id: 'inf1',
  name: 'Passadiços do Paiva',
  type: 'passadico',
  region: 'Norte',
  municipality: 'Arouca',
  description_short: 'Percurso de madeira sobre o rio Paiva.',
  description_long: 'Oito quilómetros de passadiços ao longo das margens do rio Paiva.',
  length_m: 8000,
  height_m: 300,
  difficulty: 'media',
  access_type: 'pago',
  is_accessible: false,
  is_family_friendly: true,
  is_dog_friendly: false,
  best_season: ['Primavera', 'Outono'],
  opening_hours: '09h00 - 19h00',
  safety_restrictions: 'Não recomendado em dias de chuva intensa.',
  lat: 40.9,
  lng: -8.2,
  iq_score: 92,
  distance_km: 15.4,
};

describe('InfrastructureCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome e localização', () => {
    const { getByText } = render(<InfrastructureCard item={mockItem} onPress={onPress} />);
    expect(getByText('Passadiços do Paiva')).toBeTruthy();
    expect(getByText('Arouca, Norte')).toBeTruthy();
  });

  it('mostra label de tipo, acesso e comprimento formatado', () => {
    const { getByText } = render(<InfrastructureCard item={mockItem} onPress={onPress} />);
    expect(getByText('Passadiço')).toBeTruthy();
    expect(getByText('Pago')).toBeTruthy();
    expect(getByText('8.0 km')).toBeTruthy();
  });

  it('mostra dificuldade e distância', () => {
    const { getByText } = render(<InfrastructureCard item={mockItem} onPress={onPress} />);
    expect(getByText('Média')).toBeTruthy();
    expect(getByText('15.4 km')).toBeTruthy();
  });

  it('mostra aviso de segurança', () => {
    const { getByText } = render(<InfrastructureCard item={mockItem} onPress={onPress} />);
    expect(getByText('Não recomendado em dias de chuva intensa.')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<InfrastructureCard item={mockItem} onPress={onPress} />);
    fireEvent.press(getByText('Passadiços do Paiva'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra descrição longa e horário quando expandido', () => {
    const { getByText } = render(<InfrastructureCard item={mockItem} onPress={onPress} expanded />);
    expect(getByText('Oito quilómetros de passadiços ao longo das margens do rio Paiva.')).toBeTruthy();
    expect(getByText('09h00 - 19h00')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: Infrastructure = {
      id: 'inf2',
      name: 'Miradouro da Senhora do Monte',
      type: 'miradouro',
      region: 'Lisboa',
      description_short: 'Vista panorâmica sobre Lisboa.',
      access_type: 'livre',
      lat: 38.7,
      lng: -9.1,
    };
    const { getByText } = render(<InfrastructureCard item={minimal} />);
    expect(getByText('Miradouro da Senhora do Monte')).toBeTruthy();
    expect(getByText('Livre')).toBeTruthy();
  });
});
