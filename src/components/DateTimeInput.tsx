import * as React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

/**
 * Custom DateTime input using shadcn Calendar and time input
 * Converts between datetime-local format (YYYY-MM-DDTHH:mm) and Date + time string
 */
export function DateTimeInput({ value, onChange, id, className }: DateTimeInputProps) {
  const [open, setOpen] = React.useState(false);

  // Parse the datetime-local value (YYYY-MM-DDTHH:mm)
  const parseDateTime = (datetimeLocal: string) => {
    if (!datetimeLocal) {
      return { date: undefined, time: '' };
    }

    const [datePart, timePart] = datetimeLocal.split('T');
    const date = datePart ? new Date(datePart + 'T00:00:00') : undefined;
    const time = timePart || '';

    return { date, time };
  };

  // Format back to datetime-local (YYYY-MM-DDTHH:mm)
  const formatDateTime = (date: Date | undefined, time: string) => {
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (!time) return dateStr + 'T00:00';

    return `${dateStr}T${time}`;
  };

  const { date, time } = parseDateTime(value);

  const handleDateChange = (newDate: Date | undefined) => {
    onChange(formatDateTime(newDate, time));
    setOpen(false);
  };

  const handleTimeChange = (newTime: string) => {
    onChange(formatDateTime(date, newTime));
  };

  return (
    <div className={cn('flex gap-4', className)}>
      <div className="flex flex-col gap-3">
        <Label htmlFor={id} className="px-1">
          Date
        </Label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" id={id} className="w-32 justify-between font-normal">
              {date ? date.toLocaleDateString() : 'Select date'}
              <ChevronDownIcon />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto overflow-hidden p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              captionLayout="dropdown"
              onSelect={(date) => {
                handleDateChange(date);
              }}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex flex-col gap-3">
        <Label htmlFor={`${id}-time`} className="px-1">
          Time
        </Label>
        <Input
          type="time"
          id={`${id}-time`}
          step="1"
          value={time}
          onChange={(e) => handleTimeChange(e.target.value)}
          className="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    </div>
  );
}
