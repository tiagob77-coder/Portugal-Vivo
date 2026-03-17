/**
 * Badge/Chip component - category labels, region tags, status indicators.
 * Uses theme-aware colors and the unified color utilities.
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { typography, spacing, borders, withOpacity } from '../../theme';

interface BadgeProps {
  label: string;
  color?: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  variant?: 'filled' | 'soft' | 'outline';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export default function Badge({
  label,
  color,
  icon,
  variant = 'soft',
  size = 'sm',
  style,
}: BadgeProps) {
  const { colors } = useTheme();
  const badgeColor = color || colors.primary;

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    filled: { bg: badgeColor, text: '#FFFFFF' },
    soft: { bg: withOpacity(badgeColor, 0.12), text: badgeColor },
    outline: { bg: 'transparent', text: badgeColor, border: withOpacity(badgeColor, 0.3) },
  };

  const sizeStyles: Record<string, { py: number; px: number; fontSize: number; iconSize: number }> = {
    sm: { py: 3, px: spacing[2], fontSize: typography.fontSize.xs + 1, iconSize: 12 },
    md: { py: spacing[1], px: spacing[3], fontSize: typography.fontSize.sm, iconSize: 14 },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
        },
        style,
      ]}
    >
      {icon && (
        <MaterialIcons name={icon} size={s.iconSize} color={v.text} style={{ marginRight: 4 }} />
      )}
      <Text style={[styles.text, { fontSize: s.fontSize, color: v.text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borders.radius.md,
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
});
