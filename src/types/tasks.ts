export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'blocked' | 'done';

// 0: Sin prioridad, 1: Mínima, 2: Baja, 3: Media, 4: Alta, 5: Urgente
export type TaskStarPriority = 0 | 1 | 2 | 3 | 4 | 5;
export type TaskPriority = TaskStarPriority;

// Mapeo retrocompatible para tareas previas
export type LegacyTaskStatus = 'no_iniciado' | 'en_curso' | 'detenido' | 'listo';
export type LegacyTaskPriority = 'baja' | 'media' | 'alta';

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size?: string;
  type?: string;
  uploadedBy: string;
  uploadedByName: string;
  uploadedAt: string;
  resourceId?: string; // Vínculo con repositorio general de Recursos
}

export interface TaskSubtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  createdAt: string;
}

export interface TaskAuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 
    | 'created' 
    | 'title_changed' 
    | 'status_changed' 
    | 'priority_changed' 
    | 'dates_changed' 
    | 'assignees_changed' 
    | 'stage_changed' 
    | 'sprint_changed' 
    | 'dependencies_changed' 
    | 'attachment_added' 
    | 'attachment_removed' 
    | 'subtask_toggled' 
    | 'blocked' 
    | 'reopened' 
    | 'deleted' 
    | 'restored';
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
}

export interface TaskGroup {
  id: string;
  name: string;
  color?: string;
  order: number;
}

export interface ProjectTask {
  id: string;
  projectId: string;
  projectName: string;
  version: number; // Control optimista de concurrencia atómica
  
  // Agrupadores estructurales
  groupId?: string;             // Compatibilidad legado
  groupName?: string;
  stageId?: string;             // ID de la etapa (fase o entregable)
  stageName?: string;           // "Sin etapa" si está vacío
  sprintId?: string;            // ID del sprint activo
  sprintName?: string;          // "Sin sprint" si está vacío
  
  // Datos principales
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskStarPriority;
  
  // Participantes
  leadAssigneeId?: string;      // Responsable principal
  leadAssigneeName?: string;    // Nombre visible del responsable
  leadAssigneeRole?: 'coordinador' | 'alumno'; // Rol del responsable
  assigneeIds: string[];        // Todos los participantes asignados
  
  // Fechas y programación
  dueDate?: string;             // Fecha límite comprometida (YYYY-MM-DD)
  startDate?: string;           // Inicio planificado cronograma (YYYY-MM-DD)
  endDate?: string;             // Fin planificado cronograma (YYYY-MM-DD)
  completedAt?: string;         // Fecha real de finalización
  
  // CPM y dependencias
  estimatedHours?: number;
  dependencies: string[];       // IDs de tareas predecesoras (Fin a Inicio)
  isMilestone?: boolean;        // Hito (duración 0)
  isCritical?: boolean;         // Calculado por motor CPM
  blockReason?: string;         // Motivo obligatorio si status === 'blocked'
  
  // Subtareas y recursos
  subtasks: TaskSubtask[];
  attachments: TaskAttachment[];
  commentsCount?: number;
  comments: TaskComment[];
  
  // Auditoría y borrado suave
  history: TaskAuditEntry[];
  isDeleted: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletedByName?: string;
  
  // Google Tasks sync opcional
  googleTaskId?: string;
  googleTaskListId?: string;
  
  // Campos de compatibilidad bidireccional con Sesión y colecciones previas
  assignedUsers?: string[];
  assignedTo?: string;
  assigneeName?: string;
  phase?: string;
  sessionStatus?: string;
  
  order?: number;
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  lastUpdated?: string;         // Compatibilidad
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
  linkedRecordId?: string;
}

export interface GoogleTaskItem {
  id?: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
  updated?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}

// Helpers de conversión y catálogo
export const TASK_STATUS_CONFIG: Record<TaskStatus, {
  label: string;
  bgLight: string;
  bgDark: string;
  textLight: string;
  textDark: string;
  borderLight: string;
  borderDark: string;
  badgeBg: string;
  badgeText: string;
}> = {
  todo: {
    label: 'Por hacer',
    bgLight: 'bg-slate-100',
    bgDark: 'dark:bg-slate-800',
    textLight: 'text-slate-700',
    textDark: 'dark:text-slate-300',
    borderLight: 'border-slate-300',
    borderDark: 'dark:border-slate-700',
    badgeBg: 'bg-slate-500',
    badgeText: 'text-white'
  },
  in_progress: {
    label: 'En curso',
    bgLight: 'bg-amber-100',
    bgDark: 'dark:bg-amber-950/40',
    textLight: 'text-amber-800',
    textDark: 'dark:text-amber-300',
    borderLight: 'border-amber-300',
    borderDark: 'dark:border-amber-800',
    badgeBg: 'bg-amber-500',
    badgeText: 'text-white'
  },
  in_review: {
    label: 'En revisión',
    bgLight: 'bg-blue-100',
    bgDark: 'dark:bg-blue-950/40',
    textLight: 'text-blue-800',
    textDark: 'dark:text-blue-300',
    borderLight: 'border-blue-300',
    borderDark: 'dark:border-blue-800',
    badgeBg: 'bg-blue-500',
    badgeText: 'text-white'
  },
  blocked: {
    label: 'Bloqueada',
    bgLight: 'bg-rose-100',
    bgDark: 'dark:bg-rose-950/40',
    textLight: 'text-rose-800',
    textDark: 'dark:text-rose-300',
    borderLight: 'border-rose-300',
    borderDark: 'dark:border-rose-800',
    badgeBg: 'bg-rose-500',
    badgeText: 'text-white'
  },
  done: {
    label: 'Finalizada',
    bgLight: 'bg-emerald-100',
    bgDark: 'dark:bg-emerald-950/40',
    textLight: 'text-emerald-800',
    textDark: 'dark:text-emerald-300',
    borderLight: 'border-emerald-300',
    borderDark: 'dark:border-emerald-800',
    badgeBg: 'bg-emerald-500',
    badgeText: 'text-white'
  }
};

export const TASK_PRIORITY_LABELS: Record<TaskStarPriority, string> = {
  0: 'Sin prioridad',
  1: 'Mínima',
  2: 'Baja',
  3: 'Media',
  4: 'Alta',
  5: 'Urgente'
};

export function mapLegacyStatus(status: any): TaskStatus {
  if (!status) return 'todo';
  const s = String(status).toLowerCase().trim();
  if (s === 'todo' || s === 'no_iniciado' || s === 'pendiente' || s === 'por_hacer') return 'todo';
  if (s === 'in_progress' || s === 'en_curso' || s === 'en_proceso' || s === 'working_on_it' || s === 'progreso') return 'in_progress';
  if (s === 'in_review' || s === 'en_revision' || s === 'revision' || s === 'waiting_review') return 'in_review';
  if (s === 'blocked' || s === 'detenido' || s === 'stuck' || s === 'bloqueada' || s === 'atascado') return 'blocked';
  if (s === 'done' || s === 'listo' || s === 'completado' || s === 'finalizada' || s === 'finalizado' || s === 'hecho') return 'done';
  return 'todo';
}

export function mapLegacyPriority(priority: any): TaskStarPriority {
  if (typeof priority === 'number' && priority >= 0 && priority <= 5) {
    return priority as TaskStarPriority;
  }
  const p = String(priority).toLowerCase().trim();
  if (p === 'baja') return 2;
  if (p === 'media') return 3;
  if (p === 'alta') return 4;
  if (p === 'urgente' || p === 'critica' || p === 'muy alta') return 5;
  if (p === 'minima') return 1;
  return 0;
}
