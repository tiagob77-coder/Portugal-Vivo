/**
 * Event Detail Page
 * Shows full details for a calendar or agenda viral event
 * Dynamic route: /evento/[id]
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import Head from 'expo-router/head';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, { getAgendaEventDetail, getAgendaEventNearby, discoverNearby } from '../../src/services/api';
import { colors, shadows, fontFamilies } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';

const serif = fontFamilies.serif;

const CATEGORY_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
  festas: { icon: 'celebration', color: '#C49A6C', label: 'Festas' },
  religioso: { icon: 'church', color: '#8B5CF6', label: 'Religioso' },
  gastronomia: { icon: 'restaurant', color: '#EF4444', label: 'Gastronomia' },
  natureza: { icon: 'park', color: '#22C55E', label: 'Natureza' },
  cultural: { icon: 'theater-comedy', color: '#06B6D4', label: 'Cultural' },
  festa: { icon: 'celebration', color: '#C49A6C', label: 'Festa' },
  festival: { icon: 'music-note', color: '#EC4899', label: 'Festival' },
};

const RARITY_CONFIG: Record<string, { color: string; label: string }> = {
  epico: { color: '#EAB308', label: 'Épico' },
  raro: { color: '#8B5CF6', label: 'Raro' },
  incomum: { color: '#06B6D4', label: 'Incomum' },
  comum: { color: '#94A3B8', label: 'Comum' },
};

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa e Vale do Tejo',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

// Icons for nearby POI categories ("Explorar à volta")
const CATEGORY_ICONS: Record<string, string> = {
  miradouros: 'landscape',
  castelos: 'history-edu',
  palacios_solares: 'account-balance',
  museus: 'museum',
  praias_bandeira_azul: 'beach-access',
  praias_fluviais: 'pool',
  cascatas_pocos: 'water-drop',
  arte_urbana: 'brush',
  fauna_autoctone: 'pets',
  flora_botanica: 'local-florist',
  percursos_pedestres: 'hiking',
  mercados_feiras: 'storefront',
  igrejas_santuarios: 'church',
  barragens_albufeiras: 'waves',
};

const prettyCategory = (cat: string): string =>
  (cat || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Thematic modules to deep-link from an event
const THEMATIC_MODULES: { route: string; label: string; icon: string }[] = [
  { route: '/costa', label: 'Costa', icon: 'beach-access' },
  { route: '/gastronomia', label: 'Gastronomia', icon: 'restaurant' },
  { route: '/flora', label: 'Flora', icon: 'local-florist' },
  { route: '/fauna', label: 'Fauna', icon: 'pets' },
  { route: '/prehistoria', label: 'Pré-História', icon: 'history-edu' },
  { route: '/biodiversidade', label: 'Biodiversidade', icon: 'waves' },
];

export default function EventDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();

  // Try to fetch from the agenda event detail API
  const { data: agendaEvent, isLoading: agendaLoading } = useQuery({
    queryKey: ['agenda-event-detail', id],
    queryFn: () => getAgendaEventDetail(id!),
    enabled: !!id,
  });

  // Also try to fetch from calendar events (legacy)
  const { data: calendarEvents, isLoading: calendarLoading } = useQuery({
    queryKey: ['calendar-event-lookup', id],
    queryFn: async () => {
      const response = await api.get('/calendar');
      const events = response.data as any[];
      return events.find((e: any) => e.id === id) || null;
    },
    enabled: !!id && !agendaEvent,
  });

  const isLoading = agendaLoading && calendarLoading;
  const event = agendaEvent || calendarEvents;

  // "Como chegar" — nearby public transport (only for agenda events with coords)
  const { data: nearby } = useQuery({
    queryKey: ['agenda-event-nearby', id],
    queryFn: () => getAgendaEventNearby(id!),
    enabled: !!id && !!agendaEvent,
    staleTime: 1000 * 60 * 30,
  });
  const transportStops = nearby?.available ? nearby.transport_stops : [];
  const transportOperators = nearby?.available ? nearby.operators : [];

  // "Explorar à volta" — thematic POIs near the event (reuses explore-nearby engine)
  const coords = nearby?.coordinates;
  const { data: around } = useQuery({
    queryKey: ['event-around', coords?.lat, coords?.lng],
    queryFn: () => discoverNearby(coords!.lat, coords!.lng, 15, 12),
    enabled: !!coords,
    staleTime: 1000 * 60 * 30,
  });
  const aroundPois = around?.pois || [];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: tc.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color="#C49A6C" />
        <Text style={styles.loadingText}>A carregar evento...</Text>
      </View>
    );
  }

  if (!event) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: tc.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <MaterialIcons name="event-busy" size={64} color="#94A3B8" />
        <Text style={styles.errorTitle}>Evento não encontrado</Text>
        <Text style={styles.errorSubtitle}>O evento pode ter sido removido ou o link está incorreto.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={18} color="#FFF" />
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const category = event.category || event.type || 'festas';
  const catConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.festas;
  const rarity = event.rarity || 'comum';
  const rarityConfig = RARITY_CONFIG[rarity] || RARITY_CONFIG.comum;
  const regionName = REGION_NAMES[(event.region || '').toLowerCase()] || event.region || '';

  const eventCanonical = `https://portugal-vivo.app/evento/${id}`;
  const eventDesc = event.description ? event.description.slice(0, 160) : `${catConfig.label} — ${event.name} em ${regionName || 'Portugal'}`;
  const eventTitle = `${event.name} — ${catConfig.label} em ${regionName || 'Portugal'} | Portugal Vivo`;
  const eventSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description || '',
    url: eventCanonical,
    inLanguage: ['pt-PT', 'en'],
    eventStatus: 'https://schema.org/EventScheduled',
    ...(event.start_date ? { startDate: event.start_date } : {}),
    ...(event.end_date ? { endDate: event.end_date } : {}),
    ...(regionName ? { location: { '@type': 'Place', address: { '@type': 'PostalAddress', addressRegion: regionName, addressCountry: 'PT' } } } : {}),
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {Platform.OS === 'web' && (
        <Head>
          <title>{eventTitle}</title>
          <meta name="description" content={eventDesc} />
          <meta property="og:title" content={event.name} />
          <meta property="og:description" content={eventDesc} />
          <meta property="og:type" content="article" />
          <meta property="og:url" content={eventCanonical} />
          <meta property="og:locale" content="pt_PT" />
          <meta property="og:site_name" content="Portugal Vivo" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={event.name} />
          <meta name="twitter:description" content={eventDesc} />
          <link rel="canonical" href={eventCanonical} />
          <link rel="alternate" hreflang="pt" href={eventCanonical} />
          <link rel="alternate" hreflang="en" href={`https://portugal-vivo.app/en/evento/${id}`} />
          <script type="application/ld+json">{JSON.stringify(eventSchema)}</script>
        </Head>
      )}

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerBarTitle} numberOfLines={1}>Evento</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={[styles.heroSection, { backgroundColor: catConfig.color + '15' }]}>
          <View style={[styles.heroIcon, { backgroundColor: catConfig.color + '25' }]}>
            <MaterialIcons name={catConfig.icon as any} size={48} color={catConfig.color} />
          </View>
          <Text style={styles.heroTitle}>{event.name}</Text>
          <View style={styles.heroBadges}>
            <View style={[styles.badge, { backgroundColor: catConfig.color }]}>
              <MaterialIcons name={catConfig.icon as any} size={12} color="#FFF" />
              <Text style={styles.badgeText}>{catConfig.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: rarityConfig.color }]}>
              <Text style={styles.badgeText}>{rarityConfig.label}</Text>
            </View>
            {event.source && event.source !== 'curated' && (
              <View style={[styles.badge, { backgroundColor: '#06B6D4' }]}>
                <Text style={styles.badgeText}>{event.source}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Info Cards */}
        <View style={styles.infoSection}>
          {/* Date */}
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: '#C49A6C20' }]}>
              <MaterialIcons name="event" size={22} color="#C49A6C" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Data</Text>
              <Text style={styles.infoValue}>
                {event.date_text || `${event.date_start} — ${event.date_end}`}
              </Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.infoCard}>
            <View style={[styles.infoIcon, { backgroundColor: '#22C55E20' }]}>
              <MaterialIcons name="location-on" size={22} color="#22C55E" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Localização</Text>
              <Text style={styles.infoValue}>
                {event.concelho ? `${event.concelho}, ` : ''}{regionName}
              </Text>
            </View>
          </View>

          {/* Price (if available) */}
          {event.price && (
            <View style={styles.infoCard}>
              <View style={[styles.infoIcon, { backgroundColor: '#8B5CF620' }]}>
                <MaterialIcons name="euro" size={22} color="#8B5CF6" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Preço</Text>
                <Text style={styles.infoValue}>{event.price}</Text>
              </View>
            </View>
          )}

          {/* Capacity (if available) */}
          {event.capacity && (
            <View style={styles.infoCard}>
              <View style={[styles.infoIcon, { backgroundColor: '#EC489920' }]}>
                <MaterialIcons name="people" size={22} color="#EC4899" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Capacidade</Text>
                <Text style={styles.infoValue}>{event.capacity} pessoas</Text>
              </View>
            </View>
          )}

          {/* Genres (if available) */}
          {event.genres && (
            <View style={styles.infoCard}>
              <View style={[styles.infoIcon, { backgroundColor: '#EAB30820' }]}>
                <MaterialIcons name="music-note" size={22} color="#EAB308" />
              </View>
              <View style={styles.infoContent}>
                <Text style={styles.infoLabel}>Géneros</Text>
                <Text style={styles.infoValue}>{event.genres}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>Descrição</Text>
          <Text style={styles.descriptionText}>
            {event.description || 'Sem descrição disponível.'}
          </Text>
        </View>

        {/* Como chegar */}
        {(transportStops.length > 0 || transportOperators.length > 0) && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Como chegar</Text>
            {transportStops.map((stop) => {
              const isTrain = stop.transport_type === 'train';
              const tint = isTrain ? '#22C55E' : '#06B6D4';
              return (
                <View key={stop.id} style={styles.infoCard}>
                  <View style={[styles.infoIcon, { backgroundColor: tint + '20' }]}>
                    <MaterialIcons name={isTrain ? 'train' : 'subway'} size={22} color={tint} />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoValue}>{stop.name}</Text>
                    <Text style={styles.transportSub}>
                      {stop.operator}{stop.line ? ` · ${stop.line}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.transportDistance}>
                    {stop.distance_m < 1000 ? `${stop.distance_m} m` : `${stop.distance_km} km`}
                  </Text>
                </View>
              );
            })}
            {transportOperators.length > 0 && (
              <View style={styles.operatorChips}>
                {transportOperators.map((op, i) => (
                  <TouchableOpacity
                    key={`${op.name}-${i}`}
                    style={styles.operatorChip}
                    disabled={!op.website}
                    onPress={() => op.website && Linking.openURL(op.website)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons name="directions-bus" size={13} color="#C49A6C" />
                    <Text style={styles.operatorChipText}>{op.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Explorar à volta — nearby thematic POIs */}
        {aroundPois.length > 0 && (
          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Explorar à volta</Text>
            <Text style={styles.aroundSubtitle}>Pontos de interesse perto deste evento</Text>
            {aroundPois.slice(0, 6).map((poi) => (
              <TouchableOpacity
                key={poi.id}
                style={styles.infoCard}
                onPress={() => router.push(`/heritage/${poi.id}`)}
                activeOpacity={0.7}
              >
                <View style={[styles.infoIcon, { backgroundColor: '#2E5E4E20' }]}>
                  <MaterialIcons name={(CATEGORY_ICONS[poi.category] || 'place') as any} size={22} color="#2E5E4E" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoValue} numberOfLines={1}>{poi.name}</Text>
                  <Text style={styles.transportSub}>{prettyCategory(poi.category)}</Text>
                </View>
                <Text style={styles.transportDistance}>
                  {poi.distance_km < 1 ? `${poi.distance_m} m` : `${poi.distance_km} km`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Temas para explorar — thematic module shortcuts */}
        <View style={styles.descriptionSection}>
          <Text style={styles.sectionTitle}>Temas para explorar</Text>
          <View style={styles.operatorChips}>
            {THEMATIC_MODULES.map((m) => (
              <TouchableOpacity
                key={m.route}
                style={styles.themeChip}
                onPress={() => router.push(m.route as any)}
                activeOpacity={0.7}
              >
                <MaterialIcons name={m.icon as any} size={14} color="#2E5E4E" />
                <Text style={styles.themeChipText}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsSection}>
          {/* Ticket button */}
          {(event.has_tickets || event.ticket_url) && event.ticket_url && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#7C3AED' }]}
              onPress={() => Linking.openURL(event.ticket_url)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="confirmation-number" size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>Comprar Bilhetes</Text>
            </TouchableOpacity>
          )}

          {/* Search on Ticketline */}
          {!event.ticket_url && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: '#C49A6C' }]}
              onPress={() => Linking.openURL(`https://ticketline.sapo.pt/pesquisa?q=${encodeURIComponent(event.name)}`)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="search" size={20} color="#FFF" />
              <Text style={styles.actionButtonText}>Procurar Bilhetes</Text>
            </TouchableOpacity>
          )}

          {/* Share button */}
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.background.secondary }]}
            onPress={() => {
              const text = `${event.name} - ${event.date_text || event.date_start}\n${event.description || ''}`;
              if (Platform.OS === 'web') {
                if (navigator.clipboard) navigator.clipboard.writeText(text);
              } else {
                const Share = require('react-native').Share; // eslint-disable-line @typescript-eslint/no-require-imports
                Share.share({ message: text });
              }
            }}
            activeOpacity={0.8}
          >
            <MaterialIcons name="share" size={20} color={colors.gray[700]} />
            <Text style={[styles.actionButtonText, { color: colors.gray[700] }]}>Partilhar</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[700],
    marginTop: 8,
  },
  errorSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    textAlign: 'center',
    paddingHorizontal: 40,
    marginTop: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#C49A6C',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 20,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  headerBarTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray[800],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray[800],
    textAlign: 'center',
    fontFamily: serif,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
    textTransform: 'capitalize',
  },
  infoSection: {
    paddingHorizontal: 20,
    gap: 8,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    ...shadows.sm,
  },
  infoIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[800],
    marginTop: 2,
  },
  descriptionSection: {
    paddingHorizontal: 20,
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 8,
    fontFamily: serif,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.gray[600],
  },
  transportSub: {
    fontSize: 12,
    color: colors.gray[500],
    marginTop: 2,
  },
  transportDistance: {
    fontSize: 13,
    fontWeight: '700',
    color: '#C49A6C',
  },
  operatorChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  operatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(196,154,108,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  operatorChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C49A6C',
  },
  aroundSubtitle: {
    fontSize: 13,
    color: colors.gray[500],
    marginTop: -4,
    marginBottom: 10,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(46,94,78,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  themeChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2E5E4E',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    ...shadows.sm,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFF',
  },
});
