/**
 * Locale helpers for dates and numbers, so screens stop hard-coding 'pt-PT'.
 */
import i18n from 'i18next';

const LOCALES: Record<string, string> = {
  pt: 'pt-PT',
  en: 'en-GB',
  es: 'es-ES',
  fr: 'fr-FR',
};

/** BCP 47 locale for the current (or given) UI language. */
export const currentLocale = (lang: string = i18n.language): string => LOCALES[lang] ?? 'pt-PT';
