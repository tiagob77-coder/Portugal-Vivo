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
import { useTranslation } from 'react-i18next';
import { getModuleTheme, withOpacity, onColor } from '../../theme/colors';
import { getModuleNarrative, getLinkedModules } from '../../data/moduleNarratives';

interface Props {
  module: string;
}

export function ModuleLinks({ module }: Props) {
  const router = useRouter();
  const { t } = useTranslation();
  const narrative = getModuleNarrative(module);
  if (!narrative) return null;

  const theme = getModuleTheme(module);
  const linked = getLinkedModules(module);
  // A primeira categoria é a mais representativa do módulo
  const encyclopediaQuery = narrative.categories[0];

  return (
    <View style={s.section} testID="module-links">
      <View style={s.headingRow}>
        <MaterialIcons name="hub" size={20} color={theme.accent} />
        <Text style={[s.heading, { color: theme.textPrimary }]}>{t('modulesRoutes.moduleLinks.heading')}</Text>
      </View>

      {linked.map((m) => {
        const label = t(`modulesRoutes.modules.${m.slug}.label`, { defaultValue: m.label });
        return (
          <TouchableOpacity
            key={m.slug}
            style={[s.row, { backgroundColor: theme.card, borderColor: withOpacity(theme.accent, 0.2) }]}
            onPress={() => router.push(m.route)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t('modulesRoutes.moduleLinks.openModule', { module: label })}
          >
            <View style={[s.rowIcon, { backgroundColor: withOpacity(theme.accent, 0.15) }]}>
              <MaterialIcons name={m.icon} size={19} color={theme.accent} />
            </View>
            <View style={s.rowBody}>
              <Text style={[s.rowTitle, { color: theme.textPrimary }]}>{label}</Text>
              <Text style={[s.rowDesc, { color: theme.textMuted }]} numberOfLines={2}>
                {t(`modulesRoutes.modules.${m.slug}.story`, { defaultValue: m.story })}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.textMuted} />
          </TouchableOpacity>
        );
      })}

      <View style={s.ctaRow}>
        <TouchableOpacity
          style={[s.cta, { backgroundColor: theme.accent }]}
          onPress={() => router.push({ pathname: '/encyclopedia', params: { q: encyclopediaQuery } })}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <MaterialIcons name="menu-book" size={17} color={onColor(theme.accent)} />
          <Text style={[s.ctaText, { color: onColor(theme.accent) }]}>{t('modulesRoutes.moduleLinks.encyclopedia')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.cta, s.ctaGhost, { borderColor: theme.accent }]}
          onPress={() => router.push('/(tabs)/mapa')}
          activeOpacity={0.85}
          accessibilityRole="button"
        >
          <MaterialIcons name="map" size={17} color={theme.accent} />
          <Text style={[s.ctaText, { color: theme.accent }]}>{t('modulesRoutes.moduleLinks.seeOnMap')}</Text>
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
