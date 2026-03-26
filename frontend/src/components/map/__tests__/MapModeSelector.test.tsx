import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import MapModeSelector from '../MapModeSelector';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../../theme', () => ({
  palette: {
    white: '#FFFFFF',
    gray: { 500: '#64748B' },
    forest: { 600: '#1E4D40' },
  },
  withOpacity: (color: string, _opacity: number) => color,
}));

describe('MapModeSelector', () => {
  const onModeChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all mode buttons', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    expect(screen.getByText('Camadas')).toBeTruthy();
    expect(screen.getByText('Explorador')).toBeTruthy();
    expect(screen.getByText('Heatmap')).toBeTruthy();
    expect(screen.getByText('Trilhos')).toBeTruthy();
    expect(screen.getByText('Épocas')).toBeTruthy();
    expect(screen.getByText('Timeline')).toBeTruthy();
    expect(screen.getByText('Proximidade')).toBeTruthy();
    expect(screen.getByText('Noturno')).toBeTruthy();
    expect(screen.getByText('Satélite')).toBeTruthy();
    expect(screen.getByText('Técnico')).toBeTruthy();
    expect(screen.getByText('Premium')).toBeTruthy();
  });

  it('calls onModeChange with "explorador" when Explorador is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Explorador'));
    expect(onModeChange).toHaveBeenCalledWith('explorador');
  });

  it('calls onModeChange with "heatmap" when Heatmap is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Heatmap'));
    expect(onModeChange).toHaveBeenCalledWith('heatmap');
  });

  it('calls onModeChange with "trails" when Trilhos is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Trilhos'));
    expect(onModeChange).toHaveBeenCalledWith('trails');
  });

  it('calls onModeChange with "epochs" when Épocas is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Épocas'));
    expect(onModeChange).toHaveBeenCalledWith('epochs');
  });

  it('calls onModeChange with "proximity" when Proximidade is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Proximidade'));
    expect(onModeChange).toHaveBeenCalledWith('proximity');
  });

  it('calls onModeChange with "noturno" when Noturno is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Noturno'));
    expect(onModeChange).toHaveBeenCalledWith('noturno');
  });

  it('calls onModeChange with "satellite" when Satélite is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Satélite'));
    expect(onModeChange).toHaveBeenCalledWith('satellite');
  });

  it('renders without crashing with "heatmap" as active mode', () => {
    expect(() =>
      render(<MapModeSelector activeMode="heatmap" onModeChange={onModeChange} />)
    ).not.toThrow();
  });

  it('renders without crashing with "noturno" as active mode', () => {
    expect(() =>
      render(<MapModeSelector activeMode="noturno" onModeChange={onModeChange} />)
    ).not.toThrow();
  });

  it('renders 11 mode buttons total', () => {
    const { UNSAFE_getAllByType } = render(
      <MapModeSelector activeMode="markers" onModeChange={onModeChange} />
    );
    const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    // 11 modes: markers, explorador, heatmap, trails, epochs, timeline,
    //           proximity, noturno, satellite, tecnico, premium
    expect(buttons.length).toBe(11);
  });

  it('calls onModeChange with "tecnico" when Técnico is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Técnico'));
    expect(onModeChange).toHaveBeenCalledWith('tecnico');
  });

  it('calls onModeChange with "premium" when Premium is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Premium'));
    expect(onModeChange).toHaveBeenCalledWith('premium');
  });
});
