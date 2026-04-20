import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import pt from './locales/pt.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

const LANGUAGE_KEY = '@patrimonio_language';

export const LANGUAGES = [
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
];

const resources = {
  pt: { translation: pt },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
};

const getDeviceLanguage = () => {
  const locale = Localization.getLocales()[0]?.languageCode || 'pt';
  // Check if we support this language
  if (['pt', 'en', 'es', 'fr'].includes(locale)) {
    return locale;
  }
  return 'pt'; // Default to Portuguese
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
