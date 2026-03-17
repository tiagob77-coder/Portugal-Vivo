import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import PressableScale from '../PressableScale';

describe('PressableScale', () => {
  it('renders children', () => {
    const { getByText } = render(
      <PressableScale onPress={() => {}}>
        <Text>Click me</Text>
      </PressableScale>
    );
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress}>
        <Text>Button</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('Button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <PressableScale onPress={onPress} disabled>
        <Text>Disabled</Text>
      </PressableScale>
    );
    fireEvent.press(getByText('Disabled'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('applies custom style', () => {
    const { getByText } = render(
      <PressableScale onPress={() => {}} style={{ padding: 20 }}>
        <Text>Styled</Text>
      </PressableScale>
    );
    expect(getByText('Styled')).toBeTruthy();
  });
});
