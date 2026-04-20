/**
 * ScreenWrapper — Unified screen container for all modules.
 *
 * Provides: SafeArea insets, background color (from module theme or default),
 * StatusBar styling, and consistent padding.
 *
 * Usage:
 *   <ScreenWrapper module="biodiversidade">
 *     <Text>Content here</Text>
 *   </ScreenWrapper>
 */
import React from 'react';
import { View, StatusBar, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getModuleTheme } from '../../theme/colors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  module?: string;
  padded?: boolean;
  edges?: ('top' | 'bottom')[];
}

export default function ScreenWrapper({
  children,
  module,
  padded = true,
  edges = ['top'],
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();
  const theme = getModuleTheme(module || '');
  const isDark = theme.bg.startsWith('#0') || theme.bg.startsWith('#1') || theme.bg.startsWith('#2');

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bg },
        edges.includes('top') && { paddingTop: insets.top },
        edges.includes('bottom') && { paddingBottom: insets.bottom },
        padded && styles.padded,
      ]}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.bg}
        translucent={Platform.OS === 'android'}
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: 20,
  },
});
