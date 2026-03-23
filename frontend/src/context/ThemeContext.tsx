/**
 * ThemeContext — Light/Dark + Daltonismo + Packs visuais por Região
 *
 * Três camadas de personalização:
 *   1. mode:        light | dark | system
 *   2. colorVision: normal | deuteranopia | protanopia | tritanopia
 *   3. regionAccent: sobreescreve a cor de accent com a paleta da região activa
 */
import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';
import {
  lightColors as lightSemanticColors,
  darkColors as darkSemanticColors,
} from '../theme/colors';
import type { SemanticColors } from '../theme/colors';

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorVisionMode = 'normal' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type ThemeColors = SemanticColors;

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: SemanticColors;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  // Daltonismo
  colorVision: ColorVisionMode;
  setColorVision: (mode: ColorVisionMode) => void;
  // Tema regional
  regionAccent: string | null;
  setRegionAccent: (region: string | null) => void;
}

// ─── Overrides de daltonismo ──────────────────────────────────────────────────
// Substituem cores problemáticas por alternativas universalmente distinguíveis

const DALTONISM_OVERRIDES: Record<ColorVisionMode, Partial<SemanticColors>> = {
  normal: {},

  // Deuteranopia (vermelho-verde) — usa azul/laranja
  deuteranopia: {
    success: '#0EA5E9',   // azul em vez de verde
    error:   '#F97316',   // laranja em vez de vermelho
    accent:  '#0EA5E9',   // azul
    warning: '#A855F7',   // púrpura em vez de amarelo
  },

  // Protanopia (sem cones vermelhos) — similar a deuteranopia
  protanopia: {
    success: '#0EA5E9',
    error:   '#F97316',
    accent:  '#2563EB',
    warning: '#A855F7',
  },

  // Tritanopia (azul-amarelo) — usa magenta/carmesim
  tritanopia: {
    success: '#EC4899',   // magenta em vez de verde
    error:   '#DC2626',   // manter vermelho (distinguível)
    accent:  '#EC4899',
    warning: '#EF4444',
  },
};

// ─── Accents regionais ────────────────────────────────────────────────────────

const REGION_ACCENTS: Record<string, string> = {
  norte:    '#3B7A57',   // verde floresta escuro
  centro:   '#8B5A2B',   // castanho terracota
  lisboa:   '#1F4E79',   // azul marinha
  alentejo: '#C49A6C',   // ocre quente (default)
  algarve:  '#0891B2',   // ciano oceano
  acores:   '#0F766E',   // verde azulado profundo
  madeira:  '#166534',   // verde exuberante
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  isDark: false,
  colors: lightSemanticColors,
  setMode: () => {},
  toggleTheme: () => {},
  colorVision: 'normal',
  setColorVision: () => {},
  regionAccent: null,
  setRegionAccent: () => {},
});

const THEME_KEY         = '@portugal_vivo_theme';
const COLOR_VISION_KEY  = '@portugal_vivo_color_vision';
const REGION_ACCENT_KEY = '@portugal_vivo_region_accent';

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [colorVision, setColorVisionState] = useState<ColorVisionMode>('normal');
  const [regionAccent, setRegionAccentState] = useState<string | null>(null);

  // Carregar preferências persistidas
  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(THEME_KEY),
      AsyncStorage.getItem(COLOR_VISION_KEY),
      AsyncStorage.getItem(REGION_ACCENT_KEY),
    ]).then(([theme, cv, region]) => {
      if (theme === 'light' || theme === 'dark' || theme === 'system') setModeState(theme);
      if (cv === 'normal' || cv === 'deuteranopia' || cv === 'protanopia' || cv === 'tritanopia') {
        setColorVisionState(cv as ColorVisionMode);
      }
      if (region && REGION_ACCENTS[region]) setRegionAccentState(region);
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const setColorVision = (cv: ColorVisionMode) => {
    setColorVisionState(cv);
    AsyncStorage.setItem(COLOR_VISION_KEY, cv);
  };

  const setRegionAccent = (region: string | null) => {
    setRegionAccentState(region);
    if (region) AsyncStorage.setItem(REGION_ACCENT_KEY, region);
    else AsyncStorage.removeItem(REGION_ACCENT_KEY);
  };

  const isDark = mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const colors = useMemo<SemanticColors>(() => {
    const base = isDark ? darkSemanticColors : lightSemanticColors;

    // 1. Aplicar overrides de daltonismo
    const daltonismOverrides = DALTONISM_OVERRIDES[colorVision] ?? {};

    // 2. Aplicar accent regional (sobreescreve accent do daltonismo se normal)
    const regionOverride: Partial<SemanticColors> = {};
    if (regionAccent && REGION_ACCENTS[regionAccent]) {
      // Só aplicar região se não há daltonismo activo (para não conflituar)
      if (colorVision === 'normal') {
        regionOverride.accent = REGION_ACCENTS[regionAccent];
        regionOverride.primary = REGION_ACCENTS[regionAccent];
      }
    }

    return { ...base, ...daltonismOverrides, ...regionOverride };
  }, [isDark, colorVision, regionAccent]);

  const toggleTheme = () => setMode(isDark ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{
      mode, isDark, colors, setMode, toggleTheme,
      colorVision, setColorVision,
      regionAccent, setRegionAccent,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

// Helper: nome legível do modo de visão
export const COLOR_VISION_LABELS: Record<ColorVisionMode, string> = {
  normal:       'Normal',
  deuteranopia: 'Deuteranopia (vermelho-verde)',
  protanopia:   'Protanopia (sem vermelho)',
  tritanopia:   'Tritanopia (azul-amarelo)',
};

// Helper: nome legível da região
export const REGION_ACCENT_NAMES: Record<string, string> = {
  norte:    'Norte',
  centro:   'Centro',
  lisboa:   'Lisboa',
  alentejo: 'Alentejo',
  algarve:  'Algarve',
  acores:   'Açores',
  madeira:  'Madeira',
};
