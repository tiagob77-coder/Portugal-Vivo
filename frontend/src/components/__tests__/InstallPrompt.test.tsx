import React from 'react';
import { render } from '@testing-library/react-native';
import { Platform } from 'react-native';

import InstallPrompt from '../InstallPrompt';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme/colors', () => ({
  palette: {
    gray: { 50: '#F8FAFC', 800: '#1E293B' },
    white: '#FFFFFF',
    terracotta: { 500: '#C96A42' },
    forest: { 500: '#4A6741' },
  },
}));

// AsyncStorage is mocked globally in jest.setup.js

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('InstallPrompt', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders nothing on native platforms (iOS/Android)', () => {
    // Platform.OS is 'ios' by default in jest-expo
    const { toJSON } = render(<InstallPrompt />);
    // showPrompt starts as false → returns null
    expect(toJSON()).toBeNull();
  });

  it('renders nothing initially on web when no beforeinstallprompt event fires', () => {
    const originalOS = Platform.OS;
    const originalMatchMedia = (window as any).matchMedia;
    // @ts-ignore
    Platform.OS = 'web';
    // matchMedia and addEventListener are not available in jsdom — provide stubs
    (window as any).matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
    (window as any).addEventListener = jest.fn();
    (window as any).removeEventListener = jest.fn();
    try {
      const { toJSON } = render(<InstallPrompt />);
      expect(toJSON()).toBeNull();
    } finally {
      // @ts-ignore
      Platform.OS = originalOS;
      (window as any).matchMedia = originalMatchMedia;
    }
  });

  it('renders without crashing on repeated renders', () => {
    const { rerender, toJSON } = render(<InstallPrompt />);
    rerender(<InstallPrompt />);
    expect(toJSON()).toBeNull();
  });
});
