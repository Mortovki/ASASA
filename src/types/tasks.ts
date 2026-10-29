export type TaskStatus = 'no_iniciado' | 'en_curso' | 'detenido' | 'listo';

export type TaskPriority = 'baja' | 'media' | 'alta';

export interface TaskAttachment {
  id: string;
  name: string;
  url: string;
  size?: string;
  type?: string;
  uploadedBy: string;
  uploadedByName?: string;
  uploadedAt: string;
}

export interface TaskComment {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  content: string;
  createdAt: string;
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
  groupId: string;             // e.g. 'pendientes', 'completado', or custom
  groupName: string;
  title: string;
  description?: string;
  assigneeIds: string[];        // UIDs of assigned students/coordinators
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;            // 'YYYY-MM-DD'
  startDate?: string;          // 'YYYY-MM-DD'
  endDate?: string;            // 'YYYY-MM-DD'
  attachments?: TaskAttachment[];
  commentsCount?: number;
  comments?: TaskComment[];
  googleTaskId?: string;       // Linked Google Task ID
  googleTaskListId?: string;   // Google Task List ID
  createdAt: string;
  createdBy: string;
  createdByName?: string;
  lastUpdated: string;
  updatedBy: string;
  linkedRecordId?: string;     // If linked to student logbook/hours record
  order?: number;
}

export interface GoogleTaskItem {
  id?: string;
  title: string;
  notes?: string;
  due?: string; // RFC 3339 timestamp
  status: 'needsAction' | 'completed';
  updated?: string;
}

export interface GoogleTaskList {
  id: string;
  title: string;
  updated?: string;
}
