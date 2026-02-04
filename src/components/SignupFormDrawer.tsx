import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormDrawer } from '@/components/FormDrawer';
import { Zap, UserPlus, UserCheck, UserX } from 'lucide-react';
import type { CustomField } from '@/types/app.types';

export interface SignupFormData {
  name: string;
  email: string;
  phone: string;
  notes: string;
  responses: Record<string, string>;
}

interface SignupFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: SignupFormData;
  onFormChange: (updates: Partial<SignupFormData>) => void;
  customFields: CustomField[];
  isClaimingForOther: boolean;
  hasExistingRegistration: boolean;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onWithdraw: () => void;
  onQuickFill: () => void;
}

/**
 * Drawer component containing the event signup form.
 * Handles both new registrations and updates to existing registrations.
 */
export function SignupFormDrawer({
  open,
  onOpenChange,
  formData,
  onFormChange,
  customFields,
  isClaimingForOther,
  hasExistingRegistration,
  submitting,
  onSubmit,
  onWithdraw,
  onQuickFill,
}: SignupFormDrawerProps) {
  const handleResponseChange = (fieldId: string, value: string) => {
    onFormChange({
      responses: {
        ...formData.responses,
        [fieldId]: value,
      },
    });
  };

  return (
    <FormDrawer
      open={open}
      onOpenChange={onOpenChange}
      footer={
        <div className="flex gap-1.5 w-full">
          {hasExistingRegistration && !isClaimingForOther && (
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 h-10"
              onClick={onWithdraw}
              disabled={submitting}
            >
              <UserX className="h-4 w-4 mr-2" />
              Withdraw
            </Button>
          )}
          {!hasExistingRegistration && !isClaimingForOther && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-10"
              onClick={onQuickFill}
              disabled={submitting}
            >
              <Zap className="h-4 w-4 mr-2" />
              Quick Fill
            </Button>
          )}
          <Button
            type="submit"
            form="signup-form"
            size="sm"
            className="flex-1 bg-primary hover:bg-primary/90 text-white h-10"
            disabled={submitting}
          >
            {submitting ? (
              isClaimingForOther ? (
                'Claiming...'
              ) : hasExistingRegistration ? (
                'Updating...'
              ) : (
                'Joining...'
              )
            ) : isClaimingForOther ? (
              'Claim'
            ) : hasExistingRegistration ? (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                Update
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Join Event
              </>
            )}
          </Button>
        </div>
      }
    >
      <form id="signup-form" onSubmit={onSubmit} className="space-y-2 pt-3 pb-3">
        <Tabs defaultValue="registration" className="w-full">
          <TabsList className="w-full h-10">
            <TabsTrigger value="registration" className="flex-1">
              Registration
            </TabsTrigger>
            <TabsTrigger value="notes" className="flex-1">
              Notes
            </TabsTrigger>
          </TabsList>
          <TabsContent value="registration" className="space-y-2 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="signup-name" className="text-xs">
                Name {!isClaimingForOther && '*'}
              </Label>
              <Input
                id="signup-name"
                type="text"
                value={formData.name}
                onChange={(e) => onFormChange({ name: e.target.value })}
                required={!isClaimingForOther}
                autoComplete="off"
                className="h-9 text-sm"
                placeholder={isClaimingForOther ? 'Leave empty to claim under your name' : ''}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-email" className="text-xs">
                Email (optional)
              </Label>
              <Input
                id="signup-email"
                type="email"
                value={formData.email}
                onChange={(e) => onFormChange({ email: e.target.value })}
                autoComplete="off"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="signup-phone" className="text-xs">
                Phone (optional)
              </Label>
              <Input
                id="signup-phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => onFormChange({ phone: e.target.value })}
                autoComplete="off"
                className="h-9 text-sm"
              />
            </div>

            {customFields && customFields.length > 0 && (
              <div className="pt-2">
                <h3 className="text-sm font-medium">Additional Information</h3>
                {customFields.map((field) => (
                  <div key={field.id} className="space-y-1.5 mb-2">
                    <Label htmlFor={`signup-${field.id}`} className="text-xs">
                      {field.label} {field.required && '*'}
                    </Label>
                    {field.type === 'select' && field.options ? (
                      <Select
                        value={formData.responses[field.id || ''] || ''}
                        onValueChange={(value) => handleResponseChange(field.id || '', value)}
                      >
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue placeholder="Select..." />
                        </SelectTrigger>
                        <SelectContent>
                          {field.options.map((option: string) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id={`signup-${field.id}`}
                        type={field.type}
                        value={formData.responses[field.id || ''] || ''}
                        onChange={(e) => handleResponseChange(field.id || '', e.target.value)}
                        required={field.required}
                        autoComplete="off"
                        className="h-9 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="notes" className="space-y-2 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="signup-notes" className="text-xs">
                Notes (optional)
              </Label>
              <Textarea
                id="signup-notes"
                value={formData.notes}
                onChange={(e) => onFormChange({ notes: e.target.value })}
                placeholder="Any additional notes or comments..."
                className="min-h-[300px] text-sm"
              />
            </div>
          </TabsContent>
        </Tabs>
      </form>
    </FormDrawer>
  );
}
