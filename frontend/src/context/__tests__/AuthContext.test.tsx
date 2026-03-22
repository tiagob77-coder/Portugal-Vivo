// @ts-nocheck
/**
 * Tests for AuthContext / AuthProvider
 * Covers: login, logout, token persistence, user state, loading state, unauthenticated state
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

// ──────────────────────────────────────────────
// In-memory AsyncStorage mock
// ──────────────────────────────────────────────
const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    mockStorage[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete mockStorage[key];
    return Promise.resolve();
  }),
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage[key] ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage[key] = value;
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      delete mockStorage[key];
      return Promise.resolve();
    }),
  },
}));

// ──────────────────────────────────────────────
// API mocks
// ──────────────────────────────────────────────
const mockExchangeSession = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockApiLogout = jest.fn();
const mockGetSubscriptionStatus = jest.fn();

jest.mock('../../services/api', () => ({
  exchangeSession: (...args: any[]) => mockExchangeSession(...args),
  getCurrentUser: (...args: any[]) => mockGetCurrentUser(...args),
  logout: (...args: any[]) => mockApiLogout(...args),
  getSubscriptionStatus: (...args: any[]) => mockGetSubscriptionStatus(...args),
}));

// ──────────────────────────────────────────────
// Platform & navigation mocks
// ──────────────────────────────────────────────
// Use the real Platform module but ensure OS is set to 'ios' (non-web)
// so the non-web code path is exercised
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'ios';
  return RN;
});

const mockGetInitialURL = jest.fn(() => Promise.resolve(null));
const mockAddEventListener = jest.fn(() => ({ remove: jest.fn() }));
const mockCreateURL = jest.fn(() => 'myapp://');

jest.mock('expo-linking', () => ({
  getInitialURL: () => mockGetInitialURL(),
  addEventListener: (...args: any[]) => mockAddEventListener(...args),
  createURL: (...args: any[]) => mockCreateURL(...args),
}));

jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(() =>
    Promise.resolve({ type: 'cancel' })
  ),
}));

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
const mockUser = {
  user_id: 'u-001',
  id: 'u-001',
  email: 'test@example.com',
  name: 'Test User',
  picture: 'https://example.com/avatar.png',
  favorites: [],
};

// A consumer component that exposes context values via test IDs
function TestConsumer() {
  const { useAuth } = require('../../context/AuthContext');
  const { user, isLoading, isAuthenticated, sessionToken, premiumTier, isPremium, logout, refreshUser, refreshSubscription } = useAuth();
  return (
    <>
      <Text testID="loading">{String(isLoading)}</Text>
      <Text testID="authenticated">{String(isAuthenticated)}</Text>
      <Text testID="user-name">{user?.name ?? 'no-user'}</Text>
      <Text testID="session-token">{sessionToken ?? 'no-token'}</Text>
      <Text testID="premium-tier">{premiumTier}</Text>
      <Text testID="is-premium">{String(isPremium)}</Text>
      <Text testID="logout" onPress={logout}>Logout</Text>
      <Text testID="refresh-user" onPress={refreshUser}>RefreshUser</Text>
      <Text testID="refresh-sub" onPress={refreshSubscription}>RefreshSub</Text>
    </>
  );
}

function renderWithProvider() {
  // Dynamic require to get fresh module (mocks applied)
  const { AuthProvider } = require('../../context/AuthContext');
  return render(
    <AuthProvider>
      <TestConsumer />
    </AuthProvider>
  );
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────
describe('AuthContext', () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach(k => delete mockStorage[k]);
    jest.clearAllMocks();
    mockGetInitialURL.mockResolvedValue(null);
    mockGetSubscriptionStatus.mockResolvedValue({ tier: 'free' });
    // Reset NODE_ENV to test (not development) so DEV_MODE is false
    process.env.EXPO_PUBLIC_DEV_MODE = 'false';
  });

  // ──────────────────────────────────────────────
  // Unauthenticated initial state
  // ──────────────────────────────────────────────
  describe('unauthenticated state', () => {
    it('starts with loading=true then settles to unauthenticated', async () => {
      mockGetCurrentUser.mockRejectedValue(new Error('No session'));
      const { getByTestId } = renderWithProvider();

      // Initially loading
      expect(getByTestId('loading').props.children).toBe('true');

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
      expect(getByTestId('user-name').props.children).toBe('no-user');
      expect(getByTestId('session-token').props.children).toBe('no-token');
    });

    it('shows isAuthenticated=false when no stored token', async () => {
      const { getByTestId } = renderWithProvider();

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
    });
  });

  // ──────────────────────────────────────────────
  // Token persistence — loading stored session
  // ──────────────────────────────────────────────
  describe('session restoration', () => {
    it('restores user session from stored token on mount', async () => {
      mockStorage['session_token'] = 'stored-token-123';
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const { getByTestId } = renderWithProvider();

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(mockGetCurrentUser).toHaveBeenCalledWith('stored-token-123');
      expect(getByTestId('authenticated').props.children).toBe('true');
      expect(getByTestId('user-name').props.children).toBe('Test User');
      expect(getByTestId('session-token').props.children).toBe('stored-token-123');
    });

    it('clears stored token when getCurrentUser fails (expired session)', async () => {
      mockStorage['session_token'] = 'expired-token';
      mockGetCurrentUser.mockRejectedValue(new Error('Token expired'));

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { getByTestId } = renderWithProvider();

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('session_token');
      expect(getByTestId('authenticated').props.children).toBe('false');
    });

    it('stores user_id in AsyncStorage after restoring session', async () => {
      mockStorage['session_token'] = 'stored-token-abc';
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { getByTestId } = renderWithProvider();

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('user_id', 'u-001');
    });
  });

  // ──────────────────────────────────────────────
  // logout
  // ──────────────────────────────────────────────
  describe('logout', () => {
    it('clears user and session token on logout', async () => {
      mockStorage['session_token'] = 'tok-xyz';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockApiLogout.mockResolvedValue(undefined);

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('true');
      });

      await act(async () => {
        getByTestId('logout').props.onPress();
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
      expect(getByTestId('user-name').props.children).toBe('no-user');
      expect(getByTestId('session-token').props.children).toBe('no-token');
    });

    it('removes session_token and user_id from AsyncStorage on logout', async () => {
      mockStorage['session_token'] = 'tok-xyz';
      mockStorage['user_id'] = 'u-001';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockApiLogout.mockResolvedValue(undefined);

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('true');
      });

      await act(async () => {
        getByTestId('logout').props.onPress();
      });

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('session_token');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('user_id');
    });

    it('still clears local state when API logout call fails', async () => {
      mockStorage['session_token'] = 'tok-xyz';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockApiLogout.mockRejectedValue(new Error('Network error'));

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('true');
      });

      await act(async () => {
        getByTestId('logout').props.onPress();
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
    });
  });

  // ──────────────────────────────────────────────
  // refreshUser
  // ──────────────────────────────────────────────
  describe('refreshUser', () => {
    it('updates user data when called with a valid session token', async () => {
      mockStorage['session_token'] = 'tok-refresh';
      mockGetCurrentUser
        .mockResolvedValueOnce(mockUser) // initial load
        .mockResolvedValueOnce({ ...mockUser, name: 'Updated User' }); // refresh

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('user-name').props.children).toBe('Test User');
      });

      await act(async () => {
        getByTestId('refresh-user').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('user-name').props.children).toBe('Updated User');
      });
    });

    it('does nothing when there is no session token', async () => {
      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      await act(async () => {
        getByTestId('refresh-user').props.onPress();
      });

      // getCurrentUser should not be called (no token)
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // refreshSubscription
  // ──────────────────────────────────────────────
  describe('refreshSubscription', () => {
    it('updates premiumTier when subscription status changes', async () => {
      mockStorage['session_token'] = 'tok-sub';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSubscriptionStatus.mockResolvedValue({ tier: 'premium' });

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('true');
      });

      await act(async () => {
        getByTestId('refresh-sub').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('premium-tier').props.children).toBe('premium');
      });
    });

    it('falls back to "free" when getSubscriptionStatus throws', async () => {
      mockStorage['session_token'] = 'tok-sub';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSubscriptionStatus.mockRejectedValue(new Error('Service unavailable'));

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('true');
      });

      await act(async () => {
        getByTestId('refresh-sub').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('premium-tier').props.children).toBe('free');
      });
    });

    it('does not call getSubscriptionStatus when user is null', async () => {
      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      await act(async () => {
        getByTestId('refresh-sub').props.onPress();
      });

      expect(mockGetSubscriptionStatus).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────
  // isPremium logic
  // ──────────────────────────────────────────────
  describe('isPremium', () => {
    it('is false when premiumTier is "free"', async () => {
      mockStorage['session_token'] = 'tok-free';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSubscriptionStatus.mockResolvedValue({ tier: 'free' });

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('is-premium').props.children).toBe('false');
    });

    it('is true when premiumTier is "premium"', async () => {
      mockStorage['session_token'] = 'tok-prem';
      mockGetCurrentUser.mockResolvedValue(mockUser);
      mockGetSubscriptionStatus.mockResolvedValue({ tier: 'premium' });

      const { getByTestId } = renderWithProvider();
      await waitFor(() => {
        expect(getByTestId('authenticated').props.children).toBe('true');
      });

      await act(async () => {
        getByTestId('refresh-sub').props.onPress();
      });

      await waitFor(() => {
        expect(getByTestId('is-premium').props.children).toBe('true');
      });
    });
  });

  // ──────────────────────────────────────────────
  // useAuth guard
  // ──────────────────────────────────────────────
  describe('useAuth', () => {
    it('throws when used outside AuthProvider', () => {
      const { useAuth } = require('../../context/AuthContext');
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
      expect(() => {
        render(
          <TestConsumer />  // No AuthProvider wrapper
        );
      }).toThrow('useAuth must be used within an AuthProvider');
      consoleError.mockRestore();
    });
  });

  // ──────────────────────────────────────────────
  // Deep link / session_id in URL (non-web)
  // ──────────────────────────────────────────────
  describe('processSessionId via initial URL', () => {
    it('exchanges session id from initial URL and sets user', async () => {
      mockGetInitialURL.mockResolvedValue('myapp://?session_id=sess-abc');
      mockExchangeSession.mockResolvedValue({
        ...mockUser,
        session_token: 'exchanged-token',
      });

      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const { getByTestId } = renderWithProvider();

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(mockExchangeSession).toHaveBeenCalledWith('sess-abc');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('session_token', 'exchanged-token');
      expect(getByTestId('authenticated').props.children).toBe('true');
    });

    it('handles exchangeSession failure gracefully', async () => {
      mockGetInitialURL.mockResolvedValue('myapp://?session_id=bad-sess');
      mockExchangeSession.mockRejectedValue(new Error('Invalid session'));

      const { getByTestId } = renderWithProvider();

      await waitFor(() => {
        expect(getByTestId('loading').props.children).toBe('false');
      });

      expect(getByTestId('authenticated').props.children).toBe('false');
    });
  });
});
