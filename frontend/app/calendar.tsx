import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getCalendarEvents, getUpcomingEvents, CalendarEvent } from '../src/services/api';

const MONTHS = [
  { id: 1, name: 'Janeiro', short: 'Jan' },
  { id: 2, name: 'Fevereiro', short: 'Fev' },
  { id: 3, name: 'Março', short: 'Mar' },
  { id: 4, name: 'Abril', short: 'Abr' },
  { id: 5, name: 'Maio', short: 'Mai' },
  { id: 6, name: 'Junho', short: 'Jun' },
  { id: 7, name: 'Julho', short: 'Jul' },
  { id: 8, name: 'Agosto', short: 'Ago' },
  { id: 9, name: 'Setembro', short: 'Set' },
  { id: 10, name: 'Outubro', short: 'Out' },
  { id: 11, name: 'Novembro', short: 'Nov' },
  { id: 12, name: 'Dezembro', short: 'Dez' },
];

const CATEGORY_COLORS: Record<string, string> = {
  festas: '#C49A6C',
  religioso: '#7C3AED',
};

const CATEGORY_ICONS: Record<string, string> = {
  festas: 'celebration',
  religioso: 'church',
};

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const currentMonth = new Date().getMonth() + 1;
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);

  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['calendarEvents'],
    queryFn: () => getCalendarEvents(),
  });

  const { data: upcomingEvents = [] } = useQuery({
    queryKey: ['upcomingEvents'],
    queryFn: () => getUpcomingEvents(5),
  });

  // Filter events by selected month
  const filteredEvents = selectedMonth 
    ? allEvents.filter(e => {
        const monthStr = `${selectedMonth.toString().padStart(2, '0')}`;
        return e.date_start.startsWith(monthStr);
      })
    : allEvents;

  const formatDateRange = (start: string, end: string) => {
    const [startMonth, startDay] = start.split('-');
    const [endMonth, endDay] = end.split('-');
    const startMonthName = MONTHS[parseInt(startMonth) - 1]?.short;
    const endMonthName = MONTHS[parseInt(endMonth) - 1]?.short;
    
    if (startMonth === endMonth && startDay === endDay) {
      return `${startDay} ${startMonthName}`;
    } else if (startMonth === endMonth) {
      return `${startDay}-${endDay} ${startMonthName}`;
    } else {
      return `${startDay} ${startMonthName} - ${endDay} ${endMonthName}`;
    }
  };

  const renderEventCard = ({ item }: { item: CalendarEvent }) => {
    const color = CATEGORY_COLORS[item.category] || '#C49A6C';
    const icon = CATEGORY_ICONS[item.category] || 'event';
    
    return (
      <View style={styles.eventCard}>
        <View style={[styles.eventIconContainer, { backgroundColor: color + '20' }]}>
          <MaterialIcons name={icon as any} size={24} color={color} />
        </View>
        
        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <Text style={styles.eventName}>{item.name}</Text>
            <View style={[styles.categoryBadge, { backgroundColor: color + '20' }]}>
              <Text style={[styles.categoryBadgeText, { color }]}>
                {item.category === 'festas' ? 'Festa' : 'Religioso'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.eventDescription} numberOfLines={2}>
            {item.description}
          </Text>
          
          <View style={styles.eventFooter}>
            <View style={styles.eventDate}>
              <MaterialIcons name="event" size={14} color="#C49A6C" />
              <Text style={styles.eventDateText}>
                {formatDateRange(item.date_start, item.date_end)}
              </Text>
            </View>
            
            <View style={styles.eventRegion}>
              <MaterialIcons name="place" size={14} color="#94A3B8" />
              <Text style={styles.eventRegionText}>
                {REGION_NAMES[item.region] || item.region}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Calendário Cultural</Text>
        <View style={{ width: 44 }} />
      </View>

      {/* Month Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.monthScroll}
        contentContainerStyle={styles.monthScrollContent}
      >
        <TouchableOpacity
          style={[styles.monthChip, !selectedMonth && styles.monthChipActive]}
          onPress={() => setSelectedMonth(null)}
        >
          <Text style={[styles.monthChipText, !selectedMonth && styles.monthChipTextActive]}>
            Todos
          </Text>
        </TouchableOpacity>
        {MONTHS.map((month) => (
          <TouchableOpacity
            key={month.id}
            style={[
              styles.monthChip, 
              selectedMonth === month.id && styles.monthChipActive,
              month.id === currentMonth && !selectedMonth && styles.monthChipCurrent,
            ]}
            onPress={() => setSelectedMonth(month.id)}
          >
            <Text style={[
              styles.monthChipText, 
              selectedMonth === month.id && styles.monthChipTextActive,
            ]}>
              {month.short}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Upcoming Events Section */}
      {!selectedMonth && upcomingEvents.length > 0 && (
        <View style={styles.upcomingSection}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="schedule" size={20} color="#22C55E" />
            <Text style={styles.sectionTitle}>Próximos Eventos</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.upcomingScroll}
          >
            {upcomingEvents.map((event) => {
              const color = CATEGORY_COLORS[event.category] || '#C49A6C';
              return (
                <View key={event.id} style={[styles.upcomingCard, { borderColor: color }]}>
                  <Text style={styles.upcomingDate}>
                    {formatDateRange(event.date_start, event.date_end)}
                  </Text>
                  <Text style={styles.upcomingName} numberOfLines={2}>{event.name}</Text>
                  <Text style={styles.upcomingRegion}>
                    {REGION_NAMES[event.region] || event.region}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Events List */}
      <FlatList
        data={filteredEvents}
        keyExtractor={(item) => item.id}
        renderItem={renderEventCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          selectedMonth ? (
            <Text style={styles.listHeader}>
              Eventos em {MONTHS[selectedMonth - 1]?.name}
            </Text>
          ) : (
            <Text style={styles.listHeader}>Todos os Eventos ({allEvents.length})</Text>
          )
        }
        ListEmptyComponent={
          eventsLoading ? (
            <ActivityIndicator size="large" color="#C49A6C" style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="event-busy" size={48} color="#64748B" />
              <Text style={styles.emptyText}>Sem eventos neste mês</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#264E41',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  monthScroll: {
    maxHeight: 50,
    marginBottom: 8,
  },
  monthScrollContent: {
    paddingHorizontal: 16,
  },
  monthChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#264E41',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2A2F2A',
  },
  monthChipActive: {
    backgroundColor: '#C49A6C20',
    borderColor: '#C49A6C',
  },
  monthChipCurrent: {
    borderColor: '#22C55E',
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
  monthChipTextActive: {
    color: '#C49A6C',
  },
  upcomingSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  upcomingScroll: {
    paddingRight: 16,
  },
  upcomingCard: {
    width: 160,
    backgroundColor: '#264E41',
    borderRadius: 12,
    padding: 12,
    marginRight: 12,
    borderWidth: 1,
  },
  upcomingDate: {
    fontSize: 12,
    fontWeight: '700',
    color: '#C49A6C',
    marginBottom: 4,
  },
  upcomingName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAF8F3',
    marginBottom: 4,
    lineHeight: 18,
  },
  upcomingRegion: {
    fontSize: 11,
    color: '#64748B',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  listHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
    marginBottom: 12,
  },
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#264E41',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2F2A',
  },
  eventIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  eventContent: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FAF8F3',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  eventDescription: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
    marginBottom: 8,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  eventDate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventDateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C49A6C',
  },
  eventRegion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventRegionText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    marginTop: 12,
  },
});
