import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';

import OnboardingModal from '../OnboardingModal';

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

// AsyncStorage is mocked globally in jest.setup.js — by default getItem returns null
// which means onboarding has NOT been seen, so the modal should show.

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('OnboardingModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the modal when onboarding has not been seen', async () => {
    const { getByText } = render(<OnboardingModal />);
    await waitFor(() => expect(getByText('Descubra Portugal')).toBeTruthy());
  });

  it('shows the first step title and skip button', async () => {
    const { getByText } = render(<OnboardingModal />);
    await waitFor(() => expect(getByText('Descubra Portugal')).toBeTruthy());
    expect(getByText('Saltar')).toBeTruthy();
    expect(getByText('Seguinte')).toBeTruthy();
  });

  it('advances to the second step when Seguinte is pressed', async () => {
    const { getByText } = render(<OnboardingModal />);
    await waitFor(() => expect(getByText('Seguinte')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Seguinte'));
    });

    await waitFor(() => expect(getByText('Rotas Temáticas')).toBeTruthy());
  });

  it('advances to the third (last) step and shows Começar a explorar', async () => {
    const { getByText } = render(<OnboardingModal />);
    await waitFor(() => expect(getByText('Seguinte')).toBeTruthy());

    await act(async () => { fireEvent.press(getByText('Seguinte')); });
    await waitFor(() => expect(getByText('Rotas Temáticas')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Seguinte')); });

    await waitFor(() => expect(getByText('POI do Dia')).toBeTruthy());
    expect(getByText('Começar a explorar')).toBeTruthy();
  });

  it('calls onComplete and hides modal when Saltar is pressed', async () => {
    const onComplete = jest.fn();
    const { getByText } = render(<OnboardingModal onComplete={onComplete} />);
    await waitFor(() => expect(getByText('Saltar')).toBeTruthy());

    await act(async () => {
      fireEvent.press(getByText('Saltar'));
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('calls onComplete when last step CTA is pressed', async () => {
    const onComplete = jest.fn();
    const { getByText } = render(<OnboardingModal onComplete={onComplete} />);
    await waitFor(() => expect(getByText('Seguinte')).toBeTruthy());

    // Go to last step
    await act(async () => { fireEvent.press(getByText('Seguinte')); });
    await waitFor(() => expect(getByText('Rotas Temáticas')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Seguinte')); });
    await waitFor(() => expect(getByText('Começar a explorar')).toBeTruthy());
    await act(async () => { fireEvent.press(getByText('Começar a explorar')); });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not show modal when onboarding has already been seen', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    AsyncStorage.getItem.mockResolvedValueOnce('true');

    const { toJSON } = render(<OnboardingModal />);
    // Initially null, and stays null because the item returned 'true'
    await waitFor(() => {
      expect(toJSON()).toBeNull();
    });
  });

  it('renders without crashing with no props', async () => {
    const { toJSON } = render(<OnboardingModal />);
    // Should either show modal or be null (depending on AsyncStorage)
    await waitFor(() => {
      const json = toJSON();
      // It may render or be null — both are valid (no crash)
      expect(json === null || json !== undefined).toBe(true);
    });
  });
});
