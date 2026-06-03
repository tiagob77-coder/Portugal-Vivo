import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import POICard from '../POICard';

const mockPOI = {
  id: '1',
  name: 'Torre de Belém',
  category: 'monumento',
  municipality: 'Lisboa',
  distance_km: 1.2,
  cover_image: 'https://example.com/torre.jpg',
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    {children}
  </QueryClientProvider>
);

describe('POICard', () => {
  it('renderiza nome e categoria corretamente', () => {
    const { getByText } = render(<POICard poi={mockPOI} />, { wrapper });
    expect(getByText('Torre de Belém')).toBeTruthy();
    expect(getByText('monumento')).toBeTruthy();
  });

  it('mostra distância em km', () => {
    const { getByText } = render(<POICard poi={mockPOI} />, { wrapper });
    expect(getByText(/1\.2 km/)).toBeTruthy();
  });

  it('chama onPress ao tocar no card', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <POICard poi={mockPOI} onPress={onPress} />,
      { wrapper },
    );
    fireEvent.press(getByTestId('poi-card'));
    expect(onPress).toHaveBeenCalledWith(mockPOI.id);
  });

  it('não renderiza distância quando não fornecida', () => {
    const poiWithoutDistance = { id: '2', name: 'Castelo', category: 'castelo' };
    const { queryByText } = render(<POICard poi={poiWithoutDistance} />, { wrapper });
    expect(queryByText(/km/)).toBeNull();
  });

  it('não chama onPress quando não definido', () => {
    const { getByTestId } = render(<POICard poi={mockPOI} />, { wrapper });
    expect(() => fireEvent.press(getByTestId('poi-card'))).not.toThrow();
  });

  // GEO-004 — show the approximate-location badge when the backend marks
  // the POI's coords as centroid-derived.
  it('renderiza badge de localização aproximada quando coord_precision="region"', () => {
    const approxPoi = { ...mockPOI, coord_precision: 'region' };
    const { getByTestId } = render(<POICard poi={approxPoi} />, { wrapper });
    expect(getByTestId('approx-location-badge')).toBeTruthy();
  });

  it('NÃO renderiza badge quando coord_precision="precise"', () => {
    const precisePoi = { ...mockPOI, coord_precision: 'precise' };
    const { queryByTestId } = render(<POICard poi={precisePoi} />, { wrapper });
    expect(queryByTestId('approx-location-badge')).toBeNull();
  });

  it('NÃO renderiza badge quando POI não traz proveniência (legacy)', () => {
    const { queryByTestId } = render(<POICard poi={mockPOI} />, { wrapper });
    expect(queryByTestId('approx-location-badge')).toBeNull();
  });
});
