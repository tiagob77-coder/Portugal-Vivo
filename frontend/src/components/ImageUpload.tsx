/**
 * ImageUpload — contribuir com uma fotografia
 *
 * Duas origens, porque no telemóvel a maior parte das fotos de um local são
 * tiradas no momento:
 *   • Tirar foto  — câmara traseira (nativo: launchCameraAsync;
 *                   web: <input capture="environment">)
 *   • Da galeria  — biblioteca de fotos / seletor de ficheiros
 *
 * A imagem é reduzida a 1280 px no lado maior e recomprimida em JPEG antes do
 * upload. Uma foto de telemóvel moderno anda pelos 4–8 MB; depois disto fica
 * em dezenas de KB, o que muda tudo em rede móvel e no armazenamento.
 */
import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Platform, Alert,
} from 'react-native';
import OptimizedImage from './OptimizedImage';
import { MaterialIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { uploadImage } from '../services/api';
import { palette, withOpacity } from '../theme/colors';

interface ImageUploadProps {
  token: string;
  context: 'poi' | 'review' | 'contribution' | 'general';
  itemId?: string;
  onUpload: (url: string) => void;
  maxSizeMB?: number;
}

/** Lado maior da imagem depois de redimensionada. */
const MAX_EDGE_PX = 1280;
const JPEG_QUALITY = 0.85;
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

type Source = 'camera' | 'library';

interface PickedImage {
  uri: string;
  type: string;
  name: string;
}

const errorMessage = (err: unknown, fallback: string): string => {
  if (typeof err === 'object' && err !== null) {
    const detail = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail;
    if (detail) return detail;
  }
  return fallback;
};

/**
 * Web: redimensiona via canvas. Devolve um object URL de um JPEG novo.
 * Se o browser não conseguir descodificar a imagem, devolve o ficheiro original
 * — antes um upload maior do que nenhum.
 */
async function resizeOnWeb(file: File): Promise<PickedImage> {
  const original: PickedImage = {
    uri: URL.createObjectURL(file),
    type: file.type,
    name: file.name,
  };
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.type === 'image/jpeg') return original;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    );
    if (!blob) return original;
    return {
      uri: URL.createObjectURL(blob),
      type: 'image/jpeg',
      name: file.name.replace(/\.[^.]+$/, '') + '.jpg',
    };
  } catch {
    return original;
  }
}

/** Nativo: redimensiona com expo-image-manipulator. Falha → URI original. */
async function resizeOnNative(uri: string, width: number, height: number): Promise<PickedImage> {
  const fallback: PickedImage = { uri, type: 'image/jpeg', name: 'photo.jpg' };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImageManipulator = require('expo-image-manipulator');
    const longest = Math.max(width, height);
    const actions = longest > MAX_EDGE_PX
      ? [width >= height ? { resize: { width: MAX_EDGE_PX } } : { resize: { height: MAX_EDGE_PX } }]
      : [];
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: result.uri, type: 'image/jpeg', name: 'photo.jpg' };
  } catch {
    return fallback;
  }
}

export default function ImageUpload({
  token, context, itemId, onUpload, maxSizeMB = 5,
}: ImageUploadProps) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const send = useCallback(async (image: PickedImage) => {
    setError(null);
    setPreviewUrl(image.uri);
    setUploading(true);
    try {
      const result = await uploadImage(image, context, token, itemId);
      onUpload(result.url);
    } catch (err: unknown) {
      setError(errorMessage(err, t('widgets.imageUpload.uploadError')));
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  }, [context, token, itemId, onUpload, t]);

  // ── Web ────────────────────────────────────────────────────────────────

  const handleWebFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Permite escolher o mesmo ficheiro duas vezes seguidas
    event.target.value = '';
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('widgets.imageUpload.badType'));
      return;
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(t('widgets.imageUpload.tooLarge', { max: maxSizeMB }));
      return;
    }
    await send(await resizeOnWeb(file));
  };

  // ── Nativo ─────────────────────────────────────────────────────────────

  const pickNative = async (source: Source) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ImagePicker = require('expo-image-picker');

      const permission = source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert(
          t('widgets.imageUpload.permissionTitle'),
          t(source === 'camera' ? 'widgets.imageUpload.cameraPermissionMessage' : 'widgets.imageUpload.permissionMessage'),
        );
        return;
      }

      const options = {
        mediaTypes: ['images'],
        quality: 1, // a compressão faz-se no redimensionamento, não aqui
        allowsEditing: true,
        aspect: [3, 2] as [number, number],
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.back })
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      await send(await resizeOnNative(asset.uri, asset.width ?? 0, asset.height ?? 0));
    } catch {
      setError(t(source === 'camera' ? 'widgets.imageUpload.cameraUnavailable' : 'widgets.imageUpload.galleryUnavailable'));
    }
  };

  const pick = (source: Source) => {
    if (Platform.OS === 'web') {
      (source === 'camera' ? cameraInputRef : libraryInputRef).current?.click();
    } else {
      pickNative(source);
    }
  };

  const clear = () => {
    setPreviewUrl(null);
    setError(null);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.dropzone, previewUrl && styles.dropzoneWithImage]}
        onPress={() => pick('library')}
        disabled={uploading}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t(previewUrl ? 'widgets.imageUpload.changeLabel' : 'widgets.imageUpload.addFromLibraryLabel')}
      >
        {uploading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={palette.terracotta[500]} />
            <Text style={styles.uploadingText}>{t('widgets.imageUpload.uploading')}</Text>
          </View>
        ) : previewUrl ? (
          <OptimizedImage uri={previewUrl} style={styles.preview} />
        ) : (
          <View style={styles.center}>
            <MaterialIcons name="add-a-photo" size={36} color={palette.terracotta[500]} />
            <Text style={styles.label}>{t('widgets.imageUpload.addPhoto')}</Text>
            <Text style={styles.hint}>{t('widgets.imageUpload.hint', { max: maxSizeMB })}</Text>
          </View>
        )}

        {previewUrl && !uploading && (
          <View style={styles.overlay}>
            <MaterialIcons name="check-circle" size={28} color="#22C55E" />
          </View>
        )}
      </TouchableOpacity>

      {/* Origem da foto */}
      {!uploading && (
        <View style={styles.sourceRow}>
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={() => pick('camera')}
            accessibilityRole="button"
            accessibilityLabel={t('widgets.imageUpload.takePhotoLabel')}
          >
            <MaterialIcons name="photo-camera" size={17} color={palette.terracotta[500]} />
            <Text style={styles.sourceText}>{t('widgets.imageUpload.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.sourceButton}
            onPress={() => pick('library')}
            accessibilityRole="button"
            accessibilityLabel={t('widgets.imageUpload.fromLibraryLabel')}
          >
            <MaterialIcons name="photo-library" size={17} color={palette.terracotta[500]} />
            <Text style={styles.sourceText}>{t(previewUrl ? 'widgets.imageUpload.change' : 'widgets.imageUpload.fromLibrary')}</Text>
          </TouchableOpacity>
          {previewUrl && (
            <TouchableOpacity
              style={styles.sourceButton}
              onPress={clear}
              accessibilityRole="button"
              accessibilityLabel={t('widgets.imageUpload.removeLabel')}
            >
              <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
              <Text style={[styles.sourceText, styles.removeText]}>{t('widgets.imageUpload.remove')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Inputs escondidos (web). `capture` abre a câmara traseira em telemóvel. */}
      {Platform.OS === 'web' && (
        <>
          <input
            ref={libraryInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={handleWebFileChange}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleWebFileChange}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  dropzone: {
    borderWidth: 2,
    borderColor: withOpacity(palette.terracotta[500], 0.3),
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    backgroundColor: withOpacity(palette.terracotta[500], 0.05),
  },
  dropzoneWithImage: {
    padding: 0,
    overflow: 'hidden',
    borderStyle: 'solid',
    borderColor: '#22C55E',
  },
  center: {
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: palette.terracotta[500],
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12,
  },
  uploadingText: {
    color: palette.terracotta[500],
    fontSize: 13,
    marginTop: 4,
  },
  preview: {
    width: '100%',
    height: 200,
    borderRadius: 10,
  },
  overlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  sourceButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: withOpacity(palette.terracotta[500], 0.35),
  },
  sourceText: {
    color: palette.terracotta[500],
    fontSize: 13,
    fontWeight: '700',
  },
  removeText: {
    color: '#EF4444',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
});
