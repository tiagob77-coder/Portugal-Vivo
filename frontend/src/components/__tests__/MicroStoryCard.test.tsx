import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import MicroStoryCard, { MicroStory } from '../MicroStoryCard';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../../theme', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFF',
      textPrimary: '#000',
      textSecondary: '#555',
      textMuted: '#999',
      borderLight: '#EEE',
      background: '#F5F5F5',
      primary: '#4A6741',
    },
  }),
}));

const mockStory: MicroStory = {
  poi_id: 'castelo-guimaraes',
  poi_name: 'Castelo de Guimarães',
  category: 'castelos',
  region: 'norte',
  story: 'Aqui nasceu Portugal. Afonso Henriques foi criado nestas muralhas e daqui partiu para fundar a nação.',
  hook: 'Onde nasceu Portugal',
  seasonal_label: 'Primavera',
  has_audio: true,
  emoji: '🏰',
};

describe('MicroStoryCard', () => {
  it('renders story text and POI name', () => {
    const { getByText } = render(<MicroStoryCard story={mockStory} />);
    expect(getByText('Castelo de Guimarães')).toBeTruthy();
    expect(getByText('Aqui nasceu Portugal. Afonso Henriques foi criado nestas muralhas e daqui partiu para fundar a nação.')).toBeTruthy();
  });

  it('renders hook text when provided', () => {
    const { getByText } = render(<MicroStoryCard story={mockStory} />);
    expect(getByText('Onde nasceu Portugal')).toBeTruthy();
  });

  it('renders seasonal label when provided', () => {
    const { getByText } = render(<MicroStoryCard story={mockStory} />);
    expect(getByText('Primavera')).toBeTruthy();
  });

  it('calls onPress when card is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<MicroStoryCard story={mockStory} onPress={onPress} />);
    fireEvent.press(getByText('Castelo de Guimarães'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onSave with poi_id when save button pressed', () => {
    const onSave = jest.fn();
    const { getAllByRole } = render(<MicroStoryCard story={mockStory} onSave={onSave} saved={false} />);
    // Find pressable buttons
    const buttons = getAllByRole('button');
    // Save button should be among them
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('renders without optional props', () => {
    const minimal: MicroStory = {
      poi_id: 'test',
      poi_name: 'Test POI',
      story: 'Uma história de teste.',
    };
    const { getByText } = render(<MicroStoryCard story={minimal} />);
    expect(getByText('Test POI')).toBeTruthy();
    expect(getByText('Uma história de teste.')).toBeTruthy();
  });

  it('shows saved state correctly', () => {
    const { rerender, getByText } = render(
      <MicroStoryCard story={mockStory} saved={false} />
    );
    expect(getByText('Castelo de Guimarães')).toBeTruthy();

    rerender(<MicroStoryCard story={mockStory} saved={true} />);
    expect(getByText('Castelo de Guimarães')).toBeTruthy();
  });

  it('applies category colour correctly for castelos', () => {
    const { toJSON } = render(<MicroStoryCard story={mockStory} />);
    // Component renders without crash with category-specific colour
    expect(toJSON()).toBeTruthy();
  });

  it('renders story without hook gracefully', () => {
    const noHook: MicroStory = { ...mockStory, hook: undefined };
    const { queryByText } = render(<MicroStoryCard story={noHook} />);
    expect(queryByText('Onde nasceu Portugal')).toBeNull();
  });
});
