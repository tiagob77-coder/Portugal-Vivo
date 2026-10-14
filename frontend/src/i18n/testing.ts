/**
 * Synchronous i18n init for Jest. Screens render their Portuguese copy, so
 * tests written against the original strings keep passing; a test can switch
 * with `i18n.changeLanguage('en')`.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

export function initTestI18n(lng = 'pt') {
  if (i18n.isInitialized) {
    i18n.changeLanguage(lng); // eslint-disable-line import/no-named-as-default-member
    return i18n;
  }
  i18n.use(initReactI18next).init({ // eslint-disable-line import/no-named-as-default-member
    resources,
    lng,
    fallbackLng: 'pt',
    initAsync: false,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return i18n;
}
