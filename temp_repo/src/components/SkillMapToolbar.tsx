import React from 'react';
import { SkillMapViewType } from './ProfileSkillMap';

interface SkillMapToolbarProps {
  activeView: SkillMapViewType;
  onViewChange: (view: SkillMapViewType) => void;
  isDarkMode: boolean;
  isComparing: boolean;
}

export const SkillMapToolbar: React.FC<SkillMapToolbarProps> = ({ 
  activeView, 
  onViewChange, 
  isDarkMode,
  isComparing
}) => {
  return (
    <div className={`p-6 border-b flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
      <div className="flex flex-col">
        <h2 className={`text-xl font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
          Skill Map<br className="hidden xl:block"/>conectado<br className="hidden xl:block"/>al perfil
        </h2>
      </div>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full xl:w-auto">
        {isComparing && (
          <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap ${
            isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
          }`}>
            Vista comparativa
          </span>
        )}
        
        <div className={`flex flex-wrap gap-1 p-1 rounded-full w-full sm:w-auto ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
          {(['conjuntos', 'matriz', 'radar'] as SkillMapViewType[]).map(view => (
            <button 
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                activeView === view 
                  ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-slate-900 shadow-sm') 
                  : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')
              }`}
            >
              {view}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
