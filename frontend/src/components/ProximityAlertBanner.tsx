/**
 * ProximityAlertBanner - Floating toast for nearby POI alerts
 * Shows animated banner when geofencing detects a nearby POI
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, borders, shadows } from '../theme';
import { palette, stateColors, withOpacity } from '../theme';
import { ProximityAlert } from '../services/geofencing';

const { width: _width } = Dimensions.get('window');

interface Props {
  alerts: ProximityAlert[];
  onDismiss: () => void;
}

export default function ProximityAlertBanner({ alerts, onDismiss }: Props) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const dismissTimer = useRef<any>(null);

  const alert = alerts[currentIndex];

  useEffect(() => {
    if (alerts.length === 0) return;

    // Slide in
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 80,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after 8 seconds
    dismissTimer.current = setTimeout(() => {
      handleDismiss();
    }, 8000);

    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, [alerts, currentIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -120,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (currentIndex < alerts.length - 1) {
        setCurrentIndex(currentIndex + 1);
        slideAnim.setValue(-120);
        opacityAnim.setValue(0);
      } else {
        onDismiss();
      }
    });
  };

  if (!alert) return null;

  const isRare = alert.alert_type === 'rare';
  // Purple '#7C3AED' is a brand color for rare proximity alerts - kept as-is
  const bgColor = isRare ? '#7C3AED' : palette.forest[500];
  const iconName = isRare ? 'star' : 'place';

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      data-testid="proximity-alert-banner"
    >
      <TouchableOpacity
        style={[styles.banner, { backgroundColor: bgColor }]}
        activeOpacity={0.9}
        onPress={() => {
          if (dismissTimer.current) clearTimeout(dismissTimer.current);
          handleDismiss();
          router.push(`/heritage/${alert.poi_id}`);
        }}
        data-testid="proximity-alert-tap"
      >
        <View style={styles.iconContainer}>
          {/* Purple '#A78BFA' is a brand color for rare proximity alerts - kept as-is */}
          <View style={[styles.iconCircle, { backgroundColor: isRare ? '#A78BFA' : palette.forest[400] }]}>
            <MaterialIcons name={iconName} size={20} color={palette.white} />
          </View>
          {isRare && (
            <View style={styles.rareBadge}>
              <Text style={styles.rareBadgeText}>RARO</Text>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {alert.poi_name}
          </Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {alert.message}
          </Text>
          <View style={styles.meta}>
            <View style={styles.distanceBadge}>
              <MaterialIcons name="near-me" size={10} color={palette.white} />
              <Text style={styles.distanceText}>{alert.distance_m}m</Text>
            </View>
            {alert.iq_score && (
              <View style={[styles.iqBadge, { backgroundColor: isRare ? '#A78BFA' : palette.forest[400] }]}>
                <Text style={styles.iqText}>IQ {alert.iq_score.toFixed(0)}</Text>
              </View>
            )}
            {alerts.length > 1 && (
              <Text style={styles.countText}>
                {currentIndex + 1}/{alerts.length}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={(e) => {
            e.stopPropagation?.();
            if (dismissTimer.current) clearTimeout(dismissTimer.current);
            handleDismiss();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          data-testid="proximity-alert-close"
        >
          <MaterialIcons name="close" size={18} color={withOpacity(palette.white, 0.7)} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 12 : 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    ...(Platform.OS === 'web' ? {
      maxWidth: 480,
      marginHorizontal: 'auto',
    } as any : {}),
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borders.radius.xl,
    padding: spacing[3],
    ...shadows.xl,
  },
  iconContainer: {
    marginRight: spacing[3],
    alignItems: 'center',
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rareBadge: {
    backgroundColor: palette.terracotta[500],
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 3,
  },
  rareBadgeText: {
    color: palette.white,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  title: {
    color: palette.white,
    fontSize: typography.fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    color: withOpacity(palette.white, 0.85),
    fontSize: typography.fontSize.sm,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  distanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: withOpacity(palette.white, 0.2),
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  distanceText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '600',
  },
  iqBadge: {
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  iqText: {
    color: palette.white,
    fontSize: 10,
    fontWeight: '600',
  },
  countText: {
    color: withOpacity(palette.white, 0.6),
    fontSize: 10,
  },
  closeBtn: {
    padding: 4,
    marginLeft: spacing[2],
  },
});
