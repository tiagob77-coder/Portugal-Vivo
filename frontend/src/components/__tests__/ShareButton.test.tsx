import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import { ShareButton } from '../ShareButton';

describe('ShareButton', () => {
  const origPlatform = Platform.OS;
  afterEach(() => { Platform.OS = origPlatform; });

  it('renders without crashing', () => {
    const tree = render(
      <ShareButton title="Test" description="A description" />
    );
    expect(tree.toJSON()).toBeTruthy();
  });

  it('calls Share.share on native platform', async () => {
    Platform.OS = 'ios' as any;
    const shareSpy = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

    const { toJSON } = render(
      <ShareButton title="Test Title" description="Test Description" />
    );

    // Get the root element which is the TouchableOpacity
    const root = toJSON();
    expect(root).toBeTruthy();

    // Use UNSAFE_root to find the pressable
    const { UNSAFE_getAllByType } = render(
      <ShareButton title="Test Title" description="Test Description" />
    );
    const touchables = UNSAFE_getAllByType(require('react-native').TouchableOpacity);

    await act(async () => {
      fireEvent.press(touchables[0]);
    });

    expect(shareSpy).toHaveBeenCalledWith({
      title: 'Test Title',
      message: 'Test Description',
    });

    shareSpy.mockRestore();
  });
});
