import React from 'react';
import { render } from '@testing-library/react-native';
import PatternBackground from '../PatternBackground';
import { palette } from '../../theme';

jest.mock('expo-image', () => ({ Image: 'Image' }));

describe('PatternBackground', () => {
  it('renders the default azulejo texture without crashing', () => {
    const { toJSON } = render(<PatternBackground />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders the calcada variant with custom colour and opacity', () => {
    const { toJSON } = render(
      <PatternBackground pattern="calcada" color={palette.ocean[500]} opacity={0.1} />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
