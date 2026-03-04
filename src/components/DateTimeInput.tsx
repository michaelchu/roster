import * as React from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

/**
 * DateTime picker with calendar popover and time input
 * Converts between datetime-local format (YYYY-MM-DDTHH:mm) and Date object
 */
export function DateTimeInput({
  value,
  onChange,
  id,
  className,
  disabled,
  error,
}: DateTimeInputProps) {
  const [open, setOpen] = React.useState(false);

  // Parse datetime-local string to Date object
  const parseDateTime = (datetimeLocal: string): Date | undefined => {
    if (!datetimeLocal) return undefined;
    return new Date(datetimeLocal);
  };

  // Format Date back to datetime-local string (YYYY-MM-DDTHH:mm)
  const formatDateTime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  // Extract time string (HH:mm) from datetime-local value
  const getTimeValue = (datetimeLocal: string): string => {
    if (!datetimeLocal) return '';
    const date = parseDateTime(datetimeLocal);
    if (!date) return '';
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const selectedDate = parseDateTime(value);
  const timeValue = getTimeValue(value);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Preserve existing time if available, otherwise default to 12:00
      if (selectedDate) {
        date.setHours(selectedDate.getHours());
        date.setMinutes(selectedDate.getMinutes());
      } else {
        date.setHours(12);
        date.setMinutes(0);
      }
      onChange(formatDateTime(date));
      setOpen(false);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeString = e.target.value;
    if (!timeString) return;

    const [hours, minutes] = timeString.split(':').map(Number);
    const currentDate = selectedDate || new Date();
    const newDate = new Date(currentDate);
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    onChange(formatDateTime(newDate));
  };

  if (disabled) {
    return (
      <div className={cn('flex gap-2', className)}>
        <Button
          variant="outline"
          id={id}
          disabled
          className="h-10 flex-1 justify-between font-normal opacity-50 cursor-not-allowed"
        >
          <span className="text-muted-foreground">TBD</span>
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
        <Input
          type="time"
          disabled
          className="h-10 flex-1 bg-background opacity-50 cursor-not-allowed appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
        />
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className={cn(
              'h-10 flex-1 justify-between font-normal',
              !selectedDate && 'text-muted-foreground',
              error && 'border-destructive'
            )}
          >
            {selectedDate ? format(selectedDate, 'MM/dd/yyyy') : 'Select date'}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            captionLayout="dropdown"
            defaultMonth={selectedDate}
            onSelect={handleDateSelect}
          />
        </PopoverContent>
      </Popover>
      <Input
        type="time"
        value={timeValue}
        onChange={handleTimeChange}
        className={cn(
          'h-10 flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none',
          error && 'border-destructive'
        )}
      />
    </div>
  );
}
