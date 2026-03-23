/**
 * PoiVideoPlayer — Player de vídeo curto para POIs
 *
 * Reproduz vídeos de apresentação do local (15–60s).
 * Autoplay mudo com loop; toque para activar som; botão fullscreen.
 *
 * Props:
 *   videoUrl  — URL do vídeo (mp4/webm)
 *   posterUrl — imagem de pré-visualização (opcional)
 *   onClose   — callback para fechar player
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View, StyleSheet, TouchableOpacity, Text,
  ActivityIndicator, Platform,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface PoiVideoPlayerProps {
  videoUrl: string;
  posterUrl?: string;
  onClose?: () => void;
  autoPlay?: boolean;
  compact?: boolean; // modo compacto (inline no POI detail) vs. expandido
}

export default function PoiVideoPlayer({
  videoUrl,
  posterUrl,
  onClose,
  autoPlay = true,
  compact = false,
}: PoiVideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus>({} as AVPlaybackStatus);
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const isPlaying = (status as any).isPlaying ?? false;
  const duration = (status as any).durationMillis ?? 0;
  const position = (status as any).positionMillis ?? 0;
  const progress = duration > 0 ? (position / duration) : 0;

  const handleStatusUpdate = useCallback((s: AVPlaybackStatus) => {
    setStatus(s);
    if ((s as any).isLoaded) setLoading(false);
  }, []);

  const toggleMute = useCallback(async () => {
    await videoRef.current?.setIsMutedAsync(!muted);
    setMuted(prev => !prev);
  }, [muted]);

  const togglePlay = useCallback(async () => {
    if (isPlaying) {
      await videoRef.current?.pauseAsync();
      setPaused(true);
    } else {
      await videoRef.current?.playAsync();
      setPaused(false);
    }
  }, [isPlaying]);

  const toggleFullscreen = useCallback(async () => {
    if (Platform.OS !== 'web') {
      await videoRef.current?.presentFullscreenPlayer();
    } else {
      setFullscreen(prev => !prev);
    }
  }, []);

  const containerStyle = compact
    ? [s.container, s.compact]
    : fullscreen
      ? [s.container, s.containerFullscreen]
      : [s.container, s.containerDefault];

  return (
    <View style={containerStyle}>
      <Video
        ref={videoRef}
        source={{ uri: videoUrl }}
        style={s.video}
        resizeMode={ResizeMode.COVER}
        shouldPlay={autoPlay}
        isLooping
        isMuted={muted}
        posterSource={posterUrl ? { uri: posterUrl } : undefined}
        usePoster={!!posterUrl}
        onPlaybackStatusUpdate={handleStatusUpdate}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color="#C49A6C" />
        </View>
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.6)']}
        style={s.gradient}
        pointerEvents="none"
      />

      {/* Barra de progresso */}
      <View style={s.progressBar}>
        <View style={[s.progressFill, { width: `${progress * 100}%` as any }]} />
      </View>

      {/* Controlos */}
      <View style={s.controls}>
        {/* Play/Pause */}
        <TouchableOpacity style={s.controlBtn} onPress={togglePlay}>
          <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={20} color="#fff" />
        </TouchableOpacity>

        {/* Mute */}
        <TouchableOpacity style={s.controlBtn} onPress={toggleMute}>
          <MaterialIcons name={muted ? 'volume-off' : 'volume-up'} size={18} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* Fullscreen */}
        <TouchableOpacity style={s.controlBtn} onPress={toggleFullscreen}>
          <MaterialIcons name={fullscreen ? 'fullscreen-exit' : 'fullscreen'} size={18} color="#fff" />
        </TouchableOpacity>

        {/* Fechar */}
        {onClose && (
          <TouchableOpacity style={s.controlBtn} onPress={onClose}>
            <MaterialIcons name="close" size={18} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Label "Vídeo" */}
      <View style={s.videoLabel}>
        <MaterialIcons name="play-circle" size={12} color="rgba(255,255,255,0.8)" />
        <Text style={s.videoLabelText}>Vídeo</Text>
      </View>
    </View>
  );
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { position: 'relative', backgroundColor: '#000', overflow: 'hidden' },
  containerDefault: { height: 220, borderRadius: 12 },
  containerFullscreen: { ...StyleSheet.absoluteFillObject, zIndex: 100, borderRadius: 0 },
  compact: { height: 160, borderRadius: 10 },

  video: { ...StyleSheet.absoluteFillObject },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    zIndex: 5,
  },

  gradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
  },

  progressBar: {
    position: 'absolute', bottom: 40, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: { height: 2, backgroundColor: '#C49A6C' },

  controls: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 10, paddingBottom: 8, gap: 6,
  },
  controlBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },

  videoLabel: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
  },
  videoLabelText: { color: 'rgba(255,255,255,0.8)', fontSize: 10, fontWeight: '600' },
});
