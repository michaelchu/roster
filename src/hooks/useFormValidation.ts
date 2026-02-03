import { useState, useCallback } from 'react';
import { z } from 'zod';
import { errorHandler } from '@/lib/errorHandler';

/** Validation error with field path and message */
export interface ValidationError {
  field: string;
  message: string;
}

/** Return type for useFormValidation hook */
export interface UseFormValidationResult<T> {
  errors: ValidationError[];
  isValid: boolean;
  validate: (data: T) => boolean;
  validateField: (field: keyof T, value: unknown) => boolean;
  clearErrors: () => void;
  clearFieldError: (field: keyof T) => void;
  getFieldError: (field: keyof T) => string | undefined;
}

/**
 * Hook for validating form data against a Zod schema.
 * Tracks validation errors and provides methods for full and field-level validation.
 * @param schema - Zod schema to validate against
 * @returns Validation state and methods
 */
export function useFormValidation<T>(schema: z.ZodSchema<T>): UseFormValidationResult<T> {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  /** Validates all data against the schema */
  const validate = useCallback(
    (data: T): boolean => {
      try {
        schema.parse(data);
        setErrors([]);
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationErrors: ValidationError[] = error.issues.map((err: z.ZodIssue) => ({
            field: err.path.join('.'),
            message: err.message,
          }));
          setErrors(validationErrors);
          return false;
        }

        errorHandler.handle(error, { action: 'formValidation' });
        return false;
      }
    },
    [schema]
  );

  /** Validates a single field value against its schema */
  const validateField = useCallback(
    (field: keyof T, value: unknown): boolean => {
      try {
        const fieldSchema = (schema as z.ZodObject<z.ZodRawShape>).shape?.[field as string];
        if (!fieldSchema) {
          return true;
        }

        (fieldSchema as z.ZodType).parse(value);

        setErrors((prev) => prev.filter((error) => error.field !== String(field)));
        return true;
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError: ValidationError = {
            field: String(field),
            message: (error as z.ZodError).issues[0]?.message || 'Invalid value',
          };

          setErrors((prev) => [
            ...prev.filter((error) => error.field !== String(field)),
            fieldError,
          ]);
          return false;
        }

        return true;
      }
    },
    [schema]
  );

  /** Clears all validation errors */
  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  /** Clears error for a specific field */
  const clearFieldError = useCallback((field: keyof T) => {
    setErrors((prev) => prev.filter((error) => error.field !== String(field)));
  }, []);

  /** Gets the error message for a specific field */
  const getFieldError = useCallback(
    (field: keyof T): string | undefined => {
      const error = errors.find((error) => error.field === String(field));
      return error?.message;
    },
    [errors]
  );

  return {
    errors,
    isValid: errors.length === 0,
    validate,
    validateField,
    clearErrors,
    clearFieldError,
    getFieldError,
  };
}

/**
 * Convenience hook combining form data state with validation.
 * Provides field update methods that automatically validate on change.
 * @param initialData - Initial form data
 * @param schema - Zod schema to validate against
 * @returns Form data state, update methods, and validation methods
 */
export function useValidatedForm<T>(initialData: T, schema: z.ZodSchema<T>) {
  const [data, setData] = useState<T>(initialData);
  const validation = useFormValidation(schema);

  /** Updates a field value and validates it */
  const updateField = useCallback(
    (field: keyof T, value: T[keyof T]) => {
      setData((prev) => ({ ...prev, [field]: value }));
      validation.validateField(field, value);
    },
    [validation]
  );

  /** Validates all form data */
  const validateAll = useCallback(() => {
    return validation.validate(data);
  }, [data, validation]);

  /** Resets form data to initial values and clears errors */
  const reset = useCallback(() => {
    setData(initialData);
    validation.clearErrors();
  }, [initialData, validation]);

  return {
    data,
    setData,
    updateField,
    validateAll,
    reset,
    ...validation,
  };
}
