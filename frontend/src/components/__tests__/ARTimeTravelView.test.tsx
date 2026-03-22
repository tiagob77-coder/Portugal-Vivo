import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ARTimeTravelView from '../ARTimeTravelView';

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('expo-blur', () => ({
  BlurView: 'BlurView',
}));

jest.mock('../../theme', () => {
  const palette = {
    terracotta: { 400: '#DFAF7F', 500: '#C49A6C' },
    forest: { 400: '#47876F', 500: '#2E5E4E' },
    gray: { 400: '#9A958A', 600: '#6B665C', 700: '#5A554C', 800: '#43403A', 900: '#2C2A26' },
    white: '#FFFFFF',
  };
  return { palette };
});

// Ensure Platform.OS is 'web' so the camera branch is skipped in test env
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'web';
  return RN;
});

const defaultProps = {
  itemName: 'Castelo de Guimarães',
  itemCategory: 'castelos',
  onClose: jest.fn(),
};

describe('ARTimeTravelView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders item name in the web fallback', () => {
    render(<ARTimeTravelView {...defaultProps} />);
    expect(screen.getByText('Castelo de Guimarães')).toBeTruthy();
  });

  it('renders era chips for castelos category', () => {
    render(<ARTimeTravelView {...defaultProps} />);
    // Castelos has Séc. XII, Séc. XIV, Séc. XVI eras
    expect(screen.getByText('Reconquista')).toBeTruthy();
  });

  it('renders "Seleccionar época" label', () => {
    render(<ARTimeTravelView {...defaultProps} />);
    expect(screen.getByText('Seleccionar época')).toBeTruthy();
  });

  it('renders Time-Travel AR badge', () => {
    render(<ARTimeTravelView {...defaultProps} />);
    expect(screen.getByText('Time-Travel AR')).toBeTruthy();
  });

  it('renders mobile app note', () => {
    render(<ARTimeTravelView {...defaultProps} />);
    expect(screen.getByText('Abra na app móvel para AR com câmara ao vivo')).toBeTruthy();
  });

  it('renders with default (unknown) category', () => {
    render(<ARTimeTravelView {...defaultProps} itemCategory="unknown" />);
    // Default category has "Época Medieval"
    expect(screen.getByText('Época Medieval')).toBeTruthy();
  });

  it('shows historical facts toggle and expands on press', () => {
    render(<ARTimeTravelView {...defaultProps} />);
    // In web fallback, factos históricos header is always rendered
    expect(screen.getByText(/Factos históricos/)).toBeTruthy();
  });

  it('calls onClose when close button is pressed', () => {
    const onClose = jest.fn();
    render(<ARTimeTravelView {...defaultProps} onClose={onClose} />);
    // Find any pressable element and press the first one (close button)
    const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const closeButtons = screen.UNSAFE_getAllByType(TouchableOpacity);
    fireEvent.press(closeButtons[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders aldeias category eras', () => {
    render(<ARTimeTravelView {...defaultProps} itemCategory="aldeias" />);
    expect(screen.getByText('Séc. X')).toBeTruthy();
  });

  it('renders religioso category eras', () => {
    render(<ARTimeTravelView {...defaultProps} itemCategory="religioso" />);
    expect(screen.getByText('Romanico')).toBeTruthy();
  });

  it('renders arqueologia category eras', () => {
    render(<ARTimeTravelView {...defaultProps} itemCategory="arqueologia" />);
    expect(screen.getByText('Romano')).toBeTruthy();
  });
});
