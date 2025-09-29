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
