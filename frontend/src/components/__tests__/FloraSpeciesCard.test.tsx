import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import FloraSpeciesCard, { FloraSpecies } from '../FloraSpeciesCard';

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

const mockSpecies: FloraSpecies = {
  id: 'fl1',
  scientific_name: 'Narcissus cyclamineus',
  common_name: 'Narciso-trombeta',
  status: 'endemica',
  endemism_level: 'iberico',
  region_main: 'Norte',
  habitats: ['Margens de rios', 'Prados húmidos', 'Bosques', 'Lameiros'],
  flowering_start_month: 2,
  flowering_end_month: 4,
  rarity_score: 75,
  threat_status: 'VU',
  where_to_observe: 'Parque Nacional da Peneda-Gerês',
  curiosity: 'As suas pétalas recurvam-se para trás como um ciclâmen.',
  description_short: 'Narciso silvestre de floração precoce.',
  description_long: 'Espécie protegida que floresce em fevereiro nas margens dos rios do Norte.',
  legal_protection: ['Anexo IV Habitats'],
  distance_km: 12.3,
};

describe('FloraSpeciesCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome comum e científico', () => {
    const { getByText } = render(<FloraSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('Narciso-trombeta')).toBeTruthy();
    expect(getByText('Narcissus cyclamineus')).toBeTruthy();
  });

  it('mostra score de raridade, região e descrição curta', () => {
    const { getByText } = render(<FloraSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('75')).toBeTruthy();
    expect(getByText('Norte')).toBeTruthy();
    expect(getByText('Narciso silvestre de floração precoce.')).toBeTruthy();
  });

  it('mostra estatuto de ameaça e a distância', () => {
    const { getByText } = render(<FloraSpeciesCard species={mockSpecies} onPress={onPress} />);
    expect(getByText('VU')).toBeTruthy();
    expect(getByText('12.3 km')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<FloraSpeciesCard species={mockSpecies} onPress={onPress} />);
    fireEvent.press(getByText('Narciso-trombeta'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra curiosidade e onde observar quando expandido', () => {
    const { getByText } = render(<FloraSpeciesCard species={mockSpecies} onPress={onPress} expanded />);
    expect(getByText('As suas pétalas recurvam-se para trás como um ciclâmen.')).toBeTruthy();
    expect(getByText('Parque Nacional da Peneda-Gerês')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: FloraSpecies = {
      id: 'fl2',
      scientific_name: 'Quercus suber',
      common_name: 'Sobreiro',
      status: 'autocone',
      region_main: 'Alentejo',
      habitats: ['Montado'],
      flowering_start_month: 4,
      flowering_end_month: 5,
      rarity_score: 30,
      threat_status: 'LC',
      where_to_observe: 'Alentejo',
      description_short: 'Árvore produtora de cortiça.',
    };
    const { getByText } = render(<FloraSpeciesCard species={minimal} />);
    expect(getByText('Sobreiro')).toBeTruthy();
  });
});
