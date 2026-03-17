import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getStats, getCategories } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, isLoading: authLoading } = useAuth();
  
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  const handleExplore = () => {
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#0F172A']}
        style={StyleSheet.absoluteFill}
      />
      
      <ScrollView 
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo/Title Section */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <MaterialIcons name="explore" size={48} color="#F59E0B" />
          </View>
          <Text style={styles.title}>Património Vivo</Text>
          <Text style={styles.subtitle}>de Portugal</Text>
          <Text style={styles.tagline}>
            Descubra as lendas, tradições e saberes
            {"\n"}que fazem a alma portuguesa
          </Text>
        </View>

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          {statsLoading ? (
            <ActivityIndicator size="small" color="#F59E0B" />
          ) : stats ? (
            <>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.total_items}</Text>
                <Text style={styles.statLabel}>Itens de Património</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.total_routes}</Text>
                <Text style={styles.statLabel}>Rotas Temáticas</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>7</Text>
                <Text style={styles.statLabel}>Regiões</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Features */}
        <View style={styles.featuresContainer}>
          <FeatureItem 
            icon="map" 
            title="Mapa Cultural" 
            description="Explore 20 camadas de património"
            color="#3B82F6"
          />
          <FeatureItem 
            icon="route" 
            title="Rotas Temáticas" 
            description="Vinhos, aldeias, natureza e mais"
            color="#22C55E"
          />
          <FeatureItem 
            icon="auto-stories" 
            title="Narrativas IA" 
            description="Histórias personalizadas"
            color="#8B5CF6"
          />
        </View>

        {/* CTA Button */}
        <TouchableOpacity 
          style={styles.ctaButton}
          onPress={handleExplore}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={styles.ctaText}>Explorar Portugal</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#0F172A" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Categories Preview */}
        <View style={styles.categoriesPreview}>
          <Text style={styles.sectionTitle}>20 Camadas de Património</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            {[
              { icon: 'auto-stories', label: 'Lendas', color: '#8B5CF6' },
              { icon: 'celebration', label: 'Festas', color: '#F59E0B' },
              { icon: 'restaurant', label: 'Gastronomia', color: '#EF4444' },
              { icon: 'home-work', label: 'Aldeias', color: '#D97706' },
              { icon: 'forest', label: 'Natureza', color: '#22C55E' },
              { icon: 'church', label: 'Religioso', color: '#7C3AED' },
            ].map((cat, index) => (
              <View key={index} style={[styles.categoryChip, { borderColor: cat.color }]}>
                <MaterialIcons name={cat.icon as any} size={18} color={cat.color} />
                <Text style={[styles.categoryChipText, { color: cat.color }]}>{cat.label}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          Preservando a memória cultural portuguesa
        </Text>
      </ScrollView>
    </View>
  );
}

function FeatureItem({ icon, title, description, color }: { icon: string; title: string; description: string; color: string }) {
  return (
    <View style={styles.featureItem}>
      <View style={[styles.featureIcon, { backgroundColor: color + '20' }]}>
        <MaterialIcons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.featureText}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F59E0B20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#F8FAFC',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#F59E0B',
    marginTop: -4,
  },
  tagline: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F59E0B',
  },
  statLabel: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#334155',
  },
  featuresContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  featureDescription: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  ctaButton: {
    width: '100%',
    marginBottom: 32,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
    gap: 8,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  categoriesPreview: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 12,
  },
  categoriesScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    gap: 6,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
});
