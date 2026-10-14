/**
 * ModuleHistory — abertura narrativa + linha do tempo de um módulo temático
 *
 * Usa a paleta do próprio módulo, para que o bloco funcione tanto nos temas
 * escuros (biodiversidade, música, costa…) como nos claros.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { getModuleTheme, withOpacity } from '../../theme/colors';
import { getModuleNarrative, localizeModuleNarrative } from '../../data/moduleNarratives';

interface Props {
  /** Slug do módulo, e.g. 'biodiversidade' */
  module: string;
}

export function ModuleHistory({ module }: Props) {
  const { t: tr } = useTranslation();
  const narrative = getModuleNarrative(module);
  if (!narrative) return null;

  const t = getModuleTheme(module);
  const text = localizeModuleNarrative(module, narrative, tr);

  return (
    <View style={s.section} testID="module-history">
      <View style={s.headingRow}>
        <MaterialIcons name="history-edu" size={20} color={t.accent} />
        <Text style={[s.heading, { color: t.textPrimary }]}>{tr('moduleContent.historySection.heading')}</Text>
      </View>

      <Text style={[s.story, { color: t.textSecondary }]}>{text.story}</Text>

      <View style={s.timeline}>
        {text.milestones.map((m, i) => {
          const last = i === text.milestones.length - 1;
          return (
            <View key={`${m.year}-${m.title}`} style={s.milestone}>
              {/* Calha: marcador + linha de ligação ao marco seguinte */}
              <View style={s.rail}>
                <View style={[s.dot, { backgroundColor: t.accent }]} />
                {!last && <View style={[s.line, { backgroundColor: withOpacity(t.accent, 0.3) }]} />}
              </View>

              <View style={[s.milestoneBody, last && s.milestoneBodyLast]}>
                <Text style={[s.year, { color: t.accent }]}>{m.year}</Text>
                <Text style={[s.title, { color: t.textPrimary }]}>{m.title}</Text>
                <Text style={[s.desc, { color: t.textSecondary }]}>{m.desc}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 28 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  heading: { fontSize: 18, fontWeight: '700' },
  story: { fontSize: 14, lineHeight: 22, marginBottom: 18 },

  timeline: { gap: 0 },
  milestone: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  line: { width: 2, flex: 1, marginTop: 2 },

  milestoneBody: { flex: 1, paddingBottom: 18 },
  milestoneBodyLast: { paddingBottom: 0 },
  year: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 14.5, fontWeight: '700', marginTop: 2 },
  desc: { fontSize: 13, lineHeight: 19, marginTop: 3 },
});

export default ModuleHistory;
