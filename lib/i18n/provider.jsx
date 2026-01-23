'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { locales, defaultLocale, isRtl, getDirection } from '@/lib/i18n/config';

// Load all messages
import enMessages from '@/messages/en.json';
import deMessages from '@/messages/de.json';
import arMessages from '@/messages/ar.json';
import zhMessages from '@/messages/zh.json';

const messages = {
  en: enMessages,
  de: deMessages,
  ar: arMessages,
  zh: zhMessages
};

const I18nContext = createContext(null);

// Helper to get nested translation
function getNestedTranslation(obj, path) {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Replace placeholders like {count} with values
function interpolate(str, values = {}) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? `{${key}}`);
}

export function I18nProvider({ children }) {
  const [locale, setLocaleState] = useState(defaultLocale);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize locale on mount
  useEffect(() => {
    // 1. Check localStorage first (user's saved preference)
    const savedLocale = localStorage.getItem('solmate_language');
    if (savedLocale && locales.includes(savedLocale)) {
      setLocaleState(savedLocale);
      setIsLoaded(true);
      return;
    }

    // 2. Default to English (no browser detection)
    // User can manually change language in Settings
    setLocaleState(defaultLocale); // 'en'
    localStorage.setItem('solmate_language', defaultLocale);
    setIsLoaded(true);
  }, []);

  // Update document direction when locale changes
  useEffect(() => {
    if (isLoaded) {
      document.documentElement.lang = locale;
      document.documentElement.dir = getDirection(locale);
    }
  }, [locale, isLoaded]);

  // Set locale and save to localStorage
  const setLocale = useCallback((newLocale) => {
    if (locales.includes(newLocale)) {
      setLocaleState(newLocale);
      localStorage.setItem('solmate_language', newLocale);
    }
  }, []);

  // Update locale in user profile (call from parent when auth token is available)
  const syncLocaleToServer = useCallback(async (authToken) => {
    if (!authToken) return;
    try {
      await fetch('/api/user/language', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ language: locale })
      });
    } catch (e) {
      console.error('Failed to sync language to server:', e);
    }
  }, [locale]);

  // Translation function
  const t = useCallback((key, values = {}) => {
    const translation = getNestedTranslation(messages[locale], key);
    if (translation === undefined) {
      // Fallback to English
      const fallback = getNestedTranslation(messages[defaultLocale], key);
      if (fallback === undefined) {
        console.warn(`Missing translation: ${key}`);
        return key;
      }
      return interpolate(fallback, values);
    }
    return interpolate(translation, values);
  }, [locale]);

  const value = {
    locale,
    setLocale,
    t,
    isRtl: isRtl(locale),
    direction: getDirection(locale),
    locales,
    syncLocaleToServer,
    isLoaded
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useTranslation() {
  const { t, locale, isRtl, direction } = useI18n();
  return { t, locale, isRtl, direction };
}
