export type NotificationType = 
  | 'task_assigned' 
  | 'task_approved'
  | 'task_rejected'
  | 'approval_pending'
  | 'task_status_changed'
  | 'task_stuck'
  | 'note_added'
  | 'critical_path_updated'
  | 'task_near_deadline'
  | 'task_overdue'
  | 'task_deleted'
  | 'task_restored'
  | 'project_deleted'
  | 'comment' 
  | 'deadline' 
  | 'sprint_start' 
  | 'sprint_end' 
  | 'overdue' 
  | 'mention' 
  | 'system';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  message: string;
  projectId: string;
  projectName: string;
  taskId?: string | null;
  taskTitle?: string | null;
  sprintId?: string;
  createdAt: any; // Timestamp or Date
  readAt?: any; // Timestamp or Date
  read: boolean;
  actorId?: string;
  actorName?: string;
  actorColor?: string;
  triggeredBy?: string;
  triggeredByName?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  actionUrl?: string | null;
}
