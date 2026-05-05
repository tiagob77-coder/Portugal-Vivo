import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// On native platforms, use expo-secure-store (encrypted keychain/keystore).
// On web, AsyncStorage is acceptable — SecureStore is not available there.
let SecureStore: typeof import('expo-secure-store') | null = null;
if (Platform.OS !== 'web') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SecureStore = require('expo-secure-store');
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (SecureStore) return SecureStore.getItemAsync(key);
    return AsyncStorage.getItem(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (SecureStore) {
      await SecureStore.setItemAsync(key, value);
    } else {
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    if (SecureStore) {
      await SecureStore.deleteItemAsync(key);
    } else {
      await AsyncStorage.removeItem(key);
    }
  },
};
