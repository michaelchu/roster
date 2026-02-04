import * as React from 'react';
import { format } from 'date-fns';
import { ChevronDownIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * DateTime picker with calendar popover and 12-hour time picker
 * Converts between datetime-local format (YYYY-MM-DDTHH:mm) and Date object
 */
export function DateTimeInput({ value, onChange, id, className, disabled }: DateTimeInputProps) {
  const [dateOpen, setDateOpen] = React.useState(false);
  const [timeOpen, setTimeOpen] = React.useState(false);

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

  const selectedDate = parseDateTime(value);

  // Format time in 12-hour format
  const formatTime12Hour = (date: Date | undefined): string => {
    if (!date) return 'Select time';
    return format(date, 'h:mm a');
  };

  // Get current hour in 12-hour format (1-12)
  const getHour12 = (date: Date | undefined): number => {
    if (!date) return 12;
    const hour = date.getHours();
    if (hour === 0) return 12;
    if (hour > 12) return hour - 12;
    return hour;
  };

  // Get AM/PM
  const getAmPm = (date: Date | undefined): 'AM' | 'PM' => {
    if (!date) return 'AM';
    return date.getHours() >= 12 ? 'PM' : 'AM';
  };

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
      setDateOpen(false);
    }
  };

  const handleHourSelect = (hour12: number) => {
    const currentDate = selectedDate || new Date();
    const newDate = new Date(currentDate);
    const isPM = getAmPm(selectedDate) === 'PM';

    let hour24: number;
    if (hour12 === 12) {
      hour24 = isPM ? 12 : 0;
    } else {
      hour24 = isPM ? hour12 + 12 : hour12;
    }

    newDate.setHours(hour24);
    onChange(formatDateTime(newDate));
  };

  const handleMinuteSelect = (minute: number) => {
    const currentDate = selectedDate || new Date();
    const newDate = new Date(currentDate);
    newDate.setMinutes(minute);
    onChange(formatDateTime(newDate));
  };

  const handleAmPmSelect = (ampm: 'AM' | 'PM') => {
    const currentDate = selectedDate || new Date();
    const newDate = new Date(currentDate);
    const currentHour = newDate.getHours();
    const currentIsPM = currentHour >= 12;

    if (ampm === 'PM' && !currentIsPM) {
      newDate.setHours(currentHour + 12);
    } else if (ampm === 'AM' && currentIsPM) {
      newDate.setHours(currentHour - 12);
    }

    onChange(formatDateTime(newDate));
  };

  const hours = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

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
        <Button
          variant="outline"
          disabled
          className="h-10 flex-1 justify-between font-normal opacity-50 cursor-not-allowed"
        >
          <span className="text-muted-foreground">--:-- --</span>
          <ChevronDownIcon className="h-4 w-4 opacity-50" />
        </Button>
      </div>
    );
  }

  return (
    <div className={cn('flex gap-2', className)}>
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className={cn(
              'h-10 flex-1 justify-between font-normal',
              !selectedDate && 'text-muted-foreground'
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
      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-10 flex-1 justify-between font-normal',
              !selectedDate && 'text-muted-foreground'
            )}
          >
            {formatTime12Hour(selectedDate)}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="flex gap-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground text-center">Hour</span>
              <ScrollArea className="h-48">
                <div className="flex flex-col gap-1">
                  {hours.map((hour) => (
                    <Button
                      key={hour}
                      variant={getHour12(selectedDate) === hour ? 'default' : 'ghost'}
                      size="sm"
                      className="w-10"
                      onClick={() => handleHourSelect(hour)}
                    >
                      {hour}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground text-center">Min</span>
              <ScrollArea className="h-48">
                <div className="flex flex-col gap-1">
                  {minutes.map((minute) => (
                    <Button
                      key={minute}
                      variant={selectedDate?.getMinutes() === minute ? 'default' : 'ghost'}
                      size="sm"
                      className="w-10"
                      onClick={() => handleMinuteSelect(minute)}
                    >
                      {String(minute).padStart(2, '0')}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground text-center">AM/PM</span>
              <div className="flex flex-col gap-1">
                <Button
                  variant={getAmPm(selectedDate) === 'AM' ? 'default' : 'ghost'}
                  size="sm"
                  className="w-12"
                  onClick={() => handleAmPmSelect('AM')}
                >
                  AM
                </Button>
                <Button
                  variant={getAmPm(selectedDate) === 'PM' ? 'default' : 'ghost'}
                  size="sm"
                  className="w-12"
                  onClick={() => handleAmPmSelect('PM')}
                >
                  PM
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
