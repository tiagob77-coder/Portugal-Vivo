/**
 * PatternBackground — textura portuguesa subtil (azulejo / calçada) por trás
 * de conteúdo. Puramente decorativo: não interativo e oculto a leitores de ecrã.
 *
 * Renderiza um SVG self-tiling via expo-image (sem dependências nativas). Se o
 * SVG não renderizar numa plataforma, o fundo fica transparente — nunca crasha.
 * Usar sempre tom-sobre-tom (opacity baixa); evitar dentro de listas longas.
 *
 * Usage:
 *   <View>
 *     <PatternBackground pattern="azulejo" color={colors.secondary} opacity={0.05} />
 *     {/* conteúdo *\/}
 *   </View>
 */
import React from 'react';
import { StyleSheet, View, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { patternUri, PatternKind } from '../theme/patterns';

interface PatternBackgroundProps {
  /** Tipo de textura. */
  pattern?: PatternKind;
  /** Cor do traço (hex). Default: azul-azulejo. */
  color?: string;
  /** Opacidade global da textura (tom-sobre-tom). Default 0.05. */
  opacity?: number;
  /** Override de posicionamento (default: preenche o pai). */
  style?: StyleProp<ViewStyle>;
}

function PatternBackground({
  pattern = 'azulejo',
  color,
  opacity = 0.05,
  style,
}: PatternBackgroundProps) {
  const uri = patternUri(pattern, color);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, { opacity }, style]}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        // Sem transição/cache pesado — é uma textura leve e estática.
        cachePolicy="memory"
      />
    </View>
  );
}

export default React.memo(PatternBackground);
