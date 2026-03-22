import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

import AnimatedListItem from '../AnimatedListItem';

describe('AnimatedListItem', () => {
  it('renders children without crashing', () => {
    const { getByText } = render(
      <AnimatedListItem index={0}>
        <Text>Hello</Text>
      </AnimatedListItem>
    );
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders with different index values', () => {
    const { getByText } = render(
      <AnimatedListItem index={5}>
        <Text>Item 5</Text>
      </AnimatedListItem>
    );
    expect(getByText('Item 5')).toBeTruthy();
  });

  it('renders with custom stagger prop', () => {
    const { getByText } = render(
      <AnimatedListItem index={2} stagger={100}>
        <Text>Stagger item</Text>
      </AnimatedListItem>
    );
    expect(getByText('Stagger item')).toBeTruthy();
  });

  it('renders with custom style prop', () => {
    const { getByText } = render(
      <AnimatedListItem index={0} style={{ marginBottom: 8 }}>
        <Text>Styled item</Text>
      </AnimatedListItem>
    );
    expect(getByText('Styled item')).toBeTruthy();
  });

  it('renders multiple children correctly', () => {
    const { getByText } = render(
      <AnimatedListItem index={1}>
        <Text>First</Text>
        <Text>Second</Text>
      </AnimatedListItem>
    );
    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
  });

  it('renders at index 0 without stagger delay issues', () => {
    const { toJSON } = render(
      <AnimatedListItem index={0} stagger={50}>
        <Text>Zero index</Text>
      </AnimatedListItem>
    );
    expect(toJSON()).toBeTruthy();
  });
});
