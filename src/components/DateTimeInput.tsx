import { CalendarIcon } from '@radix-ui/react-icons';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

/**
 * DateTime picker with calendar and time selector (12-hour format)
 * Converts between datetime-local format (YYYY-MM-DDTHH:mm) and Date object
 */
export function DateTimeInput({ value, onChange, id, className }: DateTimeInputProps) {
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

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Preserve existing time if available, otherwise set to current time
      if (selectedDate) {
        date.setHours(selectedDate.getHours());
        date.setMinutes(selectedDate.getMinutes());
      }
      onChange(formatDateTime(date));
    }
  };

  const handleTimeChange = (type: 'hour' | 'minute' | 'ampm', value: string) => {
    const currentDate = selectedDate || new Date();
    const newDate = new Date(currentDate);

    if (type === 'hour') {
      const hour = parseInt(value, 10);
      const currentHour = newDate.getHours();
      const isPM = currentHour >= 12;
      newDate.setHours(isPM ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour);
    } else if (type === 'minute') {
      newDate.setMinutes(parseInt(value, 10));
    } else if (type === 'ampm') {
      const hours = newDate.getHours();
      if (value === 'AM' && hours >= 12) {
        newDate.setHours(hours - 12);
      } else if (value === 'PM' && hours < 12) {
        newDate.setHours(hours + 12);
      }
    }

    onChange(formatDateTime(newDate));
  };

  return (
    <div className={className}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            id={id}
            className={cn(
              'w-full justify-start text-left font-normal',
              !selectedDate && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {selectedDate ? (
              format(selectedDate, 'MM/dd/yyyy hh:mm aa')
            ) : (
              <span>MM/DD/YYYY hh:mm aa</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <div className="sm:flex">
            <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} autoFocus />
            <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
              <ScrollArea className="w-64 sm:w-auto">
                <div className="flex sm:flex-col p-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1)
                    .reverse()
                    .map((hour) => (
                      <Button
                        key={hour}
                        size="icon"
                        variant={
                          selectedDate && selectedDate.getHours() % 12 === hour % 12
                            ? 'default'
                            : 'ghost'
                        }
                        className="sm:w-full shrink-0 aspect-square"
                        onClick={() => handleTimeChange('hour', hour.toString())}
                        type="button"
                      >
                        {hour}
                      </Button>
                    ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
              <ScrollArea className="w-64 sm:w-auto">
                <div className="flex sm:flex-col p-2">
                  {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                    <Button
                      key={minute}
                      size="icon"
                      variant={
                        selectedDate && selectedDate.getMinutes() === minute ? 'default' : 'ghost'
                      }
                      className="sm:w-full shrink-0 aspect-square"
                      onClick={() => handleTimeChange('minute', minute.toString())}
                      type="button"
                    >
                      {minute.toString().padStart(2, '0')}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="horizontal" className="sm:hidden" />
              </ScrollArea>
              <ScrollArea className="">
                <div className="flex sm:flex-col p-2">
                  {['AM', 'PM'].map((ampm) => (
                    <Button
                      key={ampm}
                      size="icon"
                      variant={
                        selectedDate &&
                        ((ampm === 'AM' && selectedDate.getHours() < 12) ||
                          (ampm === 'PM' && selectedDate.getHours() >= 12))
                          ? 'default'
                          : 'ghost'
                      }
                      className="sm:w-full shrink-0 aspect-square"
                      onClick={() => handleTimeChange('ampm', ampm)}
                      type="button"
                    >
                      {ampm}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
