import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../theme';

export interface MicroStory {
  poi_id: string;
  poi_name: string;
  category?: string;
  region?: string;
  story: string;
  hook?: string;
  seasonal_label?: string;
  has_audio?: boolean;
  emoji?: string;
}

interface MicroStoryCardProps {
  story: MicroStory;
  onPress?: () => void;
  onSave?: (poi_id: string) => void;
  onShare?: (story: MicroStory) => void;
  onAudioPlay?: (poi_id: string) => void;
  onQueroSaberMais?: (poi_id: string) => void;
  saved?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  castelos: '#8B4513',
  natureza: '#2E7D32',
  gastronomia: '#C65D3B',
  museus: '#5B5EA6',
  festas_romarias: '#E91E63',
  surf: '#0288D1',
  arqueologia_geologia: '#795548',
  default: '#4A6741',
};

export default function MicroStoryCard({
  story,
  onPress,
  onSave,
  onShare,
  onAudioPlay,
  onQueroSaberMais,
  saved = false,
}: MicroStoryCardProps) {
  const { colors } = useTheme();
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(saved);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const audioAnim = useRef(new Animated.Value(1)).current;

  const accentColor = CATEGORY_COLORS[story.category || 'default'] || CATEGORY_COLORS.default;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 30 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
  };

  const handleAudioPlay = () => {
    setIsAudioPlaying(!isAudioPlaying);
    if (!isAudioPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(audioAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(audioAnim, { toValue: 1.0, duration: 600, useNativeDriver: true }),
        ])
      ).start();
    } else {
      audioAnim.setValue(1);
    }
    onAudioPlay?.(story.poi_id);
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    onSave?.(story.poi_id);
  };

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        style={[styles.card, { backgroundColor: colors.surface, borderLeftColor: accentColor }]}
      >
        {/* Header row */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {story.emoji ? (
              <Text style={styles.emoji}>{story.emoji}</Text>
            ) : (
              <View style={[styles.categoryDot, { backgroundColor: accentColor }]} />
            )}
            <View style={styles.headerText}>
              <Text style={[styles.poiName, { color: colors.text }]} numberOfLines={1}>
                {story.poi_name}
              </Text>
              {story.region && (
                <Text style={[styles.region, { color: colors.textSecondary }]}>
                  {story.region}
                </Text>
              )}
            </View>
          </View>

          {story.seasonal_label && (
            <View style={[styles.seasonBadge, { backgroundColor: accentColor + '22' }]}>
              <Text style={[styles.seasonText, { color: accentColor }]}>
                {story.seasonal_label}
              </Text>
            </View>
          )}
        </View>

        {/* Story body */}
        {story.hook && (
          <Text style={[styles.hook, { color: accentColor }]}>{story.hook}</Text>
        )}
        <Text style={[styles.storyText, { color: colors.text }]}>
          {story.story}
        </Text>

        {/* Actions row */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.qsmButton, { backgroundColor: accentColor }]}
            onPress={() => onQueroSaberMais?.(story.poi_id)}
            accessibilityLabel="Quero saber mais"
          >
            <MaterialIcons name="arrow-forward" size={14} color="#fff" />
            <Text style={styles.qsmText}>Quero saber mais</Text>
          </TouchableOpacity>

          <View style={styles.iconActions}>
            {story.has_audio && (
              <TouchableOpacity onPress={handleAudioPlay} style={styles.iconBtn} accessibilityLabel="Ouvir história">
                <Animated.View style={{ transform: [{ scale: audioAnim }] }}>
                  <MaterialIcons
                    name={isAudioPlaying ? 'pause-circle-filled' : 'play-circle-filled'}
                    size={26}
                    color={isAudioPlaying ? accentColor : colors.textSecondary}
                  />
                </Animated.View>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleSave} style={styles.iconBtn} accessibilityLabel="Guardar">
              <MaterialIcons
                name={isSaved ? 'bookmark' : 'bookmark-border'}
                size={22}
                color={isSaved ? accentColor : colors.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onShare?.(story)} style={styles.iconBtn} accessibilityLabel="Partilhar">
              <MaterialIcons name="share" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 6,
  },
  card: {
    borderRadius: 12,
    borderLeftWidth: 4,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  emoji: {
    fontSize: 20,
    marginRight: 8,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
  },
  poiName: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  region: {
    fontSize: 11,
    marginTop: 1,
    opacity: 0.7,
  },
  seasonBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  seasonText: {
    fontSize: 10,
    fontWeight: '600',
  },
  hook: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '600',
    marginBottom: 6,
    opacity: 0.9,
  },
  storyText: {
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0.1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  qsmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  qsmText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  iconActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    padding: 4,
  },
});
