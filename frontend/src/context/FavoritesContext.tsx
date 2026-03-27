/**
 * FavoritesContext — Offline favorites with AsyncStorage
 * Stores favorite POI IDs locally, syncs with UI across the app.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@portugal_vivo_favorites';

interface FavoritesContextType {
  favorites: string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  addFavorite: (id: string) => void;
  removeFavorite: (id: string) => void;
  clearAllFavorites: () => void;
  favoritesCount: number;
  isLoaded: boolean;
}

const FavoritesContext = createContext<FavoritesContextType>({
  favorites: [],
  isFavorite: () => false,
  toggleFavorite: () => {},
  addFavorite: () => {},
  removeFavorite: () => {},
  clearAllFavorites: () => {},
  favoritesCount: 0,
  isLoaded: false,
});

export const useFavorites = () => useContext(FavoritesContext);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load favorites from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            setFavorites(parsed);
          }
        }
      } catch (e) {
        console.warn('Failed to load favorites:', e);
      } finally {
        setIsLoaded(true);
      }
    })();
  }, []);

  // Persist to AsyncStorage whenever favorites change
  const persist = useCallback(async (newFavs: string[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newFavs));
    } catch (e) {
      console.warn('Failed to save favorites:', e);
    }
  }, []);

  const isFavorite = useCallback((id: string) => {
    return favorites.includes(id);
  }, [favorites]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id)
        ? prev.filter(f => f !== id)
        : [...prev, id];
      persist(next);
      return next;
    });
  }, [persist]);

  const addFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persist(next);
      return next;
    });
  }, [persist]);

  const removeFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.filter(f => f !== id);
      persist(next);
      return next;
    });
  }, [persist]);

  const clearAllFavorites = useCallback(() => {
    setFavorites([]);
    persist([]);
  }, [persist]);

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        isFavorite,
        toggleFavorite,
        addFavorite,
        removeFavorite,
        clearAllFavorites,
        favoritesCount: favorites.length,
        isLoaded,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}
