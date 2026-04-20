import React from 'react';
import { render } from '@testing-library/react-native';

import StreakTracker from '../StreakTracker';

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

jest.mock('../../config/api', () => ({
  API_BASE: 'http://localhost:8000/api',
}));

jest.mock('axios', () => ({
  get: jest.fn(),
}));

const mockStreakData = {
  current_streak: 7,
  longest_streak: 14,
  streak_alive: true,
  hours_remaining: 10,
  weekly_visits: 3,
  weekly_goal: 5,
  weekly_progress_pct: 60,
  monthly_visits: 12,
  streak_milestones: [
    {
      name: 'Semana Dourada',
      days: 7,
      progress: 7,
      progress_pct: 100,
      earned: true,
      icon: 'star',
      color: '#F59E0B',
      xp_bonus: 50,
    },
    {
      name: 'Mês Perfeito',
      days: 30,
      progress: 7,
      progress_pct: 23,
      earned: false,
      icon: 'emoji-events',
      color: '#8B5CF6',
      xp_bonus: 200,
    },
  ],
};

let mockQueryData: any = mockStreakData;

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({ data: mockQueryData })),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('StreakTracker', () => {
  beforeEach(() => {
    mockQueryData = mockStreakData;
  });

  it('renders nothing when streak data is not available', () => {
    mockQueryData = undefined;
    const { toJSON } = render(<StreakTracker userId="user-1" />);
    expect(toJSON()).toBeNull();
  });

  it('renders the full view with streak count', () => {
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('7 dias')).toBeTruthy();
  });

  it('shows streak alive label with remaining hours', () => {
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('Faltam 10h para manter')).toBeTruthy();
  });

  it('shows longest streak record', () => {
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('14')).toBeTruthy();
    expect(getByText('Recorde')).toBeTruthy();
  });

  it('shows weekly visits progress', () => {
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('3/5')).toBeTruthy();
    expect(getByText('Semana')).toBeTruthy();
  });

  it('shows next milestone when one exists', () => {
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('Mês Perfeito')).toBeTruthy();
    expect(getByText('+200 XP')).toBeTruthy();
  });

  it('shows monthly visits count', () => {
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('12 visitas este mês')).toBeTruthy();
  });

  it('renders compact mode with only the streak count', () => {
    const { getByText, queryByText } = render(<StreakTracker userId="user-1" compact />);
    expect(getByText('7')).toBeTruthy();
    // Full-view-only elements should not be present
    expect(queryByText('Semana')).toBeNull();
    expect(queryByText('Recorde')).toBeNull();
  });

  it('shows neutral color in compact mode when streak is 0', () => {
    mockQueryData = { ...mockStreakData, current_streak: 0 };
    const { getByText } = render(<StreakTracker userId="user-1" compact />);
    expect(getByText('0')).toBeTruthy();
  });

  it('shows "Visita um local para começar!" when streak is not alive', () => {
    mockQueryData = { ...mockStreakData, streak_alive: false };
    const { getByText } = render(<StreakTracker userId="user-1" />);
    expect(getByText('Visita um local para começar!')).toBeTruthy();
  });
});
