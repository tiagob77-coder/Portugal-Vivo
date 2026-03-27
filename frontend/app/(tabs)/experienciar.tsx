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
  CalendarEvent,
  VisitRecord,
} from '../../src/services/api';
import { useTheme, palette } from '../../src/theme';

const { width: _width } = Dimensions.get('window');

const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const getCategoryIcon = (category: string): string => {
  const icons: Record<string, string> = {
    religioso: 'church',
    gastronomia: 'restaurant',
    festas: 'celebration',
    natureza: 'park',
    cultural: 'theater-comedy',
    tradicional: 'groups',
  };
  return icons[category] || 'event';
};

export default function ExperienciarTab() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [token, setToken] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [_viewMode, _setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [refreshing, setRefreshing] = useState(false);

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
    queryFn: () => getUpcomingEvents(5),
  });

  const { data: historyData } = useQuery({
    queryKey: ['visit-history', token],
    queryFn: () => token ? getVisitHistory(token, 10) : Promise.resolve([]),
    enabled: !!token,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchEvents();
    setRefreshing(false);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: { date: Date | null; events: CalendarEvent[] }[] = [];

    // Add padding for previous month
    for (let i = 0; i < startPadding; i++) {
      days.push({ date: null, events: [] });
    }

    // Add days of current month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      const dayEvents = eventsData?.filter(event => {
        const eventStart = event.date_start;
        const eventDay = parseInt(eventStart.split('/')[0]);
        const eventMonth = parseInt(eventStart.split('/')[1]);
        return eventDay === i && eventMonth === month + 1;
      }) || [];
      days.push({ date, events: dayEvents });
    }

    return days;
  }, [selectedDate, eventsData]);

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

  const renderCalendarDay = (day: { date: Date | null; events: CalendarEvent[] }, index: number) => (
    <TouchableOpacity
      key={index}
      style={[
        styles.calendarDay,
        isToday(day.date) && styles.calendarDayToday,
        day.events.length > 0 && styles.calendarDayWithEvent,
      ]}
      disabled={!day.date}
      onPress={() => {
        if (day.date && day.events.length > 0) {
          // Navigate to events for this day
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
              {day.events.slice(0, 3).map((_, i) => (
                <View key={i} style={styles.eventDot} />
              ))}
            </View>
          )}
        </>
      )}
    </TouchableOpacity>
  );

  const renderEventCard = (event: CalendarEvent) => (
    <TouchableOpacity
      key={event.id}
      style={styles.eventCard}
      onPress={() => router.push(`/evento/${event.id}` as any)}
      activeOpacity={0.8}
      data-testid={`event-card-${event.id}`}
    >
      <View style={styles.eventIcon}>
        <MaterialIcons
          name={getCategoryIcon(event.category) as any}
          size={24}
          color="#C49A6C"
        />
      </View>
      <View style={styles.eventInfo}>
        <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
        <View style={styles.eventMeta}>
          <MaterialIcons name="event" size={14} color="#64748B" />
          <Text style={styles.eventDate}>{event.date_start}</Text>
          <MaterialIcons name="location-on" size={14} color="#64748B" />
          <Text style={styles.eventRegion}>{event.region}</Text>
        </View>
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#64748B" />
    </TouchableOpacity>
  );

  const renderVisitCard = (visit: VisitRecord) => (
    <TouchableOpacity
      key={visit.id}
      style={styles.visitCard}
      onPress={() => router.push(`/heritage/${visit.poi_id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.visitIcon}>
        <MaterialIcons name="place" size={20} color="#22C55E" />
      </View>
      <View style={styles.visitInfo}>
        <Text style={styles.visitName} numberOfLines={1}>{visit.poi_name}</Text>
        <Text style={styles.visitDate}>
          {new Date(visit.timestamp).toLocaleDateString('pt-PT')}
        </Text>
      </View>
      <View style={styles.visitPoints}>
        <Text style={styles.visitPointsText}>+{visit.points_earned}</Text>
      </View>
    </TouchableOpacity>
  );

  if (eventsLoading && !eventsData) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: palette.forest[500] }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>A carregar calendário...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: palette.forest[500] }]}>
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
          <Text style={styles.headerTitle}>Experienciar</Text>
          <Text style={styles.headerSubtitle}>Gestão Temporal</Text>
        </View>

        {/* Calendar Section */}
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

        {/* Upcoming Events Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event" size={20} color="#C49A6C" />
            <Text style={styles.sectionTitle}>Próximos Eventos</Text>
          </View>
          {upcomingData && upcomingData.length > 0 ? (
            <View style={styles.eventsList}>
              {upcomingData.map(renderEventCard)}
            </View>
          ) : (
            <View style={styles.emptySection}>
              <MaterialIcons name="event-busy" size={32} color="#64748B" />
              <Text style={styles.emptyText}>Sem eventos próximos</Text>
            </View>
          )}
        </View>

        {/* Visit History Section (if logged in) */}
        {token && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MaterialIcons name="history" size={20} color="#22C55E" />
              <Text style={styles.sectionTitle}>Histórico de Visitas</Text>
            </View>
            {historyData && historyData.length > 0 ? (
              <View style={styles.visitsList}>
                {historyData.slice(0, 5).map(renderVisitCard)}
              </View>
            ) : (
              <View style={styles.emptySection}>
                <MaterialIcons name="explore" size={32} color="#64748B" />
                <Text style={styles.emptyText}>Comece a explorar para registar visitas</Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/(tabs)/planeador')}
          >
            <LinearGradient
              colors={['#C49A6C', '#B08556']}
              style={styles.actionGradient}
            >
              <MaterialIcons name="edit-calendar" size={24} color="#000" />
              <Text style={styles.actionText}>Planear Viagem</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => router.push('/nearby')}
          >
            <LinearGradient
              colors={['#22C55E', '#16A34A']}
              style={styles.actionGradient}
            >
              <MaterialIcons name="near-me" size={24} color="#FFF" />
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
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: palette.gray[400],
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
    color: palette.gray[50],
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.gray[400],
    marginTop: 4,
  },
  calendarContainer: {
    backgroundColor: palette.forest[600],
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
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
    color: palette.gray[50],
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
    color: palette.gray[500],
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
    backgroundColor: palette.terracotta[500],
  },
  calendarDayWithEvent: {
    backgroundColor: `${palette.terracotta[500]}26`,
  },
  calendarDayText: {
    fontSize: 14,
    color: palette.gray[100],
  },
  calendarDayTextToday: {
    color: palette.black,
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
    backgroundColor: palette.terracotta[500],
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
    color: palette.gray[50],
  },
  eventsList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.forest[600],
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  eventIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: `${palette.terracotta[500]}26`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventName: {
    fontSize: 15,
    fontWeight: '600',
    color: palette.gray[50],
    marginBottom: 4,
  },
  eventMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDate: {
    fontSize: 12,
    color: palette.gray[500],
    marginRight: 8,
  },
  eventRegion: {
    fontSize: 12,
    color: palette.gray[500],
  },
  visitsList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  visitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.forest[600],
    borderRadius: 12,
    padding: 12,
    gap: 12,
  },
  visitIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  visitInfo: {
    flex: 1,
  },
  visitName: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.gray[50],
  },
  visitDate: {
    fontSize: 12,
    color: palette.gray[500],
    marginTop: 2,
  },
  visitPoints: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  visitPointsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#22C55E',
  },
  emptySection: {
    alignItems: 'center',
    paddingVertical: 24,
    marginHorizontal: 20,
    backgroundColor: palette.forest[600],
    borderRadius: 12,
  },
  emptyText: {
    fontSize: 14,
    color: palette.gray[500],
    marginTop: 8,
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
});
