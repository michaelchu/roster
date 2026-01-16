-- Add payment tracking columns to participants table

-- Add payment_status column with check constraint
ALTER TABLE participants
ADD COLUMN payment_status TEXT DEFAULT 'pending' NOT NULL
CHECK (payment_status IN ('pending', 'paid', 'waived'));

-- Add timestamp for when payment was marked
ALTER TABLE participants
ADD COLUMN payment_marked_at TIMESTAMP WITH TIME ZONE;

-- Add optional payment notes
ALTER TABLE participants
ADD COLUMN payment_notes TEXT
CHECK (payment_notes IS NULL OR length(payment_notes) <= 500);

-- Add index for filtering by payment status
CREATE INDEX idx_participants_payment_status
ON participants(payment_status);

-- Add comment for documentation
COMMENT ON COLUMN participants.payment_status IS 'Payment status: pending (default), paid (payment received), waived (complimentary/free entry)';
COMMENT ON COLUMN participants.payment_marked_at IS 'Timestamp when payment status was last updated to paid or waived';
COMMENT ON COLUMN participants.payment_notes IS 'Optional notes about payment (e.g., payment method, transaction ID)';
