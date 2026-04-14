import React, { useState, useMemo } from 'react';
import { UserProfile, SkillRating } from '../types/skills';
import { SkillMapToolbar } from './SkillMapToolbar';
import { SkillBubbleView } from './SkillBubbleView';
import { SkillMatrixView } from './SkillMap/SkillMatrixView';
import { SkillRadarView } from './SkillMap/SkillRadarView';
import { calculateSkillComparison, calculateCategoryStats } from '../utils/skillAnalysis';
import { SKILL_CATEGORIES } from '../constants/skills';
import { motion, AnimatePresence } from 'motion/react';

interface ProfileSkillMapProps {
  currentUser?: Partial<UserProfile>;
  skillRatings?: SkillRating[];
  referenceProfile?: UserProfile;
  isDarkMode: boolean;
}

export type SkillMapViewType = 'conjuntos' | 'matriz' | 'radar';

export const ProfileSkillMap: React.FC<ProfileSkillMapProps> = ({ 
  currentUser, 
  skillRatings: directSkillRatings,
  referenceProfile,
  isDarkMode 
}) => {
  const [activeView, setActiveView] = useState<SkillMapViewType>('conjuntos');

  const userSkillRatings = useMemo(() => 
    directSkillRatings || currentUser?.skillRatings || [],
    [directSkillRatings, currentUser?.skillRatings]
  );

  // Process data for all views
  const comparisons = useMemo(() => 
    calculateSkillComparison(userSkillRatings, referenceProfile?.skillRatings || []),
    [userSkillRatings, referenceProfile?.skillRatings]
  );

  const categoryStats = useMemo(() => 
    calculateCategoryStats(userSkillRatings, referenceProfile?.skillRatings || []),
    [userSkillRatings, referenceProfile?.skillRatings]
  );

  // Data for Bubble View (Conjuntos)
  const processedSkills = useMemo(() => {
    const refSkills = referenceProfile?.skillRatings || [];
    
    return comparisons.map(comp => {
      const isShared = userSkillRatings.some(s => s.name === comp.name) && refSkills.some(s => s.name === comp.name);
      const isUserOnly = userSkillRatings.some(s => s.name === comp.name) && !refSkills.some(s => s.name === comp.name);

      return {
        name: comp.name,
        type: comp.category,
        value: comp.userValue || comp.referenceValue,
        owner: isShared ? 'shared' as const : isUserOnly ? 'user' as const : 'reference' as const
      };
    });
  }, [comparisons, userSkillRatings, referenceProfile?.skillRatings]);

  return (
    <div className={`flex flex-col h-full rounded-[2rem] border overflow-hidden transition-all duration-300 ${
      isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200 shadow-xl'
    }`}>
      {/* Toolbar */}
      <SkillMapToolbar 
        activeView={activeView} 
        onViewChange={setActiveView}
        isDarkMode={isDarkMode}
        isComparing={!!referenceProfile}
      />

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col p-6">
        <AnimatePresence>
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex-1 flex flex-col min-h-0"
          >
            {activeView === 'conjuntos' && (
              <SkillBubbleView 
                skills={processedSkills} 
                isDarkMode={isDarkMode}
                isComparing={!!referenceProfile}
              />
            )}

            {activeView === 'matriz' && (
              <SkillMatrixView 
                comparisons={comparisons}
                hasReference={!!referenceProfile}
                isDarkMode={isDarkMode}
              />
            )}

            {activeView === 'radar' && (
              <SkillRadarView 
                stats={categoryStats}
                hasReference={!!referenceProfile}
                isDarkMode={isDarkMode}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Footer / Legend */}
      <div className={`px-8 py-4 border-t flex items-center justify-between ${
        isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/50 border-slate-100'
      }`}>
        <div className="flex items-center gap-4">
          <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
            Nodos conectados al perfil
          </span>
        </div>
        <div className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
          Actualización automática
        </div>
      </div>
    </div>
  );
};
