import { toast } from 'sonner';
import type { FieldErrors, FieldValues } from 'react-hook-form';

/**
 * Display toast error for the first validation error.
 * Useful for mobile forms where inline errors may be less visible.
 */
export function showFormErrors<T extends FieldValues>(errors: FieldErrors<T>): void {
  const firstError = Object.values(errors)[0];
  if (firstError?.message && typeof firstError.message === 'string') {
    toast.error(firstError.message);
  }
}
