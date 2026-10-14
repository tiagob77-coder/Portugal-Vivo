/**
 * ModuleHighlights — os 4 destaques de um módulo temático
 *
 * Cada cartão abre o ecrã de detalhe do destaque, com localização, história,
 * POIs próximos na base e ligações de volta ao resto da app.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { getModuleTheme, withOpacity } from '../../theme/colors';
import { moduleHighlights, localizeHighlight } from '../../data/moduleHighlights';

interface Props {
  module: string;
}

export function ModuleHighlights({ module }: Props) {
  const router = useRouter();
  const { t: tr } = useTranslation();
  const highlights = moduleHighlights[module];
  if (!highlights?.length) return null;

  const t = getModuleTheme(module);

  return (
    <View style={s.section} testID="module-highlights">
      <View style={s.headingRow}>
        <MaterialIcons name="auto-awesome" size={20} color={t.accent} />
        <Text style={[s.heading, { color: t.textPrimary }]}>{tr('moduleContent.highlightsSection.heading')}</Text>
      </View>

      <View style={s.grid}>
        {highlights.map((h) => {
          const text = localizeHighlight(module, h, tr);
          return (
          <TouchableOpacity
            key={h.name}
            style={[s.card, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.2) }]}
            onPress={() =>
              router.push({
                pathname: '/modulo/[module]/destaque/[name]',
                params: { module, name: h.name },
              })
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={tr('moduleContent.highlightsSection.openA11y', { name: text.name })}
          >
            <Text style={s.emoji}>{h.emoji}</Text>
            <Text style={[s.name, { color: t.textPrimary }]} numberOfLines={2}>
              {text.name}
            </Text>
            <Text style={[s.meta, { color: t.textMuted }]} numberOfLines={2}>
              {text.meta}
            </Text>
          </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 28 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700' },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    flexGrow: 1, flexBasis: '45%',
    borderRadius: 14, borderWidth: 1, padding: 13,
  },
  emoji: { fontSize: 22, marginBottom: 6 },
  name: { fontSize: 13.5, fontWeight: '700' },
  meta: { fontSize: 11.5, lineHeight: 16, marginTop: 3 },
});

export default ModuleHighlights;
