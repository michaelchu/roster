import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useFormValidation, useValidatedForm } from '../useFormValidation';

// Mock error handler
vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
  },
  throwIfSupabaseError: vi.fn((result) => {
    if (result.error) throw new Error(result.error.message);
    return result.data;
  }),
  requireData: vi.fn((data, operation) => {
    if (data === null || data === undefined) {
      throw new Error(`Failed to ${operation}`);
    }
    return data;
  }),
}));

import { errorHandler } from '@/lib/errorHandler';

const mockErrorHandler = vi.mocked(errorHandler);

describe('useFormValidation', () => {
  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email format'),
    age: z.number().min(18, 'Must be at least 18'),
  });

  type TestData = z.infer<typeof testSchema>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with empty errors', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      expect(result.current.errors).toEqual([]);
      expect(result.current.isValid).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return true and clear errors for valid data', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate({
          name: 'John',
          email: 'john@example.com',
          age: 25,
        });
      });

      expect(isValid!).toBe(true);
      expect(result.current.errors).toEqual([]);
      expect(result.current.isValid).toBe(true);
    });

    it('should return false and set errors for invalid data', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate({
          name: '',
          email: 'invalid',
          age: 15,
        });
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors).toHaveLength(3);
      expect(result.current.isValid).toBe(false);
    });

    it('should set correct error messages', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.validate({
          name: '',
          email: 'invalid',
          age: 15,
        });
      });

      const nameError = result.current.errors.find((e) => e.field === 'name');
      const emailError = result.current.errors.find((e) => e.field === 'email');
      const ageError = result.current.errors.find((e) => e.field === 'age');

      expect(nameError?.message).toBe('Name is required');
      expect(emailError?.message).toBe('Invalid email format');
      expect(ageError?.message).toBe('Must be at least 18');
    });

    it('should handle nested field paths', () => {
      const nestedSchema = z.object({
        user: z.object({
          profile: z.object({
            name: z.string().min(1, 'Name required'),
          }),
        }),
      });

      const { result } = renderHook(() => useFormValidation(nestedSchema));

      act(() => {
        result.current.validate({
          user: {
            profile: {
              name: '',
            },
          },
        });
      });

      expect(result.current.errors[0].field).toBe('user.profile.name');
    });

    it('should call errorHandler for non-Zod errors', () => {
      // Create a schema that throws a non-Zod error
      const brokenSchema = {
        parse: () => {
          throw new Error('Unexpected error');
        },
      } as unknown as z.ZodSchema<TestData>;

      const { result } = renderHook(() => useFormValidation(brokenSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validate({
          name: 'test',
          email: 'test@test.com',
          age: 20,
        });
      });

      expect(isValid!).toBe(false);
      expect(mockErrorHandler.handle).toHaveBeenCalled();
    });
  });

  describe('validateField', () => {
    it('should return true for valid field value', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateField('name', 'John');
      });

      expect(isValid!).toBe(true);
    });

    it('should return false and set error for invalid field value', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateField('email', 'invalid');
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].field).toBe('email');
    });

    it('should remove existing error for field when valid', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      // First, create an error
      act(() => {
        result.current.validateField('email', 'invalid');
      });

      expect(result.current.errors).toHaveLength(1);

      // Then fix it
      act(() => {
        result.current.validateField('email', 'valid@example.com');
      });

      expect(result.current.errors).toHaveLength(0);
    });

    it('should replace existing error for same field', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.validateField('email', 'invalid1');
      });

      act(() => {
        result.current.validateField('email', 'invalid2');
      });

      // Should still have only one error for email
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].field).toBe('email');
    });

    it('should return true for unknown field', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateField('unknownField' as keyof TestData, 'value');
      });

      expect(isValid!).toBe(true);
    });

    it('should preserve errors for other fields', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.validateField('name', '');
        result.current.validateField('email', 'invalid');
      });

      expect(result.current.errors).toHaveLength(2);

      act(() => {
        result.current.validateField('name', 'Valid Name');
      });

      // Email error should still exist
      expect(result.current.errors).toHaveLength(1);
      expect(result.current.errors[0].field).toBe('email');
    });
  });

  describe('clearErrors', () => {
    it('should clear all errors', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.validate({
          name: '',
          email: 'invalid',
          age: 10,
        });
      });

      expect(result.current.errors.length).toBeGreaterThan(0);

      act(() => {
        result.current.clearErrors();
      });

      expect(result.current.errors).toEqual([]);
      expect(result.current.isValid).toBe(true);
    });
  });

  describe('clearFieldError', () => {
    it('should clear error for specific field', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.validate({
          name: '',
          email: 'invalid',
          age: 10,
        });
      });

      const initialErrorCount = result.current.errors.length;

      act(() => {
        result.current.clearFieldError('name');
      });

      expect(result.current.errors.length).toBe(initialErrorCount - 1);
      expect(result.current.errors.find((e) => e.field === 'name')).toBeUndefined();
    });

    it('should do nothing if field has no error', () => {
      const { result } = renderHook(() => useFormValidation(testSchema));

      act(() => {
        result.current.validateField('name', '');
      });

      const errorCount = result.current.errors.length;

      act(() => {
        result.current.clearFieldError('email'); // email has no error
      });

      expect(result.current.errors.length).toBe(errorCount);
    });
  });

  // Note: getFieldError is a trivial array.find - tested implicitly through validateField tests
});

describe('useValidatedForm', () => {
  const testSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
  });

  const initialData = {
    name: '',
    email: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('should initialize with initial data', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      expect(result.current.data).toEqual(initialData);
      expect(result.current.errors).toEqual([]);
    });
  });

  describe('updateField', () => {
    it('should update field value and validate', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      act(() => {
        result.current.updateField('name', 'John');
      });

      expect(result.current.data.name).toBe('John');
    });

    it('should set error for invalid field value', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      act(() => {
        result.current.updateField('email', 'invalid');
      });

      expect(result.current.data.email).toBe('invalid');
      expect(result.current.getFieldError('email')).toBe('Invalid email');
    });
  });

  describe('validateAll', () => {
    it('should validate all fields and return true for valid data', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      act(() => {
        result.current.setData({
          name: 'John',
          email: 'john@example.com',
        });
      });

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid!).toBe(true);
    });

    it('should validate all fields and return false for invalid data', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      let isValid: boolean;
      act(() => {
        isValid = result.current.validateAll();
      });

      expect(isValid!).toBe(false);
      expect(result.current.errors.length).toBeGreaterThan(0);
    });
  });

  describe('reset', () => {
    it('should reset data to initial values and clear errors', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      // Modify data and create errors
      act(() => {
        result.current.updateField('name', 'John');
        result.current.updateField('email', 'invalid');
      });

      expect(result.current.data.name).toBe('John');
      expect(result.current.errors.length).toBeGreaterThan(0);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.data).toEqual(initialData);
      expect(result.current.errors).toEqual([]);
    });
  });

  describe('setData', () => {
    it('should update entire data object', () => {
      const { result } = renderHook(() => useValidatedForm(initialData, testSchema));

      act(() => {
        result.current.setData({
          name: 'Jane',
          email: 'jane@example.com',
        });
      });

      expect(result.current.data).toEqual({
        name: 'Jane',
        email: 'jane@example.com',
      });
    });
  });
});
