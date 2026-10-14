/**
 * ExplorerPanel — Real-time technical overlays (weather / fires / surf)
 * shown when the user enters the `explorador` map mode.
 *
 * Extracted from the inline panel in mapa.tsx; the previous inline version
 * stacked white-on-white text over the map tiles and failed WCAG AA
 * (~1.7:1 contrast over the Voyager sand background). This component
 * provides an opaque dark backdrop so every text/background pair sits
 * above 4.5:1 regardless of the map tile underneath.
 */
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { palette } from '../../theme';

export interface ExplorerWeather {
  location?: string;
  forecasts?: Array<{
    weather_description?: string;
    temp_max?: number;
  }>;
}

export interface ExplorerFires {
  active_count?: number;
}

export interface ExplorerSurf {
  spots?: Array<{
    spot?: { name?: string };
    wave_height_m?: number;
    surf_quality?: string;
  }>;
}

export interface ExplorerPanelProps {
  weather?: ExplorerWeather;
  fires?: ExplorerFires;
  surf?: ExplorerSurf;
}

// Opaque dark surface for cards — fixed at 92 % alpha so light map tiles
// underneath don't bleed through enough to drop contrast.
const SURFACE = 'rgba(15, 23, 42, 0.92)';
const SURFACE_CARD = 'rgba(30, 41, 59, 0.95)';

// `backdropFilter` is web-only; on native React Native it falls through.
// Wrap in Platform.select so iOS/Android don't choke on the unknown key.
const blurStyle = Platform.select({
  web: { backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' },
  default: undefined,
}) as any;

export default function ExplorerPanel({ weather, fires, surf }: ExplorerPanelProps) {
  const { t } = useTranslation();
  const w0 = weather?.forecasts?.[0];
  const s0 = surf?.spots?.[0];
  const fireCount = fires?.active_count;
  const fireColor =
    fireCount == null
      ? palette.gray[300]
      : fireCount > 0
      ? palette.rust[500]
      : palette.mint[600];

  return (
    <View style={[styles.wrapper, blurStyle]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        accessibilityLabel={t('mapScreen.explorer.a11yLabel')}
      >
        <View style={styles.inner}>
          <Text style={styles.title}>{t('mapScreen.explorer.title')}</Text>

          {w0 && (
            <View style={styles.card}>
              <MaterialIcons name="wb-sunny" size={20} color={palette.terracotta[400]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>
                  {t('mapScreen.explorer.weather', { location: weather?.location ?? 'Lisboa' })}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {w0.weather_description}
                  {typeof w0.temp_max === 'number'
                    ? ` · ${t('mapScreen.explorer.tempMax', { temp: w0.temp_max })}`
                    : ''}
                </Text>
              </View>
            </View>
          )}

          <View style={styles.card}>
            <MaterialIcons name="local-fire-department" size={20} color={fireColor} />
            <View style={styles.cardBody}>
              <Text style={styles.cardTitle}>{t('mapScreen.explorer.fireRisk')}</Text>
              <Text style={styles.cardSubtitle}>
                {fireCount != null
                  ? fireCount === 1
                    ? t('mapScreen.explorer.fireOne', { count: fireCount })
                    : t('mapScreen.explorer.fireMany', { count: fireCount })
                  : t('common.loading')}
              </Text>
            </View>
          </View>

          {s0 && (
            <View style={styles.card}>
              <MaterialIcons name="waves" size={20} color={palette.ocean[400]} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>
                  {t('mapScreen.explorer.sea', {
                    spot: s0.spot?.name ?? t('mapScreen.explorer.coast'),
                  })}
                </Text>
                <Text style={styles.cardSubtitle}>
                  {typeof s0.wave_height_m === 'number'
                    ? t('mapScreen.explorer.waves', { height: s0.wave_height_m })
                    : t('mapScreen.explorer.noReading')}
                  {s0.surf_quality ? ` · ${s0.surf_quality}` : ''}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: SURFACE,
    borderRadius: 14,
    marginHorizontal: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  scroll: {
    maxHeight: 220,
  },
  inner: {
    padding: 12,
    gap: 8,
  },
  title: {
    color: palette.white,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 4,
  },
  card: {
    backgroundColor: SURFACE_CARD,
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardBody: {
    flex: 1,
  },
  cardTitle: {
    color: palette.white,
    fontWeight: '600',
    fontSize: 13,
  },
  cardSubtitle: {
    // gray.200 (#E5E0D5) on SURFACE_CARD (#1E293B-ish) → ~10.5:1 → AAA.
    color: palette.gray[200],
    fontSize: 12,
    marginTop: 2,
  },
});
