import { useState, useCallback } from 'react';
import type { CustomField } from '@/types/app.types';

/**
 * Hook for managing custom form fields in event forms.
 * Provides add, update, and remove operations for custom fields.
 *
 * @param initialFields - Optional initial custom fields array
 * @returns Custom fields state and management functions
 */
export function useCustomFields(initialFields: CustomField[] = []) {
  const [customFields, setCustomFields] = useState<CustomField[]>(initialFields);

  const addCustomField = useCallback(() => {
    const newField: CustomField = {
      id: Date.now().toString(),
      label: '',
      type: 'text',
      required: false,
    };
    setCustomFields((prev) => [...prev, newField]);
  }, []);

  const updateCustomField = useCallback((id: string, updates: Partial<CustomField>) => {
    setCustomFields((prev) =>
      prev.map((field) => (field.id === id ? { ...field, ...updates } : field))
    );
  }, []);

  const removeCustomField = useCallback((id: string) => {
    setCustomFields((prev) => prev.filter((field) => field.id !== id));
  }, []);

  const resetCustomFields = useCallback((fields: CustomField[]) => {
    setCustomFields(fields);
  }, []);

  return {
    customFields,
    addCustomField,
    updateCustomField,
    removeCustomField,
    resetCustomFields,
  };
}
