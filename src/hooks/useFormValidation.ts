import { useState, useCallback } from 'react';
import { z } from 'zod';
import { errorHandler } from '@/lib/errorHandler';

export interface ValidationError {
  field: string;
  message: string;
}

export interface UseFormValidationResult<T> {
  errors: ValidationError[];
  isValid: boolean;
  validate: (data: T) => boolean;
  validateField: (field: keyof T, value: unknown) => boolean;
  clearErrors: () => void;
  clearFieldError: (field: keyof T) => void;
  getFieldError: (field: keyof T) => string | undefined;
}

export function useFormValidation<T>(
  schema: z.ZodSchema<T>
): UseFormValidationResult<T> {
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const validate = useCallback((data: T): boolean => {
    try {
      schema.parse(data);
      setErrors([]);
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationErrors: ValidationError[] = (error as any).errors.map((err: any) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        setErrors(validationErrors);
        return false;
      }

      errorHandler.handle(error, { action: 'formValidation' });
      return false;
    }
  }, [schema]);

  const validateField = useCallback((field: keyof T, value: unknown): boolean => {
    try {
      const fieldSchema = (schema as any).shape?.[field as string];
      if (!fieldSchema) {
        // If we can't find the field schema, assume it's valid
        return true;
      }

      fieldSchema.parse(value);

      // Remove any existing errors for this field
      setErrors(prev => prev.filter(error => error.field !== String(field)));
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError: ValidationError = {
          field: String(field),
          message: (error as any).errors[0]?.message || 'Invalid value',
        };

        setErrors(prev => [
          ...prev.filter(error => error.field !== String(field)),
          fieldError,
        ]);
        return false;
      }

      return true; // Don't show errors for unexpected validation failures
    }
  }, [schema]);

  const clearErrors = useCallback(() => {
    setErrors([]);
  }, []);

  const clearFieldError = useCallback((field: keyof T) => {
    setErrors(prev => prev.filter(error => error.field !== String(field)));
  }, []);

  const getFieldError = useCallback((field: keyof T): string | undefined => {
    const error = errors.find(error => error.field === String(field));
    return error?.message;
  }, [errors]);

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

// Convenience hook for common form patterns
export function useValidatedForm<T>(
  initialData: T,
  schema: z.ZodSchema<T>
) {
  const [data, setData] = useState<T>(initialData);
  const validation = useFormValidation(schema);

  const updateField = useCallback((field: keyof T, value: T[keyof T]) => {
    setData(prev => ({ ...prev, [field]: value }));
    validation.validateField(field, value);
  }, [validation]);

  const validateAll = useCallback(() => {
    return validation.validate(data);
  }, [data, validation]);

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