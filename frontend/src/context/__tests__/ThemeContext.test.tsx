// @ts-nocheck
/**
 * Tests for ThemeContext / ThemeProvider
 * Covers: default theme, setMode, toggleTheme, persistence to AsyncStorage,
 *         system preference detection, persisted mode restoration on mount,
 *         useTheme hook behaviour.
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react-native';
import { Text, useColorScheme } from 'react-native';

// ─── In-memory AsyncStorage mock ─────────────────────────────────────────────
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

// ─── useColorScheme mock — default to 'light' ────────────────────────────────
let mockColorScheme: 'light' | 'dark' | null = 'light';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  RN.Platform.OS = 'ios';
  RN.useColorScheme = jest.fn(() => mockColorScheme);
  return RN;
});

// ─────────────────────────────────────────────────────────────────────────────
// Consumer helper
// ─────────────────────────────────────────────────────────────────────────────

function TestConsumer() {
  const { useTheme } = require('../ThemeContext');
  const { mode, isDark, colors, setMode, toggleTheme } = useTheme();
  return (
    <>
      <Text testID="mode">{mode}</Text>
      <Text testID="is-dark">{String(isDark)}</Text>
      <Text testID="primary">{colors.primary}</Text>
      <Text testID="set-light" onPress={() => setMode('light')}>SetLight</Text>
      <Text testID="set-dark" onPress={() => setMode('dark')}>SetDark</Text>
      <Text testID="set-system" onPress={() => setMode('system')}>SetSystem</Text>
      <Text testID="toggle" onPress={() => toggleTheme()}>Toggle</Text>
    </>
  );
}

function renderWithProvider() {
  const { ThemeProvider } = require('../ThemeContext');
  return render(
    <ThemeProvider>
      <TestConsumer />
    </ThemeProvider>,
  );
}

// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  jest.clearAllMocks();
  mockColorScheme = 'light';
  // Restore the mock implementation after clearAllMocks resets it.
  // useColorScheme is the jest.fn created in the factory above.
  (useColorScheme as jest.Mock).mockImplementation(() => mockColorScheme);
});

// ─────────────────────────────────────────────────────────────────────────────
// Default theme state
// ─────────────────────────────────────────────────────────────────────────────

describe('default theme state', () => {
  it('defaults to mode="light"', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => {
      expect(getByTestId('mode').props.children).toBe('light');
    });
  });

  it('defaults to isDark=false', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => {
      expect(getByTestId('is-dark').props.children).toBe('false');
    });
  });

  it('provides lightColors by default', async () => {
    const { lightColors } = require('../../theme/colors');
    const { getByTestId } = renderWithProvider();
    await waitFor(() => {
      expect(getByTestId('primary').props.children).toBe(lightColors.primary);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setMode
// ─────────────────────────────────────────────────────────────────────────────

describe('setMode', () => {
  it('switches to dark mode when setMode("dark") is called', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => {
      getByTestId('set-dark').props.onPress();
    });

    expect(getByTestId('mode').props.children).toBe('dark');
    expect(getByTestId('is-dark').props.children).toBe('true');
  });

  it('provides darkColors after switching to dark', async () => {
    const { darkColors } = require('../../theme/colors');
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => {
      getByTestId('set-dark').props.onPress();
    });

    expect(getByTestId('primary').props.children).toBe(darkColors.primary);
  });

  it('switches back to light when setMode("light") is called', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => { getByTestId('set-dark').props.onPress(); });
    await act(async () => { getByTestId('set-light').props.onPress(); });

    expect(getByTestId('mode').props.children).toBe('light');
    expect(getByTestId('is-dark').props.children).toBe('false');
  });

  it('sets mode="system" when setMode("system") is called', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => {
      getByTestId('set-system').props.onPress();
    });

    expect(getByTestId('mode').props.children).toBe('system');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// toggleTheme
// ─────────────────────────────────────────────────────────────────────────────

describe('toggleTheme', () => {
  it('toggles from light to dark', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => { getByTestId('toggle').props.onPress(); });

    expect(getByTestId('mode').props.children).toBe('dark');
    expect(getByTestId('is-dark').props.children).toBe('true');
  });

  it('toggles from dark back to light', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => { getByTestId('set-dark').props.onPress(); });
    await act(async () => { getByTestId('toggle').props.onPress(); });

    expect(getByTestId('mode').props.children).toBe('light');
    expect(getByTestId('is-dark').props.children).toBe('false');
  });

  it('toggles from system+dark to light', async () => {
    mockColorScheme = 'dark';
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = renderWithProvider();

    // Set to system mode — system says dark, so isDark should be true
    await act(async () => { getByTestId('set-system').props.onPress(); });
    await waitFor(() => expect(getByTestId('is-dark').props.children).toBe('true'));

    // Toggle should switch from dark (isDark=true) to light
    await act(async () => { getByTestId('toggle').props.onPress(); });
    expect(getByTestId('mode').props.children).toBe('light');
    expect(getByTestId('is-dark').props.children).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AsyncStorage persistence
// ─────────────────────────────────────────────────────────────────────────────

describe('AsyncStorage persistence', () => {
  it('saves mode to AsyncStorage when setMode is called', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => { getByTestId('set-dark').props.onPress(); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@portugal_vivo_theme', 'dark');
  });

  it('saves "light" to AsyncStorage when setMode("light") is called', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => { getByTestId('set-light').props.onPress(); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@portugal_vivo_theme', 'light');
  });

  it('saves "system" to AsyncStorage when setMode("system") is called', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const { getByTestId } = renderWithProvider();
    await waitFor(() => expect(getByTestId('mode').props.children).toBe('light'));

    await act(async () => { getByTestId('set-system').props.onPress(); });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('@portugal_vivo_theme', 'system');
  });

  it('reads persisted "dark" mode from AsyncStorage on mount', async () => {
    mockStorage['@portugal_vivo_theme'] = 'dark';

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('mode').props.children).toBe('dark');
    });
    expect(getByTestId('is-dark').props.children).toBe('true');
  });

  it('reads persisted "system" mode from AsyncStorage on mount', async () => {
    mockStorage['@portugal_vivo_theme'] = 'system';

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      expect(getByTestId('mode').props.children).toBe('system');
    });
  });

  it('ignores invalid values in AsyncStorage and stays on default light', async () => {
    mockStorage['@portugal_vivo_theme'] = 'invalid-value';

    const { getByTestId } = renderWithProvider();

    await waitFor(() => {
      // After the effect resolves with an invalid value, mode stays as 'light'
      expect(getByTestId('mode').props.children).toBe('light');
    });
  });

  it('does not throw when AsyncStorage.getItem returns null', async () => {
    // No key in storage → getItem returns null
    const { getByTestId } = renderWithProvider();
    await waitFor(() => {
      expect(getByTestId('mode').props.children).toBe('light');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// system color scheme detection
// ─────────────────────────────────────────────────────────────────────────────

describe('system color scheme', () => {
  it('isDark=false when mode=system and system scheme is light', async () => {
    mockColorScheme = 'light';
    (useColorScheme as jest.Mock).mockReturnValue('light');
    const { getByTestId } = renderWithProvider();

    await act(async () => { getByTestId('set-system').props.onPress(); });

    expect(getByTestId('is-dark').props.children).toBe('false');
  });

  it('isDark=true when mode=system and system scheme is dark', async () => {
    mockColorScheme = 'dark';
    (useColorScheme as jest.Mock).mockReturnValue('dark');
    const { getByTestId } = renderWithProvider();

    await act(async () => { getByTestId('set-system').props.onPress(); });

    expect(getByTestId('is-dark').props.children).toBe('true');
  });

  it('isDark=false when mode=system and system scheme is null', async () => {
    mockColorScheme = null;
    (useColorScheme as jest.Mock).mockReturnValue(null);
    const { getByTestId } = renderWithProvider();

    await act(async () => { getByTestId('set-system').props.onPress(); });

    expect(getByTestId('is-dark').props.children).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useTheme hook — can be used inside a provider without error
// ─────────────────────────────────────────────────────────────────────────────

describe('useTheme', () => {
  it('returns context values when used inside ThemeProvider', async () => {
    const { getByTestId } = renderWithProvider();
    await waitFor(() => {
      expect(getByTestId('mode').props.children).toBeDefined();
    });
  });

  it('returns default context values (light) when used outside ThemeProvider', () => {
    // useTheme uses useContext — if no provider, it falls back to the default context value
    const { useTheme, ThemeProvider } = require('../ThemeContext');
    const { lightColors } = require('../../theme/colors');

    // Render without ThemeProvider — context returns default values
    function Bare() {
      const ctx = useTheme();
      return <Text testID="bare-mode">{ctx.mode}</Text>;
    }

    const { getByTestId } = render(<Bare />);
    // Default context is { mode: 'light', ... }
    expect(getByTestId('bare-mode').props.children).toBe('light');
  });
});
