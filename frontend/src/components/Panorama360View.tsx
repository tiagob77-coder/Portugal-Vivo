/**
 * Panorama360View — Visualizador de fotos equirectangulares (360°)
 *
 * Usa WebView + pannellum.js (CDN) para renderizar panoramas imersivos.
 * Funciona em iOS, Android e Web (via WebView).
 *
 * Props:
 *   imageUrl  — URL da imagem equirectangular (360°)
 *   title     — título do local
 *   onClose   — callback para fechar
 */
import { palette } from '../theme/colors';
import React, { useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text, Modal,
  ActivityIndicator, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';

interface Panorama360Props {
  imageUrl: string;
  title?: string;
  onClose: () => void;
}

// ─── HTML com Pannellum.js ────────────────────────────────────────────────────

function buildPanoramaHTML(imageUrl: string, title: string, t: TFunction): string {
  const js = (key: string) => JSON.stringify(t(key));
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.css"/>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:100%; height:100%; background:#000; overflow:hidden; }
  #panorama { width:100%; height:100%; }
  .pnlm-hotspot-base { display:none !important; }
  .pnlm-about-msg { display:none !important; }
</style>
</head>
<body>
<div id="panorama"></div>
<script src="https://cdn.jsdelivr.net/npm/pannellum@2.5.6/build/pannellum.js"></script>
<script>
pannellum.viewer('panorama', {
  type: 'equirectangular',
  panorama: ${JSON.stringify(imageUrl)},
  autoLoad: true,
  autoRotate: -1,
  compass: true,
  showZoomCtrl: true,
  showFullscreenCtrl: false,
  mouseZoom: true,
  hfov: 100,
  minHfov: 40,
  maxHfov: 150,
  friction: 0.5,
  strings: {
    loadButtonLabel: ${js('widgets.panorama.loadButton')},
    loadingLabel: ${js('widgets.panorama.loadingShort')},
    bylineLabel: '',
    noPanoramaError: ${js('widgets.panorama.noPanorama')},
    fileAccessError: ${js('widgets.panorama.fileAccess')},
    malformedURLError: ${js('widgets.panorama.malformedUrl')},
    iOS8WebGLError: ${js('widgets.panorama.ios8WebGl')},
    genericWebGLError: ${js('widgets.panorama.genericWebGl')},
    textureSizeError: ${js('widgets.panorama.textureSize')},
    unknownError: ${js('widgets.panorama.unknown')},
  },
});
</script>
</body>
</html>`;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function Panorama360View({ imageUrl, title: titleProp, onClose }: Panorama360Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const title = titleProp ?? t('widgets.panorama.defaultTitle');
  const [loading, setLoading] = React.useState(true);

  const content = (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="close" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        <View style={s.badge}>
          <MaterialIcons name="360" size={16} color="#fff" />
          <Text style={s.badgeText}>360°</Text>
        </View>
      </View>

      {/* Panorama */}
      <View style={s.viewer}>
        {loading && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator color="#C49A6C" size="large" />
            <Text style={s.loadingText}>{t('widgets.panorama.loading')}</Text>
          </View>
        )}
        <WebView
          source={{ html: buildPanoramaHTML(imageUrl, title, t) }}
          style={s.webView}
          onLoadEnd={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          originWhitelist={['*']}
          mixedContentMode="always"
        />
      </View>

      {/* Instrução */}
      <View style={[s.hint, { paddingBottom: insets.bottom + 8 }]}>
        <MaterialIcons name="touch-app" size={14} color="rgba(255,255,255,0.6)" />
        <Text style={s.hintText}>{t('widgets.panorama.hint')}</Text>
      </View>
    </View>
  );

  // Em web, renderizar inline (sem Modal)
  if (Platform.OS === 'web') {
    return (
      <View style={[StyleSheet.absoluteFillObject, { zIndex: 1000, backgroundColor: palette.black }]}>
        {content}
      </View>
    );
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      {content}
    </Modal>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.black },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { flex: 1, color: palette.white, fontSize: 15, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(196,154,108,0.85)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: palette.white, fontSize: 11, fontWeight: '700' },
  viewer: { flex: 1, position: 'relative' },
  webView: { flex: 1, backgroundColor: palette.black },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.black,
    gap: 12,
    zIndex: 10,
  },
  loadingText: { color: 'rgba(255,255,255,0.7)', fontSize: 13 },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  hintText: { color: 'rgba(255,255,255,0.6)', fontSize: 11 },
});
