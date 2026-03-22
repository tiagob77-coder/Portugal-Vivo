import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import NotificationSettings from '../NotificationSettings';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme/colors', () => ({
  palette: {
    terracotta: { 500: '#C96A42' },
    gray: { 50: '#F8FAFC' },
  },
  withOpacity: (_hex: string, opacity: number) => `rgba(0,0,0,${opacity})`,
}));

// AsyncStorage is mocked globally in jest.setup.js

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('NotificationSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the heading and subheading after loading', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => {
      expect(getByText('Notificações')).toBeTruthy();
    });
    expect(getByText('Controle como e quando recebe alertas')).toBeTruthy();
  });

  it('renders toggle rows for Proximidade, Eventos and Resumo semanal', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => expect(getByText('Proximidade')).toBeTruthy());
    expect(getByText('Eventos')).toBeTruthy();
    expect(getByText('Resumo semanal')).toBeTruthy();
  });

  it('renders quiet-hours section', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => expect(getByText('Horas silenciosas')).toBeTruthy());
    expect(getByText('22:00')).toBeTruthy();
    expect(getByText('08:00')).toBeTruthy();
  });

  it('renders all regions as chips', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => expect(getByText('Norte')).toBeTruthy());
    const REGIONS = ['Centro', 'Lisboa', 'Alentejo', 'Algarve', 'Açores', 'Madeira'];
    REGIONS.forEach((region) => {
      expect(getByText(region)).toBeTruthy();
    });
  });

  it('calls onSave with updated prefs when a toggle is changed', async () => {
    const onSave = jest.fn();
    const { UNSAFE_getAllByType } = render(<NotificationSettings onSave={onSave} />);

    const Switch = require('react-native').Switch;
    // Wait for the component to load
    await waitFor(() => UNSAFE_getAllByType(Switch));

    const switches = UNSAFE_getAllByType(Switch);
    await act(async () => {
      fireEvent(switches[0], 'valueChange', false);
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ proximityEnabled: false })
    );
  });

  it('toggles a region chip on press', async () => {
    const onSave = jest.fn();
    const { getByText } = render(<NotificationSettings onSave={onSave} />);

    await waitFor(() => expect(getByText('Lisboa')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Lisboa'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ favoriteRegions: ['Lisboa'] })
    );
  });

  it('renders quiet hours Início and Fim labels', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => expect(getByText('Início')).toBeTruthy());
    expect(getByText('Fim')).toBeTruthy();
  });

  it('renders without crashing when no onSave prop provided', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => expect(getByText('Notificações')).toBeTruthy());
  });

  it('shows the Regiões favoritas section', async () => {
    const { getByText } = render(<NotificationSettings />);
    await waitFor(() => expect(getByText('Regiões favoritas')).toBeTruthy());
  });
});
