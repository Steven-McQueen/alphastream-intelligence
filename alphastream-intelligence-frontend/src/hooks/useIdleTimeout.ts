import { useEffect, useRef, useState, useCallback } from 'react';

interface UseIdleTimeoutOptions {
  timeout: number; // Timeout in milliseconds
  warningTime?: number; // Time before timeout to show warning (ms)
  onIdle: () => void;
  onWarning?: () => void;
  enabled?: boolean;
}

export function useIdleTimeout({
  timeout,
  warningTime = 60000, // 1 minute warning by default
  onIdle,
  onWarning,
  enabled = true,
}: UseIdleTimeoutOptions) {
  const [isWarning, setIsWarning] = useState(false);
  const [remainingTime, setRemainingTime] = useState(timeout);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const clearAllTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearAllTimers();
    setIsWarning(false);
    setRemainingTime(timeout);
    lastActivityRef.current = Date.now();

    // Set warning timeout
    if (warningTime && onWarning) {
      warningTimeoutRef.current = setTimeout(() => {
        setIsWarning(true);
        onWarning();
        
        // Start countdown
        countdownRef.current = setInterval(() => {
          const elapsed = Date.now() - lastActivityRef.current;
          const remaining = Math.max(0, timeout - elapsed);
          setRemainingTime(remaining);
        }, 1000);
      }, timeout - warningTime);
    }

    // Set idle timeout
    timeoutRef.current = setTimeout(() => {
      clearAllTimers();
      onIdle();
    }, timeout);
  }, [timeout, warningTime, onIdle, onWarning, enabled, clearAllTimers]);

  const handleActivity = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    if (!enabled) {
      clearAllTimers();
      return;
    }

    // Activity events to track
    const events = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle activity handler to avoid excessive resets
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledHandler = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
        handleActivity();
      }, 1000);
    };

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, throttledHandler, { passive: true });
    });

    // Initialize timer
    resetTimer();

    return () => {
      clearAllTimers();
      if (throttleTimer) clearTimeout(throttleTimer);
      events.forEach((event) => {
        document.removeEventListener(event, throttledHandler);
      });
    };
  }, [enabled, handleActivity, resetTimer, clearAllTimers]);

  return {
    isWarning,
    remainingTime,
    resetTimer,
  };
}
