/**
 * ModuleLinks — ligações cruzadas de um módulo temático
 *
 * Os módulos não são silos: cada um aponta para os três vizinhos que partilham
 * o mesmo território ou tema, mais atalhos para a Enciclopédia (já filtrada
 * pelas categorias do módulo) e para o Mapa.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getModuleTheme, withOpacity, onColor } from '../../theme/colors';
import { getModuleNarrative, getLinkedModules } from '../../data/moduleNarratives';

interface Props {
  module: string;
}

export function ModuleLinks({ module }: Props) {
  const router = useRouter();
  const narrative = getModuleNarrative(module);
  if (!narrative) return null;

  const t = getModuleTheme(module);
  const linked = getLinkedModules(module);
  // A primeira categoria é a mais representativa do módulo
  const encyclopediaQuery = narrative.categories[0];

  return (
    <View style={s.section} testID="module-links">
      <View style={s.headingRow}>
        <MaterialIcons name="hub" size={20} color={t.accent} />
        <Text style={[s.heading, { color: t.textPrimary }]}>Ligações</Text>
      </View>

      {linked.map((m) => (
        <TouchableOpacity
          key={m.slug}
          style={[s.row, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.2) }]}
          onPress={() => router.push(m.route as never)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Abrir módulo ${m.label}`}
        >
          <View style={[s.rowIcon, { backgroundColor: withOpacity(t.accent, 0.15) }]}>
            <MaterialIcons name={m.icon as never} size={19} color={t.accent} />
          </View>
          <View style={s.rowBody}>
            <Text style={[s.rowTitle, { color: t.textPrimary }]}>{m.label}</Text>
            <Text style={[s.rowDesc, { color: t.textMuted }]} numberOfLines={2}>
              {m.story}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
        </TouchableOpacity>
      ))}

      <View style={s.ctaRow}>
        <TouchableOpacity
          style={[s.cta, { backgroundColor: t.accent }]}
          onPress={() => router.push(`/encyclopedia?q=${encodeURIComponent(encyclopediaQuery)}` as never)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <MaterialIcons name="menu-book" size={17} color={onColor(t.accent)} />
          <Text style={[s.ctaText, { color: onColor(t.accent) }]}>Enciclopédia</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.cta, s.ctaGhost, { borderColor: t.accent }]}
          onPress={() => router.push('/(tabs)/mapa' as never)}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <MaterialIcons name="map" size={17} color={t.accent} />
          <Text style={[s.ctaText, { color: t.accent }]}>Ver no mapa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingHorizontal: 20, marginBottom: 28 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heading: { fontSize: 18, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  rowIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14.5, fontWeight: '700' },
  rowDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },

  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  cta: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 12, borderRadius: 12,
  },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  ctaText: { fontSize: 13.5, fontWeight: '700' },
});

export default ModuleLinks;
