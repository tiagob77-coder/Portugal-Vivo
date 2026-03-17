import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator,
  Platform, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { uploadImage } from '../services/api';

interface ImageUploadProps {
  token: string;
  context: 'poi' | 'review' | 'contribution' | 'general';
  itemId?: string;
  onUpload: (url: string) => void;
  maxSizeMB?: number;
}

export default function ImageUpload({
  token, context, itemId, onUpload, maxSizeMB = 5,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleWebPick = () => {
    if (Platform.OS !== 'web') return;
    fileInputRef.current?.click();
  };

  const handleWebFileChange = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate type
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use JPEG, PNG ou WebP');
      return;
    }

    // Validate size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`Ficheiro demasiado grande (máx. ${maxSizeMB} MB)`);
      return;
    }

    // Preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Upload
    setUploading(true);
    try {
      const result = await uploadImage(
        { uri: objectUrl, type: file.type, name: file.name },
        context,
        token,
        itemId,
      );
      onUpload(result.url);
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro ao fazer upload');
      setPreviewUrl(null);
    } finally {
      setUploading(false);
    }
  };

  const handleNativePick = async () => {
    try {
      const ImagePicker = require('expo-image-picker');
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Precisamos de acesso à galeria para carregar fotos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [3, 2],
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setPreviewUrl(asset.uri);
      setError(null);
      setUploading(true);

      try {
        const ext = asset.uri.split('.').pop() || 'jpg';
        const uploadResult = await uploadImage(
          { uri: asset.uri, type: `image/${ext === 'jpg' ? 'jpeg' : ext}`, name: `photo.${ext}` },
          context,
          token,
          itemId,
        );
        onUpload(uploadResult.url);
      } catch (err: any) {
        setError(err?.response?.data?.detail || 'Erro ao fazer upload');
        setPreviewUrl(null);
      } finally {
        setUploading(false);
      }
    } catch {
      setError('Galeria não disponível');
    }
  };

  const handlePress = () => {
    if (Platform.OS === 'web') {
      handleWebPick();
    } else {
      handleNativePick();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.dropzone, previewUrl && styles.dropzoneWithImage]}
        onPress={handlePress}
        disabled={uploading}
        activeOpacity={0.7}
      >
        {uploading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#C49A6C" />
            <Text style={styles.uploadingText}>A carregar...</Text>
          </View>
        ) : previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.preview} resizeMode="cover" />
        ) : (
          <View style={styles.center}>
            <MaterialIcons name="add-a-photo" size={36} color="#C49A6C" />
            <Text style={styles.label}>Adicionar foto</Text>
            <Text style={styles.hint}>JPEG, PNG ou WebP (máx. {maxSizeMB} MB)</Text>
          </View>
        )}

        {previewUrl && !uploading && (
          <View style={styles.overlay}>
            <MaterialIcons name="check-circle" size={28} color="#22C55E" />
          </View>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={14} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Hidden file input for web */}
      {Platform.OS === 'web' && (
        <input
          ref={fileInputRef as any}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={handleWebFileChange}
        />
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
    borderColor: 'rgba(196, 154, 108, 0.3)',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
    backgroundColor: 'rgba(196, 154, 108, 0.05)',
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
    color: '#C49A6C',
    fontWeight: '700',
    fontSize: 15,
  },
  hint: {
    color: '#94A3B8',
    fontSize: 12,
  },
  uploadingText: {
    color: '#C49A6C',
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
