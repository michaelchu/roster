import { describe, it, expect, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import { showFormErrors } from '../formUtils';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('formUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('showFormErrors', () => {
    it('should show toast for first error', () => {
      const errors = {
        fullName: { message: 'Full name is required', type: 'required' },
        email: { message: 'Email is required', type: 'required' },
      };

      showFormErrors(errors);

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Full name is required');
    });

    it('should not show toast when no errors', () => {
      showFormErrors({});

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should handle error without message', () => {
      const errors = {
        field: { type: 'required' },
      };

      showFormErrors(errors);

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should handle non-string message', () => {
      const errors = {
        field: { message: 123 as unknown as string, type: 'required' },
      };

      showFormErrors(errors);

      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
