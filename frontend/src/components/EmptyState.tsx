import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// --- Theme Colors ---
const COLORS = {
  background: '#0F172A',
  card: '#1E293B',
  accent: '#C49A6C',
  text: '#FAF8F3',
  textSecondary: '#C8C3B8',
  muted: '#64748B',
};

// --- Types ---

type VariantKey =
  | 'no-results'
  | 'no-favorites'
  | 'no-visits'
  | 'no-routes'
  | 'no-events'
  | 'no-connection'
  | 'empty-category'
  | 'loading-error';

interface ActionItem {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

interface IllustrationIcon {
  name: string;
  size: number;
  color: string;
  offsetX?: number;
  offsetY?: number;
  opacity?: number;
  rotate?: string;
}

interface EmptyStateProps {
  /** Main icon name (MaterialIcons). Overridden by variant if set. */
  icon?: string;
  /** Title text. Overridden by variant if set. */
  title?: string;
  /** Subtitle text. Overridden by variant if set. */
  subtitle?: string;
  /** Single action label (legacy prop, backward-compatible). */
  actionLabel?: string;
  /** Single action callback (legacy prop, backward-compatible). */
  onAction?: () => void;
  /** Icon tint color. */
  iconColor?: string;
  /** Preset variant that auto-fills icon, title, and subtitle. */
  variant?: VariantKey;
  /** Show a themed multi-icon illustration above the main icon. */
  illustration?: boolean;
  /** Multiple action buttons. Takes precedence over actionLabel/onAction. */
  actions?: ActionItem[];
  /** Compact mode for inline empty states. */
  compact?: boolean;
}

// --- Variant Presets ---

interface VariantPreset {
  icon: string;
  title: string;
  subtitle: string;
  illustrationIcons: IllustrationIcon[];
}

const VARIANT_PRESETS: Record<VariantKey, VariantPreset> = {
  'no-results': {
    icon: 'search',
    title: 'Sem resultados',
    subtitle: 'Tente outro termo ou ajuste os filtros',
    illustrationIcons: [
      { name: 'search', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'filter-list', size: 18, color: COLORS.muted, offsetX: 30, offsetY: -18, opacity: 0.25 },
      { name: 'tune', size: 16, color: COLORS.muted, offsetX: -28, offsetY: 14, opacity: 0.2 },
    ],
  },
  'no-favorites': {
    icon: 'favorite-border',
    title: 'Sem favoritos ainda',
    subtitle: 'Explore locais e adicione aos seus favoritos',
    illustrationIcons: [
      { name: 'favorite-border', size: 30, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'star-border', size: 16, color: COLORS.muted, offsetX: -26, offsetY: -16, opacity: 0.2 },
      { name: 'bookmark-border', size: 18, color: COLORS.muted, offsetX: 28, offsetY: 10, opacity: 0.25 },
    ],
  },
  'no-visits': {
    icon: 'explore',
    title: 'Nenhuma visita registada',
    subtitle: 'Visite um local para começar a ganhar pontos',
    illustrationIcons: [
      { name: 'explore', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'place', size: 18, color: COLORS.muted, offsetX: 26, offsetY: -14, opacity: 0.25 },
      { name: 'emoji-events', size: 16, color: COLORS.muted, offsetX: -24, offsetY: 12, opacity: 0.2 },
    ],
  },
  'no-routes': {
    icon: 'route',
    title: 'Sem rotas guardadas',
    subtitle: 'Gere uma rota inteligente para começar',
    illustrationIcons: [
      { name: 'route', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'directions', size: 18, color: COLORS.muted, offsetX: -28, offsetY: -10, opacity: 0.25 },
      { name: 'map', size: 16, color: COLORS.muted, offsetX: 26, offsetY: 14, opacity: 0.2 },
    ],
  },
  'no-events': {
    icon: 'event',
    title: 'Sem eventos por perto',
    subtitle: 'Explore outras regiões ou datas',
    illustrationIcons: [
      { name: 'event', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'date-range', size: 18, color: COLORS.muted, offsetX: 28, offsetY: -12, opacity: 0.25 },
      { name: 'location-on', size: 16, color: COLORS.muted, offsetX: -26, offsetY: 10, opacity: 0.2 },
    ],
  },
  'no-connection': {
    icon: 'wifi-off',
    title: 'Sem ligação',
    subtitle: 'Verifique a sua ligação à internet',
    illustrationIcons: [
      { name: 'wifi-off', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'cloud-off', size: 18, color: COLORS.muted, offsetX: -26, offsetY: -14, opacity: 0.25 },
      { name: 'signal-wifi-off', size: 16, color: COLORS.muted, offsetX: 28, offsetY: 12, opacity: 0.2 },
    ],
  },
  'empty-category': {
    icon: 'category',
    title: 'Categoria vazia',
    subtitle: 'Esta categoria ainda não tem conteúdo',
    illustrationIcons: [
      { name: 'category', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'folder-open', size: 18, color: COLORS.muted, offsetX: 26, offsetY: -14, opacity: 0.25 },
      { name: 'inbox', size: 16, color: COLORS.muted, offsetX: -24, offsetY: 12, opacity: 0.2 },
    ],
  },
  'loading-error': {
    icon: 'error-outline',
    title: 'Erro ao carregar',
    subtitle: 'Algo correu mal. Tente novamente.',
    illustrationIcons: [
      { name: 'error-outline', size: 28, color: COLORS.accent, offsetX: 0, offsetY: 0, opacity: 0.35 },
      { name: 'refresh', size: 18, color: COLORS.muted, offsetX: 28, offsetY: -12, opacity: 0.25 },
      { name: 'warning-amber', size: 16, color: COLORS.muted, offsetX: -26, offsetY: 14, opacity: 0.2 },
    ],
  },
};

// --- Illustration Sub-component ---

function Illustration({ icons }: { icons: IllustrationIcon[] }) {
  return (
    <View style={styles.illustrationContainer}>
      {icons.map((ic, index) => (
        <View
          key={index}
          style={[
            styles.illustrationIcon,
            {
              transform: [
                { translateX: ic.offsetX ?? 0 },
                { translateY: ic.offsetY ?? 0 },
                { rotate: ic.rotate ?? '0deg' },
              ],
            },
          ]}
        >
          <MaterialIcons
            name={ic.name as any}
            size={ic.size}
            color={ic.color}
            style={{ opacity: ic.opacity ?? 0.3 }}
          />
        </View>
      ))}
    </View>
  );
}

// --- Main Component ---

export default function EmptyState({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  iconColor = COLORS.muted,
  variant,
  illustration,
  actions,
  compact,
}: EmptyStateProps) {
  // Resolve variant presets, with explicit props taking precedence
  const preset = variant ? VARIANT_PRESETS[variant] : null;
  const resolvedIcon = icon ?? preset?.icon ?? 'info-outline';
  const resolvedTitle = title ?? preset?.title ?? '';
  const resolvedSubtitle = subtitle ?? preset?.subtitle;
  const illustrationIcons = preset?.illustrationIcons;

  // Build actions list: explicit `actions` prop > legacy actionLabel/onAction
  const resolvedActions: ActionItem[] = actions
    ? actions
    : actionLabel && onAction
      ? [{ label: actionLabel, onPress: onAction, variant: 'primary' as const }]
      : [];

  // Fade-in animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const iconSize = compact ? 28 : 40;
  const circleSize = compact ? 56 : 80;

  return (
    <Animated.View
      style={[
        compact ? styles.containerCompact : styles.container,
        { opacity: fadeAnim },
      ]}
    >
      {/* Optional multi-icon illustration */}
      {illustration && illustrationIcons && !compact && (
        <Illustration icons={illustrationIcons} />
      )}

      {/* Main icon circle */}
      <View
        style={[
          styles.iconCircle,
          {
            width: circleSize,
            height: circleSize,
            borderRadius: circleSize / 2,
            backgroundColor: iconColor + '15',
            marginBottom: compact ? 4 : 8,
          },
        ]}
      >
        <MaterialIcons name={resolvedIcon as any} size={iconSize} color={iconColor} />
      </View>

      {/* Title */}
      {resolvedTitle !== '' && (
        <Text style={compact ? styles.titleCompact : styles.title}>
          {resolvedTitle}
        </Text>
      )}

      {/* Subtitle */}
      {resolvedSubtitle != null && (
        <Text style={compact ? styles.subtitleCompact : styles.subtitle}>
          {resolvedSubtitle}
        </Text>
      )}

      {/* Actions */}
      {resolvedActions.length > 0 && (
        <View style={compact ? styles.actionsRowCompact : styles.actionsRow}>
          {resolvedActions.map((action, index) => {
            const isPrimary = (action.variant ?? 'primary') === 'primary';
            return (
              <TouchableOpacity
                key={index}
                style={[
                  isPrimary ? styles.actionButtonPrimary : styles.actionButtonSecondary,
                  compact && styles.actionButtonCompact,
                ]}
                onPress={action.onPress}
                activeOpacity={0.8}
              >
                <Text
                  style={isPrimary ? styles.actionTextPrimary : styles.actionTextSecondary}
                >
                  {action.label}
                </Text>
                {isPrimary && (
                  <MaterialIcons name="arrow-forward" size={compact ? 14 : 16} color={COLORS.accent} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  // Layout
  container: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 32,
    gap: 10,
  },
  containerCompact: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 16,
    gap: 6,
  },

  // Illustration
  illustrationContainer: {
    width: 100,
    height: 60,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  illustrationIcon: {
    position: 'absolute',
  },

  // Icon circle
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Title
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  titleCompact: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },

  // Subtitle
  subtitle: {
    fontSize: 13,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 19,
  },
  subtitleCompact: {
    fontSize: 12,
    color: COLORS.muted,
    textAlign: 'center',
    lineHeight: 17,
  },

  // Actions
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 12,
    gap: 10,
  },
  actionsRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 8,
    gap: 8,
  },

  // Primary action button
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(196, 154, 108, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(196, 154, 108, 0.3)',
    gap: 8,
  },
  actionTextPrimary: {
    fontSize: 14,
    color: COLORS.accent,
    fontWeight: '600',
  },

  // Secondary action button
  actionButtonSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(100, 116, 139, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(100, 116, 139, 0.2)',
    gap: 8,
  },
  actionTextSecondary: {
    fontSize: 14,
    color: COLORS.muted,
    fontWeight: '600',
  },

  // Compact action overrides
  actionButtonCompact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
});
