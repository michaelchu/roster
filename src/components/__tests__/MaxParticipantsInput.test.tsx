import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaxParticipantsInput } from '../MaxParticipantsInput';

describe('MaxParticipantsInput', () => {
  describe('rendering', () => {
    it('renders with default label', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      expect(screen.getByText('Max Participants')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} label="Capacity" />);

      expect(screen.getByText('Capacity')).toBeInTheDocument();
    });

    it('displays current value in input', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={25} onChange={onChange} />);

      expect(screen.getByRole('textbox')).toHaveValue('25');
    });
  });

  describe('increment button', () => {
    it('increments value when clicked', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      const incrementButton = screen.getByLabelText(/increase/i);
      fireEvent.click(incrementButton);

      expect(onChange).toHaveBeenCalledWith(11);
    });

    it('is disabled at max value', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={100} onChange={onChange} max={100} />);

      const incrementButton = screen.getByLabelText(/increase/i);
      expect(incrementButton).toBeDisabled();
    });

    it('does not exceed max value', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={99} onChange={onChange} max={100} />);

      const incrementButton = screen.getByLabelText(/increase/i);
      fireEvent.click(incrementButton);

      expect(onChange).toHaveBeenCalledWith(100);
    });
  });

  describe('decrement button', () => {
    it('decrements value when clicked', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      const decrementButton = screen.getByLabelText(/decrease/i);
      fireEvent.click(decrementButton);

      expect(onChange).toHaveBeenCalledWith(9);
    });

    it('is disabled at min value', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={2} onChange={onChange} min={2} />);

      const decrementButton = screen.getByLabelText(/decrease/i);
      expect(decrementButton).toBeDisabled();
    });

    it('does not go below min value', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={3} onChange={onChange} min={2} />);

      const decrementButton = screen.getByLabelText(/decrease/i);
      fireEvent.click(decrementButton);

      expect(onChange).toHaveBeenCalledWith(2);
    });
  });

  describe('text input', () => {
    it('updates value on valid input', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '50' } });

      expect(onChange).toHaveBeenCalledWith(50);
    });

    it('does not call onChange for invalid input', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'abc' } });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange for value below min', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} min={5} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '3' } });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('does not call onChange for value above max', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} max={100} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '150' } });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('blur handling', () => {
    it('clamps value to min on blur if below min', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} min={5} />);

      const input = screen.getByRole('textbox');
      // First change to invalid value (doesn't trigger onChange)
      fireEvent.change(input, { target: { value: '1' } });
      // Then blur should clamp it
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('clamps value to max on blur if above max', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} max={50} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '100' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(50);
    });

    it('resets to previous value on empty blur', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: '' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(10);
    });

    it('resets to previous value on non-numeric blur', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'invalid' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledWith(10);
    });
  });

  describe('accessibility', () => {
    it('has proper aria labels', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} min={2} max={100} />);

      expect(screen.getByLabelText(/2 to 100/)).toBeInTheDocument();
      expect(screen.getByLabelText(/decrease/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/increase/i)).toBeInTheDocument();
    });

    it('uses role group for the container', () => {
      const onChange = vi.fn();
      render(<MaxParticipantsInput value={10} onChange={onChange} />);

      expect(screen.getByRole('group')).toBeInTheDocument();
    });
  });
});
