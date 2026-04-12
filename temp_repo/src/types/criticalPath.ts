export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'working_on_it' | 'waiting_review' | 'stuck' | 'done';
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  storyPoints?: number;
  effort?: number;
  resources?: string[];
  phase?: string;
  x?: number;
  y?: number;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
  dependencies?: string[];
  isCritical?: boolean;
  earlyStart?: number;
  earlyFinish?: number;
  lateStart?: number;
  lateFinish?: number;
  slack?: number;
  duration?: number;
}

export interface CriticalPathResult {
  tasks: Task[];
  criticalPath: string[];
  projectDuration: number;
}

export interface DependencyGraph {
  [taskId: string]: string[];
}
