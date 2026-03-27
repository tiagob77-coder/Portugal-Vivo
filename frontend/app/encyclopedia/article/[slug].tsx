/**
 * Encyclopedia Article Detail Page
 * Shows full content of an encyclopedia article
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getEncyclopediaArticle, EncyclopediaArticleDetail } from '../../../src/services/api';

const { width } = Dimensions.get('window');

export default function EncyclopediaArticlePage() {
  const router = useRouter();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['encyclopedia-article', slug],
    queryFn: () => getEncyclopediaArticle(slug!),
    enabled: !!slug,
  });

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color="#C49A6C" />
        <Text style={styles.loadingText}>A carregar artigo...</Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View style={[styles.container, styles.errorContainer]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Artigo não encontrado</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}> 
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity style={styles.headerBtn}>
          <MaterialIcons name="share" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Image */}
        {article.image_url && (
          <Image
            source={{ uri: article.image_url }}
            style={styles.heroImage}
            resizeMode="cover"
          />
        )}

        {/* Article Content */}
        <View style={styles.content}>
          {/* Category & Universe */}
          <View style={styles.metaRow}>
            {article.universe_name && (
              <View style={[styles.badge, { backgroundColor: '#6B9E7820' }]}>
                <Text style={[styles.badgeText, { color: '#6B9E78' }]}>{article.universe_name}</Text>
              </View>
            )}
            {article.category_name && (
              <View style={[styles.badge, { backgroundColor: '#C49A6C20' }]}>
                <Text style={[styles.badgeText, { color: '#C49A6C' }]}>{article.category_name}</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>{article.title}</Text>

          {/* Summary */}
          {article.summary && (
            <Text style={styles.summary}>{article.summary}</Text>
          )}

          {/* Body */}
          <View style={styles.bodyContainer}>
            <Text style={styles.body}>{article.body}</Text>
          </View>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Text style={styles.tagsLabel}>Tópicos relacionados</Text>
              <View style={styles.tagsRow}>
                {article.tags.map((tag, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Related Items */}
          {article.related_items && article.related_items.length > 0 && (
            <View style={styles.relatedSection}>
              <Text style={styles.sectionTitle}>Locais Relacionados</Text>
              {article.related_items.slice(0, 5).map((item: any) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.relatedItem}
                  onPress={() => router.push(`/heritage/${item.id}` as any)}
                >
                  <MaterialIcons name="place" size={18} color="#6B9E78" />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.relatedItemName}>{item.name}</Text>
                    <Text style={styles.relatedItemMeta}>{item.region}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Views count */}
          <View style={styles.viewsRow}>
            <MaterialIcons name="visibility" size={14} color="#94A3B8" />
            <Text style={styles.viewsText}>{article.views || 0} visualizações</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAF8F3',
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748B',
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    color: '#64748B',
  },
  backBtn: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#C49A6C',
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FAF8F3',
  },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
      default: {},
    }),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroImage: {
    width: width,
    height: 220,
    backgroundColor: '#E8E3DC',
  },
  content: {
    padding: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
    lineHeight: 32,
  },
  summary: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
    marginBottom: 20,
    fontStyle: 'italic',
  },
  bodyContainer: {
    marginBottom: 24,
  },
  body: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 26,
  },
  tagsContainer: {
    marginBottom: 24,
  },
  tagsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 10,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E8E3DC',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: '#4B5563',
  },
  relatedSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 14,
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 },
      android: { elevation: 1 },
      default: {},
    }),
  },
  relatedItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A1A',
  },
  relatedItemMeta: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  viewsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewsText: {
    fontSize: 13,
    color: '#94A3B8',
  },
});
