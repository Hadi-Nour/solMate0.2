// i18n configuration for PlaySolMates
export const locales = ['en', 'de', 'ar', 'zh'];
export const defaultLocale = 'en';

// RTL languages
export const rtlLocales = ['ar'];

export function isRtl(locale) {
  return rtlLocales.includes(locale);
}

// Get direction based on locale
export function getDirection(locale) {
  return isRtl(locale) ? 'rtl' : 'ltr';
}

// Supported language names for display
export const languageNames = {
  en: 'English',
  de: 'Deutsch',
  ar: 'العربية',
  zh: '中文'
};
