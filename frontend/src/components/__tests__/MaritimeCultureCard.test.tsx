import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MaritimeCultureCard, { MaritimeEvent } from '../MaritimeCultureCard';

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

const mockEvent: MaritimeEvent = {
  id: 'e1',
  name: 'Procissão de Nossa Senhora dos Navegantes',
  type: 'procissao_maritima',
  region: 'Algarve',
  municipality: 'Olhão',
  date_start: '15 Agosto',
  is_recurring: true,
  frequency: 'anual',
  description_short: 'Procissão de barcos decorados.',
  description_long: 'Tradição secular dos pescadores de Olhão.',
  saint_or_symbol: 'Nossa Senhora dos Navegantes',
  boats_involved: 30,
  activities: ['Procissão', 'Bênção', 'Festa'],
  gastronomy_links: ['Cataplana'],
  lat: 37,
  lng: -7.8,
  iq_score: 90,
  distance_km: 8.2,
  is_upcoming: true,
};

describe('MaritimeCultureCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome do evento e label de tipo', () => {
    const { getByText, getAllByText } = render(<MaritimeCultureCard event={mockEvent} onPress={onPress} />);
    expect(getByText('Procissão de Nossa Senhora dos Navegantes')).toBeTruthy();
    // "Procissão" surge como label de tipo e como chip de atividade
    expect(getAllByText('Procissão').length).toBeGreaterThan(0);
  });

  it('mostra data, localização e frequência', () => {
    const { getByText } = render(<MaritimeCultureCard event={mockEvent} onPress={onPress} />);
    expect(getByText('15 Agosto')).toBeTruthy();
    expect(getByText('Olhão, Algarve')).toBeTruthy();
    expect(getByText('Anual')).toBeTruthy();
  });

  it('mostra badge "Próximo" quando is_upcoming', () => {
    const { getByText } = render(<MaritimeCultureCard event={mockEvent} onPress={onPress} />);
    expect(getByText('Próximo')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(<MaritimeCultureCard event={mockEvent} onPress={onPress} />);
    fireEvent.press(getByText('Procissão de Nossa Senhora dos Navegantes'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mostra descrição longa quando expandido', () => {
    const { getByText } = render(<MaritimeCultureCard event={mockEvent} onPress={onPress} expanded />);
    expect(getByText('Tradição secular dos pescadores de Olhão.')).toBeTruthy();
  });

  it('renderiza sem crashar quando campos opcionais ausentes', () => {
    const minimal: MaritimeEvent = {
      id: 'e2',
      name: 'Festa do Mar',
      type: 'festa_mar',
      region: 'Centro',
      municipality: 'Nazaré',
      date_start: '1 Setembro',
      is_recurring: false,
      description_short: 'Celebração marítima.',
      lat: 39,
      lng: -9,
    };
    const { getAllByText } = render(<MaritimeCultureCard event={minimal} />);
    // "Festa do Mar" surge como nome do evento e como label de tipo
    expect(getAllByText('Festa do Mar').length).toBeGreaterThan(0);
  });
});
