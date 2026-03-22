import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ReviewsSection } from '../ReviewsSection';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useMutation: jest.fn(),
  useQueryClient: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// Mock ImageUpload since it's used in the review form
jest.mock('../ImageUpload', () => {
  const React = require('react'); // eslint-disable-line @typescript-eslint/no-require-imports
  const { View } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
  return function MockImageUpload() {
    return React.createElement(View, { testID: 'image-upload' });
  };
});

jest.mock('../../config/api', () => ({
  API_URL: 'http://localhost:8000',
}));

jest.mock('../../theme/colors', () => ({
  palette: {
    terracotta: { 500: '#C49A6C' },
    forest: { 500: '#2E5E4E', 600: '#1E4D40' },
    white: '#FFFFFF',
    black: '#000000',
  },
}));

const mockUseQuery = useQuery as jest.Mock;
const mockUseMutation = useMutation as jest.Mock;
const mockUseQueryClient = useQueryClient as jest.Mock;

const mockSummary = {
  item_id: 'item-1',
  average_rating: 4.2,
  total_reviews: 15,
  rating_distribution: { '5': 8, '4': 4, '3': 2, '2': 1, '1': 0 },
};

const mockReviews = [
  {
    id: 'rev-1',
    item_id: 'item-1',
    user_id: 'user-1',
    user_name: 'Ana Silva',
    rating: 5,
    title: 'Imperdível!',
    text: 'Uma experiência incrível para toda a família.',
    helpful_votes: 3,
    created_at: '2025-06-01T10:00:00Z',
    image_urls: [],
  },
  {
    id: 'rev-2',
    item_id: 'item-1',
    user_id: 'user-2',
    user_name: 'Pedro Costa',
    rating: 4,
    title: 'Muito bom',
    text: 'Vale a pena a visita.',
    helpful_votes: 1,
    created_at: '2025-05-20T14:00:00Z',
    image_urls: [],
  },
];

describe('ReviewsSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: jest.fn(),
    });
    mockUseMutation.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
  });

  it('shows loading indicator when queries are loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });
    const { UNSAFE_getByType } = render(<ReviewsSection itemId="item-1" />);
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders average rating after data loads', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('4.2')).toBeTruthy();
  });

  it('renders total reviews count', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('15 avaliações')).toBeTruthy();
  });

  it('renders reviewer names', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('Ana Silva')).toBeTruthy();
    expect(screen.getByText('Pedro Costa')).toBeTruthy();
  });

  it('renders review titles', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('Imperdível!')).toBeTruthy();
    expect(screen.getByText('Muito bom')).toBeTruthy();
  });

  it('renders "Avaliações Recentes" section title', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('Avaliações Recentes')).toBeTruthy();
  });

  it('renders "Escrever Avaliação" button when not authenticated', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('Escrever Avaliação')).toBeTruthy();
  });

  it('calls onLoginRequired when write-review is pressed without authToken', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    const onLoginRequired = jest.fn();
    render(<ReviewsSection itemId="item-1" onLoginRequired={onLoginRequired} />);
    fireEvent.press(screen.getByText('Escrever Avaliação'));
    expect(onLoginRequired).toHaveBeenCalledTimes(1);
  });

  it('shows review form when authToken provided and write button pressed', () => {
    mockUseQuery
      .mockReturnValue({ data: mockSummary, isLoading: false });
    // Second call (reviews) returns the list
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" authToken="test-token" />);
    fireEvent.press(screen.getByText('Escrever Avaliação'));
    expect(screen.getByText('A sua classificação')).toBeTruthy();
    expect(screen.getByText('Título (opcional)')).toBeTruthy();
    expect(screen.getByText('A sua avaliação')).toBeTruthy();
  });

  it('shows empty state when no reviews exist', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: { ...mockSummary, total_reviews: 0 }, isLoading: false })
      .mockReturnValueOnce({ data: [], isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('Seja o primeiro a avaliar!')).toBeTruthy();
  });

  it('renders helpful vote button for each review', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" />);
    expect(screen.getByText('Útil (3)')).toBeTruthy();
    expect(screen.getByText('Útil (1)')).toBeTruthy();
  });

  it('closes review form when cancel is pressed', () => {
    mockUseQuery
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false })
      .mockReturnValueOnce({ data: mockSummary, isLoading: false })
      .mockReturnValueOnce({ data: mockReviews, isLoading: false });

    render(<ReviewsSection itemId="item-1" authToken="test-token" />);
    fireEvent.press(screen.getByText('Escrever Avaliação'));
    expect(screen.getByText('Cancelar')).toBeTruthy();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Escrever Avaliação')).toBeTruthy();
  });
});
