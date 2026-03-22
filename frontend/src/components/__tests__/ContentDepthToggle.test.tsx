import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import ContentDepthToggle, { DepthLevel } from '../ContentDepthToggle';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../theme', () => ({
  useTheme: () => ({
    colors: {
      card: '#1E293B',
      surface: '#1E293B',
      primary: '#4A6741',
      text: '#F8FAFC',
      textSecondary: '#94A3B8',
    },
  }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ContentDepthToggle', () => {
  const onDepthChange = jest.fn();

  beforeEach(() => {
    onDepthChange.mockClear();
  });

  it('renders without crashing with default snackable depth', () => {
    const { getByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} />
    );
    expect(getByText('Snack')).toBeTruthy();
    expect(getByText('História')).toBeTruthy();
    expect(getByText('Enciclopédia')).toBeTruthy();
  });

  it('renders the section label in full mode', () => {
    const { getByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} />
    );
    expect(getByText('Profundidade do conteúdo')).toBeTruthy();
  });

  it('calls onDepthChange when a different depth tab is pressed', () => {
    const { getAllByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} />
    );
    fireEvent.press(getAllByText('História')[0]);
    expect(onDepthChange).toHaveBeenCalledWith('historia');
  });

  it('does not call onDepthChange when the active tab is pressed again', () => {
    const { getAllByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} />
    );
    fireEvent.press(getAllByText('Snack')[0]);
    expect(onDepthChange).not.toHaveBeenCalled();
  });

  it('does not call onDepthChange when loading is true', () => {
    const { getAllByText } = render(
      <ContentDepthToggle
        activeDepth="snackable"
        onDepthChange={onDepthChange}
        loading
      />
    );
    fireEvent.press(getAllByText('História')[0]);
    expect(onDepthChange).not.toHaveBeenCalled();
  });

  it('shows loading hint text when loading prop is true', () => {
    const { getByText } = render(
      <ContentDepthToggle activeDepth="historia" onDepthChange={onDepthChange} loading />
    );
    expect(getByText('A gerar conteúdo…')).toBeTruthy();
  });

  it('renders compact variant without section label', () => {
    const { queryByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} compact />
    );
    expect(queryByText('Profundidade do conteúdo')).toBeNull();
  });

  it('renders compact variant with tab labels', () => {
    const { getByText } = render(
      <ContentDepthToggle activeDepth="historia" onDepthChange={onDepthChange} compact />
    );
    expect(getByText('Snack')).toBeTruthy();
    expect(getByText('História')).toBeTruthy();
    expect(getByText('Enciclopédia')).toBeTruthy();
  });

  it('calls onDepthChange from compact variant', () => {
    const { getAllByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} compact />
    );
    fireEvent.press(getAllByText('Enciclopédia')[0]);
    expect(onDepthChange).toHaveBeenCalledWith('enciclopedico');
  });

  it('renders all three depth options with sublabels', () => {
    const { getByText } = render(
      <ContentDepthToggle activeDepth="snackable" onDepthChange={onDepthChange} />
    );
    expect(getByText('30–60s')).toBeTruthy();
    expect(getByText('3–5 min')).toBeTruthy();
    expect(getByText('7–12 min')).toBeTruthy();
  });
});
