import React from 'react';
import { render, act } from '@testing-library/react-native';

import BadgeCelebration from '../BadgeCelebration';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme/colors', () => ({
  palette: {
    terracotta: { 500: '#C96A42' },
    gray: { 50: '#F8FAFC' },
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BadgeCelebration', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders nothing when visible is false', () => {
    const { toJSON } = render(
      <BadgeCelebration
        visible={false}
        badgeName="Explorer"
        badgeIcon="explore"
        badgeColor="#22C55E"
        pointsEarned={100}
        onDone={jest.fn()}
      />
    );
    expect(toJSON()).toBeNull();
  });

  it('renders badge name and title when visible', () => {
    const { getByText } = render(
      <BadgeCelebration
        visible
        badgeName="Explorer"
        badgeIcon="explore"
        badgeColor="#22C55E"
        pointsEarned={100}
        onDone={jest.fn()}
      />
    );
    expect(getByText('Badge Desbloqueado!')).toBeTruthy();
    expect(getByText('Explorer')).toBeTruthy();
  });

  it('shows points earned when pointsEarned > 0', () => {
    const { getByText } = render(
      <BadgeCelebration
        visible
        badgeName="Historian"
        badgeIcon="history"
        badgeColor="#8B5CF6"
        pointsEarned={250}
        onDone={jest.fn()}
      />
    );
    expect(getByText('+250 pontos')).toBeTruthy();
  });

  it('does not show points row when pointsEarned is 0', () => {
    const { queryByText } = render(
      <BadgeCelebration
        visible
        badgeName="Starter"
        badgeIcon="star"
        badgeColor="#EF4444"
        pointsEarned={0}
        onDone={jest.fn()}
      />
    );
    expect(queryByText(/pontos/)).toBeNull();
  });

  it('calls onDone after the celebration timeout', () => {
    const onDone = jest.fn();
    render(
      <BadgeCelebration
        visible
        badgeName="Explorer"
        badgeIcon="explore"
        badgeColor="#22C55E"
        pointsEarned={50}
        onDone={onDone}
      />
    );

    act(() => {
      jest.advanceTimersByTime(2400);
    });

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('renders a Modal when visible is true', () => {
    const { UNSAFE_getAllByType } = render(
      <BadgeCelebration
        visible
        badgeName="Achiever"
        badgeIcon="emoji-events"
        badgeColor="#F59E0B"
        pointsEarned={75}
        onDone={jest.fn()}
      />
    );
    const { Modal } = require('react-native');
    expect(UNSAFE_getAllByType(Modal).length).toBeGreaterThan(0);
  });
});
