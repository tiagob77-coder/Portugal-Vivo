import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { resources, SUPPORTED_LANGUAGES } from './resources';

const LANGUAGE_KEY = '@patrimonio_language';

export const LANGUAGES = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

export const getDeviceLanguage = () => {
  const locale = Localization.getLocales()[0]?.languageCode;
  if (!locale) return 'pt';
  if ((SUPPORTED_LANGUAGES as readonly string[]).includes(locale)) {
    return locale;
  }
  // A visitor whose device runs in a language we don't ship (German, Dutch…)
  // reads English far more often than Portuguese.
  return 'en';
};

export const initI18n = async () => {
  let savedLanguage: string | null = null;
  
  // Only try AsyncStorage if we're in a browser/native environment
  if (typeof window !== 'undefined') {
    try {
      savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    } catch (_error) {
      // AsyncStorage unavailable - will use device language fallback
    }
  }

  const language = savedLanguage || getDeviceLanguage();

  if (i18n.isInitialized) {
    await i18n.changeLanguage(language); // eslint-disable-line import/no-named-as-default-member
    return i18n;
  }

  await i18n // eslint-disable-line import/no-named-as-default-member
    .use(initReactI18next)
    .init({
      resources,
      lng: language,
      fallbackLng: 'pt',
      interpolation: {
        escapeValue: false,
      },
      react: {
        useSuspense: false,
      },
    });

  return i18n;
};

export const changeLanguage = async (languageCode: string) => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, languageCode);
    await i18n.changeLanguage(languageCode); // eslint-disable-line import/no-named-as-default-member
  } catch (_error) {
    // Non-critical: language preference won't persist
  }
};

export const getCurrentLanguage = () => i18n.language;

export default i18n;
