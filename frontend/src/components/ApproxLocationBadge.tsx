/**
 * ApproxLocationBadge — small inline pill that signals when a POI's
 * coordinates were resolved from a centroid (municipality / district /
 * region) instead of a precise address.
 *
 * Backend writes `coord_approximate: true` + `coord_precision` on every
 * POI updated by apply_poi_gps_v19 (GEO-004). This component is the
 * single rendering point so all surfaces (POICard, map popup, detail
 * page) show the same wording and colour.
 *
 * Intentionally tiny — does NOT render when `precision === "precise"` or
 * when the helper isn't given any signal at all. Callers can just splat
 * the POI's GPS fields and trust the badge to disappear on precise rows.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { palette } from '../theme';

export type CoordPrecision = 'precise' | 'municipality' | 'district' | 'region';

export interface ApproxLocationBadgeProps {
  /** Distance label shown to the user — "Concelho", "Distrito", "Região". */
  precision?: CoordPrecision | string | null;
  /** Explicit boolean from the backend; takes priority over precision string. */
  approximate?: boolean;
  /** Compact mode for tight spaces (map popups). Defaults to false. */
  compact?: boolean;
}

const LABELS: Record<CoordPrecision, string> = {
  precise: '',
  municipality: 'localização aprox. (concelho)',
  district: 'localização aprox. (distrito)',
  region: 'localização aprox. (região)',
};

const COMPACT_LABELS: Record<CoordPrecision, string> = {
  precise: '',
  municipality: 'aprox. concelho',
  district: 'aprox. distrito',
  region: 'aprox. região',
};

/** Returns true when this POI deserves the badge. Pure for unit-testing. */
export function shouldShowApprox(
  precision?: string | null,
  approximate?: boolean,
): boolean {
  if (approximate === false) return false;
  if (precision === 'precise') return false;
  if (approximate === true) return true;
  return precision === 'municipality' || precision === 'district' || precision === 'region';
}

export default function ApproxLocationBadge({
  precision,
  approximate,
  compact = false,
}: ApproxLocationBadgeProps) {
  if (!shouldShowApprox(precision, approximate)) return null;

  const labels = compact ? COMPACT_LABELS : LABELS;
  // Fallback label when approximate=true but precision is missing/unknown.
  const text =
    (precision && labels[precision as CoordPrecision]) ||
    (compact ? 'localização aprox.' : 'localização aproximada');

  return (
    <View
      style={[styles.badge, compact && styles.badgeCompact]}
      accessibilityRole="text"
      accessibilityLabel={text}
      testID="approx-location-badge"
    >
      <MaterialIcons
        name="info-outline"
        size={compact ? 11 : 13}
        color={palette.terracotta[700]}
      />
      <Text style={[styles.text, compact && styles.textCompact]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: palette.terracotta[50],
    borderWidth: 1,
    borderColor: palette.terracotta[100],
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  text: {
    color: palette.terracotta[700],
    fontSize: 11,
    fontWeight: '600',
  },
  textCompact: {
    fontSize: 10,
  },
});
