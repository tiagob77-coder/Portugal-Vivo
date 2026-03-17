import React from 'react';
import { TouchableOpacity, Share, Platform, StyleSheet, ViewStyle, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface ShareButtonProps {
  title: string;
  description: string;
  url?: string;
  iconSize?: number;
  iconColor?: string;
  style?: ViewStyle;
}

const copyToClipboardWeb = (text: string): boolean => {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
};

export const ShareButton = ({ title, description, url, iconSize = 24, iconColor = '#FAF8F3', style }: ShareButtonProps) => {
  const [copied, setCopied] = React.useState(false);
  
  const handleShare = async () => {
    const shareUrl = url || (Platform.OS === 'web' ? window.location.href : '');
    const message = shareUrl ? `${description}\n\n${shareUrl}` : description;

    if (Platform.OS === 'web') {
      // Try Web Share API first (mobile browsers)
      if (navigator.share) {
        try {
          await navigator.share({ title, text: description, url: shareUrl });
          return;
        } catch { /* user cancelled or not supported, fallback to clipboard */ }
      }
      let success = false;
      try {
        await navigator.clipboard.writeText(message);
        success = true;
      } catch {
        success = copyToClipboardWeb(message);
      }
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } else {
      await Share.share({ title, message });
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, copied && styles.buttonCopied, style]}
      onPress={handleShare}
      data-testid="share-button"
      activeOpacity={0.7}
    >
      <MaterialIcons name={copied ? 'check' : 'share'} size={iconSize} color={copied ? '#22C55E' : iconColor} />
      {copied && (
        <View style={styles.tooltip} data-testid="share-copied-tooltip">
          <Text style={styles.tooltipText}>Link copiado!</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonCopied: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  tooltip: {
    position: 'absolute',
    bottom: -32,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  tooltipText: {
    color: '#22C55E',
    fontSize: 11,
    fontWeight: '600',
  },
});
