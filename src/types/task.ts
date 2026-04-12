export type TaskStatus = 'pending_approval' | 'todo' | 'working_on_it' | 'waiting_review' | 'stuck' | 'done' | 'rejected';
export type TaskType = 'feature' | 'bug' | 'quality' | 'security' | 'operations';

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: 1 | 2 | 3 | 4 | 5;
  effort?: number;
  resources?: string[];
  type: TaskType;
  assignedTo?: string;
  startDate?: string;
  endDate?: string;
  phase?: string;
  x?: number;
  y?: number;
  color?: string;
  stageId?: string | null;
  epic?: string;
  estimatedSP?: number;
  categoryId?: string;
  createdAt: string;
  createdBy: string;
  deletedAt?: string | null;
  deletedBy?: string | null;
  lastMovedFrom?: string;
  lastMovedAt?: string;
  lastMovedBy?: string;
  dependencies?: string[];
  isCritical?: boolean;
  slack?: number;
  earlyStart?: number;
  earlyFinish?: number;
  lateStart?: number;
  lateFinish?: number;
  duration?: number;
  completedAt?: string;
}

export type ActivityType = 'status_change' | 'field_update' | 'comment_added' | 'task_deleted' | 'task_restored';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  field?: string;
  oldValue?: any;
  newValue?: any;
  authorUid: string;
  authorName: string;
  createdAt: string;
}

export interface Note {
  id: string;
  content: string;
  authorUid: string;
  authorName: string;
  tag?: string;
  createdAt: string;
  editedAt?: string;
}

export interface Notification {
  id: string;
  type: 'task_approved' | 'task_rejected';
  taskId: string;
  taskTitle: string;
  message: string;
  rejectionReason?: string | null;
  read: boolean;
  createdAt: string;
}
