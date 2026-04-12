import { SkillRating, SkillCategory } from '../types/skills';
import { SKILL_CATEGORIES } from '../constants/skills';

export interface CategoryStats {
  id: SkillCategory;
  name: string;
  userValue: number;
  referenceValue: number;
  gap: number;
  color: string;
}

export interface SkillComparison {
  name: string;
  category: SkillCategory;
  userValue: number;
  referenceValue: number;
  gap: number;
  level: 'vacio' | 'bajo' | 'medio' | 'alto';
}

export const getSkillLevel = (value: number): 'vacio' | 'bajo' | 'medio' | 'alto' => {
  if (value === 0) return 'vacio';
  if (value <= 33) return 'bajo';
  if (value <= 66) return 'medio';
  return 'alto';
};

export const calculateSkillComparison = (
  userSkills: SkillRating[],
  referenceSkills: SkillRating[]
): SkillComparison[] => {
  const allSkillNames = Array.from(new Set([
    ...userSkills.map(s => s.name),
    ...referenceSkills.map(s => s.name)
  ]));

  return allSkillNames.map(name => {
    const userSkill = userSkills.find(s => s.name === name);
    const refSkill = referenceSkills.find(s => s.name === name);
    
    const userValue = userSkill?.value || 0;
    const referenceValue = refSkill?.value || 0;
    const category = (userSkill?.type || refSkill?.type || 'soft') as SkillCategory;

    return {
      name,
      category,
      userValue,
      referenceValue,
      gap: userValue - referenceValue,
      level: getSkillLevel(userValue)
    };
  }).sort((a, b) => b.userValue - a.userValue);
};

export const calculateCategoryStats = (
  userSkills: SkillRating[],
  referenceSkills: SkillRating[]
): CategoryStats[] => {
  return SKILL_CATEGORIES.map(cat => {
    const userCatSkills = userSkills.filter(s => s.type === cat.id);
    const refCatSkills = referenceSkills.filter(s => s.type === cat.id);

    const userAvg = userCatSkills.length > 0 
      ? userCatSkills.reduce((sum, s) => sum + s.value, 0) / userCatSkills.length 
      : 0;
      
    const refAvg = refCatSkills.length > 0 
      ? refCatSkills.reduce((sum, s) => sum + s.value, 0) / refCatSkills.length 
      : 0;

    return {
      id: cat.id as SkillCategory,
      name: cat.name,
      userValue: Math.round(userAvg),
      referenceValue: Math.round(refAvg),
      gap: Math.round(userAvg - refAvg),
      color: cat.color
    };
  });
};
