import { useSyncExternalStore } from 'react';
import {
  getStoredTimezone,
  resolveTimezone,
  setStoredTimezone,
  subscribeTimezone,
} from '@/config/timezone';

/**
 * Reactive access to the user's display-timezone preference.
 * `timezone` is the raw preference (may be 'auto'); `resolved` is the
 * concrete IANA zone to pass to Intl.DateTimeFormat.
 */
export function useTimezone() {
  const timezone = useSyncExternalStore(
    subscribeTimezone,
    getStoredTimezone,
    getStoredTimezone,
  );
  return {
    timezone,
    resolved: resolveTimezone(timezone),
    setTimezone: setStoredTimezone,
  };
}
