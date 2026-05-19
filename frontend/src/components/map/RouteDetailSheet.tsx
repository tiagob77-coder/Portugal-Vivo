/**
 * RouteDetailSheet.tsx — bottom slide-up sheet for route/trail detail
 * Shown in full-screen route mode over the map.
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface RouteWaypoint {
  lat: number;
  lng: number;
  name: string;
  order: number;
  type?: string;
}

export interface RouteDetail {
  name: string;
  type: 'trail' | 'passadico' | 'ecovia' | 'cultural' | 'expedicao';
  description_short?: string;
  distance_km?: number;
  duration_hours?: number;
  duration_days?: number;
  difficulty?: string;
  waypoints: RouteWaypoint[];
  tags?: string[];
  color?: string;
  elevation_gain?: number;
}

interface RouteDetailSheetProps {
  route: RouteDetail | null;
  onClose: () => void;
  onWaypointPress: (wp: RouteWaypoint) => void;
}

const TYPE_LABELS: Record<string, string> = {
  trail: 'Trilho',
  passadico: 'Passadiço',
  ecovia: 'Ecovia',
  cultural: 'Rota Cultural',
  expedicao: 'Expedição',
};

const TYPE_COLORS: Record<string, string> = {
  trail: '#22C55E',
  passadico: '#0EA5E9',
  ecovia: '#0EA5E9',
  cultural: '#A855F7',
  expedicao: '#F59E0B',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  facil: '#22C55E',
  moderado: '#F59E0B',
  dificil: '#EF4444',
  muito_dificil: '#7C3AED',
};

export default function RouteDetailSheet({ route, onClose, onWaypointPress }: RouteDetailSheetProps) {
  if (!route) return null;

  const typeColor = route.color || TYPE_COLORS[route.type] || '#C49A6C';
  const typeLabel = TYPE_LABELS[route.type] || route.type;
  const diffColor = DIFFICULTY_COLORS[route.difficulty || ''] || '#9CA3AF';

  const mapsUrl = route.waypoints.length > 0
    ? `https://www.google.com/maps/dir/?api=1&destination=${route.waypoints[0].lat},${route.waypoints[0].lng}`
    : null;

  return (
    <View style={s.sheet} pointerEvents="box-none">
      {/* Handle bar */}
      <View style={s.handle} />

      {/* Header row */}
      <View style={s.headerRow}>
        <View style={s.headerLeft}>
          <View style={[s.typeBadge, { backgroundColor: typeColor + '30', borderColor: typeColor }]}>
            <Text style={[s.typeBadgeText, { color: typeColor }]}>{typeLabel}</Text>
          </View>
          <Text style={s.routeName} numberOfLines={2}>{route.name}</Text>
        </View>
        <TouchableOpacity
          style={s.closeBtn}
          onPress={onClose}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Fechar detalhe da rota"
          hitSlop={10}
        >
          <MaterialIcons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      {/* Description */}
      {route.description_short ? (
        <Text style={s.description} numberOfLines={2}>{route.description_short}</Text>
      ) : null}

      {/* Stats row */}
      <View style={s.statsRow}>
        {route.distance_km != null && (
          <View style={s.stat}>
            <MaterialIcons name="straighten" size={13} color="#C49A6C" />
            <Text style={s.statText}>{route.distance_km} km</Text>
          </View>
        )}
        {route.duration_hours != null && (
          <View style={s.stat}>
            <MaterialIcons name="schedule" size={13} color="#8B5CF6" />
            <Text style={s.statText}>{route.duration_hours}h</Text>
          </View>
        )}
        {route.duration_days != null && (
          <View style={s.stat}>
            <MaterialIcons name="calendar-today" size={13} color="#8B5CF6" />
            <Text style={s.statText}>{route.duration_days} dias</Text>
          </View>
        )}
        {route.elevation_gain != null && (
          <View style={s.stat}>
            <MaterialIcons name="trending-up" size={13} color="#22C55E" />
            <Text style={s.statText}>+{route.elevation_gain}m</Text>
          </View>
        )}
        {route.difficulty && (
          <View style={[s.diffBadge, { backgroundColor: diffColor + '25' }]}>
            <Text style={[s.diffText, { color: diffColor }]}>{route.difficulty}</Text>
          </View>
        )}
      </View>

      {/* Waypoints list */}
      {route.waypoints.length > 0 && (
        <>
          <Text style={s.waypointsTitle}>
            {route.type === 'cultural' ? 'Paragens' : 'Pontos de passagem'} ({route.waypoints.length})
          </Text>
          <ScrollView
            style={s.waypointsList}
            showsVerticalScrollIndicator={false}
            pointerEvents="auto"
          >
            {route.waypoints
              .sort((a, b) => a.order - b.order)
              .map((wp) => (
                <TouchableOpacity
                  key={wp.order}
                  style={s.waypointRow}
                  onPress={() => onWaypointPress(wp)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`Paragem ${wp.order}: ${wp.name}`}
                  accessibilityHint="Abre o detalhe deste ponto da rota"
                >
                  <View style={[s.waypointNum, { backgroundColor: typeColor }]}>
                    <Text style={s.waypointNumText}>{wp.order}</Text>
                  </View>
                  <View style={s.waypointInfo}>
                    <Text style={s.waypointName} numberOfLines={1}>{wp.name}</Text>
                    {wp.type && (
                      <Text style={s.waypointType}>{wp.type}</Text>
                    )}
                  </View>
                  <MaterialIcons name="chevron-right" size={16} color="#4B5563" />
                </TouchableOpacity>
              ))}
            <View style={{ height: 12 }} />
          </ScrollView>
        </>
      )}

      {/* Start button */}
      {mapsUrl && (
        <TouchableOpacity
          style={[s.startBtn, { backgroundColor: typeColor }]}
          onPress={() => {
            if (Platform.OS === 'web') {
              window.open(mapsUrl, '_blank');
            }
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Iniciar navegação para a rota"
          accessibilityHint="Abre a rota no Google Maps"
        >
          <MaterialIcons name="navigation" size={16} color="#fff" />
          <Text style={s.startBtnText}>Iniciar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '44%',
    backgroundColor: 'rgba(13,17,26,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 16,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 20,
  } as any,
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#374151',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 6,
  },
  headerLeft: { flex: 1, gap: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 2,
  },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  routeName: { fontSize: 16, fontWeight: '700', color: '#F9FAFB', lineHeight: 22 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  description: {
    fontSize: 12,
    color: '#9CA3AF',
    lineHeight: 17,
    marginBottom: 10,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: 12, fontWeight: '600', color: '#D1D5DB' },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffText: { fontSize: 11, fontWeight: '700' },
  waypointsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  waypointsList: { flex: 1 },
  waypointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  waypointNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  waypointNumText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  waypointInfo: { flex: 1 },
  waypointName: { fontSize: 13, fontWeight: '600', color: '#E5E7EB' },
  waypointType: { fontSize: 11, color: '#6B7280', marginTop: 1, textTransform: 'capitalize' },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 10,
  },
  startBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
