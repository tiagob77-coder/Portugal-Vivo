/**
 * Eventos - Tab
 * Calendar with cultural events, festivals and traditions
 * All regions of Portugal available
 * All categories active: Festas, Religioso, Gastronomia, Natureza, Cultural, Festivais
 * Integrates Agenda Viral API + Excel data (200+ events) for complementary event data
 */
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api, { getAgendaLive, AgendaEvent } from '../../src/services/api';
import { colors, shadows } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';
import EmptyState from '../../src/components/EmptyState';

const { width: _width } = Dimensions.get('window');
const serif = Platform.OS === 'web' ? 'Cormorant Garamond, Georgia, serif' : undefined;

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// All event categories active
const EVENT_CATEGORIES = [
  { id: 'festas', name: 'Festas', icon: 'celebration', color: '#C49A6C' },
  { id: 'religioso', name: 'Religioso', icon: 'church', color: '#8B5CF6' },
  { id: 'gastronomia', name: 'Gastronomia', icon: 'restaurant', color: '#EF4444' },
  { id: 'natureza', name: 'Natureza', icon: 'park', color: '#22C55E' },
  { id: 'cultural', name: 'Cultural', icon: 'theater-comedy', color: '#06B6D4' },
  { id: 'festival', name: 'Festivais', icon: 'music-note', color: '#EC4899' },
];

// All regions of Portugal
const REGIONS = [
  { id: null, name: 'Todas', emoji: '🇵🇹' },
  { id: 'norte', name: 'Norte', emoji: '🏔️' },
  { id: 'centro', name: 'Centro', emoji: '🏛️' },
  { id: 'lisboa', name: 'Lisboa', emoji: '🌆' },
  { id: 'alentejo', name: 'Alentejo', emoji: '🌾' },
  { id: 'algarve', name: 'Algarve', emoji: '🏖️' },
  { id: 'acores', name: 'Açores', emoji: '🌋' },
  { id: 'madeira', name: 'Madeira', emoji: '🌺' },
];

// All categories allowed
const _ALLOWED_CATEGORIES = ['festas', 'religioso', 'gastronomia', 'natureza', 'cultural', 'festival'];

interface CalendarEvent {
  id: string;
  name: string;
  date_start: string;
  date_end: string;
  category: string;
  region: string;
  description: string;
  source?: string;
  has_tickets?: boolean;
  ticket_url?: string;
  // Agenda Viral fields
  type?: string;
  date_text?: string;
  concelho?: string;
  rarity?: string;
  price?: string;
  day_start?: number;
  day_end?: number;
  month?: number;
}

const getCalendarEvents = async (
  month?: number,
  category?: string | null,
  region?: string | null,
): Promise<CalendarEvent[]> => {
  const params: Record<string, string | number> = {};
  if (month) params.month = month;
  if (category) params.category = category;
  if (region) params.region = region;
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
  const response = await api.get(`/calendar${qs ? `?${qs}` : ''}`);
  return response.data;
};

const getUpcomingEvents = async (
  limit: number = 10,
  category?: string | null,
  region?: string | null,
): Promise<CalendarEvent[]> => {
  const params: Record<string, string | number> = { limit };
  if (category) params.category = category;
  if (region) params.region = region;
  const qs = Object.entries(params).map(([k, v]) => `${k}=${v}`).join('&');
  const response = await api.get(`/calendar/upcoming?${qs}`);
  return response.data;
};

/**
 * Fetch live merged events from /agenda/live (DB + Viral Agenda RSS server-side)
 * and normalize to CalendarEvent format.
 */
const fetchLiveEvents = async (
  month?: number,
  region?: string | null,
): Promise<{ events: CalendarEvent[]; sources: { database: number; viralagenda: number } }> => {
  try {
    const params: Record<string, string | number> = { limit: 150 };
    if (month) params.month = month;
    if (region) params.region = region;
    const result = await getAgendaLive(params);
    const events = (result.events || []).map((evt: AgendaEvent) => {
      const m = evt.month || month || 1;
      const dayStart = evt.day_start || 1;
      const dayEnd = evt.day_end || dayStart;
      let category = 'festas';
      if (evt.type === 'festa') category = 'festas';
      else if (evt.type === 'religioso') category = 'religioso';
      else if (evt.type) category = evt.type;
      return {
        id: evt.id,
        name: evt.name,
        date_start: `${String(m).padStart(2, '0')}-${String(dayStart).padStart(2, '0')}`,
        date_end: `${String(m).padStart(2, '0')}-${String(dayEnd).padStart(2, '0')}`,
        category,
        region: (evt.region || '').toLowerCase(),
        description: evt.description || '',
        source: evt.source || 'curated',
        has_tickets: evt.has_tickets || false,
        ticket_url: evt.ticket_url,
        type: evt.type,
        date_text: evt.date_text,
        concelho: evt.concelho,
        rarity: evt.rarity,
        price: evt.price,
        month: m,
      };
    });
    return { events, sources: result.sources || { database: 0, viralagenda: 0 } };
  } catch {
    return { events: [], sources: { database: 0, viralagenda: 0 } };
  }
};

const getCategoryIcon = (category: string): string => {
  const cat = EVENT_CATEGORIES.find(c => c.id === category);
  return cat?.icon || 'event';
};

const getCategoryColor = (category: string): string => {
  const cat = EVENT_CATEGORIES.find(c => c.id === category);
  return cat?.color || '#C49A6C';
};

/**
 * Filter events - all categories and regions are now active
 */
const filterAllowedEvents = (events: CalendarEvent[]): CalendarEvent[] => {
  return events;
};

/**
 * Get rarity badge color
 */
const getRarityColor = (rarity?: string): string | null => {
  switch (rarity) {
    case 'epico': return '#EAB308';
    case 'raro': return '#8B5CF6';
    case 'incomum': return '#06B6D4';
    default: return null;
  }
};

export default function EventosTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  const currentMonth = selectedDate.getMonth() + 1;

  // Single /agenda/live query: server-side merges DB + Viral Agenda RSS
  const { data: liveData, isLoading, refetch } = useQuery({
    queryKey: ['agenda-live', currentMonth, selectedRegion],
    queryFn: () => fetchLiveEvents(currentMonth, selectedRegion),
    staleTime: 1000 * 60 * 5, // 5 min
  });

  const { data: upcomingData } = useQuery({
    queryKey: ['upcoming-events', selectedCategory, selectedRegion],
    queryFn: () => getUpcomingEvents(10, selectedCategory, selectedRegion),
  });

  const liveSources = liveData?.sources || { database: 0, viralagenda: 0 };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Filter merged live events by selected category
  const filteredEvents = useMemo(() => {
    let events = liveData?.events || [];
    events = filterAllowedEvents(events);
    if (selectedCategory) {
      events = events.filter(e => (e.category || '').toLowerCase() === selectedCategory);
    }
    return events;
  }, [liveData, selectedCategory]);

  // Filter upcoming events too
  const filteredUpcoming = useMemo(() => {
    const upcoming = upcomingData || [];
    return filterAllowedEvents(upcoming);
  }, [upcomingData]);

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
      const dayStr = `${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayEvents = filteredEvents.filter(event => {
        const startParts = event.date_start.split('-');
        const endParts = event.date_end.split('-');
        const eventStart = `${startParts[0]}-${startParts[1]}`;
        const eventEnd = `${endParts[0]}-${endParts[1]}`;
        return dayStr >= eventStart && dayStr <= eventEnd;
      });
      days.push({ date, events: dayEvents });
    }

    return days;
  }, [selectedDate, filteredEvents]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    if (direction === 'prev') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setSelectedDate(newDate);
  };

  const isToday = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  /** Navigate to event detail page */
  const openEventDetail = (event: CalendarEvent) => {
    router.push(`/evento/${event.id}`);
  };

  const renderCalendarDay = (day: { date: Date | null; events: CalendarEvent[] }, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.calendarDay,
        isToday(day.date) && styles.calendarDayToday,
        day.events.length > 0 && styles.calendarDayWithEvent,
      ]}
      disabled={!day.date || day.events.length === 0}
      onPress={() => {
        if (day.date && day.events.length > 0) {
          // If single event, go directly to detail; otherwise show first event
          openEventDetail(day.events[0]);
        }
      }}
    >
      {day.date && (
        <>
          <Text style={[
            styles.calendarDayText,
            isToday(day.date) && styles.calendarDayTextToday,
          ]}>
            {day.date.getDate()}
          </Text>
          {day.events.length > 0 && (
            <View style={styles.eventDots}>
              {day.events.slice(0, 3).map((e, i) => (
                <View
                  key={i}
                  style={[styles.eventDot, { backgroundColor: getCategoryColor(e.category) }]}
                />
              ))}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );

  const renderEventCard = (event: CalendarEvent) => {
    const color = getCategoryColor(event.category);
    const rarityColor = getRarityColor(event.rarity);
    return (
      <TouchableOpacity
        key={event.id}
        style={styles.eventCard}
        onPress={() => openEventDetail(event)}
        activeOpacity={0.8}
        data-testid={`event-card-${event.id}`}
      >
        <View style={[styles.eventIcon, { backgroundColor: color + '20' }]}>
          <MaterialIcons
            name={getCategoryIcon(event.category) as any}
            size={24}
            color={color}
          />
        </View>
        <View style={styles.eventInfo}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
            {rarityColor && (
              <View style={[styles.rarityBadge, { backgroundColor: rarityColor }]}>
                <Text style={styles.rarityText}>
                  {event.rarity === 'epico' ? '★' : event.rarity === 'raro' ? '◆' : '●'}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.eventMeta}>
            <MaterialIcons name="event" size={14} color="#64748B" />
            <Text style={styles.eventDate}>
              {event.date_text || `${event.date_start} - ${event.date_end}`}
            </Text>
          </View>
          <View style={styles.eventMeta}>
            <MaterialIcons name="location-on" size={14} color="#64748B" />
            <Text style={styles.eventRegion}>
              {event.concelho ? `${event.concelho}, ` : ''}{event.region}
            </Text>
          </View>
          {event.source === 'viralagenda' && (
            <View style={[styles.sourceBadge, { backgroundColor: '#06B6D420' }]}>
              <Text style={[styles.sourceText, { color: '#06B6D4' }]}>● Viral Agenda</Text>
            </View>
          )}
          {event.has_tickets && event.ticket_url && (
            <TouchableOpacity
              style={styles.ticketButton}
              onPress={(e) => { e.stopPropagation(); Linking.openURL(event.ticket_url!); }}
              activeOpacity={0.7}
            >
              <MaterialIcons name="confirmation-number" size={12} color="#FFF" />
              <Text style={styles.ticketText}>Bilhetes</Text>
            </TouchableOpacity>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color="#64748B" />
      </TouchableOpacity>
    );
  };

  if (isLoading && !liveData) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: tc.background }]}>
        <ActivityIndicator size="large" color="#C49A6C" />
        <Text style={styles.loadingText}>A carregar eventos...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]} data-testid="eventos-tab">
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#C49A6C" />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Eventos</Text>
          <Text style={styles.headerSubtitle}>Festas, Romarias & Tradições de Portugal</Text>
        </View>

        {/* View Mode Toggle */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'calendar' && styles.toggleActive]}
            onPress={() => setViewMode('calendar')}
          >
            <MaterialIcons
              name="calendar-today"
              size={18}
              color={viewMode === 'calendar' ? '#000' : '#94A3B8'}
            />
            <Text style={[styles.toggleText, viewMode === 'calendar' && styles.toggleTextActive]}>
              Calendário
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, viewMode === 'list' && styles.toggleActive]}
            onPress={() => setViewMode('list')}
          >
            <MaterialIcons
              name="list"
              size={18}
              color={viewMode === 'list' ? '#000' : '#94A3B8'}
            />
            <Text style={[styles.toggleText, viewMode === 'list' && styles.toggleTextActive]}>
              Lista
            </Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter - Only festas and religioso */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              !selectedCategory && styles.filterChipActive,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text style={[
              styles.filterText,
              !selectedCategory && styles.filterTextActive,
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          {EVENT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.filterChip,
                selectedCategory === cat.id && { backgroundColor: cat.color },
              ]}
              onPress={() => setSelectedCategory(
                selectedCategory === cat.id ? null : cat.id
              )}
            >
              <MaterialIcons
                name={cat.icon as any}
                size={16}
                color={selectedCategory === cat.id ? '#FFF' : '#94A3B8'}
              />
              <Text style={[
                styles.filterText,
                selectedCategory === cat.id && styles.filterTextActive,
              ]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Region Filter - Only Norte, Centro, Lisboa */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {REGIONS.map((region) => (
            <TouchableOpacity
              key={region.id || 'all'}
              style={[
                styles.regionPill,
                selectedRegion === region.id && styles.regionPillActive,
              ]}
              onPress={() => setSelectedRegion(region.id)}
            >
              <Text style={styles.regionEmoji}>{region.emoji}</Text>
              <Text style={[
                styles.regionPillText,
                selectedRegion === region.id && styles.regionPillTextActive,
              ]}>
                {region.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Active Filters Indicator */}
        {(selectedCategory || selectedRegion) && (
          <View style={styles.activeFiltersBar}>
            <MaterialIcons name="filter-list" size={16} color="#C49A6C" />
            <Text style={styles.activeFiltersText}>
              Filtros:{selectedCategory ? ` ${EVENT_CATEGORIES.find(c => c.id === selectedCategory)?.name || selectedCategory}` : ''}
              {selectedRegion ? ` · ${REGIONS.find(r => r.id === selectedRegion)?.name || selectedRegion}` : ''}
            </Text>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={() => { setSelectedCategory(null); setSelectedRegion(null); }}
            >
              <MaterialIcons name="close" size={14} color="#FFF" />
              <Text style={styles.clearFiltersText}>Limpar</Text>
            </TouchableOpacity>
          </View>
        )}

        {viewMode === 'calendar' ? (
          /* Calendar View */
          <View style={styles.calendarContainer}>
            {/* Month Navigation */}
            <View style={styles.monthNav}>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() => navigateMonth('prev')}
              >
                <MaterialIcons name="chevron-left" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.monthTitle}>
                {MONTHS_PT[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </Text>
              <TouchableOpacity
                style={styles.monthButton}
                onPress={() => navigateMonth('next')}
              >
                <MaterialIcons name="chevron-right" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Weekday Headers */}
            <View style={styles.weekdaysRow}>
              {WEEKDAYS_PT.map((day, i) => (
                <Text key={i} style={styles.weekdayText}>{day}</Text>
              ))}
            </View>

            {/* Calendar Grid */}
            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => renderCalendarDay(day, index))}
            </View>
          </View>
        ) : (
          /* List View */
          <View style={styles.listContainer}>
            {filteredEvents.length > 0 ? (
              filteredEvents.map(renderEventCard)
            ) : (
              <EmptyState
                icon="event-note"
                title="Sem eventos neste mês"
                subtitle="Explore outros meses para descobrir festivais, romarias e tradições por todo o Portugal"
                actionLabel="Ver todos os eventos"
                onAction={() => { setSelectedCategory(null); setSelectedRegion(null); }}
              />
            )}
          </View>
        )}

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="upcoming" size={20} color="#22C55E" />
            <Text style={styles.sectionTitle}>Próximos Eventos</Text>
          </View>
          {filteredUpcoming.length > 0 ? (
            <View style={styles.upcomingList}>
              {filteredUpcoming.slice(0, 5).map(renderEventCard)}
            </View>
          ) : (
            <EmptyState
              icon="celebration"
              title="Sem eventos próximos"
              subtitle="Novos eventos são adicionados regularmente. Volte em breve!"
            />
          )}
        </View>

        {/* Live Sources Banner */}
        <View style={styles.agendaViralBanner}>
          <View style={styles.liveDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.agendaViralTitle}>Eventos em Tempo Real</Text>
            <Text style={styles.agendaViralSubtitle}>
              {liveSources.database} da base de dados · {liveSources.viralagenda} do Viral Agenda RSS
            </Text>
          </View>
          <MaterialIcons name="rss-feed" size={18} color="#C49A6C" />
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filteredEvents.length}</Text>
            <Text style={styles.statLabel}>Este Mês</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{filteredUpcoming.length}</Text>
            <Text style={styles.statLabel}>Próximos</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{REGIONS.length - 1}</Text>
            <Text style={styles.statLabel}>Regiões</Text>
          </View>
        </View>

        <View style={{ height: 120 }} />
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
  },
  loadingText: {
    color: '#94A3B8',
    marginTop: 12,
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.gray[800],
    fontFamily: serif,
  },
  headerSubtitle: {
    fontSize: 14,
    color: colors.gray[500],
    marginTop: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 4,
    ...shadows.sm,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  toggleActive: {
    backgroundColor: colors.terracotta[500],
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray[500],
  },
  toggleTextActive: {
    color: '#FFF',
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
    ...shadows.sm,
  },
  filterChipActive: {
    backgroundColor: colors.terracotta[500],
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray[600],
  },
  filterTextActive: {
    color: '#FFF',
  },
  regionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.mint[100],
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    gap: 4,
  },
  regionPillActive: {
    backgroundColor: colors.terracotta[500],
  },
  regionEmoji: {
    fontSize: 14,
  },
  regionPillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.gray[600],
  },
  regionPillTextActive: {
    color: '#FFF',
  },
  activeFiltersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(196,154,108,0.12)',
    borderRadius: 8,
    gap: 6,
  },
  activeFiltersText: {
    flex: 1,
    fontSize: 13,
    color: '#C49A6C',
    fontWeight: '500',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#C49A6C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  clearFiltersText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  calendarContainer: {
    backgroundColor: colors.background.secondary,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    ...shadows.md,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthButton: {
    padding: 4,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
  },
  weekdaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: colors.gray[500],
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  calendarDayToday: {
    backgroundColor: colors.terracotta[500],
  },
  calendarDayWithEvent: {
    backgroundColor: colors.terracotta[100],
  },
  calendarDayText: {
    fontSize: 14,
    color: colors.gray[700],
  },
  calendarDayTextToday: {
    color: '#FFF',
    fontWeight: '700',
  },
  eventDots: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 2,
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  listContainer: {
    paddingHorizontal: 20,
    marginTop: 8,
    gap: 8,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: 14,
    gap: 12,
    ...shadows.sm,
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray[800],
    marginBottom: 4,
    flex: 1,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  eventDate: {
    fontSize: 12,
    color: colors.gray[500],
  },
  eventRegion: {
    fontSize: 12,
    color: colors.gray[500],
    textTransform: 'capitalize',
  },
  rarityBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rarityText: {
    fontSize: 8,
    color: '#FFF',
    fontWeight: '700',
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  sourceText: {
    fontSize: 9,
    fontWeight: '600',
  },
  ticketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ticketText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray[800],
    fontFamily: serif,
  },
  upcomingList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  agendaViralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 14,
    backgroundColor: 'rgba(196,154,108,0.08)',
    borderRadius: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(196,154,108,0.2)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  agendaViralTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C49A6C',
  },
  agendaViralSubtitle: {
    fontSize: 11,
    color: colors.gray[500],
    marginTop: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: 20,
    ...shadows.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#C49A6C',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#2A2F2A',
    marginVertical: 4,
  },
});
