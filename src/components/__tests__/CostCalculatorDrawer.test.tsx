/* eslint-disable @typescript-eslint/no-explicit-any */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CostCalculatorDrawer } from '../CostCalculatorDrawer';

// Mock services
vi.mock('@/services', () => ({
  eventService: {
    saveCostBreakdown: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/lib/errorHandler', () => ({
  errorHandler: {
    handle: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

import { eventService } from '@/services';
import { errorHandler } from '@/lib/errorHandler';

const mockSaveCostBreakdown = vi.mocked(eventService.saveCostBreakdown);
const mockErrorHandler = vi.mocked(errorHandler);

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  eventId: 'event-123',
  participantCount: 4,
  onSave: vi.fn(),
};

describe('CostCalculatorDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with one empty line item row', () => {
    render(<CostCalculatorDrawer {...defaultProps} />);

    expect(screen.getByText('Cost Breakdown')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Court rental')).toBeInTheDocument();
    expect(screen.getByText('Add Item')).toBeInTheDocument();
  });

  it('shows zero total and per-person cost initially', () => {
    render(<CostCalculatorDrawer {...defaultProps} />);

    const allZeros = screen.getAllByText('¥0.00');
    expect(allZeros).toHaveLength(2); // total and per-person
    expect(screen.getByText(/4 participants/)).toBeInTheDocument();
  });

  it('pre-populates from existing breakdown', () => {
    const existingBreakdown = {
      items: [
        { label: 'Court rental', quantity: 1, cost: 200 },
        { label: 'Shuttlecocks', quantity: 3, cost: 30 },
      ],
      participant_count: 4,
      cost_per_person: 72.5,
    };

    render(<CostCalculatorDrawer {...defaultProps} existingBreakdown={existingBreakdown} />);

    expect(screen.getByDisplayValue('Court rental')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Shuttlecocks')).toBeInTheDocument();
    expect(screen.getByDisplayValue('200')).toBeInTheDocument();
    expect(screen.getByDisplayValue('30')).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toBeInTheDocument();
  });

  it('adds a new line item when Add Item is clicked', async () => {
    const user = userEvent.setup();
    render(<CostCalculatorDrawer {...defaultProps} />);

    // Start with 1 item row (1 remove button)
    const removeButtons = screen.getAllByRole('button', { name: '' });
    const initialXButtons = removeButtons.filter(
      (btn) => btn.querySelector('svg') && btn.className.includes('hover:text-destructive')
    );
    const initialCount = initialXButtons.length;

    await user.click(screen.getByText('Add Item'));

    const updatedRemoveButtons = screen.getAllByRole('button', { name: '' });
    const newXButtons = updatedRemoveButtons.filter(
      (btn) => btn.querySelector('svg') && btn.className.includes('hover:text-destructive')
    );
    expect(newXButtons.length).toBe(initialCount + 1);
  });

  it('computes total and per-person cost live', async () => {
    const user = userEvent.setup();
    render(<CostCalculatorDrawer {...defaultProps} />);

    const labelInput = screen.getByPlaceholderText('e.g. Court rental');
    const costInput = screen.getByPlaceholderText('0.00');

    await user.type(labelInput, 'Court');
    await user.type(costInput, '100');

    // Total should be 100, per person 100/4 = 25
    expect(screen.getByText('¥100.00')).toBeInTheDocument();
    expect(screen.getByText('¥25.00')).toBeInTheDocument();
  });

  it('calls saveCostBreakdown on save with valid items', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CostCalculatorDrawer {...defaultProps} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText('e.g. Court rental'), 'Court');
    await user.type(screen.getByPlaceholderText('0.00'), '200');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveCostBreakdown).toHaveBeenCalledWith(
      'event-123',
      [{ label: 'Court', quantity: 1, cost: 200 }],
      4
    );
    expect(mockErrorHandler.success).toHaveBeenCalledWith('Cost breakdown saved');
    expect(onSave).toHaveBeenCalled();
  });

  it('shows info message when saving with no valid items', async () => {
    const user = userEvent.setup();
    render(<CostCalculatorDrawer {...defaultProps} />);

    // Try to save without filling in anything
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveCostBreakdown).not.toHaveBeenCalled();
    expect(mockErrorHandler.info).toHaveBeenCalledWith(
      'Add at least one item with a label and cost'
    );
  });

  it('filters out items without label or cost when saving', async () => {
    const user = userEvent.setup();
    render(<CostCalculatorDrawer {...defaultProps} />);

    // Fill first item
    await user.type(screen.getByPlaceholderText('e.g. Court rental'), 'Court');
    await user.type(screen.getByPlaceholderText('0.00'), '200');

    // Add a second empty item (should be filtered out)
    await user.click(screen.getByText('Add Item'));

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockSaveCostBreakdown).toHaveBeenCalledWith(
      'event-123',
      [{ label: 'Court', quantity: 1, cost: 200 }],
      4
    );
  });

  it('closes drawer on cancel', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CostCalculatorDrawer {...defaultProps} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('handles save error gracefully', async () => {
    const user = userEvent.setup();
    mockSaveCostBreakdown.mockRejectedValueOnce(new Error('Network error'));

    render(<CostCalculatorDrawer {...defaultProps} />);

    await user.type(screen.getByPlaceholderText('e.g. Court rental'), 'Court');
    await user.type(screen.getByPlaceholderText('0.00'), '100');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(mockErrorHandler.handle).toHaveBeenCalled();
  });

  it('shows singular participant text for count of 1', () => {
    render(<CostCalculatorDrawer {...defaultProps} participantCount={1} />);

    expect(screen.getByText(/1 participant\)/)).toBeInTheDocument();
  });
});
