/**
 * RouteShareButton - Save a route for sharing and display a modal
 * with share link, QR code placeholder, and share targets.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Share,
  Platform,
  Modal,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { API_BASE } from '../config/api';
import { palette, withOpacity } from '../theme';

interface POI {
  id: string;
  name: string;
  location: { lat: number; lng: number };
  category: string;
  order: number;
}

interface RouteMetrics {
  distance?: number;
  duration?: number;
}

interface RouteShareButtonProps {
  routeName: string;
  pois: POI[];
  filters?: Record<string, any>;
  metrics?: RouteMetrics;
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

export default function RouteShareButton({
  routeName,
  pois,
  filters,
  metrics,
}: RouteShareButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullShareUrl = shareUrl
    ? `${API_BASE.replace('/api', '')}${shareUrl}`
    : '';

  const handleSaveRoute = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/routes-shared/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_name: routeName,
          pois,
          filters: filters || {},
          metrics: metrics || {},
        }),
      });

      if (!response.ok) {
        throw new Error('Erro ao guardar rota');
      }

      const data = await response.json();
      setShareCode(data.share_code);
      setShareUrl(data.share_url);
      setModalVisible(true);
    } catch (_e) {
      setError('Nao foi possivel criar o link de partilha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!fullShareUrl) return;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      try {
        await navigator.clipboard.writeText(fullShareUrl);
        setCopied(true);
      } catch {
        const ok = copyToClipboardWeb(fullShareUrl);
        if (ok) setCopied(true);
      }
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!fullShareUrl) return;
    const message = encodeURIComponent(
      `Descobre esta rota em Portugal Vivo: ${routeName}\n\n${fullShareUrl}`
    );
    const url = `https://wa.me/?text=${message}`;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  const handleNativeShare = async () => {
    if (!fullShareUrl) return;

    const message = `Descobre esta rota em Portugal Vivo: ${routeName}\n\n${fullShareUrl}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: routeName,
          text: message,
          url: fullShareUrl,
        });
        setModalVisible(false);
        return;
      } catch {
        /* user cancelled */
      }
    }

    if (Platform.OS !== 'web') {
      await Share.share({ title: routeName, message });
      setModalVisible(false);
    }
  };

  const poiCount = pois.length;
  const distanceKm = metrics?.distance
    ? `${metrics.distance.toFixed(1)} km`
    : '--';
  const durationText = metrics?.duration
    ? `${Math.round(metrics.duration)} min`
    : '--';

  return (
    <>
      {/* Trigger Button */}
      <TouchableOpacity
        style={styles.triggerButton}
        onPress={handleSaveRoute}
        activeOpacity={0.7}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={palette.terracotta[500]} />
        ) : (
          <MaterialIcons name="share" size={20} color={palette.terracotta[500]} />
        )}
        <Text style={styles.triggerText}>Partilhar Rota</Text>
      </TouchableOpacity>

      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}

      {/* Share Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Partilhar Rota</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <MaterialIcons name="close" size={24} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Route Preview Card */}
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <MaterialIcons name="route" size={24} color={palette.terracotta[500]} />
                <Text style={styles.previewTitle} numberOfLines={2}>
                  {routeName}
                </Text>
              </View>
              <View style={styles.previewStats}>
                <View style={styles.statItem}>
                  <MaterialIcons name="place" size={16} color={palette.terracotta[500]} />
                  <Text style={styles.statValue}>{poiCount}</Text>
                  <Text style={styles.statLabel}>Pontos</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <MaterialIcons name="straighten" size={16} color={palette.terracotta[500]} />
                  <Text style={styles.statValue}>{distanceKm}</Text>
                  <Text style={styles.statLabel}>Distancia</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <MaterialIcons name="schedule" size={16} color={palette.terracotta[500]} />
                  <Text style={styles.statValue}>{durationText}</Text>
                  <Text style={styles.statLabel}>Duracao</Text>
                </View>
              </View>
            </View>

            {/* Share Link */}
            <View style={styles.linkContainer}>
              <View style={styles.linkBox}>
                <MaterialIcons name="link" size={18} color="#64748B" />
                <Text style={styles.linkText} numberOfLines={1}>
                  {fullShareUrl || '...'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.copyButton, copied && styles.copyButtonCopied]}
                onPress={handleCopyLink}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name={copied ? 'check' : 'content-copy'}
                  size={18}
                  color={copied ? '#22C55E' : '#FAF8F3'}
                />
              </TouchableOpacity>
            </View>

            {/* QR Code Placeholder */}
            <View style={styles.qrPlaceholder}>
              <MaterialIcons name="qr-code-2" size={32} color="#64748B" />
              <Text style={styles.qrText}>{shareCode || ''}</Text>
              <Text style={styles.qrSubtext}>QR Code</Text>
            </View>

            {/* Share Targets */}
            <Text style={styles.shareLabel}>Partilhar via</Text>
            <View style={styles.shareTargets}>
              <TouchableOpacity
                style={styles.shareTarget}
                onPress={handleCopyLink}
                activeOpacity={0.7}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#64748B20' }]}>
                  <MaterialIcons
                    name={copied ? 'check' : 'content-copy'}
                    size={24}
                    color={copied ? '#22C55E' : '#64748B'}
                  />
                </View>
                <Text style={styles.shareTargetLabel}>
                  {copied ? 'Copiado!' : 'Copiar Link'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareTarget}
                onPress={handleWhatsApp}
                activeOpacity={0.7}
              >
                <View style={[styles.shareIcon, { backgroundColor: '#25D36620' }]}>
                  <MaterialIcons name="chat" size={24} color="#25D366" />
                </View>
                <Text style={styles.shareTargetLabel}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareTarget}
                onPress={handleNativeShare}
                activeOpacity={0.7}
              >
                <View style={[styles.shareIcon, { backgroundColor: withOpacity(palette.terracotta[500], 0.13) }]}>
                  <MaterialIcons name="ios-share" size={24} color={palette.terracotta[500]} />
                </View>
                <Text style={styles.shareTargetLabel}>Partilhar</Text>
              </TouchableOpacity>
            </View>

            {/* Close Button */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
              activeOpacity={0.7}
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
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    gap: 8,
    borderWidth: 1,
    borderColor: withOpacity(palette.terracotta[500], 0.25),
  },
  triggerText: {
    color: palette.gray[50],
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
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
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: palette.gray[50],
    fontSize: 18,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  previewTitle: {
    color: palette.gray[50],
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  previewStats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
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
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#334155',
  },
  linkContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  linkBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  linkText: {
    color: '#CBD5E1',
    fontSize: 13,
    flex: 1,
  },
  copyButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: palette.terracotta[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonCopied: {
    backgroundColor: '#22C55E',
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#334155',
    borderStyle: 'dashed',
    minHeight: 120,
  },
  qrText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 8,
  },
  qrSubtext: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
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
