import * as React from 'react';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
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

  // Format date for display
  const formatDateDisplay = (date: Date | undefined) => {
    if (!date) return 'Select date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className={cn(
              'flex-1 justify-start text-left font-normal h-10',
              !date && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {formatDateDisplay(date)}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={handleDateChange} autoFocus />
        </PopoverContent>
      </Popover>

      <Input
        type="time"
        value={time}
        onChange={(e) => handleTimeChange(e.target.value)}
        className="w-32 h-10 text-sm"
      />
    </div>
  );
}
