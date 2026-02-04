import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimeInput } from '@/components/DateTimeInput';

interface TbdDateTimeFieldProps {
  id: string;
  label: string;
  value: string;
  isTbd: boolean;
  onValueChange: (value: string) => void;
  onTbdChange: (isTbd: boolean, previousValue: string) => void;
  type: 'datetime' | 'text';
  placeholder?: string;
}

/**
 * Reusable form field with TBD checkbox toggle.
 * Used for datetime and location fields that can be marked as "To Be Determined".
 */
export function TbdDateTimeField({
  id,
  label,
  value,
  isTbd,
  onValueChange,
  onTbdChange,
  type,
  placeholder,
}: TbdDateTimeFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id} className="text-sm">
          {label}
        </Label>
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox
            checked={isTbd}
            onCheckedChange={(checked) => {
              onTbdChange(checked === true, value);
            }}
          />
          TBD
        </label>
      </div>
      {type === 'datetime' ? (
        <DateTimeInput id={id} value={value} onChange={onValueChange} disabled={isTbd} />
      ) : (
        <Input
          id={id}
          type="text"
          value={isTbd ? '' : value}
          onChange={(e) => onValueChange(e.target.value)}
          className="h-10 text-sm"
          disabled={isTbd}
          placeholder={isTbd ? 'TBD' : placeholder}
        />
      )}
    </div>
  );
}
