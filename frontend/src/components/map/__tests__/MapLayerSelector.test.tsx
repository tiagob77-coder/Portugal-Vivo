import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import MapLayerSelector from '../MapLayerSelector';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

// The source file imports from '../../../src/theme' (which resolves to the root src/theme)
// We mock the resolved module path instead
jest.mock('../../../theme', () => ({
  stateColors: {
    rarity: { raro: '#8B5CF6' },
  },
}));

const mockLayers = [
  { id: 'heritage', name: 'Património', icon: 'account-balance', color: '#C49A6C' },
  { id: 'nature', name: 'Natureza', icon: 'park', color: '#22C55E' },
  { id: 'beach', name: 'Praias', icon: 'beach-access', color: '#3B82F6' },
];

const mockSubcategories = {
  heritage: [
    { id: 'castles', name: 'Castelos', icon: 'fort' },
    { id: 'churches', name: 'Igrejas', icon: 'church' },
  ],
  nature: [
    { id: 'parks', name: 'Parques', icon: 'park' },
    { id: 'beaches', name: 'Praias', icon: 'beach-access', comingSoon: true },
  ],
  beach: [],
};

const defaultProps = {
  layers: mockLayers,
  subcategories: mockSubcategories,
  activeSubcategories: [],
  expandedLayer: null,
  onToggleLayer: jest.fn(),
  onToggleSubcategory: jest.fn(),
  onExpandLayer: jest.fn(),
  getLayerSubcategories: (layerId: string) =>
    mockSubcategories[layerId as keyof typeof mockSubcategories]?.map((s) => s.id) ?? [],
};

describe('MapLayerSelector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Camadas" section header when not in native mode', () => {
    render(<MapLayerSelector {...defaultProps} />);
    expect(screen.getByText('Camadas')).toBeTruthy();
  });

  it('does not render "Camadas" section header in native mode', () => {
    render(<MapLayerSelector {...defaultProps} isNative />);
    expect(screen.queryByText('Camadas')).toBeNull();
  });

  it('renders all layer chips', () => {
    render(<MapLayerSelector {...defaultProps} />);
    expect(screen.getByText('Património')).toBeTruthy();
    expect(screen.getByText('Natureza')).toBeTruthy();
    expect(screen.getByText('Praias')).toBeTruthy();
  });

  it('calls onExpandLayer when a layer chip is pressed (non-native mode)', () => {
    render(<MapLayerSelector {...defaultProps} />);
    fireEvent.press(screen.getByText('Património'));
    expect(defaultProps.onExpandLayer).toHaveBeenCalledWith('heritage');
  });

  it('calls onToggleLayer when a layer chip is pressed in native mode', () => {
    render(<MapLayerSelector {...defaultProps} isNative />);
    fireEvent.press(screen.getByText('Património'));
    expect(defaultProps.onToggleLayer).toHaveBeenCalledWith('heritage');
  });

  it('calls onExpandLayer with null when pressing expanded layer (collapse)', () => {
    render(<MapLayerSelector {...defaultProps} expandedLayer="heritage" />);
    fireEvent.press(screen.getByText('Património'));
    expect(defaultProps.onExpandLayer).toHaveBeenCalledWith(null);
  });

  it('renders subcategories when a layer is expanded', () => {
    render(<MapLayerSelector {...defaultProps} expandedLayer="heritage" />);
    expect(screen.getByText('Castelos')).toBeTruthy();
    expect(screen.getByText('Igrejas')).toBeTruthy();
  });

  it('renders subcategory header label with layer name', () => {
    render(<MapLayerSelector {...defaultProps} expandedLayer="heritage" />);
    expect(screen.getByText('Património — subcategorias')).toBeTruthy();
  });

  it('calls onToggleSubcategory when an active subcategory is pressed', () => {
    render(<MapLayerSelector {...defaultProps} expandedLayer="heritage" />);
    fireEvent.press(screen.getByText('Castelos'));
    expect(defaultProps.onToggleSubcategory).toHaveBeenCalledWith('castles', 'heritage');
  });

  it('renders "Selecionar tudo" toggle button when no subs are active', () => {
    render(<MapLayerSelector {...defaultProps} expandedLayer="heritage" />);
    expect(screen.getByText('Selecionar tudo')).toBeTruthy();
  });

  it('renders "Desmarcar tudo" when all layer subs are active', () => {
    render(
      <MapLayerSelector
        {...defaultProps}
        expandedLayer="heritage"
        activeSubcategories={['castles', 'churches']}
      />
    );
    expect(screen.getByText('Desmarcar tudo')).toBeTruthy();
  });

  it('shows comingSoon badge for subcategories marked as coming soon', () => {
    render(<MapLayerSelector {...defaultProps} expandedLayer="nature" />);
    expect(screen.getByText('Praias (em breve)')).toBeTruthy();
  });

  it('shows active count badge when layer subcategories are active', () => {
    render(
      <MapLayerSelector
        {...defaultProps}
        activeSubcategories={['castles']}
      />
    );
    // The layer badge for heritage should show "1/2" in non-native mode
    expect(screen.getByText('1/2')).toBeTruthy();
  });

  it('renders without crashing with no active subcategories', () => {
    expect(() => render(<MapLayerSelector {...defaultProps} />)).not.toThrow();
  });
});
