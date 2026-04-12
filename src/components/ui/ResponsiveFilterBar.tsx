import React, { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { BottomSheet } from './BottomSheet';

interface FilterOption {
  id: string;
  label: string;
}

interface ResponsiveFilterBarProps {
  options: FilterOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  title?: string;
}

export const ResponsiveFilterBar: React.FC<ResponsiveFilterBarProps> = ({ options, selectedIds, onChange, title = "Filtros" }) => {
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const toggleOption = (id: string) => {
    if ((selectedIds || []).includes(id)) {
      onChange(selectedIds.filter(v => v !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const clearFilters = () => {
    onChange([]);
  };

  return (
    <>
      {/* Desktop View */}
      <div className="hidden md:flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest mr-2">
          <Filter size={16} />
          {title}
        </div>
        {options.map(opt => {
          const isSelected = (selectedIds || []).includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              className={`px-4 py-2 rounded-full text-xs font-bold transition-all border ${
                isSelected 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {(selectedIds || []).length > 0 && (
          <button
            onClick={clearFilters}
            className="ml-2 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Limpiar filtros"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Mobile/Tablet View */}
      <div className="md:hidden">
        <button
          onClick={() => setIsSheetOpen(true)}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
            (selectedIds || []).length > 0
              ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
              : 'bg-white border-slate-200 text-slate-700'
          } font-bold text-sm shadow-sm w-full justify-center`}
        >
          <Filter size={18} />
          {title} {(selectedIds || []).length > 0 && `(${(selectedIds || []).length})`}
        </button>

        <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)} title={title}>
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              {options.map(opt => {
                const isSelected = (selectedIds || []).includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleOption(opt.id)}
                    className={`flex items-center justify-between px-4 py-4 rounded-2xl border-2 transition-all ${
                      isSelected 
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700' 
                        : 'bg-slate-50 border-slate-100 text-slate-700 hover:border-slate-200'
                    }`}
                  >
                    <span className="font-bold">{opt.label}</span>
                    {isSelected && <div className="w-3 h-3 rounded-full bg-indigo-500" />}
                  </button>
                );
              })}
            </div>
            
            {(selectedIds || []).length > 0 && (
              <button
                onClick={() => { clearFilters(); setIsSheetOpen(false); }}
                className="w-full py-4 mt-4 text-red-600 font-bold rounded-2xl bg-red-50 border border-red-100"
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </BottomSheet>
      </div>
    </>
  );
};
