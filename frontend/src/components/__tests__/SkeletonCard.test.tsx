import React from 'react';
import { render } from '@testing-library/react-native';
import SkeletonCard from '../SkeletonCard';

describe('SkeletonCard', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<SkeletonCard />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders default count of 3 skeleton items', () => {
    const { toJSON } = render(<SkeletonCard />);
    const tree = toJSON() as any;
    // The root View contains `count` children (default 3)
    expect(tree.children).toHaveLength(3);
  });

  it('renders the specified number of skeleton items', () => {
    const { toJSON } = render(<SkeletonCard count={5} />);
    const tree = toJSON() as any;
    expect(tree.children).toHaveLength(5);
  });

  it('renders with count of 1', () => {
    const { toJSON } = render(<SkeletonCard count={1} />);
    const tree = toJSON() as any;
    expect(tree.children).toHaveLength(1);
  });

  it('renders discovery variant without crashing', () => {
    const { toJSON } = render(<SkeletonCard variant="discovery" count={2} />);
    const tree = toJSON() as any;
    expect(tree).toBeTruthy();
    expect(tree.children).toHaveLength(2);
  });

  it('renders category variant without crashing', () => {
    const { toJSON } = render(<SkeletonCard variant="category" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders compact variant without crashing', () => {
    const { toJSON } = render(<SkeletonCard variant="compact" />);
    expect(toJSON()).toBeTruthy();
  });
});
