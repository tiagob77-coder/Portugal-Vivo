/**
 * ScreenHeader — cabeçalho de ecrã uniforme.
 *
 * Centraliza o padrão repetido em dezenas de ecrãs: botão "voltar" opcional,
 * título editorial (serif) + subtítulo opcional, e um slot de ação à direita.
 * Lê sempre dos tokens do tema (theme-aware) e usa a família serif central.
 *
 * Usage:
 *   <ScreenHeader title="Saúde Editorial" subtitle="124 POIs" onBack={() => router.back()} />
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme, fontFamilies } from '../../theme';
import { HIT_SLOP } from '../../theme/spacing';

interface ScreenHeaderProps {
  /** Título principal (renderizado em serif). */
  title: string;
  /** Subtítulo opcional. */
  subtitle?: string;
  /** Se definido, mostra um botão "voltar" que chama este callback. */
  onBack?: () => void;
  /** Conteúdo opcional alinhado à direita (ações, badges). */
  right?: React.ReactNode;
  /** Override de estilo do contentor. */
  style?: StyleProp<ViewStyle>;
}

export default function ScreenHeader({ title, subtitle, onBack, right, style }: ScreenHeaderProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, style]}>
      {onBack ? (
        <TouchableOpacity
          onPress={onBack}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          style={styles.back}
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.titles}>
        <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  back: { padding: 2 },
  titles: { flex: 1 },
  title: { fontSize: 22, fontWeight: '800', fontFamily: fontFamilies.serif },
  subtitle: { fontSize: 13, marginTop: 2 },
});
