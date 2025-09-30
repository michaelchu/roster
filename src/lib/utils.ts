import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts an ISO datetime string to local datetime-local input format (YYYY-MM-DDTHH:mm)
 * This is needed for datetime-local inputs which expect local time, not UTC
 * @param iso ISO datetime string (e.g., "2024-12-01T14:00:00Z")
 * @returns Local datetime string for datetime-local input (e.g., "2024-12-01T09:00" for EST)
 */
export function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Converts a datetime-local input value to ISO format preserving local timezone
 * This prevents timezone conversion issues when storing datetime-local values
 * @param localValue Local datetime string from datetime-local input (e.g., "2024-12-01T09:00")
 * @returns ISO datetime string in local timezone (e.g., "2024-12-01T09:00:00-05:00")
 */
export function fromLocalInputValue(localValue: string): string {
  if (!localValue) return '';
  // Create date from local value (interpreted as local time)
  const d = new Date(localValue);
  // Return ISO string which includes timezone offset
  return d.toISOString();
}

/**
 * Formats a date to consistent display format: "Tue, Sep 30, 2:00 PM"
 * @param date Date string or Date object
 * @returns Formatted date string (e.g., "Tue, Sep 30, 2:00 PM")
 */
export function formatEventDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Checks if an event is in the past based on its datetime
 * @param datetime Event datetime string or null
 * @returns True if event is in the past, false otherwise
 */
export function isEventInPast(datetime: string | null): boolean {
  if (!datetime) return false;
  return new Date(datetime) < new Date();
}

/**
 * Checks if an event has been completed based on its end datetime or start datetime
 * An event is considered completed only after its end time has passed.
 * If no end time is specified, falls back to checking the start datetime.
 * @param datetime Event start datetime string or null
 * @param endDatetime Event end datetime string or null
 * @returns True if event has completed, false otherwise
 */
export function isEventCompleted(datetime: string | null, endDatetime?: string | null): boolean {
  // If there's an end datetime, use that to determine completion
  if (endDatetime) {
    return new Date(endDatetime) < new Date();
  }
  // Otherwise fall back to start datetime
  return isEventInPast(datetime);
}
