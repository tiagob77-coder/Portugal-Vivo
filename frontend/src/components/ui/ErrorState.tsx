/**
 * ErrorState — Unified error display with retry action.
 *
 * Usage:
 *   <ErrorState message="Falha ao carregar dados" onRetry={() => refetch()} />
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getModuleTheme } from '../../theme/colors';
import { typography, spacing, borders } from '../../theme';

interface ErrorStateProps {
  message?: string;
  module?: string;
  onRetry?: () => void;
}

export default function ErrorState({
  message = 'Ocorreu um erro. Tente novamente.',
  module,
  onRetry,
}: ErrorStateProps) {
  const theme = getModuleTheme(module || '');

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: 'rgba(196, 69, 54, 0.12)' }]}>
        <MaterialIcons name="error-outline" size={36} color="#C44536" />
      </View>
      <Text style={[styles.message, { color: theme.textPrimary }]}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent }]}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <MaterialIcons name="refresh" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>Tentar novamente</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing[8],
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  message: {
    fontSize: typography.fontSize.base,
    textAlign: 'center',
    lineHeight: typography.fontSize.base * typography.lineHeight.normal,
    marginBottom: spacing[4],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[5],
    borderRadius: borders.radius.lg,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
  },
});
