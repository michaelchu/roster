import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface DateTimeInputProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  className?: string;
}

/**
 * Custom DateTime input that displays time in 12-hour format
 * Converts between datetime-local format (24hr) and user-friendly 12hr display
 */
export function DateTimeInput({ value, onChange, id, className }: DateTimeInputProps) {
  // Parse the datetime-local value (YYYY-MM-DDTHH:mm)
  const parseDateTime = (datetimeLocal: string) => {
    if (!datetimeLocal) {
      return { date: '', hour: '12', minute: '00', period: 'PM' };
    }

    const [datePart, timePart] = datetimeLocal.split('T');
    const [hourStr, minuteStr] = (timePart || '12:00').split(':');
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr || '00';

    const period = hour >= 12 ? 'PM' : 'AM';
    if (hour === 0) hour = 12;
    else if (hour > 12) hour = hour - 12;

    return {
      date: datePart || '',
      hour: hour.toString(),
      minute,
      period,
    };
  };

  // Format back to datetime-local (YYYY-MM-DDTHH:mm)
  const formatDateTime = (date: string, hour: string, minute: string, period: string) => {
    if (!date) return '';

    let hour24 = parseInt(hour, 10);
    if (period === 'AM' && hour24 === 12) hour24 = 0;
    else if (period === 'PM' && hour24 !== 12) hour24 += 12;

    const hourStr = hour24.toString().padStart(2, '0');
    const minuteStr = minute.padStart(2, '0');

    return `${date}T${hourStr}:${minuteStr}`;
  };

  const { date, hour, minute, period } = parseDateTime(value);

  const handleDateChange = (newDate: string) => {
    onChange(formatDateTime(newDate, hour, minute, period));
  };

  const handleHourChange = (newHour: string) => {
    onChange(formatDateTime(date, newHour, minute, period));
  };

  const handleMinuteChange = (newMinute: string) => {
    onChange(formatDateTime(date, hour, newMinute, period));
  };

  const handlePeriodChange = (newPeriod: string) => {
    onChange(formatDateTime(date, hour, minute, newPeriod));
  };

  // Generate hour options (1-12)
  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  // Generate minute options (00, 15, 30, 45)
  const minutes = ['00', '15', '30', '45'];

  return (
    <div className={className}>
      {/* Date Input */}
      <Input
        id={id}
        type="date"
        value={date}
        onChange={(e) => handleDateChange(e.target.value)}
        className="h-10 text-sm mb-2"
      />

      {/* Time Inputs */}
      <div className="grid grid-cols-3 gap-2">
        <Select value={hour} onValueChange={handleHourChange}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Hour" />
          </SelectTrigger>
          <SelectContent>
            {hours.map((h) => (
              <SelectItem key={h} value={h}>
                {h}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={minute} onValueChange={handleMinuteChange}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Min" />
          </SelectTrigger>
          <SelectContent>
            {minutes.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AM">AM</SelectItem>
            <SelectItem value="PM">PM</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
