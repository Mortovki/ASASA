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
}

export interface Sprint {
  id: string;
  projectId: string;
  name: string;
  startDate: string;
  endDate: string;
  stageId: string | null;
}
