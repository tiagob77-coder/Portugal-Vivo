import React, { useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export type DepthLevel = 'snackable' | 'historia' | 'enciclopedico';

interface DepthOption {
  id: DepthLevel;
  label: string;
  sublabel: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  readTime: string;
}

const DEPTH_OPTIONS: DepthOption[] = [
  {
    id: 'snackable',
    label: 'Snack',
    sublabel: '30–60s',
    icon: 'bolt',
    readTime: '1 min',
  },
  {
    id: 'historia',
    label: 'História',
    sublabel: '3–5 min',
    icon: 'menu-book',
    readTime: '4 min',
  },
  {
    id: 'enciclopedico',
    label: 'Enciclopédia',
    sublabel: '7–12 min',
    icon: 'school',
    readTime: '10 min',
  },
];

interface ContentDepthToggleProps {
  activeDepth: DepthLevel;
  onDepthChange: (depth: DepthLevel) => void;
  loading?: boolean;
  compact?: boolean;
}

export default function ContentDepthToggle({
  activeDepth,
  onDepthChange,
  loading = false,
  compact = false,
}: ContentDepthToggleProps) {
  const { colors } = useTheme();
  const scaleAnims = useRef<Record<DepthLevel, Animated.Value>>({
    snackable: new Animated.Value(1),
    historia: new Animated.Value(1),
    enciclopedico: new Animated.Value(1),
  }).current;

  const handleSelect = (depth: DepthLevel) => {
    if (depth === activeDepth || loading) return;
    // Animate selected tab
    Animated.sequence([
      Animated.timing(scaleAnims[depth], { toValue: 0.92, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[depth], { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    onDepthChange(depth);
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: colors.card || colors.surface }]}>
        {DEPTH_OPTIONS.map((opt) => {
          const isActive = opt.id === activeDepth;
          return (
            <TouchableOpacity
              key={opt.id}
              onPress={() => handleSelect(opt.id)}
              accessibilityLabel={`${opt.label} — ${opt.sublabel}`}
              accessibilityState={{ selected: isActive }}
              style={[
                styles.compactTab,
                isActive && { backgroundColor: colors.primary || '#4A6741' },
              ]}
            >
              <Text style={[
                styles.compactLabel,
                { color: isActive ? '#fff' : (colors.textSecondary || '#888') },
              ]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, { color: colors.textSecondary || '#888' }]}>
        Profundidade do conteúdo
      </Text>
      <View style={[styles.track, { backgroundColor: colors.card || colors.surface }]}>
        {DEPTH_OPTIONS.map((opt) => {
          const isActive = opt.id === activeDepth;
          const accentColor = colors.primary || '#4A6741';

          return (
            <Animated.View
              key={opt.id}
              style={[styles.tabWrapper, { transform: [{ scale: scaleAnims[opt.id] }] }]}
            >
              <TouchableOpacity
                onPress={() => handleSelect(opt.id)}
                accessibilityLabel={`${opt.label} — ${opt.sublabel}`}
                accessibilityState={{ selected: isActive }}
                style={[
                  styles.tab,
                  isActive && {
                    backgroundColor: accentColor,
                    shadowColor: accentColor,
                    shadowOpacity: 0.3,
                    shadowOffset: { width: 0, height: 2 },
                    shadowRadius: 6,
                    elevation: 3,
                  },
                ]}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={18}
                  color={isActive ? '#fff' : (colors.textSecondary || '#888')}
                />
                <Text style={[
                  styles.tabLabel,
                  { color: isActive ? '#fff' : (colors.text || '#111') },
                  isActive && styles.tabLabelActive,
                ]}>
                  {opt.label}
                </Text>
                <Text style={[
                  styles.tabSublabel,
                  { color: isActive ? 'rgba(255,255,255,0.75)' : (colors.textSecondary || '#888') },
                ]}>
                  {opt.sublabel}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
      {loading && (
        <Text style={[styles.loadingHint, { color: colors.textSecondary || '#888' }]}>
          A gerar conteúdo…
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  track: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  tabWrapper: {
    flex: 1,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    gap: 3,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  tabSublabel: {
    fontSize: 10,
  },
  loadingHint: {
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 6,
  },
  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    alignSelf: 'flex-start',
  },
  compactTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 17,
  },
  compactLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
});
