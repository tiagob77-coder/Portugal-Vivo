/**
 * ThemeContext - Light/Dark mode support for Portugal Vivo
 *
 * Colors are sourced from theme/colors.ts (single source of truth).
 */
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import {
  lightColors as lightSemanticColors,
  darkColors as darkSemanticColors,
} from '../theme/colors';
import type { SemanticColors } from '../theme/colors';

export type ThemeMode = 'light' | 'dark' | 'system';

// Re-export SemanticColors as ThemeColors for backward compat
export type ThemeColors = SemanticColors;

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: SemanticColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  isDark: false,
  colors: lightSemanticColors,
  setMode: () => {},
  toggleTheme: () => {},
});

const THEME_STORAGE_KEY = '@portugal_vivo_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const colors = useMemo(
    () => (isDark ? darkSemanticColors : lightSemanticColors),
    [isDark],
  );

  const toggleTheme = () => {
    setMode(isDark ? 'light' : 'dark');
  };

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
