import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormDrawer } from '@/components/FormDrawer';
import { X, Plus } from 'lucide-react';
import { eventService, type CostBreakdown, type CostLineItem } from '@/services';
import { errorHandler } from '@/lib/errorHandler';

interface CostCalculatorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  participantCount: number;
  existingBreakdown?: CostBreakdown | null;
  onSave: () => void;
}

interface LineItemState {
  label: string;
  quantity: string;
  cost: string;
}

const emptyItem = (): LineItemState => ({ label: '', quantity: '1', cost: '' });

export function CostCalculatorDrawer({
  open,
  onOpenChange,
  eventId,
  participantCount,
  existingBreakdown,
  onSave,
}: CostCalculatorDrawerProps) {
  const [items, setItems] = useState<LineItemState[]>([emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (existingBreakdown?.items?.length) {
        setItems(
          existingBreakdown.items.map((item) => ({
            label: item.label,
            quantity: String(item.quantity),
            cost: String(item.cost),
          }))
        );
      } else {
        setItems([emptyItem()]);
      }
    }
  }, [open, existingBreakdown]);

  const updateItem = (index: number, field: keyof LineItemState, value: string) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length === 1 ? [emptyItem()] : prev.filter((_, i) => i !== index)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, emptyItem()]);
  };

  const total = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantity) || 0;
    const cost = parseFloat(item.cost) || 0;
    return sum + qty * cost;
  }, 0);

  const perPerson = participantCount > 0 ? total / participantCount : 0;

  const handleSave = async () => {
    const validItems: CostLineItem[] = items
      .filter((item) => item.label.trim() && parseFloat(item.cost) > 0)
      .map((item) => ({
        label: item.label.trim(),
        quantity: parseFloat(item.quantity) || 1,
        cost: parseFloat(item.cost) || 0,
      }));

    if (validItems.length === 0) {
      errorHandler.info('Add at least one item with a label and cost');
      return;
    }

    setSaving(true);
    try {
      await eventService.saveCostBreakdown(eventId, validItems, participantCount);
      errorHandler.success('Cost breakdown saved');
      onOpenChange(false);
      onSave();
    } catch (error) {
      errorHandler.handle(error, { action: 'save cost breakdown' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Per person ({participantCount} participant{participantCount !== 1 ? 's' : ''})
            </span>
            <span className="font-semibold">${perPerson.toFixed(2)}</span>
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-10"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 bg-primary hover:bg-primary/90 text-white h-10"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3 pt-3 pb-3">
        <h3 className="text-sm font-medium">Cost Breakdown</h3>

        {items.map((item, index) => (
          <div key={index} className="flex gap-2 items-end">
            <div className="flex-1 space-y-1">
              {index === 0 && <Label className="text-xs text-muted-foreground">Item</Label>}
              <Input
                placeholder="e.g. Court rental"
                value={item.label}
                onChange={(e) => updateItem(index, 'label', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="w-14 space-y-1">
              {index === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
              <Input
                type="number"
                min="1"
                value={item.quantity}
                onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                className="h-9 text-sm text-center"
              />
            </div>
            <div className="w-24 space-y-1">
              {index === 0 && <Label className="text-xs text-muted-foreground">Cost ($)</Label>}
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={item.cost}
                onChange={(e) => updateItem(index, 'cost', e.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => removeItem(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        <Button variant="outline" size="sm" className="w-full h-8 text-xs" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" />
          Add Item
        </Button>
      </div>
    </FormDrawer>
  );
}
