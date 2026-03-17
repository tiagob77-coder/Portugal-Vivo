import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CategoryCard from '../CategoryCard';

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

const mockCategory = {
  id: 'castelos',
  name: 'Castelos',
  icon: 'fort',
  color: '#E67E22',
  count: 42,
};

describe('CategoryCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders category name', () => {
    const { getByText } = render(
      <CategoryCard category={mockCategory} onPress={mockOnPress} />
    );
    expect(getByText('Castelos')).toBeTruthy();
  });

  it('renders item count badge', () => {
    const { getByText } = render(
      <CategoryCard category={mockCategory} onPress={mockOnPress} />
    );
    expect(getByText('42 itens')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const { getByTestId } = render(
      <CategoryCard category={mockCategory} onPress={mockOnPress} />
    );
    fireEvent.press(getByTestId('pressable-scale'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('renders with a different category', () => {
    const anotherCategory = {
      id: 'museus',
      name: 'Museus',
      icon: 'museum',
      color: '#3498DB',
      count: 15,
    };
    const { getByText } = render(
      <CategoryCard category={anotherCategory} onPress={mockOnPress} />
    );
    expect(getByText('Museus')).toBeTruthy();
    expect(getByText('15 itens')).toBeTruthy();
  });
});
