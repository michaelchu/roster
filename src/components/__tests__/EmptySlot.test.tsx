import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { EmptySlot } from '../ParticipantListItem';

describe('EmptySlot', () => {
  it('renders "Available slot" text with slot number', () => {
    render(<EmptySlot slotNumber={3} canClaimSpot={false} onClaim={vi.fn()} />);
    expect(screen.getByText('3.')).toBeInTheDocument();
    expect(screen.getByText('Available slot')).toBeInTheDocument();
  });

  it('shows Claim button when canClaimSpot is true', () => {
    render(<EmptySlot slotNumber={1} canClaimSpot={true} onClaim={vi.fn()} />);
    expect(screen.getByRole('button', { name: /claim/i })).toBeInTheDocument();
  });

  it('hides Claim button when canClaimSpot is false', () => {
    render(<EmptySlot slotNumber={1} canClaimSpot={false} onClaim={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /claim/i })).not.toBeInTheDocument();
  });

  it('calls onClaim when Claim button is clicked', async () => {
    const onClaim = vi.fn();
    render(<EmptySlot slotNumber={1} canClaimSpot={true} onClaim={onClaim} />);
    await userEvent.click(screen.getByRole('button', { name: /claim/i }));
    expect(onClaim).toHaveBeenCalledOnce();
  });
});
