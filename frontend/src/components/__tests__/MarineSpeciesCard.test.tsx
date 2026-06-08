import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MarineSpeciesCard, { MarineSpecies } from '../MarineSpeciesCard';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../OptimizedImage', () => 'OptimizedImage');
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      card: '#FFF',
      surface: '#F5F5F5',
      textPrimary: '#000',
      textSecondary: '#555',
      textMuted: '#999',
    },
  }),
}));

const mockSpecies: MarineSpecies = {
  id: 'sp1',
  scientific_name: 'Tursiops truncatus',
  common_name_pt: 'Golfinho-roaz',
  category: 'mammal',
  iucn_status: 'LC',
  region: ['Sado', 'Algarve'],
  season: 'year-round',
  activity_months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  description_short: 'Golfinho residente no estuário do Sado.',
  curiosity: 'Vive em grupos sociais estáveis.',
  habitat: 'Estuários',
  depth_range: '0-50m',
  best_spots: ['Setúbal'],
  iq_score: 88,
  distance_km: 5,
};

describe('MarineSpeciesCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome comum e científico', () => {
    const { getByText } = render(<MarineSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Golfinho-roaz')).toBeTruthy();
    expect(getByText('Tursiops truncatus')).toBeTruthy();
  });

  it('mostra label de categoria e estatuto IUCN', () => {
    const { getByText } = render(<MarineSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Mamífero')).toBeTruthy();
    expect(getByText('IUCN LC')).toBeTruthy();
  });

  it('mostra a label da época (year-round)', () => {
    const { getByText } = render(<MarineSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Todo o ano')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<MarineSpeciesCard species={mockSpecies} onPress={onPress} />);
    fireEvent.press(getByText('Golfinho-roaz'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra descrição e curiosidade quando expandido', () => {
    const { getByText } = render(<MarineSpeciesCard species={mockSpecies} onPress={onPress} expanded />);
    expect(getByText('Golfinho residente no estuário do Sado.')).toBeTruthy();
    expect(getByText('Vive em grupos sociais estáveis.')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: MarineSpecies = {
      id: 'sp2',
      scientific_name: 'Sardina pilchardus',
      common_name_pt: 'Sardinha',
      category: 'fish',
      iucn_status: 'NT',
      region: [],
      season: 'summer',
      activity_months: [6, 7, 8],
      description_short: 'Peixe pelágico.',
    };
    const { getByText } = render(<MarineSpeciesCard species={minimal} />);
    expect(getByText('Sardinha')).toBeTruthy();
  });
});
