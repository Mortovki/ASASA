import { useState, useEffect, useMemo } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  writeBatch, 
  doc, 
  Timestamp, 
  getDoc,
  deleteDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  deleteField
} from 'firebase/firestore';
import { differenceInCalendarDays } from 'date-fns';
import { db, auth } from '../firebase';
import { Task, TaskStatus, ActivityLog, ActivityType } from '../types/task';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../firebase';
import { 
  notifyTaskStuck, 
  notifyTaskStatusChanged, 
  notifyTaskApproved, 
  notifyTaskRejected, 
  notifyApprovalPending, 
  notifyTaskAssigned,
  notifyTaskDeleted,
  notifyTaskRestored,
  getProjectAdmins,
  notifyTaskNearDeadline,
  notifyTaskOverdue 
} from '../services/notificationService';

import { dedupeById } from '../utils/dedupe';

export const useTasks = (projectId: string | null, userRole: string = 'user') => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const tasksRef = collection(db, 'projects', projectId, 'tasks');
    const rootTasksQuery = query(collection(db, 'tasks'), where('projectId', '==', projectId));

    let subTasksList: Task[] = [];
    let rootTasksList: Task[] = [];

    const recompute = () => {
      const mergedMap = new Map<string, Task>();
      subTasksList.forEach(t => mergedMap.set(t.id, t));
      rootTasksList.forEach(t => {
        const existing = mergedMap.get(t.id);
        if (existing) {
          mergedMap.set(t.id, {
            ...existing,
            ...t,
            assignedTo: (t as any).assignedTo || (t as any).leadAssigneeId || (t as any).assigneeIds?.[0] || existing.assignedTo
          });
        } else {
          mergedMap.set(t.id, {
            ...t,
            assignedTo: (t as any).assignedTo || (t as any).leadAssigneeId || (t as any).assigneeIds?.[0] || ''
          });
        }
      });

      const allActive = Array.from(mergedMap.values()).filter((task: any) => {
        if (task.isDeleted || task.deletedAt) return false;
        if (task.status === 'pending_approval') {
          return userRole === 'admin' || task.createdBy === auth.currentUser?.uid;
        }
        if (task.status === 'rejected') {
          return userRole === 'admin' || task.createdBy === auth.currentUser?.uid;
        }
        return true;
      });

      setTasks(dedupeById(allActive));
      setLoading(false);
    };

    const unsubscribeSub = onSnapshot(tasksRef, (snapshot) => {
      subTasksList = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id
      })) as Task[];
      recompute();
    }, (err) => {
      console.error('Error fetching tasks:', err);
      setError(err);
      setLoading(false);
      handleFirestoreError(err, OperationType.GET, `projects/${projectId}/tasks`);
    });

    const unsubscribeRoot = onSnapshot(rootTasksQuery, (snapshot) => {
      rootTasksList = snapshot.docs.map(d => ({
        ...d.data(),
        id: d.id
      })) as Task[];
      recompute();
    }, () => {});

    return () => {
      unsubscribeSub();
      unsubscribeRoot();
    };
  }, [projectId, userRole]);

  useEffect(() => {
    if (!tasks || tasks.length === 0 || !auth.currentUser) return;

    const checkDeadlines = async () => {
      const isAtLeastCoordinator = userRole === 'admin' || userRole === 'coordinator';
      
      for (const task of tasks) {
        if (task.status === 'done' || task.status === 'rejected' || !task.endDate || !task.assignedTo) continue;
        
        // Only trigger notifications if the current user is the assignee or an admin/coordinator
        if (task.assignedTo !== auth.currentUser?.uid && !isAtLeastCoordinator) continue;
        
        const daysLeft = differenceInCalendarDays(new Date(task.endDate), new Date());
        
        if (daysLeft < 0) {
          await notifyTaskOverdue(task.assignedTo, task);
        } else if (daysLeft <= 2) {
          await notifyTaskNearDeadline(task.assignedTo, task, daysLeft);
        }
      }
    };

    checkDeadlines();
  }, [tasks]);

  const tasksByStatus = useMemo(() => {
    const grouped: Record<TaskStatus, Task[]> = {
      pending_approval: [],
      todo: [],
      working_on_it: [],
      waiting_review: [],
      stuck: [],
      done: [],
      rejected: []
    };
    tasks.forEach(task => {
      if (grouped[task.status]) {
        grouped[task.status].push(task);
      }
    });
    return grouped;
  }, [tasks]);

  const logActivity = async (batch: any, taskId: string, activity: Omit<ActivityLog, 'id' | 'createdAt'>) => {
    const activityRef = doc(collection(db, 'projects', projectId!, 'tasks', taskId, 'activity'));
    
    // Sanitize undefined values for Firestore
    const sanitizedActivity = Object.fromEntries(
      Object.entries(activity).filter(([_, v]) => v !== undefined)
    );

    batch.set(activityRef, {
      ...sanitizedActivity,
      id: activityRef.id,
      createdAt: new Date().toISOString()
    });
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus, oldStatus: TaskStatus, rejectionReason?: string) => {
    if (!projectId || !auth.currentUser) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);

    const updates: any = {
      status: newStatus,
      lastMovedAt: new Date().toISOString(),
      lastMovedBy: auth.currentUser.uid,
      lastMovedFrom: oldStatus === undefined ? deleteField() : oldStatus
    };

    if (newStatus === 'done' && oldStatus !== 'done') {
      updates.completedAt = new Date().toISOString();
    } else if (newStatus !== 'done' && oldStatus === 'done') {
      updates.completedAt = deleteField();
    }

    batch.update(taskRef, updates);

    await logActivity(batch, taskId, {
      type: 'status_change',
      field: 'status',
      oldValue: oldStatus,
      newValue: newStatus,
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Usuario'
    });

    try {
      await batch.commit();
      toast.success('Estado actualizado');
      
      // Notifications
      const currentUser = {
        uid: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: auth.currentUser.displayName?.split(' ')[1] || ''
      };

      if (newStatus === 'stuck') {
        if (task.assignedTo && task.assignedTo !== currentUser.uid) {
          await notifyTaskStuck(task.assignedTo, task, currentUser);
        }
        const admins = await getProjectAdmins(projectId);
        await Promise.all(admins
          .filter(a => a.uid !== currentUser.uid)
          .map(a => notifyTaskStuck(a.uid, task, currentUser))
        );
      } else if (newStatus === 'done' && task.assignedTo && task.assignedTo !== currentUser.uid) {
        await notifyTaskStatusChanged(task.assignedTo, task, 'Completada', currentUser);
      } else if (newStatus === 'todo' && oldStatus === 'pending_approval') {
        await notifyTaskApproved(task.createdBy, task, currentUser);
      } else if (newStatus === 'rejected' && oldStatus === 'pending_approval') {
        await notifyTaskRejected(task.createdBy, task, currentUser, rejectionReason || 'Sin motivo');
      } else if (newStatus === 'pending_approval' && oldStatus !== 'pending_approval') {
        const admins = await getProjectAdmins(projectId);
        await Promise.all(admins
          .filter(a => a.uid !== currentUser.uid)
          .map(a => notifyApprovalPending(a.uid, task, currentUser))
        );
      } else if (task.assignedTo && task.assignedTo !== currentUser.uid) {
        const statusLabels: Record<string, string> = {
          'todo': 'Por hacer',
          'working_on_it': 'En progreso',
          'waiting_review': 'En revisión'
        };
        if (statusLabels[newStatus]) {
          await notifyTaskStatusChanged(task.assignedTo, task, statusLabels[newStatus], currentUser);
        }
      }

    } catch (err) {
      console.error('Error updating task status:', err);
      toast.error('Error al actualizar el estado');
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const updateTaskField = async (taskId: string, field: keyof Task, newValue: any, oldValue: any) => {
    if (!projectId || !auth.currentUser) return;

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);

    const updates: any = {
      [field]: newValue === undefined ? deleteField() : newValue
    };

    if (field === 'assignedTo') {
      const ids = newValue ? [newValue] : [];
      updates.leadAssigneeId = newValue || null;
      updates.assigneeIds = ids;
      updates.assignedUsers = ids;
      updates.assignees = ids;
    }

    if (field === 'status') {
      if (newValue === 'done' && oldValue !== 'done') {
        updates.completedAt = new Date().toISOString();
      } else if (newValue !== 'done' && oldValue === 'done') {
        updates.completedAt = deleteField();
      }
    }

    batch.set(taskRef, updates, { merge: true });
    batch.set(doc(db, 'tasks', taskId), { ...updates, projectId, updatedAt: new Date().toISOString() }, { merge: true });

    await logActivity(batch, taskId, {
      type: 'field_update',
      field: field as string,
      oldValue,
      newValue,
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Usuario'
    });

    try {
      await batch.commit();
      toast.success('Tarea actualizada');

      const currentUser = {
        uid: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: auth.currentUser.displayName?.split(' ')[1] || ''
      };

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        if (field === 'assignedTo' && newValue && newValue !== oldValue && newValue !== currentUser.uid) {
          await notifyTaskAssigned(newValue, task, currentUser);
        } else if (field === 'status' && newValue === 'pending_approval' && oldValue !== 'pending_approval') {
          const admins = await getProjectAdmins(projectId);
          await Promise.all(admins
            .filter(a => a.uid !== currentUser.uid)
            .map(a => notifyApprovalPending(a.uid, task, currentUser))
          );
        }
      }

    } catch (err) {
      console.error('Error updating task field:', err);
      toast.error('Error al actualizar la tarea');
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const updateTaskFields = async (taskId: string, fieldUpdates: Record<string, any>, oldValues: Record<string, any>) => {
    if (!projectId || !auth.currentUser) return;

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);

    const updates: any = {};
    for (const [field, newValue] of Object.entries(fieldUpdates)) {
      updates[field] = newValue === undefined ? deleteField() : newValue;
      
      await logActivity(batch, taskId, {
        type: 'field_update',
        field: field,
        oldValue: oldValues[field],
        newValue,
        authorUid: auth.currentUser.uid,
        authorName: auth.currentUser.displayName || 'Usuario'
      });
    }

    if ('assignedTo' in fieldUpdates) {
      const assignedVal = fieldUpdates.assignedTo;
      const ids = assignedVal ? [assignedVal] : [];
      updates.leadAssigneeId = assignedVal || null;
      updates.assigneeIds = ids;
      updates.assignedUsers = ids;
      updates.assignees = ids;
    }

    batch.set(taskRef, updates, { merge: true });
    batch.set(doc(db, 'tasks', taskId), { ...updates, projectId, updatedAt: new Date().toISOString() }, { merge: true });

    try {
      await batch.commit();
      toast.success('Tarea actualizada');

      const currentUser = {
        uid: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: auth.currentUser.displayName?.split(' ')[1] || ''
      };

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        if (fieldUpdates.assignedTo && fieldUpdates.assignedTo !== oldValues.assignedTo && fieldUpdates.assignedTo !== currentUser.uid) {
          await notifyTaskAssigned(fieldUpdates.assignedTo, task, currentUser);
        }
      }
    } catch (err) {
      console.error('Error updating task fields:', err);
      toast.error('Error al actualizar la tarea');
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const updateTaskDates = async (taskId: string, newStart: Date, newEnd: Date) => {
    if (!projectId || !auth.currentUser) return;

    const taskToUpdate = tasks.find(t => t.id === taskId);
    if (!taskToUpdate) return;

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);

    const startStr = newStart.toISOString();
    const endStr = newEnd.toISOString();
    const duration = differenceInCalendarDays(newEnd, newStart);

    batch.update(taskRef, {
      startDate: startStr,
      endDate: endStr,
      duration: duration,
      updatedAt: serverTimestamp()
    });

    await logActivity(batch, taskId, {
      type: 'field_update',
      field: 'dates',
      oldValue: `${taskToUpdate.startDate} - ${taskToUpdate.endDate}`,
      newValue: `${startStr} - ${endStr}`,
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Usuario'
    });

    try {
      await batch.commit();
      toast.success('Fechas actualizadas');
    } catch (err) {
      console.error('Error updating task dates:', err);
      toast.error('Error al actualizar fechas');
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!projectId || !auth.currentUser) return;

    const taskToDelete = tasks.find(t => t.id === taskId);
    if (!taskToDelete) return;

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const deletedTaskRef = doc(db, 'projects', projectId, 'deletedTasks', taskId);

    const deletedAt = new Date().toISOString();
    const deletedBy = auth.currentUser.uid;

    // Soft delete: update the original task and copy to deletedTasks
    batch.update(taskRef, {
      deletedAt,
      deletedBy
    });

    // Sanitize undefined values for Firestore
    const sanitizedTask = Object.fromEntries(
      Object.entries(taskToDelete).filter(([_, v]) => v !== undefined)
    );

    batch.set(deletedTaskRef, {
      ...sanitizedTask,
      deletedAt,
      deletedBy
    });

    await logActivity(batch, taskId, {
      type: 'task_deleted',
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Usuario'
    });

    try {
      await batch.commit();
      toast.success('Tarea eliminada (Soft-delete)', {
        duration: 5000
      });

      const currentUser = {
        uid: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: auth.currentUser.displayName?.split(' ')[1] || ''
      };

      if (taskToDelete.assignedTo && taskToDelete.assignedTo !== currentUser.uid) {
        await notifyTaskDeleted(taskToDelete.assignedTo, taskToDelete, currentUser);
      }
      const admins = await getProjectAdmins(projectId);
      await Promise.all(admins
        .filter(a => a.uid !== currentUser.uid && a.uid !== taskToDelete.assignedTo)
        .map(a => notifyTaskDeleted(a.uid, taskToDelete, currentUser))
      );

    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error('Error al eliminar la tarea');
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const restoreTask = async (taskId: string) => {
    if (!projectId || !auth.currentUser) return;

    const batch = writeBatch(db);
    const taskRef = doc(db, 'projects', projectId, 'tasks', taskId);
    const deletedTaskRef = doc(db, 'projects', projectId, 'deletedTasks', taskId);

    batch.update(taskRef, {
      deletedAt: null,
      deletedBy: null
    });

    batch.delete(deletedTaskRef);

    await logActivity(batch, taskId, {
      type: 'task_restored',
      authorUid: auth.currentUser.uid,
      authorName: auth.currentUser.displayName || 'Usuario'
    });

    try {
      await batch.commit();
      toast.success('Tarea restaurada');

      const currentUser = {
        uid: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: auth.currentUser.displayName?.split(' ')[1] || ''
      };

      const task = tasks.find(t => t.id === taskId);
      if (task) {
        if (task.assignedTo && task.assignedTo !== currentUser.uid) {
          await notifyTaskRestored(task.assignedTo, task, currentUser);
        }
        const admins = await getProjectAdmins(projectId);
        await Promise.all(admins
          .filter(a => a.uid !== currentUser.uid && a.uid !== task.assignedTo)
          .map(a => notifyTaskRestored(a.uid, task, currentUser))
        );
      }

    } catch (err) {
      console.error('Error restoring task:', err);
      toast.error('Error al restaurar la tarea');
      handleFirestoreError(err, OperationType.UPDATE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const permanentDelete = async (taskId: string) => {
    if (!projectId) return;

    try {
      await deleteDoc(doc(db, 'projects', projectId, 'tasks', taskId));
      await deleteDoc(doc(db, 'projects', projectId, 'deletedTasks', taskId));
      toast.success('Tarea eliminada permanentemente');
    } catch (err) {
      console.error('Error permanently deleting task:', err);
      toast.error('Error al eliminar permanentemente');
      handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}/tasks/${taskId}`);
    }
  };

  const addTask = async (taskData: Partial<Task>) => {
    if (!projectId || !auth.currentUser) return null;

    const tasksRef = collection(db, 'projects', projectId, 'tasks');
    const newDocRef = doc(tasksRef);
    const newTask: any = {
      ...taskData,
      id: newDocRef.id,
      projectId,
      createdAt: new Date().toISOString(),
      createdBy: auth.currentUser.uid,
      deletedAt: null,
      deletedBy: null,
      noteCount: 0
    };

    if (newTask.status === 'done') {
      newTask.completedAt = new Date().toISOString();
    }

    // Sanitize undefined values for Firestore
    const sanitizedTask = Object.fromEntries(
      Object.entries(newTask).filter(([_, v]) => v !== undefined)
    );

    try {
      await setDoc(newDocRef, sanitizedTask);
      
      const currentUser = {
        uid: auth.currentUser.uid,
        firstName: auth.currentUser.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: auth.currentUser.displayName?.split(' ')[1] || ''
      };

      if (sanitizedTask.assignedTo && typeof sanitizedTask.assignedTo === 'string' && sanitizedTask.assignedTo !== currentUser.uid) {
        await notifyTaskAssigned(sanitizedTask.assignedTo, { ...sanitizedTask, id: newDocRef.id } as Task, currentUser);
      }

      return newDocRef.id;
    } catch (err) {
      console.error('Error adding task:', err);
      toast.error('Error al crear la tarea');
      handleFirestoreError(err, OperationType.CREATE, `projects/${projectId}/tasks`);
      return null;
    }
  };

  return {
    tasks,
    tasksByStatus,
    loading,
    error,
    updateTaskStatus,
    updateTaskField,
    updateTaskFields,
    updateTaskDates,
    deleteTask,
    restoreTask,
    permanentDelete,
    addTask
  };
};
