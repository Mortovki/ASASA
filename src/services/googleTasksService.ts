import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../firebase';
import { GoogleTaskList, GoogleTaskItem, ProjectTask } from '../types/tasks';
import toast from 'react-hot-toast';

export type TaskList = GoogleTaskList;

export interface Task {
  id: string;
  title: string;
  notes?: string;
  status: 'needsAction' | 'completed';
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
}

const GOOGLE_TASKS_SCOPE = 'https://www.googleapis.com/auth/tasks';

let cachedTasksToken: string | null = null;

export const getGoogleTasksToken = async (interactive = true): Promise<string | null> => {
  if (cachedTasksToken) return cachedTasksToken;

  if (!interactive) return null;

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope(GOOGLE_TASKS_SCOPE);
    provider.setCustomParameters({ prompt: 'select_account' });

    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;

    if (token) {
      cachedTasksToken = token;
      return token;
    }
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      toast('Ventana de autorización cancelada', { icon: 'ℹ️' });
    } else if (error.code === 'auth/popup-blocked') {
      toast.error('La ventana emergente fue bloqueada por el navegador. Permite los popups para continuar.');
    } else {
      console.error('Error authenticating with Google Tasks:', error);
      toast.error(`Error al conectar con Google Tasks: ${error.message || 'Desconocido'}`);
    }
  }

  return null;
};

export const clearGoogleTasksToken = () => {
  cachedTasksToken = null;
};

/**
 * Fetch all task lists of the authenticated user
 */
export const fetchGoogleTaskLists = async (token: string): Promise<GoogleTaskList[]> => {
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    if (res.status === 401) {
      cachedTasksToken = null;
      throw new Error('Sesión de Google Tasks expirada');
    }
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al obtener listas de Google Tasks');
  }

  const data = await res.json();
  return data.items || [];
};

export const getTaskLists = fetchGoogleTaskLists;

/**
 * Fetch tasks for GoogleTasksView
 */
export const getTasks = async (token: string, listId: string): Promise<Task[]> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks?showCompleted=true&showHidden=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al obtener tareas de Google');
  }

  const data = await res.json();
  return (data.items || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    notes: item.notes,
    status: item.status,
    due: item.due,
    completed: item.completed,
    deleted: item.deleted,
    hidden: item.hidden
  }));
};

/**
 * Create task in Google Tasks list (used by GoogleTasksView)
 */
export const createTask = async (token: string, listId: string, taskData: Partial<Task>): Promise<Task> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al crear tarea en Google Tasks');
  }

  return await res.json();
};

/**
 * Update task in Google Tasks list (used by GoogleTasksView)
 */
export const updateTask = async (token: string, listId: string, taskId: string, updates: Partial<Task>): Promise<Task> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al actualizar tarea en Google Tasks');
  }

  return await res.json();
};

/**
 * Delete task in Google Tasks list (used by GoogleTasksView)
 */
export const deleteTask = async (token: string, listId: string, taskId: string): Promise<void> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al eliminar tarea de Google Tasks');
  }
};

/**
 * Get or create a dedicated task list for the project
 */
export const getOrCreateProjectTaskList = async (token: string, projectName: string): Promise<string> => {
  const lists = await fetchGoogleTaskLists(token);
  const targetTitle = `Servicio Social: ${projectName}`;
  const existing = lists.find(l => l.title.toLowerCase() === targetTitle.toLowerCase() || l.title.toLowerCase() === projectName.toLowerCase());

  if (existing) return existing.id;

  // Create new list
  const res = await fetch('https://tasks.googleapis.com/tasks/v1/users/@me/lists', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: targetTitle
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al crear lista en Google Tasks');
  }

  const created = await res.json();
  return created.id;
};

/**
 * Push a project task into Google Tasks
 */
export const syncTaskToGoogle = async (
  token: string,
  taskListId: string,
  task: ProjectTask
): Promise<string | null> => {
  const isDone = task.status === 'listo';
  const dueRFC3339 = task.dueDate ? new Date(`${task.dueDate}T12:00:00Z`).toISOString() : undefined;

  const body: GoogleTaskItem = {
    title: task.title,
    notes: `Proyecto: ${task.projectName}\nPrioridad: ${task.priority.toUpperCase()}\nEstado: ${task.status.toUpperCase()}\n${task.description || ''}`,
    status: isDone ? 'completed' : 'needsAction',
    due: dueRFC3339
  };

  if (task.googleTaskId) {
    // Update existing task
    const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks/${task.googleTaskId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      return task.googleTaskId;
    }
  }

  // Otherwise create new task
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al sincronizar con Google Tasks');
  }

  const created = await res.json();
  return created.id;
};

/**
 * Fetch tasks from Google Tasks list to pull completed statuses
 */
export const fetchTasksFromGoogle = async (
  token: string,
  taskListId: string
): Promise<GoogleTaskItem[]> => {
  const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks?showCompleted=true&showHidden=true`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Error al obtener tareas de Google');
  }

  const data = await res.json();
  return data.items || [];
};
