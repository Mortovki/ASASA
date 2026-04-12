export type StageStatus = 'pending' | 'active' | 'completed' | 'blocked';

export interface Stage {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  order: number;
  startDate: string;
  endDate: string;
  status: StageStatus;
  leaderId: string | null;
  color: string;
  spTotal: number;
  spDone: number;
  sprintIds: string[];
  predecessors: string[];
  createdAt: string;
  updatedAt: string;
}

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

export const STAGE_PRESETS: Record<string, Partial<Stage>[]> = {
  'plan-manejo': [
    { name: 'Diagnóstico', color: '#f59e0b' },
    { name: 'Formulación', color: '#3b82f6' },
    { name: 'Consulta pública', color: '#8b5cf6' },
    { name: 'Implementación', color: '#10b981' },
    { name: 'Evaluación', color: '#6366f1' },
  ],
  'construccion': [
    { name: 'Planeación', color: '#f59e0b' },
    { name: 'Diseño', color: '#3b82f6' },
    { name: 'Construcción', color: '#ef4444' },
    { name: 'Entrega', color: '#10b981' },
  ],
  'generico': [
    { name: 'Inicio', color: '#f59e0b' },
    { name: 'Desarrollo', color: '#3b82f6' },
    { name: 'Cierre', color: '#10b981' },
  ],
};

export const STAGE_PRESET_LABELS: Record<string, string> = {
  'plan-manejo': 'Plan de Manejo',
  'construccion': 'Construcción',
  'generico': 'Genérico',
};

export const STAGE_COLORS = [
  '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#6366f1', '#ef4444', '#ec4899', '#06b6d4'
];
