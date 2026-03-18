import React, { useRef } from 'react';
import { Animated, TouchableWithoutFeedback, StyleProp, ViewStyle } from 'react-native';

interface PressableScaleProps {
  children: React.ReactNode;
  onPress: () => void | Promise<void>;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'none';
  accessibilityHint?: string;
  accessibilityState?: object;
}

export default function PressableScale({
  children, onPress, style, scaleTo = 0.97, disabled,
  accessibilityLabel, accessibilityRole = 'button', accessibilityHint, accessibilityState,
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => {
    Animated.timing(scale, { toValue: scaleTo, duration: 100, useNativeDriver: true }).start();
  };

  const onPressOut = () => {
    Animated.timing(scale, { toValue: 1, duration: 100, useNativeDriver: true }).start();
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={disabled ? undefined : onPressIn}
      onPressOut={disabled ? undefined : onPressOut}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
