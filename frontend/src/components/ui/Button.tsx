/**
 * Base Button component with variants.
 * Uses theme-aware colors for light/dark mode.
 */
import React from 'react';
import { Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { typography, spacing, borders } from '../../theme';
import PressableScale from '../PressableScale';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors } = useTheme();

  const variantStyles: Record<string, { bg: string; text: string; border?: string }> = {
    primary: { bg: colors.primary, text: colors.textOnPrimary },
    secondary: { bg: colors.primaryMuted, text: colors.primary },
    ghost: { bg: 'transparent', text: colors.primary, border: colors.border },
    accent: { bg: colors.accent, text: colors.textOnPrimary },
  };

  const sizeStyles: Record<string, { py: number; px: number; fontSize: number; iconSize: number }> = {
    sm: { py: spacing[1], px: spacing[3], fontSize: typography.fontSize.sm, iconSize: 16 },
    md: { py: spacing[3], px: spacing[5], fontSize: typography.fontSize.base, iconSize: 18 },
    lg: { py: spacing[4], px: spacing[6], fontSize: typography.fontSize.md, iconSize: 20 },
  };

  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.base,
        {
          backgroundColor: disabled ? colors.textMuted : v.bg,
          paddingVertical: s.py,
          paddingHorizontal: s.px,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <MaterialIcons name={icon} size={s.iconSize} color={v.text} style={{ marginRight: spacing[2] }} />
          )}
          <Text style={[styles.text, { fontSize: s.fontSize, color: v.text }, textStyle]}>
            {title}
          </Text>
          {icon && iconPosition === 'right' && (
            <MaterialIcons name={icon} size={s.iconSize} color={v.text} style={{ marginLeft: spacing[2] }} />
          )}
        </>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borders.radius.lg,
  },
  text: {
    fontWeight: typography.fontWeight.semibold,
  },
});
