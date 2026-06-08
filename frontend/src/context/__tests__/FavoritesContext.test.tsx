/**
 * Tests for FavoritesContext / FavoritesProvider
 *
 * Covers: initial load from AsyncStorage, add/remove/toggle/clear,
 * persistence on every mutation, isLoaded flag, event bus emission.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Text, TouchableOpacity } from 'react-native';

// ── mocks ─────────────────────────────────────────────────────────────────────
// NOTE: jest.mock factories are hoisted — do not reference outer let/const here.

const mockStorage: Record<string, string> = {};

jest.mock('@react-native-async-storage/async-storage', () => {
  const store: Record<string, string> = {};
  return {
    __esModule: true,
    default: {
      getItem: jest.fn((key: string) => Promise.resolve(store[key] ?? null)),
      setItem: jest.fn((key: string, value: string) => {
        store[key] = value;
        return Promise.resolve();
      }),
    },
    _store: store,
  };
});

jest.mock('../../services/eventBus', () => ({
  eventBus: { emit: jest.fn() },
}));

jest.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn() },
}));

// ── imports (after mocks) ─────────────────────────────────────────────────────
import { FavoritesProvider, useFavorites } from '../FavoritesContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@portugal_vivo_favorites';

function TestConsumer({ id }: { id: string }) {
  const {
    isFavorite, toggleFavorite, addFavorite, removeFavorite,
    clearAllFavorites, favoritesCount, isLoaded,
  } = useFavorites();
  return (
    <>
      <Text testID="count">{favoritesCount}</Text>
      <Text testID="loaded">{isLoaded ? 'yes' : 'no'}</Text>
      <Text testID="is-fav">{isFavorite(id) ? 'yes' : 'no'}</Text>
      <TouchableOpacity testID="toggle" onPress={() => toggleFavorite(id)} />
      <TouchableOpacity testID="add" onPress={() => addFavorite(id)} />
      <TouchableOpacity testID="remove" onPress={() => removeFavorite(id)} />
      <TouchableOpacity testID="clear" onPress={() => clearAllFavorites()} />
    </>
  );
}

function wrap(id = 'poi-1') {
  return render(
    <FavoritesProvider>
      <TestConsumer id={id} />
    </FavoritesProvider>
  );
}

function getAsyncStorageStore() {
  // Access the internal store exposed by the mock
  return (require('@react-native-async-storage/async-storage') as any)._store as Record<string, string>;
}

beforeEach(() => {
  const store = getAsyncStorageStore();
  for (const k of Object.keys(store)) delete store[k];
  (AsyncStorage.getItem as jest.Mock).mockClear();
  (AsyncStorage.setItem as jest.Mock).mockClear();
  const { eventBus } = require('../../services/eventBus');
  (eventBus.emit as jest.Mock).mockClear();
});

// ── tests ─────────────────────────────────────────────────────────────────────

describe('FavoritesContext', () => {
  it('sets isLoaded=true after AsyncStorage read', async () => {
    const { getByTestId } = wrap();
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
  });

  it('starts with empty favorites when storage is empty', async () => {
    const { getByTestId } = wrap();
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    expect(getByTestId('count').props.children).toBe(0);
  });

  it('loads persisted favorites from AsyncStorage on mount', async () => {
    const store = getAsyncStorageStore();
    store[STORAGE_KEY] = JSON.stringify(['poi-1', 'poi-2']);
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce((key: string) =>
      Promise.resolve(store[key] ?? null)
    );
    const { getByTestId } = wrap('poi-1');
    await waitFor(() => expect(getByTestId('count').props.children).toBe(2));
    expect(getByTestId('is-fav').props.children).toBe('yes');
  });

  it('toggleFavorite adds a new item', async () => {
    const { getByTestId } = wrap('poi-1');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(getByTestId('is-fav').props.children).toBe('yes'));
    expect(getByTestId('count').props.children).toBe(1);
  });

  it('toggleFavorite removes an existing item', async () => {
    const { getByTestId } = wrap('poi-1');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('toggle')); // add
    await waitFor(() => expect(getByTestId('is-fav').props.children).toBe('yes'));
    fireEvent.press(getByTestId('toggle')); // remove
    await waitFor(() => expect(getByTestId('is-fav').props.children).toBe('no'));
    expect(getByTestId('count').props.children).toBe(0);
  });

  it('toggleFavorite emits favorite.toggled event', async () => {
    const { getByTestId } = wrap('poi-42');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('toggle'));
    const { eventBus } = require('../../services/eventBus');
    await waitFor(() =>
      expect(eventBus.emit).toHaveBeenCalledWith('favorite.toggled', { id: 'poi-42', added: true })
    );
  });

  it('addFavorite is idempotent', async () => {
    const { getByTestId } = wrap('poi-1');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('add'));
    fireEvent.press(getByTestId('add'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe(1));
  });

  it('removeFavorite removes item from list', async () => {
    const { getByTestId } = wrap('poi-1');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('add'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe(1));
    fireEvent.press(getByTestId('remove'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe(0));
  });

  it('clearAllFavorites resets to empty', async () => {
    const { getByTestId } = wrap('poi-1');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('add'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe(1));
    fireEvent.press(getByTestId('clear'));
    await waitFor(() => expect(getByTestId('count').props.children).toBe(0));
  });

  it('persists to AsyncStorage on mutation', async () => {
    const { getByTestId } = wrap('poi-5');
    await waitFor(() => expect(getByTestId('loaded').props.children).toBe('yes'));
    fireEvent.press(getByTestId('add'));
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalled());
    const calls = (AsyncStorage.setItem as jest.Mock).mock.calls;
    const lastArg = calls[calls.length - 1][1];
    expect(JSON.parse(lastArg)).toContain('poi-5');
  });
});
