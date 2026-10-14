/**
 * Destino — página pública de um município parceiro (GET /municipios/{slug}).
 * Regista uma visualização anónima (profile_view) para o painel de impacto.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/context/ThemeContext';
import { getCategories } from '../../src/services/api';
import { PUBLIC_URL } from '../../src/config/api';
import { trackImpact } from '../../src/services/impactTracking';
import {
  getPublicMunicipality,
  getApiErrorStatus,
  formatCount,
  type PublicMunicipalityResponse,
} from '../../src/services/api/municipal';

const DEFAULT_BRAND = '#2E5E4E';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const FALLBACK_OG_IMAGE = 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=1200&q=80';

function prettyCategory(id: string): string {
  const text = (id || '').replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatHours(h?: number | null): string | null {
  if (h == null || h <= 0) return null;
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${Number.isInteger(h) ? h : h.toFixed(1).replace('.', ',')} h`;
}

function SeoHead({ data, slug }: { data: PublicMunicipalityResponse; slug: string }) {
  const p = data.profile;
  const canonical = `${PUBLIC_URL}/destino/${encodeURIComponent(data.slug || slug)}`;
  const desc = (p.tagline || p.description || `Descubra ${p.display_name} no Portugal Vivo.`).slice(0, 160);
  const image = p.hero_image_url || FALLBACK_OG_IMAGE;
  const title = `${p.display_name} | Portugal Vivo`;
  const schemaOrg = {
    '@context': 'https://schema.org',
    '@type': 'TouristDestination',
    name: p.display_name,
    description: p.description || p.tagline || '',
    url: canonical,
    image,
    ...(p.website ? { sameAs: [p.website] } : {}),
    containedInPlace: { '@type': 'Country', name: 'Portugal' },
  };
  return (
    <Head>
      <title>{title}</title>
      <meta name="description" content={desc} />
      <meta property="og:title" content={p.display_name} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={canonical} />
      <meta property="og:locale" content="pt_PT" />
      <meta property="og:site_name" content="Portugal Vivo" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={p.display_name} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />
      <link rel="canonical" href={canonical} />
      <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
    </Head>
  );
}

export default function DestinoScreen() {
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>();
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['public-municipality', slug],
    queryFn: () => getPublicMunicipality(slug!),
    enabled: !!slug,
  });
  const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: getCategories });
  const categoryNames = useMemo(
    () => new Map((categories || []).map((c) => [c.id, c.name])),
    [categories],
  );

  // Anonymous profile_view — once per slug, only when the page exists
  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!slug || !data || trackedSlug.current === slug) return;
    trackedSlug.current = slug;
    trackImpact({ event_type: 'profile_view', municipality: slug });
  }, [slug, data]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/destino');
  };

  const backButton = (
    <TouchableOpacity
      style={[s.backBtn, { top: insets.top + 10 }]}
      onPress={goBack}
      accessibilityLabel="Voltar"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <MaterialIcons name="arrow-back" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );

  if (isLoading || (!data && !error)) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    const notFound = getApiErrorStatus(error) === 404;
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.background, paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <MaterialIcons name={notFound ? 'location-city' : 'cloud-off'} size={48} color={colors.textMuted} />
        <Text style={[s.stateTitle, { color: colors.textPrimary }]}>
          {notFound
            ? 'Este município ainda não tem página no Portugal Vivo'
            : 'Não foi possível carregar esta página'}
        </Text>
        {notFound ? (
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={() => router.replace('/destino')}>
            <Text style={s.btnText}>Ver municípios parceiros</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
            <Text style={s.btnText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={goBack} style={{ paddingVertical: 8 }}>
          <Text style={[s.link, { color: colors.primary }]}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const p = data.profile;
  const brand = p.brand_color && HEX_RE.test(p.brand_color) ? p.brand_color : DEFAULT_BRAND;
  const heroContent = (
    <LinearGradient
      colors={['rgba(0,0,0,0.15)', brand + 'F2']}
      locations={[0, 1]}
      style={[s.heroOverlay, { paddingTop: insets.top + 56 }]}
    >
      <View style={s.heroBottom}>
        {p.logo_url ? (
          <Image source={{ uri: p.logo_url }} style={s.logo} resizeMode="contain" />
        ) : (
          <View style={[s.logo, s.logoFallback]}>
            <MaterialIcons name="location-city" size={26} color={brand} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.heroName}>{p.display_name}</Text>
          {!!p.tagline && <Text style={s.heroTagline}>{p.tagline}</Text>}
        </View>
      </View>
    </LinearGradient>
  );

  const openUrl = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, title: p.display_name }} />
      {Platform.OS === 'web' && <SeoHead data={data} slug={slug!} />}

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        {p.hero_image_url ? (
          <ImageBackground source={{ uri: p.hero_image_url }} style={s.hero} resizeMode="cover">
            {heroContent}
          </ImageBackground>
        ) : (
          <View style={[s.hero, { backgroundColor: brand }]}>{heroContent}</View>
        )}

        <View style={s.body}>
          {/* Stats */}
          <View style={[s.statsRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
            <View style={s.stat}>
              <Text style={[s.statValue, { color: brand }]}>{formatCount(data.stats.pois)}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Locais a descobrir</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.borderLight }]} />
            <View style={s.stat}>
              <Text style={[s.statValue, { color: brand }]}>{formatCount(data.stats.audio_guides)}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Áudio-guias</Text>
            </View>
            <View style={[s.statDivider, { backgroundColor: colors.borderLight }]} />
            <View style={s.stat}>
              <Text style={[s.statValue, { color: brand }]}>{formatCount(data.featured_routes.length)}</Text>
              <Text style={[s.statLabel, { color: colors.textMuted }]}>Rotas</Text>
            </View>
          </View>

          {/* Description */}
          {!!p.description && (
            <Text style={[s.description, { color: colors.textSecondary }]}>{p.description}</Text>
          )}

          {/* Categories */}
          {data.stats.categories.length > 0 && (
            <View style={s.chips}>
              {data.stats.categories.map((c) => (
                <View key={c.category} style={[s.chip, { borderColor: brand + '55', backgroundColor: brand + '12' }]}>
                  <Text style={[s.chipText, { color: colors.textPrimary }]}>
                    {categoryNames.get(c.category) ?? prettyCategory(c.category)}
                  </Text>
                  <Text style={[s.chipCount, { color: brand }]}>{c.count}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Featured POIs */}
          {data.featured_pois.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Em destaque</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.poiRow}>
                {data.featured_pois.map((poi) => (
                  <TouchableOpacity
                    key={poi.id}
                    style={[s.poiCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                    onPress={() => router.push(`/heritage/${poi.id}`)}
                    activeOpacity={0.85}
                    accessibilityRole="link"
                    accessibilityLabel={poi.name}
                  >
                    {poi.image_url ? (
                      <Image source={{ uri: poi.image_url }} style={s.poiImage} resizeMode="cover" />
                    ) : (
                      <View style={[s.poiImage, s.poiImageFallback, { backgroundColor: brand + '22' }]}>
                        <MaterialIcons name="place" size={28} color={brand} />
                      </View>
                    )}
                    <View style={s.poiBody}>
                      <Text style={[s.poiName, { color: colors.textPrimary }]} numberOfLines={2}>{poi.name}</Text>
                      {!!poi.category && (
                        <Text style={[s.poiCat, { color: brand }]} numberOfLines={1}>
                          {categoryNames.get(poi.category) ?? prettyCategory(poi.category)}
                        </Text>
                      )}
                      {!!poi.micro_pitch && (
                        <Text style={[s.poiPitch, { color: colors.textSecondary }]} numberOfLines={3}>
                          {poi.micro_pitch}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* Featured routes */}
          {data.featured_routes.length > 0 && (
            <>
              <Text style={[s.sectionTitle, { color: colors.textPrimary }]}>Rotas sugeridas</Text>
              {data.featured_routes.map((r) => {
                const duration = formatHours(r.duration_hours);
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[s.routeCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}
                    onPress={() => router.push(`/route/${r.id}`)}
                    activeOpacity={0.85}
                    accessibilityRole="link"
                    accessibilityLabel={r.name}
                  >
                    {r.image_url ? (
                      <Image source={{ uri: r.image_url }} style={s.routeImage} resizeMode="cover" />
                    ) : (
                      <View style={[s.routeImage, s.poiImageFallback, { backgroundColor: brand + '22' }]}>
                        <MaterialIcons name="route" size={24} color={brand} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[s.routeName, { color: colors.textPrimary }]} numberOfLines={1}>{r.name}</Text>
                      {!!r.description && (
                        <Text style={[s.routeDesc, { color: colors.textSecondary }]} numberOfLines={2}>
                          {r.description}
                        </Text>
                      )}
                      {!!duration && (
                        <View style={s.routeMeta}>
                          <MaterialIcons name="schedule" size={13} color={colors.textMuted} />
                          <Text style={[s.routeMetaText, { color: colors.textMuted }]}>{duration}</Text>
                        </View>
                      )}
                    </View>
                    <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </>
          )}

          {/* Contacts */}
          {(!!p.website || !!p.contact_email) && (
            <View style={s.contactRow}>
              {!!p.website && (
                <TouchableOpacity
                  style={[s.contactBtn, { backgroundColor: brand }]}
                  onPress={() => openUrl(p.website!)}
                  accessibilityRole="link"
                >
                  <MaterialIcons name="language" size={18} color="#FFFFFF" />
                  <Text style={s.contactBtnText}>Website oficial</Text>
                </TouchableOpacity>
              )}
              {!!p.contact_email && (
                <TouchableOpacity
                  style={[s.contactBtnOutline, { borderColor: brand }]}
                  onPress={() => openUrl(`mailto:${p.contact_email}`)}
                  accessibilityRole="link"
                >
                  <MaterialIcons name="mail-outline" size={18} color={brand} />
                  <Text style={[s.contactBtnOutlineText, { color: brand }]}>Contactar</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Attribution */}
          {!data.plan_white_label && (
            <View style={[s.attribution, { borderTopColor: colors.borderLight }]}>
              <MaterialIcons name="verified" size={16} color={colors.textMuted} />
              <Text style={[s.attributionText, { color: colors.textMuted }]}>
                Página oficial do município no Portugal Vivo
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {backButton}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  backBtn: {
    position: 'absolute', left: 14, width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  hero: { minHeight: 280, width: '100%', justifyContent: 'flex-end' },
  heroOverlay: { flex: 1, justifyContent: 'flex-end' },
  heroBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20,
    width: '100%', maxWidth: 960, alignSelf: 'center',
  },
  logo: { width: 64, height: 64, borderRadius: 14, backgroundColor: '#FFFFFF' },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 28, fontWeight: '800', color: '#FFFFFF' },
  heroTagline: { fontSize: 15, color: 'rgba(255,255,255,0.92)', marginTop: 4, lineHeight: 21 },
  body: { padding: 16, width: '100%', maxWidth: 960, alignSelf: 'center' },
  statsRow: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1,
    paddingVertical: 14, marginTop: -8, marginBottom: 16,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: 1, height: 32 },
  description: { fontSize: 15, lineHeight: 23, marginBottom: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipCount: { fontSize: 12, fontWeight: '800' },
  sectionTitle: { fontSize: 19, fontWeight: '800', marginTop: 20, marginBottom: 12 },
  poiRow: { gap: 12, paddingRight: 8 },
  poiCard: { width: 220, borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  poiImage: { width: '100%', height: 130 },
  poiImageFallback: { alignItems: 'center', justifyContent: 'center' },
  poiBody: { padding: 12, gap: 4 },
  poiName: { fontSize: 15, fontWeight: '700' },
  poiCat: { fontSize: 12, fontWeight: '600' },
  poiPitch: { fontSize: 13, lineHeight: 18 },
  routeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10,
    borderRadius: 14, borderWidth: 1, marginBottom: 10,
  },
  routeImage: { width: 72, height: 72, borderRadius: 10 },
  routeName: { fontSize: 15, fontWeight: '700' },
  routeDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  routeMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  routeMetaText: { fontSize: 12 },
  contactRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 20 },
  contactBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12,
  },
  contactBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  contactBtnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5,
    borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11,
  },
  contactBtnOutlineText: { fontSize: 14, fontWeight: '700' },
  attribution: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 28, paddingTop: 16, borderTopWidth: 1,
  },
  attributionText: { fontSize: 12 },
  stateTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center', maxWidth: 420 },
  btn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  link: { fontSize: 14, fontWeight: '700' },
});
