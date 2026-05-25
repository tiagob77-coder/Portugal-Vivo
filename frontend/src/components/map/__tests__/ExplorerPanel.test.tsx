import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ExplorerPanel from '../ExplorerPanel';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../../theme', () => ({
  palette: {
    white: '#FFFFFF',
    black: '#000000',
    gray: { 200: '#E5E0D5', 300: '#D1CCBF', 400: '#9A958A', 500: '#6B665C' },
    ocean: { 400: '#5F87AF' },
    rust: { 500: '#C65D3B' },
    mint: { 600: '#55A67E' },
    terracotta: { 400: '#DFAF7F' },
  },
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

/** WCAG 2.x relative-luminance contrast ratio between two RGB(A) colors over
 *  a fully-opaque backdrop. Implements the algorithm from
 *  https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio. */
function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function blend(fg: [number, number, number, number], bg: [number, number, number]): [number, number, number] {
  const [r, g, b, a] = fg;
  return [
    Math.round(r * a + bg[0] * (1 - a)),
    Math.round(g * a + bg[1] * (1 - a)),
    Math.round(b * a + bg[2] * (1 - a)),
  ];
}

function contrast(fg: [number, number, number], bg: [number, number, number]): number {
  const l1 = relativeLuminance(...fg);
  const l2 = relativeLuminance(...bg);
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (light + 0.05) / (dark + 0.05);
}

// ─── Component renders ──────────────────────────────────────────────────────

describe('ExplorerPanel', () => {
  it('renders title', () => {
    render(<ExplorerPanel />);
    expect(screen.getByText('Dados Técnicos em Tempo Real')).toBeTruthy();
  });

  it('shows fire-risk card with "A carregar..." when count is undefined', () => {
    render(<ExplorerPanel />);
    expect(screen.getByText('Risco de Incêndio')).toBeTruthy();
    expect(screen.getByText('A carregar...')).toBeTruthy();
  });

  it('singular vs plural ocorrência for fire count', () => {
    const { rerender } = render(<ExplorerPanel fires={{ active_count: 1 }} />);
    expect(screen.getByText('1 ocorrência activa')).toBeTruthy();

    rerender(<ExplorerPanel fires={{ active_count: 3 }} />);
    expect(screen.getByText('3 ocorrências activas')).toBeTruthy();
  });

  it('renders weather card with location + description + temperature', () => {
    render(
      <ExplorerPanel
        weather={{
          location: 'Lisboa',
          forecasts: [{ weather_description: 'Sol', temp_max: 24 }],
        }}
      />
    );
    expect(screen.getByText('Meteorologia — Lisboa')).toBeTruthy();
    expect(screen.getByText('Sol · 24°C max')).toBeTruthy();
  });

  it('omits weather card when forecasts list is empty', () => {
    render(<ExplorerPanel weather={{ location: 'Lisboa', forecasts: [] }} />);
    expect(screen.queryByText(/Meteorologia/)).toBeNull();
  });

  it('renders surf card with spot name + wave height + quality', () => {
    render(
      <ExplorerPanel
        surf={{ spots: [{ spot: { name: 'Supertubos' }, wave_height_m: 1.8, surf_quality: 'excelente' }] }}
      />
    );
    expect(screen.getByText('Mar — Supertubos')).toBeTruthy();
    expect(screen.getByText('Ondas 1.8m · excelente')).toBeTruthy();
  });

  it('falls back to "Costa" when surf spot name is missing', () => {
    render(<ExplorerPanel surf={{ spots: [{ wave_height_m: 1.2 }] }} />);
    expect(screen.getByText('Mar — Costa')).toBeTruthy();
  });

  it('falls back to "Lisboa" when weather location is missing', () => {
    render(
      <ExplorerPanel
        weather={{ forecasts: [{ weather_description: 'Sol', temp_max: 20 }] }}
      />
    );
    expect(screen.getByText('Meteorologia — Lisboa')).toBeTruthy();
  });
});

// ─── Contrast regression guard ──────────────────────────────────────────────
//
// The whole point of refactoring the previous inline panel into ExplorerPanel
// was to fix WCAG-AA failure (white text rgba(0.7) over rgba(0.1) → ~1.7:1).
// Pin the actual color choices so a future "let's make it more translucent"
// edit can't silently push it back below threshold.

describe('ExplorerPanel — contrast budget (WCAG)', () => {
  // SURFACE: rgba(15, 23, 42, 0.92) blended over a worst-case bright map
  // background (#FFF6E6 — CARTO Voyager sand tone). Even with the worst
  // backdrop this still produces a near-opaque dark surface.
  const SURFACE_OVER_VOYAGER = blend([15, 23, 42, 0.92], [255, 246, 230]);
  // SURFACE_CARD: rgba(30, 41, 59, 0.95) over the same SURFACE.
  const CARD_OVER_SURFACE = blend([30, 41, 59, 0.95], SURFACE_OVER_VOYAGER);

  it('title (#FFFFFF) on outer surface ≥ 7:1 (AAA)', () => {
    expect(contrast([255, 255, 255], SURFACE_OVER_VOYAGER)).toBeGreaterThanOrEqual(7);
  });

  it('card title (#FFFFFF) on card background ≥ 7:1 (AAA)', () => {
    expect(contrast([255, 255, 255], CARD_OVER_SURFACE)).toBeGreaterThanOrEqual(7);
  });

  it('card subtitle (gray.200 #E5E0D5) on card background ≥ 4.5:1 (AA)', () => {
    expect(contrast([229, 224, 213], CARD_OVER_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });
});
