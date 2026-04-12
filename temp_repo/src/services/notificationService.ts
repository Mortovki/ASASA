import { collection, addDoc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification, NotificationType } from '../types/notification';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatName } from '../utils/formatters';

// Función base de creación — NUNCA llamar directamente desde componentes
async function createNotification(
  recipientUid: string,
  data: Omit<Notification, 'id' | 'read' | 'readAt' | 'createdAt' | 'userId'>
): Promise<void> {
  const ref = collection(db, 'users', recipientUid, 'notifications');
  
  // Evitar duplicados en las últimas 24 horas
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const q = query(
    ref,
    where('type', '==', data.type),
    where('taskId', '==', data.taskId),
    where('createdAt', '>', oneDayAgo)
  );
  
  const snapshot = await getDocs(q);
  if (!snapshot.empty) {
    return; // Ya existe una notificación similar reciente
  }

  await addDoc(ref, {
    ...data,
    userId: recipientUid,
    read: false,
    readAt: null,
    createdAt: new Date().toISOString(),
  });
}

export async function getProjectAdmins(projectId: string) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('role', 'in', ['admin', 'coordinator']));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
}

// ─── FUNCIONES ESPECÍFICAS POR EVENTO ───────────────────

export async function notifyTaskApproved(
  recipientUid: string,
  task: any,
  approvedBy: any
) {
  await createNotification(recipientUid, {
    type: 'task_approved',
    title: 'Tarea aprobada',
    message: `${formatName(approvedBy.firstName, approvedBy.lastNamePaterno)} aprobó tu tarea "${task.title}"`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: approvedBy.uid,
    triggeredByName: formatName(approvedBy.firstName, approvedBy.lastNamePaterno),
    priority: 'medium',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyTaskRejected(
  recipientUid: string,
  task: any,
  rejectedBy: any,
  reason: string
) {
  await createNotification(recipientUid, {
    type: 'task_rejected',
    title: 'Tarea rechazada',
    message: `${rejectedBy.firstName} rechazó "${task.title}": "${reason}"`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: rejectedBy.uid,
    triggeredByName: formatName(rejectedBy.firstName, rejectedBy.lastNamePaterno),
    priority: 'high',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyApprovalPending(
  adminUid: string,
  task: any,
  proposedBy: any
) {
  await createNotification(adminUid, {
    type: 'approval_pending',
    title: 'Nueva tarea por aprobar',
    message: `${formatName(proposedBy.firstName, proposedBy.lastNamePaterno)} propuso la tarea "${task.title}"`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: proposedBy.uid,
    triggeredByName: formatName(proposedBy.firstName, proposedBy.lastNamePaterno),
    priority: 'high',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyTaskAssigned(
  recipientUid: string,
  task: any,
  assignedBy: any
) {
  await createNotification(recipientUid, {
    type: 'task_assigned',
    title: 'Nueva tarea asignada',
    message: `${formatName(assignedBy.firstName, assignedBy.lastNamePaterno)} te asignó la tarea "${task.title}"${task.projectName ? ` en ${task.projectName}` : ''}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: assignedBy.uid,
    triggeredByName: formatName(assignedBy.firstName, assignedBy.lastNamePaterno),
    priority: 'medium',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyTaskStatusChanged(
  recipientUid: string,
  task: any,
  newStatusLabel: string,
  changedBy: any
) {
  await createNotification(recipientUid, {
    type: 'task_status_changed',
    title: 'Estado de tarea actualizado',
    message: `${formatName(changedBy.firstName, changedBy.lastNamePaterno)} movió tu tarea "${task.title}" a ${newStatusLabel}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: changedBy.uid,
    triggeredByName: formatName(changedBy.firstName, changedBy.lastNamePaterno),
    priority: 'medium',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyTaskStuck(
  recipientUid: string,
  task: any,
  movedBy: any
) {
  await createNotification(recipientUid, {
    type: 'task_stuck',
    title: '⚠ Tarea bloqueada',
    message: `La tarea "${task.title}" fue marcada como Bloqueada por ${movedBy.firstName}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: movedBy.uid,
    triggeredByName: formatName(movedBy.firstName, movedBy.lastNamePaterno),
    priority: 'critical',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyNoteAdded(
  recipientUid: string,
  task: any,
  note: any,
  author: any
) {
  await createNotification(recipientUid, {
    type: 'note_added',
    title: 'Nuevo comentario',
    message: `${formatName(author.firstName, author.lastNamePaterno)} comentó en "${task.title}": "${note.content.slice(0, 60)}..."`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: author.uid,
    triggeredByName: formatName(author.firstName, author.lastNamePaterno),
    priority: 'low',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyCriticalPathUpdated(
  recipientUids: string[],
  projectId: string,
  projectName: string,
  criticalCount: number,
  triggeredBy: any
) {
  await Promise.all(recipientUids.map(uid =>
    createNotification(uid, {
      type: 'critical_path_updated',
      title: 'Ruta crítica actualizada',
      message: `El análisis CPM de "${projectName}" identificó ${criticalCount} tarea${criticalCount !== 1 ? 's' : ''} crítica${criticalCount !== 1 ? 's' : ''}`,
      projectId,
      projectName,
      taskId: null,
      taskTitle: null,
      triggeredBy: triggeredBy.uid,
      triggeredByName: formatName(triggeredBy.firstName, triggeredBy.lastNamePaterno),
      priority: 'medium',
      actionUrl: `/project/${projectId}?tab=cpm`,
    })
  ));
}

export async function notifyTaskNearDeadline(
  recipientUid: string,
  task: any,
  daysLeft: number
) {
  await createNotification(recipientUid, {
    type: 'task_near_deadline',
    title: `Vence en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`,
    message: `La tarea "${task.title}" vence el ${format(new Date(task.endDate), 'dd MMM yyyy', { locale: es })}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: 'system',
    triggeredByName: 'Sistema',
    priority: 'high',
    actionUrl: `/project/${task.projectId}?tab=gantt`,
  });
}

export async function notifyTaskOverdue(
  recipientUid: string,
  task: any
) {
  await createNotification(recipientUid, {
    type: 'task_overdue',
    title: `Tarea vencida`,
    message: `La tarea "${task.title}" venció el ${format(new Date(task.endDate), 'dd MMM yyyy', { locale: es })}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: 'system',
    triggeredByName: 'Sistema',
    priority: 'critical',
    actionUrl: `/project/${task.projectId}?tab=gantt`,
  });
}

export async function notifyTaskDeleted(
  recipientUid: string,
  task: any,
  deletedBy: any
) {
  await createNotification(recipientUid, {
    type: 'task_deleted',
    title: 'Tarea eliminada',
    message: `La tarea "${task.title}" fue eliminada por ${deletedBy.firstName}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: deletedBy.uid,
    triggeredByName: formatName(deletedBy.firstName, deletedBy.lastNamePaterno),
    priority: 'low',
    actionUrl: `/project/${task.projectId}?tab=trash`,
  });
}

export async function notifyTaskRestored(
  recipientUid: string,
  task: any,
  restoredBy: any
) {
  await createNotification(recipientUid, {
    type: 'task_restored',
    title: 'Tarea restaurada',
    message: `La tarea "${task.title}" fue restaurada por ${restoredBy.firstName}`,
    projectId: task.projectId,
    projectName: task.projectName ?? null,
    taskId: task.id,
    taskTitle: task.title,
    triggeredBy: restoredBy.uid,
    triggeredByName: formatName(restoredBy.firstName, restoredBy.lastNamePaterno),
    priority: 'low',
    actionUrl: `/project/${task.projectId}?tab=kanban&taskId=${task.id}`,
  });
}

export async function notifyProjectDeleted(
  recipientUid: string,
  project: any,
  deletedBy: any
) {
  await createNotification(recipientUid, {
    type: 'project_deleted',
    title: 'Proyecto eliminado',
    message: `El proyecto "${project.name}" fue eliminado por ${deletedBy.firstName}`,
    projectId: project.id,
    projectName: project.name,
    taskId: null,
    taskTitle: null,
    triggeredBy: deletedBy.uid,
    triggeredByName: formatName(deletedBy.firstName, deletedBy.lastNamePaterno),
    priority: 'high',
    actionUrl: null,
  });
}
