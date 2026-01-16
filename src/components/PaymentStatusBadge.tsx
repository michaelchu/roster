import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, Gift } from 'lucide-react';

interface PaymentStatusBadgeProps {
  status: 'pending' | 'paid' | 'waived';
  size?: 'sm' | 'md' | 'lg';
}

export function PaymentStatusBadge({ status, size = 'md' }: PaymentStatusBadgeProps) {
  const config = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-gray-100 text-gray-700 border-gray-200',
    },
    paid: {
      label: 'Paid',
      icon: CheckCircle,
      className: 'bg-green-100 text-green-700 border-green-200',
    },
    waived: {
      label: 'Waived',
      icon: Gift,
      className: 'bg-blue-100 text-blue-700 border-blue-200',
    },
  };

  const { label, icon: Icon, className } = config[status];
  const iconSize = size === 'sm' ? 'w-2.5 h-2.5' : size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <Badge variant="outline" className={`${className} gap-1`}>
      <Icon className={iconSize} />
      <span>{label}</span>
    </Badge>
  );
}
