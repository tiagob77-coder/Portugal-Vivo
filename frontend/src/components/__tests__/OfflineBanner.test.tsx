import React from 'react';
import { render, act } from '@testing-library/react-native';

// Capture the NetInfo listener callback
let netInfoCallback: (state: any) => void;

jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn((cb: any) => {
    netInfoCallback = cb;
    return jest.fn(); // unsubscribe
  }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({ colors: {} }),
}));

jest.mock('../../services/offlineCache', () => ({
  __esModule: true,
  default: {
    getPendingActionCount: jest.fn().mockResolvedValue(0),
  },
}));

import OfflineBanner from '../OfflineBanner';

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when online (initial state)', () => {
    const { toJSON } = render(<OfflineBanner />);
    expect(toJSON()).toBeNull();
  });

  it('shows offline banner when network goes offline', () => {
    const { getByText } = render(<OfflineBanner />);

    act(() => {
      netInfoCallback({ isConnected: false });
    });

    expect(getByText(/Modo Offline/)).toBeTruthy();
  });

  it('shows back-online message when network reconnects', () => {
    const { getByText } = render(<OfflineBanner />);

    // Go offline first
    act(() => {
      netInfoCallback({ isConnected: false });
    });

    // Come back online
    act(() => {
      netInfoCallback({ isConnected: true });
    });

    expect(getByText('De volta online')).toBeTruthy();
  });
});
