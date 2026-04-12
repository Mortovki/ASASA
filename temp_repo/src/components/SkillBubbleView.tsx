import React from 'react';
import { SKILL_CATEGORIES } from '../constants/skills';
import { SkillCategory } from '../types/skills';

interface SkillBubbleViewProps {
  skills: Array<{
    name: string;
    type: SkillCategory;
    value: number;
    owner: 'user' | 'reference' | 'shared';
  }>;
  isDarkMode: boolean;
  isComparing: boolean;
}

export const SkillBubbleView: React.FC<SkillBubbleViewProps> = ({ skills, isDarkMode, isComparing }) => {
  return (
    <div className="flex-1 flex flex-col">
      <div className={`flex-1 min-h-[420px] rounded-[2rem] relative overflow-hidden flex items-center justify-center ${isDarkMode ? 'bg-[#2A2A2A]' : 'bg-[#4A4A4A]'}`}>
        {skills.length === 0 ? (
          <p className="text-center font-bold text-white/50 px-8 text-lg">
            Agrega habilidades para visualizar el mapa
          </p>
        ) : (
          <>
            {/* User Bubble */}
            <div className={`absolute w-[210px] h-[210px] rounded-full flex items-center justify-center text-center p-4 text-[13px] font-bold leading-tight border-2 z-10 ${
              isDarkMode 
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' 
                : 'bg-blue-50/10 border-blue-200/30 text-blue-100'
            }`} style={{ left: isComparing ? '14%' : '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
              Perfil Actual
            </div>

            {/* Reference Bubble */}
            {isComparing && (
              <div className={`absolute w-[210px] h-[210px] rounded-full flex items-center justify-center text-center p-4 text-[13px] font-bold leading-tight border-2 z-10 ${
                isDarkMode 
                  ? 'bg-purple-500/10 border-purple-500/30 text-purple-400' 
                  : 'bg-purple-50/10 border-purple-200/30 text-purple-100'
              }`} style={{ right: '14%', top: '50%', transform: 'translate(50%, -50%)' }}>
                Referencia
              </div>
            )}

            {/* Skills Nodes */}
            {skills.map((skill, index) => {
              const positions = [
                { left: '23%', top: '31%' },
                { left: '18%', top: '58%' },
                { left: '41%', top: '43%' },
                { right: '21%', top: '35%' },
                { right: '18%', top: '58%' },
                { left: '35%', top: '20%' },
                { right: '35%', top: '20%' },
                { left: '45%', top: '65%' },
                { right: '45%', top: '65%' },
                { left: '50%', top: '10%' },
              ];
              
              const pos = positions[index % positions.length];
              const catColor = SKILL_CATEGORIES.find(c => c.id === skill.type)?.color || '#6366f1';
              
              return (
                <div 
                  key={`${skill.name}-${index}`}
                  className="absolute min-w-[68px] px-3 py-2 rounded-full text-white text-xs font-bold shadow-lg z-20"
                  style={{ ...pos, transform: `scale(${0.8 + (skill.value / 100) * 0.4})`, backgroundColor: catColor }}
                >
                  {skill.name}
                </div>
              );
            })}
          </>
        )}
      </div>
      <div className="mt-6 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
        {SKILL_CATEGORIES.map(cat => (
          <div key={cat.id} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div> {cat.name}
          </div>
        ))}
      </div>
    </div>
  );
};
