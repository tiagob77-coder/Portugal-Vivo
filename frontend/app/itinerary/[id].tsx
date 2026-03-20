import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getItinerary,
  updateItinerary,
  deleteItinerary,
  shareItinerary,
  getItineraryComments,
  addItineraryComment,
  getItineraryBudget,
  addItineraryAttachment,
  voteItineraryPoi,
  SavedItineraryDetail,
  ItineraryComment,
} from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { useTheme } from '../../src/context/ThemeContext';

const PERIOD_ICONS: Record<string, string> = {
  manha: 'wb-sunny',
  almoco: 'restaurant',
  tarde: 'wb-twilight',
  fim_tarde: 'nightlight',
  noite: 'nightlife',
};

const PERIOD_COLORS: Record<string, string> = {
  manha: '#F59E0B',
  almoco: '#EF4444',
  tarde: '#F97316',
  fim_tarde: '#8B5CF6',
  noite: '#6366F1',
};

type TabId = 'timeline' | 'comments' | 'budget' | 'collaborators';

export default function ItineraryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<TabId>('timeline');
  const [commentText, setCommentText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');

  const { data: itinerary, isLoading } = useQuery({
    queryKey: ['itinerary', id],
    queryFn: () => getItinerary(id!),
    enabled: !!id,
  });

  const { data: commentsData } = useQuery({
    queryKey: ['itinerary-comments', id],
    queryFn: () => getItineraryComments(id!),
    enabled: !!id && activeTab === 'comments',
  });

  const { data: budget } = useQuery({
    queryKey: ['itinerary-budget', id],
    queryFn: () => getItineraryBudget(id!),
    enabled: !!id && activeTab === 'budget',
  });

  const updateMutation = useMutation({
    mutationFn: (data: { title?: string; is_public?: boolean }) =>
      updateItinerary(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['itinerary', id] });
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteItinerary(id!),
    onSuccess: () => router.back(),
  });

  const commentMutation = useMutation({
    mutationFn: () => addItineraryComment(id!, commentText),
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['itinerary-comments', id] });
    },
  });

  const voteMutation = useMutation({
    mutationFn: ({ poi_id, vote }: { poi_id: string; vote: 'up' | 'down' }) =>
      voteItineraryPoi(id!, poi_id, vote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['itinerary', id] }),
  });

  const handleShare = async () => {
    try {
      const { share_url } = await shareItinerary(id!);
      Alert.alert('Link de Partilha', share_url, [
        { text: 'Fechar' },
      ]);
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o link de partilha.');
    }
  };

  const handleDelete = () => {
    Alert.alert('Eliminar Roteiro', 'Tem a certeza? Esta ação é irreversível.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ]);
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#2E5E4E" />
      </View>
    );
  }

  if (!itinerary) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textSecondary }}>Roteiro não encontrado.</Text>
      </View>
    );
  }

  const isOwner = user?.user_id === itinerary.itinerary_data?.owner_id ||
    itinerary.collaborators?.find(c => c.user_id === user?.user_id)?.role === 'owner';
  const itData = itinerary.itinerary_data || {};
  const dayPlans: any[] = itData.itinerary || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          title: isEditing ? '' : (itinerary.title || 'Roteiro'),
          headerShown: true,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 8, marginRight: 8 }}>
              <TouchableOpacity onPress={handleShare}>
                <MaterialIcons name="share" size={22} color="#2E5E4E" />
              </TouchableOpacity>
              {isOwner && (
                <TouchableOpacity onPress={() => {
                  setEditTitle(itinerary.title);
                  setIsEditing(true);
                }}>
                  <MaterialIcons name="edit" size={22} color="#2E5E4E" />
                </TouchableOpacity>
              )}
              {isOwner && (
                <TouchableOpacity onPress={handleDelete}>
                  <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          ),
        }}
      />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero card */}
        <View style={[styles.heroCard, { backgroundColor: colors.surface }]}>
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={[styles.editInput, { color: colors.textPrimary, borderColor: colors.borderLight }]}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="Título do roteiro"
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity
                style={styles.editSaveBtn}
                onPress={() => updateMutation.mutate({ title: editTitle })}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <Text style={styles.editSaveBtnText}>Guardar</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setIsEditing(false)}>
                <MaterialIcons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{itinerary.title}</Text>
          )}

          <View style={styles.heroMeta}>
            {itData.locality && (
              <View style={styles.metaChip}>
                <MaterialIcons name="place" size={13} color="#2E5E4E" />
                <Text style={styles.metaChipText}>{itData.locality}</Text>
              </View>
            )}
            <View style={styles.metaChip}>
              <MaterialIcons name="calendar-today" size={13} color="#2E5E4E" />
              <Text style={styles.metaChipText}>{itinerary.days} dia{itinerary.days > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.metaChip}>
              <MaterialIcons name="place" size={13} color="#2E5E4E" />
              <Text style={styles.metaChipText}>{itinerary.total_pois} POIs</Text>
            </View>
            {itinerary.collaborators_count > 0 && (
              <View style={styles.metaChip}>
                <MaterialIcons name="group" size={13} color="#8B5CF6" />
                <Text style={[styles.metaChipText, { color: '#8B5CF6' }]}>
                  {itinerary.collaborators_count} colaborador{itinerary.collaborators_count > 1 ? 'es' : ''}
                </Text>
              </View>
            )}
          </View>

          {itData.summary && (
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <MaterialIcons name="schedule" size={14} color="#F59E0B" />
                <Text style={styles.summaryVal}>{Math.round((itData.summary.total_visit_minutes || 0) / 60)}h</Text>
                <Text style={styles.summaryLabel}>visitas</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialIcons name="directions-car" size={14} color="#3B82F6" />
                <Text style={styles.summaryVal}>{Math.round((itData.summary.total_travel_minutes || 0) / 60)}h</Text>
                <Text style={styles.summaryLabel}>viagem</Text>
              </View>
              <View style={styles.summaryItem}>
                <MaterialIcons name="category" size={14} color="#8B5CF6" />
                <Text style={styles.summaryVal}>{itData.summary.category_count || 0}</Text>
                <Text style={styles.summaryLabel}>categorias</Text>
              </View>
              {itData.summary.estimated_daily_cost_eur > 0 && (
                <View style={styles.summaryItem}>
                  <MaterialIcons name="euro" size={14} color="#22C55E" />
                  <Text style={styles.summaryVal}>€{Math.round(itData.summary.estimated_daily_cost_eur)}</Text>
                  <Text style={styles.summaryLabel}>/dia est.</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
          {([
            { id: 'timeline', label: 'Roteiro', icon: 'route' },
            { id: 'comments', label: 'Notas', icon: 'comment' },
            { id: 'budget', label: 'Orçamento', icon: 'euro' },
            { id: 'collaborators', label: 'Equipa', icon: 'group' },
          ] as { id: TabId; label: string; icon: string }[]).map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && { borderBottomColor: '#2E5E4E', borderBottomWidth: 2 }]}
              onPress={() => setActiveTab(tab.id)}
            >
              <MaterialIcons
                name={tab.icon as any}
                size={16}
                color={activeTab === tab.id ? '#2E5E4E' : colors.textMuted}
              />
              <Text style={[styles.tabText, { color: activeTab === tab.id ? '#2E5E4E' : colors.textMuted,
                fontWeight: activeTab === tab.id ? '700' : '400' }]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Timeline tab */}
        {activeTab === 'timeline' && (
          <View style={styles.tabContent}>
            {dayPlans.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sem dados de roteiro.</Text>
            ) : dayPlans.map((day: any) => (
              <View key={day.day} style={[styles.dayCard, { backgroundColor: colors.surface }]}>
                <View style={styles.dayHeader}>
                  <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>Dia {day.day}</Text>
                  </View>
                  <Text style={[styles.dayMeta, { color: colors.textMuted }]}>
                    {day.poi_count} POIs · {Math.round((day.total_minutes || 0) / 60)}h
                  </Text>
                </View>

                {(day.periods || []).map((period: any) => (
                  <View key={period.period} style={styles.periodBlock}>
                    <View style={styles.periodHeader}>
                      <MaterialIcons
                        name={(PERIOD_ICONS[period.period] || 'schedule') as any}
                        size={13}
                        color={PERIOD_COLORS[period.period] || '#94A3B8'}
                      />
                      <Text style={[styles.periodLabel, { color: PERIOD_COLORS[period.period] || '#94A3B8' }]}>
                        {period.label} ({period.start_time})
                      </Text>
                    </View>
                    {(period.pois || []).map((poi: any) => {
                      const poiVotes = (itinerary.votes || []).filter((v: any) => v.poi_id === poi.id);
                      const upVotes = poiVotes.filter((v: any) => v.vote === 'up').length;
                      return (
                        <TouchableOpacity
                          key={poi.id}
                          style={styles.poiRow}
                          onPress={() => router.push(`/heritage/${poi.id}` as any)}
                        >
                          <MaterialIcons name="place" size={16} color={PERIOD_COLORS[period.period] || '#C49A6C'} />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.poiName, { color: colors.textPrimary }]} numberOfLines={1}>
                              {poi.name}
                            </Text>
                            <View style={styles.poiMeta}>
                              <Text style={[styles.poiMetaText, { color: colors.textMuted }]}>{poi.category}</Text>
                              <Text style={[styles.poiMetaText, { color: colors.textMuted }]}>{poi.visit_minutes} min</Text>
                              {poi.travel_from_previous_min > 0 && (
                                <Text style={[styles.poiTravel, { color: '#3B82F6' }]}>
                                  +{poi.travel_from_previous_min}min viagem
                                </Text>
                              )}
                            </View>
                          </View>
                          <View style={styles.voteRow}>
                            <TouchableOpacity
                              onPress={() => voteMutation.mutate({ poi_id: poi.id, vote: 'up' })}
                              style={styles.voteBtn}
                            >
                              <MaterialIcons name="thumb-up" size={14} color={upVotes > 0 ? '#22C55E' : colors.textMuted} />
                            </TouchableOpacity>
                            {upVotes > 0 && (
                              <Text style={[styles.voteCount, { color: '#22C55E' }]}>{upVotes}</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* Comments tab */}
        {activeTab === 'comments' && (
          <View style={styles.tabContent}>
            <View style={[styles.commentInputRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
              <TextInput
                style={[styles.commentInput, { color: colors.textPrimary }]}
                placeholder="Adicionar nota ao roteiro..."
                placeholderTextColor={colors.textMuted}
                value={commentText}
                onChangeText={setCommentText}
                multiline
              />
              <TouchableOpacity
                style={[styles.commentSendBtn, { backgroundColor: commentText.trim() ? '#2E5E4E' : colors.borderLight }]}
                onPress={() => { if (commentText.trim()) commentMutation.mutate(); }}
                disabled={!commentText.trim() || commentMutation.isPending}
              >
                {commentMutation.isPending
                  ? <ActivityIndicator size="small" color="#FFF" />
                  : <MaterialIcons name="send" size={18} color={commentText.trim() ? '#FFF' : colors.textMuted} />
                }
              </TouchableOpacity>
            </View>

            {!commentsData?.comments || commentsData.comments.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>Ainda sem notas.</Text>
            ) : commentsData.comments.map((c: ItineraryComment) => (
              <View key={c.id} style={[styles.commentCard, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={styles.commentHeader}>
                  <Text style={[styles.commentAuthor, { color: colors.textPrimary }]}>{c.user_name}</Text>
                  {c.day && (
                    <View style={styles.commentDayBadge}>
                      <Text style={styles.commentDayText}>Dia {c.day}</Text>
                    </View>
                  )}
                  <Text style={[styles.commentTime, { color: colors.textMuted }]}>
                    {new Date(c.created_at).toLocaleDateString('pt-PT')}
                  </Text>
                </View>
                <Text style={[styles.commentText, { color: colors.textSecondary }]}>{c.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Budget tab */}
        {activeTab === 'budget' && (
          <View style={styles.tabContent}>
            {!budget ? (
              <ActivityIndicator size="small" color="#2E5E4E" style={{ padding: 20 }} />
            ) : (
              <>
                <View style={[styles.budgetTotalCard, { backgroundColor: '#2E5E4E' }]}>
                  <Text style={styles.budgetTotalLabel}>Custo Estimado Total</Text>
                  <Text style={styles.budgetTotalVal}>€{(budget.total_eur + (budget.attachments_total || 0)).toFixed(0)}</Text>
                  {budget.attachments_total > 0 && (
                    <Text style={styles.budgetTotalSub}>
                      €{budget.total_eur.toFixed(0)} estimado + €{budget.attachments_total.toFixed(0)} reservas
                    </Text>
                  )}
                </View>

                {(budget.by_day || []).map((d: any) => (
                  <View key={d.day} style={[styles.budgetDayRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>Dia {d.day}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <View style={[styles.budgetBar, { backgroundColor: colors.borderLight }]}>
                        <View style={[styles.budgetBarFill, {
                          width: `${Math.min(100, (d.eur / Math.max(...budget.by_day.map((x: any) => x.eur), 1)) * 100)}%` as any,
                        }]} />
                      </View>
                    </View>
                    <Text style={[styles.budgetDayVal, { color: colors.textPrimary }]}>€{d.eur.toFixed(0)}</Text>
                  </View>
                ))}

                <TouchableOpacity
                  style={styles.addAttachmentBtn}
                  onPress={() => Alert.alert(
                    'Adicionar Despesa',
                    'Funcionalidade em desenvolvimento. Em breve poderá adicionar reservas, bilhetes e notas de despesa.',
                  )}
                >
                  <MaterialIcons name="add" size={18} color="#2E5E4E" />
                  <Text style={styles.addAttachmentText}>Adicionar Reserva / Bilhete</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        {/* Collaborators tab */}
        {activeTab === 'collaborators' && (
          <View style={styles.tabContent}>
            {(itinerary.collaborators || []).length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Apenas você tem acesso a este roteiro.
              </Text>
            ) : (itinerary.collaborators || []).map((c: any) => (
              <View key={c.user_id} style={[styles.collabRow, { backgroundColor: colors.surface, borderColor: colors.borderLight }]}>
                <View style={[styles.collabAvatar, { backgroundColor: '#2E5E4E' }]}>
                  <Text style={styles.collabAvatarText}>{(c.user_name || '?')[0].toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.collabName, { color: colors.textPrimary }]}>{c.user_name}</Text>
                  <Text style={[styles.collabRole, { color: colors.textMuted }]}>
                    {c.role === 'owner' ? 'Proprietário' : c.role === 'editor' ? 'Editor' : c.role === 'voter' ? 'Votante' : 'Visualizador'}
                  </Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.inviteBtn} onPress={handleShare}>
              <MaterialIcons name="person-add" size={18} color="#FFF" />
              <Text style={styles.inviteBtnText}>Convidar Colaborador</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  heroCard: { margin: 16, borderRadius: 16, padding: 18, gap: 12 },
  heroTitle: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  editSaveBtn: { backgroundColor: '#2E5E4E', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  editSaveBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2E5E4E15', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  metaChipText: { fontSize: 12, fontWeight: '600', color: '#2E5E4E' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  summaryItem: { alignItems: 'center', gap: 2 },
  summaryVal: { fontSize: 16, fontWeight: '800', color: '#1F2937' },
  summaryLabel: { fontSize: 10, color: '#94A3B8' },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 16, borderRadius: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 4 },
  tabText: { fontSize: 11 },

  tabContent: { padding: 16, gap: 12 },
  emptyText: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },

  dayCard: { borderRadius: 14, padding: 14, gap: 10 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayBadge: { backgroundColor: '#2E5E4E', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dayBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  dayMeta: { fontSize: 12 },

  periodBlock: { marginBottom: 8 },
  periodHeader: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  periodLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  poiRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, paddingLeft: 4 },
  poiName: { fontSize: 13, fontWeight: '500' },
  poiMeta: { flexDirection: 'row', gap: 8, marginTop: 1 },
  poiMetaText: { fontSize: 10 },
  poiTravel: { fontSize: 10 },

  voteRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  voteBtn: { padding: 4 },
  voteCount: { fontSize: 11, fontWeight: '700' },

  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', borderWidth: 1, borderRadius: 12, padding: 10, gap: 8 },
  commentInput: { flex: 1, fontSize: 14, maxHeight: 80, minHeight: 40 },
  commentSendBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  commentCard: { borderRadius: 10, padding: 12, borderWidth: 1, gap: 6 },
  commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commentAuthor: { fontWeight: '700', fontSize: 13 },
  commentDayBadge: { backgroundColor: '#2E5E4E20', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  commentDayText: { fontSize: 10, color: '#2E5E4E', fontWeight: '600' },
  commentTime: { fontSize: 11, marginLeft: 'auto' },
  commentText: { fontSize: 13, lineHeight: 19 },

  budgetTotalCard: { borderRadius: 14, padding: 20, alignItems: 'center', gap: 4 },
  budgetTotalLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  budgetTotalVal: { color: '#FFF', fontSize: 36, fontWeight: '800' },
  budgetTotalSub: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },

  budgetDayRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, borderWidth: 1, gap: 8 },
  budgetBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', backgroundColor: '#2E5E4E', borderRadius: 3 },
  budgetDayVal: { fontSize: 14, fontWeight: '700', minWidth: 40, textAlign: 'right' },

  addAttachmentBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 10, borderWidth: 1.5, borderColor: '#2E5E4E', borderStyle: 'dashed', justifyContent: 'center' },
  addAttachmentText: { fontSize: 14, color: '#2E5E4E', fontWeight: '600' },

  collabRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 10, padding: 12, borderWidth: 1, gap: 10 },
  collabAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  collabAvatarText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  collabName: { fontSize: 14, fontWeight: '600' },
  collabRole: { fontSize: 12, marginTop: 1 },

  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#2E5E4E', padding: 14, borderRadius: 12, justifyContent: 'center', marginTop: 8 },
  inviteBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
