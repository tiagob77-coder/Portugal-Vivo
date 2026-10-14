/**
 * Settings — Aparência
 *
 * Controla:
 *   • Tema: claro / escuro / automático
 *   • Luz de Portugal (película de luz natural por período do dia)
 *   • Visão de cores (daltonismo)
 *   • Pack visual por região
 */
import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useTheme, COLOR_VISION_LABELS, REGION_ACCENT_NAMES } from '../../src/context/ThemeContext';
import type { ColorVisionMode, ThemeMode } from '../../src/context/ThemeContext';
import { shadows } from '../../src/theme';
import { ScreenHeader } from '../../src/components/ui';
import { LUZ_OPTIONS, luzNow, luzDefinition } from '../../src/theme/luz';
import type { LuzMode, LuzPeriod } from '../../src/theme/luz';

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
  const {
    colors, isDark, mode, setMode, colorVision, setColorVision,
    regionAccent, setRegionAccent, luz, luzActive, setLuz,
  } = useTheme();
  const { t } = useTranslation();

  // Texto de apoio da Luz de Portugal (equivalente traduzido de luzHint)
  const luzLabel = (id: LuzMode) => t(`account.appearance.luz.${id}`);
  const luzHintText = (() => {
    if (luz === 'off') return t('account.appearance.luzHintOff');
    if (luz === 'auto') return t('account.appearance.luzHintAuto', { period: luzLabel(luzNow()).toLowerCase() });
    return t('account.appearance.luzHintFixed', { period: luzLabel(luzDefinition(luz as LuzPeriod).id).toLowerCase() });
  })();

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
      <ScreenHeader title={t('account.appearance.title')} onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Tema ──────────────────────────────────────────────────────────── */}
        <Section title={t('account.appearance.theme')} />
        <View style={s.group}>
          {([
            { id: 'light', label: t('account.appearance.themeLight'), icon: 'light-mode', sub: t('account.appearance.themeLightSub') },
            { id: 'dark',  label: t('account.appearance.themeDark'), icon: 'dark-mode', sub: t('account.appearance.themeDarkSub') },
            { id: 'system', label: t('account.appearance.themeSystem'), icon: 'brightness-auto', sub: t('account.appearance.themeSystemSub') },
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

        {/* ── Luz de Portugal ───────────────────────────────────────────────── */}
        <Section title={t('account.appearance.luzTitle')} />
        <Text style={[s.hint, { color: colors.textMuted }]}>
          {luzHintText}
        </Text>
        <View style={s.luzChips}>
          {LUZ_OPTIONS.map(opt => {
            const on = luz === opt.id;
            // A amostra usa a cor central do gradiente do período
            const swatch = opt.id === 'auto' || opt.id === 'off'
              ? null
              : luzDefinition(opt.id as LuzPeriod).colors[1];
            return (
              <TouchableOpacity
                key={opt.id}
                style={[s.luzChip, {
                  backgroundColor: on ? colors.accent : colors.surface,
                  borderColor: on ? colors.accent : colors.border,
                }]}
                onPress={() => setLuz(opt.id)}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('account.appearance.luzA11y', { option: luzLabel(opt.id) })}
              >
                {swatch
                  ? <View style={[s.luzSwatch, { backgroundColor: swatch }]} />
                  : <MaterialIcons name={opt.icon as never} size={15} color={on ? '#FFF' : colors.textSecondary} />}
                <Text style={[s.luzChipText, { color: on ? '#FFF' : colors.textSecondary }]}>
                  {luzLabel(opt.id)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {luzActive !== 'off' && (
          <Text style={[s.hint, { color: colors.textMuted, marginTop: 8 }]}>
            {t('account.appearance.luzFollows')}
          </Text>
        )}

        {/* ── Visão de cores ────────────────────────────────────────────────── */}
        <Section title={t('account.appearance.colorVisionTitle')} />
        <Text style={[s.hint, { color: colors.textMuted }]}>
          {t('account.appearance.colorVisionHint')}
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
                    {t(`account.appearance.colorVision.${cv}`)}
                  </Text>
                  {cv !== 'normal' && (
                    <Text style={[s.rowSublabel, { color: colors.textMuted }]}>
                      {t('account.appearance.adaptedPalette')}
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
        <Section title={t('account.appearance.regionPackTitle')} />
        <Text style={[s.hint, { color: colors.textMuted }]}>
          {t('account.appearance.regionPackHint')}
        </Text>
        <View style={s.group}>
          <OptionRow
            label={t('account.appearance.regionNone')}
            sublabel={t('account.appearance.regionNoneSub')}
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

  luzChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginHorizontal: 16 },
  luzChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 13,
    borderRadius: 16, borderWidth: 1,
  },
  luzChipText: { fontSize: 12, fontWeight: '600' },
  luzSwatch: { width: 14, height: 14, borderRadius: 7 },
});
