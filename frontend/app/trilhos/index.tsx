/**
 * Trilhos em destaque — curated trails sourced from AllTrails (real difficulty,
 * distance, elevation and rating). Consumes GET /api/trails/featured, with
 * difficulty + region filters (server-side via query params).
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getFeaturedTrails, FeaturedTrail } from '../../src/services/api/routes';
import FeaturedTrailCard from '../../src/components/FeaturedTrailCard';

const C = {
  bg: '#F3F4F6',
  accent: '#1F4E79',
  textDark: '#1F2937',
  textMed: '#6B7280',
  border: '#E5E7EB',
};

const DIFFICULTIES = [
  { key: 'facil', label: 'Fácil', color: '#16A34A' },
  { key: 'moderado', label: 'Moderado', color: '#F59E0B' },
  { key: 'dificil', label: 'Difícil', color: '#EA580C' },
];

const REGIONS = ['Norte', 'Centro', 'Lisboa', 'Alentejo', 'Açores', 'Madeira'];

export default function FeaturedTrailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [difficulty, setDifficulty] = useState('');
  const [region, setRegion] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['featured-trails', difficulty, region],
    queryFn: () => getFeaturedTrails({
      difficulty: difficulty || undefined,
      region: region || undefined,
    }),
  });

  const trails: FeaturedTrail[] = data?.trails ?? [];
  const hasFilters = !!(difficulty || region);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={24} color={C.textDark} />
        </TouchableOpacity>
        <Text style={styles.title}>Trilhos em destaque</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d.key;
            return (
              <TouchableOpacity
                key={d.key}
                style={[styles.chip, active && { backgroundColor: d.color, borderColor: d.color }]}
                onPress={() => setDifficulty(active ? '' : d.key)}
                accessibilityRole="button"
                accessibilityLabel={`Dificuldade ${d.label}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {REGIONS.map((r) => {
            const active = region === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setRegion(active ? '' : r)}
                accessibilityRole="button"
                accessibilityLabel={`Região ${r}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : trails.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="hiking" size={40} color={C.textMed} />
          <Text style={styles.emptyText}>
            {hasFilters ? 'Sem trilhos para este filtro.' : 'Sem trilhos disponíveis.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => (
            <FeaturedTrailCard
              trail={item}
              onPress={(id) => router.push(`/trilhos/${id}`)}
            />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListFooterComponent={
            data?.attribution ? (
              <Text style={styles.attribution}>{data.attribution}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  headerSpacer: { width: 24 },
  title: { fontSize: 18, fontWeight: '700', color: C.textDark },
  filters: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  chipsRow: { paddingHorizontal: 12, gap: 8, paddingVertical: 4 },
  chip: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  chipActive: { backgroundColor: C.accent, borderColor: C.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: C.textMed },
  chipTextActive: { color: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: C.textMed },
  list: { padding: 16 },
  separator: { height: 12 },
  attribution: {
    marginTop: 16, fontSize: 11, color: C.textMed, textAlign: 'center',
  },
});
