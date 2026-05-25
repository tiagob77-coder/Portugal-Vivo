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

  it('renders all 8 mode buttons', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    expect(screen.getByText('Camadas')).toBeTruthy();
    expect(screen.getByText('Rotas & Trilhos')).toBeTruthy();
    expect(screen.getByText('Explorador')).toBeTruthy();
    expect(screen.getByText('Densidade')).toBeTruthy();
    expect(screen.getByText('Trilhos')).toBeTruthy();
    expect(screen.getByText('Proximidade')).toBeTruthy();
    expect(screen.getByText('Modo noturno')).toBeTruthy();
    expect(screen.getByText('Satélite')).toBeTruthy();
  });

  it('does not render the removed tecnico/premium/epochs/timeline modes', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    expect(screen.queryByText('Vista técnica')).toBeNull();
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.queryByText('Épocas históricas')).toBeNull();
    expect(screen.queryByText('Linha do tempo')).toBeNull();
  });

  it('calls onModeChange with "explorador" when Explorador is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Explorador'));
    expect(onModeChange).toHaveBeenCalledWith('explorador');
  });

  it('calls onModeChange with "heatmap" when Densidade is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Densidade'));
    expect(onModeChange).toHaveBeenCalledWith('heatmap');
  });

  it('calls onModeChange with "trails" when Trilhos is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Trilhos'));
    expect(onModeChange).toHaveBeenCalledWith('trails');
  });

  it('calls onModeChange with "proximity" when Proximidade is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Proximidade'));
    expect(onModeChange).toHaveBeenCalledWith('proximity');
  });

  it('calls onModeChange with "noturno" when Modo noturno is pressed', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    fireEvent.press(screen.getByText('Modo noturno'));
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

  it('renders 8 mode buttons total', () => {
    const { UNSAFE_getAllByType } = render(
      <MapModeSelector activeMode="markers" onModeChange={onModeChange} />
    );
    const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    expect(buttons.length).toBe(8);
  });
});
