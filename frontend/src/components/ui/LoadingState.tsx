/**
 * LoadingState — Unified loading indicator for all screens.
 *
 * Usage:
 *   <LoadingState message="A carregar..." module="biodiversidade" />
 */
import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { getModuleTheme } from '../../theme/colors';
import { typography, spacing } from '../../theme';

interface LoadingStateProps {
  message?: string;
  module?: string;
  size?: 'small' | 'large';
}

export default function LoadingState({
  message = 'A carregar...',
  module,
  size = 'large',
}: LoadingStateProps) {
  const theme = getModuleTheme(module || '');

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size={size} color={theme.accent} />
      {message ? (
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[6],
  },
  message: {
    marginTop: spacing[3],
    fontSize: typography.fontSize.base,
  },
});
