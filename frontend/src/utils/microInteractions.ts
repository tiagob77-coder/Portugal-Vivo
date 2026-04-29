/**
 * Portugal Vivo - Micro-interactions & Haptics
 * 
 * Provides haptic feedback and smooth animations for touch interactions.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  withSpring,
  withTiming,
  useSharedValue,
  useAnimatedStyle,
  Easing,
} from 'react-native-reanimated';

// ========================
// HAPTIC FEEDBACK
// ========================

/**
 * Light haptic feedback for minor interactions (tap, toggle)
 */
export async function hapticLight(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch (e) {
    // Haptics not available
  }
}

/**
 * Medium haptic feedback for selections and confirmations
 */
export async function hapticMedium(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch (e) {
    // Haptics not available
  }
}

/**
 * Heavy haptic feedback for important actions
 */
export async function hapticHeavy(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch (e) {
    // Haptics not available
  }
}

/**
 * Success haptic notification
 */
export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (e) {
    // Haptics not available
  }
}

/**
 * Error haptic notification
 */
export async function hapticError(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch (e) {
    // Haptics not available
  }
}

/**
 * Warning haptic notification
 */
export async function hapticWarning(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch (e) {
    // Haptics not available
  }
}

/**
 * Selection changed haptic
 */
export async function hapticSelection(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await Haptics.selectionAsync();
  } catch (e) {
    // Haptics not available
  }
}

// ========================
// ANIMATION PRESETS
// ========================

/**
 * Spring animation config for bouncy interactions
 */
export const springConfig = {
  damping: 15,
  stiffness: 150,
  mass: 1,
};

/**
 * Gentle spring for subtle movements
 */
export const gentleSpring = {
  damping: 20,
  stiffness: 100,
  mass: 0.8,
};

/**
 * Snappy spring for quick interactions
 */
export const snappySpring = {
  damping: 18,
  stiffness: 300,
  mass: 0.5,
};

/**
 * Timing config for smooth fades
 */
export const fadeConfig = {
  duration: 200,
  easing: Easing.inOut(Easing.ease),
};

/**
 * Timing config for slide animations
 */
export const slideConfig = {
  duration: 300,
  easing: Easing.bezier(0.25, 0.1, 0.25, 1),
};

// ========================
// ANIMATION HOOKS
// ========================

/**
 * Hook for press animation (scale down on press)
 */
export function usePressAnimation(scaleTo: number = 0.97) {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const onPressIn = () => {
    scale.value = withSpring(scaleTo, snappySpring);
    hapticLight();
  };
  
  const onPressOut = () => {
    scale.value = withSpring(1, snappySpring);
  };
  
  return { animatedStyle, onPressIn, onPressOut };
}

/**
 * Hook for fade animation
 */
export function useFadeAnimation(initialValue: number = 0) {
  const opacity = useSharedValue(initialValue);
  
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));
  
  const fadeIn = () => {
    opacity.value = withTiming(1, fadeConfig);
  };
  
  const fadeOut = () => {
    opacity.value = withTiming(0, fadeConfig);
  };
  
  return { animatedStyle, fadeIn, fadeOut, opacity };
}

/**
 * Hook for slide animation
 */
export function useSlideAnimation(direction: 'up' | 'down' | 'left' | 'right' = 'up', distance: number = 20) {
  const translateX = useSharedValue(direction === 'left' ? distance : direction === 'right' ? -distance : 0);
  const translateY = useSharedValue(direction === 'up' ? distance : direction === 'down' ? -distance : 0);
  const opacity = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));
  
  const slideIn = () => {
    translateX.value = withTiming(0, slideConfig);
    translateY.value = withTiming(0, slideConfig);
    opacity.value = withTiming(1, fadeConfig);
  };
  
  const slideOut = () => {
    translateX.value = withTiming(direction === 'left' ? distance : direction === 'right' ? -distance : 0, slideConfig);
    translateY.value = withTiming(direction === 'up' ? distance : direction === 'down' ? -distance : 0, slideConfig);
    opacity.value = withTiming(0, fadeConfig);
  };
  
  return { animatedStyle, slideIn, slideOut };
}

/**
 * Hook for pulse animation (attention-grabbing)
 */
export function usePulseAnimation() {
  const scale = useSharedValue(1);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  
  const pulse = () => {
    scale.value = withSpring(1.05, { damping: 5, stiffness: 200 });
    setTimeout(() => {
      scale.value = withSpring(1, gentleSpring);
    }, 100);
  };
  
  return { animatedStyle, pulse };
}

/**
 * Hook for shake animation (error feedback)
 */
export function useShakeAnimation() {
  const translateX = useSharedValue(0);
  
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  
  const shake = () => {
    hapticError();
    translateX.value = withSpring(-10, { damping: 5, stiffness: 400 });
    setTimeout(() => {
      translateX.value = withSpring(10, { damping: 5, stiffness: 400 });
      setTimeout(() => {
        translateX.value = withSpring(-5, { damping: 5, stiffness: 400 });
        setTimeout(() => {
          translateX.value = withSpring(0, gentleSpring);
        }, 50);
      }, 50);
    }, 50);
  };
  
  return { animatedStyle, shake };
}

// ========================
// INTERACTION PRESETS
// ========================

/**
 * Combined interaction for card press
 */
export async function onCardPress(): Promise<void> {
  await hapticLight();
}

/**
 * Combined interaction for button press
 */
export async function onButtonPress(): Promise<void> {
  await hapticMedium();
}

/**
 * Combined interaction for favorite toggle
 */
export async function onFavoriteToggle(isFavorite: boolean): Promise<void> {
  if (isFavorite) {
    await hapticSuccess();
  } else {
    await hapticLight();
  }
}

/**
 * Combined interaction for tab switch
 */
export async function onTabSwitch(): Promise<void> {
  await hapticSelection();
}

/**
 * Combined interaction for filter change
 */
export async function onFilterChange(): Promise<void> {
  await hapticSelection();
}

/**
 * Combined interaction for checkin
 */
export async function onCheckin(): Promise<void> {
  await hapticSuccess();
}

/**
 * Combined interaction for error
 */
export async function onError(): Promise<void> {
  await hapticError();
}
