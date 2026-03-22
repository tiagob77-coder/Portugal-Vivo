import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

import { AccessibilityFilters } from '../AccessibilityFilters';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme', () => ({
  colors: {
    background: { secondary: '#F8F9FA' },
    gray: { 100: '#F1F5F9', 600: '#475569', 700: '#334155', 800: '#1E293B' },
    ocean: { 500: '#0EA5E9' },
    terracotta: { 500: '#C96A42' },
  },
  typography: { fontSize: { base: 16, sm: 14 } },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
  borders: { radius: { lg: 10, xl: 14, full: 9999 } },
  shadows: { sm: {} },
}));

jest.mock('../../theme/colors', () => ({
  palette: { white: '#FFFFFF' },
}));

const mockFilters = [
  { id: 'wheelchair', name: 'Cadeira de Rodas', description: '' },
  { id: 'pet_friendly', name: 'Pet Friendly', description: '' },
];

let mockIsLoading = false;
let mockData: any = { filters: mockFilters };

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: mockData, isLoading: mockIsLoading })),
}));

jest.mock('../../services/api', () => ({
  getAccessibilityFilters: jest.fn(),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AccessibilityFilters', () => {
  const onFiltersChange = jest.fn();

  beforeEach(() => {
    mockIsLoading = false;
    mockData = { filters: mockFilters };
    onFiltersChange.mockClear();
  });

  it('renders without crashing with no selected filters', () => {
    const { getByText } = render(
      <AccessibilityFilters selectedFilters={[]} onFiltersChange={onFiltersChange} />
    );
    expect(getByText('Acessibilidade')).toBeTruthy();
  });

  it('shows filter names in full (non-compact) view', () => {
    const { getByText } = render(
      <AccessibilityFilters selectedFilters={[]} onFiltersChange={onFiltersChange} />
    );
    expect(getByText('Cadeira de Rodas')).toBeTruthy();
    expect(getByText('Pet Friendly')).toBeTruthy();
  });

  it('shows loading indicator while data is being fetched', () => {
    mockIsLoading = true;
    mockData = undefined;
    const { UNSAFE_getAllByType } = render(
      <AccessibilityFilters selectedFilters={[]} onFiltersChange={onFiltersChange} />
    );
    // ActivityIndicator is rendered during loading
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('calls onFiltersChange with new filter added when a chip is pressed', () => {
    const { getAllByText } = render(
      <AccessibilityFilters selectedFilters={[]} onFiltersChange={onFiltersChange} />
    );
    fireEvent.press(getAllByText('Cadeira de Rodas')[0]);
    expect(onFiltersChange).toHaveBeenCalledWith(['wheelchair']);
  });

  it('calls onFiltersChange removing filter when already-selected chip is pressed', () => {
    const { getAllByText } = render(
      <AccessibilityFilters selectedFilters={['wheelchair']} onFiltersChange={onFiltersChange} />
    );
    fireEvent.press(getAllByText('Cadeira de Rodas')[0]);
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it('shows selected count text when filters are selected', () => {
    const { getByText } = render(
      <AccessibilityFilters selectedFilters={['wheelchair']} onFiltersChange={onFiltersChange} />
    );
    expect(getByText('1 filtro selecionado')).toBeTruthy();
  });

  it('shows plural selected count text for multiple filters', () => {
    const { getByText } = render(
      <AccessibilityFilters
        selectedFilters={['wheelchair', 'pet_friendly']}
        onFiltersChange={onFiltersChange}
      />
    );
    expect(getByText('2 filtros selecionados')).toBeTruthy();
  });

  it('shows clear button when filters are selected and clears on press', () => {
    const { getByText } = render(
      <AccessibilityFilters selectedFilters={['wheelchair']} onFiltersChange={onFiltersChange} />
    );
    const clearBtn = getByText('Limpar');
    expect(clearBtn).toBeTruthy();
    fireEvent.press(clearBtn);
    expect(onFiltersChange).toHaveBeenCalledWith([]);
  });

  it('renders compact variant with first word of filter name', () => {
    const { getByText } = render(
      <AccessibilityFilters
        selectedFilters={[]}
        onFiltersChange={onFiltersChange}
        compact
      />
    );
    // compact shows only the first word of each filter name
    expect(getByText('Cadeira')).toBeTruthy();
    expect(getByText('Pet')).toBeTruthy();
  });

  it('renders correctly with no filters returned from API', () => {
    mockData = { filters: [] };
    const { queryByText } = render(
      <AccessibilityFilters selectedFilters={[]} onFiltersChange={onFiltersChange} />
    );
    // Should render title but no filter chips
    expect(queryByText('Acessibilidade')).toBeTruthy();
    expect(queryByText('Cadeira de Rodas')).toBeNull();
  });
});
