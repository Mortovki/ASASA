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
  'complejo-interdependiente': [
    { name: 'Fase 1: Diagnóstico y Factibilidad', color: '#d97706', description: 'Levantamiento topográfico LiDAR, mecánica de suelos, MIA y diagnóstico social.' },
    { name: 'Fase 2: Diseño Ejecutivo e Ingenierías', color: '#2563eb', description: 'Anteproyecto bioclimático, cálculo estructural, instalaciones MEP y presupuesto base.' },
    { name: 'Fase 3: Licencias, Permisos y Licitación', color: '#4f46e5', description: 'Licencia de Obra Mayor, trámites oficiales y licitación con contratistas.' },
    { name: 'Fase 4: Cimentación y Estructura Principal', color: '#e11d48', description: 'Excavación masiva, armado de zapatas, montaje de acero y colado de entrepisos.' },
    { name: 'Fase 5: Envolvente, Redes MEP y Acabados', color: '#059669', description: 'Fachada ventilada, redes hidrosanitarias, paneles solares y acabados de bajo COV.' },
    { name: 'Fase 6: Pruebas, Certificación y Entrega', color: '#7c3aed', description: 'Commissioning de sistemas, auditoría de sustentabilidad y entrega comunitaria.' },
  ],
  'plan-manejo': [
    { name: 'Diagnóstico', color: '#f59e0b', description: 'Levantamiento inicial y recopilación de antecedentes.' },
    { name: 'Formulación', color: '#3b82f6', description: 'Propuesta técnica y estructuración del plan.' },
    { name: 'Consulta pública', color: '#8b5cf6', description: 'Validación comunitaria e institucional.' },
    { name: 'Implementación', color: '#10b981', description: 'Ejecución operativa de las acciones prioritarias.' },
    { name: 'Evaluación', color: '#6366f1', description: 'Medición de indicadores y seguimiento.' },
  ],
  'construccion': [
    { name: 'Planeación', color: '#f59e0b', description: 'Definición de alcances, recursos y cronograma base.' },
    { name: 'Diseño', color: '#3b82f6', description: 'Desarrollo de proyecto ejecutivo y memorias técnicas.' },
    { name: 'Construcción', color: '#ef4444', description: 'Ejecución en campo de obra civil e instalaciones.' },
    { name: 'Entrega', color: '#10b981', description: 'Cierre, pruebas finales y acta de recepción.' },
  ],
  'generico': [
    { name: 'Inicio', color: '#f59e0b', description: 'Kickoff y definición de metas iniciales.' },
    { name: 'Desarrollo', color: '#3b82f6', description: 'Desarrollo continuo de entregables.' },
    { name: 'Cierre', color: '#10b981', description: 'Revisión final y conclusiones.' },
  ],
};

export const STAGE_PRESET_LABELS: Record<string, string> = {
  'complejo-interdependiente': '6 Fases Interdependientes (CPM)',
  'plan-manejo': 'Plan de Manejo',
  'construccion': 'Construcción',
  'generico': 'Genérico',
};

export const STAGE_COLORS = [
  '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981', '#6366f1', '#ef4444', '#ec4899', '#06b6d4'
];
