export type SkillCategory = 'arquitectura' | 'urbanismo' | 'paisaje' | 'comunitario' | 'tecnica' | 'soft';

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description?: string;
}

export interface UserSkill {
  id: string;
  level: 1 | 2 | 3;
}

export interface SkillMapUser {
  uid: string;
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  position: string;
  color: string;
  skills: string[];
  skillRatings: SkillRating[];
  career: string;
}

export type SkillRating = {
  name: string;
  type: SkillCategory;
  value: number;
};

export type UserProfile = {
  uid?: string;
  firstName: string;
  lastNamePaterno: string;
  lastNameMaterno: string;
  phone: string;
  emergencyPhone: string;
  email: string;
  studentId: string;
  brigadePeriod: string;
  brigade: string;
  career: string;
  estado?: string;
  status?: string;
  workStatus: string;
  role: "user" | "coordinator" | "admin";
  projectIds: string[];
  skills: string[];
  skillRatings: SkillRating[];
  records: any[];
};
