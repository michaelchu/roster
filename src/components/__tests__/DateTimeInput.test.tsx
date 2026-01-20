import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateTimeInput } from '../DateTimeInput';

describe('DateTimeInput', () => {
  describe('rendering', () => {
    it('renders with placeholder when no value', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      expect(screen.getByText('MM/DD/YYYY hh:mm aa')).toBeInTheDocument();
    });

    it('renders formatted date when value provided', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      // Format: MM/dd/yyyy hh:mm aa
      expect(screen.getByText('12/25/2024 02:30 PM')).toBeInTheDocument();
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

    it('shows time selection buttons', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Hour buttons (1-12)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();

      // Minute buttons (00, 05, 10, etc.)
      expect(screen.getByRole('button', { name: '00' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();

      // AM/PM buttons
      expect(screen.getByRole('button', { name: 'AM' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'PM' })).toBeInTheDocument();
    });
  });

  describe('time selection', () => {
    it('calls onChange when hour is selected', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Click hour 3
      fireEvent.click(screen.getByRole('button', { name: '3' }));

      // Should call onChange with updated hour (3 PM = 15:00)
      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      expect(newValue).toContain('2024-12-25');
      expect(newValue).toContain('15:30');
    });

    it('calls onChange when minute is selected', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Click minute 45
      fireEvent.click(screen.getByRole('button', { name: '45' }));

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      expect(newValue).toContain('14:45');
    });

    it('calls onChange when AM/PM is toggled', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      fireEvent.click(screen.getByRole('button'));

      // Current is PM (14:30), click AM
      fireEvent.click(screen.getByRole('button', { name: 'AM' }));

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      expect(newValue).toContain('02:30');
    });
  });

  describe('date formatting', () => {
    it('handles midnight correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T00:00" onChange={onChange} />);

      // Midnight should display as 12:00 AM
      expect(screen.getByText('12/25/2024 12:00 AM')).toBeInTheDocument();
    });

    it('handles noon correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T12:00" onChange={onChange} />);

      // Noon should display as 12:00 PM
      expect(screen.getByText('12/25/2024 12:00 PM')).toBeInTheDocument();
    });

    it('handles edge of AM correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T11:59" onChange={onChange} />);

      expect(screen.getByText('12/25/2024 11:59 AM')).toBeInTheDocument();
    });

    it('handles edge of PM correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T23:59" onChange={onChange} />);

      expect(screen.getByText('12/25/2024 11:59 PM')).toBeInTheDocument();
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
  });
});
