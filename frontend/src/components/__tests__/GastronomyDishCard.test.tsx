import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import GastronomyDishCard, { CoastalDish } from '../GastronomyDishCard';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../OptimizedImage', () => 'OptimizedImage');
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

const mockDish: CoastalDish = {
  id: 'd1',
  name: 'Caldeirada de Peixe',
  region: 'Centro',
  municipality: 'Aveiro',
  type: 'peixe',
  recipe_type: 'caldeirada',
  species_related: [{ name: 'Robalo', scientific: 'Dicentrarchus labrax', role: 'principal' }],
  seasonality: { start_month: 5, end_month: 9 },
  story_short: 'Prato tradicional de peixe variado.',
  story_long: 'A caldeirada é cozinhada em camadas.',
  ingredients: ['Peixe', 'Batata', 'Cebola', 'Tomate'],
  best_restaurants: ['Casa do Mar'],
  environmental_status: 'seguro',
  reliability_score: 0.9,
  iq_score: 0.85,
  distance_km: 3.4,
};

describe('GastronomyDishCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome do prato e região', () => {
    const { getByText } = render(<GastronomyDishCard dish={mockDish} onPress={onPress} />);
    expect(getByText('Caldeirada de Peixe')).toBeTruthy();
    expect(getByText('Centro')).toBeTruthy();
  });

  it('mostra labels de receita e tipo', () => {
    const { getByText } = render(<GastronomyDishCard dish={mockDish} onPress={onPress} />);
    expect(getByText('Caldeirada')).toBeTruthy();
    expect(getByText('Peixe')).toBeTruthy();
  });

  it('mostra estatuto ambiental e história curta', () => {
    const { getByText } = render(<GastronomyDishCard dish={mockDish} onPress={onPress} />);
    expect(getByText('Espécie Segura')).toBeTruthy();
    expect(getByText('Prato tradicional de peixe variado.')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<GastronomyDishCard dish={mockDish} onPress={onPress} />);
    fireEvent.press(getByText('Caldeirada de Peixe'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra história longa quando expandido', () => {
    const { getByText } = render(<GastronomyDishCard dish={mockDish} onPress={onPress} expanded />);
    expect(getByText('A caldeirada é cozinhada em camadas.')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: CoastalDish = {
      id: 'd2',
      name: 'Arroz de Marisco',
      region: 'Norte',
      type: 'marisco',
      recipe_type: 'guisado',
      story_short: 'Arroz cremoso de marisco.',
    };
    const { getByText } = render(<GastronomyDishCard dish={minimal} />);
    expect(getByText('Arroz de Marisco')).toBeTruthy();
  });
});
