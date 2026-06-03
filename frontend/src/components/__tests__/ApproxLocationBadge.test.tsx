import React from 'react';
import { render } from '@testing-library/react-native';

import ApproxLocationBadge, { shouldShowApprox } from '../ApproxLocationBadge';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));
jest.mock('../../theme', () => ({
  palette: {
    terracotta: {
      50: '#FBF5EF',
      100: '#F7EBDF',
      700: '#8C6A44',
    },
  },
}));

// ── shouldShowApprox (pure) ─────────────────────────────────────────────────

describe('shouldShowApprox', () => {
  it('hides for precise precision', () => {
    expect(shouldShowApprox('precise')).toBe(false);
  });

  it('hides when approximate is explicitly false even if precision is centroid', () => {
    // Explicit override wins — caller has reason to trust the row.
    expect(shouldShowApprox('region', false)).toBe(false);
  });

  it('shows for municipality, district, region', () => {
    expect(shouldShowApprox('municipality')).toBe(true);
    expect(shouldShowApprox('district')).toBe(true);
    expect(shouldShowApprox('region')).toBe(true);
  });

  it('shows when approximate=true even without precision', () => {
    expect(shouldShowApprox(undefined, true)).toBe(true);
    expect(shouldShowApprox(null, true)).toBe(true);
  });

  it('hides when both are missing (legacy POI from before GEO-004)', () => {
    expect(shouldShowApprox()).toBe(false);
    expect(shouldShowApprox(undefined, undefined)).toBe(false);
  });

  it('hides for unknown precision strings without explicit approximate flag', () => {
    expect(shouldShowApprox('xpto')).toBe(false);
  });
});

// ── Component render ────────────────────────────────────────────────────────

describe('ApproxLocationBadge', () => {
  it('renders nothing for precise rows', () => {
    const { queryByTestId } = render(<ApproxLocationBadge precision="precise" />);
    expect(queryByTestId('approx-location-badge')).toBeNull();
  });

  it('renders nothing when no signal at all', () => {
    const { queryByTestId } = render(<ApproxLocationBadge />);
    expect(queryByTestId('approx-location-badge')).toBeNull();
  });

  it('renders the municipality label in full mode', () => {
    const { getByText } = render(<ApproxLocationBadge precision="municipality" />);
    expect(getByText(/concelho/i)).toBeTruthy();
  });

  it('renders the district label', () => {
    const { getByText } = render(<ApproxLocationBadge precision="district" />);
    expect(getByText(/distrito/i)).toBeTruthy();
  });

  it('renders the region label', () => {
    const { getByText } = render(<ApproxLocationBadge precision="region" />);
    expect(getByText(/região/i)).toBeTruthy();
  });

  it('renders compact form when compact prop is set', () => {
    const { getByText } = render(<ApproxLocationBadge precision="region" compact />);
    // Compact label is shorter: "aprox. região" vs "localização aprox. (região)".
    const node = getByText(/aprox\. região/i);
    expect(node).toBeTruthy();
  });

  it('honours approximate=true with no precision (fallback wording)', () => {
    const { getByTestId } = render(<ApproxLocationBadge approximate={true} />);
    expect(getByTestId('approx-location-badge')).toBeTruthy();
  });

  it('honours approximate=false to suppress (override)', () => {
    const { queryByTestId } = render(
      <ApproxLocationBadge precision="region" approximate={false} />,
    );
    expect(queryByTestId('approx-location-badge')).toBeNull();
  });

  it('exposes an accessibility label for screen readers', () => {
    const { getByTestId } = render(<ApproxLocationBadge precision="municipality" />);
    const badge = getByTestId('approx-location-badge');
    expect(badge.props.accessibilityLabel).toMatch(/concelho/i);
  });
});
