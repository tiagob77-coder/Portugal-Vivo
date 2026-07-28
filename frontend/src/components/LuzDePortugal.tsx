/**
 * LuzDePortugal — película de luz natural sobre toda a app
 *
 * Renderizada uma única vez no layout raiz, por cima do conteúdo e por baixo
 * de qualquer modal. Não intercepta toques (`pointerEvents="none"`).
 *
 * Na web usa `mix-blend-mode: soft-light`, que preserva a legibilidade do texto
 * ao modular apenas a luminosidade. Em nativo não há blend modes disponíveis em
 * `View`, por isso usa-se opacidade bastante mais baixa (ver `opacityNative`)
 * para obter um efeito equivalente sem lavar o contraste.
 */
import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { luzDefinition, LUZ_GRADIENT_LOCATIONS } from '../theme/luz';

export function LuzDePortugal() {
  const { luzActive } = useTheme();

  if (luzActive === 'off') return null;

  const def = luzDefinition(luzActive);
  const opacity = Platform.OS === 'web' ? def.opacity : def.opacityNative;

  return (
    <LinearGradient
      colors={def.colors}
      locations={LUZ_GRADIENT_LOCATIONS[luzActive]}
      style={[
        StyleSheet.absoluteFillObject,
        { opacity },
        // `mixBlendMode` só existe no renderer web; em nativo é ignorado.
        Platform.OS === 'web' ? ({ mixBlendMode: 'soft-light' } as object) : null,
      ]}
      pointerEvents="none"
      // Decorativo — não deve ser anunciado por leitores de ecrã
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

export default LuzDePortugal;
