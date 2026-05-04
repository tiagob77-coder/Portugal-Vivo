/**
 * API Pública — Documentação para parceiros e municípios
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Platform } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE } from '../src/config/api';
import { useTheme } from '../src/context/ThemeContext';
import { palette, withOpacity } from '../src/theme/colors';

const BASE_URL = API_BASE.replace('/api', '');

const ENDPOINT_GROUPS = [
  {
    group: 'Património',
    color: palette.terracotta[500],
    icon: 'account-balance',
    endpoints: [
      { method: 'GET', path: '/api/heritage', desc: 'Listar POIs com filtros (região, categoria, limite)', auth: false },
      { method: 'GET', path: '/api/heritage/{id}', desc: 'Detalhe de um POI com narrativa e localização', auth: false },
      { method: 'GET', path: '/api/heritage/search', desc: 'Pesquisa full-text com filtros avançados', auth: false },
    ],
  },
  {
    group: 'Descoberta',
    color: palette.forest[500],
    icon: 'explore',
    endpoints: [
      { method: 'POST', path: '/api/discover/feed', desc: 'Feed personalizado (por perfil e localização)', auth: false },
      { method: 'GET', path: '/api/discover/trending', desc: 'POIs em tendência (últimos 7 dias)', auth: false },
      { method: 'GET', path: '/api/discover/surprise', desc: 'POI aleatório oculto (Surpreende-me)', auth: false },
    ],
  },
  {
    group: 'Eventos e Agenda',
    color: '#8B5CF6',
    icon: 'event',
    endpoints: [
      { method: 'GET', path: '/api/calendar/events', desc: 'Eventos culturais e festivais', auth: false },
      { method: 'GET', path: '/api/calendar/events/{id}', desc: 'Detalhe de um evento', auth: false },
    ],
  },
  {
    group: 'Gamificação',
    color: palette.terracotta[400],
    icon: 'military-tech',
    endpoints: [
      { method: 'GET', path: '/api/leaderboard/top', desc: 'Ranking de exploradores (por período e região)', auth: false },
      { method: 'GET', path: '/api/gamification/profile', desc: 'Perfil do utilizador autenticado', auth: true },
      { method: 'POST', path: '/api/gamification/checkin', desc: 'Check-in num POI (requer localização)', auth: true },
    ],
  },
  {
    group: 'Parceiros / Multi-tenant',
    color: palette.ocean[400],
    icon: 'business',
    endpoints: [
      { method: 'POST', path: '/api/partner/register', desc: 'Registar câmara ou museu', auth: false },
      { method: 'GET', path: '/api/partner/pois', desc: 'POIs do território do parceiro (com health scores)', auth: true },
      { method: 'POST', path: '/api/partner/drafts', desc: 'Submeter draft de conteúdo para aprovação', auth: true },
    ],
  },
  {
    group: 'Comunidade',
    color: '#EC4899',
    icon: 'groups',
    endpoints: [
      { method: 'POST', path: '/api/contributions', desc: 'Submeter micro-contribuição (horários, fotos, curiosidades)', auth: false },
      { method: 'GET', path: '/api/encounters', desc: 'Listar encontros com comunidades (artesãos, músicos…)', auth: false },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  GET: palette.mint[500],
  POST: palette.ocean[400],
  PATCH: palette.terracotta[400],
  DELETE: '#EF4444',
};

function makeStyles(C: Record<string, string>) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: C.bodyBg },
    header: {
      backgroundColor: C.headerBg, flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingBottom: 14, gap: 12,
    },
    backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: withOpacity(palette.white, 0.1), alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: palette.white },
    headerSub: { fontSize: 11, color: withOpacity(palette.white, 0.5), marginTop: 1 },
    docsBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.docsBtnBg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
    docsBtnText: { fontSize: 12, fontWeight: '700', color: C.docsBtnText },

    baseUrlCard: { margin: 16, backgroundColor: C.headerBg, borderRadius: 12, padding: 14 },
    baseUrlLabel: { fontSize: 9, fontWeight: '800', color: C.textSub, letterSpacing: 1.5, marginBottom: 6 },
    baseUrl: { fontSize: 14, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, color: C.baseUrlColor, fontWeight: '600', marginBottom: 6 },
    baseUrlNote: { fontSize: 11, color: C.textMuted, lineHeight: 16 },

    authNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginHorizontal: 16, marginBottom: 16, backgroundColor: C.authNoteBg, borderRadius: 10, padding: 12 },
    authNoteText: { flex: 1, fontSize: 12, color: C.authNoteText, lineHeight: 18 },

    group: { marginHorizontal: 16, marginBottom: 8, backgroundColor: C.card, borderRadius: 14, overflow: 'hidden', shadowColor: palette.black, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
    groupHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10 },
    groupIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    groupTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: C.groupTitle },
    groupCount: { fontSize: 11, color: C.textSub, marginRight: 4 },

    endpoints: { borderTopWidth: 1, borderTopColor: C.borderLight },
    endpoint: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.bodyBg },
    endpointTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    methodBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5 },
    methodText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    epPath: { flex: 1, fontSize: 12, fontFamily: Platform.OS === 'web' ? 'monospace' : undefined, color: C.epPath },
    authBadge: { width: 18, height: 18, borderRadius: 9, backgroundColor: C.authBadgeBg, alignItems: 'center', justifyContent: 'center' },
    epDesc: { fontSize: 12, color: C.textMuted, lineHeight: 17 },

    fullDocsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, margin: 16, backgroundColor: C.headerBg, borderRadius: 14, paddingVertical: 14 },
    fullDocsBtnText: { color: palette.white, fontWeight: '700', fontSize: 15 },
  });
}

export default function ApiDocsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  const C = {
    bodyBg:       palette.gray[50],
    headerBg:     palette.gray[800],
    card:         palette.white,
    docsBtnBg:    palette.forest[50],
    docsBtnText:  palette.forest[500],
    baseUrlColor: '#38BDF8',
    textSub:      palette.gray[400],
    textMuted:    palette.gray[500],
    authNoteBg:   '#EFF6FF',
    authNoteText: '#1E40AF',
    groupTitle:   palette.gray[800],
    borderLight:  palette.gray[100],
    epPath:       palette.gray[700],
    authBadgeBg:  palette.terracotta[100],
    success:      colors.success,
    error:        colors.error,
    warning:      colors.warning,
    info:         colors.info,
  };

  const s = makeStyles(C);

  const openDocs = () => {
    const url = `${BASE_URL}/redoc`;
    if (Platform.OS === 'web') { window.open(url, '_blank'); }
    else { Linking.openURL(url); }
  };

  return (
    <View style={s.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={palette.white} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>API Pública</Text>
          <Text style={s.headerSub}>Portugal Vivo · Para parceiros e municípios</Text>
        </View>
        <TouchableOpacity style={s.docsBtn} onPress={openDocs}>
          <MaterialIcons name="open-in-new" size={16} color={C.docsBtnText} />
          <Text style={s.docsBtnText}>Redoc</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {/* Base URL */}
        <View style={s.baseUrlCard}>
          <Text style={s.baseUrlLabel}>BASE URL</Text>
          <Text style={s.baseUrl} selectable>{BASE_URL}/api</Text>
          <Text style={s.baseUrlNote}>Formato JSON · Rate limit: 200 req/min · Autenticação via Bearer token</Text>
        </View>

        {/* Auth note */}
        <View style={s.authNote}>
          <MaterialIcons name="info" size={14} color={C.info} />
          <Text style={s.authNoteText}>
            Endpoints sem autenticação são públicos e gratuitos. Endpoints autenticados requerem token JWT obtido via <Text style={{ fontWeight: '700' }}>POST /api/auth/login</Text>.
          </Text>
        </View>

        {/* Endpoint groups */}
        {ENDPOINT_GROUPS.map((group) => (
          <View key={group.group} style={s.group}>
            <TouchableOpacity
              style={s.groupHeader}
              onPress={() => setExpanded(expanded === group.group ? null : group.group)}
            >
              <View style={[s.groupIcon, { backgroundColor: withOpacity(group.color, 0.12) }]}>
                <MaterialIcons name={group.icon as any} size={18} color={group.color} />
              </View>
              <Text style={s.groupTitle}>{group.group}</Text>
              <Text style={s.groupCount}>{group.endpoints.length} endpoints</Text>
              <MaterialIcons
                name={expanded === group.group ? 'expand-less' : 'expand-more'}
                size={20} color={C.textSub}
              />
            </TouchableOpacity>

            {expanded === group.group && (
              <View style={s.endpoints}>
                {group.endpoints.map((ep) => (
                  <View key={ep.path} style={s.endpoint}>
                    <View style={s.endpointTop}>
                      <View style={[s.methodBadge, { backgroundColor: withOpacity(METHOD_COLORS[ep.method], 0.12) }]}>
                        <Text style={[s.methodText, { color: METHOD_COLORS[ep.method] }]}>{ep.method}</Text>
                      </View>
                      <Text style={s.epPath} selectable numberOfLines={1}>{ep.path}</Text>
                      {ep.auth && (
                        <View style={s.authBadge}>
                          <MaterialIcons name="lock" size={10} color={C.warning} />
                        </View>
                      )}
                    </View>
                    <Text style={s.epDesc}>{ep.desc}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Full docs link */}
        <TouchableOpacity style={s.fullDocsBtn} onPress={openDocs}>
          <MaterialIcons name="description" size={20} color={palette.white} />
          <Text style={s.fullDocsBtnText}>Documentação Completa (Redoc)</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}
