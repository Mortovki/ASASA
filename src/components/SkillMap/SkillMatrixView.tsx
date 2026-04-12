import React from 'react';
import { SkillComparison } from '../../utils/skillAnalysis';
import { SKILL_CATEGORIES } from '../../constants/skills';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface SkillMatrixViewProps {
  comparisons: SkillComparison[];
  hasReference: boolean;
  isDarkMode: boolean;
}

export const SkillMatrixView: React.FC<SkillMatrixViewProps> = ({ comparisons, hasReference, isDarkMode }) => {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'bajo': return isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600';
      case 'medio': return isDarkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-50 text-amber-600';
      case 'alto': return isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600';
      default: return isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-50 text-slate-400';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className={`border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
              <th className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Habilidad</th>
              <th className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Categoría</th>
              <th className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Nivel Usuario</th>
              {hasReference && (
                <>
                  <th className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Referencia</th>
                  <th className={`py-4 px-4 text-[10px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Gap</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {comparisons.map((item, idx) => {
              const cat = SKILL_CATEGORIES.find(c => c.id === item.category);
              return (
                <tr key={`${item.name}-${idx}`} className={`group transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50/50'}`}>
                  <td className="py-4 px-4">
                    <div className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{item.name}</div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color }} />
                      <span className={`text-[10px] font-black uppercase tracking-tight ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        {cat?.name || item.category}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col items-center gap-1.5">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${getLevelColor(item.level)}`}>
                        {item.userValue}% — {item.level}
                      </div>
                      <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${item.userValue}%`,
                            backgroundColor: cat?.color || '#6366f1'
                          }}
                        />
                      </div>
                    </div>
                  </td>
                  {hasReference && (
                    <>
                      <td className="py-4 px-4 text-center">
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                          {item.referenceValue}%
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-center gap-1.5">
                          {item.gap > 0 ? (
                            <TrendingUp size={14} className="text-emerald-500" />
                          ) : item.gap < 0 ? (
                            <TrendingDown size={14} className="text-red-500" />
                          ) : (
                            <Minus size={14} className="text-slate-400" />
                          )}
                          <span className={`text-xs font-black ${
                            item.gap > 0 ? 'text-emerald-500' : item.gap < 0 ? 'text-red-500' : 'text-slate-400'
                          }`}>
                            {item.gap > 0 ? `+${item.gap}` : item.gap}%
                          </span>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
