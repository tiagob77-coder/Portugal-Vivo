import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import MapModeSelector, { LAYER_RESPECTING_MODES } from '../MapModeSelector';

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

  it('renders all 7 mode buttons', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    expect(screen.getByText('Camadas')).toBeTruthy();
    expect(screen.getByText('Rotas')).toBeTruthy();
    expect(screen.getByText('Explorador')).toBeTruthy();
    expect(screen.getByText('Densidade')).toBeTruthy();
    expect(screen.getByText('Trilhos')).toBeTruthy();
    expect(screen.getByText('Proximidade')).toBeTruthy();
    expect(screen.getByText('Modo noturno')).toBeTruthy();
  });

  it('does not render removed modes (tecnico/premium/epochs/timeline/satellite)', () => {
    render(<MapModeSelector activeMode="markers" onModeChange={onModeChange} />);
    expect(screen.queryByText('Vista técnica')).toBeNull();
    expect(screen.queryByText('Premium')).toBeNull();
    expect(screen.queryByText('Épocas históricas')).toBeNull();
    expect(screen.queryByText('Linha do tempo')).toBeNull();
    // Satellite became a basemap toggle in NativeMap.web.tsx, not a mode.
    expect(screen.queryByText('Satélite')).toBeNull();
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

  it('renders only the subset passed via `modes` (native map)', () => {
    render(
      <MapModeSelector
        activeMode="markers"
        onModeChange={onModeChange}
        modes={['markers', 'rotas', 'explorador', 'noturno']}
      />
    );
    expect(screen.getByText('Camadas')).toBeTruthy();
    expect(screen.getByText('Rotas')).toBeTruthy();
    expect(screen.getByText('Explorador')).toBeTruthy();
    expect(screen.getByText('Modo noturno')).toBeTruthy();
    // Excluded from the native subset
    expect(screen.queryByText('Densidade')).toBeNull();
    expect(screen.queryByText('Trilhos')).toBeNull();
    expect(screen.queryByText('Proximidade')).toBeNull();
  });

  it('renders 7 mode buttons total', () => {
    const { UNSAFE_getAllByType } = render(
      <MapModeSelector activeMode="markers" onModeChange={onModeChange} />
    );
    const { TouchableOpacity } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    const buttons = UNSAFE_getAllByType(TouchableOpacity);
    expect(buttons.length).toBe(7);
  });
});

describe('LAYER_RESPECTING_MODES', () => {
  // The set is a UX contract — modes here keep the MapLayerSelector
  // visible, others hide it.

  it('includes markers (default mode)', () => {
    expect(LAYER_RESPECTING_MODES).toContain('markers');
  });

  it('includes heatmap (densidade)', () => {
    expect(LAYER_RESPECTING_MODES).toContain('heatmap');
  });

  it('includes explorador (technical overlays)', () => {
    expect(LAYER_RESPECTING_MODES).toContain('explorador');
  });

  it('does not list satellite — it is a basemap toggle, not a mode', () => {
    // Satellite moved out of the mode lineup (NativeMap.web.tsx "SAT"
    // button). The layer selector now follows the underlying mode, so
    // satellite imagery can overlay markers/heatmap/explorador with the
    // selector still visible.
    expect(LAYER_RESPECTING_MODES).not.toContain('satellite' as never);
  });

  it('excludes modes with their own data sources', () => {
    // trails fetches /trails, proximity fetches /proximity/nearby,
    // noturno fetches /map/night-explorer, rotas fetches infra +
    // cultural-routes. Their item lists never look at active categories.
    expect(LAYER_RESPECTING_MODES).not.toContain('trails');
    expect(LAYER_RESPECTING_MODES).not.toContain('proximity');
    expect(LAYER_RESPECTING_MODES).not.toContain('noturno');
    expect(LAYER_RESPECTING_MODES).not.toContain('rotas');
  });
});
