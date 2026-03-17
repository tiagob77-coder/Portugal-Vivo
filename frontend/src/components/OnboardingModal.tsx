import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { palette, withOpacity } from '../theme/colors';

const { width } = Dimensions.get('window');

const ONBOARDING_KEY = 'onboarding_seen_v1';

const STEPS = [
  {
    icon: 'explore',
    title: 'Descubra Portugal',
    subtitle: 'Mais de 6.300 locais únicos espalhados por 7 regiões e 43 categorias. De cascatas escondidas a tascas centenárias.',
    color: palette.terracotta[500],
  },
  {
    icon: 'route',
    title: 'Rotas Temáticas',
    subtitle: 'Percorra rotas curadas como "Aldeias Históricas do Centro" ou "Levadas da Madeira". Cada rota liga os melhores POIs por tema.',
    color: '#8B5CF6',
  },
  {
    icon: 'auto-awesome',
    title: 'POI do Dia',
    subtitle: 'Todos os dias um local diferente é destacado. Descubra tesouros que não encontra nos guias convencionais.',
    color: '#22C55E',
  },
];

interface OnboardingModalProps {
  onComplete?: () => void;
}

export default function OnboardingModal({ onComplete }: OnboardingModalProps) {
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
            <Text style={styles.skipText}>Saltar</Text>
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
            <Text style={styles.title}>{current.title}</Text>
            <Text style={styles.subtitle}>{current.subtitle}</Text>
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
              {isLast ? 'Começar a explorar' : 'Seguinte'}
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
    width: Math.min(width - 48, 400),
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
    color: '#FFFFFF',
  },
});
