import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme, withOpacity } from '../theme';

const { width } = Dimensions.get('window');

interface SkeletonCardProps {
  variant?: 'heritage' | 'discovery' | 'category' | 'compact';
  count?: number;
}

const ShimmerBar = ({ w, h, style, shimmerBg, shimmerHighlight }: { w: number | string; h: number; style?: any; shimmerBg: string; shimmerHighlight: string }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, { toValue: 1, duration: 1200, useNativeDriver: false })
    );
    loop.start();
    return () => loop.stop();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View style={[{ width: w as any, height: h, borderRadius: 6, backgroundColor: shimmerBg, overflow: 'hidden' }, style]}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 200, backgroundColor: shimmerHighlight, transform: [{ translateX }] }} />
    </View>
  );
};

function SkeletonContent({ variant, cardBg, borderColor, shimmerBg, shimmerHighlight }: { variant: string; cardBg: string; borderColor: string; shimmerBg: string; shimmerHighlight: string }) {
  if (variant === 'heritage') {
    return (
      <View style={[sk.heritageCard, { backgroundColor: cardBg, borderColor }]}>
        <ShimmerBar w={100} h={120} style={{ borderRadius: 0 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
        <View style={sk.heritageContent}>
          <ShimmerBar w={80} h={14} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
          <ShimmerBar w="90%" h={16} style={{ marginTop: 8 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
          <ShimmerBar w="70%" h={12} style={{ marginTop: 6 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
          <ShimmerBar w={60} h={14} style={{ marginTop: 10 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
        </View>
      </View>
    );
  }
  if (variant === 'discovery') {
    return (
      <View style={[sk.discoveryCard, { backgroundColor: cardBg, borderColor }]}>
        <ShimmerBar w="100%" h={100} style={{ borderRadius: 0 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
        <View style={{ padding: 10 }}>
          <ShimmerBar w="80%" h={14} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
          <ShimmerBar w="50%" h={12} style={{ marginTop: 6 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
        </View>
      </View>
    );
  }
  if (variant === 'category') {
    return (
      <View style={sk.categoryCard}>
        <ShimmerBar w="100%" h={160} style={{ borderRadius: 16 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
      </View>
    );
  }
  // compact
  return (
    <View style={[sk.compactCard, { backgroundColor: cardBg, borderColor }]}>
      <ShimmerBar w="100%" h={90} style={{ borderRadius: 0 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
      <View style={{ padding: 10 }}>
        <ShimmerBar w={24} h={24} style={{ borderRadius: 8 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
        <ShimmerBar w="80%" h={13} style={{ marginTop: 6 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
        <ShimmerBar w="50%" h={11} style={{ marginTop: 4 }} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
      </View>
    </View>
  );
}

export default function SkeletonCard({ variant = 'heritage', count = 3 }: SkeletonCardProps) {
  const { colors, isDark } = useTheme();
  const cardBg = isDark ? colors.surface : colors.surfaceAlt;
  const borderColor = colors.border;
  const shimmerBg = withOpacity(colors.primary, 0.15);
  const shimmerHighlight = withOpacity(colors.primary, 0.08);

  return (
    <View data-testid="skeleton-loader">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonContent key={i} variant={variant} cardBg={cardBg} borderColor={borderColor} shimmerBg={shimmerBg} shimmerHighlight={shimmerHighlight} />
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  heritageCard: {
    flexDirection: 'row',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  heritageContent: {
    flex: 1,
    padding: 12,
  },
  discoveryCard: {
    width: 160,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  categoryCard: {
    width: (width - 48) / 2,
    height: 160,
    marginBottom: 12,
  },
  compactCard: {
    width: 140,
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
});
