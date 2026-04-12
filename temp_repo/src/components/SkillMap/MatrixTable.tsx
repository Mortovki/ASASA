import React from 'react';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { SKILL_CATEGORIES, PREDEFINED_SKILLS } from '../../constants/skills';

interface MatrixTableProps {
  users: SkillMapUser[];
  activeCategories: SkillCategory[];
  isDarkMode: boolean;
}

export function MatrixTable({ users, activeCategories, isDarkMode }: MatrixTableProps) {
  const categories = SKILL_CATEGORIES.filter(c => activeCategories.includes(c.id as SkillCategory));

  const userStats = React.useMemo(() => {
    return users.map(user => {
      const stats = categories.map(cat => {
        const catSkills = (user.skillRatings || []).filter(us => us.type === cat.id);
        const totalLevel = catSkills.reduce((sum, s) => sum + s.value, 0);
        return { catId: cat.id, count: catSkills.length, totalLevel };
      });
      const totalScore = stats.reduce((sum, s) => sum + s.totalLevel, 0);
      return { ...user, stats, totalScore };
    });
  }, [users, categories]);

  return (
    <div className={`rounded-2xl border p-6 flex flex-col overflow-hidden transition-colors ${
      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>Cobertura por categoría</h3>
      </div>

      <div className="flex-1 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr>
              <th className={`pb-4 text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Prestador</th>
              {categories.map(cat => (
                <th key={cat.id} className={`pb-4 text-[9px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                  {cat.name.substring(0, 5)}
                </th>
              ))}
              <th className={`pb-4 text-[9px] font-black uppercase tracking-widest text-center ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Total</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
            {userStats.map(user => (
              <tr key={user.uid} className={`group transition-colors ${isDarkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'}`}>
                <td className="py-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: user.color }} />
                  <span className={`text-[10px] font-black uppercase tracking-tight transition-colors ${
                    isDarkMode ? 'text-gray-300 group-hover:text-white' : 'text-slate-600 group-hover:text-slate-900'
                  }`}>
                    {user.firstName}
                  </span>
                </td>
                {user.stats.map(stat => (
                  <td key={stat.catId} className="py-3 text-center">
                    <div className="flex items-center justify-center">
                      <div 
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-white transition-all shadow-sm"
                        style={{ 
                          backgroundColor: stat.count > 0 ? SKILL_CATEGORIES.find(c => c.id === stat.catId)?.color : 'transparent',
                          opacity: stat.count > 0 ? 0.8 : 0.1,
                          border: stat.count > 0 ? 'none' : (isDarkMode ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)')
                        }}
                      >
                        {stat.count > 0 ? stat.count : ''}
                      </div>
                    </div>
                  </td>
                ))}
                <td className={`py-3 text-center text-[10px] font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {user.totalScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
