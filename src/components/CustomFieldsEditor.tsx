import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import type { CustomField } from '@/types/app.types';

interface CustomFieldsEditorProps {
  customFields: CustomField[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<CustomField>) => void;
  onRemove: (id: string) => void;
}

/**
 * Reusable component for editing custom form fields in event creation/editing.
 * Supports text, email, phone, number, and dropdown field types.
 */
export function CustomFieldsEditor({
  customFields,
  onAdd,
  onUpdate,
  onRemove,
}: CustomFieldsEditorProps) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Custom Fields</h2>
        <Button type="button" size="sm" variant="outline" className="h-8 px-2" onClick={onAdd}>
          <Plus className="h-3 w-3 mr-1" />
          Add Field
        </Button>
      </div>

      {customFields.length > 0 && (
        <div className="space-y-3 mt-3">
          {customFields.map((field) => (
            <div key={field.id} className="p-3 bg-muted rounded border space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={field.label}
                  onChange={(e) => field.id && onUpdate(field.id, { label: e.target.value })}
                  placeholder="Field label"
                  className="flex-1 h-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => field.id && onRemove(field.id)}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Select
                  value={field.type}
                  onValueChange={(value) => {
                    if (!field.id) return;
                    const nextType = value as CustomField['type'];
                    onUpdate(field.id, {
                      type: nextType,
                      ...(nextType === 'select'
                        ? {
                            options:
                              field.options && field.options.length > 0 ? field.options : [''],
                          }
                        : field.type === 'select'
                          ? { options: field.options }
                          : {}),
                    });
                  }}
                >
                  <SelectTrigger className="flex-1 h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="tel">Phone</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="select">Dropdown</SelectItem>
                  </SelectContent>
                </Select>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={field.required}
                    onCheckedChange={(checked) =>
                      field.id &&
                      onUpdate(field.id, {
                        required: checked === true,
                      })
                    }
                  />
                  Required
                </label>
              </div>
              {field.type === 'select' && (
                <div className="space-y-2">
                  <Label className="text-xs">Options (one per line)</Label>
                  <Textarea
                    value={field.options?.join('\n') || ''}
                    onChange={(e) =>
                      field.id &&
                      onUpdate(field.id, {
                        options: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    placeholder="Option 1&#10;Option 2&#10;Option 3"
                    className="text-sm resize-none"
                    rows={3}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
