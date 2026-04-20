import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import RouteShareButton from '../RouteShareButton';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../config/api', () => ({
  API_BASE: 'http://localhost:8000/api',
}));

jest.mock('../../theme', () => ({
  palette: {
    terracotta: { 500: '#C96A42' },
    gray: { 50: '#F8FAFC' },
  },
  withOpacity: (_hex: string, opacity: number) => `rgba(0,0,0,${opacity})`,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const makePOI = (id: string, name: string, order: number) => ({
  id,
  name,
  location: { lat: 38.7, lng: -9.1 },
  category: 'Monumento',
  order,
});

const defaultProps = {
  routeName: 'Rota Histórica de Lisboa',
  pois: [makePOI('p1', 'Torre de Belém', 1), makePOI('p2', 'Jerónimos', 2)],
};

const mockSaveResponse = {
  ok: true,
  json: async () => ({
    share_code: 'ABC123',
    share_url: '/shared/routes/ABC123',
  }),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RouteShareButton', () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue(mockSaveResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the Partilhar Rota trigger button', () => {
    const { getByText } = render(<RouteShareButton {...defaultProps} />);
    expect(getByText('Partilhar Rota')).toBeTruthy();
  });

  it('opens the share modal after successfully saving the route', async () => {
    const { getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getAllByText('Partilhar Rota').length).toBeGreaterThan(1));
  });

  it('shows the route name inside the modal', async () => {
    const { getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() =>
      expect(getAllByText('Rota Histórica de Lisboa').length).toBeGreaterThan(0)
    );
  });

  it('shows POI count in the preview card', async () => {
    const { getByText, getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getByText('2')).toBeTruthy());
  });

  it('shows distance and duration from metrics', async () => {
    const { getByText, getAllByText } = render(
      <RouteShareButton
        {...defaultProps}
        metrics={{ distance: 5.7, duration: 45 }}
      />
    );

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getByText('5.7 km')).toBeTruthy());
    expect(getByText('45 min')).toBeTruthy();
  });

  it('shows -- for distance and duration when metrics is not provided', async () => {
    const { getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => {
      const dashes = getAllByText('--');
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows share code in the modal', async () => {
    const { getByText, getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getByText('ABC123')).toBeTruthy());
  });

  it('shows share targets: Copiar Link, WhatsApp, Partilhar', async () => {
    const { getByText, getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getByText('Copiar Link')).toBeTruthy());
    expect(getByText('WhatsApp')).toBeTruthy();
  });

  it('closes the modal when Fechar is pressed', async () => {
    const { getByText, queryByText, getAllByText } = render(
      <RouteShareButton {...defaultProps} />
    );

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getByText('Fechar')).toBeTruthy());
    fireEvent.press(getByText('Fechar'));

    await waitFor(() => expect(queryByText('Copiar Link')).toBeNull());
  });

  it('shows error message when fetch fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    const { getByText, getAllByText } = render(<RouteShareButton {...defaultProps} />);

    await act(async () => {
      fireEvent.press(getAllByText('Partilhar Rota')[0]);
    });

    await waitFor(() => expect(getByText(/Nao foi possivel criar/)).toBeTruthy());
  });

  it('renders without crashing when pois array is empty', () => {
    const { getByText } = render(
      <RouteShareButton routeName="Empty Route" pois={[]} />
    );
    expect(getByText('Partilhar Rota')).toBeTruthy();
  });
});
