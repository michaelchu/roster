import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormDrawer } from '@/components/FormDrawer';
import { DateTimeInput } from '@/components/DateTimeInput';
import { Copy } from 'lucide-react';
import { toLocalInputValue, fromLocalInputValue } from '@/lib/utils';

interface DuplicateEventDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  datetime: string | null;
  endDatetime: string | null;
  submitting: boolean;
  onConfirm: (datetime: string | null, endDatetime: string | null) => void;
}

export function DuplicateEventDrawer({
  open,
  onOpenChange,
  eventName,
  datetime,
  endDatetime,
  submitting,
  onConfirm,
}: DuplicateEventDrawerProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (open) {
      setStartDate(datetime ? toLocalInputValue(datetime) : '');
      setEndDate(endDatetime ? toLocalInputValue(endDatetime) : '');
    }
  }, [open, datetime, endDatetime]);

  const handleConfirm = () => {
    onConfirm(
      startDate ? fromLocalInputValue(startDate) : null,
      endDate ? fromLocalInputValue(endDate) : null
    );
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <Button
          className="w-full bg-primary hover:bg-primary/90 text-white"
          disabled={submitting}
          onClick={handleConfirm}
        >
          <Copy className="h-4 w-4 mr-2" />
          {submitting ? 'Duplicating...' : 'Duplicate Event'}
        </Button>
      }
    >
      <div className="space-y-4 pt-3 pb-3">
        <div>
          <h3 className="text-sm font-semibold">Duplicate Event</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{eventName}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dup-start" className="text-sm">
            Start Date & Time
          </Label>
          <DateTimeInput id="dup-start" value={startDate} onChange={setStartDate} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dup-end" className="text-sm">
            End Date & Time
          </Label>
          <DateTimeInput id="dup-end" value={endDate} onChange={setEndDate} />
        </div>
      </div>
    </FormDrawer>
  );
}
