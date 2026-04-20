import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import api, { getApprovedContributions, createContribution, voteContribution, Contribution, ContributionCreate, getCategories } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import ImageUpload from '../../src/components/ImageUpload';
import { useTheme, palette } from '../../src/theme';

const CONTRIBUTION_TYPES = [
  { id: 'story', name: 'História', icon: 'auto-stories', color: '#8B5CF6' },
  { id: 'correction', name: 'Correção', icon: 'edit', color: '#C49A6C' },
  { id: 'new_item', name: 'Novo Local', icon: 'add-location', color: '#22C55E' },
  { id: 'photo', name: 'Fotografia', icon: 'photo-camera', color: '#3B82F6' },
];

const REGIONS = [
  { id: 'norte', name: 'Norte' },
  { id: 'centro', name: 'Centro' },
  { id: 'lisboa', name: 'Lisboa' },
  { id: 'alentejo', name: 'Alentejo' },
  { id: 'algarve', name: 'Algarve' },
  { id: 'acores', name: 'Açores' },
  { id: 'madeira', name: 'Madeira' },
];

type FeedTab = 'featured' | 'recent' | 'following';

export default function CommunityScreen() {
  const insets = useSafeAreaInsets();
  const { colors: _colors } = useTheme();
  const queryClient = useQueryClient();
  const { isAuthenticated, sessionToken, user: _user, login } = useAuth();
  const router = useRouter();
  const [feedTab, setFeedTab] = useState<FeedTab>('featured');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContribution, setNewContribution] = useState<ContributionCreate>({
    type: 'story',
    title: '',
    content: '',
    region: 'norte',
  });

  const { data: contributions = [], isLoading, refetch } = useQuery({
    queryKey: ['contributions', 'approved'],
    queryFn: getApprovedContributions,
  });

  const { data: featuredData } = useQuery({
    queryKey: ['contributions', 'featured'],
    queryFn: async () => {
      const res = await api.get('/community/contributions/featured', { params: { limit: 20 } });
      return res.data.items as Contribution[];
    },
  });

  const { data: followingFeed } = useQuery({
    queryKey: ['contributions', 'following'],
    queryFn: async () => {
      if (!sessionToken) return [];
      const res = await api.get('/community/feed/following', { params: { limit: 20 } });
      return res.data.items as Contribution[];
    },
    enabled: isAuthenticated,
  });

  const reportMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await api.post(`/community/contributions/${id}/report`, { reason });
    },
    onSuccess: () => {
      Alert.alert('Obrigado', 'Report submetido. A moderação irá analisar.');
    },
    onError: (e: any) => {
      Alert.alert('Erro', e?.response?.data?.detail || 'Não foi possível submeter o report.');
    },
  });

  const { data: _categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: (data: ContributionCreate) => createContribution(data, sessionToken!),
    onSuccess: () => {
      setShowCreateModal(false);
      setNewContribution({ type: 'story', title: '', content: '', region: 'norte' });
      Alert.alert('Sucesso', 'A sua contribuição foi submetida para revisão!');
      refetch();
    },
    onError: () => {
      Alert.alert('Erro', 'Não foi possível submeter a contribuição.');
    },
  });

  const voteMutation = useMutation({
    mutationFn: (id: string) => voteContribution(id, sessionToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contributions'] });
    },
  });

  const handleCreate = () => {
    if (!isAuthenticated) {
      Alert.alert('Atenção', 'Precisa de iniciar sessão para contribuir.');
      return;
    }
    if (!newContribution.title || !newContribution.content) {
      Alert.alert('Atenção', 'Preencha o título e conteúdo.');
      return;
    }
    createMutation.mutate(newContribution);
  };

  const handleVote = (id: string) => {
    if (!isAuthenticated) {
      Alert.alert('Atenção', 'Precisa de iniciar sessão para votar.');
      return;
    }
    voteMutation.mutate(id);
  };

  const handleReport = (id: string) => {
    if (!isAuthenticated) {
      Alert.alert('Atenção', 'Precisa de iniciar sessão para reportar.');
      return;
    }
    Alert.alert('Reportar conteúdo', 'Qual o motivo do report?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Informação falsa', onPress: () => reportMutation.mutate({ id, reason: 'Informação falsa' }) },
      { text: 'Conteúdo ofensivo', onPress: () => reportMutation.mutate({ id, reason: 'Conteúdo ofensivo' }) },
      { text: 'Spam', onPress: () => reportMutation.mutate({ id, reason: 'Spam' }) },
    ]);
  };

  const activeFeed: Contribution[] = feedTab === 'featured'
    ? (featuredData || [])
    : feedTab === 'following'
    ? (followingFeed || [])
    : (contributions || []);

  const getTypeInfo = (type: string) => {
    return CONTRIBUTION_TYPES.find(t => t.id === type) || CONTRIBUTION_TYPES[0];
  };

  const renderContributionCard = ({ item }: { item: Contribution }) => {
    const typeInfo = getTypeInfo(item.type);
    return (
      <View style={styles.contributionCard}>
        <View style={styles.contributionHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
            <MaterialIcons name={typeInfo.icon as any} size={14} color={typeInfo.color} />
            <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.name}</Text>
          </View>
          <Text style={styles.contributionDate}>
            {new Date(item.created_at).toLocaleDateString('pt-PT')}
          </Text>
        </View>
        
        <Text style={styles.contributionTitle}>{item.title}</Text>
        <Text style={styles.contributionContent} numberOfLines={3}>{item.content}</Text>
        
        <View style={styles.contributionFooter}>
          <TouchableOpacity
            style={styles.authorInfo}
            onPress={() => router.push(`/profile/${item.user_id}` as any)}
          >
            <MaterialIcons name="person" size={14} color={palette.gray[500]} />
            <Text style={styles.authorName}>{item.user_name}</Text>
          </TouchableOpacity>

          {item.region && (
            <View style={styles.regionInfo}>
              <MaterialIcons name="place" size={14} color={palette.gray[500]} />
              <Text style={styles.regionName}>{item.region}</Text>
            </View>
          )}

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            style={styles.voteButton}
            onPress={() => handleVote(item.id)}
          >
            <MaterialIcons name="thumb-up" size={16} color={palette.terracotta[500]} />
            <Text style={styles.voteCount}>{item.votes}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, { marginLeft: 4 }]}
            onPress={() => handleReport(item.id)}
          >
            <MaterialIcons name="flag" size={15} color={palette.gray[400]} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: palette.forest[500] }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Comunidade</Text>
          <Text style={styles.headerSubtitle}>Partilhe o seu conhecimento</Text>
        </View>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => isAuthenticated ? setShowCreateModal(true) : login()}
        >
          <MaterialIcons name="add" size={24} color={palette.forest[500]} />
        </TouchableOpacity>
      </View>

      {/* Contribution Types */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.typesScroll}
        contentContainerStyle={styles.typesContent}
      >
        {CONTRIBUTION_TYPES.map((type) => (
          <View key={type.id} style={[styles.typeCard, { borderColor: type.color }]}>
            <MaterialIcons name={type.icon as any} size={24} color={type.color} />
            <Text style={[styles.typeCardText, { color: type.color }]}>{type.name}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Feed tabs */}
      <View style={styles.feedTabs}>
        {([
          { id: 'featured', label: '⭐ Em Destaque' },
          { id: 'recent', label: 'Recentes' },
          { id: 'following', label: 'A Seguir' },
        ] as { id: FeedTab; label: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.feedTab, feedTab === tab.id && styles.feedTabActive]}
            onPress={() => setFeedTab(tab.id)}
          >
            <Text style={[styles.feedTabText, feedTab === tab.id && styles.feedTabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Contributions List */}
      <FlatList
        data={activeFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderContributionCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator size="large" color={palette.terracotta[500]} style={styles.loader} />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="forum" size={48} color={palette.gray[500]} />
              <Text style={styles.emptyText}>Ainda não há contribuições</Text>
              <Text style={styles.emptySubtext}>Seja o primeiro a partilhar!</Text>
              {isAuthenticated ? (
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={() => setShowCreateModal(true)}
                >
                  <Text style={styles.emptyButtonText}>Criar contribuição</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity 
                  style={styles.emptyButton}
                  onPress={login}
                >
                  <Text style={styles.emptyButtonText}>Iniciar sessão</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {/* Create Contribution Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Contribuição</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <MaterialIcons name="close" size={24} color={palette.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type Selection */}
              <Text style={styles.inputLabel}>Tipo de contribuição</Text>
              <View style={styles.typeSelector}>
                {CONTRIBUTION_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[
                      styles.typeSelectorItem,
                      newContribution.type === type.id && { 
                        backgroundColor: type.color + '20',
                        borderColor: type.color 
                      },
                    ]}
                    onPress={() => setNewContribution({ ...newContribution, type: type.id })}
                  >
                    <MaterialIcons 
                      name={type.icon as any} 
                      size={20} 
                      color={newContribution.type === type.id ? type.color : '#64748B'} 
                    />
                    <Text style={[
                      styles.typeSelectorText,
                      newContribution.type === type.id && { color: type.color },
                    ]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Region Selection */}
              <Text style={styles.inputLabel}>Região</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionSelector}>
                {REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.regionChip,
                      newContribution.region === region.id && styles.regionChipActive,
                    ]}
                    onPress={() => setNewContribution({ ...newContribution, region: region.id })}
                  >
                    <Text style={[
                      styles.regionChipText,
                      newContribution.region === region.id && styles.regionChipTextActive,
                    ]}>
                      {region.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Title */}
              <Text style={styles.inputLabel}>Título</Text>
              <TextInput
                style={styles.textInput}
                value={newContribution.title}
                onChangeText={(text) => setNewContribution({ ...newContribution, title: text })}
                placeholder="Dê um título à sua contribuição"
                placeholderTextColor="#64748B"
              />

              {/* Content */}
              <Text style={styles.inputLabel}>Conteúdo</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newContribution.content}
                onChangeText={(text) => setNewContribution({ ...newContribution, content: text })}
                placeholder="Descreva a sua história, correção ou descoberta..."
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Photo */}
              <Text style={styles.inputLabel}>Foto (opcional)</Text>
              {sessionToken && (
                <ImageUpload
                  token={sessionToken}
                  context="contribution"
                  onUpload={(url) => setNewContribution((prev) => ({
                    ...prev,
                    image_urls: [...(prev.image_urls || []), url],
                  }))}
                />
              )}

              {/* Submit Button */}
              <TouchableOpacity 
                style={styles.submitButton}
                onPress={handleCreate}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#2E5E4E" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#2E5E4E" />
                    <Text style={styles.submitButtonText}>Submeter</Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: palette.gray[50],
  },
  headerSubtitle: {
    fontSize: 14,
    color: palette.gray[400],
    marginTop: 2,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: palette.terracotta[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  typesScroll: {
    maxHeight: 80,
    marginBottom: 16,
  },
  typesContent: {
    paddingHorizontal: 20,
  },
  typeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: palette.forest[600],
    borderWidth: 1,
    marginRight: 12,
    minWidth: 80,
  },
  typeCardText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  contributionCard: {
    backgroundColor: palette.forest[600],
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.forest[700],
  },
  contributionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  contributionDate: {
    fontSize: 12,
    color: palette.gray[500],
  },
  contributionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.gray[50],
    marginBottom: 8,
  },
  contributionContent: {
    fontSize: 14,
    color: palette.gray[400],
    lineHeight: 20,
    marginBottom: 12,
  },
  contributionFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  authorName: {
    fontSize: 12,
    color: palette.gray[500],
  },
  regionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  regionName: {
    fontSize: 12,
    color: palette.gray[500],
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    // Touch target fix: min 44px height via paddingVertical
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: `${palette.terracotta[500]}20`,
    borderRadius: 16,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
  },
  voteCount: {
    fontSize: 12,
    fontWeight: '600',
    color: palette.terracotta[500],
  },
  feedTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.15)',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  feedTab: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: 9,
  },
  feedTabActive: {
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  feedTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  feedTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  loader: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: palette.gray[400],
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: palette.gray[500],
    marginTop: 4,
  },
  emptyButton: {
    marginTop: 24,
    backgroundColor: palette.terracotta[500],
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: palette.forest[500],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: palette.forest[600],
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: palette.gray[50],
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: palette.gray[400],
    marginBottom: 8,
    marginTop: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeSelectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: palette.forest[500],
    borderWidth: 1,
    borderColor: palette.forest[700],
    gap: 6,
  },
  typeSelectorText: {
    fontSize: 13,
    color: palette.gray[400],
  },
  regionSelector: {
    marginVertical: 8,
  },
  regionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: palette.forest[500],
    marginRight: 8,
    borderWidth: 1,
    borderColor: palette.forest[700],
  },
  regionChipActive: {
    backgroundColor: `${palette.terracotta[500]}20`,
    borderColor: palette.terracotta[500],
  },
  regionChipText: {
    fontSize: 13,
    color: palette.gray[400],
  },
  regionChipTextActive: {
    color: palette.terracotta[500],
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: palette.forest[500],
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: palette.gray[50],
    borderWidth: 1,
    borderColor: palette.forest[700],
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.terracotta[500],
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.forest[500],
  },
});
