/**
 * ModuleGuideCta — entrada para o Guia de Exploração a partir de um módulo
 *
 * Aparece no topo do ecrã do módulo. A região é resolvida pelo guia (GPS →
 * onboarding → fallback), por isso o CTA só passa a categoria.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getModuleTheme, withOpacity, onColor } from '../../theme/colors';
import { getModuleNarrative } from '../../data/moduleNarratives';

interface Props {
  module: string;
}

export function ModuleGuideCta({ module }: Props) {
  const router = useRouter();
  const narrative = getModuleNarrative(module);
  if (!narrative) return null;

  const t = getModuleTheme(module);

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.28) }]}
      onPress={() => router.push({ pathname: '/guia', params: { module } })}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Abrir Guia de Exploração de ${narrative.label}`}
      testID="module-guide-cta"
    >
      <View style={[s.icon, { backgroundColor: t.accent }]}>
        <MaterialIcons name="explore" size={19} color={onColor(t.accent)} />
      </View>
      <View style={s.body}>
        <Text style={[s.title, { color: t.textPrimary }]}>Guia de Exploração</Text>
        <Text style={[s.desc, { color: t.textMuted }]}>
          Experiências, transportes e acessibilidade, região a região
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 18,
    padding: 13, borderRadius: 14, borderWidth: 1,
  },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 14.5, fontWeight: '700' },
  desc: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
});

export default ModuleGuideCta;
