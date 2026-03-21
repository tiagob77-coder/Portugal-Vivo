import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  StatusBar,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { getHeritageItem } from '../src/services/api';
import ARTimeTravelView from '../src/components/ARTimeTravelView';

export default function ARTimeTravelScreen() {
  const { itemId, itemName, itemCategory, itemRegion, imageUrl } = useLocalSearchParams<{
    itemId?: string;
    itemName?: string;
    itemCategory?: string;
    itemRegion?: string;
    imageUrl?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [modalVisible, setModalVisible] = useState(true);

  // If itemId provided, fetch full item data
  const { data: item } = useQuery({
    queryKey: ['heritage', itemId],
    queryFn: () => getHeritageItem(itemId!),
    enabled: !!itemId && !itemName,
  });

  const resolvedName = itemName || item?.name || 'Local Histórico';
  const resolvedCategory = itemCategory || item?.category || 'patrimonio';
  const resolvedRegion = itemRegion || item?.region;
  const resolvedImage = imageUrl || item?.image_url;

  const handleClose = () => {
    setModalVisible(false);
    router.back();
  };

  if (Platform.OS === 'web') {
    // On web, render inline (no Modal needed)
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" />
        <ARTimeTravelView
          itemName={resolvedName}
          itemCategory={resolvedCategory}
          itemRegion={resolvedRegion}
          currentImageUrl={resolvedImage}
          onClose={handleClose}
        />
      </View>
    );
  }

  return (
    <Modal
      visible={modalVisible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <ARTimeTravelView
          itemName={resolvedName}
          itemCategory={resolvedCategory}
          itemRegion={resolvedRegion}
          currentImageUrl={resolvedImage}
          onClose={handleClose}
        />
      </View>
    </Modal>
  );
}

// Fallback UI while item loads (if needed)
function _LoadingPlaceholder({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.loadingContainer}>
      <MaterialIcons name="camera" size={64} color="#C49A6C" />
      <Text style={styles.loadingText}>A preparar a viagem no tempo...</Text>
      <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
        <Text style={styles.cancelText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelText: {
    color: '#FAF8F3',
    fontSize: 15,
    fontWeight: '600',
  },
});
