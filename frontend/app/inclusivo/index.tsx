/**
 * Turismo Inclusivo — Portugal para todos
 *
 * Acessibilidade tratada como informação verificável: praias com apoio balnear,
 * percursos em plataforma contínua, alojamento pet-friendly e rotas familiares,
 * com leitura própria por região.
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { getModuleTheme, withOpacity, onColor } from '../../src/theme/colors';
import ModuleHighlights from '../../src/components/module/ModuleHighlights';
import ModuleGuideCta from '../../src/components/module/ModuleGuideCta';
import ModuleHistory from '../../src/components/module/ModuleHistory';
import ModuleLinks from '../../src/components/module/ModuleLinks';

const MT = getModuleTheme('inclusivo');
const C = {
  bg: MT.bg,
  card: MT.card,
  accent: MT.accent,
  accentMuted: MT.accentMuted,
  textDark: MT.textPrimary,
  textMed: MT.textSecondary,
  textLight: MT.textMuted,
  border: withOpacity(MT.textPrimary, 0.12),
  onAccent: onColor(MT.accent),
};

const REGIONS: { id: string; labelKey: string }[] = [
  { id: 'norte', labelKey: 'modulesRoutes.inclusivo.regions.norte' },
  { id: 'centro', labelKey: 'modulesRoutes.inclusivo.regions.centro' },
  { id: 'lisboa', labelKey: 'modulesRoutes.inclusivo.regions.lisboa' },
  { id: 'alentejo', labelKey: 'modulesRoutes.inclusivo.regions.alentejo' },
  { id: 'algarve', labelKey: 'modulesRoutes.inclusivo.regions.algarve' },
  { id: 'acores', labelKey: 'modulesRoutes.inclusivo.regions.acores' },
  { id: 'madeira', labelKey: 'modulesRoutes.inclusivo.regions.madeira' },
];

/**
 * Leituras de acessibilidade por região — 3 por região. Os textos vivem em
 * `modulesRoutes.inclusivo.reads.<região>.<id>.{title,desc}` (i18n).
 */
const REGIONAL_READS: Record<string, string[]> = {
  norte: ['r1', 'r2', 'r3'],
  centro: ['r1', 'r2', 'r3'],
  lisboa: ['r1', 'r2', 'r3'],
  alentejo: ['r1', 'r2', 'r3'],
  algarve: ['r1', 'r2', 'r3'],
  acores: ['r1', 'r2', 'r3'],
  madeira: ['r1', 'r2', 'r3'],
};

export default function InclusivoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [activeRegion, setActiveRegion] = useState(REGIONS[0].id);

  const reads = (REGIONAL_READS[activeRegion] ?? []).map((id) => ({
    title: t(`modulesRoutes.inclusivo.reads.${activeRegion}.${id}.title`),
    desc: t(`modulesRoutes.inclusivo.reads.${activeRegion}.${id}.desc`),
  }));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
          >
            <MaterialIcons name="arrow-back" size={22} color={C.textDark} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>{t('modulesRoutes.inclusivo.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('modulesRoutes.inclusivo.subtitle')}</Text>
          </View>
          <View style={styles.headerIcon}>
            <MaterialIcons name="accessible" size={24} color={C.accent} />
          </View>
        </View>

        <Text style={styles.intro}>
          {t('modulesRoutes.inclusivo.intro')}
        </Text>

        <ModuleHighlights module="inclusivo" />
        <ModuleGuideCta module="inclusivo" />


        {/* ── Leitura por região ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>{t('modulesRoutes.inclusivo.regionLabel')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
        >
          {REGIONS.map((r) => {
            const on = r.id === activeRegion;
            return (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, on && styles.chipActive]}
                onPress={() => setActiveRegion(r.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextActive]}>{t(r.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.readsWrap}>
          <Text style={styles.readsTitle}>{t(`modulesRoutes.inclusivo.readsTitle.${activeRegion}`)}</Text>
          {reads.map((r) => (
            <View key={r.title} style={styles.readCard}>
              <MaterialIcons name="check-circle" size={17} color={C.accent} style={styles.readIcon} />
              <View style={styles.readBody}>
                <Text style={styles.readTitle}>{r.title}</Text>
                <Text style={styles.readDesc}>{r.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── História e Ligações (módulo temático) ─────────────────────── */}
        <ModuleHistory module="inclusivo" />
        <ModuleLinks module="inclusivo" />

        {/* ── Info Footer ────────────────────────────────────────────────── */}
        <View style={styles.infoFooter}>
          <MaterialIcons name="info-outline" size={14} color={C.textLight} />
          <Text style={styles.infoFooterText}>
            {t('modulesRoutes.inclusivo.footer')}
          </Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.card,
  },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: C.textDark },
  headerSubtitle: { fontSize: 13, color: C.textMed, marginTop: 2 },
  headerIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.accentMuted,
  },

  intro: {
    fontSize: 14, lineHeight: 21, color: C.textMed,
    paddingHorizontal: 20, marginBottom: 18,
  },


  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: C.textLight,
    paddingHorizontal: 20, marginBottom: 8,
  },
  chipsRow: { paddingHorizontal: 20, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 12.5, fontWeight: '600', color: C.textMed },
  chipTextActive: { color: C.onAccent },

  readsWrap: { paddingHorizontal: 20, marginTop: 18, marginBottom: 28 },
  readsTitle: { fontSize: 16, fontWeight: '700', color: C.textDark, marginBottom: 10 },
  readCard: {
    flexDirection: 'row', gap: 10,
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 13, marginBottom: 8,
  },
  readIcon: { marginTop: 1 },
  readBody: { flex: 1, minWidth: 0 },
  readTitle: { fontSize: 13.5, fontWeight: '700', color: C.textDark },
  readDesc: { fontSize: 12.5, lineHeight: 18, color: C.textMed, marginTop: 3 },

  infoFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: 20, marginTop: 4,
  },
  infoFooterText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: C.textLight },
});
