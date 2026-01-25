'use client';

import { useCallback, useRef, useEffect, useState } from 'react';

/**
 * Feedback Event Types with intensity levels
 * Used to determine sound volume and haptic pattern
 */
export const FEEDBACK_EVENTS = {
  // Light feedback
  BUTTON_CLICK: 'button_click',
  MOVE_MADE: 'move_made',
  QUICK_CHAT: 'quick_chat',
  ERROR: 'error',
  
  // Medium feedback
  CAPTURE: 'capture',
  CHECK: 'check',
  CASTLE: 'castle',
  PROMOTION: 'promotion',
  
  // Strong feedback
  CHECKMATE: 'checkmate',
  WIN: 'win',
  LOSE: 'lose',
  DRAW: 'draw',
  TIMEOUT: 'timeout',
};

/**
 * Sound file paths (relative to /public/sounds/)
 */
const SOUND_FILES = {
  [FEEDBACK_EVENTS.BUTTON_CLICK]: '/sounds/click.mp3',
  [FEEDBACK_EVENTS.MOVE_MADE]: '/sounds/move.mp3',
  [FEEDBACK_EVENTS.CAPTURE]: '/sounds/capture.mp3',
  [FEEDBACK_EVENTS.CHECK]: '/sounds/check.mp3',
  [FEEDBACK_EVENTS.CASTLE]: '/sounds/castle.mp3',
  [FEEDBACK_EVENTS.PROMOTION]: '/sounds/promote.mp3',
  [FEEDBACK_EVENTS.CHECKMATE]: '/sounds/checkmate.mp3',
  [FEEDBACK_EVENTS.WIN]: '/sounds/win.mp3',
  [FEEDBACK_EVENTS.LOSE]: '/sounds/lose.mp3',
  [FEEDBACK_EVENTS.DRAW]: '/sounds/draw.mp3',
  [FEEDBACK_EVENTS.TIMEOUT]: '/sounds/timeout.mp3',
  [FEEDBACK_EVENTS.ERROR]: '/sounds/error.mp3',
  [FEEDBACK_EVENTS.QUICK_CHAT]: '/sounds/chat.mp3',
};

/**
 * Volume levels for different event types (0.0 - 1.0)
 */
const VOLUME_LEVELS = {
  [FEEDBACK_EVENTS.BUTTON_CLICK]: 0.3,
  [FEEDBACK_EVENTS.MOVE_MADE]: 0.5,
  [FEEDBACK_EVENTS.CAPTURE]: 0.6,
  [FEEDBACK_EVENTS.CHECK]: 0.7,
  [FEEDBACK_EVENTS.CASTLE]: 0.5,
  [FEEDBACK_EVENTS.PROMOTION]: 0.6,
  [FEEDBACK_EVENTS.CHECKMATE]: 0.8,
  [FEEDBACK_EVENTS.WIN]: 0.8,
  [FEEDBACK_EVENTS.LOSE]: 0.7,
  [FEEDBACK_EVENTS.DRAW]: 0.5,
  [FEEDBACK_EVENTS.TIMEOUT]: 0.6,
  [FEEDBACK_EVENTS.ERROR]: 0.4,
  [FEEDBACK_EVENTS.QUICK_CHAT]: 0.4,
};

/**
 * Haptic patterns for different event types
 * Numbers represent vibration duration in ms
 * Arrays represent [vibrate, pause, vibrate, ...] patterns
 */
const HAPTIC_PATTERNS = {
  // Light - single short vibration
  [FEEDBACK_EVENTS.BUTTON_CLICK]: [15],
  [FEEDBACK_EVENTS.MOVE_MADE]: [20],
  [FEEDBACK_EVENTS.QUICK_CHAT]: [25],
  [FEEDBACK_EVENTS.ERROR]: [30, 50, 30], // Double buzz for error
  
  // Medium - slightly longer vibration
  [FEEDBACK_EVENTS.CAPTURE]: [40],
  [FEEDBACK_EVENTS.CHECK]: [50, 30, 50], // Double tap for check
  [FEEDBACK_EVENTS.CASTLE]: [30, 20, 30],
  [FEEDBACK_EVENTS.PROMOTION]: [40, 30, 40],
  
  // Strong - longer vibration patterns
  [FEEDBACK_EVENTS.CHECKMATE]: [100, 50, 100, 50, 100],
  [FEEDBACK_EVENTS.WIN]: [80, 40, 80, 40, 120],
  [FEEDBACK_EVENTS.LOSE]: [150, 100, 150],
  [FEEDBACK_EVENTS.DRAW]: [60, 40, 60],
  [FEEDBACK_EVENTS.TIMEOUT]: [100, 50, 100],
};

/**
 * Throttle times to prevent spam (in ms)
 */
const THROTTLE_TIMES = {
  [FEEDBACK_EVENTS.BUTTON_CLICK]: 50,
  [FEEDBACK_EVENTS.MOVE_MADE]: 100,
  [FEEDBACK_EVENTS.CAPTURE]: 100,
  [FEEDBACK_EVENTS.CHECK]: 200,
  [FEEDBACK_EVENTS.CASTLE]: 200,
  [FEEDBACK_EVENTS.PROMOTION]: 200,
  [FEEDBACK_EVENTS.CHECKMATE]: 500,
  [FEEDBACK_EVENTS.WIN]: 500,
  [FEEDBACK_EVENTS.LOSE]: 500,
  [FEEDBACK_EVENTS.DRAW]: 500,
  [FEEDBACK_EVENTS.TIMEOUT]: 500,
  [FEEDBACK_EVENTS.ERROR]: 100,
  [FEEDBACK_EVENTS.QUICK_CHAT]: 200,
};

/**
 * Global audio context singleton
 */
let audioContext = null;
let audioUnlocked = false;

/**
 * Get or create AudioContext (handles browser autoplay restrictions)
 */
const getAudioContext = () => {
  if (audioContext) return audioContext;
  
  try {
    // Try to create AudioContext
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioContext = new AudioContextClass();
    }
  } catch (e) {
    console.warn('[Feedback] Failed to create AudioContext:', e);
  }
  
  return audioContext;
};

/**
 * Unlock audio on first user interaction (required for mobile browsers)
 */
const unlockAudio = () => {
  if (audioUnlocked) return;
  
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      audioUnlocked = true;
      console.log('[Feedback] Audio context resumed');
    }).catch(e => {
      console.warn('[Feedback] Failed to resume audio context:', e);
    });
  } else if (ctx) {
    audioUnlocked = true;
  }
};

/**
 * Check if vibration is supported
 */
const isVibrationSupported = () => {
  return typeof navigator !== 'undefined' && 'vibrate' in navigator;
};

/**
 * Custom hook for sound and haptic feedback
 * 
 * @param {Object} options
 * @param {boolean} options.soundEnabled - Whether sound is enabled
 * @param {boolean} options.hapticEnabled - Whether haptics are enabled
 * @param {number} options.masterVolume - Master volume (0.0 - 1.0), default 1.0
 * @returns {Object} Feedback functions
 */
export function useFeedback({ 
  soundEnabled = true, 
  hapticEnabled = true,
  masterVolume = 1.0 
} = {}) {
  // Audio cache (preloaded sounds)
  const audioCache = useRef(new Map());
  const lastPlayTimes = useRef(new Map());
  const [isReady, setIsReady] = useState(false);
  
  // Preload all sounds on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const preloadSounds = async () => {
      const cache = audioCache.current;
      
      for (const [event, path] of Object.entries(SOUND_FILES)) {
        try {
          const audio = new Audio();
          audio.preload = 'auto';
          audio.src = path;
          
          // Create a promise that resolves when the audio is ready
          await new Promise((resolve, reject) => {
            audio.oncanplaythrough = resolve;
            audio.onerror = () => {
              console.warn(`[Feedback] Failed to preload: ${path}`);
              resolve(); // Don't reject, just skip
            };
            // Timeout after 5 seconds
            setTimeout(resolve, 5000);
          });
          
          cache.set(event, audio);
        } catch (e) {
          console.warn(`[Feedback] Error preloading ${path}:`, e);
        }
      }
      
      setIsReady(true);
      console.log('[Feedback] Sounds preloaded:', cache.size);
    };
    
    preloadSounds();
    
    // Add listener to unlock audio on first interaction
    const handleInteraction = () => {
      unlockAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction);
    document.addEventListener('touchstart', handleInteraction);
    
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
  }, []);
  
  /**
   * Play a sound for the given event
   */
  const playSound = useCallback((event) => {
    if (!soundEnabled) return;
    
    // Throttle check
    const now = Date.now();
    const lastPlay = lastPlayTimes.current.get(`sound_${event}`) || 0;
    const throttle = THROTTLE_TIMES[event] || 100;
    
    if (now - lastPlay < throttle) return;
    lastPlayTimes.current.set(`sound_${event}`, now);
    
    try {
      // Try to unlock audio first
      unlockAudio();
      
      // Get cached audio or create new
      let audio = audioCache.current.get(event);
      
      if (!audio) {
        const path = SOUND_FILES[event];
        if (!path) return;
        
        audio = new Audio(path);
        audioCache.current.set(event, audio);
      }
      
      // Clone for overlapping sounds (if needed)
      const soundToPlay = audio.cloneNode();
      soundToPlay.volume = (VOLUME_LEVELS[event] || 0.5) * masterVolume;
      
      // Play with error handling
      const playPromise = soundToPlay.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          // Autoplay was prevented - this is expected on first load
          if (e.name === 'NotAllowedError') {
            console.debug('[Feedback] Autoplay prevented - waiting for user interaction');
          } else {
            console.warn('[Feedback] Sound play error:', e);
          }
        });
      }
    } catch (e) {
      console.warn('[Feedback] Sound error:', e);
    }
  }, [soundEnabled, masterVolume]);
  
  /**
   * Trigger haptic feedback for the given event
   */
  const triggerHaptic = useCallback((event) => {
    if (!hapticEnabled || !isVibrationSupported()) return;
    
    // Throttle check
    const now = Date.now();
    const lastPlay = lastPlayTimes.current.get(`haptic_${event}`) || 0;
    const throttle = THROTTLE_TIMES[event] || 100;
    
    if (now - lastPlay < throttle) return;
    lastPlayTimes.current.set(`haptic_${event}`, now);
    
    try {
      const pattern = HAPTIC_PATTERNS[event];
      if (pattern) {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      console.warn('[Feedback] Haptic error:', e);
    }
  }, [hapticEnabled]);
  
  /**
   * Combined feedback - plays sound and triggers haptic
   */
  const trigger = useCallback((event) => {
    playSound(event);
    triggerHaptic(event);
  }, [playSound, triggerHaptic]);
  
  /**
   * Convenience methods for common events
   */
  const buttonClick = useCallback(() => trigger(FEEDBACK_EVENTS.BUTTON_CLICK), [trigger]);
  const moveMade = useCallback(() => trigger(FEEDBACK_EVENTS.MOVE_MADE), [trigger]);
  const capture = useCallback(() => trigger(FEEDBACK_EVENTS.CAPTURE), [trigger]);
  const check = useCallback(() => trigger(FEEDBACK_EVENTS.CHECK), [trigger]);
  const castle = useCallback(() => trigger(FEEDBACK_EVENTS.CASTLE), [trigger]);
  const promotion = useCallback(() => trigger(FEEDBACK_EVENTS.PROMOTION), [trigger]);
  const checkmate = useCallback(() => trigger(FEEDBACK_EVENTS.CHECKMATE), [trigger]);
  const win = useCallback(() => trigger(FEEDBACK_EVENTS.WIN), [trigger]);
  const lose = useCallback(() => trigger(FEEDBACK_EVENTS.LOSE), [trigger]);
  const draw = useCallback(() => trigger(FEEDBACK_EVENTS.DRAW), [trigger]);
  const timeout = useCallback(() => trigger(FEEDBACK_EVENTS.TIMEOUT), [trigger]);
  const error = useCallback(() => trigger(FEEDBACK_EVENTS.ERROR), [trigger]);
  const quickChat = useCallback(() => trigger(FEEDBACK_EVENTS.QUICK_CHAT), [trigger]);
  
  /**
   * Play chess move sound based on move result
   */
  const chessMoveSound = useCallback((moveResult) => {
    if (!moveResult) return;
    
    // Determine the appropriate feedback based on move result
    if (moveResult.isCheckmate || moveResult.san?.includes('#')) {
      checkmate();
    } else if (moveResult.isCheck || moveResult.san?.includes('+')) {
      check();
    } else if (moveResult.captured || moveResult.san?.includes('x')) {
      capture();
    } else if (moveResult.san?.includes('O-O')) {
      castle();
    } else if (moveResult.promotion) {
      promotion();
    } else {
      moveMade();
    }
  }, [checkmate, check, capture, castle, promotion, moveMade]);
  
  return {
    // Core trigger
    trigger,
    
    // Individual triggers
    playSound,
    triggerHaptic,
    
    // Convenience methods
    buttonClick,
    moveMade,
    capture,
    check,
    castle,
    promotion,
    checkmate,
    win,
    lose,
    draw,
    timeout,
    error,
    quickChat,
    
    // Chess-specific
    chessMoveSound,
    
    // State
    isReady,
    isVibrationSupported: isVibrationSupported(),
    
    // Event types (for external use)
    EVENTS: FEEDBACK_EVENTS,
  };
}

export default useFeedback;
