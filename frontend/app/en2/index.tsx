/**
 * EN2 — a "Route 66 portuguesa"
 *
 * Rota premium dedicada, com tema asfalto/dourado próprio: história, 6 troços
 * expansíveis, 13 locais a não perder, passaporte de 11 distritos e os POIs da
 * base que caem no corredor da estrada.
 */
import React, { useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  EN2_INTRO, EN2_FACTS, EN2_HISTORY, EN2_SECTIONS, EN2_MUST_SEE,
  EN2_DISTRICTS, EN2_WAYPOINTS, EN2_START, EN2_END, sectionWaypoints,
} from '../../src/data/en2';
import { useEn2Passport } from '../../src/hooks/useEn2Passport';
import { withinCorridor } from '../../src/utils/geo';
import { getMapItems } from '../../src/services/api';
import NavigationChooser from '../../src/components/NavigationChooser';

/** Paleta própria da EN2 — asfalto e sinalética dourada. */
const C = {
  bg: '#12100D',
  card: '#1C1915',
  cardAlt: '#241F19',
  accent: '#E0B877',
  accentDim: 'rgba(224,184,119,0.15)',
  border: 'rgba(224,184,119,0.22)',
  text: '#F5EFE4',
  text2: '#C9BFAC',
  muted: '#8A8172',
  onAccent: '#12100D',
  success: '#3FA66B',
};

/** POIs no corredor: 12 km de cada lado do eixo. */
const CORRIDOR_WIDTH_KM = 12;
const CORRIDOR_PAGE = 6;

interface CorridorPoi {
  id?: string;
  name?: string;
  category?: string;
  lat?: number;
  lng?: number;
  iq_score?: number;
}

export default function En2Screen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [openSection, setOpenSection] = useState<string | null>(EN2_SECTIONS[0].n);
  const [corridorLimit, setCorridorLimit] = useState(CORRIDOR_PAGE);
  const [navTarget, setNavTarget] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const passport = useEn2Passport();

  const { data: poisData, isLoading } = useQuery({
    queryKey: ['en2-corridor'],
    queryFn: () => getMapItems(undefined, undefined, 800),
    staleTime: 10 * 60 * 1000,
  });

  const corridorPois = useMemo(() => {
    const all = ((poisData as CorridorPoi[] | undefined) ?? []).filter(
      (p): p is CorridorPoi & { lat: number; lng: number } =>
        typeof p.lat === 'number' && typeof p.lng === 'number' && !!p.name,
    );
    return withinCorridor(all, EN2_WAYPOINTS, CORRIDOR_WIDTH_KM)
      .sort((a, b) => (b.point.iq_score ?? 0) - (a.point.iq_score ?? 0));
  }, [poisData]);

  return (
    <View style={s.container}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 80 }}>
        {/* ── Cabeçalho ──────────────────────────────────────────────────── */}
        <View style={s.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <MaterialIcons name="arrow-back" size={21} color={C.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.kicker}>ROTA PREMIUM</Text>
            <Text style={s.title}>EN2</Text>
            <Text style={s.subtitle}>A Route 66 portuguesa</Text>
          </View>
          <View style={s.shield}>
            <Text style={s.shieldText}>N2</Text>
          </View>
        </View>

        <Text style={s.intro}>{EN2_INTRO}</Text>

        <View style={s.factRow}>
          {EN2_FACTS.map((f) => (
            <View key={f.label} style={s.fact}>
              <MaterialIcons name={f.icon} size={15} color={C.accent} />
              <Text style={s.factText}>{f.label}</Text>
            </View>
          ))}
        </View>

        {/* ── História ───────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>História</Text>
          {EN2_HISTORY.map((h, i) => {
            const last = i === EN2_HISTORY.length - 1;
            return (
              <View key={h.year} style={s.milestone}>
                <View style={s.rail}>
                  <View style={s.dot} />
                  {!last && <View style={s.line} />}
                </View>
                <View style={[s.milestoneBody, last && { paddingBottom: 0 }]}>
                  <Text style={s.year}>{h.year}</Text>
                  <Text style={s.milestoneTitle}>{h.title}</Text>
                  <Text style={s.body}>{h.desc}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* ── Troços ─────────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Os 6 troços</Text>
          {EN2_SECTIONS.map((sec) => {
            const open = openSection === sec.n;
            const stops = sectionWaypoints(sec);
            const start = stops[0];
            return (
              <View key={sec.n} style={s.trocoCard}>
                <TouchableOpacity
                  style={s.trocoHead}
                  onPress={() => setOpenSection(open ? null : sec.n)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                >
                  <View style={s.trocoNum}>
                    <Text style={s.trocoNumText}>{sec.n}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.trocoTitle}>{sec.title}</Text>
                    <Text style={s.trocoMeta}>{sec.meta}</Text>
                  </View>
                  <MaterialIcons
                    name={open ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={C.muted}
                  />
                </TouchableOpacity>

                {open && (
                  <View style={s.trocoBody}>
                    <Text style={s.body}>{sec.desc}</Text>
                    {sec.highlights.map((h) => (
                      <View key={h} style={s.hlRow}>
                        <MaterialIcons name="star-outline" size={15} color={C.accent} />
                        <Text style={s.hlText}>{h}</Text>
                      </View>
                    ))}
                    <View style={s.trocoActions}>
                      <TouchableOpacity
                        style={s.actionPrimary}
                        onPress={() => setNavTarget({ name: start.name, lat: start.lat, lng: start.lng })}
                        accessibilityRole="button"
                      >
                        <MaterialIcons name="navigation" size={15} color={C.onAccent} />
                        <Text style={s.actionPrimaryText}>Começar aqui</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={s.actionGhost}
                        onPress={() => router.push('/(tabs)/mapa')}
                        accessibilityRole="button"
                      >
                        <MaterialIcons name="map" size={15} color={C.accent} />
                        <Text style={s.actionGhostText}>Troço no mapa</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Locais a não perder ────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>A não perder</Text>
          <Text style={s.sectionSub}>{EN2_MUST_SEE.length} paragens ao longo dos 738,5 km</Text>
          {EN2_MUST_SEE.map((m) => (
            <TouchableOpacity
              key={m.name}
              style={s.mustRow}
              onPress={() => setNavTarget({ name: m.name, lat: m.lat, lng: m.lng })}
              accessibilityRole="button"
              accessibilityLabel={`Navegar para ${m.name}`}
            >
              <View style={s.kmBadge}>
                <Text style={s.kmText}>{m.km.replace('km ', '')}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.mustName}>{m.name}</Text>
                <Text style={s.mustSub}>{m.sub}</Text>
              </View>
              <MaterialIcons name="navigation" size={17} color={C.accent} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Passaporte ─────────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Passaporte EN2</Text>
          <Text style={s.sectionSub}>
            Carimbe os {passport.total} distritos que atravessar
          </Text>

          <View style={s.progressWrap}>
            <View style={s.progressTrack}>
              <View style={[s.progressFill, { width: `${passport.progress}%` }]} />
            </View>
            <Text style={s.progressText}>
              {passport.count}/{passport.total}
            </Text>
          </View>

          <View style={s.stampGrid}>
            {EN2_DISTRICTS.map((d) => {
              const on = passport.stamped.includes(d.name);
              return (
                <TouchableOpacity
                  key={d.name}
                  style={[s.stamp, on && s.stampOn]}
                  onPress={() => passport.toggle(d.name)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={`Carimbo ${d.name}`}
                >
                  <MaterialIcons
                    name={on ? 'check-circle' : d.icon}
                    size={19}
                    color={on ? C.onAccent : C.muted}
                  />
                  <Text style={[s.stampText, on && s.stampTextOn]} numberOfLines={1}>
                    {d.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {passport.complete && (
            <View style={s.seal}>
              <MaterialIcons name="workspace-premium" size={22} color={C.accent} />
              <Text style={s.sealText}>
                Chaves a Faro, os {passport.total} distritos carimbados. Fez a EN2 inteira.
              </Text>
            </View>
          )}

          {passport.count > 0 && (
            <TouchableOpacity
              onPress={passport.reset}
              style={s.resetBtn}
              accessibilityRole="button"
            >
              <Text style={s.resetText}>Limpar carimbos</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── POIs no caminho ────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>No caminho</Text>
          <Text style={s.sectionSub}>
            {isLoading
              ? 'A calcular o corredor…'
              : `${corridorPois.length.toLocaleString('pt-PT')} locais a menos de ${CORRIDOR_WIDTH_KM} km do eixo`}
          </Text>

          {isLoading && <ActivityIndicator color={C.accent} style={{ marginTop: 12 }} />}

          {corridorPois.slice(0, corridorLimit).map(({ point, offsetKm }) => (
            <TouchableOpacity
              key={point.id ?? point.name}
              style={s.poiRow}
              onPress={() =>
                point.id && router.push({ pathname: '/heritage/[id]', params: { id: point.id } })
              }
              disabled={!point.id}
              accessibilityRole="button"
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.poiName} numberOfLines={1}>{point.name}</Text>
                <Text style={s.poiMeta} numberOfLines={1}>
                  {[point.category, `a ${offsetKm.toFixed(0)} km da estrada`]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={20} color={C.muted} />
            </TouchableOpacity>
          ))}

          {corridorPois.length > corridorLimit && (
            <TouchableOpacity
              style={s.moreBtn}
              onPress={() => setCorridorLimit((n) => n + CORRIDOR_PAGE)}
              accessibilityRole="button"
            >
              <Text style={s.moreText}>Ver mais locais</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Fazer a viagem ─────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>Fazer a viagem</Text>
          <TouchableOpacity
            style={s.tripPrimary}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/planeador',
                params: {
                  origin: EN2_START.name,
                  destination: EN2_END.name,
                  days: '5',
                  corridor: '15',
                },
              })
            }
            accessibilityRole="button"
          >
            <MaterialIcons name="edit-calendar" size={17} color={C.onAccent} />
            <Text style={s.tripPrimaryText}>Gerar roteiro Chaves → Faro</Text>
          </TouchableOpacity>

          <View style={s.tripRow}>
            <TouchableOpacity
              style={s.actionGhost}
              onPress={() => router.push('/(tabs)/mapa')}
              accessibilityRole="button"
            >
              <MaterialIcons name="map" size={15} color={C.accent} />
              <Text style={s.actionGhostText}>Rota no mapa</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.actionGhost}
              onPress={() => router.push({ pathname: '/search', params: { q: 'EN2' } })}
              accessibilityRole="button"
            >
              <MaterialIcons name="search" size={15} color={C.accent} />
              <Text style={s.actionGhostText}>Pesquisar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {navTarget && (
        <NavigationChooser
          visible={!!navTarget}
          onClose={() => setNavTarget(null)}
          name={navTarget.name}
          lat={navTarget.lat}
          lng={navTarget.lng}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
  },
  kicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1, color: C.accent },
  title: { fontSize: 32, fontWeight: '800', color: C.text, marginTop: 2 },
  subtitle: { fontSize: 13, color: C.text2, marginTop: 1 },
  shield: {
    width: 44, height: 52, borderRadius: 8, borderWidth: 2, borderColor: C.accent,
    backgroundColor: C.card, alignItems: 'center', justifyContent: 'center',
  },
  shieldText: { fontSize: 17, fontWeight: '800', color: C.accent },

  intro: { fontSize: 14, lineHeight: 22, color: C.text2, paddingHorizontal: 20 },

  factRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20, marginTop: 16 },
  fact: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14,
  },
  factText: { fontSize: 11.5, fontWeight: '600', color: C.text2 },

  section: { paddingHorizontal: 20, marginTop: 30 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: C.text, marginBottom: 4 },
  sectionSub: { fontSize: 12.5, color: C.muted, marginBottom: 12 },
  body: { fontSize: 13.5, lineHeight: 20, color: C.text2 },

  milestone: { flexDirection: 'row', gap: 12 },
  rail: { alignItems: 'center', width: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent, marginTop: 5 },
  line: { width: 2, flex: 1, backgroundColor: C.border, marginTop: 2 },
  milestoneBody: { flex: 1, paddingBottom: 18 },
  year: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, color: C.accent, textTransform: 'uppercase' },
  milestoneTitle: { fontSize: 14.5, fontWeight: '700', color: C.text, marginTop: 2 },

  trocoCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    marginBottom: 10, overflow: 'hidden',
  },
  trocoHead: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 13 },
  trocoNum: {
    width: 32, height: 32, borderRadius: 8, backgroundColor: C.accentDim,
    alignItems: 'center', justifyContent: 'center',
  },
  trocoNumText: { fontSize: 13, fontWeight: '800', color: C.accent },
  trocoTitle: { fontSize: 14.5, fontWeight: '700', color: C.text },
  trocoMeta: { fontSize: 11.5, color: C.muted, marginTop: 1 },
  trocoBody: { paddingHorizontal: 13, paddingBottom: 13, gap: 8 },
  hlRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  hlText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.text2 },
  trocoActions: { flexDirection: 'row', gap: 9, marginTop: 6 },

  actionPrimary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.accent, paddingVertical: 10, borderRadius: 10,
  },
  actionPrimaryText: { fontSize: 12.5, fontWeight: '700', color: C.onAccent },
  actionGhost: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: C.accent, paddingVertical: 10, borderRadius: 10,
  },
  actionGhostText: { fontSize: 12.5, fontWeight: '700', color: C.accent },

  mustRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 11, marginBottom: 8,
  },
  kmBadge: {
    minWidth: 42, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 7,
    backgroundColor: C.accentDim, alignItems: 'center',
  },
  kmText: { fontSize: 11, fontWeight: '800', color: C.accent },
  mustName: { fontSize: 13.5, fontWeight: '700', color: C.text },
  mustSub: { fontSize: 11.5, color: C.muted, marginTop: 1 },

  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.cardAlt, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: C.accent },
  progressText: { fontSize: 12, fontWeight: '800', color: C.accent },

  stampGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stamp: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11,
  },
  stampOn: { backgroundColor: C.accent, borderColor: C.accent },
  stampText: { fontSize: 12, fontWeight: '600', color: C.text2 },
  stampTextOn: { color: C.onAccent, fontWeight: '700' },

  seal: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14,
    backgroundColor: C.accentDim, borderRadius: 12, borderWidth: 1, borderColor: C.accent,
    padding: 13,
  },
  sealText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: C.text, fontWeight: '600' },

  resetBtn: { alignSelf: 'flex-start', marginTop: 12 },
  resetText: { fontSize: 12, color: C.muted, textDecorationLine: 'underline' },

  poiRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8,
  },
  poiName: { fontSize: 13.5, fontWeight: '700', color: C.text },
  poiMeta: { fontSize: 11.5, color: C.muted, marginTop: 2 },
  moreBtn: { alignSelf: 'center', paddingVertical: 10 },
  moreText: { fontSize: 13, fontWeight: '700', color: C.accent },

  tripPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, paddingVertical: 13, borderRadius: 12,
  },
  tripPrimaryText: { fontSize: 14, fontWeight: '700', color: C.onAccent },
  tripRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
});
