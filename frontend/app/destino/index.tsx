/**
 * Destinos — municípios parceiros com página pública no Portugal Vivo
 * (GET /municipios).
 */
import React from 'react';
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
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../src/context/ThemeContext';
import {
  getPartnerMunicipalities,
  type PartnerMunicipality,
} from '../../src/services/api/municipal';

const DEFAULT_BRAND = '#2E5E4E';
const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
const CONTACT_EMAIL = 'municipios@portugalvivo.pt';
const isWeb = Platform.OS === 'web';

function brandOf(m: PartnerMunicipality): string {
  return m.brand_color && HEX_RE.test(m.brand_color) ? m.brand_color : DEFAULT_BRAND;
}

function MunicipalityCard({ item, onPress }: { item: PartnerMunicipality; onPress: () => void }) {
  const { colors } = useTheme();
  const brand = brandOf(item);
  const content = (
    <LinearGradient
      colors={['rgba(0,0,0,0)', brand + 'E6']}
      locations={[0.2, 1]}
      style={s.cardOverlay}
    >
      <View style={s.cardBottom}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={s.logo} resizeMode="contain" />
        ) : (
          <View style={[s.logo, s.logoFallback]}>
            <MaterialIcons name="location-city" size={20} color={brand} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={s.cardName} numberOfLines={1}>{item.display_name}</Text>
          {!!item.tagline && <Text style={s.cardTagline} numberOfLines={2}>{item.tagline}</Text>}
        </View>
        <MaterialIcons name="chevron-right" size={22} color="#FFFFFF" />
      </View>
    </LinearGradient>
  );

  return (
    <TouchableOpacity
      style={[s.card, isWeb && s.cardWeb, { backgroundColor: brand, borderColor: colors.borderLight }]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="link"
      accessibilityLabel={item.display_name}
    >
      <View style={[s.accent, { backgroundColor: brand }]} />
      {item.hero_image_url ? (
        <ImageBackground source={{ uri: item.hero_image_url }} style={s.cardImage} resizeMode="cover">
          {content}
        </ImageBackground>
      ) : (
        <View style={s.cardImage}>{content}</View>
      )}
    </TouchableOpacity>
  );
}

export default function DestinosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['partner-municipalities'],
    queryFn: getPartnerMunicipalities,
    staleTime: 1000 * 60 * 10,
  });
  const items = data?.municipalities ?? [];

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, title: t('exploreScreens.destinos.title') }} />

      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={goBack} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel={t('common.back')}>
          <MaterialIcons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[s.headerTitle, { color: colors.textPrimary }]}>{t('exploreScreens.destinos.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 32 }]}>
        <Text style={[s.intro, { color: colors.textSecondary }]}>
          {t('exploreScreens.destinos.intro')}
        </Text>

        {isLoading ? (
          <View style={s.state}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={s.state}>
            <MaterialIcons name="cloud-off" size={40} color={colors.textMuted} />
            <Text style={[s.stateTitle, { color: colors.textPrimary }]}>{t('exploreScreens.destinos.loadError')}</Text>
            <TouchableOpacity style={[s.btn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
              <Text style={s.btnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 ? (
          <View style={s.state}>
            <MaterialIcons name="location-city" size={48} color={colors.textMuted} />
            <Text style={[s.stateTitle, { color: colors.textPrimary }]}>{t('exploreScreens.destinos.emptyTitle')}</Text>
            <Text style={[s.stateText, { color: colors.textSecondary }]}>
              {t('exploreScreens.destinos.emptyText')}
            </Text>
            <TouchableOpacity
              style={[s.btnOutline, { borderColor: colors.primary }]}
              onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {})}
            >
              <Text style={[s.btnOutlineText, { color: colors.primary }]}>{t('exploreScreens.destinos.contactCta')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={s.grid}>
            {items.map((m) => (
              <MunicipalityCard
                key={m.slug}
                item={m}
                onPress={() => router.push(`/destino/${m.slug}`)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { padding: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  intro: { fontSize: 14, lineHeight: 21, marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  card: { width: '100%', borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  cardWeb: { width: undefined, flexGrow: 1, flexBasis: 320, maxWidth: 540 },
  accent: { height: 4, width: '100%' },
  cardImage: { height: 170, width: '100%', justifyContent: 'flex-end' },
  cardOverlay: { flex: 1, justifyContent: 'flex-end' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  logo: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#FFFFFF' },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  cardName: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  cardTagline: { fontSize: 13, color: 'rgba(255,255,255,0.92)', marginTop: 2 },
  state: { alignItems: 'center', paddingVertical: 56, gap: 12, paddingHorizontal: 16 },
  stateTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  stateText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  btn: { borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10 },
  btnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnOutline: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9, marginTop: 4 },
  btnOutlineText: { fontWeight: '700', fontSize: 13, textAlign: 'center' },
});
