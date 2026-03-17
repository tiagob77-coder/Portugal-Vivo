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

let mockIsPremium = false;
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ isPremium: mockIsPremium }),
}));
jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      surface: '#FFF',
      textPrimary: '#000',
      textMuted: '#666',
      borderLight: '#EEE',
      background: '#FFF',
    },
  }),
}));
jest.mock('../../theme', () => ({ shadows: { md: {} } }));

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

  it('renders gate when user is not premium', () => {
    const { getByText, queryByText } = render(
      <PremiumGate feature="ai_itinerary">
        <Text>Premium Content</Text>
      </PremiumGate>
    );
    expect(queryByText('Premium Content')).toBeNull();
    expect(getByText('Roteiros IA')).toBeTruthy();
    expect(getByText('Desbloquear com Premium')).toBeTruthy();
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

  it('navigates to premium page on CTA press', () => {
    const { getByText } = render(
      <PremiumGate feature="audio_guides">
        <Text>Content</Text>
      </PremiumGate>
    );
    fireEvent.press(getByText('Desbloquear com Premium'));
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
