import React from 'react';
import { SkillMapUser, SkillCategory } from '../../types/skills';
import { PREDEFINED_SKILLS, SKILL_CATEGORIES } from '../../constants/skills';
import { motion } from 'motion/react';

interface SharedBarsProps {
  users: SkillMapUser[];
  activeCategories: SkillCategory[];
  isDarkMode: boolean;
}

export function SharedBars({ users, activeCategories, isDarkMode }: SharedBarsProps) {
  const sharedSkills = React.useMemo(() => {
    if (users.length === 0) return [];

    const skillCounts = new Map<string, { skillName: string; type: string; count: number; avgLevel: number }>();
    users.forEach(user => {
      user.skillRatings?.forEach(us => {
        if (activeCategories.includes(us.type as SkillCategory)) {
          if (!skillCounts.has(us.name)) {
            skillCounts.set(us.name, { skillName: us.name, type: us.type, count: 0, avgLevel: 0 });
          }
          const entry = skillCounts.get(us.name)!;
          entry.count++;
          entry.avgLevel += us.value;
        }
      });
    });

    return Array.from(skillCounts.values())
      .map(s => ({
        ...s,
        skill: { name: s.skillName, category: s.type },
        avgLevel: s.avgLevel / s.count,
        percentage: (s.count / users.length) * 100
      }))
      .sort((a, b) => b.count - a.count || b.avgLevel - a.avgLevel)
      .slice(0, 8);
  }, [users, activeCategories]);

  return (
    <div className={`rounded-2xl border p-6 flex flex-col transition-colors ${
      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>Skills más compartidas</h3>
        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
          isDarkMode ? 'bg-emerald-500/10 text-emerald-500' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
        }`}>
          {sharedSkills.filter(s => s.count === users.length).length} en común
        </span>
      </div>

      <div className="flex-1 space-y-4">
        {sharedSkills.length > 0 ? (
          sharedSkills.map((s, i) => {
            const cat = SKILL_CATEGORIES.find(c => c.id === s.skill.category);
            return (
              <div key={s.skillName} className="space-y-1.5">
                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest">
                  <span className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>{s.skill.name}</span>
                  <span className={isDarkMode ? 'text-gray-500' : 'text-slate-400'}>{s.count}/{users.length}</span>
                </div>
                <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100 shadow-inner'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${s.percentage}%` }}
                    transition={{ duration: 0.8, delay: i * 0.1 }}
                    className="h-full rounded-full shadow-sm"
                    style={{ backgroundColor: cat?.color || '#ccc' }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className={`flex-1 flex flex-col items-center justify-center space-y-2 ${isDarkMode ? 'text-gray-600' : 'text-slate-300'}`}>
            <p className="text-[10px] font-black uppercase tracking-widest">No hay habilidades compartidas para mostrar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
