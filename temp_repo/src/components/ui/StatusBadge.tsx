import React from 'react';
import { AlertCircle } from 'lucide-react';
import { KANBAN_COLUMNS } from '../../config/kanbanColumns';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', className = '' }) => {
  const getStatusConfig = (s: string) => {
    const config = KANBAN_COLUMNS.find(c => c.id === s.toLowerCase() || c.title.toLowerCase() === s.toLowerCase());
    if (config) {
      return { 
        color: `${config.bg} ${config.color.replace('bg-', 'text-')} ${config.color.replace('bg-', 'border-')}`, 
        icon: config.icon, 
        label: config.title 
      };
    }

    return { color: 'bg-gray-100 text-gray-800 border-gray-200', icon: AlertCircle, label: status };
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px] gap-1',
    md: 'px-3 py-1 text-xs gap-1.5',
    lg: 'px-4 py-1.5 text-sm gap-2'
  };

  return (
    <span className={`inline-flex items-center font-bold uppercase tracking-widest rounded-full border ${config.color} ${sizeClasses[size]} ${className}`}>
      <Icon size={size === 'sm' ? 12 : size === 'md' ? 14 : 16} />
      {config.label}
    </span>
  );
};
