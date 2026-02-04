/**
 * Safe localStorage utilities that handle errors gracefully.
 * Prevents crashes in Safari private mode and other restricted environments.
 */

/**
 * Safely retrieves a value from localStorage.
 * @param key - The storage key to retrieve
 * @returns The stored value or null if not found/unavailable
 */
export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Safely stores a value in localStorage.
 * @param key - The storage key
 * @param value - The value to store
 * @returns true if successful, false otherwise
 */
export function setStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely removes a value from localStorage.
 * @param key - The storage key to remove
 * @returns true if successful, false otherwise
 */
export function removeStorageItem(key: string): boolean {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely retrieves and parses a JSON value from localStorage.
 * @param key - The storage key to retrieve
 * @param defaultValue - Default value if not found or parse fails
 * @returns The parsed value or default
 */
export function getStorageJson<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Safely stores a JSON value in localStorage.
 * @param key - The storage key
 * @param value - The value to store (will be JSON.stringify'd)
 * @returns true if successful, false otherwise
 */
export function setStorageJson<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
