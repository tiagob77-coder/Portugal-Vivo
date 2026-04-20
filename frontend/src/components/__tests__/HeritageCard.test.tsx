import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import HeritageCard from '../HeritageCard';

// Mock PressableScale to render a simple touchable
jest.mock('../PressableScale', () => {
  const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return {
    __esModule: true,
    default: (props: any) => (
      <TouchableOpacity onPress={props.onPress} style={props.style} testID="pressable-scale">
        {props.children}
      </TouchableOpacity>
    ),
  };
});

// Mock MaterialIcons
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

const mockItem = {
  id: 'poi-001',
  name: 'Termas de S. Pedro do Sul',
  description: 'Estância termal histórica no coração de Portugal',
  category: 'termas',
  region: 'centro',
  location: { lat: 40.75, lng: -8.07 },
  tags: ['termalismo', 'saúde'],
  related_items: [],
  metadata: {},
  created_at: '2024-01-01',
};

const mockCategories = [
  { id: 'termas', name: 'Termas', icon: 'hot-tub', color: '#E67E22' },
  { id: 'lendas', name: 'Lendas', icon: 'auto-stories', color: '#8B5CF6' },
];

describe('HeritageCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders POI name and description', () => {
    const { getByText } = render(
      <HeritageCard item={mockItem} categories={mockCategories} onPress={mockOnPress} />
    );
    expect(getByText('Termas de S. Pedro do Sul')).toBeTruthy();
    expect(getByText('Estância termal histórica no coração de Portugal')).toBeTruthy();
  });

  it('shows category badge with correct name', () => {
    const { getByText } = render(
      <HeritageCard item={mockItem} categories={mockCategories} onPress={mockOnPress} />
    );
    expect(getByText('Termas')).toBeTruthy();
  });

  it('shows region name (mapped from ID)', () => {
    const { getByText } = render(
      <HeritageCard item={mockItem} categories={mockCategories} onPress={mockOnPress} />
    );
    expect(getByText('Centro')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const { getByTestId } = render(
      <HeritageCard item={mockItem} categories={mockCategories} onPress={mockOnPress} />
    );
    fireEvent.press(getByTestId('pressable-scale'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders compact variant with name and region', () => {
    const { getByText } = render(
      <HeritageCard item={mockItem} categories={mockCategories} onPress={mockOnPress} variant="compact" />
    );
    expect(getByText('Termas de S. Pedro do Sul')).toBeTruthy();
    expect(getByText('Centro')).toBeTruthy();
  });

  it('falls back gracefully when category is not found', () => {
    const itemUnknownCat = { ...mockItem, category: 'unknown-cat' };
    const { getByText } = render(
      <HeritageCard item={itemUnknownCat} categories={mockCategories} onPress={mockOnPress} />
    );
    expect(getByText('unknown-cat')).toBeTruthy();
  });
});
