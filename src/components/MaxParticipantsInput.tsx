import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus } from 'lucide-react';

interface MaxParticipantsInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  className?: string;
}

export function MaxParticipantsInput({
  value,
  onChange,
  min = 1,
  max = 999,
  label = 'Max Participants',
  className = '',
}: MaxParticipantsInputProps) {
  const [displayValue, setDisplayValue] = useState(value.toString());

  useEffect(() => {
    setDisplayValue(value.toString());
  }, [value]);

  const incrementValue = () => {
    const newValue = Math.min(value + 1, max);
    onChange(newValue);
    setDisplayValue(newValue.toString());
  };

  const decrementValue = () => {
    const newValue = Math.max(value - 1, min);
    onChange(newValue);
    setDisplayValue(newValue.toString());
  };

  const handleInputChange = (inputValue: string) => {
    setDisplayValue(inputValue);

    if (inputValue === '') {
      return;
    }

    const num = parseInt(inputValue);
    if (!isNaN(num) && num >= min && num <= max) {
      onChange(num);
    }
  };

  const handleInputBlur = (inputValue: string) => {
    const fallbackValue = Math.min(Math.max(value, min), max);
    if (inputValue.trim() === '') {
      onChange(fallbackValue);
      setDisplayValue(fallbackValue.toString());
      return;
    }
    const parsed = Number(inputValue);
    if (Number.isNaN(parsed)) {
      onChange(fallbackValue);
      setDisplayValue(fallbackValue.toString());
      return;
    }
    const clamped = Math.min(Math.max(parsed, min), max);
    onChange(clamped);
    setDisplayValue(clamped.toString());
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label htmlFor="max-participants-input" className="text-sm">
        {label}
      </Label>
      <div
        className="flex items-center w-fit"
        role="group"
        aria-labelledby="max-participants-input"
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0 rounded-l-md rounded-r-none border-r-0"
          onClick={decrementValue}
          aria-label={`Decrease ${label.toLowerCase()} to ${Math.max(value - 1, min)}`}
          disabled={value <= min}
        >
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Input
          id="max-participants-input"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={(e) => handleInputBlur(e.target.value)}
          className="h-10 w-16 text-sm text-center rounded-none border-x-0 focus:border-x focus:z-10"
          aria-label={`${label} (${min} to ${max})`}
          min={min}
          max={max}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0 rounded-r-md rounded-l-none border-l-0"
          onClick={incrementValue}
          aria-label={`Increase ${label.toLowerCase()} to ${Math.min(value + 1, max)}`}
          disabled={value >= max}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
