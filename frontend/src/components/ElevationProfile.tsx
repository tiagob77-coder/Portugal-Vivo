/**
 * ElevationProfile — Perfil de Elevação de Trilho
 *
 * Web: SVG interativo com área preenchida por gradiente.
 * Native: Estatísticas de elevação formatadas.
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export interface ElevationPoint {
  distance_km: number;
  elevation: number;
  lat?: number;
  lng?: number;
}

interface Props {
  data: ElevationPoint[];
  color?: string;
  trailName?: string;
}

const CHART_H = 130;
const PAD = { top: 16, bottom: 28, left: 44, right: 12 };

function stats(data: ElevationPoint[]) {
  if (!data.length) return { minE: 0, maxE: 0, maxD: 1, gain: 0, loss: 0 };
  const elevs = data.map(p => p.elevation);
  const minE = Math.min(...elevs);
  const maxE = Math.max(...elevs);
  const maxD = data[data.length - 1].distance_km || 1;
  let gain = 0, loss = 0;
  for (let i = 1; i < data.length; i++) {
    const d = data[i].elevation - data[i - 1].elevation;
    if (d > 0) gain += d; else loss += Math.abs(d);
  }
  return { minE, maxE, maxD, gain: Math.round(gain), loss: Math.round(loss) };
}

function buildPath(data: ElevationPoint[], w: number, s: ReturnType<typeof stats>): string {
  const cW = w - PAD.left - PAD.right;
  const cH = CHART_H - PAD.top - PAD.bottom;
  const eRange = s.maxE - s.minE || 1;
  const sx = (d: number) => PAD.left + (d / s.maxD) * cW;
  const sy = (e: number) => PAD.top + cH - ((e - s.minE) / eRange) * cH;
  const bottom = PAD.top + cH;
  const pts = data.map(p => `${sx(p.distance_km).toFixed(1)},${sy(p.elevation).toFixed(1)}`).join(' L ');
  const x0 = sx(0).toFixed(1);
  const xN = sx(data[data.length - 1].distance_km).toFixed(1);
  return `M ${x0},${bottom} L ${x0},${sy(data[0].elevation).toFixed(1)} L ${pts} L ${xN},${bottom} Z`;
}

function buildLine(data: ElevationPoint[], w: number, s: ReturnType<typeof stats>): string {
  const cW = w - PAD.left - PAD.right;
  const cH = CHART_H - PAD.top - PAD.bottom;
  const eRange = s.maxE - s.minE || 1;
  const sx = (d: number) => PAD.left + (d / s.maxD) * cW;
  const sy = (e: number) => PAD.top + cH - ((e - s.minE) / eRange) * cH;
  return data.map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.distance_km).toFixed(1)},${sy(p.elevation).toFixed(1)}`).join(' ');
}

export default function ElevationProfile({ data, color = '#22C55E', trailName }: Props) {
  const [width, setWidth] = useState(320);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const s = stats(data);

  // ─── Native: simplified stats ────────────────────────────────────────────────
  if (Platform.OS !== 'web') {
    return (
      <View style={st.container} onLayout={onLayout}>
        {trailName && <Text style={st.label}>Perfil de Elevação</Text>}
        <View style={st.statsRow}>
          <View style={st.stat}>
            <MaterialIcons name="arrow-upward" size={16} color="#22C55E" />
            <Text style={st.statVal}>+{s.gain}m</Text>
            <Text style={st.statLbl}>Subida</Text>
          </View>
          <View style={st.stat}>
            <MaterialIcons name="arrow-downward" size={16} color="#EF4444" />
            <Text style={st.statVal}>-{s.loss}m</Text>
            <Text style={st.statLbl}>Descida</Text>
          </View>
          <View style={st.stat}>
            <MaterialIcons name="terrain" size={16} color="#C49A6C" />
            <Text style={st.statVal}>{s.maxE}m</Text>
            <Text style={st.statLbl}>Máx.</Text>
          </View>
          <View style={st.stat}>
            <MaterialIcons name="height" size={16} color="#6366F1" />
            <Text style={st.statVal}>{s.minE}m</Text>
            <Text style={st.statLbl}>Mín.</Text>
          </View>
        </View>
      </View>
    );
  }

  // ─── Web: SVG chart ──────────────────────────────────────────────────────────
  if (!data.length || width < 50) {
    return <View style={[st.container, { height: CHART_H + 32 }]} onLayout={onLayout} />;
  }

  const gradId = 'elev-grad';
  const fillPath = buildPath(data, width, s);
  const linePath = buildLine(data, width, s);
  const cH = CHART_H - PAD.top - PAD.bottom;
  const cW = width - PAD.left - PAD.right;
  const eRange = s.maxE - s.minE || 1;
  const sx = (d: number) => PAD.left + (d / s.maxD) * cW;
  const sy = (e: number) => PAD.top + cH - ((e - s.minE) / eRange) * cH;

  // Y-axis grid labels (3 lines)
  const ySteps = [0, 0.5, 1].map(t => ({
    y: sy(s.minE + t * (s.maxE - s.minE)),
    label: Math.round(s.minE + t * (s.maxE - s.minE)) + 'm',
  }));
  // X-axis distance labels
  const xSteps = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    x: sx(t * s.maxD),
    label: (t * s.maxD).toFixed(1) + 'km',
  }));

  // SVG rendered as web element (works in React Native Web)
  const svgEl = {
    __html: `
<svg width="${width}" height="${CHART_H + 28}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <!-- Grid lines -->
  ${ySteps.map(({ y, label }) => `
    <line x1="${PAD.left}" y1="${y.toFixed(1)}" x2="${PAD.left + cW}" y2="${y.toFixed(1)}" stroke="#E5E7EB" stroke-width="1" stroke-dasharray="3,3"/>
    <text x="${PAD.left - 4}" y="${(y + 4).toFixed(1)}" font-size="9" fill="#9CA3AF" text-anchor="end">${label}</text>
  `).join('')}
  <!-- Fill area -->
  <path d="${fillPath}" fill="url(#${gradId})"/>
  <!-- Line -->
  <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  <!-- Distance labels -->
  ${xSteps.map(({ x, label }) => `
    <text x="${x.toFixed(1)}" y="${(PAD.top + cH + 18).toFixed(1)}" font-size="9" fill="#9CA3AF" text-anchor="middle">${label}</text>
  `).join('')}
  <!-- Start/end elevation dots -->
  <circle cx="${PAD.left}" cy="${sy(data[0].elevation).toFixed(1)}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
  <circle cx="${(PAD.left + cW).toFixed(1)}" cy="${sy(data[data.length - 1].elevation).toFixed(1)}" r="3" fill="${color}" stroke="white" stroke-width="1.5"/>
</svg>`,
  };

  return (
    <View style={st.container} onLayout={onLayout}>
      {/* Gain/loss badges */}
      <View style={st.badgesRow}>
        <View style={st.badge}>
          <MaterialIcons name="arrow-upward" size={11} color="#22C55E" />
          <Text style={[st.badgeTxt, { color: '#22C55E' }]}>+{s.gain}m</Text>
        </View>
        <View style={[st.badge, { backgroundColor: '#FEF2F2' }]}>
          <MaterialIcons name="arrow-downward" size={11} color="#EF4444" />
          <Text style={[st.badgeTxt, { color: '#EF4444' }]}>-{s.loss}m</Text>
        </View>
        <View style={[st.badge, { backgroundColor: '#FDF4E7' }]}>
          <MaterialIcons name="terrain" size={11} color="#C49A6C" />
          <Text style={[st.badgeTxt, { color: '#C49A6C' }]}>{s.maxE}m</Text>
        </View>
      </View>
      {/* SVG (web only, using dangerouslySetInnerHTML via div) */}
      {typeof document !== 'undefined' && (
        <div dangerouslySetInnerHTML={svgEl} style={{ lineHeight: 0 }} />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  container: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 10, marginTop: 4 },
  label: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 8 },
  badgesRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F0FDF4', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8 },
  badgeTxt: { fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontSize: 14, fontWeight: '800', color: '#111827' },
  statLbl: { fontSize: 10, color: '#9CA3AF', fontWeight: '500' },
});
