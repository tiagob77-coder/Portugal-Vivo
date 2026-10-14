/**
 * Guia de Exploração — região × categoria
 *
 * 84 guias (7 regiões × 12 módulos), cada um com leitura própria do território,
 * 3 experiências ancoradas a POIs reais da região, os melhores locais da base,
 * informação prática (transportes, clima, acessibilidade) e ferramentas.
 *
 * Troca-se de região e de categoria sem sair do ecrã.
 */
import React, { useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getModuleTheme, withOpacity, onColor } from '../../src/theme/colors';
import {
  guideRegions, getGuideRegion, localizeGuideRegion, localizeGuideExperiences,
  guideAngleText, guideLensText, guideRegionText, guideRegionPhrase,
  type GuideRegionPhrase,
} from '../../src/data/explorationGuide';
import { moduleNarratives, getModuleNarrative, MODULE_SLUGS } from '../../src/data/moduleNarratives';
import { useDefaultRegion } from '../../src/hooks/useDefaultRegion';
import { getMapItems } from '../../src/services/api';
import { matchesRegion } from '../../src/utils/regionMatch';
import { currentLocale } from '../../src/i18n/format';

interface GuidePoi {
  id?: string;
  name?: string;
  category?: string;
  region?: string;
  concelho?: string;
  iq_score?: number;
}

const DEFAULT_MODULE = 'costa';

export default function ExplorationGuideScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ module?: string; region?: string }>();
  // `t` é o tema do módulo neste ecrã; a tradução fica em `tx`
  const { t: tx } = useTranslation();

  const moduleSlug = params.module && moduleNarratives[params.module]
    ? params.module
    : DEFAULT_MODULE;
  const regionId = useDefaultRegion(params.region, params.region);

  const narrative = getModuleNarrative(moduleSlug);
  const rawRegion = getGuideRegion(regionId);
  const region = rawRegion ? localizeGuideRegion(rawRegion, tx) : undefined;
  const t = getModuleTheme(moduleSlug);

  const experiences = localizeGuideExperiences(moduleSlug, regionId, tx);
  const angle = guideAngleText(moduleSlug, regionId, tx);
  const lens = guideLensText(moduleSlug, tx);
  /** Nome do módulo na língua da UI (o português é o da narrativa). */
  const moduleLabel = (slug: string) =>
    tx(`guidesEn2.guide.modules.${slug}`, { defaultValue: moduleNarratives[slug]?.label ?? '' });

  // POIs da base nas categorias do módulo, filtrados pela região
  const { data: poisData, isLoading } = useQuery({
    queryKey: ['guide-pois', moduleSlug],
    queryFn: () => getMapItems(narrative?.categories, undefined, 500),
    staleTime: 10 * 60 * 1000,
  });

  const regionPois = useMemo(() => {
    const all = (poisData as GuidePoi[] | undefined) ?? [];
    return all
      .filter((p) => matchesRegion(p.region, regionId))
      .sort((a, b) => (b.iq_score ?? 0) - (a.iq_score ?? 0));
  }, [poisData, regionId]);

  const topPois = regionPois.slice(0, 6);

  const setModule = (slug: string) =>
    router.setParams({ module: slug, region: regionId });
  const setRegion = (id: string) =>
    router.setParams({ module: moduleSlug, region: id });

  if (!narrative || !rawRegion || !region) {
    return (
      <View style={[s.container, { backgroundColor: t.bg, paddingTop: insets.top }]}>
        <Text style={[s.body, { color: t.textSecondary, padding: 20 }]}>
          {tx('guidesEn2.guide.unavailable')}
        </Text>
      </View>
    );
  }

  const accentText = onColor(t.accent);
  /** A região numa frase ("the North", "dans le Nord"…). */
  const regionPhrase = (p: GuideRegionPhrase) => guideRegionPhrase(rawRegion, p, tx);
  const poiMeta = (p: GuidePoi) =>
    [p.category, p.concelho].filter(Boolean).join(' · ');

  return (
    <View style={[s.container, { backgroundColor: t.bg }]}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 80 }}>
        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={[s.backBtn, { backgroundColor: t.card }]}
            accessibilityRole="button"
            accessibilityLabel={tx('common.back')}
          >
            <MaterialIcons name="arrow-back" size={21} color={t.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.kicker, { color: t.accent }]}>
              {tx('guidesEn2.guide.kicker', { region: region.label })}
            </Text>
            <Text style={[s.title, { color: t.textPrimary }]}>{moduleLabel(moduleSlug)}</Text>
            <Text style={[s.sub, { color: t.textMuted }]}>{region.sub}</Text>
          </View>
          <View style={[s.headerIcon, { backgroundColor: withOpacity(t.accent, 0.15) }]}>
            <MaterialIcons name={narrative.icon} size={22} color={t.accent} />
          </View>
        </View>

        {/* ── Seletores ──────────────────────────────────────────────────── */}
        <Text style={[s.chipLabel, { color: t.textMuted }]}>{tx('guidesEn2.guide.regionLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {guideRegions.map((r) => {
            const on = r.id === regionId;
            return (
              <TouchableOpacity
                key={r.id}
                style={[s.chip, {
                  backgroundColor: on ? t.accent : t.card,
                  borderColor: on ? t.accent : withOpacity(t.accent, 0.24),
                }]}
                onPress={() => setRegion(r.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipText, { color: on ? accentText : t.textSecondary }]}>
                  {guideRegionText(r, 'chip', tx)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[s.chipLabel, { color: t.textMuted, marginTop: 16 }]}>{tx('guidesEn2.guide.categoryLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
          {MODULE_SLUGS.map((slug) => {
            const on = slug === moduleSlug;
            return (
              <TouchableOpacity
                key={slug}
                style={[s.chip, {
                  backgroundColor: on ? t.accent : t.card,
                  borderColor: on ? t.accent : withOpacity(t.accent, 0.24),
                }]}
                onPress={() => setModule(slug)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
              >
                <Text style={[s.chipText, { color: on ? accentText : t.textSecondary }]}>
                  {moduleLabel(slug)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── História ───────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.intro, { color: t.textMuted }]}>
            {tx('guidesEn2.guide.intro', {
              region: regionPhrase('theRegion'),
              category: moduleLabel(moduleSlug),
            })}
          </Text>
          <Text style={[s.sectionTitle, { color: t.textPrimary }]}>
            {tx('guidesEn2.guide.heartOf', { ofRegion: regionPhrase('ofRegion') })}
          </Text>
          <Text style={[s.body, { color: t.textSecondary }]}>{angle}</Text>
          <Text style={[s.body, { color: t.textSecondary, marginTop: 10 }]}>
            {lens} {region.hook}
          </Text>
        </View>

        {/* ── Experiências sugeridas ─────────────────────────────────────── */}
        {experiences.length > 0 && (
          <View style={s.section}>
            <Text style={[s.sectionTitle, { color: t.textPrimary }]}>{tx('guidesEn2.guide.suggested')}</Text>
            {experiences.map((exp, i) => {
              // Cada experiência ancora, quando existe, um POI real da região
              const poi = topPois[i];
              return (
                <View
                  key={exp.title}
                  style={[s.expCard, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.2) }]}
                >
                  <View style={s.expHead}>
                    <View style={[s.expNum, { backgroundColor: withOpacity(t.accent, 0.15) }]}>
                      <Text style={[s.expNumText, { color: t.accent }]}>{i + 1}</Text>
                    </View>
                    <Text style={[s.expTitle, { color: t.textPrimary }]}>{exp.title}</Text>
                  </View>
                  <Text style={[s.body, { color: t.textSecondary }]}>{exp.desc}</Text>

                  {poi && (
                    <TouchableOpacity
                      style={[s.expPoi, { borderTopColor: withOpacity(t.accent, 0.15) }]}
                      onPress={() =>
                        poi.id && router.push({ pathname: '/heritage/[id]', params: { id: poi.id } })
                      }
                      disabled={!poi.id}
                      accessibilityRole="button"
                    >
                      <MaterialIcons name="place" size={15} color={t.accent} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[s.expPoiName, { color: t.textPrimary }]} numberOfLines={1}>
                          {poi.name}
                        </Text>
                        <Text style={[s.expPoiMeta, { color: t.textMuted }]} numberOfLines={1}>
                          {poiMeta(poi)}
                        </Text>
                      </View>
                      <MaterialIcons name="chevron-right" size={18} color={t.textMuted} />
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Onde ver na base ───────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: t.textPrimary }]}>{tx('guidesEn2.guide.whereToSee')}</Text>
          {isLoading && <ActivityIndicator color={t.accent} style={{ marginTop: 10 }} />}
          {!isLoading && (
            <Text style={[s.dbLine, { color: t.textMuted }]}>
              {tx(
                regionPois.length === 1 ? 'guidesEn2.guide.dbCountOne' : 'guidesEn2.guide.dbCount',
                {
                  n: regionPois.length.toLocaleString(currentLocale()),
                  inRegion: regionPhrase('inRegion'),
                },
              )}
            </Text>
          )}
          {topPois.slice(0, 4).map((p) => (
            <TouchableOpacity
              key={p.id ?? p.name}
              style={[s.poiRow, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.18) }]}
              onPress={() => p.id && router.push({ pathname: '/heritage/[id]', params: { id: p.id } })}
              disabled={!p.id}
              accessibilityRole="button"
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.poiName, { color: t.textPrimary }]} numberOfLines={1}>{p.name}</Text>
                <Text style={[s.poiMeta, { color: t.textMuted }]} numberOfLines={1}>{poiMeta(p)}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Informação prática ─────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: t.textPrimary }]}>{tx('guidesEn2.guide.practical')}</Text>

          <Text style={[s.subHead, { color: t.accent }]}>{tx('guidesEn2.guide.transports')}</Text>
          {region.transports.map((tr) => (
            <View key={tr.label} style={s.infoRow}>
              <MaterialIcons name="commute" size={16} color={t.accent} style={s.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[s.infoLabel, { color: t.textPrimary }]}>{tr.label}</Text>
                <Text style={[s.infoText, { color: t.textSecondary }]}>{tr.text}</Text>
              </View>
            </View>
          ))}

          <Text style={[s.subHead, { color: t.accent, marginTop: 16 }]}>{tx('guidesEn2.guide.climate')}</Text>
          <View style={s.infoRow}>
            <MaterialIcons name="wb-sunny" size={16} color={t.accent} style={s.infoIcon} />
            <View style={{ flex: 1 }}>
              <Text style={[s.infoLabel, { color: t.textPrimary }]}>{tx('guidesEn2.guide.bestTime')}</Text>
              <Text style={[s.infoText, { color: t.textSecondary }]}>{region.best}</Text>
            </View>
          </View>
          {region.alerts.map((a) => (
            <View key={a} style={s.infoRow}>
              <MaterialIcons name="warning-amber" size={16} color="#F59E0B" style={s.infoIcon} />
              <Text style={[s.infoText, { color: t.textSecondary, flex: 1 }]}>{a}</Text>
            </View>
          ))}

          <Text style={[s.subHead, { color: t.accent, marginTop: 16 }]}>{tx('guidesEn2.guide.accessibility')}</Text>
          {([
            { icon: 'accessible', label: tx('guidesEn2.guide.mobility'), text: region.mobility },
            { icon: 'child-care', label: tx('guidesEn2.guide.kids'), text: region.kids },
            { icon: 'pets', label: tx('guidesEn2.guide.pets'), text: region.pets },
          ] as const).map((a) => (
            <View key={a.label} style={s.infoRow}>
              <MaterialIcons name={a.icon} size={16} color={t.accent} style={s.infoIcon} />
              <View style={{ flex: 1 }}>
                <Text style={[s.infoLabel, { color: t.textPrimary }]}>{a.label}</Text>
                <Text style={[s.infoText, { color: t.textSecondary }]}>{a.text}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Ferramentas ────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: t.textPrimary }]}>{tx('guidesEn2.guide.tools')}</Text>
          {([
            {
              icon: 'commute', label: tx('guidesEn2.guide.toolMobility'),
              desc: tx('guidesEn2.guide.toolMobilityDesc', {
                ofRegion: regionPhrase('ofRegion'),
              }),
              go: () => router.push('/(tabs)/mapa' as never),
            },
            {
              icon: 'waves', label: tx('guidesEn2.guide.toolSurf'),
              desc: tx('guidesEn2.guide.toolSurfDesc'),
              go: () => router.push('/beachcams' as never),
            },
            {
              icon: 'accessible', label: tx('guidesEn2.guide.toolInclusive'),
              desc: tx('guidesEn2.guide.toolInclusiveDesc'),
              go: () => setModule('inclusivo'),
            },
          ] as const).map((tool) => (
            <TouchableOpacity
              key={tool.label}
              style={[s.toolRow, { backgroundColor: t.card, borderColor: withOpacity(t.accent, 0.18) }]}
              onPress={tool.go}
              accessibilityRole="button"
            >
              <View style={[s.toolIcon, { backgroundColor: withOpacity(t.accent, 0.15) }]}>
                <MaterialIcons name={tool.icon} size={18} color={t.accent} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.infoLabel, { color: t.textPrimary }]}>{tool.label}</Text>
                <Text style={[s.infoText, { color: t.textMuted }]}>{tool.desc}</Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Continuar ──────────────────────────────────────────────────── */}
        <View style={[s.section, s.ctaRow]}>
          <TouchableOpacity
            style={[s.cta, { backgroundColor: t.accent }]}
            onPress={() =>
              router.push({ pathname: '/encyclopedia', params: { q: narrative.categories[0] } })
            }
            accessibilityRole="button"
          >
            <MaterialIcons name="menu-book" size={17} color={accentText} />
            <Text style={[s.ctaText, { color: accentText }]}>{tx('guidesEn2.guide.encyclopedia')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.cta, s.ctaGhost, { borderColor: t.accent }]}
            onPress={() => router.push(narrative.route)}
            accessibilityRole="button"
          >
            <MaterialIcons name={narrative.icon} size={17} color={t.accent} />
            <Text style={[s.ctaText, { color: t.accent }]}>{tx('guidesEn2.guide.viewModule')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, marginBottom: 18 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '800', marginTop: 3 },
  sub: { fontSize: 12, marginTop: 2 },
  headerIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },

  chipLabel: { fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 20, marginBottom: 7 },
  chipRow: { paddingHorizontal: 20, gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 7.5, borderRadius: 17, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontWeight: '600' },

  section: { paddingHorizontal: 20, marginTop: 26 },
  intro: { fontSize: 12.5, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  subHead: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.7, marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 21 },

  expCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 10 },
  expHead: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 7 },
  expNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  expNumText: { fontSize: 12, fontWeight: '800' },
  expTitle: { flex: 1, fontSize: 14.5, fontWeight: '700' },
  expPoi: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 11, paddingTop: 10, borderTopWidth: 1 },
  expPoiName: { fontSize: 13, fontWeight: '600' },
  expPoiMeta: { fontSize: 11, marginTop: 1 },

  dbLine: { fontSize: 12.5, marginBottom: 10 },
  poiRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  poiName: { fontSize: 14, fontWeight: '700' },
  poiMeta: { fontSize: 11.5, marginTop: 2 },

  infoRow: { flexDirection: 'row', gap: 9, marginBottom: 11 },
  infoIcon: { marginTop: 2 },
  infoLabel: { fontSize: 13.5, fontWeight: '700' },
  infoText: { fontSize: 12.5, lineHeight: 18, marginTop: 2 },

  toolRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  toolIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  ctaRow: { flexDirection: 'row', gap: 10 },
  cta: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 12, borderRadius: 12 },
  ctaGhost: { backgroundColor: 'transparent', borderWidth: 1.5 },
  ctaText: { fontSize: 13.5, fontWeight: '700' },
});
