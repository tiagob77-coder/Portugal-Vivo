/**
 * PrehistoriaCard — card component for prehistoric / megalithic / rock-art sites
 */
import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PrehistoriaSite {
  id: string;
  name: string;
  category: 'geositio' | 'megalito' | 'rupestre' | 'santuario' | 'arqueologico';
  subcategory?: string;
  period: 'Paleolitico' | 'Neolitico' | 'Calcolitico' | 'Bronze' | 'Ferro';
  region: string;
  municipality?: string;
  lat: number;
  lng: number;
  description_short: string;
  description_long?: string;
  motifs_findings?: string[];
  age_years?: number;
  orientation?: number;
  astronomical_type?: 'solar' | 'lunar' | 'estelar' | 'equinocio' | 'solsticio';
  alignment_azimuth?: number;
  celestial_event?: { solstice?: string; equinox?: string };
  photos?: string[];
  iq_score?: number;
  distance_km?: number;
}

interface PrehistoriaCardProps {
  site: PrehistoriaSite;
  expanded?: boolean;
  onPress?: () => void;
}

// ─── Color Maps ───────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<PrehistoriaSite['category'], string> = {
  geositio:    '#7C3AED',
  megalito:    '#B45309',
  rupestre:    '#B91C1C',
  santuario:   '#0F766E',
  arqueologico:'#1D4ED8',
};

const CATEGORY_ICONS: Record<PrehistoriaSite['category'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  geositio:    'terrain',
  megalito:    'account-balance',
  rupestre:    'brush',
  santuario:   'star',
  arqueologico:'explore',
};

const CATEGORY_LABELS: Record<PrehistoriaSite['category'], string> = {
  geositio:    'Geossítio',
  megalito:    'Megalito',
  rupestre:    'Arte Rupestre',
  santuario:   'Santuário',
  arqueologico:'Arqueológico',
};

const PERIOD_COLORS: Record<PrehistoriaSite['period'], string> = {
  Paleolitico: '#DC2626',
  Neolitico:   '#16A34A',
  Calcolitico: '#D97706',
  Bronze:      '#EA580C',
  Ferro:       '#2563EB',
};

const PERIOD_LABELS: Record<PrehistoriaSite['period'], string> = {
  Paleolitico: 'Paleolítico',
  Neolitico:   'Neolítico',
  Calcolitico: 'Calcolítico',
  Bronze:      'Bronze',
  Ferro:       'Ferro',
};

const ASTRO_LABELS: Record<NonNullable<PrehistoriaSite['astronomical_type']>, string> = {
  solar:     '☀️ Alinhamento Solar',
  lunar:     '🌙 Alinhamento Lunar',
  estelar:   '⭐ Estelar',
  equinocio: '☀️ Equinócio',
  solsticio: '☀️ Solstício',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAge(years: number): string {
  return years.toLocaleString('pt-PT') + ' a.C.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrehistoriaCard({ site, expanded = false, onPress }: PrehistoriaCardProps) {
  const accentColor = CATEGORY_COLORS[site.category];
  const categoryIcon = CATEGORY_ICONS[site.category];
  const categoryLabel = CATEGORY_LABELS[site.category];
  const periodColor = PERIOD_COLORS[site.period];
  const periodLabel = PERIOD_LABELS[site.period];

  const visibleMotifs = site.motifs_findings ? site.motifs_findings.slice(0, 4) : [];

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* ── Accent Bar ─────────────────────────────────────────────────────── */}
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />

      {/* ── Card Content ───────────────────────────────────────────────────── */}
      <View style={styles.content}>

        {/* ── Header Row ───────────────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <View style={[styles.categoryIconWrap, { backgroundColor: accentColor + '22' }]}>
            <MaterialIcons name={categoryIcon} size={18} color={accentColor} />
          </View>

          <View style={styles.headerMeta}>
            <Text style={styles.siteName} numberOfLines={2}>{site.name}</Text>
            <View style={styles.headerBadges}>
              {/* Category label */}
              <View style={[styles.categoryBadge, { backgroundColor: accentColor + '22', borderColor: accentColor + '55' }]}>
                <Text style={[styles.categoryBadgeText, { color: accentColor }]}>{categoryLabel}</Text>
              </View>
              {/* Period badge */}
              <View style={[styles.periodBadge, { backgroundColor: periodColor + '22', borderColor: periodColor + '55' }]}>
                <Text style={[styles.periodBadgeText, { color: periodColor }]}>{periodLabel}</Text>
              </View>
            </View>
          </View>

          {/* IQ Score */}
          {site.iq_score !== undefined && (
            <View style={styles.iqBadge}>
              <Text style={styles.iqScore}>{site.iq_score}</Text>
              <Text style={styles.iqLabel}>IQ</Text>
            </View>
          )}
        </View>

        {/* ── Region / Age / Distance Row ──────────────────────────────────── */}
        <View style={styles.metaRow}>
          <MaterialIcons name="place" size={12} color="#9CA3AF" />
          <Text style={styles.metaText}>{site.region}</Text>
          {site.municipality ? (
            <>
              <Text style={styles.metaSep}>·</Text>
              <Text style={styles.metaText}>{site.municipality}</Text>
            </>
          ) : null}
          {site.age_years !== undefined ? (
            <>
              <Text style={styles.metaSep}>·</Text>
              <MaterialIcons name="history" size={12} color="#9CA3AF" />
              <Text style={styles.metaText}>{formatAge(site.age_years)}</Text>
            </>
          ) : null}
          {site.distance_km !== undefined ? (
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceText}>{site.distance_km.toFixed(1)} km</Text>
            </View>
          ) : null}
        </View>

        {/* ── Description Short ────────────────────────────────────────────── */}
        <Text style={styles.descShort} numberOfLines={expanded ? undefined : 2}>
          {site.description_short}
        </Text>

        {/* ── Astronomical Alignment ───────────────────────────────────────── */}
        {site.astronomical_type ? (
          <View style={styles.astroRow}>
            <View style={styles.astroChip}>
              <Text style={styles.astroChipText}>
                {ASTRO_LABELS[site.astronomical_type]}
                {site.alignment_azimuth !== undefined
                  ? '  ' + site.alignment_azimuth + '\u00b0'
                  : ''}
              </Text>
            </View>
          </View>
        ) : null}

        {/* ── Motifs / Findings chips ──────────────────────────────────────── */}
        {visibleMotifs.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.motifsContent}
            style={styles.motifsScroll}
          >
            {visibleMotifs.map((motif) => (
              <View key={motif} style={styles.motifChip}>
                <Text style={styles.motifChipText}>{motif}</Text>
              </View>
            ))}
            {site.motifs_findings && site.motifs_findings.length > 4 ? (
              <View style={styles.motifMoreChip}>
                <Text style={styles.motifMoreText}>+{site.motifs_findings.length - 4}</Text>
              </View>
            ) : null}
          </ScrollView>
        ) : null}

        {/* ── Expanded Section ─────────────────────────────────────────────── */}
        {expanded ? (
          <View style={styles.expandedSection}>
            {site.description_long ? (
              <Text style={styles.descLong}>{site.description_long}</Text>
            ) : null}

            {site.celestial_event ? (
              <View style={styles.celestialBox}>
                <View style={styles.celestialHeader}>
                  <MaterialIcons name="brightness-5" size={14} color="#D97706" />
                  <Text style={styles.celestialTitle}>Evento Celeste</Text>
                </View>
                {site.celestial_event.solstice ? (
                  <Text style={styles.celestialText}>Solstício: {site.celestial_event.solstice}</Text>
                ) : null}
                {site.celestial_event.equinox ? (
                  <Text style={styles.celestialText}>Equinócio: {site.celestial_event.equinox}</Text>
                ) : null}
              </View>
            ) : null}

            {site.orientation !== undefined ? (
              <View style={styles.orientRow}>
                <MaterialIcons name="navigation" size={13} color="#9CA3AF" />
                <Text style={styles.orientText}>Orientação: {site.orientation}°</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Expand indicator ─────────────────────────────────────────────── */}
        <View style={styles.expandRow}>
          <MaterialIcons
            name={expanded ? 'expand-less' : 'expand-more'}
            size={18}
            color="#6B7280"
          />
        </View>

      </View>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#2C1F0E',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#3D2B14',
    marginBottom: 2,
  },
  accentBar: {
    width: 4,
    minHeight: 60,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 8,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  categoryIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerMeta: {
    flex: 1,
    gap: 4,
  },
  siteName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F5ECD4',
    lineHeight: 20,
  },
  headerBadges: {
    flexDirection: 'row',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  periodBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  periodBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // IQ
  iqBadge: {
    alignItems: 'center',
    flexShrink: 0,
  },
  iqScore: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6B7280',
  },
  iqLabel: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  metaSep: {
    fontSize: 12,
    color: '#6B7280',
  },
  distanceBadge: {
    backgroundColor: '#3D2B14',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 4,
  },
  distanceText: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '600',
  },

  // Description
  descShort: {
    fontSize: 13,
    color: '#C8B08A',
    lineHeight: 19,
  },

  // Astronomical
  astroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  astroChip: {
    backgroundColor: '#3B2A0A',
    borderWidth: 1,
    borderColor: '#D97706' + '55',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  astroChipText: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '600',
  },

  // Motifs
  motifsScroll: {
    marginTop: 2,
  },
  motifsContent: {
    gap: 6,
  },
  motifChip: {
    backgroundColor: '#3D2B14',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#5C3D1E',
  },
  motifChipText: {
    fontSize: 11,
    color: '#C8B08A',
    fontWeight: '500',
  },
  motifMoreChip: {
    backgroundColor: '#2C1F0E',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#5C3D1E',
    justifyContent: 'center',
  },
  motifMoreText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },

  // Expanded
  expandedSection: {
    gap: 10,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#3D2B14',
    marginTop: 4,
  },
  descLong: {
    fontSize: 13,
    color: '#C8B08A',
    lineHeight: 20,
  },
  celestialBox: {
    backgroundColor: '#3B2A0A',
    borderRadius: 10,
    padding: 10,
    gap: 4,
    borderWidth: 1,
    borderColor: '#D97706' + '33',
  },
  celestialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  celestialTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  celestialText: {
    fontSize: 13,
    color: '#C8B08A',
    lineHeight: 18,
  },
  orientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  orientText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Expand indicator
  expandRow: {
    alignItems: 'center',
    marginTop: 2,
  },
});
