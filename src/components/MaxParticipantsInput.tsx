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
    if (inputValue === '' || isNaN(parseInt(inputValue))) {
      // Use current value as fallback, then clamp to min/max
      const fallback = Math.max(min, Math.min(max, value));
      onChange(fallback);
      setDisplayValue(fallback.toString());
    } else {
      const num = parseInt(inputValue);
      if (num < min) {
        onChange(min);
        setDisplayValue(min.toString());
      } else if (num > max) {
        onChange(max);
        setDisplayValue(max.toString());
      }
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="text-sm">{label}</Label>
      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0"
          onClick={decrementValue}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={displayValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onBlur={(e) => handleInputBlur(e.target.value)}
          className="h-10 text-sm text-center"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-10 p-0"
          onClick={incrementValue}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
