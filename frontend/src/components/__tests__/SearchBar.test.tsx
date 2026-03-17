import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { SearchBar } from '../SearchBar';

// Mock expo-router
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Mock lodash debounce to execute immediately
jest.mock('lodash', () => ({
  debounce: (fn: any) => fn,
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

// Mock MaterialIcons
jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// Mock fetch for suggestions
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ suggestions: [] }),
}) as jest.Mock;

describe('SearchBar', () => {
  const mockOnSearch = jest.fn();

  beforeEach(() => {
    mockOnSearch.mockClear();
    (global.fetch as jest.Mock).mockClear();
  });

  it('renders search input with placeholder', () => {
    const { getByPlaceholderText } = render(<SearchBar />);
    expect(getByPlaceholderText('Pesquisar património...')).toBeTruthy();
  });

  it('renders custom placeholder', () => {
    const { getByPlaceholderText } = render(
      <SearchBar placeholder="Procurar locais..." />
    );
    expect(getByPlaceholderText('Procurar locais...')).toBeTruthy();
  });

  it('updates value when typing', () => {
    const { getByPlaceholderText } = render(
      <SearchBar onSearch={mockOnSearch} />
    );
    const input = getByPlaceholderText('Pesquisar património...');
    fireEvent.changeText(input, 'termas');
    expect(input.props.value).toBe('termas');
  });

  it('shows text in input after changeText', () => {
    const { getByPlaceholderText } = render(
      <SearchBar onSearch={mockOnSearch} />
    );
    const input = getByPlaceholderText('Pesquisar património...');
    fireEvent.changeText(input, 'cascatas');
    expect(input.props.value).toBe('cascatas');
  });

  it('triggers search on submit', () => {
    const { getByPlaceholderText } = render(
      <SearchBar onSearch={mockOnSearch} />
    );
    const input = getByPlaceholderText('Pesquisar património...');
    fireEvent.changeText(input, 'cascatas');
    fireEvent(input, 'submitEditing');
    expect(mockOnSearch).toHaveBeenCalledWith('cascatas');
  });
});
