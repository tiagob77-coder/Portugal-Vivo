import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getHeritageItem, getCategories, generateNarrative, addFavorite, removeFavorite } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { Category } from '../../src/types';

const REGION_NAMES: Record<string, string> = {
  norte: 'Norte',
  centro: 'Centro',
  lisboa: 'Lisboa e Vale do Tejo',
  alentejo: 'Alentejo',
  algarve: 'Algarve',
  acores: 'Açores',
  madeira: 'Madeira',
};

export default function HeritageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, sessionToken } = useAuth();
  const [narrativeStyle, setNarrativeStyle] = useState<'storytelling' | 'educational' | 'brief'>('storytelling');
  const [showNarrative, setShowNarrative] = useState(false);

  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['heritage', id],
    queryFn: () => getHeritageItem(id!),
    enabled: !!id,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: narrativeData, isLoading: narrativeLoading, refetch: refetchNarrative } = useQuery({
    queryKey: ['narrative', id, narrativeStyle],
    queryFn: () => generateNarrative(id!, narrativeStyle),
    enabled: showNarrative,
  });

  const isFavorite = user?.favorites?.includes(id!) || false;

  const addFavoriteMutation = useMutation({
    mutationFn: () => addFavorite(id!, sessionToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      Alert.alert('Sucesso', 'Adicionado aos favoritos!');
    },
  });

  const removeFavoriteMutation = useMutation({
    mutationFn: () => removeFavorite(id!, sessionToken!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      Alert.alert('Sucesso', 'Removido dos favoritos!');
    },
  });

  const toggleFavorite = () => {
    if (!isAuthenticated) {
      Alert.alert('Atenção', 'Precisa de iniciar sessão para guardar favoritos.');
      return;
    }
    if (isFavorite) {
      removeFavoriteMutation.mutate();
    } else {
      addFavoriteMutation.mutate();
    }
  };

  const category = categories.find((c: Category) => c.id === item?.category);

  if (itemLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <MaterialIcons name="error-outline" size={48} color="#EF4444" />
        <Text style={styles.errorText}>Item não encontrado</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#F8FAFC" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]} 
          onPress={toggleFavorite}
        >
          <MaterialIcons 
            name={isFavorite ? 'favorite' : 'favorite-border'} 
            size={24} 
            color={isFavorite ? '#EF4444' : '#F8FAFC'} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Category Badge */}
        <View style={[
          styles.categoryBadge, 
          { backgroundColor: (category?.color || '#6366F1') + '20' }
        ]}>
          <MaterialIcons 
            name={(category?.icon || 'place') as any} 
            size={18} 
            color={category?.color || '#6366F1'} 
          />
          <Text style={[styles.categoryText, { color: category?.color || '#6366F1' }]}>
            {category?.name || item.category}
          </Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{item.name}</Text>

        {/* Location */}
        {item.address && (
          <View style={styles.locationRow}>
            <MaterialIcons name="place" size={18} color="#94A3B8" />
            <Text style={styles.locationText}>{item.address}</Text>
          </View>
        )}

        {/* Region */}
        <View style={styles.regionBadge}>
          <MaterialIcons name="map" size={14} color="#64748B" />
          <Text style={styles.regionText}>{REGION_NAMES[item.region] || item.region}</Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Descrição</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>

        {/* Location Map Preview */}
        {item.location && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Localização</Text>
            <View style={styles.mapPreview}>
              <MaterialIcons name="map" size={32} color="#64748B" />
              <Text style={styles.mapPreviewText}>
                Lat: {item.location.lat.toFixed(4)}, Lng: {item.location.lng.toFixed(4)}
              </Text>
            </View>
          </View>
        )}

        {/* AI Narrative Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="auto-stories" size={20} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Narrativa IA</Text>
          </View>
          
          {!showNarrative ? (
            <View>
              <Text style={styles.narrativeIntro}>
                Gere uma narrativa personalizada sobre este elemento do património.
              </Text>
              
              {/* Style Selection */}
              <View style={styles.styleSelector}>
                {[
                  { id: 'storytelling', label: 'Contador de Histórias', icon: 'auto-stories' },
                  { id: 'educational', label: 'Educativo', icon: 'school' },
                  { id: 'brief', label: 'Resumido', icon: 'short-text' },
                ].map((style) => (
                  <TouchableOpacity
                    key={style.id}
                    style={[
                      styles.styleOption,
                      narrativeStyle === style.id && styles.styleOptionActive,
                    ]}
                    onPress={() => setNarrativeStyle(style.id as any)}
                  >
                    <MaterialIcons 
                      name={style.icon as any} 
                      size={18} 
                      color={narrativeStyle === style.id ? '#8B5CF6' : '#64748B'} 
                    />
                    <Text style={[
                      styles.styleOptionText,
                      narrativeStyle === style.id && styles.styleOptionTextActive,
                    ]}>
                      {style.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity 
                style={styles.generateButton}
                onPress={() => setShowNarrative(true)}
              >
                <MaterialIcons name="auto-fix-high" size={20} color="#0F172A" />
                <Text style={styles.generateButtonText}>Gerar Narrativa</Text>
              </TouchableOpacity>
            </View>
          ) : narrativeLoading ? (
            <View style={styles.narrativeLoading}>
              <ActivityIndicator size="small" color="#8B5CF6" />
              <Text style={styles.narrativeLoadingText}>A gerar narrativa...</Text>
            </View>
          ) : narrativeData ? (
            <View style={styles.narrativeContent}>
              <Text style={styles.narrativeText}>{narrativeData.narrative}</Text>
              <TouchableOpacity 
                style={styles.regenerateButton}
                onPress={() => refetchNarrative()}
              >
                <MaterialIcons name="refresh" size={16} color="#8B5CF6" />
                <Text style={styles.regenerateButtonText}>Gerar nova narrativa</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Tags */}
        {item.tags && item.tags.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <View style={styles.tagsContainer}>
              {item.tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0F172A',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteButtonActive: {
    backgroundColor: '#EF444420',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F8FAFC',
    marginBottom: 12,
    lineHeight: 34,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    color: '#94A3B8',
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
    marginBottom: 24,
  },
  regionText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#CBD5E1',
    lineHeight: 26,
  },
  mapPreview: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  mapPreviewText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 8,
  },
  narrativeIntro: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 16,
  },
  styleSelector: {
    gap: 8,
    marginBottom: 16,
  },
  styleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  styleOptionActive: {
    backgroundColor: '#8B5CF620',
    borderColor: '#8B5CF6',
  },
  styleOptionText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  styleOptionTextActive: {
    color: '#8B5CF6',
    fontWeight: '600',
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#8B5CF6',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  narrativeLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    padding: 24,
    borderRadius: 12,
    gap: 12,
  },
  narrativeLoadingText: {
    fontSize: 14,
    color: '#94A3B8',
  },
  narrativeContent: {
    backgroundColor: '#1E293B',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8B5CF640',
  },
  narrativeText: {
    fontSize: 15,
    color: '#E2E8F0',
    lineHeight: 24,
  },
  regenerateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    gap: 6,
  },
  regenerateButtonText: {
    fontSize: 13,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#CBD5E1',
  },
});
