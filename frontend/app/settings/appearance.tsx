/**
 * Settings — Aparência
 *
 * Controla:
 *   • Tema: claro / escuro / automático
 *   • Visão de cores (daltonismo)
 *   • Pack visual por região
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, COLOR_VISION_LABELS, REGION_ACCENT_NAMES } from '../../src/context/ThemeContext';
import type { ColorVisionMode, ThemeMode } from '../../src/context/ThemeContext';
import { shadows } from '../../src/theme';

const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

// ─── Cores de preview para daltonismo ────────────────────────────────────────

const CV_PREVIEW: Record<ColorVisionMode, { success: string; error: string; accent: string }> = {
  normal:       { success: '#22C55E', error: '#EF4444', accent: '#C49A6C' },
  deuteranopia: { success: '#0EA5E9', error: '#F97316', accent: '#0EA5E9' },
  protanopia:   { success: '#0EA5E9', error: '#F97316', accent: '#2563EB' },
  tritanopia:   { success: '#EC4899', error: '#DC2626', accent: '#EC4899' },
};

// ─── Componente ───────────────────────────────────────────────────────────────

export default function AppearanceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark, mode, setMode, colorVision, setColorVision, regionAccent, setRegionAccent } = useTheme();

  const Section = ({ title }: { title: string }) => (
    <Text style={[s.sectionTitle, { color: colors.textMuted }]}>{title.toUpperCase()}</Text>
  );

  const OptionRow = ({
    label, sublabel, selected, onPress, color,
  }: { label: string; sublabel?: string; selected: boolean; onPress: () => void; color?: string }) => (
    <TouchableOpacity
      style={[s.row, { backgroundColor: colors.surface, borderColor: selected ? (color || colors.accent) : 'transparent' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sublabel && <Text style={[s.rowSublabel, { color: colors.textMuted }]}>{sublabel}</Text>}
      </View>
      {selected && <MaterialIcons name="check-circle" size={20} color={color || colors.accent} />}
    </TouchableOpacity>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>Aparência</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Tema ──────────────────────────────────────────────────────────── */}
        <Section title="Tema" />
        <View style={s.group}>
          {([
            { id: 'light', label: 'Claro', icon: 'light-mode', sub: 'Fundo branco' },
            { id: 'dark',  label: 'Escuro', icon: 'dark-mode', sub: 'Fundo escuro' },
            { id: 'system', label: 'Automático', icon: 'brightness-auto', sub: 'Segue o sistema' },
          ] as { id: ThemeMode; label: string; icon: string; sub: string }[]).map(opt => (
            <OptionRow
              key={opt.id}
              label={opt.label}
              sublabel={opt.sub}
              selected={mode === opt.id}
              onPress={() => setMode(opt.id)}
            />
          ))}
        </View>

        {/* ── Visão de cores ────────────────────────────────────────────────── */}
        <Section title="Modo de visão de cores" />
        <Text style={[s.hint, { color: colors.textMuted }]}>
          Adapta as cores da interface para diferentes tipos de visão.
        </Text>
        <View style={s.group}>
          {(Object.keys(COLOR_VISION_LABELS) as ColorVisionMode[]).map(cv => {
            const preview = CV_PREVIEW[cv];
            return (
              <TouchableOpacity
                key={cv}
                style={[s.row, { backgroundColor: colors.surface, borderColor: colorVision === cv ? preview.accent : 'transparent' }]}
                onPress={() => setColorVision(cv)}
                activeOpacity={0.75}
              >
                {/* Preview de cores */}
                <View style={s.cvPreview}>
                  <View style={[s.cvDot, { backgroundColor: preview.success }]} />
                  <View style={[s.cvDot, { backgroundColor: preview.error }]} />
                  <View style={[s.cvDot, { backgroundColor: preview.accent }]} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: colors.textPrimary }]}>
                    {COLOR_VISION_LABELS[cv]}
                  </Text>
                  {cv !== 'normal' && (
                    <Text style={[s.rowSublabel, { color: colors.textMuted }]}>
                      Paleta adaptada para maior contraste
                    </Text>
                  )}
                </View>
                {colorVision === cv && (
                  <MaterialIcons name="check-circle" size={20} color={preview.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Pack visual por região ────────────────────────────────────────── */}
        <Section title="Pack visual por região" />
        <Text style={[s.hint, { color: colors.textMuted }]}>
          Personaliza as cores de destaque com a paleta da região activa.
        </Text>
        <View style={s.group}>
          <OptionRow
            label="Nenhum (padrão)"
            sublabel="Paleta Portugal Vivo"
            selected={!regionAccent}
            onPress={() => setRegionAccent(null)}
          />
          {Object.entries(REGION_ACCENT_NAMES).map(([region, name]) => (
            <OptionRow
              key={region}
              label={name}
              selected={regionAccent === region}
              onPress={() => setRegionAccent(region)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 20, fontWeight: '800', fontFamily: serif },

  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 6 },
  hint: { fontSize: 12, marginHorizontal: 16, marginBottom: 8, lineHeight: 18 },
  group: { marginHorizontal: 16, gap: 6 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 12, borderWidth: 1.5, ...shadows.sm,
  },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowSublabel: { fontSize: 12, marginTop: 1 },

  cvPreview: { flexDirection: 'row', gap: 4 },
  cvDot: { width: 14, height: 14, borderRadius: 7 },
});
