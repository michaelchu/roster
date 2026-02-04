import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DateTimeInput } from '../DateTimeInput';

describe('DateTimeInput', () => {
  describe('rendering', () => {
    it('renders with placeholder when no value', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      expect(screen.getByText('Select date')).toBeInTheDocument();
      expect(screen.getByText('Select time')).toBeInTheDocument();
    });

    it('renders formatted date when value provided', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      // Format: MM/dd/yyyy
      expect(screen.getByText('12/25/2024')).toBeInTheDocument();
    });

    it('renders time in 12-hour format when value provided', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      // Format: h:mm a (2:30 PM)
      expect(screen.getByText('2:30 PM')).toBeInTheDocument();
    });

    it('renders TBD when disabled', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} disabled />);

      expect(screen.getByText('TBD')).toBeInTheDocument();
      expect(screen.getByText('--:-- --')).toBeInTheDocument();
    });

    it('applies custom id to date trigger button', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} id="test-datetime" />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toHaveAttribute('id', 'test-datetime');
    });
  });

  describe('disabled state', () => {
    it('disables both buttons when disabled prop is true', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} disabled />);

      const buttons = screen.getAllByRole('button');
      expect(buttons[0]).toBeDisabled();
      expect(buttons[1]).toBeDisabled();
    });

    it('does not open popover when disabled', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} disabled />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);

      // Calendar should not appear
      expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    });
  });

  describe('popover interaction', () => {
    it('opens date popover on date button click', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]); // Date button

      // Calendar grid should appear
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('opens time popover on time button click', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

      // Hour/Minute/AM-PM labels should appear
      expect(screen.getByText('Hour')).toBeInTheDocument();
      expect(screen.getByText('Min')).toBeInTheDocument();
      expect(screen.getByText('AM/PM')).toBeInTheDocument();
    });

    it('shows hour buttons in time popover', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

      // Hour buttons (1-12)
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '12' })).toBeInTheDocument();
    });

    it('shows minute buttons in time popover', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

      // Minute buttons
      expect(screen.getByRole('button', { name: '00' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '30' })).toBeInTheDocument();
    });

    it('shows AM/PM buttons in time popover', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

      expect(screen.getByRole('button', { name: 'AM' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'PM' })).toBeInTheDocument();
    });
  });

  describe('time selection', () => {
    it('calls onChange when hour is selected', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

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

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

      // Click minute 45
      fireEvent.click(screen.getByRole('button', { name: '45' }));

      expect(onChange).toHaveBeenCalled();
      const newValue = onChange.mock.calls[0][0];
      expect(newValue).toContain('14:45');
    });

    it('calls onChange when AM/PM is toggled', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[1]); // Time button

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

      expect(screen.getByText('12/25/2024')).toBeInTheDocument();
      // Midnight should display as 12:00 AM
      expect(screen.getByText('12:00 AM')).toBeInTheDocument();
    });

    it('handles noon correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T12:00" onChange={onChange} />);

      expect(screen.getByText('12/25/2024')).toBeInTheDocument();
      // Noon should display as 12:00 PM
      expect(screen.getByText('12:00 PM')).toBeInTheDocument();
    });

    it('handles edge of AM correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T11:59" onChange={onChange} />);

      expect(screen.getByText('12/25/2024')).toBeInTheDocument();
      expect(screen.getByText('11:59 AM')).toBeInTheDocument();
    });

    it('handles edge of PM correctly', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T23:59" onChange={onChange} />);

      expect(screen.getByText('12/25/2024')).toBeInTheDocument();
      expect(screen.getByText('11:59 PM')).toBeInTheDocument();
    });
  });

  describe('date selection', () => {
    it('preserves time when date is changed', () => {
      const onChange = vi.fn();
      render(<DateTimeInput value="2024-12-25T14:30" onChange={onChange} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]); // Date button

      // Find and click a different date - find a button inside a gridcell
      const gridCells = screen.getAllByRole('gridcell');
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

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]); // Date button

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
