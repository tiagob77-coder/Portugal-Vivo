import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import NatureExplorer from '../NatureExplorer';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  getProtectedAreas: jest.fn(),
  getBiodiversityStations: jest.fn(),
  getNotableSpecies: jest.fn(),
  getNatura2000Sites: jest.fn(),
  getNatureMapLayers: jest.fn(),
}));

jest.mock('../../theme', () => ({
  stateColors: {
    event: { natureza: '#22C55E' },
    surf: { good: '#3B82F6', flat: '#9CA3AF', poor: '#EF4444' },
  },
  palette: {
    white: '#FFFFFF',
  },
}));

import {
  getProtectedAreas,
  getBiodiversityStations,
  getNotableSpecies,
  getNatureMapLayers,
} from '../../services/api';

const mockGetProtectedAreas = getProtectedAreas as jest.Mock;
const mockGetBiodiversityStations = getBiodiversityStations as jest.Mock;
const mockGetNotableSpecies = getNotableSpecies as jest.Mock;
const mockGetNatureMapLayers = getNatureMapLayers as jest.Mock;

const mockAreas = [
  {
    id: 'area-1',
    name: 'Parque Natural da Serra da Estrela',
    designation: 'Parque Natural',
    description: 'Maior parque natural de Portugal',
    region: 'Beira Interior',
    area_km2: 1009,
    distance_km: 120,
  },
];

const mockStations = [
  {
    id: 'station-1',
    name: 'Estação de Biodiversidade de Sagres',
    habitat_type: 'Costeiro',
    species_count: 45,
    highlights: ['Cegonha-branca', 'Águia de Bonelli'],
    distance_km: 15,
  },
];

const mockSpecies = [
  {
    taxon_key: 'sp-1',
    name: 'Lince-ibérico',
    scientific: 'Lynx pardinus',
    iucn: 'EN',
    habitat: 'Floresta mediterrânica',
    regions: ['Alentejo', 'Algarve'],
  },
];

describe('NatureExplorer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetProtectedAreas.mockResolvedValue({ areas: mockAreas });
    mockGetBiodiversityStations.mockResolvedValue({ stations: mockStations });
    mockGetNotableSpecies.mockResolvedValue({ species: mockSpecies });
    mockGetNatureMapLayers.mockResolvedValue({ layers: [] });
  });

  it('shows loading indicator initially', () => {
    const { UNSAFE_getByType } = render(<NatureExplorer />);
    const { ActivityIndicator } = require('react-native'); // eslint-disable-line @typescript-eslint/no-require-imports
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('shows loading text initially', () => {
    render(<NatureExplorer />);
    expect(screen.getByText('A carregar natureza...')).toBeTruthy();
  });

  it('renders header and title after data loads', async () => {
    const { findByText } = render(<NatureExplorer />);
    expect(await findByText('Natureza & Biodiversidade')).toBeTruthy();
  });

  it('renders protected areas tab with count after load', async () => {
    const { findByText } = render(<NatureExplorer />);
    expect(await findByText(/Áreas Protegidas/)).toBeTruthy();
  });

  it('renders area name after data loads', async () => {
    const { findByText } = render(<NatureExplorer />);
    expect(await findByText('Parque Natural da Serra da Estrela')).toBeTruthy();
  });

  it('renders area designation after data loads', async () => {
    const { findByText } = render(<NatureExplorer />);
    expect(await findByText('Parque Natural')).toBeTruthy();
  });

  it('switches to biodiversity tab and shows station name', async () => {
    const { findByText } = render(<NatureExplorer />);
    // Wait for loading to finish
    await findByText('Natureza & Biodiversidade');
    // There are two elements matching /Biodiversidade/ (header + tab label), get the tab
    const biodiversityTabs = screen.getAllByText(/Biodiversidade/);
    const biodiversityTab = biodiversityTabs[biodiversityTabs.length - 1];
    await act(async () => {
      fireEvent.press(biodiversityTab);
    });
    expect(screen.getByText('Estação de Biodiversidade de Sagres')).toBeTruthy();
  });

  it('switches to species tab and shows species name', async () => {
    const { findByText } = render(<NatureExplorer />);
    await findByText('Natureza & Biodiversidade');
    const speciesTab = screen.getByText(/Espécies/);
    await act(async () => {
      fireEvent.press(speciesTab);
    });
    expect(screen.getByText('Lince-ibérico')).toBeTruthy();
  });

  it('shows scientific name in species tab', async () => {
    const { findByText } = render(<NatureExplorer />);
    await findByText('Natureza & Biodiversidade');
    const speciesTab = screen.getByText(/Espécies/);
    await act(async () => {
      fireEvent.press(speciesTab);
    });
    expect(screen.getByText('Lynx pardinus')).toBeTruthy();
  });

  it('calls onAreaPress when area card is pressed', async () => {
    const onAreaPress = jest.fn();
    const { findByText } = render(<NatureExplorer onAreaPress={onAreaPress} />);
    const areaCard = await findByText('Parque Natural da Serra da Estrela');
    fireEvent.press(areaCard);
    expect(onAreaPress).toHaveBeenCalledWith(mockAreas[0]);
  });

  it('renders with lat/lng props without crashing', async () => {
    const { findByText } = render(<NatureExplorer lat={38.72} lng={-9.14} />);
    expect(await findByText('Natureza & Biodiversidade')).toBeTruthy();
  });

  it('handles empty API responses gracefully', async () => {
    mockGetProtectedAreas.mockResolvedValue({ areas: [] });
    mockGetBiodiversityStations.mockResolvedValue({ stations: [] });
    mockGetNotableSpecies.mockResolvedValue({ species: [] });

    const { findByText } = render(<NatureExplorer />);
    expect(await findByText('Natureza & Biodiversidade')).toBeTruthy();
  });
});
