/**
 * TimelineControls - Historical timeline navigation and playback.
 * Extracted from mapa.tsx to reduce component size.
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { palette } from '../../../src/theme';

export interface TimelineEpoch {
  id: string;
  name: string;
  year: number;
  color: string;
  period: string;
}

interface TimelineControlsProps {
  epochs: TimelineEpoch[];
  currentIndex: number;
  isPlaying: boolean;
  isLoading: boolean;
  itemCount: number;
  onIndexChange: (index: number) => void;
  onPlayToggle: () => void;
}

export default function TimelineControls({
  epochs,
  currentIndex,
  isPlaying,
  isLoading,
  itemCount,
  onIndexChange,
  onPlayToggle,
}: TimelineControlsProps) {
  const currentEpoch = epochs[currentIndex];

  return (
    <View style={styles.container}>
      {/* Epoch indicator */}
      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: currentEpoch?.color }]} />
        <View style={styles.headerInfo}>
          <Text style={styles.epochName}>{currentEpoch?.name}</Text>
          <Text style={styles.period}>{currentEpoch?.period}</Text>
        </View>
        <View style={styles.count}>
          {isLoading ? (
            <ActivityIndicator size="small" color={palette.terracotta[500]} />
          ) : (
            <Text style={styles.countText}>{itemCount} POIs</Text>
          )}
        </View>
      </View>

      {/* Timeline bar */}
      <View style={styles.bar}>
        {epochs.map((epoch, i) => (
          <TouchableOpacity
            key={epoch.id}
            style={[
              styles.segment,
              i <= currentIndex && { backgroundColor: epoch.color, opacity: 1 },
            ]}
            onPress={() => onIndexChange(i)}
          >
            <View
              style={[
                styles.node,
                i <= currentIndex
                  ? { backgroundColor: epoch.color, borderColor: '#FFF' }
                  : {},
              ]}
            >
              {i === currentIndex && (
                <View style={[styles.nodeInner, { backgroundColor: '#FFF' }]} />
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Labels */}
      <View style={styles.labels}>
        {epochs.map((epoch) => (
          <Text key={epoch.id} style={styles.labelText} numberOfLines={1}>
            {epoch.name.slice(0, 6)}
          </Text>
        ))}
      </View>

      {/* Play controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onIndexChange(0)}
        >
          <MaterialIcons name="skip-previous" size={20} color="#8A8A8A" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.playBtn, isPlaying && { backgroundColor: '#EF4444' }]}
          onPress={onPlayToggle}
        >
          <MaterialIcons
            name={isPlaying ? 'pause' : 'play-arrow'}
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => onIndexChange(epochs.length - 1)}
        >
          <MaterialIcons name="skip-next" size={20} color="#8A8A8A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  headerInfo: {
    flex: 1,
  },
  epochName: {
    color: '#E2DFD6',
    fontSize: 15,
    fontWeight: '700',
  },
  period: {
    color: '#8A8A8A',
    fontSize: 12,
  },
  count: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  countText: {
    color: palette.terracotta[500],
    fontSize: 13,
    fontWeight: '600',
  },
  bar: {
    flexDirection: 'row',
    height: 32,
    alignItems: 'center',
  },
  segment: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  node: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  nodeInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
    marginBottom: 12,
  },
  labelText: {
    color: '#64748B',
    fontSize: 9,
    textAlign: 'center',
    flex: 1,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  btn: {
    padding: 4,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.forest[600],
    justifyContent: 'center',
    alignItems: 'center',
  },
});
