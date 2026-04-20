/**
 * Base Card component - consistent surface with shadow and border.
 * Supports theme-aware light/dark mode.
 */
import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { useTheme , borders, shadows, spacing } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: keyof typeof spacing;
  style?: ViewStyle;
}

export default function Card({ children, variant = 'default', padding = 4, style }: CardProps) {
  const { colors } = useTheme();

  const variantStyles: Record<string, ViewStyle> = {
    default: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
      ...shadows.sm,
    },
    elevated: {
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.md,
    },
    outlined: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
  };

  return (
    <View
      style={[
        styles.base,
        { padding: spacing[padding] },
        variantStyles[variant],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borders.radius.xl,
    overflow: 'hidden',
  },
});
