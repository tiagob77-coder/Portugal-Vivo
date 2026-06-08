import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EconomyMarketCard from '../EconomyMarketCard';

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

const mockMarket = {
  id: 'm1',
  name: 'Mercado do Bolhão',
  city: 'Porto',
  region: 'Norte',
  type: 'mercado_municipal',
  schedule: 'Seg-Sáb 8h-20h',
  products: ['Peixe', 'Flores', 'Pão'],
  description: 'Mercado histórico do Porto.',
  tags: ['historico'],
  rating: 4.5,
};

describe('EconomyMarketCard', () => {
  const onPress = jest.fn();

  beforeEach(() => onPress.mockClear());

  it('renderiza nome e localização do mercado', () => {
    const { getByText } = render(
      <EconomyMarketCard item={mockMarket} variant="market" onPress={onPress} />
    );
    expect(getByText('Mercado do Bolhão')).toBeTruthy();
    expect(getByText('Porto, Norte')).toBeTruthy();
  });

  it('mostra o badge de tipo e horário', () => {
    const { getByText } = render(
      <EconomyMarketCard item={mockMarket} variant="market" onPress={onPress} />
    );
    expect(getByText('Mercado Municipal')).toBeTruthy();
    expect(getByText('Seg-Sáb 8h-20h')).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const { getByText } = render(
      <EconomyMarketCard item={mockMarket} variant="market" onPress={onPress} />
    );
    fireEvent.press(getByText('Mercado do Bolhão'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('renderiza variante artisan com craft', () => {
    const artisan = { id: 'a1', name: 'Olaria Maria', city: 'Barcelos', craft: 'Cerâmica', materials: ['Barro'] };
    const { getByText } = render(
      <EconomyMarketCard item={artisan} variant="artisan" onPress={onPress} />
    );
    expect(getByText('Olaria Maria')).toBeTruthy();
    expect(getByText('Cerâmica')).toBeTruthy();
  });

  it('renderiza variante product com badge DOP', () => {
    const product = { id: 'p1', name: 'Queijo Serra', origin: 'Seia', category: 'laticinios', dop: true };
    const { getByText } = render(
      <EconomyMarketCard item={product} variant="product" onPress={onPress} />
    );
    expect(getByText('Queijo Serra')).toBeTruthy();
    expect(getByText('DOP')).toBeTruthy();
  });

  it('renderiza sem crashar com campos opcionais em falta', () => {
    const minimal = { id: 'm2', name: 'Feira Simples' };
    const { getByText } = render(
      <EconomyMarketCard item={minimal} variant="market" />
    );
    expect(getByText('Feira Simples')).toBeTruthy();
  });
});
