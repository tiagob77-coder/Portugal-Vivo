/**
 * Social Share Card - Beautiful share cards for POIs and routes
 * Shows a preview card with image, title, category badge, and share actions
 */
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Share, Platform,
  ImageBackground, Modal, Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { palette } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const _CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 380);

interface SocialShareCardProps {
  type: 'poi' | 'route';
  id: string;
  title: string;
  description: string;
  category?: string;
  categoryColor?: string;
  region?: string;
  imageUrl?: string;
  stats?: { label: string; value: string }[];
}

const SHARE_TARGETS = [
  { id: 'copy', label: 'Copiar Link', icon: 'content-copy' as const, color: '#64748B' },
  { id: 'whatsapp', label: 'WhatsApp', icon: 'chat' as const, color: '#25D366' },
  { id: 'twitter', label: 'X / Twitter', icon: 'public' as const, color: '#1DA1F2' },
  { id: 'facebook', label: 'Facebook', icon: 'facebook' as const, color: '#1877F2' },
];

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export default function SocialShareCard({
  type, id, title, description, category, categoryColor, region, imageUrl, stats,
}: SocialShareCardProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${BASE_URL}/api/share/${type === 'poi' ? 'poi' : 'route'}/${id}`;
  const shortDesc = description.length > 120 ? description.slice(0, 117) + '...' : description;

  const handleShare = async (targetId: string) => {
    const message = `${title}\n${shortDesc}\n\n${shareUrl}`;

    if (targetId === 'copy') {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        try {
          await navigator.clipboard.writeText(shareUrl);
        } catch (_e) {
          // Fallback
          const textarea = document.createElement('textarea');
          textarea.value = shareUrl;
          textarea.style.position = 'fixed';
          textarea.style.opacity = '0';
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      return;
    }

    if (Platform.OS === 'web') {
      // Web Share API
      if (navigator.share) {
        try {
          await navigator.share({ title, text: shortDesc, url: shareUrl });
          setModalVisible(false);
          return;
        } catch (_e) { /* user cancelled */ }
      }
    }

    // Native share
    if (Platform.OS !== 'web') {
      await Share.share({ title, message });
      setModalVisible(false);
    }
  };

  const defaultImage = 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80';

  return (
    <>
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.7}
      >
        <MaterialIcons name="share" size={22} color={palette.gray[50]} />
        <Text style={styles.triggerText}>Partilhar</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Preview Card */}
            <View style={styles.cardPreview}>
              <ImageBackground
                source={{ uri: imageUrl || defaultImage }}
                style={styles.cardImage}
                imageStyle={styles.cardImageStyle}
              >
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.85)']}
                  style={styles.cardGradient}
                >
                  {category && (
                    <View style={[styles.categoryBadge, { backgroundColor: categoryColor || palette.forest[500] }]}>
                      <Text style={styles.categoryText}>{category}</Text>
                    </View>
                  )}
                  <Text style={styles.cardTitle} numberOfLines={2}>{title}</Text>
                  <Text style={styles.cardDescription} numberOfLines={2}>{shortDesc}</Text>
                  {region && (
                    <View style={styles.regionRow}>
                      <MaterialIcons name="place" size={14} color={palette.terracotta[500]} />
                      <Text style={styles.regionText}>{region}</Text>
                    </View>
                  )}
                  {stats && stats.length > 0 && (
                    <View style={styles.statsRow}>
                      {stats.map((stat, idx) => (
                        <View key={idx} style={styles.statItem}>
                          <Text style={styles.statValue}>{stat.value}</Text>
                          <Text style={styles.statLabel}>{stat.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </LinearGradient>
              </ImageBackground>
              <View style={styles.cardFooter}>
                <Text style={styles.footerBrand}>Portugal Vivo</Text>
                <MaterialIcons name="explore" size={16} color={palette.terracotta[500]} />
              </View>
            </View>

            {/* Share Actions */}
            <Text style={styles.shareLabel}>Partilhar via</Text>
            <View style={styles.shareTargets}>
              {SHARE_TARGETS.map((target) => (
                <TouchableOpacity
                  key={target.id}
                  style={styles.shareTarget}
                  onPress={() => handleShare(target.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.shareIcon, { backgroundColor: target.color + '20' }]}>
                    <MaterialIcons
                      name={copied && target.id === 'copy' ? 'check' : target.icon}
                      size={24}
                      color={target.color}
                    />
                  </View>
                  <Text style={styles.shareTargetLabel}>
                    {copied && target.id === 'copy' ? 'Copiado!' : target.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Close */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Fechar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  triggerText: {
    color: palette.gray[50],
    fontSize: 13,
    fontWeight: '600',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
  },
  cardPreview: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    marginBottom: 20,
  },
  cardImage: {
    width: '100%',
    height: 200,
  },
  cardImageStyle: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  cardGradient: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 16,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  categoryText: {
    color: palette.gray[50],
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: palette.gray[50],
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  cardDescription: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 18,
  },
  regionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  regionText: {
    color: palette.terracotta[500],
    fontSize: 12,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: palette.gray[50],
    fontSize: 14,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0F172A',
  },
  footerBrand: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
  },
  shareLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 12,
  },
  shareTargets: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  shareTarget: {
    alignItems: 'center',
    gap: 6,
  },
  shareIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTargetLabel: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '500',
  },
  closeButton: {
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#334155',
    borderRadius: 14,
  },
  closeButtonText: {
    color: palette.gray[50],
    fontSize: 15,
    fontWeight: '600',
  },
});
