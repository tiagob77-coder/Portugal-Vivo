import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { palette, withOpacity } from '../theme/colors';

const ONBOARDING_KEY = 'onboarding_seen_v1';

const STEPS = [
  {
    icon: 'explore',
    titleKey: 'components.onboardingModal.discover.title',
    subtitleKey: 'components.onboardingModal.discover.subtitle',
    color: palette.terracotta[500],
  },
  {
    icon: 'route',
    titleKey: 'components.onboardingModal.routes.title',
    subtitleKey: 'components.onboardingModal.routes.subtitle',
    color: '#8B5CF6',
  },
  {
    icon: 'auto-awesome',
    titleKey: 'components.onboardingModal.poiOfDay.title',
    subtitleKey: 'components.onboardingModal.poiOfDay.subtitle',
    color: '#22C55E',
  },
];

interface OnboardingModalProps {
  onComplete?: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((val) => {
      if (!val) setVisible(true);
    });
  }, []);

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      slideAnim.setValue(30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, step]); // eslint-disable-line react-hooks/exhaustive-deps

  const animateStep = (nextStep: number) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setStep(nextStep);
    });
  };

  const dismiss = async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    setVisible(false);
    onComplete?.();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      animateStep(step + 1);
    } else {
      dismiss();
    }
  };

  if (!visible) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={dismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {/* Skip button */}
          <TouchableOpacity style={styles.skipButton} onPress={dismiss}>
            <Text style={styles.skipText}>{t('components.onboardingModal.skip')}</Text>
          </TouchableOpacity>

          <Animated.View
            style={[
              styles.content,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: withOpacity(current.color, 0.125) }]}>
              <MaterialIcons name={current.icon as any} size={48} color={current.color} />
            </View>

            {/* Text */}
            <Text style={styles.title}>{t(current.titleKey)}</Text>
            <Text style={styles.subtitle}>{t(current.subtitleKey)}</Text>
          </Animated.View>

          {/* Dots */}
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step && { backgroundColor: current.color, width: 24 },
                ]}
              />
            ))}
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: current.color }]}
            onPress={handleNext}
            activeOpacity={0.85}
          >
            <Text style={styles.buttonText}>
              {isLast ? t('components.onboardingModal.start') : t('components.onboardingModal.next')}
            </Text>
            <MaterialIcons
              name={isLast ? 'explore' : 'arrow-forward'}
              size={20}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: withOpacity(palette.terracotta[500], 0.2),
  },
  skipButton: {
    position: 'absolute',
    top: 16,
    right: 20,
    zIndex: 1,
  },
  skipText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  content: {
    alignItems: 'center',
    marginTop: 8,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: palette.gray[50],
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    paddingHorizontal: 8,
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 28,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.3)',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '700',
    color: palette.white,
  },
});
