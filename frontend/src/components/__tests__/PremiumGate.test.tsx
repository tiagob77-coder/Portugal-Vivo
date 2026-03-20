import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';

// Mock dependencies
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children, ...props }: any) => {
    const { View } = require('react-native');
    return <View {...props}>{children}</View>;
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
}));

let mockIsPremium = false;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isPremium: mockIsPremium }),
}));
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFF',
      textPrimary: '#000',
      textSecondary: '#333',
      textMuted: '#666',
      borderLight: '#EEE',
      background: '#FFF',
    },
  }),
}));
jest.mock('../../theme', () => ({
  shadows: { sm: {}, md: {}, xl: {} },
  palette: {
    terracotta: {
      400: '#DFAF7F',
      500: '#C49A6C',
    },
  },
  withOpacity: (_hex: string, opacity: number) => `rgba(0,0,0,${opacity})`,
}));

import PremiumGate from '../PremiumGate';

describe('PremiumGate', () => {
  beforeEach(() => {
    mockIsPremium = false;
    mockPush.mockClear();
  });

  it('renders children when user is premium', () => {
    mockIsPremium = true;
    const { getByText } = render(
      <PremiumGate feature="ai_itinerary">
        <Text>Premium Content</Text>
      </PremiumGate>
    );
    expect(getByText('Premium Content')).toBeTruthy();
  });

  it('shows preview and unlock badge when user is not premium', () => {
    const { getByText } = render(
      <PremiumGate feature="ai_itinerary">
        <Text>Premium Content</Text>
      </PremiumGate>
    );
    // Soft gate: children are visible as a clipped preview
    expect(getByText('Premium Content')).toBeTruthy();
    // Feature title shown in the unlock badge
    expect(getByText('Roteiros IA')).toBeTruthy();
    // Unlock CTA button label
    expect(getByText('Desbloquear')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    const { getByText, queryByText } = render(
      <PremiumGate feature="ai_itinerary" fallback={<Text>Custom Lock</Text>}>
        <Text>Premium Content</Text>
      </PremiumGate>
    );
    expect(getByText('Custom Lock')).toBeTruthy();
    expect(queryByText('Premium Content')).toBeNull();
  });

  it('opens paywall sheet and navigates to premium on CTA press', () => {
    const { getByText } = render(
      <PremiumGate feature="audio_guides">
        <Text>Content</Text>
      </PremiumGate>
    );
    // Press unlock badge to open the paywall sheet
    fireEvent.press(getByText('Desbloquear'));
    // Press the sheet CTA to navigate
    fireEvent.press(getByText('Experimentar Descobridor'));
    expect(mockPush).toHaveBeenCalledWith('/premium');
  });

  it('renders inline gate variant', () => {
    const { getByText } = render(
      <PremiumGate feature="offline" inline>
        <Text>Content</Text>
      </PremiumGate>
    );
    expect(getByText(/Modo Offline/)).toBeTruthy();
    expect(getByText('Premium')).toBeTruthy();
  });

  it('shows generic label for unknown feature', () => {
    const { getByText } = render(
      <PremiumGate feature="unknown_feature">
        <Text>Content</Text>
      </PremiumGate>
    );
    expect(getByText('Funcionalidade Premium')).toBeTruthy();
  });
});
