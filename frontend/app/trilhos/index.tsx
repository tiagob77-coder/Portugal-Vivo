/**
 * Trilhos em destaque — curated trails sourced from AllTrails (real difficulty,
 * distance, elevation and rating). Consumes GET /api/trails/featured.
 */
import React from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity,
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

export default function FeaturedTrailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, isLoading } = useQuery({
    queryKey: ['featured-trails'],
    queryFn: () => getFeaturedTrails(),
  });

  const trails: FeaturedTrail[] = data?.trails ?? [];

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

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={C.accent} />
        </View>
      ) : trails.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="hiking" size={40} color={C.textMed} />
          <Text style={styles.emptyText}>Sem trilhos disponíveis.</Text>
        </View>
      ) : (
        <FlatList
          data={trails}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <FeaturedTrailCard trail={item} />}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyText: { fontSize: 14, color: C.textMed },
  list: { padding: 16 },
  separator: { height: 12 },
  attribution: {
    marginTop: 16, fontSize: 11, color: C.textMed, textAlign: 'center',
  },
});
