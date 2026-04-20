/**
 * CulturalHubPlaylists — curated thematic route collections
 */
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface Playlist {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  routeIds: string[];
  tag?: string;
}

interface Props {
  playlists: Playlist[];
  onSelect: (playlist: Playlist) => void;
}

export const DEFAULT_PLAYLISTS: Playlist[] = [
  {
    id: 'pl_unesco',
    title: 'Rota UNESCO',
    subtitle: 'Apenas Património da Humanidade',
    icon: 'verified',
    color: '#F59E0B',
    routeIds: ['cr_mus_001', 'cr_dan_001', 'cr_fes_001', 'cr_int_001'],
    tag: 'UNESCO',
  },
  {
    id: 'pl_norte',
    title: 'Norte Profundo',
    subtitle: 'Minho, Douro, Trás-os-Montes',
    icon: 'terrain',
    color: '#10B981',
    routeIds: ['cr_mus_003', 'cr_dan_001', 'cr_ins_001', 'cr_fes_002'],
    tag: '5 rotas',
  },
  {
    id: 'pl_fim_semana',
    title: 'Fim de Semana Cultural',
    subtitle: 'Rotas de 2-3 dias',
    icon: 'weekend',
    color: '#3B82F6',
    routeIds: ['cr_mus_001', 'cr_dan_001', 'cr_mus_002'],
    tag: 'Curtas',
  },
  {
    id: 'pl_musica',
    title: 'Músicas de Portugal',
    subtitle: 'Fado, Gaita, Adufe, Brinquinho',
    icon: 'library-music',
    color: '#8B5CF6',
    routeIds: ['cr_mus_001', 'cr_mus_002', 'cr_mus_003', 'cr_ins_001'],
    tag: 'Musicais',
  },
  {
    id: 'pl_grande',
    title: 'Grande Viagem',
    subtitle: 'Portugal de Norte a Sul — 14 dias',
    icon: 'explore',
    color: '#EC4899',
    routeIds: ['cr_int_001'],
    tag: 'Premium',
  },
];

export default function CulturalHubPlaylists({ playlists, onSelect }: Props) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.titleRow}>
        <MaterialIcons name="playlist-play" size={15} color="#A855F7" />
        <Text style={styles.title}>Playlists Temáticas</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {playlists.map((pl) => (
          <TouchableOpacity key={pl.id} style={[styles.card, { borderColor: pl.color + '40' }]} onPress={() => onSelect(pl)} activeOpacity={0.75}>
            <View style={[styles.iconWrap, { backgroundColor: pl.color + '20' }]}>
              <MaterialIcons name={pl.icon} size={22} color={pl.color} />
            </View>
            {pl.tag && (
              <View style={[styles.tag, { backgroundColor: pl.color + '25' }]}>
                <Text style={[styles.tagText, { color: pl.color }]}>{pl.tag}</Text>
              </View>
            )}
            <Text style={styles.cardTitle} numberOfLines={2}>{pl.title}</Text>
            <Text style={styles.cardSub} numberOfLines={2}>{pl.subtitle}</Text>
            <View style={styles.routeCount}>
              <MaterialIcons name="route" size={11} color="#6B7280" />
              <Text style={styles.routeCountText}>{pl.routeIds.length} rotas</Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 16 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 13, fontWeight: '700', color: '#A855F7', letterSpacing: 0.4 },
  scroll: { gap: 10, paddingBottom: 4 },
  card: {
    width: 130, backgroundColor: '#1A0E30', borderRadius: 14,
    padding: 12, borderWidth: 1, gap: 6,
  },
  iconWrap: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 2 },
  tag: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tagText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#E2D9F3', lineHeight: 16 },
  cardSub: { fontSize: 10, color: '#7C6BA0', lineHeight: 14 },
  routeCount: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  routeCountText: { fontSize: 10, color: '#6B7280' },
});
