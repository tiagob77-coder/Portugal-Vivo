import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { palette } from '../theme/colors';

const { width: _SCREEN_W, height: _SCREEN_H } = Dimensions.get('window');
const PARTICLE_COUNT = 18;
const COLORS = [palette.terracotta[500], '#22C55E', '#8B5CF6', '#EF4444', '#0EA5E9', '#F59E0B', '#EC4899'];

interface BadgeCelebrationProps {
  visible: boolean;
  badgeName: string;
  badgeIcon: string;
  badgeColor: string;
  pointsEarned: number;
  onDone: () => void;
}

export default function BadgeCelebration({ visible, badgeName, badgeIcon, badgeColor, pointsEarned, onDone }: BadgeCelebrationProps) {
  const iconScale = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const particles = useRef(
    Array.from({ length: PARTICLE_COUNT }).map(() => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(1),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    if (!visible) return;

    // Icon bounce
    Animated.sequence([
      Animated.spring(iconScale, { toValue: 1.2, friction: 3, tension: 80, useNativeDriver: true }),
      Animated.spring(iconScale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();

    // Text fade in
    Animated.timing(textOpacity, { toValue: 1, duration: 400, delay: 300, useNativeDriver: true }).start();

    // Particles burst
    particles.forEach((p, i) => {
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const distance = 80 + Math.random() * 60;
      Animated.parallel([
        Animated.timing(p.scale, { toValue: 1, duration: 100, delay: i * 20, useNativeDriver: true }),
        Animated.timing(p.x, { toValue: Math.cos(angle) * distance, duration: 600, delay: 100, useNativeDriver: true }),
        Animated.timing(p.y, { toValue: Math.sin(angle) * distance - 30, duration: 600, delay: 100, useNativeDriver: true }),
        Animated.timing(p.opacity, { toValue: 0, duration: 400, delay: 500, useNativeDriver: true }),
      ]).start();
    });

    const timer = setTimeout(() => {
      onDone();
      // Reset
      iconScale.setValue(0);
      textOpacity.setValue(0);
      particles.forEach(p => { p.x.setValue(0); p.y.setValue(0); p.opacity.setValue(1); p.scale.setValue(0); });
    }, 2400);

    return () => clearTimeout(timer);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={s.overlay}>
        <View style={s.container}>
          {/* Particles */}
          {particles.map((p, i) => (
            <Animated.View
              key={i}
              style={[
                s.particle,
                {
                  backgroundColor: COLORS[i % COLORS.length],
                  width: 8 + Math.random() * 6,
                  height: 8 + Math.random() * 6,
                  borderRadius: 6,
                  opacity: p.opacity,
                  transform: [{ translateX: p.x }, { translateY: p.y }, { scale: p.scale }],
                },
              ]}
            />
          ))}

          {/* Badge Icon */}
          <Animated.View style={[s.iconWrap, { backgroundColor: badgeColor + '25', transform: [{ scale: iconScale }] }]}>
            <MaterialIcons name={badgeIcon as any} size={56} color={badgeColor} />
          </Animated.View>

          {/* Text */}
          <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
            <Text style={s.title}>Badge Desbloqueado!</Text>
            <Text style={s.badgeName}>{badgeName}</Text>
            {pointsEarned > 0 && (
              <View style={s.pointsRow}>
                <MaterialIcons name="stars" size={18} color={palette.terracotta[500]} />
                <Text style={s.points}>+{pointsEarned} pontos</Text>
              </View>
            )}
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center' },
  container: { alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute' },
  iconWrap: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 24, fontWeight: '800', color: palette.gray[50], marginBottom: 6 },
  badgeName: { fontSize: 18, fontWeight: '600', color: palette.terracotta[500], marginBottom: 12 },
  pointsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  points: { fontSize: 16, fontWeight: '700', color: palette.terracotta[500] },
});
