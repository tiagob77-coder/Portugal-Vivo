/**
 * Tests for usePremiumAccess and usePremiumFeatures hooks.
 *
 * Covers: unauthenticated fallback, loading state, data resolution,
 * per-feature access, upgradeNeeded flag, usePremiumFeatures bulk map.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── mocks ─────────────────────────────────────────────────────────────────────

let mockIsAuthenticated = false;
let mockIsPremium = false;

jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: mockIsAuthenticated,
    isPremium: mockIsPremium,
  }),
}));

jest.mock('../../services/api', () => ({
  default: { get: jest.fn() },
  __esModule: true,
}));

// ── imports after mocks ───────────────────────────────────────────────────────

import { usePremiumAccess, usePremiumFeatures, FeatureId } from '../usePremiumAccess';
import api from '../../services/api';

const mockGet = api.get as jest.Mock;

function makeApiResponse(features: Record<string, boolean>, tier = 'free') {
  return Promise.resolve({ data: { user_id: 'u1', tier, features } });
}

// ── test helpers ──────────────────────────────────────────────────────────────

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function AccessProbe({ feature }: { feature: FeatureId }) {
  const { hasAccess, loading, tier, upgradeNeeded } = usePremiumAccess(feature);
  return (
    <>
      <Text testID="has-access">{hasAccess ? 'yes' : 'no'}</Text>
      <Text testID="loading">{loading ? 'yes' : 'no'}</Text>
      <Text testID="tier">{tier}</Text>
      <Text testID="upgrade">{upgradeNeeded ? 'yes' : 'no'}</Text>
    </>
  );
}

function FeaturesProbe() {
  const { features, loading, tier } = usePremiumFeatures();
  return (
    <>
      <Text testID="tier">{tier}</Text>
      <Text testID="loading">{loading ? 'yes' : 'no'}</Text>
      <Text testID="ai">{features['ai_itinerary'] ? 'yes' : 'no'}</Text>
    </>
  );
}

function wrap(element: React.ReactElement) {
  const qc = makeClient();
  return render(
    <QueryClientProvider client={qc}>{element}</QueryClientProvider>
  );
}

beforeEach(() => {
  mockIsAuthenticated = false;
  mockIsPremium = false;
  mockGet.mockReset();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('usePremiumAccess', () => {
  it('returns hasAccess=false when unauthenticated (no API call)', () => {
    mockIsAuthenticated = false;
    const { getByTestId } = wrap(<AccessProbe feature="ai_itinerary" />);
    expect(getByTestId('has-access').props.children).toBe('no');
    expect(getByTestId('tier').props.children).toBe('free');
    expect(getByTestId('upgrade').props.children).toBe('yes');
    expect(getByTestId('loading').props.children).toBe('no');
    expect(mockGet).not.toHaveBeenCalled();
  });

  it('falls back to isPremium during loading when authenticated', async () => {
    mockIsAuthenticated = true;
    mockIsPremium = true;
    mockGet.mockImplementation(() => new Promise(() => {})); // never resolves
    const { getByTestId } = wrap(<AccessProbe feature="audio_guides" />);
    expect(getByTestId('loading').props.children).toBe('yes');
    expect(getByTestId('has-access').props.children).toBe('yes'); // optimistic from isPremium
  });

  it('returns hasAccess from feature map when data resolves', async () => {
    mockIsAuthenticated = true;
    mockGet.mockReturnValue(makeApiResponse({ ai_itinerary: true, audio_guides: false }, 'premium'));
    const { getByTestId } = wrap(<AccessProbe feature="ai_itinerary" />);
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('no'));
    expect(getByTestId('has-access').props.children).toBe('yes');
    expect(getByTestId('tier').props.children).toBe('premium');
    expect(getByTestId('upgrade').props.children).toBe('no');
  });

  it('returns hasAccess=false for unlicensed feature', async () => {
    mockIsAuthenticated = true;
    mockGet.mockReturnValue(makeApiResponse({ ai_itinerary: true, audio_guides: false }, 'premium'));
    const { getByTestId } = wrap(<AccessProbe feature="audio_guides" />);
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('no'));
    expect(getByTestId('has-access').props.children).toBe('no');
    expect(getByTestId('upgrade').props.children).toBe('yes');
  });

  it('upgradeNeeded=false when feature is granted', async () => {
    mockIsAuthenticated = true;
    mockGet.mockReturnValue(makeApiResponse({ offline: true }, 'premium_annual'));
    const { getByTestId } = wrap(<AccessProbe feature="offline" />);
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('no'));
    expect(getByTestId('upgrade').props.children).toBe('no');
  });
});

describe('usePremiumFeatures', () => {
  it('returns empty features and free tier when unauthenticated', () => {
    mockIsAuthenticated = false;
    const { getByTestId } = wrap(<FeaturesProbe />);
    expect(getByTestId('ai').props.children).toBe('no');
    expect(getByTestId('tier').props.children).toBe('free');
  });

  it('returns full feature map when authenticated', async () => {
    mockIsAuthenticated = true;
    mockGet.mockReturnValue(makeApiResponse({ ai_itinerary: true }, 'premium'));
    const { getByTestId } = wrap(<FeaturesProbe />);
    await waitFor(() => expect(getByTestId('loading').props.children).toBe('no'));
    expect(getByTestId('ai').props.children).toBe('yes');
    expect(getByTestId('tier').props.children).toBe('premium');
  });
});
