import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: number;
}

interface MobileTabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (id: string) => void;
  className?: string;
}

export const MobileTabBar: React.FC<MobileTabBarProps> = ({ tabs, activeTab, onChange, className = '' }) => {
  return (
    <div className={`flex overflow-x-auto hide-scrollbar bg-slate-50 p-2 rounded-2xl gap-2 ${className}`}>
      {tabs.map(tab => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
              isActive 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
            }`}
          >
            {Icon && <Icon size={18} />}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                isActive ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
