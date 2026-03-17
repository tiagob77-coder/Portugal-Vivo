import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

interface SkeletonCardProps {
  variant?: 'heritage' | 'discovery' | 'category' | 'compact';
  count?: number;
}

const ShimmerBar = ({ w, h, style }: { w: number | string; h: number; style?: any }) => {
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
    <View style={[{ width: w as any, height: h, borderRadius: 6, backgroundColor: '#1A3A2E', overflow: 'hidden' }, style]}>
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: 200, backgroundColor: '#264E4140', transform: [{ translateX }] }} />
    </View>
  );
};

const HeritageSkeleton = () => (
  <View style={sk.heritageCard}>
    <ShimmerBar w={100} h={120} style={{ borderRadius: 0 }} />
    <View style={sk.heritageContent}>
      <ShimmerBar w={80} h={14} />
      <ShimmerBar w="90%" h={16} style={{ marginTop: 8 }} />
      <ShimmerBar w="70%" h={12} style={{ marginTop: 6 }} />
      <ShimmerBar w={60} h={14} style={{ marginTop: 10 }} />
    </View>
  </View>
);

const DiscoverySkeleton = () => (
  <View style={sk.discoveryCard}>
    <ShimmerBar w="100%" h={100} style={{ borderRadius: 0 }} />
    <View style={{ padding: 10 }}>
      <ShimmerBar w="80%" h={14} />
      <ShimmerBar w="50%" h={12} style={{ marginTop: 6 }} />
    </View>
  </View>
);

const CategorySkeleton = () => (
  <View style={sk.categoryCard}>
    <ShimmerBar w="100%" h={160} style={{ borderRadius: 16 }} />
  </View>
);

const CompactSkeleton = () => (
  <View style={sk.compactCard}>
    <ShimmerBar w="100%" h={90} style={{ borderRadius: 0 }} />
    <View style={{ padding: 10 }}>
      <ShimmerBar w={24} h={24} style={{ borderRadius: 8 }} />
      <ShimmerBar w="80%" h={13} style={{ marginTop: 6 }} />
      <ShimmerBar w="50%" h={11} style={{ marginTop: 4 }} />
    </View>
  </View>
);

const VARIANTS = {
  heritage: HeritageSkeleton,
  discovery: DiscoverySkeleton,
  category: CategorySkeleton,
  compact: CompactSkeleton,
};

export default function SkeletonCard({ variant = 'heritage', count = 3 }: SkeletonCardProps) {
  const Component = VARIANTS[variant];
  return (
    <View data-testid="skeleton-loader">
      {Array.from({ length: count }).map((_, i) => (
        <Component key={i} />
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  heritageCard: {
    flexDirection: 'row',
    backgroundColor: '#264E41',
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A2F2A',
    overflow: 'hidden',
  },
  heritageContent: {
    flex: 1,
    padding: 12,
  },
  discoveryCard: {
    width: 160,
    backgroundColor: '#264E41',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2F2A',
  },
  categoryCard: {
    width: (width - 48) / 2,
    height: 160,
    marginBottom: 12,
  },
  compactCard: {
    width: 140,
    backgroundColor: '#264E41',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A2F2A',
  },
});
