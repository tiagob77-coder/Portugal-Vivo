import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../services/api', () => ({
  enrichEvent: jest.fn(),
  getEventToNatureItinerary: jest.fn(),
}));

import { enrichEvent } from '../../services/api';
import DiscoveryCard from '../DiscoveryCard';

const mockEnrichEvent = enrichEvent as jest.Mock;

const mockEnrichment = {
  geo_context: {
    freguesia: 'São Nicolau',
    concelho: 'Porto',
    distrito: 'Porto',
  },
  protected_area: {
    area: { name: 'Parque Natural da Serra da Estrela', designation: 'Parque Natural' },
    distance_km: 12.5,
  },
  transport: [
    { id: 'stop-1', name: 'Estação São Bento', operator: 'CP', distance_m: 200, transport_type: 'train' },
  ],
  nature_suggestions: [],
};

describe('DiscoveryCard', () => {
  beforeEach(() => {
    mockEnrichEvent.mockReset();
  });

  it('shows ActivityIndicator while loading', () => {
    // Never resolving promise simulates loading
    mockEnrichEvent.mockReturnValue(new Promise(() => {}));

    const { UNSAFE_getByType } = render(
      <DiscoveryCard eventName="Festa de São João" lat={41.15} lng={-8.61} />
    );

    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('returns null when enrichment fails', async () => {
    mockEnrichEvent.mockRejectedValue(new Error('API error'));

    const { toJSON } = render(
      <DiscoveryCard eventName="Test Event" lat={41.15} lng={-8.61} />
    );

    await waitFor(() => {
      expect(toJSON()).toBeNull();
    });
  });

  it('renders geo context and enrichment data on success', async () => {
    mockEnrichEvent.mockResolvedValue(mockEnrichment);

    render(
      <DiscoveryCard eventName="Festa de São João" lat={41.15} lng={-8.61} />
    );

    await waitFor(() => {
      expect(screen.getByText(/São Nicolau/)).toBeTruthy();
    });

    expect(screen.getByText('Parque Natural da Serra da Estrela')).toBeTruthy();
    expect(screen.getByText('Área Protegida Próxima')).toBeTruthy();
    expect(screen.getByText('12.5 km')).toBeTruthy();
  });

  it('renders transport section when transport data exists', async () => {
    mockEnrichEvent.mockResolvedValue(mockEnrichment);

    render(
      <DiscoveryCard eventName="Festa" lat={41.15} lng={-8.61} />
    );

    await waitFor(() => {
      expect(screen.getByText('Transportes Próximos')).toBeTruthy();
    });

    expect(screen.getByText('Estação São Bento')).toBeTruthy();
    expect(screen.getByText('200m')).toBeTruthy();
  });
});
