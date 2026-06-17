import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import ScreenHeader from '../ScreenHeader';

jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }));

jest.mock('../../../theme', () => ({
  useTheme: () => ({ colors: { textPrimary: 'rgb(28,31,28)', textMuted: 'rgb(107,102,92)' } }),
  fontFamilies: { serif: 'serif', sans: 'System' },
}));

jest.mock('../../../theme/spacing', () => ({
  HIT_SLOP: { top: 8, bottom: 8, left: 8, right: 8 },
}));

describe('ScreenHeader', () => {
  it('renders the title', () => {
    render(<ScreenHeader title="Saúde Editorial" />);
    expect(screen.getByText('Saúde Editorial')).toBeTruthy();
  });

  it('renders the subtitle when provided', () => {
    render(<ScreenHeader title="Analytics" subtitle="Métricas de engagement" />);
    expect(screen.getByText('Métricas de engagement')).toBeTruthy();
  });

  it('shows a back button and calls onBack when pressed', () => {
    const onBack = jest.fn();
    render(<ScreenHeader title="X" onBack={onBack} />);
    fireEvent.press(screen.getByLabelText('Voltar'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('does not render a back button when onBack is omitted', () => {
    render(<ScreenHeader title="X" />);
    expect(screen.queryByLabelText('Voltar')).toBeNull();
  });
});
