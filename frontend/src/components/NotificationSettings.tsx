/**
 * NotificationSettings - Settings panel for smart notification preferences.
 * Dark-themed card with toggles for proximity, events, digest, quiet hours,
 * and favorite region selection.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@portugal_vivo_notification_prefs';
const ACCENT = '#C49A6C';
const CARD_BG = '#1E293B';
const TEXT_PRIMARY = '#FAF8F3';
const TEXT_SECONDARY = '#94A3B8';
const SWITCH_TRACK_OFF = '#334155';
const SWITCH_TRACK_ON = '#C49A6C80';
const SWITCH_THUMB_OFF = '#64748B';

const REGIONS = [
  'Norte',
  'Centro',
  'Lisboa',
  'Alentejo',
  'Algarve',
  'Açores',
  'Madeira',
] as const;

type Region = (typeof REGIONS)[number];

interface NotificationPrefs {
  proximityEnabled: boolean;
  eventsEnabled: boolean;
  digestEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  favoriteRegions: Region[];
}

const DEFAULT_PREFS: NotificationPrefs = {
  proximityEnabled: true,
  eventsEnabled: true,
  digestEnabled: true,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  favoriteRegions: [],
};

const HOURS = Array.from({ length: 24 }, (_, i) =>
  `${i.toString().padStart(2, '0')}:00`
);

interface Props {
  onSave?: (prefs: NotificationPrefs) => void;
}

export default function NotificationSettings({ onSave }: Props) {
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<NotificationPrefs>;
        setPrefs({ ...DEFAULT_PREFS, ...saved });
      }
    } catch {
      // Use defaults
    }
    setLoaded(true);
  };

  const persist = useCallback(
    async (updated: NotificationPrefs) => {
      setPrefs(updated);
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Silently fail
      }
      onSave?.(updated);
    },
    [onSave],
  );

  const toggleBool = (key: keyof Pick<NotificationPrefs, 'proximityEnabled' | 'eventsEnabled' | 'digestEnabled'>) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    persist(updated);
  };

  const toggleRegion = (region: Region) => {
    const current = prefs.favoriteRegions;
    const updated = current.includes(region)
      ? current.filter((r) => r !== region)
      : [...current, region];
    persist({ ...prefs, favoriteRegions: updated });
  };

  const cycleHour = (key: 'quietHoursStart' | 'quietHoursEnd', direction: 1 | -1) => {
    const current = prefs[key];
    const idx = HOURS.indexOf(current);
    const next = (idx + direction + 24) % 24;
    persist({ ...prefs, [key]: HOURS[next] });
  };

  if (!loaded) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Notificações</Text>
      <Text style={styles.subheading}>
        Controle como e quando recebe alertas
      </Text>

      {/* ── Toggle rows ─────────────────────────────────────── */}
      <View style={styles.card}>
        <ToggleRow
          icon="near-me"
          title="Proximidade"
          subtitle="Alertas quando perto de POIs interessantes"
          value={prefs.proximityEnabled}
          onToggle={() => toggleBool('proximityEnabled')}
        />
        <View style={styles.separator} />
        <ToggleRow
          icon="event"
          title="Eventos"
          subtitle="Eventos e festas na sua região"
          value={prefs.eventsEnabled}
          onToggle={() => toggleBool('eventsEnabled')}
        />
        <View style={styles.separator} />
        <ToggleRow
          icon="mail-outline"
          title="Resumo semanal"
          subtitle="Novos POIs, eventos e progresso"
          value={prefs.digestEnabled}
          onToggle={() => toggleBool('digestEnabled')}
        />
      </View>

      {/* ── Quiet hours ─────────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="do-not-disturb" size={20} color={ACCENT} />
          <Text style={styles.sectionTitle}>Horas silenciosas</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Sem notificações durante este período
        </Text>
        <View style={styles.quietRow}>
          <TimePicker
            label="Início"
            value={prefs.quietHoursStart}
            onIncrement={() => cycleHour('quietHoursStart', 1)}
            onDecrement={() => cycleHour('quietHoursStart', -1)}
          />
          <MaterialIcons name="arrow-forward" size={18} color={TEXT_SECONDARY} />
          <TimePicker
            label="Fim"
            value={prefs.quietHoursEnd}
            onIncrement={() => cycleHour('quietHoursEnd', 1)}
            onDecrement={() => cycleHour('quietHoursEnd', -1)}
          />
        </View>
      </View>

      {/* ── Favorite regions ────────────────────────────────── */}
      <View style={styles.card}>
        <View style={styles.sectionHeader}>
          <MaterialIcons name="map" size={20} color={ACCENT} />
          <Text style={styles.sectionTitle}>Regiões favoritas</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Receba alertas e digests para estas regiões
        </Text>
        <View style={styles.chipContainer}>
          {REGIONS.map((region) => {
            const selected = prefs.favoriteRegions.includes(region);
            return (
              <TouchableOpacity
                key={region}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleRegion(region)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {region}
                </Text>
                {selected && (
                  <MaterialIcons name="check" size={14} color={CARD_BG} style={{ marginLeft: 4 }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────────── */

function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onToggle,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <MaterialIcons
        name={icon}
        size={22}
        color={value ? ACCENT : TEXT_SECONDARY}
      />
      <View style={styles.toggleText}>
        <Text style={styles.toggleTitle}>{title}</Text>
        <Text style={styles.toggleSubtitle}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: SWITCH_TRACK_OFF, true: SWITCH_TRACK_ON }}
        thumbColor={value ? ACCENT : SWITCH_THUMB_OFF}
        {...(Platform.OS === 'ios' ? { ios_backgroundColor: SWITCH_TRACK_OFF } : {})}
      />
    </View>
  );
}

function TimePicker({
  label,
  value,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <View style={styles.timePicker}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timeControls}>
        <TouchableOpacity onPress={onDecrement} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="remove-circle-outline" size={22} color={TEXT_SECONDARY} />
        </TouchableOpacity>
        <Text style={styles.timeValue}>{value}</Text>
        <TouchableOpacity onPress={onIncrement} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialIcons name="add-circle-outline" size={22} color={TEXT_SECONDARY} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 13,
    color: TEXT_SECONDARY,
    marginBottom: 20,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  separator: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },

  /* Toggle rows */
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  toggleText: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },

  /* Section headers */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginBottom: 14,
  },

  /* Quiet hours */
  quietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  timePicker: {
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeValue: {
    fontSize: 20,
    fontWeight: '700',
    color: ACCENT,
    minWidth: 56,
    textAlign: 'center',
  },

  /* Region chips */
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#334155',
    borderWidth: 1,
    borderColor: '#475569',
  },
  chipSelected: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  chipTextSelected: {
    color: CARD_BG,
    fontWeight: '600',
  },
});
