/**
 * Utilizadores — Gestão da equipa municipal (roles RBAC)
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, TextInput, Modal, Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../../src/services/api';

const ACCENT = '#2E5E4E';

interface TeamUser {
  user_id: string;
  email: string;
  name: string;
  tenant_role: 'municipio' | 'editor' | 'viewer';
  municipality_id?: string;
  created_at?: string;
}

interface InviteForm {
  email: string;
  name: string;
  tenant_role: 'editor' | 'viewer';
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; desc: string; icon: string }> = {
  municipio:  { label: 'Gestor',    color: '#7C3AED', bg: '#F3E8FF', desc: 'Acesso total ao município',          icon: 'admin-panel-settings' },
  editor:     { label: 'Editor',    color: '#0284C7', bg: '#E0F2FE', desc: 'Cria e edita POIs, sem apagar',       icon: 'edit' },
  viewer:     { label: 'Leitor',    color: '#64748B', bg: '#F1F5F9', desc: 'Só leitura dos dados',               icon: 'visibility' },
  admin_global:{ label: 'Admin',    color: '#DC2626', bg: '#FEE2E2', desc: 'Administrador global',               icon: 'security' },
};

const ASSIGNABLE_ROLES: Array<'editor' | 'viewer'> = ['editor', 'viewer'];

async function fetchUsers(): Promise<TeamUser[]> {
  const resp = await api.get('/admin/tenants/users');
  return resp.data.users ?? [];
}

async function updateUserRole({ user_id, tenant_role }: { user_id: string; tenant_role: string }): Promise<void> {
  await api.patch(`/admin/tenants/users/${user_id}`, { tenant_role });
}

async function inviteUser(form: InviteForm): Promise<void> {
  await api.post('/admin/tenants/invite', form);
}

async function removeUser(user_id: string): Promise<void> {
  await api.delete(`/admin/tenants/users/${user_id}`);
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function avatarColor(name: string) {
  const PALETTE = ['#7C3AED', '#0284C7', '#059669', '#DC2626', '#D97706', '#0891B2'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFFFF;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export default function UtilizadoresScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [inviteModal, setInviteModal] = useState(false);
  const [roleModal, setRoleModal] = useState<TeamUser | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<TeamUser | null>(null);
  const [inviteForm, setInviteForm] = useState<InviteForm>({ email: '', name: '', tenant_role: 'editor' });

  const { data: users = [], isLoading } = useQuery<TeamUser[]>({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  });

  const roleMut = useMutation({
    mutationFn: updateUserRole,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setRoleModal(null); },
  });

  const inviteMut = useMutation({
    mutationFn: inviteUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setInviteModal(false); setInviteForm({ email: '', name: '', tenant_role: 'editor' }); },
  });

  const removeMut = useMutation({
    mutationFn: removeUser,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setRemoveConfirm(null); },
  });

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  // Role counts for summary
  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.tenant_role] = (acc[u.tenant_role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <View style={[s.container, { paddingTop: Platform.OS === 'web' ? 0 : insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.pageTitle}>Equipa</Text>
          <Text style={s.pageSubtitle}>{users.length} membro{users.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={() => setInviteModal(true)}>
          <MaterialIcons name="person-add" size={18} color="#fff" />
          <Text style={s.addBtnText}>Convidar</Text>
        </TouchableOpacity>
      </View>

      {/* Role summary chips */}
      {users.length > 0 && (
        <View style={s.summaryRow}>
          {Object.entries(ROLE_META).filter(([r]) => counts[r]).map(([role, meta]) => (
            <View key={role} style={[s.summaryChip, { backgroundColor: meta.bg }]}>
              <Text style={[s.summaryChipText, { color: meta.color }]}>
                {counts[role]} {meta.label}{counts[role] !== 1 ? 's' : ''}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Search */}
      <View style={s.searchRow}>
        <View style={s.searchBox}>
          <MaterialIcons name="search" size={18} color="#94A3B8" />
          <TextInput
            style={s.searchInput}
            placeholder="Pesquisar por nome ou email..."
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

      {/* User list */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <MaterialIcons name="group-off" size={48} color="#CBD5E1" />
          <Text style={s.emptyText}>
            {search ? 'Sem resultados' : 'Ainda não há membros na equipa.'}
          </Text>
          {!search && (
            <TouchableOpacity style={s.inviteEmptyBtn} onPress={() => setInviteModal(true)}>
              <Text style={s.inviteEmptyText}>Convidar primeiro membro</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.list} showsVerticalScrollIndicator={false}>
          {filtered.map(user => {
            const meta = ROLE_META[user.tenant_role] ?? ROLE_META.viewer;
            const color = avatarColor(user.name);
            const canEdit = user.tenant_role !== 'municipio';
            return (
              <View key={user.user_id} style={s.card}>
                {/* Avatar */}
                <View style={[s.avatar, { backgroundColor: color }]}>
                  <Text style={s.avatarText}>{initials(user.name)}</Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    <Text style={s.userName} numberOfLines={1}>{user.name}</Text>
                    <TouchableOpacity
                      style={[s.roleBadge, { backgroundColor: meta.bg }]}
                      onPress={() => canEdit && setRoleModal(user)}
                      disabled={!canEdit}
                    >
                      <MaterialIcons name={meta.icon as any} size={11} color={meta.color} />
                      <Text style={[s.roleText, { color: meta.color }]}>{meta.label}</Text>
                      {canEdit && <MaterialIcons name="expand-more" size={11} color={meta.color} />}
                    </TouchableOpacity>
                  </View>
                  <Text style={s.userEmail} numberOfLines={1}>{user.email}</Text>
                  {user.created_at && (
                    <Text style={s.userDate}>
                      Desde {new Date(user.created_at).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })}
                    </Text>
                  )}
                </View>

                {/* Actions */}
                {canEdit && (
                  <TouchableOpacity
                    style={s.removeBtn}
                    onPress={() => setRemoveConfirm(user)}
                  >
                    <MaterialIcons name="person-remove" size={16} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}

          {/* Role legend */}
          <View style={s.legend}>
            <Text style={s.legendTitle}>Permissões por role</Text>
            {(['municipio', 'editor', 'viewer'] as const).map(role => {
              const meta = ROLE_META[role];
              return (
                <View key={role} style={s.legendRow}>
                  <View style={[s.legendDot, { backgroundColor: meta.color }]} />
                  <Text style={s.legendRole}>{meta.label}</Text>
                  <Text style={s.legendDesc}>{meta.desc}</Text>
                </View>
              );
            })}
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Remove confirmation */}
      {removeConfirm && (
        <Modal transparent animationType="fade" visible>
          <View style={s.overlay}>
            <View style={s.confirmBox}>
              <View style={[s.avatar, { backgroundColor: avatarColor(removeConfirm.name), width: 48, height: 48, borderRadius: 24 }]}>
                <Text style={[s.avatarText, { fontSize: 18 }]}>{initials(removeConfirm.name)}</Text>
              </View>
              <Text style={s.confirmTitle}>Remover {removeConfirm.name}?</Text>
              <Text style={s.confirmDesc}>O utilizador perderá acesso ao painel municipal.</Text>
              <View style={s.confirmBtns}>
                <TouchableOpacity style={s.cancelBtn} onPress={() => setRemoveConfirm(null)}>
                  <Text style={s.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={s.deleteBtn}
                  onPress={() => removeMut.mutate(removeConfirm.user_id)}
                  disabled={removeMut.isPending}
                >
                  {removeMut.isPending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={s.deleteBtnText}>Remover</Text>
                  }
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Role change modal */}
      {roleModal && (
        <Modal transparent animationType="fade" visible>
          <View style={s.overlay}>
            <View style={s.confirmBox}>
              <Text style={s.confirmTitle}>Alterar role</Text>
              <Text style={s.confirmDesc}>{roleModal.name}</Text>
              {ASSIGNABLE_ROLES.map(role => {
                const meta = ROLE_META[role];
                const active = roleModal.tenant_role === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[s.roleOption, active && s.roleOptionActive]}
                    onPress={() => roleMut.mutate({ user_id: roleModal.user_id, tenant_role: role })}
                    disabled={roleMut.isPending}
                  >
                    <MaterialIcons name={meta.icon as any} size={20} color={active ? ACCENT : '#64748B'} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.roleOptionTitle, active && { color: ACCENT }]}>{meta.label}</Text>
                      <Text style={s.roleOptionDesc}>{meta.desc}</Text>
                    </View>
                    {active && <MaterialIcons name="check-circle" size={18} color={ACCENT} />}
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={[s.cancelBtn, { width: '100%', marginTop: 8 }]} onPress={() => setRoleModal(null)}>
                <Text style={s.cancelBtnText}>Fechar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}

      {/* Invite modal */}
      <Modal visible={inviteModal} animationType="slide" transparent>
        <View style={s.overlay}>
          <View style={s.modalBox}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Convidar membro</Text>
              <TouchableOpacity onPress={() => setInviteModal(false)}>
                <MaterialIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={s.label}>Nome *</Text>
            <TextInput
              style={s.input}
              value={inviteForm.name}
              onChangeText={v => setInviteForm(f => ({ ...f, name: v }))}
              placeholder="Nome completo"
              placeholderTextColor="#94A3B8"
            />

            <Text style={s.label}>Email *</Text>
            <TextInput
              style={s.input}
              value={inviteForm.email}
              onChangeText={v => setInviteForm(f => ({ ...f, email: v }))}
              placeholder="email@municipio.pt"
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={s.label}>Role</Text>
            <View style={s.roleSelectRow}>
              {ASSIGNABLE_ROLES.map(role => {
                const meta = ROLE_META[role];
                const active = inviteForm.tenant_role === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[s.roleSelectBtn, active && s.roleSelectBtnActive]}
                    onPress={() => setInviteForm(f => ({ ...f, tenant_role: role }))}
                  >
                    <MaterialIcons name={meta.icon as any} size={16} color={active ? ACCENT : '#64748B'} />
                    <Text style={[s.roleSelectText, active && { color: ACCENT }]}>{meta.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={s.roleHint}>
              {ROLE_META[inviteForm.tenant_role].desc}
            </Text>

            <TouchableOpacity
              style={[s.saveBtn, (inviteMut.isPending || !inviteForm.email || !inviteForm.name) && s.saveBtnDisabled]}
              onPress={() => inviteMut.mutate(inviteForm)}
              disabled={inviteMut.isPending || !inviteForm.email || !inviteForm.name}
            >
              {inviteMut.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <MaterialIcons name="send" size={18} color="#fff" />
              }
              <Text style={s.saveBtnText}>Enviar convite</Text>
            </TouchableOpacity>

            {inviteMut.isError && (
              <Text style={s.errorText}>
                {(inviteMut.error as any)?.response?.data?.detail ?? 'Erro ao enviar convite'}
              </Text>
            )}
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

  summaryRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexWrap: 'wrap',
  },
  summaryChip: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  summaryChipText: { fontSize: 11, fontWeight: '700' },

  searchRow: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: '#E2E8F0',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#1E293B', outlineWidth: 0 } as any,

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { fontSize: 14, color: '#94A3B8' },
  inviteEmptyBtn: {
    backgroundColor: ACCENT, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 10,
  },
  inviteEmptyText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  list: { padding: 16, gap: 10 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
    elevation: 1,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: '#fff' },

  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  userName: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1 },
  userEmail: { fontSize: 12, color: '#64748B' },
  userDate: { fontSize: 10, color: '#94A3B8', marginTop: 1 },

  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  roleText: { fontSize: 10, fontWeight: '700' },

  removeBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center',
  },

  legend: {
    backgroundColor: '#fff', borderRadius: 14, padding: 16, marginTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3,
    elevation: 1,
  },
  legendTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendRole: { fontSize: 12, fontWeight: '700', color: '#1E293B', width: 60 },
  legendDesc: { fontSize: 11, color: '#64748B', flex: 1 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  confirmBox: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', gap: 8, width: '100%', maxWidth: 360,
  },
  confirmTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  confirmDesc: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  confirmBtns: { flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1,
    borderColor: '#E2E8F0', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  deleteBtn: { flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  roleOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%',
    padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  roleOptionActive: { borderColor: ACCENT, backgroundColor: '#F0FDF4' },
  roleOptionTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  roleOptionDesc: { fontSize: 11, color: '#94A3B8', marginTop: 1 },

  modalBox: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    width: '100%', maxWidth: 480,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },

  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B',
    backgroundColor: '#F8FAFC', outlineWidth: 0,
  } as any,

  roleSelectRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  roleSelectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  roleSelectBtnActive: { borderColor: ACCENT, backgroundColor: '#F0FDF4' },
  roleSelectText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  roleHint: { fontSize: 11, color: '#94A3B8', marginTop: 6 },

  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: ACCENT, borderRadius: 12, paddingVertical: 14, marginTop: 24,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  errorText: { fontSize: 12, color: '#DC2626', textAlign: 'center', marginTop: 8 },
});
