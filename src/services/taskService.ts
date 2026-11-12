import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs,
  getDoc,
  runTransaction,
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  ProjectTask, 
  TaskGroup, 
  TaskComment, 
  TaskAttachment, 
  TaskStatus, 
  TaskStarPriority,
  TaskAuditEntry,
  mapLegacyStatus, 
  mapLegacyPriority 
} from '../types/tasks';
import { nanoid } from 'nanoid';
import { notifyTaskAssigned } from './notificationService';

export const DEFAULT_GROUPS: TaskGroup[] = [
  { id: 'pendientes', name: 'Pendientes', color: '#6366f1', order: 0 },
  { id: 'en_proceso', name: 'En Proceso', color: '#f59e0b', order: 1 },
  { id: 'completado', name: 'Completado', color: '#10b981', order: 2 }
];

/**
 * Limpia recursivamente propiedades `undefined` de un objeto o array
 * para asegurar compatibilidad total con Firestore setDoc/updateDoc/transaction.update.
 */
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => (typeof item === 'object' && item !== null ? sanitizeForFirestore(item) : item)) as any;
  }
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = sanitizeForFirestore(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map(item => (typeof item === 'object' && item !== null ? sanitizeForFirestore(item) : item));
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Sincroniza la inscripción del usuario al proyecto y envía notificación de asignación
 * (exceptuando cuando el mismo coordinador/usuario se asigna a sí mismo).
 */
async function syncAssigneesAndNotify(
  task: ProjectTask,
  newlyAssignedIds: string[],
  user: { id: string; name: string; role?: string }
): Promise<void> {
  const uniqueTargets = Array.from(new Set(newlyAssignedIds.filter(Boolean)));
  if (uniqueTargets.length === 0) return;

  const validProjectId = task.projectId && task.projectId !== 'all' && task.projectId !== 'general'
    ? task.projectId
    : null;

  await Promise.all(uniqueTargets.map(async (targetUid) => {
    if (!targetUid || targetUid.startsWith('u-') || !targetUid.trim()) return;

    // 1. Asegurar que el alumno/coordinador quede enrolado en el proyecto para que se refleje en todo el sistema
    if (validProjectId && ! targetUid.includes(' ')) {
      try {
        await updateDoc(doc(db, 'users', targetUid), {
          projectIds: arrayUnion(validProjectId),
          workStatus: 'Asignado'
        }).catch(() => {});
        await updateDoc(doc(db, 'public_profiles', targetUid), {
          projectIds: arrayUnion(validProjectId),
          workStatus: 'Asignado'
        }).catch(() => {});
      } catch {
        // Ignorar si el ID es un nombre directo de sesión
      }
    }

    // 2. Enviar notificación al alumno o coordinador (excepto si es quien realiza la asignación)
    if (targetUid !== user.id && !targetUid.includes(' ')) {
      try {
        await notifyTaskAssigned(targetUid, task, {
          uid: user.id,
          id: user.id,
          name: user.name
        });
      } catch (notifErr) {
        console.warn('Aviso enviando notificación de asignación:', notifErr);
      }
    }
  }));
}

/**
 * Normaliza cualquier documento de tarea para garantizar la integridad del nuevo esquema.
 */
export function normalizeTask(d: any): ProjectTask {
  const id = d.id || `task_${nanoid(8)}`;
  const now = new Date().toISOString();

  // Si assigneeIds es un arreglo explícito en el documento, es la fuente de verdad
  let rawAssignees: string[] = [];
  if (Array.isArray(d.assigneeIds)) {
    rawAssignees = [
      ...d.assigneeIds,
      ...(d.leadAssigneeId ? [d.leadAssigneeId] : [])
    ];
  } else {
    rawAssignees = [
      ...(typeof d.assigneeIds === 'string' && d.assigneeIds ? [d.assigneeIds] : []),
      ...(Array.isArray(d.assignedUsers) ? d.assignedUsers : (typeof d.assignedUsers === 'string' && d.assignedUsers ? [d.assignedUsers] : [])),
      ...(Array.isArray(d.assignees) ? d.assignees : []),
      ...(d.assignedTo ? [d.assignedTo] : []),
      ...(d.assigneeId ? [d.assigneeId] : []),
      ...(d.leadAssigneeId ? [d.leadAssigneeId] : [])
    ];
  }

  const uniqueAssigneeIds = Array.from(
    new Set(rawAssignees.filter((item): item is string => typeof item === 'string' && item.trim().length > 0))
  );
  const leadAssigneeId = d.leadAssigneeId !== undefined
    ? (d.leadAssigneeId || undefined)
    : (uniqueAssigneeIds[0] || undefined);
  const leadAssigneeName = d.leadAssigneeName || d.assigneeName || d.assignedToName || undefined;
  const isDeleted = Boolean(d.isDeleted);
  
  const normalized: ProjectTask = {
    id,
    projectId: d.projectId || '',
    projectName: d.projectName || '',
    version: typeof d.version === 'number' ? d.version : 1,
    
    stageId: d.stageId || undefined,
    stageName: d.stageName || d.phase || (d.stageId ? 'Etapa' : undefined),
    sprintId: d.sprintId || undefined,
    sprintName: d.sprintName || undefined,
    groupId: d.groupId || 'pendientes',
    groupName: d.groupName || 'Pendientes',
    
    title: d.title || 'Nueva tarea',
    description: d.description || '',
    status: mapLegacyStatus(d.status),
    priority: mapLegacyPriority(d.priority),
    
    leadAssigneeId,
    leadAssigneeName,
    leadAssigneeRole: d.leadAssigneeRole || undefined,
    assigneeIds: uniqueAssigneeIds,
    assignedUsers: uniqueAssigneeIds,
    assignedTo: leadAssigneeId || uniqueAssigneeIds[0] || undefined,
    assigneeName: leadAssigneeName,
    phase: d.stageName || d.groupName || d.phase || 'General',
    sessionStatus: d.sessionStatus || d.status,
    
    dueDate: d.dueDate || undefined,
    startDate: d.startDate || undefined,
    endDate: d.endDate || undefined,
    completedAt: d.completedAt || (mapLegacyStatus(d.status) === 'done' ? (d.lastUpdated || now) : undefined),
    
    estimatedHours: typeof d.estimatedHours === 'number' ? d.estimatedHours : undefined,
    dependencies: Array.isArray(d.dependencies) ? d.dependencies : [],
    isMilestone: Boolean(d.isMilestone),
    isCritical: Boolean(d.isCritical),
    blockReason: d.blockReason || undefined,
    
    subtasks: Array.isArray(d.subtasks) ? d.subtasks : [],
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    commentsCount: typeof d.commentsCount === 'number' ? d.commentsCount : (Array.isArray(d.comments) ? d.comments.length : 0),
    comments: Array.isArray(d.comments) ? d.comments : [],
    
    history: Array.isArray(d.history) ? d.history : [],
    isDeleted,
    deletedAt: isDeleted ? (d.deletedAt || now) : (d.deletedAt ?? null) as any,
    deletedBy: d.deletedBy || undefined,
    deletedByName: d.deletedByName || undefined,
    
    googleTaskId: d.googleTaskId || undefined,
    googleTaskListId: d.googleTaskListId || undefined,
    order: typeof d.order === 'number' ? d.order : 0,
    
    createdAt: d.createdAt || now,
    createdBy: d.createdBy || 'sistema',
    createdByName: d.createdByName || 'Sistema',
    updatedAt: d.updatedAt || d.lastUpdated || now,
    updatedBy: d.updatedBy || 'sistema',
    updatedByName: d.updatedByName || d.createdByName || 'Sistema',
    linkedRecordId: d.linkedRecordId || undefined
  };

  if (d.assigneeNames && typeof d.assigneeNames === 'object') {
    (normalized as any).assigneeNames = d.assigneeNames;
  }

  return normalized;
}

/**
 * Suscripción a tareas de un proyecto específico en tiempo real
 */
export const subscribeToProjectTasks = (
  projectId: string, 
  callback: (tasks: ProjectTask[]) => void
) => {
  if (!projectId) {
    callback([]);
    return () => {};
  }
  let rootTasks: ProjectTask[] = [];
  let subTasks: ProjectTask[] = [];

  const mergeAndEmit = () => {
    const map = new Map<string, ProjectTask>();
    subTasks.forEach(t => map.set(t.id, t));
    rootTasks.forEach(t => {
      const prev = map.get(t.id);
      if (prev) {
        const tTime = Date.parse(t.updatedAt || '') || 0;
        const prevTime = Date.parse(prev.updatedAt || '') || 0;
        const tIsNewer = tTime >= prevTime || (t.version || 1) >= (prev.version || 1);
        const winner = tIsNewer ? t : prev;
        const loser = tIsNewer ? prev : t;

        map.set(t.id, {
          ...loser,
          ...winner,
          title: (winner.title && winner.title !== 'Nueva tarea') ? winner.title : (loser.title || winner.title),
          assigneeIds: winner.assigneeIds,
          assignedUsers: winner.assignedUsers,
          assignedTo: winner.assignedTo,
          leadAssigneeId: winner.leadAssigneeId,
          leadAssigneeName: winner.leadAssigneeName || loser.leadAssigneeName,
          leadAssigneeRole: winner.leadAssigneeRole || loser.leadAssigneeRole,
          ...(winner as any).assigneeNames || (loser as any).assigneeNames
            ? { assigneeNames: { ...((loser as any).assigneeNames || {}), ...((winner as any).assigneeNames || {}) } }
            : {}
        });
      } else {
        map.set(t.id, t);
      }
    });
    const all = Array.from(map.values()).filter(t => !t.isDeleted);
    all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    callback(all);
  };

  const qRoot = query(
    collection(db, 'tasks'),
    where('projectId', '==', projectId)
  );

  const unsubRoot = onSnapshot(qRoot, (snapshot) => {
    rootTasks = snapshot.docs
      .map(d => normalizeTask({ id: d.id, ...d.data(), projectId }))
      .filter(t => !t.isDeleted);
    mergeAndEmit();
  }, (err) => {
    console.warn('Aviso escuchando root tasks:', err);
  });

  const qSub = query(
    collection(db, 'projects', projectId, 'tasks')
  );

  const unsubSub = onSnapshot(qSub, (snapshot) => {
    subTasks = snapshot.docs
      .map(d => {
        const data = d.data();
        return normalizeTask({ id: d.id, ...data, isDeleted: Boolean(data.isDeleted || data.deletedAt), projectId });
      })
      .filter(t => !t.isDeleted);
    mergeAndEmit();
  }, (err) => {
    console.warn('Aviso escuchando sub tasks:', err);
  });

  return () => {
    unsubRoot();
    unsubSub();
  };
};

/**
 * Suscripción global a tareas
 */
export const subscribeToAllTasks = (
  callback: (tasks: ProjectTask[]) => void
) => {
  const q = collection(db, 'tasks');

  return onSnapshot(q, (snapshot) => {
    const tasks: ProjectTask[] = snapshot.docs
      .map(d => normalizeTask({ id: d.id, ...d.data() }))
      .filter(t => !t.isDeleted);
      
    tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    callback(tasks);
  }, (err) => {
    console.error('Error escuchando todas las tareas:', err);
    handleFirestoreError(err, OperationType.LIST, 'tasks');
  });
};

/**
 * Suscripción a la papelera de reciclaje (tareas eliminadas)
 */
export const subscribeToTrashTasks = (
  projectId: string,
  callback: (tasks: ProjectTask[]) => void
) => {
  const q = projectId && projectId !== 'all'
    ? query(collection(db, 'tasks'), where('projectId', '==', projectId), where('isDeleted', '==', true))
    : query(collection(db, 'tasks'), where('isDeleted', '==', true));

  return onSnapshot(q, (snapshot) => {
    const tasks: ProjectTask[] = snapshot.docs.map(d => normalizeTask({ id: d.id, ...d.data() }));
    tasks.sort((a, b) => (b.deletedAt || '').localeCompare(a.deletedAt || ''));
    callback(tasks);
  }, (err) => {
    console.error('Error escuchando papelera:', err);
    handleFirestoreError(err, OperationType.LIST, 'tasks?isDeleted=true');
  });
};

/**
 * Crea una nueva tarea asegurando integridad referencial y versionamiento inicial
 */
export const createTask = async (
  taskData: Partial<ProjectTask> & { projectId: string; projectName: string; title: string },
  user?: { id: string; name: string; role?: string }
): Promise<string> => {
  const taskId = taskData.id || `task_${nanoid(10)}`;
  const now = new Date().toISOString();
  const userId = user?.id || taskData.createdBy || 'anon';
  const userName = user?.name || taskData.createdByName || 'Usuario';

  const initialAudit: TaskAuditEntry = {
    id: nanoid(8),
    timestamp: now,
    userId,
    userName,
    action: 'created',
    newValue: taskData.title
  };

  const newTask: ProjectTask = normalizeTask({
    ...taskData,
    id: taskId,
    version: 1,
    status: taskData.status || 'todo',
    priority: taskData.priority ?? 0,
    subtasks: taskData.subtasks || [],
    dependencies: taskData.dependencies || [],
    attachments: taskData.attachments || [],
    comments: taskData.comments || [],
    history: [initialAudit],
    isDeleted: false,
    deletedAt: null,
    createdAt: now,
    createdBy: userId,
    createdByName: userName,
    updatedAt: now,
    updatedBy: userId,
    updatedByName: userName
  });

  try {
    const cleanedTask = sanitizeForFirestore({
      ...newTask,
      assignees: newTask.assigneeIds,
      deletedAt: null
    });
    await setDoc(doc(db, 'tasks', taskId), cleanedTask);
    if (taskData.projectId && taskData.projectId !== 'all') {
      try {
        await setDoc(doc(db, 'projects', taskData.projectId, 'tasks', taskId), cleanedTask);
      } catch (e) {
        console.warn('Aviso guardando en subcolección de tareas:', e);
      }
    }

    const assignedTargets = Array.from(new Set([
      ...(newTask.assigneeIds || []),
      ...(newTask.leadAssigneeId ? [newTask.leadAssigneeId] : [])
    ].filter(Boolean)));

    if (assignedTargets.length > 0) {
      await syncAssigneesAndNotify(newTask, assignedTargets, {
        id: userId,
        name: userName,
        role: user?.role
      });
    }

    return taskId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Actualización atómica con control optimista de versión y validación de permisos RBAC
 */
export const updateTaskAtomic = async (
  taskId: string,
  expectedVersion: number,
  updates: Partial<ProjectTask>,
  user: { id: string; name: string; role?: string },
  fallbackTask?: Partial<ProjectTask>
): Promise<void> => {
  const taskRef = doc(db, 'tasks', taskId);
  const now = new Date().toISOString();

  // Matriz de permisos RBAC: Verificar restricciones si es alumno
  const role = user.role || '';
  const isCoord = role.includes('coordinator') || role === 'admin' || role === 'master_coordinator' || role === 'super_coordinator';

  // Si se actualizan asignados, garantizar sincronización retrocompatible con Sesión, Gantt, Sprints y Resumen
  if (updates.assigneeIds !== undefined || updates.leadAssigneeId !== undefined) {
    const newIds = updates.assigneeIds !== undefined
      ? updates.assigneeIds
      : (updates.leadAssigneeId ? [updates.leadAssigneeId] : []);
    updates.assigneeIds = newIds;
    (updates as any).assignedUsers = newIds;
    (updates as any).assignees = newIds;
    const primaryLead = updates.leadAssigneeId !== undefined ? updates.leadAssigneeId : (newIds[0] || undefined);
    (updates as any).assignedTo = primaryLead || null;
    (updates as any).assigneeId = primaryLead || null;
    if (updates.leadAssigneeName !== undefined) {
      (updates as any).assigneeName = updates.leadAssigneeName;
    }
  }

  let projectId = updates.projectId || fallbackTask?.projectId;
  let previousAssignees = new Set<string>([
    ...(fallbackTask?.assigneeIds || []),
    ...(fallbackTask?.leadAssigneeId ? [fallbackTask.leadAssigneeId] : [])
  ].filter(Boolean));
  let finalMergedTask: ProjectTask | null = null;

  try {
    let cleanPayload: any = null;
    let fullSubPayload: any = null;

    await runTransaction(db, async (transaction) => {
      const taskDoc = await transaction.get(taskRef);
      if (!taskDoc.exists()) {
        throw new Error('NOT_FOUND_IN_ROOT');
      }

      const rawDoc = taskDoc.data();
      const current = normalizeTask({
        ...(fallbackTask || {}),
        ...rawDoc,
        id: taskDoc.id,
        title: (rawDoc.title && rawDoc.title !== 'Nueva tarea') ? rawDoc.title : (fallbackTask?.title || rawDoc.title || 'Nueva tarea'),
        projectId: rawDoc.projectId || fallbackTask?.projectId || ''
      });
      projectId = current.projectId || projectId;

      previousAssignees = new Set<string>([
        ...(current.assigneeIds || []),
        ...(current.leadAssigneeId ? [current.leadAssigneeId] : [])
      ].filter(Boolean));

      // Validación RBAC en la capa de datos
      if (!isCoord) {
        const isAssigned = (current.assigneeIds || []).includes(user.id) || current.leadAssigneeId === user.id;
        if (!isAssigned) {
          throw new Error('PERMISSION_DENIED: Solo puedes actualizar tareas asignadas a ti.');
        }

        // Alumno no puede modificar fechas, estructura ni asignaciones
        const restrictedKeys: (keyof ProjectTask)[] = [
          'dueDate', 'startDate', 'endDate', 'priority', 'stageId', 'stageName',
          'sprintId', 'sprintName', 'assigneeIds', 'leadAssigneeId', 'dependencies', 'isDeleted'
        ];
        for (const key of restrictedKeys) {
          if (key in updates && (updates as any)[key] !== (current as any)[key]) {
            throw new Error(`PERMISSION_DENIED: Los prestadores no tienen permiso para modificar ${key}.`);
          }
        }
      }

      // Construir entradas de auditoría
      const newAuditEntries: TaskAuditEntry[] = [];
      if (updates.status && updates.status !== current.status) {
        newAuditEntries.push({
          id: nanoid(8),
          timestamp: now,
          userId: user.id,
          userName: user.name,
          action: current.status === 'done' ? 'reopened' : (updates.status === 'blocked' ? 'blocked' : 'status_changed'),
          fieldChanged: 'status',
          oldValue: current.status,
          newValue: updates.status
        });
      }

      if (updates.title && updates.title !== current.title) {
        newAuditEntries.push({
          id: nanoid(8),
          timestamp: now,
          userId: user.id,
          userName: user.name,
          action: 'title_changed',
          fieldChanged: 'title',
          oldValue: current.title,
          newValue: updates.title
        });
      }

      if (updates.priority !== undefined && updates.priority !== current.priority) {
        newAuditEntries.push({
          id: nanoid(8),
          timestamp: now,
          userId: user.id,
          userName: user.name,
          action: 'priority_changed',
          fieldChanged: 'priority',
          oldValue: String(current.priority),
          newValue: String(updates.priority)
        });
      }

      if (updates.leadAssigneeName && updates.leadAssigneeName !== current.leadAssigneeName) {
        newAuditEntries.push({
          id: nanoid(8),
          timestamp: now,
          userId: user.id,
          userName: user.name,
          action: 'assignees_changed',
          fieldChanged: 'leadAssigneeName',
          oldValue: current.leadAssigneeName || 'Sin asignar',
          newValue: updates.leadAssigneeName
        });
      }

      // Tratamiento de completedAt
      let completedAt = current.completedAt;
      if (updates.status === 'done' && current.status !== 'done') {
        completedAt = now;
      } else if (updates.status && updates.status !== 'done' && current.status === 'done') {
        completedAt = undefined;
      }

      const mergedAudit = [...(current.history || []), ...newAuditEntries];
      const nextVersion = Math.max(current.version || 1, expectedVersion || 1) + 1;

      const mergedAssigneeNames = {
        ...((current as any).assigneeNames || {}),
        ...((fallbackTask as any)?.assigneeNames || {}),
        ...((updates as any).assigneeNames || {})
      };

      cleanPayload = sanitizeForFirestore({
        ...(fallbackTask ? {
          projectId: current.projectId || fallbackTask.projectId,
          projectName: current.projectName || fallbackTask.projectName,
          title: current.title || fallbackTask.title,
          status: current.status || fallbackTask.status || 'todo',
          priority: current.priority ?? fallbackTask.priority ?? 3,
          stageId: current.stageId || fallbackTask.stageId,
          stageName: current.stageName || fallbackTask.stageName,
          groupId: current.groupId || fallbackTask.groupId,
          groupName: current.groupName || fallbackTask.groupName,
          dueDate: current.dueDate || fallbackTask.dueDate,
          startDate: current.startDate || fallbackTask.startDate,
          endDate: current.endDate || fallbackTask.endDate,
        } : {}),
        ...updates,
        ...(Object.keys(mergedAssigneeNames).length > 0 ? { assigneeNames: mergedAssigneeNames } : {}),
        completedAt: completedAt ?? null,
        deletedAt: updates.isDeleted ? (updates.deletedAt || now) : null,
        version: nextVersion,
        history: mergedAudit,
        updatedAt: now,
        lastUpdated: now,
        updatedBy: user.id,
        updatedByName: user.name
      });

      finalMergedTask = normalizeTask({
        ...current,
        ...cleanPayload,
        id: taskId,
        projectId: projectId || current.projectId
      });

      fullSubPayload = sanitizeForFirestore({
        ...finalMergedTask,
        ...cleanPayload,
        id: taskId,
        projectId: projectId || current.projectId,
        deletedAt: updates.isDeleted ? (updates.deletedAt || now) : null
      });

      transaction.set(taskRef, fullSubPayload, { merge: true });
    });

    // Sincronizar en tiempo real a la subcolección para que Sesión, Gantt, Sprints y Resumen reflejen el cambio inmediatamente
    if (projectId && projectId !== 'all' && fullSubPayload) {
      try {
        await setDoc(doc(db, 'projects', projectId, 'tasks', taskId), fullSubPayload, { merge: true });
      } catch (errSub) {
        console.warn('Aviso sincronizando a subcolección:', errSub);
      }
    }
  } catch (error: any) {
    if (error.message === 'NOT_FOUND_IN_ROOT') {
      // Documento no existía en root /tasks (ej. tarea de subcolección o tarea base de plantilla), guardar completa en ambas partes
      const baseNormalized = normalizeTask({
        ...(fallbackTask || {}),
        ...updates,
        id: taskId,
        projectId: projectId || '',
        version: (expectedVersion || 1) + 1,
        isDeleted: Boolean(updates.isDeleted),
        deletedAt: updates.isDeleted ? (updates.deletedAt || now) : null,
        updatedAt: now,
        updatedBy: user.id,
        updatedByName: user.name
      });
      finalMergedTask = baseNormalized;

      const cleanFallback = sanitizeForFirestore({
        ...baseNormalized,
        ...updates,
        id: taskId,
        projectId: projectId || baseNormalized.projectId || '',
        assignees: baseNormalized.assigneeIds,
        deletedAt: updates.isDeleted ? (updates.deletedAt || now) : null,
        updatedAt: now,
        lastUpdated: now,
        updatedBy: user.id,
        updatedByName: user.name
      });
      await setDoc(taskRef, cleanFallback, { merge: true });
      if (projectId && projectId !== 'all') {
        try {
          await setDoc(doc(db, 'projects', projectId, 'tasks', taskId), cleanFallback, { merge: true });
        } catch (subErr) {
          console.warn('Aviso guardando en subcolección:', subErr);
        }
      }
    } else {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
      throw error;
    }
  }

  // Verificar si se asignaron nuevas personas o un nuevo responsable para actualizar el sistema y notificar
  if (finalMergedTask && (updates.assigneeIds !== undefined || updates.leadAssigneeId !== undefined)) {
    const currentNewIds = Array.from(new Set([
      ...(updates.assigneeIds || []),
      ...(updates.leadAssigneeId ? [updates.leadAssigneeId] : [])
    ].filter(Boolean)));

    const newlyAdded = currentNewIds.filter(uid => {
      if (updates.leadAssigneeId && uid === updates.leadAssigneeId && fallbackTask?.leadAssigneeId !== uid) {
        return true;
      }
      return !previousAssignees.has(uid);
    });

    const targetsToProcess = newlyAdded.length > 0 ? newlyAdded : currentNewIds;
    await syncAssigneesAndNotify(finalMergedTask, targetsToProcess, user);
  }
};

/**
 * Método de actualización estándar con compatibilidad bidireccional
 */
export const updateTask = async (
  taskId: string, 
  updates: Partial<ProjectTask>,
  user?: { id: string; name: string; role?: string }
): Promise<void> => {
  const userId = user?.id || 'anon';
  const userName = user?.name || 'Usuario';

  await updateTaskAtomic(taskId, 1, updates, {
    id: userId,
    name: userName,
    role: user?.role || 'coordinator'
  }, updates);
};

/**
 * Eliminación suave de tarea (enviar a Papelera)
 */
export const softDeleteTask = async (
  taskId: string, 
  user: { id: string; name: string }
): Promise<void> => {
  const now = new Date().toISOString();
  try {
    const audit: TaskAuditEntry = {
      id: nanoid(8),
      timestamp: now,
      userId: user.id,
      userName: user.name,
      action: 'deleted'
    };

    await updateDoc(doc(db, 'tasks', taskId), {
      isDeleted: true,
      deletedAt: now,
      deletedBy: user.id,
      deletedByName: user.name,
      history: arrayUnion(audit),
      updatedAt: now,
      updatedBy: user.id,
      updatedByName: user.name
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Restaurar tarea de la papelera con verificación referencial
 */
export const restoreTask = async (
  taskId: string,
  user: { id: string; name: string }
): Promise<void> => {
  const now = new Date().toISOString();
  try {
    const audit: TaskAuditEntry = {
      id: nanoid(8),
      timestamp: now,
      userId: user.id,
      userName: user.name,
      action: 'restored'
    };

    await updateDoc(doc(db, 'tasks', taskId), {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      deletedByName: null,
      history: arrayUnion(audit),
      updatedAt: now,
      updatedBy: user.id,
      updatedByName: user.name
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Detección de ciclos en dependencias dirigidas (DAG) usando DFS
 */
export function detectDependencyCycle(
  tasks: ProjectTask[], 
  targetTaskId: string, 
  proposedDepId: string
): boolean {
  if (targetTaskId === proposedDepId) return true;

  const adjList: Record<string, string[]> = {};
  for (const t of tasks) {
    adjList[t.id] = [...(t.dependencies || [])];
  }

  // Simular la nueva arista: targetTaskId depende de proposedDepId
  if (!adjList[targetTaskId]) adjList[targetTaskId] = [];
  adjList[targetTaskId].push(proposedDepId);

  // Búsqueda de ciclos desde proposedDepId hacia targetTaskId
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function dfs(curr: string): boolean {
    visited.add(curr);
    recStack.add(curr);

    const neighbors = adjList[curr] || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        if (dfs(next)) return true;
      } else if (recStack.has(next)) {
        return true;
      }
    }

    recStack.delete(curr);
    return false;
  }

  for (const taskId in adjList) {
    if (!visited.has(taskId)) {
      if (dfs(taskId)) return true;
    }
  }

  return false;
}

/**
 * Procedimiento de migración idempotente de tareas preexistentes
 */
export async function runTaskDataMigration(): Promise<{
  success: boolean;
  totalMigrated: number;
  backupKey: string;
  report: string[];
}> {
  const report: string[] = [];
  const backupTimestamp = new Date().toISOString();
  const backupKey = `tasks_backup_${backupTimestamp}`;

  try {
    const snapshot = await getDocs(collection(db, 'tasks'));
    const rawDocs: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    // 1. Respaldo descargable/persistente en localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        localStorage.setItem(backupKey, JSON.stringify(rawDocs));
        report.push(`Respaldo creado con éxito: ${backupKey} (${rawDocs.length} tareas)`);
      } catch (storageErr) {
        console.warn('Advertencia al escribir backup local:', storageErr);
      }
    }

    let batch = writeBatch(db);
    let opCount = 0;
    let migratedCount = 0;

    for (const raw of rawDocs) {
      // Si ya tiene version y esquema normalizado, omitir (idempotencia)
      const needsStatusMigration = raw.status && !['todo', 'in_progress', 'in_review', 'blocked', 'done'].includes(raw.status);
      const needsPriorityMigration = typeof raw.priority !== 'number';
      const needsVersion = typeof raw.version !== 'number';

      if (needsStatusMigration || needsPriorityMigration || needsVersion) {
        const normalized = normalizeTask(raw);
        const taskRef = doc(db, 'tasks', raw.id);
        
        batch.set(taskRef, normalized, { merge: true });
        opCount++;
        migratedCount++;

        if (opCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
      }
    }

    if (opCount > 0) {
      await batch.commit();
    }

    report.push(`Migración completada. ${migratedCount} de ${rawDocs.length} tareas actualizadas al nuevo esquema.`);
    return {
      success: true,
      totalMigrated: migratedCount,
      backupKey,
      report
    };
  } catch (err: any) {
    console.error('Error durante la migración de tareas:', err);
    report.push(`Fallo en migración: ${err.message || String(err)}`);
    return {
      success: false,
      totalMigrated: 0,
      backupKey,
      report
    };
  }
}

/**
 * Agrega un archivo adjunto
 */
export const addTaskAttachment = async (taskId: string, attachment: TaskAttachment): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', taskId), {
      attachments: arrayUnion(attachment),
      updatedAt: now,
      lastUpdated: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};

/**
 * Agrega un comentario
 */
export const addTaskComment = async (taskId: string, comment: TaskComment): Promise<void> => {
  try {
    const now = new Date().toISOString();
    await updateDoc(doc(db, 'tasks', taskId), {
      comments: arrayUnion(comment),
      updatedAt: now,
      lastUpdated: now
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    throw error;
  }
};
