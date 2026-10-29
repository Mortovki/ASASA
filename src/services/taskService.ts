import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy, 
  getDocs,
  arrayUnion,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { ProjectTask, TaskGroup, TaskComment, TaskAttachment } from '../types/tasks';
import { nanoid } from 'nanoid';

export const DEFAULT_GROUPS: TaskGroup[] = [
  { id: 'pendientes', name: 'Pendientes', color: '#6366f1', order: 0 },
  { id: 'en_proceso', name: 'En Proceso', color: '#f59e0b', order: 1 },
  { id: 'completado', name: 'Completado', color: '#10b981', order: 2 }
];

/**
 * Subscribe to tasks for a specific project
 */
export const subscribeToProjectTasks = (
  projectId: string, 
  callback: (tasks: ProjectTask[]) => void
) => {
  const q = query(
    collection(db, 'tasks'),
    where('projectId', '==', projectId)
  );

  return onSnapshot(q, (snapshot) => {
    const tasks: ProjectTask[] = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as ProjectTask));
    // Sort client-side by order or createdAt
    tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    callback(tasks);
  }, (err) => {
    console.error('Error listening to project tasks:', err);
    handleFirestoreError(err, OperationType.LIST, `tasks?projectId=${projectId}`);
  });
};

/**
 * Subscribe to all tasks across all projects (for coordinators or global view)
 */
export const subscribeToAllTasks = (
  callback: (tasks: ProjectTask[]) => void
) => {
  const q = collection(db, 'tasks');

  return onSnapshot(q, (snapshot) => {
    const tasks: ProjectTask[] = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    } as ProjectTask));
    tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    callback(tasks);
  }, (err) => {
    console.error('Error listening to all tasks:', err);
    handleFirestoreError(err, OperationType.LIST, 'tasks');
  });
};

/**
 * Create a new task
 */
export const createTask = async (taskData: Omit<ProjectTask, 'id' | 'createdAt' | 'lastUpdated'>): Promise<string> => {
  const taskId = `task_${nanoid(10)}`;
  const now = new Date().toISOString();

  const newTask: ProjectTask = {
    ...taskData,
    id: taskId,
    createdAt: now,
    lastUpdated: now,
    attachments: taskData.attachments || [],
    comments: taskData.comments || []
  };

  try {
    await setDoc(doc(db, 'tasks', taskId), newTask);
    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Update task fields
 */
export const updateTask = async (taskId: string, updates: Partial<ProjectTask>): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', taskId), {
      ...updates,
      lastUpdated: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Delete a task
 */
export const deleteTask = async (taskId: string): Promise<void> => {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Add attachment to a task
 */
export const addTaskAttachment = async (taskId: string, attachment: TaskAttachment): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', taskId), {
      attachments: arrayUnion(attachment),
      lastUpdated: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Add comment to a task
 */
export const addTaskComment = async (taskId: string, comment: TaskComment): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', taskId), {
      comments: arrayUnion(comment),
      lastUpdated: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};
