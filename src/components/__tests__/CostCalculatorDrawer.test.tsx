import { render, screen } from '@testing-library/react';
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

    const allZeros = screen.getAllByText('$0.00');
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
    expect(screen.getByText('$100.00')).toBeInTheDocument();
    expect(screen.getByText('$25.00')).toBeInTheDocument();
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

  it('removes a specific item when multiple exist', async () => {
    const user = userEvent.setup();
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

    // Remove the first item
    const removeButtons = screen
      .getAllByRole('button', { name: '' })
      .filter((btn) => btn.className.includes('hover:text-destructive'));
    await user.click(removeButtons[0]);

    expect(screen.queryByDisplayValue('Court rental')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Shuttlecocks')).toBeInTheDocument();
  });

  it('resets to empty item when removing the last item', async () => {
    const user = userEvent.setup();
    render(<CostCalculatorDrawer {...defaultProps} />);

    // Type something into the single item
    await user.type(screen.getByPlaceholderText('e.g. Court rental'), 'Court');

    // Remove it — should reset to an empty item, not leave zero rows
    const removeButton = screen
      .getAllByRole('button', { name: '' })
      .filter((btn) => btn.className.includes('hover:text-destructive'))[0];
    await user.click(removeButton);

    // Should still have an input but it should be empty
    expect(screen.getByPlaceholderText('e.g. Court rental')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Court')).not.toBeInTheDocument();
  });

  it('multiplies quantity by cost in total', async () => {
    const user = userEvent.setup();
    render(<CostCalculatorDrawer {...defaultProps} participantCount={2} />);

    await user.type(screen.getByPlaceholderText('e.g. Court rental'), 'Balls');

    // Clear default quantity of 1, type 3
    const qtyInput = screen.getByDisplayValue('1');
    await user.clear(qtyInput);
    await user.type(qtyInput, '3');

    await user.type(screen.getByPlaceholderText('0.00'), '50');

    // Total = 3 * 50 = 150, per person = 150 / 2 = 75
    expect(screen.getByText('$150.00')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
  });

  it('closes drawer after successful save', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<CostCalculatorDrawer {...defaultProps} onOpenChange={onOpenChange} />);

    await user.type(screen.getByPlaceholderText('e.g. Court rental'), 'Court');
    await user.type(screen.getByPlaceholderText('0.00'), '100');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows per-person as zero when participant count is 0', () => {
    render(<CostCalculatorDrawer {...defaultProps} participantCount={0} />);

    const allZeros = screen.getAllByText('$0.00');
    expect(allZeros).toHaveLength(2);
    expect(screen.getByText(/0 participants/)).toBeInTheDocument();
  });
});
