/**
 * BeachcamFeed — o visor de uma webcam, seja qual for o formato da fonte
 *
 * Câmaras abertas (municípios, portos, universidades) publicam de três formas,
 * e cada uma pede um tratamento diferente:
 *
 *   hls      — stream .m3u8. Vídeo ao vivo a sério. Na web precisa de hls.js
 *              porque só o Safari reproduz HLS nativamente; em nativo o
 *              expo-av trata disso.
 *   snapshot — endpoint JPEG recarregado de N em N segundos. É o formato mais
 *              comum entre câmaras abertas e o mais barato de servir.
 *   iframe   — página incorporável de um agregador. Menos controlo: a fonte
 *              decide o que mostra e se permite framing.
 *
 * Em qualquer falha mostra "Câmara temporariamente indisponível" por cima da
 * última imagem conhecida, em vez de um ecrã preto sem explicação.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import logger from '../utils/logger';
import { palette, withOpacity } from '../theme/colors';

export type BeachcamProvider = 'hls' | 'snapshot' | 'iframe';

export interface BeachcamFeedProps {
  provider?: BeachcamProvider | null;
  /** URL da fonte, qualquer que seja o formato */
  feedUrl?: string | null;
  /** Cadência de recarga para snapshots, em segundos */
  refreshSeconds?: number;
  /** Imagem de recurso enquanto carrega ou em falha */
  fallbackImage?: string | null;
  name: string;
}

// WebView só existe em builds nativos
let _WebView: React.ComponentType<Record<string, unknown>> | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _WebView = require('react-native-webview').WebView;
}

/** Acrescenta um parâmetro que muda, para o snapshot não vir da cache. */
function bustCache(url: string, tick: number): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}_t=${tick}`;
}

function Unavailable({ message }: { message: string }) {
  return (
    <View style={s.overlay} pointerEvents="none">
      <MaterialIcons name="videocam-off" size={34} color={palette.gray[400]} />
      <Text style={s.overlayText}>{message}</Text>
    </View>
  );
}

/** Vídeo HLS na web, via hls.js quando o browser não o suporta nativamente. */
function HlsWebPlayer({ url, onError }: { url: string; onError: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Safari reproduz HLS directamente — dispensa a biblioteca
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => onError());
      return;
    }

    let hls: { destroy: () => void } | null = null;
    let cancelled = false;

    // Carregado a pedido: só entra no bundle de quem abre uma câmara
    import('hls.js')
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) {
          onError();
          return;
        }
        const instance = new Hls({ lowLatencyMode: true });
        hls = instance;
        instance.loadSource(url);
        instance.attachMedia(video);
        instance.on(Hls.Events.ERROR, (_evt, data) => {
          // Só os erros fatais derrubam o visor; os outros o hls.js recupera
          if (data?.fatal) onError();
        });
        video.play().catch(() => {});
      })
      .catch((err) => {
        logger.warn('BeachcamFeed: falha a carregar hls.js', err);
        onError();
      });

    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [url, onError]);

  return React.createElement('video', {
    ref: videoRef,
    style: { width: '100%', height: '100%', objectFit: 'cover', background: palette.ocean[900] },
    autoPlay: true,
    muted: true,
    playsInline: true,
    controls: false,
  });
}

export function BeachcamFeed({
  provider,
  feedUrl,
  refreshSeconds = 30,
  fallbackImage,
  name,
}: BeachcamFeedProps) {
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  // Snapshots recarregam sozinhos; os outros formatos não precisam de relógio
  useEffect(() => {
    if (provider !== 'snapshot' || !feedUrl) return;
    const interval = setInterval(
      () => setTick(Date.now()),
      Math.max(5, refreshSeconds) * 1000,
    );
    return () => clearInterval(interval);
  }, [provider, feedUrl, refreshSeconds]);

  // Uma fonte nova merece nova oportunidade
  useEffect(() => setFailed(false), [feedUrl, provider]);

  if (!provider || !feedUrl) {
    return (
      <View style={s.stage}>
        {fallbackImage && (
          <Image source={{ uri: fallbackImage }} style={s.fill} contentFit="cover" />
        )}
        <Unavailable message="Câmara sem transmissão disponível" />
      </View>
    );
  }

  return (
    <View style={s.stage}>
      {provider === 'snapshot' && (
        <Image
          source={{ uri: bustCache(feedUrl, tick) }}
          style={s.fill}
          contentFit="cover"
          transition={200}
          onError={() => setFailed(true)}
          accessibilityLabel={`Imagem em direto de ${name}`}
        />
      )}

      {provider === 'hls' && Platform.OS === 'web' && !failed && (
        <HlsWebPlayer url={feedUrl} onError={() => setFailed(true)} />
      )}

      {provider === 'hls' && Platform.OS !== 'web' && !failed && (
        <NativeHlsPlayer url={feedUrl} onError={() => setFailed(true)} />
      )}

      {provider === 'iframe' && !failed && (
        Platform.OS === 'web' ? (
          React.createElement('iframe', {
            src: feedUrl,
            style: { width: '100%', height: '100%', border: 'none' },
            title: `Webcam ao vivo — ${name}`,
            allow: 'autoplay; fullscreen',
            loading: 'lazy',
          })
        ) : _WebView ? (
          <_WebView
            style={s.fill}
            source={{ uri: feedUrl }}
            javaScriptEnabled
            domStorageEnabled
            allowsFullscreenVideo
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={['*']}
            onError={() => setFailed(true)}
          />
        ) : null
      )}

      {/* Em falha, a última imagem conhecida dá contexto por baixo do aviso */}
      {failed && (
        <>
          {fallbackImage && (
            <Image source={{ uri: fallbackImage }} style={s.fill} contentFit="cover" />
          )}
          <Unavailable message="Câmara temporariamente indisponível" />
        </>
      )}
    </View>
  );
}

/** Vídeo HLS em nativo — o expo-av reproduz .m3u8 sem ajuda. */
function NativeHlsPlayer({ url, onError }: { url: string; onError: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Video, ResizeMode } = require('expo-av');
  return (
    <Video
      style={s.fill}
      source={{ uri: url }}
      resizeMode={ResizeMode.COVER}
      shouldPlay
      isMuted
      isLooping={false}
      useNativeControls={false}
      onError={onError}
    />
  );
}

const s = StyleSheet.create({
  stage: { flex: 1, backgroundColor: palette.ocean[900], position: 'relative' },
  fill: { ...StyleSheet.absoluteFillObject },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: withOpacity(palette.ocean[900], 0.72),
  },
  overlayText: { fontSize: 13.5, fontWeight: '600', color: palette.gray[300], textAlign: 'center' },
});

export default BeachcamFeed;
