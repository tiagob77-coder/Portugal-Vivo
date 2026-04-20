/**
 * Guia de Transportes de Portugal
 * Complete transport guide with operators, cards, and travel tips
 */
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { colors, typography, borders, shadows } from '../../src/theme';
import { useTheme } from '../../src/context/ThemeContext';
import api from '../../src/services/api';

const SECTION_META: Record<string, { label: string; icon: string; color: string; emoji: string }> = {
  nacional: { label: 'Nacional', icon: 'train', color: '#2563EB', emoji: '' },
  lisboa: { label: 'Lisboa', icon: 'subway', color: '#DC2626', emoji: '' },
  porto: { label: 'Porto', icon: 'tram', color: '#7C3AED', emoji: '' },
  regional: { label: 'Regional', icon: 'directions-bus', color: '#059669', emoji: '' },
  aereo: { label: 'Aereo', icon: 'flight', color: '#0891B2', emoji: '' },
};

export default function TransportesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors: tc } = useTheme();
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const { data: sectionsData } = useQuery({
    queryKey: ['transport-sections'],
    queryFn: async () => { const res = await api.get('/transportes/sections'); return res.data; },
  });

  const { data: operatorsData, isLoading: operatorsLoading } = useQuery({
    queryKey: ['transport-operators', activeSection],
    queryFn: async () => {
      const params = activeSection ? `?section=${activeSection}` : '';
      const res = await api.get(`/transportes/operators${params}`);
      return res.data;
    },
  });

  const { data: cardsData } = useQuery({
    queryKey: ['transport-cards'],
    queryFn: async () => { const res = await api.get('/transportes/cards'); return res.data; },
  });

  const sections = sectionsData?.sections || [];
  const operators = operatorsData?.operators || [];
  const cards = cardsData?.cards || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: tc.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} data-testid="transport-back-btn">
            <MaterialIcons name="arrow-back" size={22} color={colors.gray[700]} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Guia de Transportes</Text>
            <Text style={styles.headerSubtitle}>
              {sectionsData?.total_operators || 0} operadores em Portugal
            </Text>
          </View>
        </View>

        {/* Comboios e Ligacoes CTA */}
        <TouchableOpacity
          style={styles.comboiosCta}
          onPress={() => router.push('/comboios')}
          activeOpacity={0.85}
          data-testid="transport-comboios-cta"
        >
          <View style={styles.comboiosCtaLeft}>
            <View style={styles.comboiosCtaIcon}>
              <MaterialIcons name="train" size={26} color="#FFF" />
            </View>
            <View style={styles.comboiosCtaText}>
              <Text style={styles.comboiosCtaTitle}>Comboios e Ligacoes</Text>
              <Text style={styles.comboiosCtaSubtitle}>CP, Metro, Ferries, Cartoes</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Section Filters */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll} contentContainerStyle={styles.filtersContent}>
          <TouchableOpacity
            style={[styles.filterChip, !activeSection && styles.filterChipActive]}
            onPress={() => setActiveSection(null)}
            data-testid="transport-filter-all"
          >
            <MaterialIcons name="commute" size={16} color={!activeSection ? '#FFF' : colors.gray[600]} />
            <Text style={[styles.filterChipText, !activeSection && styles.filterChipTextActive]}>Todos</Text>
          </TouchableOpacity>
          {sections.map((sec: any) => {
            const meta = SECTION_META[sec.id] || { label: sec.id, icon: 'commute', color: '#666' };
            const isActive = activeSection === sec.id;
            return (
              <TouchableOpacity
                key={sec.id}
                style={[styles.filterChip, isActive && { backgroundColor: meta.color }]}
                onPress={() => setActiveSection(isActive ? null : sec.id)}
                data-testid={`transport-filter-${sec.id}`}
              >
                <MaterialIcons name={meta.icon as any} size={16} color={isActive ? '#FFF' : meta.color} />
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {meta.label} ({sec.count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Stats Bar */}
        <View style={styles.statsBar}>
          {sections.slice(0, 4).map((sec: any) => {
            const meta = SECTION_META[sec.id] || { label: sec.id, icon: 'commute', color: '#666' };
            return (
              <View key={sec.id} style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: meta.color + '15' }]}>
                  <MaterialIcons name={meta.icon as any} size={18} color={meta.color} />
                </View>
                <Text style={styles.statCount}>{sec.count}</Text>
                <Text style={styles.statLabel}>{meta.label}</Text>
              </View>
            );
          })}
        </View>

        {/* Operators List */}
        {operatorsLoading ? (
          <ActivityIndicator size="large" color={colors.terracotta[500]} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.operatorsList}>
            {operators.map((op: any, idx: number) => {
              const meta = SECTION_META[op.section] || { label: op.section, icon: 'commute', color: '#666' };
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.operatorCard}
                  onPress={() => op.website && Linking.openURL(op.website)}
                  activeOpacity={0.85}
                  data-testid={`transport-operator-${idx}`}
                >
                  <View style={styles.operatorHeader}>
                    <View style={[styles.operatorIcon, { backgroundColor: meta.color + '12' }]}>
                      <MaterialIcons name={meta.icon as any} size={22} color={meta.color} />
                    </View>
                    <View style={styles.operatorHeaderText}>
                      <Text style={styles.operatorName}>{op.name}</Text>
                      <View style={styles.operatorTypeBadge}>
                        <Text style={[styles.operatorTypeText, { color: meta.color }]}>{op.transport_type}</Text>
                      </View>
                    </View>
                    {op.website && (
                      <MaterialIcons name="open-in-new" size={16} color={colors.gray[400]} />
                    )}
                  </View>
                  {op.region ? (
                    <View style={styles.operatorRegionRow}>
                      <MaterialIcons name="location-on" size={13} color={colors.gray[400]} />
                      <Text style={styles.operatorRegion}>{op.region}</Text>
                    </View>
                  ) : null}
                  <Text style={styles.operatorZone} numberOfLines={2}>{op.geographic_zone}</Text>
                  <View style={styles.operatorFooter}>
                    <View style={styles.operatorBuyBadge}>
                      <MaterialIcons name="shopping-cart" size={11} color={colors.forest[600]} />
                      <Text style={styles.operatorBuyText} numberOfLines={1}>{op.how_to_buy}</Text>
                    </View>
                  </View>
                  {op.tip && (
                    <View style={styles.operatorTip}>
                      <MaterialIcons name="lightbulb" size={13} color="#C49A6C" />
                      <Text style={styles.operatorTipText} numberOfLines={2}>{op.tip}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Transport Cards Section */}
        {cards.length > 0 && (
          <View style={styles.cardsSection}>
            <View style={styles.cardsSectionHeader}>
              <MaterialIcons name="credit-card" size={22} color={colors.terracotta[500]} />
              <Text style={styles.cardsSectionTitle}>Cartoes de Transporte</Text>
            </View>
            <Text style={styles.cardsSectionSubtitle}>
              Os passes e cartoes que facilitam viajar em Portugal
            </Text>
            {cards.map((card: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={styles.transportCard}
                onPress={() => card.website && Linking.openURL(card.website)}
                activeOpacity={0.85}
                data-testid={`transport-card-${idx}`}
              >
                <View style={styles.transportCardHeader}>
                  <View style={styles.transportCardIcon}>
                    <MaterialIcons name="credit-card" size={20} color="#FFF" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.transportCardName}>{card.name}</Text>
                    <Text style={styles.transportCardCity}>{card.city_zone}</Text>
                  </View>
                  <View style={styles.transportCardPrice}>
                    <Text style={styles.transportCardPriceText}>{card.base_price}</Text>
                  </View>
                </View>
                <View style={styles.transportCardMeta}>
                  <View style={styles.transportCardMetaItem}>
                    <MaterialIcons name="store" size={12} color={colors.gray[500]} />
                    <Text style={styles.transportCardMetaText}>{card.where_to_buy}</Text>
                  </View>
                  <View style={styles.transportCardMetaItem}>
                    <MaterialIcons name="schedule" size={12} color={colors.gray[500]} />
                    <Text style={styles.transportCardMetaText}>Validade: {card.validity}</Text>
                  </View>
                </View>
                {card.tip && (
                  <View style={styles.transportCardTip}>
                    <MaterialIcons name="lightbulb" size={12} color="#C49A6C" />
                    <Text style={styles.transportCardTipText}>{card.tip}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.primary },
  scrollContent: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.background.tertiary, alignItems: 'center', justifyContent: 'center' },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: typography.fontSize['2xl'], fontWeight: '800', color: colors.gray[900] },
  headerSubtitle: { fontSize: typography.fontSize.sm, color: colors.gray[500], marginTop: 2 },
  comboiosCta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginTop: 8, marginBottom: 8, padding: 16, backgroundColor: '#2563EB', borderRadius: borders.radius.xl, ...shadows.md },
  comboiosCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  comboiosCtaIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  comboiosCtaText: { flex: 1 },
  comboiosCtaTitle: { fontSize: typography.fontSize.lg, fontWeight: '800', color: '#FFF' },
  comboiosCtaSubtitle: { fontSize: typography.fontSize.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  filtersScroll: { marginTop: 4 },
  filtersContent: { paddingHorizontal: 20, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.background.tertiary, gap: 6 },
  filterChipActive: { backgroundColor: colors.terracotta[500] },
  filterChipText: { fontSize: typography.fontSize.sm, fontWeight: '600', color: colors.gray[600] },
  filterChipTextActive: { color: '#FFF' },
  statsBar: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginTop: 16, padding: 16, backgroundColor: '#FFF', borderRadius: borders.radius.xl, ...shadows.sm },
  statItem: { alignItems: 'center', gap: 4 },
  statIconCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  statCount: { fontSize: typography.fontSize.lg, fontWeight: '800', color: colors.gray[800] },
  statLabel: { fontSize: 10, color: colors.gray[500], fontWeight: '600' },
  operatorsList: { paddingHorizontal: 20, marginTop: 16, gap: 12 },
  operatorCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, ...shadows.sm },
  operatorHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  operatorIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  operatorHeaderText: { flex: 1 },
  operatorName: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  operatorTypeBadge: { marginTop: 2 },
  operatorTypeText: { fontSize: 11, fontWeight: '600' },
  operatorRegionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  operatorRegion: { fontSize: 11, color: colors.gray[500], fontWeight: '500' },
  operatorZone: { fontSize: typography.fontSize.sm, color: colors.gray[600], marginTop: 8, lineHeight: 18 },
  operatorFooter: { marginTop: 10 },
  operatorBuyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.forest[50], paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  operatorBuyText: { fontSize: 11, color: colors.forest[700], fontWeight: '500', flex: 1 },
  operatorTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 10 },
  operatorTipText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
  cardsSection: { paddingHorizontal: 20, marginTop: 24 },
  cardsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardsSectionTitle: { fontSize: typography.fontSize.xl, fontWeight: '800', color: colors.gray[900] },
  cardsSectionSubtitle: { fontSize: typography.fontSize.sm, color: colors.gray[500], marginTop: 4, marginBottom: 16 },
  transportCard: { backgroundColor: '#FFF', borderRadius: borders.radius.xl, padding: 16, marginBottom: 12, ...shadows.sm },
  transportCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  transportCardIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.terracotta[500], alignItems: 'center', justifyContent: 'center' },
  transportCardName: { fontSize: typography.fontSize.md, fontWeight: '700', color: colors.gray[800] },
  transportCardCity: { fontSize: 11, color: colors.gray[500], marginTop: 1 },
  transportCardPrice: { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  transportCardPriceText: { fontSize: 11, fontWeight: '700', color: '#059669' },
  transportCardMeta: { marginTop: 10, gap: 6 },
  transportCardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  transportCardMetaText: { fontSize: 11, color: colors.gray[600], flex: 1 },
  transportCardTip: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 10 },
  transportCardTipText: { flex: 1, fontSize: 11, color: '#92400E', lineHeight: 16 },
});
