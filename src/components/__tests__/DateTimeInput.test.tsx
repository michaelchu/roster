import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateTimeInput } from '../DateTimeInput';

describe('DateTimeInput', () => {
  describe('rendering', () => {
    it('renders with placeholder when no value', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      expect(screen.getByText('Select date')).toBeInTheDocument();
    });

    it('renders formatted date when value provided', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      // Format: PPP (e.g., "December 25th, 2024")
      expect(screen.getByText('December 25th, 2024')).toBeInTheDocument();
    });

    it('renders time in time input when value provided', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const timeInput = screen.getByDisplayValue('14:30');
      expect(timeInput).toBeInTheDocument();
      expect(timeInput).toHaveAttribute('type', 'time');
    });

    it('renders TBD when disabled', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} disabled />);

      expect(screen.getByText('TBD')).toBeInTheDocument();
    });

    it('applies custom id to trigger button', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} id="test-datetime" />);

      expect(screen.getByRole('button')).toHaveAttribute('id', 'test-datetime');
    });
  });

  describe('disabled state', () => {
    it('disables the trigger button when disabled prop is true', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} disabled />);

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('disables the time input when disabled prop is true', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} disabled />);

      const timeInput = document.querySelector('input[type="time"]');
      expect(timeInput).toBeDisabled();
    });

    it('does not open popover when disabled', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} disabled />);

      fireEvent.click(screen.getByRole('button'));

      // Calendar should not appear
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('popover interaction', () => {
    it('opens popover on button click', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Calendar grid should appear
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  describe('time input interaction', () => {
    it('calls onChange when time is changed', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const timeInput = screen.getByDisplayValue('14:30');
      fireEvent.change(timeInput, { target: { value: '09:15' } });

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      expect(newValue).toContain('2024-12-25');
      expect(newValue).toContain('09:15');
    });

    it('uses current date when time is changed without date', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      // When no date is set, time input is empty
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
      fireEvent.change(timeInput, { target: { value: '09:15' } });

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      // Should use current date with the new time
      expect(newValue).toContain('09:15');
    });
  });

  describe('date formatting', () => {
    it('handles midnight correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T00:00" onChange={onChange} />);

      expect(screen.getByText('December 25th, 2024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('00:00')).toBeInTheDocument();
    });

    it('handles noon correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T12:00" onChange={onChange} />);

      expect(screen.getByText('December 25th, 2024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('12:00')).toBeInTheDocument();
    });

    it('handles edge of AM correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T11:59" onChange={onChange} />);

      expect(screen.getByText('December 25th, 2024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('11:59')).toBeInTheDocument();
    });

    it('handles edge of PM correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T23:59" onChange={onChange} />);

      expect(screen.getByText('December 25th, 2024')).toBeInTheDocument();
      expect(screen.getByDisplayValue('23:59')).toBeInTheDocument();
    });
  });

  describe('date selection', () => {
    it('preserves time when date is changed', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Find and click a different date - find a button inside a gridcell
      // The calendar shows dates as buttons within gridcells
      const gridCells = screen.getAllByRole('gridcell');
      // Find a day that is not the 25th (current date)
      const differentDay = gridCells.find((cell) => {
        const button = cell.querySelector('button');
        return button && button.textContent === '15';
      });

      if (differentDay) {
        const button = differentDay.querySelector('button');
        if (button) {
          fireEvent.click(button);
        }
      }

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      // Time should be preserved
      expect(newValue).toContain('14:30');
    });

    it('sets default time of 12:00 when selecting date without existing time', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Find and click a date
      const gridCells = screen.getAllByRole('gridcell');
      const aDay = gridCells.find((cell) => {
        const button = cell.querySelector('button');
        return button && button.textContent === '15';
      });

      if (aDay) {
        const button = aDay.querySelector('button');
        if (button) {
          fireEvent.click(button);
        }
      }

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      // Default time should be 12:00
      expect(newValue).toContain('12:00');
    });
  });
});
