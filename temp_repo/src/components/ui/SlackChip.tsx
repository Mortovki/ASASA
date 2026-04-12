import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SlackChipProps {
  slack: number;
  isCritical: boolean;
  className?: string;
}

export const SlackChip: React.FC<SlackChipProps> = ({ slack, isCritical, className = '' }) => {
  if (isCritical || slack === 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-800 border border-red-200 font-bold text-[10px] uppercase tracking-widest ${className}`}>
        <AlertTriangle size={12} />
        Ruta Crítica
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] uppercase tracking-widest ${className}`}>
      <CheckCircle2 size={12} />
      Holgura: {slack}d
    </span>
  );
};
