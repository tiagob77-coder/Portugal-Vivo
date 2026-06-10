/**
 * ResponsiveContainer — centra e limita a largura do conteúdo em ecrãs largos.
 *
 * Mobile-first: no telemóvel ocupa 100% da largura; em tablet/web centra o
 * conteúdo numa coluna com largura máxima, mantendo a app "phone-shaped" e
 * legível em vez de esticada de ponta a ponta.
 *
 * Usage:
 *   <ResponsiveContainer>
 *     <ScrollView>...</ScrollView>
 *   </ResponsiveContainer>
 *
 * Para ScrollViews, preferir aplicar `contentMaxWidth` no `contentContainerStyle`
 * com `alignSelf: 'center'` (evita cortar carrosséis horizontais).
 */
import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { CONTENT_MAX_WIDTH } from '../../theme/breakpoints';

interface ResponsiveContainerProps {
  children: React.ReactNode;
  /** Largura máxima da coluna (default: CONTENT_MAX_WIDTH). */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
  /** Estilo do wrapper exterior (background full-bleed, etc.). */
  outerStyle?: StyleProp<ViewStyle>;
}

export default function ResponsiveContainer({
  children,
  maxWidth = CONTENT_MAX_WIDTH,
  style,
  outerStyle,
}: ResponsiveContainerProps) {
  return (
    <View style={[styles.outer, outerStyle]}>
      <View style={[styles.inner, { maxWidth }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, alignItems: 'center' },
  inner: { flex: 1, width: '100%' },
});
