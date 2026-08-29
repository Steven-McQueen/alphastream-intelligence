// Timezone preference store (localStorage-backed, cross-component reactive).
// The market data carries absolute timestamps (ISO with offset); this only
// controls how those instants are *displayed* to the user.

const STORAGE_KEY = 'alphastream-timezone';

export const AUTO_TIMEZONE = 'auto';

// Curated list for the Settings selector. 'auto' resolves to the device zone.
export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: AUTO_TIMEZONE, label: 'Automatic (device)' },
  { value: 'Europe/Oslo', label: 'Oslo · Central European (CET/CEST)' },
  { value: 'Europe/London', label: 'London · (GMT/BST)' },
  { value: 'America/New_York', label: 'New York · Eastern (ET)' },
  { value: 'America/Chicago', label: 'Chicago · Central (CT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles · Pacific (PT)' },
  { value: 'UTC', label: 'UTC' },
  { value: 'Asia/Tokyo', label: 'Tokyo · (JST)' },
  { value: 'Asia/Singapore', label: 'Singapore · (SGT)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong · (HKT)' },
];

function read(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || AUTO_TIMEZONE;
  } catch {
    return AUTO_TIMEZONE;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function getStoredTimezone(): string {
  return current;
}

export function setStoredTimezone(tz: string): void {
  current = tz;
  try {
    localStorage.setItem(STORAGE_KEY, tz);
  } catch (e) {
    console.error('Failed to persist timezone preference:', e);
  }
  listeners.forEach((l) => l());
}

/** Resolve the stored preference to a concrete IANA zone ('auto' -> device). */
export function resolveTimezone(tz: string = current): string {
  if (tz === AUTO_TIMEZONE) {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }
  return tz;
}

/** Subscribe to changes (in-app setStoredTimezone + cross-tab storage events). */
export function subscribeTimezone(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = read();
      cb();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}
