import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ImageUpload from '../ImageUpload';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  uploadImage: jest.fn(() => Promise.resolve({ url: 'https://example.com/photo.jpg' })),
}));

jest.mock('../../theme/colors', () => ({
  palette: {
    terracotta: { 500: '#C49A6C' },
  },
  withOpacity: (color: string, _opacity: number) => color,
}));

const defaultProps = {
  token: 'test-token',
  context: 'poi' as const,
  itemId: 'item-1',
  onUpload: jest.fn(),
};

describe('ImageUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders placeholder text in the default (empty) state', () => {
    render(<ImageUpload {...defaultProps} />);
    expect(screen.getByText('Adicionar foto')).toBeTruthy();
  });

  it('shows hint text with max size', () => {
    render(<ImageUpload {...defaultProps} maxSizeMB={5} />);
    expect(screen.getByText('JPEG, PNG ou WebP (máx. 5 MB)')).toBeTruthy();
  });

  it('uses custom maxSizeMB in hint text', () => {
    render(<ImageUpload {...defaultProps} maxSizeMB={10} />);
    expect(screen.getByText('JPEG, PNG ou WebP (máx. 10 MB)')).toBeTruthy();
  });

  it('renders a touchable dropzone', () => {
    const { UNSAFE_getAllByType } = render(<ImageUpload {...defaultProps} />);
    const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const touchables = UNSAFE_getAllByType(TouchableOpacity);
    expect(touchables.length).toBeGreaterThanOrEqual(1);
  });

  it('renders without crashing for review context', () => {
    expect(() =>
      render(<ImageUpload {...defaultProps} context="review" />)
    ).not.toThrow();
  });

  it('renders without crashing for contribution context', () => {
    expect(() =>
      render(<ImageUpload {...defaultProps} context="contribution" />)
    ).not.toThrow();
  });

  it('renders without crashing for general context', () => {
    expect(() =>
      render(<ImageUpload {...defaultProps} context="general" />)
    ).not.toThrow();
  });

  it('accepts an onUpload callback without errors', () => {
    const onUpload = jest.fn();
    expect(() =>
      render(<ImageUpload {...defaultProps} onUpload={onUpload} />)
    ).not.toThrow();
  });
});
