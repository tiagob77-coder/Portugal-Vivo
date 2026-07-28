/**
 * Detalhe de um destaque de módulo temático
 *
 * Cada destaque abre com a paleta do seu módulo e traz: onde ver (com distância
 * até ao utilizador, navegação e mapa), a história do destaque, os POIs reais
 * mais próximos na base, e ligações de volta ao módulo, à Enciclopédia e à
 * pesquisa.
 */
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getModuleTheme, withOpacity, onColor } from '../../../../src/theme/colors';
import { getModuleNarrative } from '../../../../src/data/moduleNarratives';
import { getHighlight, getHighlightDetail } from '../../../../src/data/moduleHighlights';
import { haversineKm, formatDistance, nearest } from '../../../../src/utils/geo';
import NavigationChooser from '../../../../src/components/NavigationChooser';
import { getMapItems } from '../../../../src/services/api';

interface NearbyPoi {
  id?: string;
  name?: string;
  category?: string;
  lat?: number;
  lng?: number;
}

export default function HighlightDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { module, name } = useLocalSearchParams<{ module: string; name: string }>();
  const [navOpen, setNavOpen] = useState(false);

  const slug = module ?? '';
  const highlightName = name ?? '';

  const t = getModuleTheme(slug);
  const narrative = getModuleNarrative(slug);
  const highlight = getHighlight(slug, highlightName);
  const detail = getHighlightDetail(highlightName);

  // POIs da base nas categorias do módulo, para "Onde ver na base"
  const { data: poisData, isLoading: poisLoading } = useQuery({
    queryKey: ['map-items', slug],
    queryFn: () => getMapItems(narrative?.categories, undefined, 500),
    staleTime: 10 * 60 * 1000,
    enabled: !!detail,
  });

  const nearbyPois = useMemo(() => {
    if (!detail) return [];
    const cats = narrative?.categories ?? [];
    const pool = ((poisData as NearbyPoi[] | undefined) ?? []).filter(
      (p) =>
        typeof p.lat === 'number' &&
        typeof p.lng === 'number' &&
        (cats.length === 0 || cats.includes(p.category ?? '')),
    ) as (NearbyPoi & { lat: number; lng: number })[];
    return nearest({ lat: detail.lat, lng: detail.lng }, pool, 5);
  }, [poisData, detail, narrative]);

  if (!highlight || !narrative) {
    return (
      <View style={[s.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backInline}>
          <MaterialIcons name="arrow-back" size={22} color={t.textPrimary} />
          <Text style={[s.backText, { color: t.textPrimary }]}>Voltar</Text>
        </TouchableOpacity>
        <Text style={[s.missing, { color: t.textSecondary }]}>
          Destaque não encontrado.
        </Text>
      </View>
    );
  }

  // Sem ficha curada, recai na leitura do próprio módulo
  const where = detail?.where ?? narrative.story;
  const history = detail?.history ?? narrative.story;

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 60 }}>
        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[s.backBtn, { backgroundColor: t.card }]}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={21} color={t.textPrimary} />
          </TouchableOpacity>
          <View style={[s.modulePill, { backgroundColor: withOpacity(t.accent, 0.15) }]}>
            <MaterialIcons name={narrative.icon as never} size={14} color={t.accent} />
            <Text style={[s.modulePillText, { color: t.accent }]}>{narrative.label}</Text>
          </View>
        </View>

        <View style={s.titleBlock}>
          <Text style={s.emoji}>{highlight.emoji}</Text>
          <Text style={[s.title, { color: t.textPrimary }]}>{highlight.name}</Text>
          <Text style={[s.meta, { color: t.textMuted }]}>{highlight.meta}</Text>
        </View>

        {/* ── Localização ────────────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.2) }]}>
          <View style={s.cardHead}>
            <MaterialIcons name="place" size={18} color={t.accent} />
            <Text style={[s.cardTitle, { color: t.textPrimary }]}>Onde ver</Text>
          </View>
          <Text style={[s.body, { color: t.textSecondary }]}>{where}</Text>

          {detail && (
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.action, { backgroundColor: t.accent }]}
                onPress={() => setNavOpen(true)}
                accessibilityRole="button"
              >
                <MaterialIcons name="navigation" size={16} color={onColor(t.accent)} />
                <Text style={[s.actionText, { color: onColor(t.accent) }]}>Navegar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.action, s.actionGhost, { borderColor: t.accent }]}
                onPress={() => router.push('/(tabs)/mapa' as never)}
                accessibilityRole="button"
              >
                <MaterialIcons name="map" size={16} color={t.accent} />
                <Text style={[s.actionText, { color: t.accent }]}>Ver no mapa</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── História ───────────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.cardHead}>
            <MaterialIcons name="history-edu" size={18} color={t.accent} />
            <Text style={[s.cardTitle, { color: t.textPrimary }]}>História</Text>
          </View>
          <Text style={[s.body, { color: t.textSecondary }]}>{history}</Text>
        </View>

        {/* ── Onde ver na base ───────────────────────────────────────────── */}
        {detail && (
          <View style={s.section}>
            <View style={s.cardHead}>
              <MaterialIcons name="explore" size={18} color={t.accent} />
              <Text style={[s.cardTitle, { color: t.textPrimary }]}>Onde ver na base</Text>
            </View>

            {poisLoading && <ActivityIndicator color={t.accent} style={{ marginTop: 12 }} />}

            {!poisLoading && nearbyPois.length === 0 && (
              <Text style={[s.body, { color: t.textMuted }]}>
                Ainda sem locais georreferenciados nesta categoria.
              </Text>
            )}

            {nearbyPois.map(({ point, km }) => (
              <TouchableOpacity
                key={point.id ?? `${point.lat},${point.lng}`}
                style={[s.poiRow, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.18) }]}
                onPress={() => point.id && router.push(`/heritage/${point.id}` as never)}
                disabled={!point.id}
                accessibilityRole="button"
              >
                <View style={s.poiBody}>
                  <Text style={[s.poiName, { color: t.textPrimary }]} numberOfLines={1}>
                    {point.name}
                  </Text>
                  <Text style={[s.poiMeta, { color: t.textMuted }]} numberOfLines={1}>
                    {[point.category, formatDistance(km)].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ── Ligações ───────────────────────────────────────────────────── */}
        <View style={s.section}>
          <View style={s.cardHead}>
            <MaterialIcons name="hub" size={18} color={t.accent} />
            <Text style={[s.cardTitle, { color: t.textPrimary }]}>Continuar a explorar</Text>
          </View>

          <TouchableOpacity
            style={[s.linkRow, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.18) }]}
            onPress={() => router.push(narrative.route as never)}
            accessibilityRole="button"
          >
            <MaterialIcons name={narrative.icon as never} size={18} color={t.accent} />
            <Text style={[s.linkText, { color: t.textPrimary }]}>Voltar a {narrative.label}</Text>
            <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.linkRow, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.18) }]}
            onPress={() =>
              router.push(`/encyclopedia?q=${encodeURIComponent(narrative.categories[0])}` as never)
            }
            accessibilityRole="button"
          >
            <MaterialIcons name="menu-book" size={18} color={t.accent} />
            <Text style={[s.linkText, { color: t.textPrimary }]}>Explorar na Enciclopédia</Text>
            <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.linkRow, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.18) }]}
            onPress={() => router.push(`/search?q=${encodeURIComponent(highlight.name)}` as never)}
            accessibilityRole="button"
          >
            <MaterialIcons name="search" size={18} color={t.accent} />
            <Text style={[s.linkText, { color: t.textPrimary }]}>Pesquisar “{highlight.name}”</Text>
            <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {detail && (
        <NavigationChooser
          visible={navOpen}
          onClose={() => setNavOpen(false)}
          name={highlight.name}
          lat={detail.lat}
          lng={detail.lng}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, marginBottom: 14,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  modulePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14,
  },
  modulePillText: { fontSize: 11.5, fontWeight: '700' },

  backInline: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 20 },
  backText: { fontSize: 15, fontWeight: '600' },
  missing: { fontSize: 14, paddingHorizontal: 20 },

  titleBlock: { paddingHorizontal: 20, marginBottom: 20 },
  emoji: { fontSize: 34, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800' },
  meta: { fontSize: 13, marginTop: 4 },

  card: {
    marginHorizontal: 20, marginBottom: 24,
    borderRadius: 16, borderWidth: 1, padding: 15,
  },
  section: { paddingHorizontal: 20, marginBottom: 26 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 9 },
  cardTitle: { fontSize: 16.5, fontWeight: '700' },
  body: { fontSize: 14, lineHeight: 21 },

  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 12,
  },
  actionGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  actionText: { fontSize: 13.5, fontWeight: '700' },

  poiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  poiBody: { flex: 1, minWidth: 0 },
  poiName: { fontSize: 14, fontWeight: '700' },
  poiMeta: { fontSize: 11.5, marginTop: 2 },

  linkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 13, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  linkText: { flex: 1, fontSize: 14, fontWeight: '600' },
});
