/**
 * Settings — Privacidade
 *
 * Opt-out das estatísticas anónimas de utilização (impactTracking.ts) que
 * alimentam o painel de impacto dos municípios parceiros.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../src/context/ThemeContext';
import { shadows } from '../../src/theme';
import { ScreenHeader } from '../../src/components/ui';
import { isImpactTrackingEnabled, setImpactTrackingEnabled } from '../../src/services/impactTracking';

export default function PrivacySettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // null while the stored preference is being read
  const [statsEnabled, setStatsEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    isImpactTrackingEnabled()
      .then((enabled) => { if (!cancelled) setStatsEnabled(enabled); })
      .catch(() => { if (!cancelled) setStatsEnabled(true); });
    return () => { cancelled = true; };
  }, []);

  const onToggleStats = (value: boolean) => {
    setStatsEnabled(value);
    void setImpactTrackingEnabled(value);
  };

  const on = statsEnabled ?? true;

  return (
    <View style={[s.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScreenHeader title="Privacidade" onBack={() => router.back()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 + insets.bottom }}>
        <Text style={[s.sectionTitle, { color: colors.textMuted }]}>ESTATÍSTICAS DE UTILIZAÇÃO</Text>

        <View style={[s.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialIcons name="insights" size={22} color={on ? colors.accent : colors.textMuted} />
          <View style={s.rowText}>
            <Text style={[s.rowLabel, { color: colors.textPrimary }]}>Partilhar estatísticas anónimas</Text>
            <Text style={[s.rowSublabel, { color: colors.textMuted }]}>
              Ajuda os municípios a perceber que locais são visitados. Sem dados pessoais.
            </Text>
          </View>
          <Switch
            testID="impact-tracking-switch"
            accessibilityLabel="Partilhar estatísticas anónimas"
            value={on}
            disabled={statsEnabled === null}
            onValueChange={onToggleStats}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
            {...(Platform.OS === 'ios' ? { ios_backgroundColor: colors.border } : {})}
          />
        </View>

        <Text style={[s.hint, { color: colors.textMuted }]}>
          Contamos apenas ações anónimas (locais e rotas vistos, áudio ouvido, partilhas e
          pedidos de direções) com um identificador aleatório que muda todos os meses e fica
          só neste dispositivo. Não enviamos a sua conta, o endereço IP nem a localização.
          Os eventos são apagados ao fim de 400 dias.
        </Text>

        <TouchableOpacity
          style={s.link}
          onPress={() => router.push('/privacy')}
          accessibilityRole="link"
          accessibilityLabel="Ler a Política de Privacidade"
        >
          <MaterialIcons name="privacy-tip" size={16} color={colors.accent} />
          <Text style={[s.linkText, { color: colors.accent }]}>Ler a Política de Privacidade</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 16, marginTop: 20, marginBottom: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 16, padding: 14, borderRadius: 12, borderWidth: 1, ...shadows.sm,
  },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: '600' },
  rowSublabel: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  hint: { fontSize: 12, lineHeight: 18, marginHorizontal: 16, marginTop: 12 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: 16, paddingVertical: 6 },
  linkText: { fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
});
