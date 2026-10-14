/**
 * Translation resources: the base locale files plus one file per UI area.
 *
 * Each area file holds all four languages side by side
 * (`{ pt: {...}, en: {...}, es: {...}, fr: {...} }`) and is mounted under its
 * file name as a namespace prefix, so `areas/details.json` is read with
 * `t('details.heritage.navigate')`. Keeping the languages of one area in one
 * file lets the parity test (__tests__/locales.test.ts) catch a key that was
 * added in Portuguese but never translated.
 */
import pt from './locales/pt.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';

import coreTabs from './areas/coreTabs.json';
import mapScreen from './areas/mapScreen.json';
import details from './areas/details.json';
import plannerEvents from './areas/plannerEvents.json';
import account from './areas/account.json';
import exploreScreens from './areas/exploreScreens.json';
import components from './areas/components.json';
import widgets from './areas/widgets.json';
import premiumScreen from './areas/premiumScreen.json';

export const SUPPORTED_LANGUAGES = ['pt', 'en', 'es', 'fr'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type Dict = Record<string, unknown>;
type AreaFile = Record<SupportedLanguage, Dict>;

export const BASE_LOCALES: Record<SupportedLanguage, Dict> = { pt, en, es, fr };

export const AREAS: Record<string, AreaFile> = {
  coreTabs,
  mapScreen,
  details,
  plannerEvents,
  account,
  exploreScreens,
  components,
  widgets,
  premiumScreen,
};

function buildLanguage(lang: SupportedLanguage): Dict {
  const merged: Dict = { ...BASE_LOCALES[lang] };
  for (const [namespace, area] of Object.entries(AREAS)) {
    if (namespace in merged) {
      throw new Error(`i18n area "${namespace}" collides with a base namespace`);
    }
    merged[namespace] = area[lang];
  }
  return merged;
}

export const resources = Object.fromEntries(
  SUPPORTED_LANGUAGES.map((lang) => [lang, { translation: buildLanguage(lang) }]),
) as Record<SupportedLanguage, { translation: Dict }>;
