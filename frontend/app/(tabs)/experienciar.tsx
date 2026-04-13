import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCalendarEvents,
  getUpcomingEvents,
  getVisitHistory,
  getDashboardProgress,
  CalendarEvent,
  VisitRecord,
} from '../../src/services/api';
import { useTheme } from '../../src/theme';
import SmartImage from '../../src/components/SmartImage';

const { width } = Dimensions.get('window');
const POPULAR_CARD_WIDTH = Math.min(260, width * 0.7);

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    religioso: 'church',
    gastronomia: 'restaurant',
    festas: 'celebration',
    festas_romarias: 'celebration',
    natureza: 'park',
    cultural: 'theater-comedy',
    tradicional: 'groups',
    musica_tradicional: 'music-note',
    festivais_musica: 'music-note',
  };
  return icons[category] || 'event';
};

const parseEventDay = (event: CalendarEvent): { day: number; month: number } | null => {
  // date_start is "MM-DD" (see api.ts mapping)
  const parts = event.date_start?.split('-');
  if (!parts || parts.length < 2) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  if (Number.isNaN(month) || Number.isNaN(day)) return null;
  return { day, month };
};

export default function ExperienciarTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [visitsExpanded, setVisitsExpanded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('userToken').then(setToken);
  }, []);

  const currentMonth = selectedDate.getMonth() + 1;

  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useQuery({
    queryKey: ['calendar-events', currentMonth],
    queryFn: () => getCalendarEvents(currentMonth),
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => getUpcomingEvents(8),
  });

  const { data: historyData } = useQuery({
    queryKey: ['visit-history', token],
    queryFn: () => (token ? getVisitHistory(token, 20) : Promise.resolve([])),
    enabled: !!token,
  });

  const { data: progressData } = useQuery({
    queryKey: ['dashboard-progress', token],
    queryFn: () => (token ? getDashboardProgress(token) : Promise.resolve(null)),
    enabled: !!token,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchEvents();
    setRefreshing(false);
  };

  // Sugestão do Dia — primeiro evento próximo
  const suggestionOfDay = upcomingData?.[0];

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: { date: Date | null; events: CalendarEvent[] }[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, events: [] });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayEvents = (eventsData || []).filter((event) => {
        const parsed = parseEventDay(event);
        return parsed && parsed.day === i && parsed.month === month + 1;
      });
      days.push({ date, events: dayEvents });
    }

    return days;
  }, [selectedDate, eventsData]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDay) return [];
    return (eventsData || []).filter((event) => {
      const parsed = parseEventDay(event);
      return parsed && parsed.day === selectedDay && parsed.month === currentMonth;
    });
  }, [selectedDay, eventsData, currentMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'prev' ? -1 : 1));
    setSelectedDate(newDate);
    setSelectedDay(null);
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const renderCalendarDay = (
    day: { date: Date | null; events: CalendarEvent[] },
    index: number,
  ) => {
    const dayNumber = day.date?.getDate() ?? null;
    const isSelected = dayNumber !== null && selectedDay === dayNumber;
    const today = isToday(day.date);
    const hasEvents = day.events.length > 0;

    return (
      <TouchableOpacity
        key={index}
        style={[
          styles.calendarDay,
          today && { backgroundColor: colors.accent },
          isSelected && !today && { backgroundColor: colors.accent + '55' },
          hasEvents && !today && !isSelected && { backgroundColor: colors.accent + '22' },
        ]}
        disabled={!day.date}
        onPress={() => {
          if (!day.date) return;
          setSelectedDay(dayNumber);
        }}
      >
        {day.date && (
          <>
            <Text
              style={[
                styles.calendarDayText,
                { color: colors.text },
                today && { color: '#FFF', fontWeight: '700' },
              ]}
            >
              {dayNumber}
            </Text>
            {hasEvents && (
              <View style={styles.eventDots}>
                {day.events.slice(0, 3).map((_, i) => (
                  <View key={i} style={[styles.eventDot, { backgroundColor: today ? '#FFF' : colors.accent }]} />
                ))}
              </View>
            )}
          </>
        )}
      </TouchableOpacity>
    );
  };

  const renderEventCard = (event: CalendarEvent) => (
    <TouchableOpacity
      key={event.id}
      style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/evento/${event.id}` as any)}
      activeOpacity={0.8}
      data-testid={`event-card-${event.id}`}
    >
      <SmartImage
        uri={(event as any).image_url}
        category={event.category}
        name={event.name}
        style={styles.eventThumb}
      />
      <View style={styles.eventInfo}>
        <Text style={[styles.eventName, { color: colors.text }]} numberOfLines={1}>
          {event.name}
        </Text>
        <View style={styles.eventMeta}>
          <MaterialIcons name="event" size={14} color={colors.textMuted} />
          <Text style={[styles.eventDate, { color: colors.textMuted }]}>{event.date_start}</Text>
          {event.region ? (
            <>
              <MaterialIcons name="location-on" size={14} color={colors.textMuted} />
              <Text style={[styles.eventRegion, { color: colors.textMuted }]} numberOfLines={1}>
                {event.region}
              </Text>
            </>
          ) : null}
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={colors.textMuted} />
    </TouchableOpacity>
  );

  const renderPopularCard = (event: CalendarEvent) => (
    <TouchableOpacity
      key={`pop-${event.id}`}
      style={[styles.popularCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/evento/${event.id}` as any)}
      activeOpacity={0.85}
    >
      <SmartImage
        uri={(event as any).image_url}
        category={event.category}
        name={event.name}
        style={styles.popularImage}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.popularGradient}
      />
      <View style={styles.popularContent}>
        <View style={[styles.popularBadge, { backgroundColor: colors.accent }]}>
          <MaterialIcons
            name={getCategoryIcon(event.category) as any}
            size={12}
            color="#FFF"
          />
          <Text style={styles.popularBadgeText}>{event.date_start}</Text>
        </View>
        <Text style={styles.popularName} numberOfLines={2}>
          {event.name}
        </Text>
        {event.region ? (
          <Text style={styles.popularRegion} numberOfLines={1}>
            {event.region}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const renderVisitCard = (visit: VisitRecord) => (
    <TouchableOpacity
      key={visit.id}
      style={[styles.visitCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={() => router.push(`/heritage/${visit.poi_id}`)}
      activeOpacity={0.8}
    >
      <SmartImage
        uri={(visit as any).image_url}
        category={visit.category}
        name={visit.poi_name}
        style={styles.visitThumb}
      />
      <View style={styles.visitInfo}>
        <Text style={[styles.visitName, { color: colors.text }]} numberOfLines={1}>
          {visit.poi_name}
        </Text>
        <Text style={[styles.visitDate, { color: colors.textMuted }]}>
          {new Date(visit.timestamp).toLocaleDateString('pt-PT')}
        </Text>
      </View>
      <View style={[styles.visitPoints, { backgroundColor: colors.success + '22' }]}>
        <Text style={[styles.visitPointsText, { color: colors.success }]}>
          +{visit.points_earned}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (eventsLoading && !eventsData) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>A carregar agenda...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Viver</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            O que experimentar hoje
          </Text>
        </View>

        {/* Sugestão do Dia */}
        {suggestionOfDay && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => router.push(`/evento/${suggestionOfDay.id}` as any)}
            style={[styles.suggestionCard, { borderColor: colors.border }]}
          >
            <SmartImage
              uri={(suggestionOfDay as any).image_url}
              category={suggestionOfDay.category}
              name={suggestionOfDay.name}
              style={styles.suggestionImage}
            />
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.85)']}
              style={styles.suggestionGradient}
            />
            <View style={styles.suggestionOverlay}>
              <View style={[styles.suggestionTag, { backgroundColor: colors.accent }]}>
                <MaterialIcons name="auto-awesome" size={12} color="#FFF" />
                <Text style={styles.suggestionTagText}>Sugestão do dia</Text>
              </View>
              <Text style={styles.suggestionTitle} numberOfLines={2}>
                {suggestionOfDay.name}
              </Text>
              <View style={styles.suggestionMeta}>
                <MaterialIcons name="event" size={14} color="#FFF" />
                <Text style={styles.suggestionMetaText}>{suggestionOfDay.date_start}</Text>
                {suggestionOfDay.region ? (
                  <>
                    <MaterialIcons name="location-on" size={14} color="#FFF" />
                    <Text style={styles.suggestionMetaText} numberOfLines={1}>
                      {suggestionOfDay.region}
                    </Text>
                  </>
                ) : null}
              </View>
            </View>
          </TouchableOpacity>
        )}

        {/* Calendar Section */}
        <View style={[styles.calendarContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity style={styles.monthButton} onPress={() => navigateMonth('prev')}>
              <MaterialIcons name="chevron-left" size={28} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {MONTHS_PT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
            </Text>
            <TouchableOpacity style={styles.monthButton} onPress={() => navigateMonth('next')}>
              <MaterialIcons name="chevron-right" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Weekday Headers */}
          <View style={styles.weekdaysRow}>
            {WEEKDAYS_PT.map((day, i) => (
              <Text key={i} style={[styles.weekdayText, { color: colors.textMuted }]}>
                {day}
              </Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, index) => renderCalendarDay(day, index))}
          </View>

          {/* Selected Day Events */}
          {selectedDay && selectedDayEvents.length > 0 && (
            <View style={[styles.selectedDayBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.selectedDayTitle, { color: colors.text }]}>
                Dia {selectedDay} — {selectedDayEvents.length}{' '}
                {selectedDayEvents.length === 1 ? 'evento' : 'eventos'}
              </Text>
              {selectedDayEvents.map((event) => (
                <TouchableOpacity
                  key={`sel-${event.id}`}
                  style={styles.selectedDayItem}
                  onPress={() => router.push(`/evento/${event.id}` as any)}
                >
                  <MaterialIcons
                    name={getCategoryIcon(event.category) as any}
                    size={18}
                    color={colors.accent}
                  />
                  <Text style={[styles.selectedDayItemText, { color: colors.text }]} numberOfLines={1}>
                    {event.name}
                  </Text>
                  <MaterialIcons name="chevron-right" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {selectedDay && selectedDayEvents.length === 0 && (
            <View style={[styles.selectedDayBox, { backgroundColor: colors.background }]}>
              <Text style={[styles.selectedDayEmpty, { color: colors.textMuted }]}>
                Sem eventos no dia {selectedDay}
              </Text>
            </View>
          )}
        </View>

        {/* Experiências Populares */}
        {upcomingData && upcomingData.length > 1 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="trending-up" size={20} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                Experiências Populares
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularList}
            >
              {upcomingData.slice(0, 8).map(renderPopularCard)}
            </ScrollView>
          </View>
        )}

        {/* Próximos Eventos (lista compacta) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event" size={20} color={colors.accent} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Próximos Eventos</Text>
          </View>
          {upcomingData && upcomingData.length > 0 ? (
            <View style={styles.eventsList}>{upcomingData.slice(0, 5).map(renderEventCard)}</View>
          ) : (
            <View style={[styles.emptySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MaterialIcons name="event-busy" size={32} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sem eventos próximos</Text>
            </View>
          )}
        </View>

        {/* As Minhas Conquistas (logged in) */}
        {token && progressData && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="emoji-events" size={20} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>As Minhas Conquistas</Text>
            </View>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                  {progressData.total_visits}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Visitas</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                  {progressData.total_points}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Pontos</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.accent }]}>
                  {progressData.current_streak}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Dias seguidos</Text>
              </View>
            </View>
          </View>
        )}

        {/* Visit History Section (if logged in) */}
        {token && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="history" size={20} color={colors.success} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Histórico de Visitas</Text>
            </View>
            {historyData && historyData.length > 0 ? (
              <View style={styles.visitsList}>
                {historyData.slice(0, visitsExpanded ? 20 : 5).map(renderVisitCard)}
                {historyData.length > 5 && (
                  <TouchableOpacity
                    style={[styles.expandButton, { borderColor: colors.border }]}
                    onPress={() => setVisitsExpanded((v) => !v)}
                    activeOpacity={0.7}
                  >
                    <MaterialIcons
                      name={visitsExpanded ? 'expand-less' : 'expand-more'}
                      size={20}
                      color={colors.textMuted}
                    />
                    <Text style={[styles.expandButtonText, { color: colors.textMuted }]}>
                      {visitsExpanded ? 'Ver menos' : `Ver mais (${historyData.length - 5})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <View style={[styles.emptySection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <MaterialIcons name="explore" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Comece a explorar para registar visitas
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/(tabs)/planeador')}>
            <LinearGradient colors={['#C49A6C', '#B08556']} style={styles.actionGradient}>
              <MaterialIcons name="edit-calendar" size={22} color="#000" />
              <Text style={styles.actionText}>Planear Viagem</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/nearby')}>
            <LinearGradient colors={['#22C55E', '#16A34A']} style={styles.actionGradient}>
              <MaterialIcons name="near-me" size={22} color="#FFF" />
              <Text style={[styles.actionText, { color: '#FFF' }]}>Perto de Mim</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 28, fontWeight: '700' },
  headerSubtitle: { fontSize: 14, marginTop: 4 },

  // Sugestão do Dia
  suggestionCard: {
    marginHorizontal: 20,
    marginTop: 16,
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  suggestionImage: { ...StyleSheet.absoluteFillObject },
  suggestionGradient: { ...StyleSheet.absoluteFillObject },
  suggestionOverlay: { position: 'absolute', left: 16, right: 16, bottom: 16 },
  suggestionTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    marginBottom: 8,
  },
  suggestionTagText: { color: '#FFF', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  suggestionTitle: { color: '#FFF', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  suggestionMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  suggestionMetaText: { color: '#FFF', fontSize: 13, marginRight: 8 },

  // Calendar
  calendarContainer: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthButton: { padding: 4 },
  monthTitle: { fontSize: 18, fontWeight: '600' },
  weekdaysRow: { flexDirection: 'row', marginBottom: 8 },
  weekdayText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarDayText: { fontSize: 14 },
  eventDots: { flexDirection: 'row', gap: 2, marginTop: 2 },
  eventDot: { width: 4, height: 4, borderRadius: 2 },

  selectedDayBox: { marginTop: 16, padding: 12, borderRadius: 10 },
  selectedDayTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  selectedDayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  selectedDayItemText: { flex: 1, fontSize: 14 },
  selectedDayEmpty: { fontSize: 13, textAlign: 'center' },

  // Sections
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600' },

  // Popular cards (horizontal)
  popularList: { paddingHorizontal: 20, gap: 12 },
  popularCard: {
    width: POPULAR_CARD_WIDTH,
    height: 180,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 12,
  },
  popularImage: { ...StyleSheet.absoluteFillObject },
  popularGradient: { ...StyleSheet.absoluteFillObject },
  popularContent: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  popularBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    marginBottom: 6,
  },
  popularBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  popularName: { color: '#FFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
  popularRegion: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },

  // Event card (vertical list)
  eventsList: { paddingHorizontal: 20, gap: 8 },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  eventThumb: { width: 56, height: 56, borderRadius: 10 },
  eventInfo: { flex: 1 },
  eventName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventDate: { fontSize: 12, marginRight: 8 },
  eventRegion: { fontSize: 12, flex: 1 },

  // Stats
  statsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 8 },
  statCard: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Visits
  visitsList: { paddingHorizontal: 20, gap: 8 },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 10,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  visitThumb: { width: 48, height: 48, borderRadius: 10 },
  visitInfo: { flex: 1 },
  visitName: { fontSize: 14, fontWeight: '600' },
  visitDate: { fontSize: 12, marginTop: 2 },
  visitPoints: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  visitPointsText: { fontSize: 12, fontWeight: '700' },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  expandButtonText: { fontSize: 13, fontWeight: '500' },

  // Empty state
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyText: { fontSize: 14, marginTop: 8 },

  // Quick actions
  quickActions: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 24, gap: 12 },
  actionButton: { flex: 1, borderRadius: 14, overflow: 'hidden' },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionText: { fontSize: 14, fontWeight: '600', color: '#000' },
});
