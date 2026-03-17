import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ErrorBoundary } from '../ErrorBoundary';
import { Text } from 'react-native';

// Suppress console.error for expected errors in tests
const originalError = console.error;
beforeAll(() => { console.error = jest.fn(); });
afterAll(() => { console.error = originalError; });

const ProblemChild = () => {
  throw new Error('Test error');
};

const GoodChild = () => <Text>All good</Text>;

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary><GoodChild /></ErrorBoundary>
    );
    expect(getByText('All good')).toBeTruthy();
  });

  it('renders fallback UI on error', () => {
    const { getByText } = render(
      <ErrorBoundary><ProblemChild /></ErrorBoundary>
    );
    expect(getByText('Algo correu mal')).toBeTruthy();
    expect(getByText('Test error')).toBeTruthy();
  });

  it('calls onError callback', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}><ProblemChild /></ErrorBoundary>
    );
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0].message).toBe('Test error');
  });

  it('renders custom fallback when provided', () => {
    const { getByText } = render(
      <ErrorBoundary fallback={<Text>Custom fallback</Text>}>
        <ProblemChild />
      </ErrorBoundary>
    );
    expect(getByText('Custom fallback')).toBeTruthy();
  });

  it('recovers after retry', () => {
    let shouldThrow = true;
    const MaybeThrow = () => {
      if (shouldThrow) throw new Error('boom');
      return <Text>Recovered</Text>;
    };

    const { getByText } = render(
      <ErrorBoundary><MaybeThrow /></ErrorBoundary>
    );
    expect(getByText('Algo correu mal')).toBeTruthy();

    shouldThrow = false;
    fireEvent.press(getByText('Tentar novamente'));
    expect(getByText('Recovered')).toBeTruthy();
  });
});
