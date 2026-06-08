import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FaunaSpeciesCard, { FaunaSpecies } from '../FaunaSpeciesCard';

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

const mockSpecies: FaunaSpecies = {
  id: 'fa1',
  scientific_name: 'Lynx pardinus',
  common_name: 'Lince-ibérico',
  class: 'mamifero',
  region_main: 'Alentejo',
  habitats: ['Matagal mediterrânico', 'Montado', 'Charneca', 'Pinhal'],
  rarity_level: 'Epico',
  rarity_score: 95,
  threat_status: 'EN',
  best_season: 'Inverno',
  best_time_of_day: 'noturno',
  description_short: 'O felino mais ameaçado do mundo.',
  description_long: 'Predador de topo do ecossistema mediterrânico ibérico.',
  observation_tips: 'Procurar ao amanhecer junto a tocas de coelho.',
  best_spot_description: 'Reserva do Vale do Guadiana',
  tag_endemic: true,
  tag_in_danger: true,
  is_flagship: true,
  iq_score: 99,
  distance_km: 22.7,
};

describe('FaunaSpeciesCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome comum e científico', () => {
    const { getByText } = render(<FaunaSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Lince-ibérico')).toBeTruthy();
    expect(getByText('Lynx pardinus')).toBeTruthy();
  });

  it('mostra label de classe, nível de raridade e estatuto', () => {
    const { getByText } = render(<FaunaSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Mamífero')).toBeTruthy();
    expect(getByText('Epico')).toBeTruthy();
    expect(getByText('EN')).toBeTruthy();
  });

  it('mostra época, hora e score IQ', () => {
    const { getByText } = render(<FaunaSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Inverno')).toBeTruthy();
    expect(getByText('Noturno')).toBeTruthy();
    expect(getByText('99')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<FaunaSpeciesCard species={mockSpecies} onPress={onPress} />);
    fireEvent.press(getByText('Lince-ibérico'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra dicas de observação e melhor local quando expandido', () => {
    const { getByText } = render(<FaunaSpeciesCard species={mockSpecies} onPress={onPress} expanded />);
    expect(getByText('Procurar ao amanhecer junto a tocas de coelho.')).toBeTruthy();
    expect(getByText('Reserva do Vale do Guadiana')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: FaunaSpecies = {
      id: 'fa2',
      scientific_name: 'Erithacus rubecula',
      common_name: 'Pisco-de-peito-ruivo',
      class: 'ave',
      region_main: 'Centro',
      habitats: ['Bosques'],
      rarity_level: 'Comum',
      rarity_score: 20,
      threat_status: 'LC',
      best_season: 'Todo o ano',
      description_short: 'Pequena ave canora comum em Portugal.',
    };
    const { getByText } = render(<FaunaSpeciesCard species={minimal} />);
    expect(getByText('Pisco-de-peito-ruivo')).toBeTruthy();
  });
});
