/**
 * OptimizedImage — Drop-in replacement for RN Image using expo-image.
 * Provides: disk/memory caching, blurhash placeholders, transition animations,
 * and lazy loading via recyclingKey.
 */
import React from 'react';
import { Image, ImageStyle, ImageContentFit } from 'expo-image';
import { StyleProp, View } from 'react-native';

// Low-contrast neutral blurhash used as placeholder while loading
const DEFAULT_BLURHASH = 'L6PZfSi_.AyE_3t7t7R**0o#DgR4';

// Fallback 1px transparent data URI keeps layout intact when uri is absent.
const FALLBACK_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="%23e5e7eb"/></svg>'
  );

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
  const source = uri && uri.trim() ? uri : FALLBACK_URI;

  return (
    <View style={style as any} accessible accessibilityLabel={accessibilityLabel}>
      <Image
        source={{ uri: source }}
        style={{ width: '100%', height: '100%' }}
        contentFit={contentFit}
        placeholder={{ blurhash }}
        transition={transitionMs}
        cachePolicy="memory-disk"
        recyclingKey={source}
      />
    </View>
  );
}
