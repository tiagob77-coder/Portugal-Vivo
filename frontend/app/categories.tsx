import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ImageBackground } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getMainCategories } from '../src/services/api';
import { LinearGradient } from 'expo-linear-gradient';

// Main category images
const MAIN_CATEGORY_IMAGES: Record<string, string> = {
  territorio_natureza: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=600&q=80',
  historia_patrimonio: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
  gastronomia_produtos: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80',
  cultura_viva: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80',
  praias_mar: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80',
  experiencias_rotas: 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=600&q=80',
};

export default function CategoriesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const { data: mainCategories = [] } = useQuery({
    queryKey: ['mainCategories'],
    queryFn: getMainCategories,
  });

  const handleSubcategoryPress = (subcategoryId: string) => {
    router.push(`/category/${subcategoryId}`);
  };

  const toggleExpand = (categoryId: string) => {
    setExpandedCategory(expandedCategory === categoryId ? null : categoryId);
  };

  const totalPOI = mainCategories.reduce((sum, mc) => sum + (mc.poi_target || 0), 0);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#FAF8F3" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Portugal Vivo</Text>
          <Text style={styles.headerSubtitle}>6 categorias  |  44 temas  |  ~{totalPOI.toLocaleString()} POI</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* Main Categories */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {mainCategories.map((mc) => {
          const isExpanded = expandedCategory === mc.id;
          const image = MAIN_CATEGORY_IMAGES[mc.id] || MAIN_CATEGORY_IMAGES.territorio_natureza;
          const subcategories = mc.subcategories || [];

          return (
            <View key={mc.id} style={styles.mainCategoryContainer}>
              {/* Main Category Card */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => toggleExpand(mc.id)}
              >
                <ImageBackground
                  source={{ uri: image }}
                  style={styles.mainCategoryCard}
                  imageStyle={styles.mainCategoryImage}
                >
                  <LinearGradient
                    colors={['rgba(15, 23, 42, 0.15)', 'rgba(15, 23, 42, 0.88)']}
                    style={styles.mainCategoryGradient}
                  >
                    <View style={styles.mainCategoryHeader}>
                      <View style={[styles.iconContainer, { backgroundColor: mc.color + '30' }]}>
                        <MaterialIcons name={mc.icon as any} size={28} color={mc.color} />
                      </View>
                      <View style={styles.mainCategoryInfo}>
                        <Text style={styles.mainCategoryName}>{mc.name}</Text>
                        <Text style={styles.mainCategoryDescription}>{mc.description}</Text>
                      </View>
                    </View>
                    <View style={styles.mainCategoryFooter}>
                      <View style={styles.statsRow}>
                        <Text style={styles.statText}>{subcategories.length} temas</Text>
                        <Text style={styles.statDivider}>|</Text>
                        <Text style={styles.statText}>~{(mc.poi_target || 0).toLocaleString()} POI</Text>
                      </View>
                      <MaterialIcons
                        name={isExpanded ? 'expand-less' : 'expand-more'}
                        size={24}
                        color="#C49A6C"
                      />
                    </View>
                  </LinearGradient>
                </ImageBackground>
              </TouchableOpacity>

              {/* Expanded Subcategories */}
              {isExpanded && (
                <View style={styles.subcategoriesContainer}>
                  {subcategories.map((sub: any, index: number) => (
                    <TouchableOpacity
                      key={sub.id}
                      style={[
                        styles.subcategoryRow,
                        index === subcategories.length - 1 && styles.subcategoryRowLast,
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSubcategoryPress(sub.id)}
                    >
                      <View style={[styles.subIconContainer, { backgroundColor: sub.color + '20' }]}>
                        <MaterialIcons name={sub.icon as any} size={20} color={sub.color} />
                      </View>
                      <View style={styles.subInfo}>
                        <Text style={styles.subName}>{sub.name}</Text>
                        <Text style={styles.subTheme}>{sub.theme}</Text>
                      </View>
                      <View style={styles.subRight}>
                        <Text style={styles.subCount}>{sub.poi_target}</Text>
                        <MaterialIcons name="chevron-right" size={20} color="#64748B" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2E5E4E',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#2E5E4E',
    borderBottomWidth: 1,
    borderBottomColor: '#264E41',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#264E41',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FAF8F3',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  mainCategoryContainer: {
    marginBottom: 14,
  },
  mainCategoryCard: {
    height: 140,
    borderRadius: 16,
    overflow: 'hidden',
  },
  mainCategoryImage: {
    borderRadius: 16,
  },
  mainCategoryGradient: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  mainCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainCategoryInfo: {
    flex: 1,
  },
  mainCategoryName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  mainCategoryDescription: {
    fontSize: 12,
    color: '#C8C3B8',
    lineHeight: 16,
  },
  mainCategoryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C49A6C',
  },
  statDivider: {
    fontSize: 12,
    color: '#64748B',
  },
  subcategoriesContainer: {
    backgroundColor: '#264E41',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: -8,
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
  },
  subcategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#2A5544',
    gap: 12,
  },
  subcategoryRowLast: {
    borderBottomWidth: 0,
  },
  subIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subInfo: {
    flex: 1,
  },
  subName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAF8F3',
  },
  subTheme: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  subRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  subCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#C49A6C',
  },
});
