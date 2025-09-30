import { Drawer, DrawerContent } from '@/components/ui/drawer';

export interface SortOption {
  value: string;
  label: string;
}

interface SortDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: SortOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
}

export function SortDrawer({
  open,
  onOpenChange,
  options,
  selectedValue,
  onSelect,
}: SortDrawerProps) {
  const handleSelect = (value: string) => {
    onSelect(value);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="p-0">
        <div className="py-4 px-4">
          {options.map((option, index) => (
            <button
              key={option.value}
              className={`w-full text-center py-4 text-base font-semibold ${
                index < options.length - 1 ? 'border-b border-border' : ''
              } ${
                selectedValue === option.value
                  ? 'bg-primary/10 text-primary rounded-lg'
                  : 'hover:bg-muted'
              }`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))}
          <div className="border-t border-border">
            <button
              className="w-full text-center py-4 text-base font-semibold text-destructive hover:bg-muted"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
