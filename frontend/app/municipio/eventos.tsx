/**
 * Eventos — Gestão de eventos do município
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Modal, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';

const ACCENT = '#2E5E4E';

interface Evento {
  id: string;
  title: string;
  description?: string;
  category?: string;
  municipality_id?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  image_url?: string;
  is_published?: boolean;
  created_at?: string;
}

interface EventoForm {
  title: string;
  description: string;
  category: string;
  location: string;
  start_date: string;
  end_date: string;
}

const CATEGORIES = ['Cultural', 'Gastronômico', 'Desportivo', 'Religioso', 'Histórico', 'Musical', 'Artesanato', 'Natureza', 'Outro'];

const EMPTY_FORM: EventoForm = {
  title: '',
  description: '',
  category: 'Cultural',
  location: '',
  start_date: '',
  end_date: '',
};

async function fetchEventos(): Promise<Evento[]> {
  const resp = await api.get('/admin/eventos');
  return resp.data.eventos ?? resp.data ?? [];
}

async function createEvento(data: EventoForm): Promise<Evento> {
  const resp = await api.post('/admin/eventos', data);
  return resp.data;
}

async function updateEvento({ id, data }: { id: string; data: Partial<EventoForm & { is_published: boolean }> }): Promise<Evento> {
  const resp = await api.patch(`/admin/eventos/${id}`, data);
  return resp.data;
}

async function deleteEvento(id: string): Promise<void> {
  await api.delete(`/admin/eventos/${id}`);
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return iso; }
}

function statusBadge(e: Evento) {
  if (!e.start_date) return { label: 'Sem data', color: '#94A3B8' };
  const now = new Date();
  const start = new Date(e.start_date);
  const end = e.end_date ? new Date(e.end_date) : null;
  if (end && now > end) return { label: 'Terminado', color: '#94A3B8' };
  if (now >= start) return { label: 'A decorrer', color: '#22C55E' };
  return { label: 'Futuro', color: '#3B82F6' };
}

export default function EventosScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Evento | null>(null);
  const [form, setForm] = useState<EventoForm>(EMPTY_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: eventos = [], isLoading } = useQuery<Evento[]>({
    queryKey: ['admin-eventos'],
    queryFn: fetchEventos,
  });

  const createMut = useMutation({
    mutationFn: createEvento,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-eventos'] }); closeModal(); },
  });

  const updateMut = useMutation({
    mutationFn: updateEvento,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-eventos'] }); closeModal(); },
  });

  const deleteMut = useMutation({
    mutationFn: deleteEvento,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-eventos'] }); setDeleteConfirm(null); },
  });

  const publishMut = useMutation({
    mutationFn: ({ id, is_published }: { id: string; is_published: boolean }) =>
      updateEvento({ id, data: { is_published } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-eventos'] }),
  });

  const filtered = eventos.filter(e =>
    e.title.toLowerCase().includes(search.toLowerCase()) ||
    (e.location ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModalVisible(true); };
  const openEdit = (e: Evento) => {
    setEditing(e);
    setForm({
      title: e.title,
      description: e.description ?? '',
      category: e.category ?? 'Cultural',
      location: e.location ?? '',
      start_date: e.start_date?.slice(0, 16) ?? '',
      end_date: e.end_date?.slice(0, 16) ?? '',
    });
    setModalVisible(true);
  };
  const closeModal = () => { setModalVisible(false); setEditing(null); setForm(EMPTY_FORM); };

  const handleSave = () => {
    if (!form.title.trim()) return;
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form });
    } else {
      createMut.mutate(form);
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <View style={[s.container, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>Eventos</Text>
          <Text style={s.pageSubtitle}>{eventos.length} evento{eventos.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={openCreate}>
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={s.addBtnText}>Novo Evento</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Pesquisar eventos..."
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={setSearch}
          />
          {search !== '' && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="close" size={16} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <MaterialIcons name="event-busy" size={48} color="#CBD5E1" />
          <Text style={s.emptyText}>
            {search ? 'Sem resultados' : 'Sem eventos. Cria o primeiro!'}
          </Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map(evento => {
            const badge = statusBadge(evento);
            return (
              <View key={evento.id} style={s.card}>
                <View style={s.cardTop}>
                  <View style={{ flex: 1 }}>
                    <View style={s.cardTitleRow}>
                      <Text style={s.cardTitle} numberOfLines={1}>{evento.title}</Text>
                      <View style={[s.badge, { backgroundColor: badge.color + '22' }]}>
                        <Text style={[s.badgeText, { color: badge.color }]}>{badge.label}</Text>
                      </View>
                    </View>
                    {evento.category && (
                      <Text style={s.cardCategory}>{evento.category}</Text>
                    )}
                  </View>
                  <View style={s.cardActions}>
                    <TouchableOpacity
                      style={[s.iconBtn, { backgroundColor: evento.is_published ? '#F0FDF4' : '#F8FAFC' }]}
                      onPress={() => publishMut.mutate({ id: evento.id, is_published: !evento.is_published })}
                    >
                      <MaterialIcons
                        name={evento.is_published ? 'visibility' : 'visibility-off'}
                        size={16}
                        color={evento.is_published ? ACCENT : '#94A3B8'}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(evento)}>
                      <MaterialIcons name="edit" size={16} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.iconBtn, { backgroundColor: '#FEF2F2' }]}
                      onPress={() => setDeleteConfirm(evento.id)}
                    >
                      <MaterialIcons name="delete-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.cardMeta}>
                  {evento.location && (
                    <View style={s.metaItem}>
                      <MaterialIcons name="place" size={13} color="#94A3B8" />
                      <Text style={s.metaText} numberOfLines={1}>{evento.location}</Text>
                    </View>
                  )}
                  <View style={s.metaItem}>
                    <MaterialIcons name="event" size={13} color="#94A3B8" />
                    <Text style={s.metaText}>
                      {formatDate(evento.start_date)}
                      {evento.end_date && ` → ${formatDate(evento.end_date)}`}
                    </Text>
                  </View>
                </View>

                {evento.description && (
                  <Text style={s.cardDesc} numberOfLines={2}>{evento.description}</Text>
                )}
              </View>
            );
          })}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <Modal transparent animationType="fade" visible>
          <View style={s.overlay}>
            <View style={s.confirmBox}>
              <MaterialIcons name="warning" size={32} color="#F97316" />
              <Text style={s.confirmTitle}>Apagar evento?</Text>
              <Text style={s.confirmDesc}>Esta acção não pode ser desfeita.</Text>
              <View style={s.confirmBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setDeleteConfirm(null)}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => deleteMut.mutate(deleteConfirm)}
                  disabled={deleteMut.isPending}
                >
                  {deleteMut.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.deleteBtnText}>Apagar</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Create/Edit modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>{editing ? 'Editar Evento' : 'Novo Evento'}</Text>
              <TouchableOpacity onPress={closeModal}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Título *</Text>
              <TextInput
                style={s.input}
                value={form.title}
                onChangeText={v => setForm(f => ({ ...f, title: v }))}
                placeholder="Nome do evento"
                placeholderTextColor="#94A3B8"
              />

              <Text style={s.label}>Descrição</Text>
              <TextInput
                style={[s.input, s.inputArea]}
                value={form.description}
                onChangeText={v => setForm(f => ({ ...f, description: v }))}
                placeholder="Descrição breve"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
              />

              <Text style={s.label}>Categoria</Text>
              <View style={s.categoryGrid}>
                {CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[s.catChip, form.category === cat && s.catChipActive]}
                    onPress={() => setForm(f => ({ ...f, category: cat }))}
                  >
                    <Text style={[s.catChipText, form.category === cat && s.catChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={s.label}>Local</Text>
              <TextInput
                style={s.input}
                value={form.location}
                onChangeText={v => setForm(f => ({ ...f, location: v }))}
                placeholder="Ex: Praça da República, Braga"
                placeholderTextColor="#94A3B8"
              />

              <View style={s.dateRow}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Data início</Text>
                  <TextInput
                    style={s.input}
                    value={form.start_date}
                    onChangeText={v => setForm(f => ({ ...f, start_date: v }))}
                    placeholder="YYYY-MM-DD HH:MM"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Data fim</Text>
                  <TextInput
                    style={s.input}
                    value={form.end_date}
                    onChangeText={v => setForm(f => ({ ...f, end_date: v }))}
                    placeholder="YYYY-MM-DD HH:MM"
                    placeholderTextColor="#94A3B8"
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[s.saveBtn, (isSaving || !form.title.trim()) && s.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isSaving || !form.title.trim()}
            >
              {isSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialIcons name="check" size={18} color="#fff" />
              }
              <Text style={s.saveBtnText}>{editing ? 'Guardar alterações' : 'Criar evento'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  pageSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 1 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  searchRow: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', outlineWidth: 0 } as any,

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8' },

  list: { padding: 16, gap: 12 },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    elevation: 2,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  cardCategory: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#64748B' },
  cardDesc: { fontSize: 12, color: '#94A3B8', lineHeight: 16 },

  badge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '700' },

  cardActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 30, height: 30, borderRadius: 8,
    backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center',
  },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 8, width: '100%', maxWidth: 340,
  },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  confirmDesc: { fontSize: 13, color: '#64748B', marginBottom: 8 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%' },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1,
    borderColor: '#E2E8F0', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  deleteBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  modalBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 560, maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B',
    backgroundColor: '#F8FAFC', outlineWidth: 0,
  } as any,
  inputArea: { height: 80, textAlignVertical: 'top' },

  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  catChipActive: { borderColor: ACCENT, backgroundColor: '#F0FDF4' },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  catChipTextActive: { color: ACCENT },

  dateRow: { flexDirection: 'row', gap: 12 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
