import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api, { getApprovedContributions, createContribution, voteContribution, Contribution, ContributionCreate, getCategories } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import ImageUpload from '../../src/components/ImageUpload';
import { useTheme, palette } from '../../src/theme';
import { currentLocale } from '../../src/i18n/format';

const CONTRIBUTION_TYPES = [
  { id: 'story', labelKey: 'exploreScreens.community.types.story', icon: 'auto-stories', color: '#8B5CF6' },
  { id: 'correction', labelKey: 'exploreScreens.community.types.correction', icon: 'edit', color: '#C49A6C' },
  { id: 'new_item', labelKey: 'exploreScreens.community.types.newItem', icon: 'add-location', color: '#22C55E' },
  { id: 'photo', labelKey: 'exploreScreens.community.types.photo', icon: 'photo-camera', color: '#3B82F6' },
];

const REGIONS = [
  { id: 'norte', labelKey: 'exploreScreens.regions.norte' },
  { id: 'centro', labelKey: 'exploreScreens.regions.centro' },
  { id: 'lisboa', labelKey: 'exploreScreens.regions.lisboa' },
  { id: 'alentejo', labelKey: 'exploreScreens.regions.alentejo' },
  { id: 'algarve', labelKey: 'exploreScreens.regions.algarve' },
  { id: 'acores', labelKey: 'exploreScreens.regions.acores' },
  { id: 'madeira', labelKey: 'exploreScreens.regions.madeira' },
];

type FeedTab = 'featured' | 'recent' | 'following';

export default function CommunityScreen() {
  const { t } = useTranslation();
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
      Alert.alert(t('exploreScreens.community.thanks'), t('exploreScreens.community.reportSubmitted'));
    },
    onError: (e: any) => {
      Alert.alert(t('exploreScreens.community.error'), e?.response?.data?.detail || t('exploreScreens.community.reportError'));
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
      Alert.alert(t('exploreScreens.community.success'), t('exploreScreens.community.contributionSubmitted'));
      refetch();
    },
    onError: () => {
      Alert.alert(t('exploreScreens.community.error'), t('exploreScreens.community.contributionError'));
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
      Alert.alert(t('exploreScreens.community.attention'), t('exploreScreens.community.loginToContribute'));
      return;
    }
    if (!newContribution.title || !newContribution.content) {
      Alert.alert(t('exploreScreens.community.attention'), t('exploreScreens.community.fillTitleContent'));
      return;
    }
    createMutation.mutate(newContribution);
  };

  const handleVote = (id: string) => {
    if (!isAuthenticated) {
      Alert.alert(t('exploreScreens.community.attention'), t('exploreScreens.community.loginToVote'));
      return;
    }
    voteMutation.mutate(id);
  };

  const handleReport = (id: string) => {
    if (!isAuthenticated) {
      Alert.alert(t('exploreScreens.community.attention'), t('exploreScreens.community.loginToReport'));
      return;
    }
    // The reason values sent to the backend stay in Portuguese; only the labels are translated.
    Alert.alert(t('exploreScreens.community.reportTitle'), t('exploreScreens.community.reportQuestion'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('exploreScreens.community.reasonFalseInfo'), onPress: () => reportMutation.mutate({ id, reason: 'Informação falsa' }) },
      { text: t('exploreScreens.community.reasonOffensive'), onPress: () => reportMutation.mutate({ id, reason: 'Conteúdo ofensivo' }) },
      { text: t('exploreScreens.community.reasonSpam'), onPress: () => reportMutation.mutate({ id, reason: 'Spam' }) },
    ]);
  };

  const activeFeed: Contribution[] = feedTab === 'featured'
    ? (featuredData || [])
    : feedTab === 'following'
    ? (followingFeed || [])
    : (contributions || []);

  const getTypeInfo = (type: string) => {
    return CONTRIBUTION_TYPES.find(ct => ct.id === type) || CONTRIBUTION_TYPES[0];
  };

  const renderContributionCard = ({ item }: { item: Contribution }) => {
    const typeInfo = getTypeInfo(item.type);
    return (
      <View style={styles.contributionCard}>
        <View style={styles.contributionHeader}>
          <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '20' }]}>
            <MaterialIcons name={typeInfo.icon as any} size={14} color={typeInfo.color} />
            <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{t(typeInfo.labelKey)}</Text>
          </View>
          <Text style={styles.contributionDate}>
            {new Date(item.created_at).toLocaleDateString(currentLocale())}
          </Text>
        </View>
        
        <Text style={styles.contributionTitle}>{item.title}</Text>
        <Text style={styles.contributionContent} numberOfLines={3}>{item.content}</Text>
        
        <View style={styles.contributionFooter}>
          <TouchableOpacity
            style={styles.authorInfo}
            onPress={() => router.push(`/profile/${item.user_id}`)}
            accessibilityRole="link"
            accessibilityLabel={t('exploreScreens.community.viewProfileA11y', { name: item.user_name })}
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
            accessibilityRole="button"
            accessibilityLabel={t('exploreScreens.community.voteA11y', { title: item.title })}
          >
            <MaterialIcons name="thumb-up" size={16} color={palette.terracotta[500]} />
            <Text style={styles.voteCount}>{item.votes}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voteButton, { marginLeft: 4 }]}
            onPress={() => handleReport(item.id)}
            accessibilityRole="button"
            accessibilityLabel={t('exploreScreens.community.reportA11y', { title: item.title })}
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
          <Text style={styles.headerTitle}>{t('exploreScreens.community.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('exploreScreens.community.subtitle')}</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => isAuthenticated ? setShowCreateModal(true) : login()}
          accessibilityRole="button"
          accessibilityLabel={t('exploreScreens.community.newContributionA11y')}
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
            <Text style={[styles.typeCardText, { color: type.color }]}>{t(type.labelKey)}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Feed tabs */}
      <View style={styles.feedTabs}>
        {([
          { id: 'featured', label: t('exploreScreens.community.tabs.featured') },
          { id: 'recent', label: t('exploreScreens.community.tabs.recent') },
          { id: 'following', label: t('exploreScreens.community.tabs.following') },
        ] as { id: FeedTab; label: string }[]).map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.feedTab, feedTab === tab.id && styles.feedTabActive]}
            onPress={() => setFeedTab(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: feedTab === tab.id }}
            accessibilityLabel={t('exploreScreens.community.tabA11y', { label: tab.label })}
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
              <Text style={styles.emptyText}>{t('exploreScreens.community.emptyTitle')}</Text>
              <Text style={styles.emptySubtext}>{t('exploreScreens.community.emptySubtitle')}</Text>
              {isAuthenticated ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => setShowCreateModal(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('exploreScreens.community.createContribution')}
                >
                  <Text style={styles.emptyButtonText}>{t('exploreScreens.community.createContribution')}</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={login}
                  accessibilityRole="button"
                  accessibilityLabel={t('exploreScreens.community.signIn')}
                >
                  <Text style={styles.emptyButtonText}>{t('exploreScreens.community.signIn')}</Text>
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
              <Text style={styles.modalTitle}>{t('exploreScreens.community.modalTitle')}</Text>
              <TouchableOpacity
                onPress={() => setShowCreateModal(false)}
                accessibilityRole="button"
                accessibilityLabel={t('common.close')}
              >
                <MaterialIcons name="close" size={24} color={palette.gray[500]} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Type Selection */}
              <Text style={styles.inputLabel}>{t('exploreScreens.community.typeLabel')}</Text>
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
                    accessibilityRole="tab"
                    accessibilityState={{ selected: newContribution.type === type.id }}
                    accessibilityLabel={t('exploreScreens.community.typeA11y', { type: t(type.labelKey) })}
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
                      {t(type.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Region Selection */}
              <Text style={styles.inputLabel}>{t('exploreScreens.community.regionLabel')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.regionSelector}>
                {REGIONS.map((region) => (
                  <TouchableOpacity
                    key={region.id}
                    style={[
                      styles.regionChip,
                      newContribution.region === region.id && styles.regionChipActive,
                    ]}
                    onPress={() => setNewContribution({ ...newContribution, region: region.id })}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: newContribution.region === region.id }}
                    accessibilityLabel={t('exploreScreens.community.regionA11y', { region: t(region.labelKey) })}
                  >
                    <Text style={[
                      styles.regionChipText,
                      newContribution.region === region.id && styles.regionChipTextActive,
                    ]}>
                      {t(region.labelKey)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Title */}
              <Text style={styles.inputLabel}>{t('exploreScreens.community.titleLabel')}</Text>
              <TextInput
                style={styles.textInput}
                value={newContribution.title}
                onChangeText={(text) => setNewContribution({ ...newContribution, title: text })}
                placeholder={t('exploreScreens.community.titlePlaceholder')}
                placeholderTextColor="#64748B"
              />

              {/* Content */}
              <Text style={styles.inputLabel}>{t('exploreScreens.community.contentLabel')}</Text>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={newContribution.content}
                onChangeText={(text) => setNewContribution({ ...newContribution, content: text })}
                placeholder={t('exploreScreens.community.contentPlaceholder')}
                placeholderTextColor="#64748B"
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />

              {/* Photo */}
              <Text style={styles.inputLabel}>{t('exploreScreens.community.photoLabel')}</Text>
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
                accessibilityRole="button"
                accessibilityState={{ disabled: createMutation.isPending }}
                accessibilityLabel={t('exploreScreens.community.submitA11y')}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color="#2E5E4E" />
                ) : (
                  <>
                    <MaterialIcons name="send" size={20} color="#2E5E4E" />
                    <Text style={styles.submitButtonText}>{t('exploreScreens.community.submit')}</Text>
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
