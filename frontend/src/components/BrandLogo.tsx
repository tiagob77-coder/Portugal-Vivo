/**
 * BrandLogo — Portugal Vivo master logo.
 *
 * Use for splash overlays, about screens, empty states, and header brand marks.
 * For app icons / favicons use the static assets in assets/images directly.
 */
import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

export type BrandLogoVariant = 'full' | 'compact';

type Props = {
  /** Total height in px. Width is computed from the 2:3 master aspect (0.666…). */
  height?: number;
  /** `full` = 1024×1536 master. `compact` = same asset, just smaller height presets. */
  variant?: BrandLogoVariant;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  /** Accessibility label (default: "Portugal Vivo"). */
  accessibilityLabel?: string;
};

const ASPECT = 1024 / 1536; // width / height of master

// Static require so Metro bundles the asset.
const LOGO = require('../../assets/images/logo-portugal-vivo.png');

export function BrandLogo({
  height,
  variant = 'full',
  style,
  imageStyle,
  accessibilityLabel = 'Portugal Vivo',
}: Props) {
  const h = height ?? (variant === 'compact' ? 64 : 160);
  const w = Math.round(h * ASPECT);
  return (
    <View style={style} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Image
        source={LOGO}
        style={[{ width: w, height: h, resizeMode: 'contain' }, imageStyle]}
      />
    </View>
  );
}

export default BrandLogo;
