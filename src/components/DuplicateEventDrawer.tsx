import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormDrawer } from '@/components/FormDrawer';
import { Input } from '@/components/ui/input';
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
  onConfirm: (name: string, datetime: string | null, endDatetime: string | null) => void;
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
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (open) {
      setName(`${eventName} (Copy)`);
      setStartDate(datetime ? toLocalInputValue(datetime) : '');
      setEndDate(endDatetime ? toLocalInputValue(endDatetime) : '');
    }
  }, [open, eventName, datetime, endDatetime]);

  const handleConfirm = () => {
    onConfirm(
      name.trim(),
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
          className="w-full bg-primary hover:bg-primary/90 text-white disabled:opacity-50 disabled:pointer-events-none"
          disabled={submitting || !name.trim() || !!(startDate && endDate && endDate <= startDate)}
          onClick={handleConfirm}
        >
          <Copy className="h-4 w-4 mr-2" />
          {submitting ? 'Duplicating...' : 'Duplicate Event'}
        </Button>
      }
    >
      <div className="space-y-4 pt-3 pb-3">
        <div className="space-y-2">
          <Label htmlFor="dup-name" className="text-sm">
            Event Name
          </Label>
          <Input
            id="dup-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dup-start" className="text-sm">
            Start Date & Time
          </Label>
          <DateTimeInput
            id="dup-start"
            value={startDate}
            onChange={(value) => {
              setStartDate(value);
              if (value && (!endDate || value >= endDate)) setEndDate(value);
            }}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="dup-end" className="text-sm">
            End Date & Time
          </Label>
          <DateTimeInput
            id="dup-end"
            value={endDate}
            onChange={(value) => {
              setEndDate(value);
            }}
            error={!!(startDate && endDate && endDate <= startDate)}
          />
        </div>
      </div>
    </FormDrawer>
  );
}
