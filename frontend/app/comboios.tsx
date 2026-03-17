/**
 * CP Comboios e Ligacoes - Transportes Ferroviarios, Metro e Ferries
 * Pagina completa de mobilidade em Portugal
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, TextInput, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, borders, shadows } from '../src/theme';
import { useTheme } from '../src/context/ThemeContext';
import api from '../src/services/api';

// Transport type colors
const TRANSPORT_COLORS = {
  train: '#2563EB',
  metro: '#DC2626',
  ferry: '#0891B2',
  card: '#059669',
};

// Metro line color mapping
const METRO_LINE_COLORS: Record<string, string> = {
  azul: '#0060AA',
  amarela: '#FECC00',
  verde: '#00843D',
  vermelha: '#E0242E',
};

type ActiveTab = 'pesquisa' | 'rotas' | 'metro' | 'ferries' | 'cartoes';

export default function ComboiosScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>('rotas');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [searchTriggered, setSearchTriggered] = useState(false);

  // ---- Data fetching ----
  const { data: routesData, isLoading: routesLoading } = useQuery({
    queryKey: ['cp-routes'],
    queryFn: async () => { const res = await api.get('/cp/routes'); return res.data; },
  });

  const { data: metroLines, isLoading: metroLoading } = useQuery({
    queryKey: ['metro-lines'],
    queryFn: async () => { const res = await api.get('/mobility/metro/lines'); return res.data; },
  });

  const { data: metroStations } = useQuery({
    queryKey: ['metro-stations'],
    queryFn: async () => { const res = await api.get('/mobility/metro/stations'); return res.data; },
  });

  const { data: ferriesData, isLoading: ferriesLoading } = useQuery({
    queryKey: ['ferries'],
    queryFn: async () => { const res = await api.get('/mobility/ferries'); return res.data; },
  });

  const { data: cardsData, isLoading: cardsLoading } = useQuery({
    queryKey: ['cp-cards'],
    queryFn: async () => { const res = await api.get('/cp/cards'); return res.data; },
  });

  const { data: searchResults, isLoading: searchLoading, refetch: refetchSearch } = useQuery({
    queryKey: ['cp-search', origin, destination],
    queryFn: async () => {
      if (!origin.trim() || !destination.trim()) return null;
      const res = await api.get('/cp/search', { params: { origin: origin.trim(), destination: destination.trim() } });
      return res.data;
    },
    enabled: searchTriggered && !!origin.trim() && !!destination.trim(),
  });

  const routes = routesData?.routes || routesData || [];
  const metro = metroLines?.lines || metroLines || [];
  const ferries = ferriesData?.routes || ferriesData || [];
  const cards = cardsData?.cards || cardsData || [];
  const connections = searchResults?.connections || searchResults?.results || searchResults || [];

  const handleSearch = () => {
    if (origin.trim() && destination.trim()) {
      setSearchTriggered(true);
      setActiveTab('pesquisa');
      refetchSearch();
    }
  };

  const TABS: { id: ActiveTab; label: string; icon: string; color: string }[] = [
    { id: 'pesquisa', label: 'Pesquisa', icon: 'search', color: TRANSPORT_COLORS.train },
    { id: 'rotas', label: 'Rotas CP', icon: 'train', color: TRANSPORT_COLORS.train },
    { id: 'metro', label: 'Metro', icon: 'subway', color: TRANSPORT_COLORS.metro },
    { id: 'ferries', label: 'Ferries', icon: 'directions-boat', color: TRANSPORT_COLORS.ferry },
    { id: 'cartoes', label: 'Cartoes', icon: 'credit-card', color: TRANSPORT_COLORS.card },
  ];

  // ---- Render helpers ----

  const renderSearchSection = () => (
    <View style={styles.sectionContainer}>
      {/* Search inputs */}
      <View style={styles.searchCard}>
        <View style={styles.searchHeader}>
          <MaterialIcons name="swap-vert" size={24} color={TRANSPORT_COLORS.train} />
          <Text style={styles.searchTitle}>Pesquisar Ligacoes</Text>
        </View>
        <View style={styles.searchInputRow}>
          <View style={[styles.searchDot, { backgroundColor: '#22C55E' }]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Origem (ex: Lisboa)"
            placeholderTextColor={colors.gray[400]}
            value={origin}
            onChangeText={(t) => { setOrigin(t); setSearchTriggered(false); }}
          />
        </View>
        <View style={styles.searchDivider} />
        <View style={styles.searchInputRow}>
          <View style={[styles.searchDot, { backgroundColor: TRANSPORT_COLORS.train }]} />
          <TextInput
            style={styles.searchInput}
            placeholder="Destino (ex: Porto)"
            placeholderTextColor={colors.gray[400]}
            value={destination}
            onChangeText={(t) => { setDestination(t); setSearchTriggered(false); }}
          />
        </View>
        <TouchableOpacity
          style={[styles.searchButton, (!origin.trim() || !destination.trim()) && styles.searchButtonDisabled]}
          onPress={handleSearch}
          disabled={!origin.trim() || !destination.trim()}
          activeOpacity={0.8}
        >
          <MaterialIcons name="search" size={20} color="#FFF" />
          <Text style={styles.searchButtonText}>Pesquisar</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {searchLoading && (
        <ActivityIndicator size="large" color={TRANSPORT_COLORS.train} style={{ marginTop: 30 }} />
      )}
      {searchTriggered && !searchLoading && Array.isArray(connections) && connections.length > 0 && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>
            {connections.length} ligacao(oes) encontrada(s)
          </Text>
          {connections.map((conn: any, idx: number) => (
            <View key={idx} style={styles.connectionCard}>
              <View style={styles.connectionHeader}>
                <View style={styles.connectionRoute}>
                  <Text style={styles.connectionOrigin}>{conn.origin || origin}</Text>
                  <MaterialIcons name="arrow-forward" size={16} color={colors.gray[400]} />
                  <Text style={styles.connectionDest}>{conn.destination || destination}</Text>
                </View>
                {conn.train_type && (
                  <View style={[styles.trainTypeBadge, { backgroundColor: TRANSPORT_COLORS.train + '15' }]}>
                    <Text style={[styles.trainTypeText, { color: TRANSPORT_COLORS.train }]}>{conn.train_type}</Text>
                  </View>
                )}
              </View>
              <View style={styles.connectionDetails}>
                {conn.departure && (
                  <View style={styles.connectionDetail}>
                    <MaterialIcons name="schedule" size={14} color={colors.gray[500]} />
                    <Text style={styles.connectionDetailText}>{conn.departure} - {conn.arrival || '?'}</Text>
                  </View>
                )}
                {conn.duration && (
                  <View style={styles.connectionDetail}>
                    <MaterialIcons name="timer" size={14} color={colors.gray[500]} />
                    <Text style={styles.connectionDetailText}>{conn.duration}</Text>
                  </View>
                )}
                {conn.price && (
                  <View style={styles.connectionDetail}>
                    <MaterialIcons name="euro" size={14} color={TRANSPORT_COLORS.card} />
                    <Text style={[styles.connectionDetailText, { color: TRANSPORT_COLORS.card, fontWeight: '700' }]}>{conn.price}</Text>
                  </View>
                )}
              </View>
              {conn.stops && (
                <View style={styles.connectionStops}>
                  <MaterialIcons name="linear-scale" size={14} color={colors.gray[400]} />
                  <Text style={styles.connectionStopsText}>{conn.stops} paragem(ns)</Text>
                </View>
              )}
            </View>
          ))}
        </View>
      )}
      {searchTriggered && !searchLoading && Array.isArray(connections) && connections.length === 0 && (
        <View style={styles.emptyState}>
          <MaterialIcons name="search-off" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyStateText}>Nenhuma ligacao encontrada</Text>
          <Text style={styles.emptyStateSubtext}>Tente outros nomes de estacao</Text>
        </View>
      )}
    </View>
  );

  const renderRoutesSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name="train" size={22} color={TRANSPORT_COLORS.train} />
        <Text style={styles.sectionTitle}>Rotas CP - Comboios de Portugal</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Principais linhas ferroviarias nacionais e regionais
      </Text>
      {routesLoading ? (
        <ActivityIndicator size="large" color={TRANSPORT_COLORS.train} style={{ marginTop: 30 }} />
      ) : Array.isArray(routes) && routes.length > 0 ? (
        routes.map((route: any, idx: number) => {
          const isScenic = route.scenic || route.name?.toLowerCase().includes('douro')
            || route.name?.toLowerCase().includes('vouga');
          return (
            <TouchableOpacity
              key={route.id || idx}
              style={[styles.routeCard, isScenic && styles.routeCardScenic]}
              activeOpacity={0.85}
              onPress={() => route.id && api.get(`/cp/route/${route.id}`).catch(() => {})}
            >
              {isScenic && (
                <View style={styles.scenicBadge}>
                  <MaterialIcons name="landscape" size={12} color="#D97706" />
                  <Text style={styles.scenicBadgeText}>Rota Cenica</Text>
                </View>
              )}
              <View style={styles.routeHeader}>
                <View style={[styles.routeIcon, { backgroundColor: TRANSPORT_COLORS.train + '12' }]}>
                  <MaterialIcons name="train" size={22} color={TRANSPORT_COLORS.train} />
                </View>
                <View style={styles.routeHeaderText}>
                  <Text style={styles.routeName}>{route.name || route.route_name || 'Rota'}</Text>
                  {route.type && (
                    <Text style={styles.routeType}>{route.type}</Text>
                  )}
                </View>
              </View>
              {(route.origin || route.from) && (
                <View style={styles.routeStopsRow}>
                  <View style={[styles.routeStopDot, { backgroundColor: '#22C55E' }]} />
                  <Text style={styles.routeStopText}>{route.origin || route.from}</Text>
                  <MaterialIcons name="arrow-forward" size={14} color={colors.gray[300]} />
                  <View style={[styles.routeStopDot, { backgroundColor: TRANSPORT_COLORS.train }]} />
                  <Text style={styles.routeStopText}>{route.destination || route.to}</Text>
                </View>
              )}
              <View style={styles.routeMeta}>
                {route.duration && (
                  <View style={styles.routeMetaItem}>
                    <MaterialIcons name="timer" size={13} color={colors.gray[500]} />
                    <Text style={styles.routeMetaText}>{route.duration}</Text>
                  </View>
                )}
                {route.price && (
                  <View style={styles.routeMetaItem}>
                    <MaterialIcons name="euro" size={13} color={TRANSPORT_COLORS.card} />
                    <Text style={[styles.routeMetaText, { color: TRANSPORT_COLORS.card, fontWeight: '700' }]}>
                      {typeof route.price === 'object' ? `${route.price.min || ''}–${route.price.max || ''}` : route.price}
                    </Text>
                  </View>
                )}
                {route.frequency && (
                  <View style={styles.routeMetaItem}>
                    <MaterialIcons name="repeat" size={13} color={colors.gray[500]} />
                    <Text style={styles.routeMetaText}>{route.frequency}</Text>
                  </View>
                )}
                {route.departures && (
                  <View style={styles.routeMetaItem}>
                    <MaterialIcons name="schedule" size={13} color={colors.gray[500]} />
                    <Text style={styles.routeMetaText}>
                      {Array.isArray(route.departures) ? route.departures.slice(0, 3).join(', ') : route.departures}
                    </Text>
                  </View>
                )}
              </View>
              {route.description && (
                <Text style={styles.routeDescription} numberOfLines={2}>{route.description}</Text>
              )}
            </TouchableOpacity>
          );
        })
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="train" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyStateText}>Sem rotas disponiveis</Text>
        </View>
      )}
    </View>
  );

  const renderMetroSection = () => {
    const stations = metroStations?.stations || metroStations || [];
    return (
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="subway" size={22} color={TRANSPORT_COLORS.metro} />
          <Text style={styles.sectionTitle}>Metro de Lisboa</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          4 linhas, {Array.isArray(stations) ? stations.length : '55+'} estacoes
        </Text>

        {/* Metro info card */}
        <View style={styles.metroInfoCard}>
          <View style={styles.metroInfoRow}>
            <MaterialIcons name="schedule" size={16} color={TRANSPORT_COLORS.metro} />
            <Text style={styles.metroInfoText}>Horario: 06:30 - 01:00 (diariamente)</Text>
          </View>
          <View style={styles.metroInfoRow}>
            <MaterialIcons name="euro" size={16} color={TRANSPORT_COLORS.card} />
            <Text style={styles.metroInfoText}>Bilhete simples: 1,65 (com Viva Viagem)</Text>
          </View>
          <View style={styles.metroInfoRow}>
            <MaterialIcons name="access-time" size={16} color={colors.gray[500]} />
            <Text style={styles.metroInfoText}>Frequencia: 4-8 min (ponta) / 6-12 min</Text>
          </View>
        </View>

        {metroLoading ? (
          <ActivityIndicator size="large" color={TRANSPORT_COLORS.metro} style={{ marginTop: 30 }} />
        ) : Array.isArray(metro) && metro.length > 0 ? (
          metro.map((line: any, idx: number) => {
            const lineColor = METRO_LINE_COLORS[line.name?.toLowerCase()] || line.color || TRANSPORT_COLORS.metro;
            return (
              <View key={line.id || idx} style={styles.metroLineCard}>
                <View style={styles.metroLineHeader}>
                  <View style={[styles.metroLineIndicator, { backgroundColor: lineColor }]} />
                  <View style={styles.metroLineHeaderText}>
                    <Text style={styles.metroLineName}>Linha {line.name || line.line_name}</Text>
                    {line.terminal_a && line.terminal_b && (
                      <Text style={styles.metroLineTerminals}>
                        {line.terminal_a} - {line.terminal_b}
                      </Text>
                    )}
                  </View>
                  {line.station_count && (
                    <View style={styles.metroStationCount}>
                      <Text style={styles.metroStationCountText}>{line.station_count}</Text>
                      <Text style={styles.metroStationCountLabel}>est.</Text>
                    </View>
                  )}
                </View>
                {line.operating_hours && (
                  <View style={styles.metroLineDetail}>
                    <MaterialIcons name="schedule" size={12} color={colors.gray[500]} />
                    <Text style={styles.metroLineDetailText}>{line.operating_hours}</Text>
                  </View>
                )}
                {line.transfers && Array.isArray(line.transfers) && (
                  <View style={styles.metroLineDetail}>
                    <MaterialIcons name="swap-horiz" size={12} color={colors.gray[500]} />
                    <Text style={styles.metroLineDetailText}>
                      Transbordos: {line.transfers.join(', ')}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="subway" size={48} color={colors.gray[300]} />
            <Text style={styles.emptyStateText}>Dados do metro indisponiveis</Text>
          </View>
        )}
      </View>
    );
  };

  const renderFerriesSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name="directions-boat" size={22} color={TRANSPORT_COLORS.ferry} />
        <Text style={styles.sectionTitle}>Ferries - Transtejo / Soflusa</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Ligacoes fluviais no Tejo entre Lisboa e a Margem Sul
      </Text>

      {ferriesLoading ? (
        <ActivityIndicator size="large" color={TRANSPORT_COLORS.ferry} style={{ marginTop: 30 }} />
      ) : Array.isArray(ferries) && ferries.length > 0 ? (
        ferries.map((ferry: any, idx: number) => (
          <View key={ferry.id || idx} style={styles.ferryCard}>
            <View style={styles.ferryHeader}>
              <View style={[styles.ferryIcon, { backgroundColor: TRANSPORT_COLORS.ferry + '12' }]}>
                <MaterialIcons name="directions-boat" size={20} color={TRANSPORT_COLORS.ferry} />
              </View>
              <View style={styles.ferryHeaderText}>
                <Text style={styles.ferryName}>
                  {ferry.name || `${ferry.origin || ferry.from} - ${ferry.destination || ferry.to}`}
                </Text>
                {ferry.operator && (
                  <Text style={styles.ferryOperator}>{ferry.operator}</Text>
                )}
              </View>
              {ferry.price && (
                <View style={styles.ferryPrice}>
                  <Text style={styles.ferryPriceText}>
                    {typeof ferry.price === 'object' ? ferry.price.single || ferry.price.adult : ferry.price}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.ferryMeta}>
              {ferry.duration && (
                <View style={styles.ferryMetaItem}>
                  <MaterialIcons name="timer" size={13} color={colors.gray[500]} />
                  <Text style={styles.ferryMetaText}>{ferry.duration}</Text>
                </View>
              )}
              {ferry.frequency && (
                <View style={styles.ferryMetaItem}>
                  <MaterialIcons name="repeat" size={13} color={colors.gray[500]} />
                  <Text style={styles.ferryMetaText}>{ferry.frequency}</Text>
                </View>
              )}
              {ferry.schedule && (
                <View style={styles.ferryMetaItem}>
                  <MaterialIcons name="schedule" size={13} color={colors.gray[500]} />
                  <Text style={styles.ferryMetaText}>
                    {typeof ferry.schedule === 'string' ? ferry.schedule : `${ferry.schedule.first || ''} - ${ferry.schedule.last || ''}`}
                  </Text>
                </View>
              )}
            </View>
            {ferry.tip && (
              <View style={styles.ferryTip}>
                <MaterialIcons name="lightbulb" size={12} color="#C49A6C" />
                <Text style={styles.ferryTipText}>{ferry.tip}</Text>
              </View>
            )}
          </View>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="directions-boat" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyStateText}>Dados de ferries indisponiveis</Text>
        </View>
      )}
    </View>
  );

  const renderCardsSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <MaterialIcons name="credit-card" size={22} color={TRANSPORT_COLORS.card} />
        <Text style={styles.sectionTitle}>Cartoes e Passes</Text>
      </View>
      <Text style={styles.sectionSubtitle}>
        Navegante, Andante, CP Card e outros titulos de transporte
      </Text>

      {cardsLoading ? (
        <ActivityIndicator size="large" color={TRANSPORT_COLORS.card} style={{ marginTop: 30 }} />
      ) : Array.isArray(cards) && cards.length > 0 ? (
        cards.map((card: any, idx: number) => (
          <TouchableOpacity
            key={card.id || idx}
            style={styles.travelCard}
            onPress={() => card.website && Linking.openURL(card.website)}
            activeOpacity={0.85}
          >
            <View style={styles.travelCardHeader}>
              <View style={[styles.travelCardIcon, { backgroundColor: TRANSPORT_COLORS.card }]}>
                <MaterialIcons name="credit-card" size={20} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.travelCardName}>{card.name}</Text>
                {card.city_zone && (
                  <Text style={styles.travelCardZone}>{card.city_zone}</Text>
                )}
                {card.region && (
                  <Text style={styles.travelCardZone}>{card.region}</Text>
                )}
              </View>
              {(card.price || card.base_price) && (
                <View style={styles.travelCardPrice}>
                  <Text style={styles.travelCardPriceText}>{card.price || card.base_price}</Text>
                </View>
              )}
            </View>
            {card.description && (
              <Text style={styles.travelCardDesc} numberOfLines={2}>{card.description}</Text>
            )}
            <View style={styles.travelCardMeta}>
              {card.where_to_buy && (
                <View style={styles.travelCardMetaItem}>
                  <MaterialIcons name="store" size={12} color={colors.gray[500]} />
                  <Text style={styles.travelCardMetaText}>{card.where_to_buy}</Text>
                </View>
              )}
              {card.validity && (
                <View style={styles.travelCardMetaItem}>
                  <MaterialIcons name="event" size={12} color={colors.gray[500]} />
                  <Text style={styles.travelCardMetaText}>Validade: {card.validity}</Text>
                </View>
              )}
              {card.includes && (
                <View style={styles.travelCardMetaItem}>
                  <MaterialIcons name="check-circle" size={12} color={TRANSPORT_COLORS.card} />
                  <Text style={styles.travelCardMetaText}>
                    {Array.isArray(card.includes) ? card.includes.join(', ') : card.includes}
                  </Text>
                </View>
              )}
            </View>
            {card.tip && (
              <View style={styles.travelCardTip}>
                <MaterialIcons name="lightbulb" size={12} color="#C49A6C" />
                <Text style={styles.travelCardTipText}>{card.tip}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))
      ) : (
        <View style={styles.emptyState}>
          <MaterialIcons name="credit-card" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyStateText}>Dados de cartoes indisponiveis</Text>
        </View>
      )}
    </View>
  );

  const renderActiveSection = () => {
    switch (activeTab) {
      case 'pesquisa': return renderSearchSection();
      case 'rotas': return renderRoutesSection();
      case 'metro': return renderMetroSection();
      case 'ferries': return renderFerriesSection();
      case 'cartoes': return renderCardsSection();
      default: return renderRoutesSection();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-back" size={22} color={colors.gray[700]} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Comboios e Ligacoes</Text>
            <Text style={styles.headerSubtitle}>
              Comboios, Metro, Ferries e Cartoes
            </Text>
          </View>
        </View>

        {/* Quick Search Bar (always visible) */}
        <View style={styles.quickSearch}>
          <View style={styles.quickSearchInputs}>
            <TextInput
              style={styles.quickSearchInput}
              placeholder="De..."
              placeholderTextColor={colors.gray[400]}
              value={origin}
              onChangeText={(t) => { setOrigin(t); setSearchTriggered(false); }}
            />
            <MaterialIcons name="arrow-forward" size={18} color={TRANSPORT_COLORS.train} />
            <TextInput
              style={styles.quickSearchInput}
              placeholder="Para..."
              placeholderTextColor={colors.gray[400]}
              value={destination}
              onChangeText={(t) => { setDestination(t); setSearchTriggered(false); }}
            />
          </View>
          <TouchableOpacity
            style={styles.quickSearchBtn}
            onPress={handleSearch}
            disabled={!origin.trim() || !destination.trim()}
          >
            <MaterialIcons name="search" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Tab Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContent}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabChip, isActive && { backgroundColor: tab.color }]}
                onPress={() => setActiveTab(tab.id)}
              >
                <MaterialIcons
                  name={tab.icon as any}
                  size={16}
                  color={isActive ? '#FFF' : tab.color}
                />
                <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stats Summary */}
        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <View style={[styles.statIconCircle, { backgroundColor: TRANSPORT_COLORS.train + '15' }]}>
              <MaterialIcons name="train" size={18} color={TRANSPORT_COLORS.train} />
            </View>
            <Text style={styles.statCount}>{Array.isArray(routes) ? routes.length : 0}</Text>
            <Text style={styles.statLabel}>Rotas</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIconCircle, { backgroundColor: TRANSPORT_COLORS.metro + '15' }]}>
              <MaterialIcons name="subway" size={18} color={TRANSPORT_COLORS.metro} />
            </View>
            <Text style={styles.statCount}>{Array.isArray(metro) ? metro.length : 4}</Text>
            <Text style={styles.statLabel}>Linhas</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIconCircle, { backgroundColor: TRANSPORT_COLORS.ferry + '15' }]}>
              <MaterialIcons name="directions-boat" size={18} color={TRANSPORT_COLORS.ferry} />
            </View>
            <Text style={styles.statCount}>{Array.isArray(ferries) ? ferries.length : 0}</Text>
            <Text style={styles.statLabel}>Ferries</Text>
          </View>
          <View style={styles.statItem}>
            <View style={[styles.statIconCircle, { backgroundColor: TRANSPORT_COLORS.card + '15' }]}>
              <MaterialIcons name="credit-card" size={18} color={TRANSPORT_COLORS.card} />
            </View>
            <Text style={styles.statCount}>{Array.isArray(cards) ? cards.length : 0}</Text>
            <Text style={styles.statLabel}>Cartoes</Text>
          </View>
        </View>

        {/* Active Section Content */}
        {renderActiveSection()}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background.tertiary, alignItems: 'center', justifyContent: 'center' },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.gray[900] },
  headerSubtitle: { fontSize: typography.fontSize.sm, color: colors.gray[500], marginTop: 2 },

  // Quick Search
  quickSearch: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 8, gap: 8, ...shadows.md },
  quickSearchInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  quickSearchInput: { flex: 1, fontSize: typography.fontSize.base, color: colors.gray[800], paddingHorizontal: 12, paddingVertical: 8 },
  quickSearchBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: TRANSPORT_COLORS.train, alignItems: 'center', justifyContent: 'center' },

  // Tabs
  tabsScroll: { marginTop: 16 },
  tabsContent: { paddingHorizontal: 20, gap: 8 },
  tabChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.background.tertiary, gap: 6 },
  tabChipText: { fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.gray[600] },
  tabChipTextActive: { color: '#FFF' },

  // Stats
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginTop: 16, padding: 16, backgroundColor: '#FFF', borderRadius: borders.radius.xl, ...shadows.sm },
  statItem: { alignItems: 'center', gap: 4 },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statCount: { fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.gray[800] },
  statLabel: { fontSize: 10, color: colors.gray[500], fontWeight: '600' },

  // Sections
  sectionContainer: { paddingHorizontal: 20, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.gray[900], flex: 1 },
  sectionSubtitle: { fontSize: typography.fontSize.sm, color: colors.gray[500], marginTop: 4, marginBottom: 16 },

  // Search Section
  searchCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 20, ...shadows.md },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  searchTitle: { fontSize: typography.fontSize.lg, fontWeight: '700', color: colors.gray[800] },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  searchDot: { width: 10, height: 10, borderRadius: 5 },
  searchInput: { flex: 1, fontSize: typography.fontSize.base, color: colors.gray[800], paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  searchDivider: { height: 20, width: 1, backgroundColor: colors.gray[200], marginLeft: 4 },
  searchButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, backgroundColor: TRANSPORT_COLORS.train, paddingVertical: 14, borderRadius: borders.radius.lg },
  searchButtonDisabled: { backgroundColor: colors.gray[300] },
  searchButtonText: { fontSize: typography.fontSize.md, fontWeight: '700', color: '#FFF' },

  // Search Results
  resultsContainer: { marginTop: 16 },
  resultsTitle: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[700], marginBottom: 12 },
  connectionCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 10, ...shadows.sm },
  connectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connectionRoute: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  connectionOrigin: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  connectionDest: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  trainTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  trainTypeText: { fontSize: 11, fontWeight: '600' },
  connectionDetails: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  connectionDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  connectionDetailText: { fontSize: typography.fontSize.sm, color: colors.gray[600] },
  connectionStops: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  connectionStopsText: { fontSize: 11, color: colors.gray[500] },

  // Routes
  routeCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 12, ...shadows.sm },
  routeCardScenic: { borderWidth: 1.5, borderColor: '#F59E0B' },
  scenicBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  scenicBadgeText: { fontSize: 11, fontWeight: '600', color: '#D97706' },
  routeHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  routeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  routeHeaderText: { flex: 1 },
  routeName: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  routeType: { fontSize: 11, color: TRANSPORT_COLORS.train, fontWeight: '600', marginTop: 2 },
  routeStopsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  routeStopDot: { width: 8, height: 8, borderRadius: 4 },
  routeStopText: { fontSize: typography.fontSize.sm, color: colors.gray[600] },
  routeMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  routeMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeMetaText: { fontSize: 11, color: colors.gray[600] },
  routeDescription: { fontSize: typography.fontSize.sm, color: colors.gray[500], marginTop: 10, lineHeight: 18 },

  // Metro
  metroInfoCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 16, ...shadows.sm, gap: 10 },
  metroInfoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metroInfoText: { fontSize: typography.fontSize.sm, color: colors.gray[700], flex: 1 },
  metroLineCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 10, ...shadows.sm },
  metroLineHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  metroLineIndicator: { width: 6, height: 44, borderRadius: 3 },
  metroLineHeaderText: { flex: 1 },
  metroLineName: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  metroLineTerminals: { fontSize: 11, color: colors.gray[500], marginTop: 2 },
  metroStationCount: { alignItems: 'center', backgroundColor: colors.gray[100], paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  metroStationCountText: { fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.gray[800] },
  metroStationCountLabel: { fontSize: 9, color: colors.gray[500], fontWeight: '600' },
  metroLineDetail: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingLeft: 18 },
  metroLineDetailText: { fontSize: 11, color: colors.gray[600], flex: 1 },

  // Ferries
  ferryCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 12, ...shadows.sm },
  ferryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ferryIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  ferryHeaderText: { flex: 1 },
  ferryName: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  ferryOperator: { fontSize: 11, color: TRANSPORT_COLORS.ferry, fontWeight: '600', marginTop: 2 },
  ferryPrice: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  ferryPriceText: { fontSize: 11, fontWeight: '700', color: TRANSPORT_COLORS.card },
  ferryMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  ferryMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ferryMetaText: { fontSize: 11, color: colors.gray[600] },
  ferryTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 10 },
  ferryTipText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },

  // Travel Cards
  travelCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 12, ...shadows.sm },
  travelCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  travelCardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  travelCardName: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  travelCardZone: { fontSize: 11, color: colors.gray[500], marginTop: 1 },
  travelCardPrice: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  travelCardPriceText: { fontSize: 11, fontWeight: '700', color: TRANSPORT_COLORS.card },
  travelCardDesc: { fontSize: typography.fontSize.sm, color: colors.gray[600], marginTop: 10, lineHeight: 18 },
  travelCardMeta: { marginTop: 10, gap: 6 },
  travelCardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  travelCardMetaText: { fontSize: 11, color: colors.gray[600], flex: 1 },
  travelCardTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 10 },
  travelCardTipText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },

  // Empty State
  emptyState: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyStateText: { fontSize: typography.fontSize.md, fontWeight: '600', color: colors.gray[500] },
  emptyStateSubtext: { fontSize: typography.fontSize.sm, color: colors.gray[400] },
});
