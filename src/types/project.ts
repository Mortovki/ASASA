import { Stage } from './stage';

export interface Project {
  id: string;
  name: string;
  color: string;
  description?: string;
  startDate: string | null;
  endDate: string | null;
  stages: Stage[];
  currentStageIndex: number;
  createdAt: string;
  createdBy: string;
  isDeleted: boolean;
  deletedAt?: string | null;
}

export const DEFAULT_PROJECT_IS_DELETED = false;

export const createProjectModel = (data: Partial<Project> & { id: string; name: string }): Project => ({
  color: '#6366f1',
  description: '',
  startDate: null,
  endDate: null,
  stages: [],
  currentStageIndex: 0,
  createdAt: new Date().toISOString(),
  createdBy: 'user',
  deletedAt: null,
  ...data,
  isDeleted: data.isDeleted ?? DEFAULT_PROJECT_IS_DELETED,
});

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  stageId: string | null;
  goal?: string;
  description?: string;
  status?: 'planned' | 'active' | 'completed';
}

