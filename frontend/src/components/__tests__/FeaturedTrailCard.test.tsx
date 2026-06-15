import React from 'react';
import { render } from '@testing-library/react-native';
import FeaturedTrailCard from '../FeaturedTrailCard';
import type { FeaturedTrail } from '../../services/api/routes';

const mockTrail: FeaturedTrail = {
  id: 'at-10746073',
  name: 'Rota de Xertelo e as 7 Lagoas',
  region: 'Norte',
  park: 'Parque Nacional da Peneda-Gerês',
  difficulty: 'moderado',
  distance_km: 10,
  estimated_hours: 2.6,
  color: '#F59E0B',
  rating: 4.8,
  external_url: 'https://www.alltrails.com/x',
};

describe('FeaturedTrailCard', () => {
  it('renderiza o nome do trilho', () => {
    const { getByText } = render(<FeaturedTrailCard trail={mockTrail} />);
    expect(getByText('Rota de Xertelo e as 7 Lagoas')).toBeTruthy();
  });

  it('mostra a dificuldade em português', () => {
    const { getByText } = render(<FeaturedTrailCard trail={mockTrail} />);
    expect(getByText('Moderado')).toBeTruthy();
  });

  it('mostra a distância em km', () => {
    const { getByText } = render(<FeaturedTrailCard trail={mockTrail} />);
    expect(getByText(/10 km/)).toBeTruthy();
  });

  it('marca "No mapa" quando o trilho tem geometria', () => {
    const { getByText } = render(
      <FeaturedTrailCard trail={{ ...mockTrail, needs_geometry: false }} />,
    );
    expect(getByText('No mapa')).toBeTruthy();
  });

  it('marca "Geometria por confirmar" quando falta geometria', () => {
    const { getByText } = render(
      <FeaturedTrailCard trail={{ ...mockTrail, needs_geometry: true }} />,
    );
    expect(getByText('Geometria por confirmar')).toBeTruthy();
  });
});
