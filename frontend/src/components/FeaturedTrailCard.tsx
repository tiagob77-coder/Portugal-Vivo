/**
 * FeaturedTrailCard — presentational card for a curated trail (sourced from AllTrails).
 * Renders name, difficulty chip (using the trail's own `color`), region/park,
 * distance, duration, star rating and a "Ver no AllTrails" external link.
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { FeaturedTrail } from '../services/api/routes';

// ─── Difficulty labels (PT-PT) ────────────────────────────────────────────────

type Difficulty = 'facil' | 'moderado' | 'dificil' | 'muito_dificil';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  facil:         'Fácil',
  moderado:      'Moderado',
  dificil:       'Difícil',
  muito_dificil: 'Muito difícil',
};

const FALLBACK_COLOR = '#3F6F4A';

interface FeaturedTrailCardProps {
  trail: FeaturedTrail;
}

// ─── Component ────────────────────────────────────────────────────────────────

function FeaturedTrailCard({ trail }: FeaturedTrailCardProps) {
  const chipColor = trail.color || FALLBACK_COLOR;
  const difficultyLabel =
    (trail.difficulty && DIFFICULTY_LABEL[trail.difficulty as Difficulty]) || trail.difficulty || '—';

  const handleOpenAllTrails = () => {
    if (trail.external_url) {
      Linking.openURL(trail.external_url).catch(() => {});
    }
  };

  return (
    <View style={[styles.card, { borderLeftColor: chipColor }]}>
      {/* ── Header: name + difficulty chip ──────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={2}>{trail.name}</Text>
        <View style={[styles.difficultyChip, { backgroundColor: chipColor }]}>
          <Text style={styles.difficultyChipText}>{difficultyLabel}</Text>
        </View>
      </View>

      {/* ── Location: region / park ─────────────────────────────────────────── */}
      {(trail.region || trail.park) ? (
        <View style={styles.locationRow}>
          <MaterialIcons name="place" size={14} color="#6B7280" />
          <Text style={styles.locationText} numberOfLines={1}>
            {[trail.region, trail.park].filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}

      {/* ── Stats: distance · duration · rating ─────────────────────────────── */}
      <View style={styles.statsRow}>
        {trail.distance_km !== undefined && (
          <View style={styles.statItem}>
            <MaterialIcons name="straighten" size={14} color={chipColor} />
            <Text style={styles.statText}>{trail.distance_km} km</Text>
          </View>
        )}
        {trail.estimated_hours !== undefined && (
          <View style={styles.statItem}>
            <MaterialIcons name="schedule" size={14} color={chipColor} />
            <Text style={styles.statText}>{trail.estimated_hours} h</Text>
          </View>
        )}
        {trail.rating !== undefined && (
          <View style={styles.statItem}>
            <MaterialIcons name="star" size={14} color="#F59E0B" />
            <Text style={styles.statText}>{trail.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>

      {/* ── External link ───────────────────────────────────────────────────── */}
      {trail.external_url ? (
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={handleOpenAllTrails}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={`Ver ${trail.name} no AllTrails`}
        >
          <MaterialIcons name="open-in-new" size={16} color="#FFFFFF" />
          <Text style={styles.linkBtnText}>Ver no AllTrails</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: FALLBACK_COLOR,
    padding: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 8,
  },
  name: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
  },
  difficultyChip: {
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 4,
    flexShrink: 0,
  },
  difficultyChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 12,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1F4E79',
    borderRadius: 10,
    paddingVertical: 10,
  },
  linkBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default React.memo(FeaturedTrailCard);
