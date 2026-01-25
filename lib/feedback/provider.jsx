'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useFeedback, FEEDBACK_EVENTS } from '@/hooks/useFeedback';

// Settings storage key
const SETTINGS_KEY = 'solmate_feedback_settings';

// Default settings
const DEFAULT_SETTINGS = {
  soundEnabled: true,
  hapticEnabled: true,
  masterVolume: 1.0,
};

// Context
const FeedbackContext = createContext(null);

/**
 * FeedbackProvider - Wraps the app and provides feedback functionality
 * Manages settings persistence and provides feedback triggers to all components
 */
export function FeedbackProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.warn('[FeedbackProvider] Failed to load settings:', e);
    }
    
    setIsInitialized(true);
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (!isInitialized) return;
    
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('[FeedbackProvider] Failed to save settings:', e);
    }
  }, [settings, isInitialized]);

  // Initialize the feedback hook with current settings
  const feedback = useFeedback({
    soundEnabled: settings.soundEnabled,
    hapticEnabled: settings.hapticEnabled,
    masterVolume: settings.masterVolume,
  });

  // Settings update functions
  const setSoundEnabled = useCallback((enabled) => {
    setSettings(prev => ({ ...prev, soundEnabled: enabled }));
  }, []);

  const setHapticEnabled = useCallback((enabled) => {
    setSettings(prev => ({ ...prev, hapticEnabled: enabled }));
  }, []);

  const setMasterVolume = useCallback((volume) => {
    setSettings(prev => ({ ...prev, masterVolume: Math.max(0, Math.min(1, volume)) }));
  }, []);

  // Combined context value
  const value = {
    // Feedback triggers
    ...feedback,
    
    // Settings
    settings,
    soundEnabled: settings.soundEnabled,
    hapticEnabled: settings.hapticEnabled,
    masterVolume: settings.masterVolume,
    
    // Settings setters
    setSoundEnabled,
    setHapticEnabled,
    setMasterVolume,
    
    // State
    isInitialized,
  };

  return (
    <FeedbackContext.Provider value={value}>
      {children}
    </FeedbackContext.Provider>
  );
}

/**
 * Hook to access feedback context
 * Must be used within a FeedbackProvider
 */
export function useFeedbackContext() {
  const context = useContext(FeedbackContext);
  
  if (!context) {
    // Return a no-op version if used outside provider
    console.warn('[useFeedbackContext] Used outside FeedbackProvider - feedback disabled');
    return {
      trigger: () => {},
      playSound: () => {},
      triggerHaptic: () => {},
      buttonClick: () => {},
      moveMade: () => {},
      capture: () => {},
      check: () => {},
      castle: () => {},
      promotion: () => {},
      checkmate: () => {},
      win: () => {},
      lose: () => {},
      draw: () => {},
      timeout: () => {},
      error: () => {},
      quickChat: () => {},
      chessMoveSound: () => {},
      settings: DEFAULT_SETTINGS,
      soundEnabled: true,
      hapticEnabled: true,
      masterVolume: 1.0,
      setSoundEnabled: () => {},
      setHapticEnabled: () => {},
      setMasterVolume: () => {},
      isReady: false,
      isInitialized: false,
      isVibrationSupported: false,
      EVENTS: FEEDBACK_EVENTS,
    };
  }
  
  return context;
}

// Export event types for convenience
export { FEEDBACK_EVENTS };
