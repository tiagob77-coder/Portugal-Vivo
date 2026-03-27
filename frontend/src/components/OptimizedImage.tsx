/**
 * OptimizedImage — Drop-in replacement for RN Image using expo-image.
 * Provides: disk/memory caching, blurhash placeholders, transition animations,
 * and lazy loading via recyclingKey.
 */
import React from 'react';
import { Image, ImageStyle, ImageContentFit } from 'expo-image';
import { StyleProp } from 'react-native';

// Low-contrast neutral blurhash used as placeholder while loading
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

interface OptimizedImageProps {
  uri: string | undefined | null;
  style?: StyleProp<ImageStyle>;
  contentFit?: ImageContentFit;
  /** Optional blurhash string for a custom placeholder */
  blurhash?: string;
  /** Transition duration in ms (default 200) */
  transitionMs?: number;
  /** Accessibility label */
  accessibilityLabel?: string;
}

export default function OptimizedImage({
  uri,
  style,
  contentFit = 'cover',
  blurhash = DEFAULT_BLURHASH,
  transitionMs = 200,
  accessibilityLabel,
}: OptimizedImageProps) {
  if (!uri) return null;

  return (
    <Image
      source={{ uri }}
      style={style}
      contentFit={contentFit}
      placeholder={{ blurhash }}
      transition={transitionMs}
      cachePolicy="memory-disk"
      recyclingKey={uri}
      accessibilityLabel={accessibilityLabel}
    />
  );
}
