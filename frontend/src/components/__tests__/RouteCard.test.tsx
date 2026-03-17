import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import RouteCard from '../RouteCard';

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

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

const mockRoute = {
  id: 'route-001',
  name: 'Rota dos Vinhos do Douro',
  description: 'Descubra os melhores vinhos do vale do Douro',
  category: 'vinho',
  region: 'Norte',
  items: ['item-1', 'item-2'],
  tags: ['vinho', 'douro'],
  created_at: '2024-01-01',
};

describe('RouteCard', () => {
  const mockOnPress = jest.fn();

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders route name and description', () => {
    const { getByText } = render(
      <RouteCard route={mockRoute} onPress={mockOnPress} />
    );

    expect(getByText('Rota dos Vinhos do Douro')).toBeTruthy();
    expect(getByText('Descubra os melhores vinhos do vale do Douro')).toBeTruthy();
  });

  it('renders category badge with capitalized name', () => {
    const { getByText } = render(
      <RouteCard route={mockRoute} onPress={mockOnPress} />
    );

    expect(getByText('Vinho')).toBeTruthy();
  });

  it('renders region when provided', () => {
    const { getByText } = render(
      <RouteCard route={mockRoute} onPress={mockOnPress} />
    );

    expect(getByText('Norte')).toBeTruthy();
  });

  it('does not render region badge when region is absent', () => {
    const routeNoRegion = { ...mockRoute, region: undefined };
    const { queryByText } = render(
      <RouteCard route={routeNoRegion} onPress={mockOnPress} />
    );

    expect(queryByText('Norte')).toBeNull();
  });

  it('calls onPress when card is pressed', () => {
    const { getByTestId } = render(
      <RouteCard route={mockRoute} onPress={mockOnPress} />
    );

    fireEvent.press(getByTestId('pressable-scale'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });
});
