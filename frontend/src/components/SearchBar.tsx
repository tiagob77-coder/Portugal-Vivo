/**
 * Search Bar Component
 * Advanced search with suggestions, history, and grouped results
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, Platform, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { debounce } from 'lodash';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { API_URL } from '../config/api';
import { useTheme, typography, spacing, borders, shadows } from '../theme';

const HISTORY_KEY = 'search_history';
const MAX_HISTORY = 10;

interface Suggestion {
  type: 'item' | 'tag' | 'route' | 'category';
  id?: string;
  text: string;
  category?: string;
  region?: string;
}

interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  autoFocus?: boolean;
  initialQuery?: string;
}

const CATEGORY_ICONS: Record<string, string> = {
  piscinas: 'pool', termas: 'hot-tub', gastronomia: 'restaurant',
  festas: 'celebration', cascatas: 'terrain', aventura: 'hiking',
  percursos: 'route', aldeias: 'holiday-village', arqueologia: 'account-balance',
  arte: 'palette', religioso: 'church', lendas: 'auto-stories',
  saberes: 'school', moinhos: 'settings', baloicos: 'swing',
  areas_protegidas: 'park', rios: 'water', minerais: 'diamond',
};

export function SearchBar({ placeholder = 'Pesquisar património...', onSearch, autoFocus = false, initialQuery = '' }: SearchBarProps) {
  const router = useRouter();
  const { colors } = useTheme();
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Load history on mount
  useEffect(() => {
    AsyncStorage.getItem(HISTORY_KEY).then(raw => {
      if (raw) setHistory(JSON.parse(raw));
    });
  }, []);

  const fetchSuggestions = useCallback( // eslint-disable-line react-hooks/exhaustive-deps
    debounce(async (q: string) => {
      if (q.length < 2) { setSuggestions([]); return; }
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/search/suggestions?q=${encodeURIComponent(q)}&limit=8`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch { /* silent */ } finally { setIsLoading(false); }
    }, 300),
    []
  );

  useEffect(() => { fetchSuggestions(query); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveToHistory = async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const updated = [trimmed, ...history.filter(h => h !== trimmed)].slice(0, MAX_HISTORY);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const removeHistoryItem = async (term: string) => {
    const updated = history.filter(h => h !== term);
    setHistory(updated);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  };

  const clearHistory = async () => {
    setHistory([]);
    await AsyncStorage.removeItem(HISTORY_KEY);
  };

  const handleSearch = () => {
    Keyboard.dismiss();
    setIsFocused(false);
    if (query.trim()) {
      saveToHistory(query.trim());
      if (onSearch) { onSearch(query); }
      else { router.push(`/search?q=${encodeURIComponent(query)}`); }
    }
  };

  const handleSuggestionPress = (suggestion: Suggestion) => {
    setIsFocused(false);
    setQuery(suggestion.text);
    saveToHistory(suggestion.text);
    if (suggestion.type === 'item' && suggestion.id) {
      router.push(`/heritage/${suggestion.id}`);
    } else if (suggestion.type === 'route' && suggestion.id) {
      router.push(`/route/${suggestion.id}`);
    } else {
      if (onSearch) { onSearch(suggestion.text); }
      else { router.push(`/search?q=${encodeURIComponent(suggestion.text)}`); }
    }
  };

  const handleHistoryPress = (term: string) => {
    setQuery(term);
    setIsFocused(false);
    if (onSearch) { onSearch(term); }
    else { router.push(`/search?q=${encodeURIComponent(term)}`); }
  };

  const showDropdown = isFocused && (
    (query.length >= 2 && suggestions.length > 0) ||
    (query.length < 2 && history.length > 0)
  );

  // Group suggestions by type
  const grouped = suggestions.reduce<Record<string, Suggestion[]>>((acc, s) => {
    const label = s.type === 'item' ? 'POIs' : s.type === 'route' ? 'Rotas' : s.type === 'category' ? 'Categorias' : 'Tags';
    (acc[label] = acc[label] || []).push(s);
    return acc;
  }, {});

  return (
    <View style={styles.container} data-testid="search-bar">
      <View style={[styles.inputContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <MaterialIcons name="search" size={20} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: colors.textOnPrimary }]}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={(text) => { setQuery(text); setIsFocused(true); }}
          onFocus={() => setIsFocused(true)}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
          autoFocus={autoFocus}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }}>
            <MaterialIcons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {isLoading && <ActivityIndicator size="small" color={colors.accent} style={{ marginLeft: spacing[2] }} />}
      </View>

      {showDropdown && (
        <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
            {/* History (when query is empty) */}
            {query.length < 2 && history.length > 0 && (
              <>
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>Pesquisas Recentes</Text>
                  <TouchableOpacity onPress={clearHistory} data-testid="clear-history-btn">
                    <Text style={[styles.clearAllText, { color: colors.error }]}>Limpar tudo</Text>
                  </TouchableOpacity>
                </View>
                {history.map((term) => (
                  <View key={term} style={[styles.historyRow, { borderBottomColor: colors.borderLight }]}>
                    <TouchableOpacity style={styles.historyItem} onPress={() => handleHistoryPress(term)}>
                      <MaterialIcons name="history" size={18} color={colors.textMuted} />
                      <Text style={[styles.historyText, { color: colors.textPrimary }]} numberOfLines={1}>{term}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => removeHistoryItem(term)} style={styles.historyDelete}>
                      <MaterialIcons name="close" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}

            {/* Grouped suggestions (when typing) */}
            {query.length >= 2 && Object.entries(grouped).map(([label, items]) => (
              <View key={label}>
                <View style={styles.dropdownHeader}>
                  <Text style={[styles.dropdownLabel, { color: colors.textMuted }]}>{label} ({items.length})</Text>
                </View>
                {items.map((s, i) => (
                  <TouchableOpacity
                    key={`${s.type}-${s.text}-${i}`}
                    style={[styles.suggestionItem, { borderBottomColor: colors.borderLight }]}
                    onPress={() => handleSuggestionPress(s)}
                  >
                    <MaterialIcons
                      name={(s.type === 'tag' ? 'tag' : CATEGORY_ICONS[s.category || ''] || 'place') as any}
                      size={18}
                      color={colors.textMuted}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.suggestionTitle, { color: colors.textPrimary }]} numberOfLines={1}>{s.text}</Text>
                      {(s.category || s.region) && (
                        <Text style={[styles.suggestionMeta, { color: colors.textMuted }]}>
                          {[s.category, s.region].filter(Boolean).join(' · ')}
                        </Text>
                      )}
                    </View>
                    <MaterialIcons name="north-west" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative', zIndex: 100 },
  inputContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: borders.radius.lg, paddingHorizontal: spacing[3], height: 48,
    borderWidth: 1,
  },
  searchIcon: { marginRight: spacing[2] },
  input: { flex: 1, fontSize: typography.fontSize.base + 1 },
  dropdown: {
    position: 'absolute', top: 52, left: 0, right: 0,
    borderRadius: borders.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' } as any,
      default: { ...shadows.xl },
    }),
  },
  dropdownHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing[4] - 2, paddingTop: spacing[3] - 2, paddingBottom: spacing[1],
  },
  dropdownLabel: { fontSize: typography.fontSize.xs + 1, fontWeight: typography.fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
  clearAllText: { fontSize: typography.fontSize.sm, fontWeight: typography.fontWeight.semibold },
  historyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderBottomWidth: 1,
  },
  historyItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: spacing[3], gap: spacing[3] - 2 },
  historyText: { fontSize: typography.fontSize.base },
  historyDelete: { paddingHorizontal: spacing[4] - 2, paddingVertical: spacing[3] },
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center',
    padding: spacing[3], gap: spacing[3] - 2,
    borderBottomWidth: 1,
  },
  suggestionTitle: { fontSize: typography.fontSize.base, fontWeight: typography.fontWeight.medium },
  suggestionMeta: { fontSize: typography.fontSize.xs + 1, marginTop: 1, textTransform: 'capitalize' },
});

export default SearchBar;
