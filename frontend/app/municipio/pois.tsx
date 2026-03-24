/**
 * Painel Municipal — Gestão de POIs
 *
 * Lista, filtra, pesquisa e gere os POIs do município.
 * Suporta publicar/despublicar, eliminar e navegar para edição.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../src/services/api';
import { shadows } from '../../src/theme';
import { useAuth } from '../../src/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Poi {
  id: string;
  name: string;
  category: string;
  region: string;
  content_health_score: number;
  status: 'published' | 'draft' | string;
  location?: { lat: number; lng: number };
}

interface PoisResponse {
  pois: Poi[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#2E5E4E';
const BG = '#F8FAFC';
const isWeb = Platform.OS === 'web';

const CATEGORIES = [
  'Todos',
  'historia',
  'natureza',
  'museus',
  'praias',
  'religioso',
  'gastronomia',
  'percursos',
] as const;

type CategoryFilter = typeof CATEGORIES[number];

type StatusFilter = 'Todos' | 'Publicados' | 'Rascunho' | 'Críticos';

const STATUS_FILTERS: StatusFilter[] = ['Todos', 'Publicados', 'Rascunho', 'Críticos'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getHealthColor(score: number): string {
  if (score >= 75) return '#22C55E';
  if (score >= 50) return '#F59E0B';
  if (score >= 25) return '#F97316';
  return '#EF4444';
}

function matchesStatus(poi: Poi, filter: StatusFilter): boolean {
  if (filter === 'Todos') return true;
  if (filter === 'Publicados') return poi.status === 'published';
  if (filter === 'Rascunho') return poi.status === 'draft';
  if (filter === 'Críticos') return poi.content_health_score < 25;
  return true;
}

function matchesCategory(poi: Poi, filter: CategoryFilter): boolean {
  if (filter === 'Todos') return true;
  return poi.category?.toLowerCase() === filter.toLowerCase();
}

function matchesSearch(poi: Poi, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return (
    poi.name?.toLowerCase().includes(q) ||
    poi.category?.toLowerCase().includes(q) ||
    poi.region?.toLowerCase().includes(q)
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[s.chip, active && s.chipActive]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[s.chipText, active && s.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <View style={s.emptyWrap}>
      <MaterialIcons name="place" size={48} color="#CBD5E1" />
      <Text style={s.emptyTitle}>{message}</Text>
    </View>
  );
}

function NoPartnerState() {
  const router = useRouter();
  return (
    <View style={s.emptyWrap}>
      <MaterialIcons name="location-city" size={56} color="#CBD5E1" />
      <Text style={s.emptyTitle}>Ainda não tens organização parceira</Text>
      <Text style={s.emptySubtitle}>
        Para gerir POIs, a tua câmara ou organização precisa de estar registada como
        parceira do Portugal Vivo.
      </Text>
      <TouchableOpacity
        style={s.emptyButton}
        onPress={() => router.push('/partner-portal' as any)}
        activeOpacity={0.8}
      >
        <Text style={s.emptyButtonText}>Registar organização</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── POI Row / Card ───────────────────────────────────────────────────────────

function PoiRow({
  poi,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  poi: Poi;
  onEdit: (poi: Poi) => void;
  onDelete: (poi: Poi) => void;
  onTogglePublish: (poi: Poi) => void;
}) {
  const color = getHealthColor(poi.content_health_score);
  const isPublished = poi.status === 'published';

  if (isWeb) {
    // Table row style on web
    return (
      <View style={s.tableRow}>
        <View style={[s.healthDot, { backgroundColor: color }]} />
        <View style={s.colName}>
          <Text style={s.poiName} numberOfLines={1}>{poi.name}</Text>
          <Text style={s.poiRegion}>{poi.region}</Text>
        </View>
        <View style={s.colCategory}>
          <View style={[s.catBadge, { backgroundColor: color + '18' }]}>
            <Text style={[s.catBadgeText, { color }]}>{poi.category}</Text>
          </View>
        </View>
        <View style={s.colScore}>
          <Text style={[s.scoreText, { color }]}>{poi.content_health_score}</Text>
        </View>
        <View style={s.colStatus}>
          <View style={[s.statusBadge, isPublished ? s.statusPublished : s.statusDraft]}>
            <Text style={[s.statusText, isPublished ? s.statusTextPub : s.statusTextDraft]}>
              {isPublished ? 'Publicado' : 'Rascunho'}
            </Text>
          </View>
        </View>
        <View style={s.colActions}>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => onEdit(poi)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons name="edit" size={16} color="#64748B" />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => onTogglePublish(poi)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons
              name={isPublished ? 'unpublished' : 'publish'}
              size={16}
              color={isPublished ? '#F59E0B' : ACCENT}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => onDelete(poi)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Card style on mobile
  return (
    <TouchableOpacity
      style={s.poiCard}
      onPress={() => onEdit(poi)}
      activeOpacity={0.75}
    >
      {/* Top row */}
      <View style={s.poiCardTop}>
        <View style={[s.healthDot, { backgroundColor: color, width: 10, height: 10 }]} />
        <Text style={s.poiName} numberOfLines={1}>{poi.name}</Text>
        <View style={[s.statusBadge, isPublished ? s.statusPublished : s.statusDraft]}>
          <Text style={[s.statusText, isPublished ? s.statusTextPub : s.statusTextDraft]}>
            {isPublished ? 'Publicado' : 'Rascunho'}
          </Text>
        </View>
      </View>

      {/* Meta row */}
      <View style={s.poiCardMeta}>
        <View style={[s.catBadge, { backgroundColor: color + '18' }]}>
          <Text style={[s.catBadgeText, { color }]}>{poi.category}</Text>
        </View>
        {!!poi.region && (
          <Text style={s.poiRegion}>{poi.region}</Text>
        )}
        <View style={{ flex: 1 }} />
        <Text style={[s.scoreText, { color }]}>
          Score: {poi.content_health_score}
        </Text>
      </View>

      {/* Action row */}
      <View style={s.poiCardActions}>
        <TouchableOpacity
          style={s.mobileActionBtn}
          onPress={() => onEdit(poi)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="edit" size={15} color="#64748B" />
          <Text style={s.mobileActionText}>Editar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.mobileActionBtn}
          onPress={() => onTogglePublish(poi)}
          activeOpacity={0.7}
        >
          <MaterialIcons
            name={isPublished ? 'unpublished' : 'publish'}
            size={15}
            color={isPublished ? '#F59E0B' : ACCENT}
          />
          <Text style={[s.mobileActionText, { color: isPublished ? '#F59E0B' : ACCENT }]}>
            {isPublished ? 'Despublicar' : 'Publicar'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.mobileActionBtn}
          onPress={() => onDelete(poi)}
          activeOpacity={0.7}
        >
          <MaterialIcons name="delete-outline" size={15} color="#EF4444" />
          <Text style={[s.mobileActionText, { color: '#EF4444' }]}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MunicipioPois() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionToken } = useAuth();
  const queryClient = useQueryClient();
  const _params = useLocalSearchParams<{ new?: string }>(); // eslint-disable-line @typescript-eslint/no-unused-vars

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');

  const authHeaders = sessionToken
    ? { Authorization: `Bearer ${sessionToken}` }
    : {};

  // ── Fetch POIs ──────────────────────────────────────────────────────────────

  const {
    data: poisData,
    isLoading,
    error,
    refetch,
  } = useQuery<PoisResponse>({
    queryKey: ['partner-pois'],
    queryFn: async () => {
      const response = await api.get('/partner/pois', {
        headers: authHeaders,
      });
      return response.data;
    },
    retry: false,
  });

  // ── Delete mutation ─────────────────────────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: async (poiId: string) => {
      await api.delete(`/partner/pois/${poiId}`, {
        headers: authHeaders,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-pois'] });
      queryClient.invalidateQueries({ queryKey: ['partner-metrics'] });
    },
  });

  // ── Toggle publish mutation ─────────────────────────────────────────────────

  const togglePublishMutation = useMutation({
    mutationFn: async (poi: Poi) => {
      await api.patch(
        `/partner/pois/${poi.id}/draft`,
        { status: poi.status === 'published' ? 'draft' : 'published' },
        { headers: authHeaders },
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partner-pois'] });
      queryClient.invalidateQueries({ queryKey: ['partner-metrics'] });
    },
  });

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleEdit = useCallback((poi: Poi) => {
    router.push(`/heritage/${poi.id}` as any);
  }, [router]);

  const handleDelete = useCallback((poi: Poi) => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-restricted-globals
      if (confirm(`Eliminar "${poi.name}"? Esta ação não pode ser desfeita.`)) {
        deleteMutation.mutate(poi.id);
      }
    } else {
      Alert.alert(
        'Eliminar POI',
        `Tens a certeza que queres eliminar "${poi.name}"? Esta ação não pode ser desfeita.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Eliminar',
            style: 'destructive',
            onPress: () => deleteMutation.mutate(poi.id),
          },
        ],
      );
    }
  }, [deleteMutation]);

  const handleTogglePublish = useCallback((poi: Poi) => {
    const action = poi.status === 'published' ? 'despublicar' : 'publicar';
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-restricted-globals
      if (confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} "${poi.name}"?`)) {
        togglePublishMutation.mutate(poi);
      }
    } else {
      Alert.alert(
        `${action.charAt(0).toUpperCase() + action.slice(1)} POI`,
        `Tens a certeza que queres ${action} "${poi.name}"?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: action.charAt(0).toUpperCase() + action.slice(1),
            onPress: () => togglePublishMutation.mutate(poi),
          },
        ],
      );
    }
  }, [togglePublishMutation]);

  // ── Filtered list ───────────────────────────────────────────────────────────

  const allPois: Poi[] = (poisData as any)?.pois ?? [];

  const filtered = allPois.filter(
    (p) =>
      matchesSearch(p, search) &&
      matchesCategory(p, categoryFilter) &&
      matchesStatus(p, statusFilter),
  );

  // ── 403 guard ───────────────────────────────────────────────────────────────

  if ((error as any)?.response?.status === 403) {
    return (
      <View style={[s.root, { paddingTop: isWeb ? 0 : insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <NoPartnerState />
      </View>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { paddingTop: isWeb ? 0 : 0 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      {!isWeb && (
        <View style={[s.mobileHeader, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons name="arrow-back" size={24} color="#1E293B" />
          </TouchableOpacity>
          <Text style={s.mobileHeaderTitle}>Os Meus POIs</Text>
          <TouchableOpacity
            style={s.newBtn}
            onPress={() => router.push('/heritage/new' as any)}
            activeOpacity={0.8}
          >
            <MaterialIcons name="add" size={18} color="#FFFFFF" />
            <Text style={s.newBtnText}>Novo</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={[s.content, isWeb && s.contentWeb]}>
        {/* Web page title row */}
        {isWeb && (
          <View style={s.pageHeaderRow}>
            <Text style={s.pageTitle}>Os Meus POIs</Text>
            <TouchableOpacity
              style={s.newBtnLarge}
              onPress={() => router.push('/heritage/new' as any)}
              activeOpacity={0.8}
            >
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={s.newBtnLargeText}>Novo POI</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search bar */}
        <View style={s.searchRow}>
          <View style={s.searchWrap}>
            <MaterialIcons name="search" size={18} color="#94A3B8" style={s.searchIcon} />
            <TextInput
              style={s.searchInput}
              placeholder="Pesquisar POIs..."
              placeholderTextColor="#94A3B8"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {!!search && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <MaterialIcons name="close" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Category chips */}
        <View style={s.chipsRow}>
          {CATEGORIES.map((cat) => (
            <FilterChip
              key={cat}
              label={cat === 'Todos' ? 'Todos' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              active={categoryFilter === cat}
              onPress={() => setCategoryFilter(cat)}
            />
          ))}
        </View>

        {/* Status filter chips */}
        <View style={[s.chipsRow, { marginTop: -4 }]}>
          {STATUS_FILTERS.map((sf) => (
            <FilterChip
              key={sf}
              label={sf}
              active={statusFilter === sf}
              onPress={() => setStatusFilter(sf)}
            />
          ))}
        </View>

        {/* Result count */}
        {!isLoading && (
          <Text style={s.countText}>
            {filtered.length} {filtered.length === 1 ? 'POI encontrado' : 'POIs encontrados'}
          </Text>
        )}

        {/* Web table header */}
        {isWeb && !isLoading && filtered.length > 0 && (
          <View style={s.tableHeader}>
            <View style={{ width: 10 }} />
            <Text style={[s.tableHeaderText, s.colName]}>Nome</Text>
            <Text style={[s.tableHeaderText, s.colCategory]}>Categoria</Text>
            <Text style={[s.tableHeaderText, s.colScore]}>Score</Text>
            <Text style={[s.tableHeaderText, s.colStatus]}>Estado</Text>
            <Text style={[s.tableHeaderText, s.colActions]}>Ações</Text>
          </View>
        )}

        {/* List */}
        {isLoading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color={ACCENT} />
            <Text style={s.loadingText}>A carregar POIs...</Text>
          </View>
        ) : error ? (
          <View style={s.loadingWrap}>
            <MaterialIcons name="error-outline" size={40} color="#EF4444" />
            <Text style={s.errorText}>Erro ao carregar POIs</Text>
            <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
              <Text style={s.retryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PoiRow
                poi={item}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTogglePublish={handleTogglePublish}
              />
            )}
            ListEmptyComponent={
              <EmptyState
                message={
                  allPois.length === 0
                    ? 'Ainda não tens POIs registados'
                    : 'Nenhum POI corresponde aos filtros'
                }
              />
            }
            contentContainerStyle={filtered.length === 0 ? s.listEmptyContainer : undefined}
            showsVerticalScrollIndicator={false}
            style={s.list}
          />
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  // Mobile header
  mobileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    ...shadows.sm,
  },
  mobileHeaderTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
    textAlign: 'center',
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  newBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Content area
  content: {
    flex: 1,
    padding: 16,
  },
  contentWeb: {
    maxWidth: 1000,
    alignSelf: 'center' as const,
    width: '100%',
    paddingTop: 24,
    paddingHorizontal: 24,
  },
  // Web page header
  pageHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  newBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
    ...shadows.sm,
  },
  newBtnLargeText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Search
  searchRow: {
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    ...shadows.sm,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    height: '100%',
  },
  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  // Count
  countText: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 10,
    fontWeight: '500',
  },
  // Web table
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 10,
    ...shadows.sm,
  },
  // Shared column widths (web)
  colName: {
    flex: 3,
  },
  colCategory: {
    flex: 2,
  },
  colScore: {
    flex: 1,
    alignItems: 'center' as const,
  },
  colStatus: {
    flex: 1.5,
  },
  colActions: {
    flexDirection: 'row' as const,
    gap: 6,
    justifyContent: 'flex-end' as const,
    flex: 1.5,
  },
  // Mobile POI card
  poiCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    ...shadows.sm,
  },
  poiCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  poiCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  poiCardActions: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  // Shared POI elements
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  poiName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  poiRegion: {
    fontSize: 11,
    color: '#94A3B8',
  },
  catBadge: {
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusPublished: {
    backgroundColor: '#DCFCE7',
  },
  statusDraft: {
    backgroundColor: '#FEF9C3',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusTextPub: {
    color: '#16A34A',
  },
  statusTextDraft: {
    color: '#CA8A04',
  },
  // Action buttons (web table)
  actionBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  // Action buttons (mobile)
  mobileActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mobileActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  // List
  list: {
    flex: 1,
  },
  listEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  // Loading / error
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },
  errorText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  // Empty state
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 11,
    ...shadows.sm,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
