import React from 'react';

interface TooltipItem {
  name?: string;
  value?: string | number;
  color?: string;
  unit?: string;
}

interface ChartTooltipCardProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  title?: string;
  formatter?: (val: any) => string;
  isDarkMode?: boolean;
}

export const ChartTooltipCard: React.FC<ChartTooltipCardProps> = ({
  active,
  payload,
  label,
  title,
  formatter,
  isDarkMode = false,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={`px-3 py-2.5 rounded-xl border shadow-xl backdrop-blur-md transition-all text-xs ${
        isDarkMode
          ? 'bg-slate-900/95 border-slate-700/80 text-white shadow-black/40'
          : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-200/60'
      }`}
      style={{ minWidth: 140 }}
    >
      {(title || label) && (
        <div className={`font-bold tracking-tight text-[11px] mb-1.5 pb-1 border-b ${
          isDarkMode ? 'border-white/10 text-slate-300' : 'border-slate-100 text-slate-700'
        }`}>
          {title || label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, idx) => {
          const itemColor = entry.color || entry.fill || '#6366f1';
          const itemName = entry.name || entry.dataKey || 'Valor';
          const rawVal = entry.value;
          const displayVal = formatter ? formatter(rawVal) : rawVal;

          return (
            <div key={`tooltip-item-${idx}`} className="flex items-center justify-between gap-3 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: itemColor }}
                />
                <span className={`font-medium ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {itemName}
                </span>
              </div>
              <span className={`font-bold tabular-nums ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {displayVal}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChartTooltipCard;
