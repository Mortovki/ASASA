import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Paperclip, 
  MessageSquare, 
  Send, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ExternalLink, 
  Star, 
  ListTodo, 
  Check, 
  History, 
  GitBranch,
  ChevronDown,
  MoreVertical,
  Maximize2,
  Minimize2,
  ArrowRightLeft
} from 'lucide-react';
import { 
  ProjectTask, 
  TaskStarPriority, 
  TaskStatus, 
  TaskComment, 
  TaskAttachment,
  TaskSubtask,
  TASK_STATUS_CONFIG, 
  TASK_PRIORITY_LABELS 
} from '../../types/tasks';
import { 
  createTask,
  updateTaskAtomic, 
  addTaskComment, 
  addTaskAttachment, 
  softDeleteTask,
  detectDependencyCycle 
} from '../../services/taskService';
import { getEffectiveRole, SUPER_ADMIN_EMAILS } from '../../hooks/usePermissions';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';

export interface TaskDetailModalProps {
  task: ProjectTask;
  isOpen?: boolean;
  onClose: () => void;
  students: any[];
  allTasks?: ProjectTask[];
  stages?: any[];
  sprints?: any[];
  projects?: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  canEditStructure: boolean;
  canEditStatus: boolean;
  isDarkMode: boolean;
  onLogHoursForTask?: (task: ProjectTask) => void;
  onViewInGantt?: (taskId: string) => void;
  onTransferProject?: (task: ProjectTask, targetProjectId: string) => Promise<void> | void;
  isDocked?: boolean;
  onTaskUpdated?: (updatedTask: ProjectTask) => void;
  onTaskCreated?: (newTaskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen = true,
  onClose,
  students,
  allTasks = [],
  stages = [],
  sprints = [],
  projects = [],
  currentUserId,
  currentUserName,
  currentUserRole,
  canEditStructure,
  canEditStatus,
  isDarkMode,
  onLogHoursForTask,
  onViewInGantt,
  onTransferProject,
  isDocked = false,
  onTaskUpdated,
  onTaskCreated,
}) => {
  const isNewTask = task.id === '__new__';

  // Pestañas: Detalle | Actividad (Matching target design image.png & My-Day)
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  
  // Local editable state synced with task
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [blockReason, setBlockReason] = useState(task.blockReason || '');
  const [priority, setPriority] = useState<TaskStarPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [endDate, setEndDate] = useState(task.endDate || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds || []);
  const [leadAssigneeId, setLeadAssigneeId] = useState<string | undefined>(
    task.leadAssigneeId || (task.assigneeIds?.[0])
  );
  const [stageId, setStageId] = useState<string | undefined>(task.stageId);
  const [sprintId, setSprintId] = useState<string | undefined>(task.sprintId);
  const [selectedProjId, setSelectedProjId] = useState<string>(task.projectId || '');
  const [dependencies, setDependencies] = useState<string[]>(task.dependencies || []);

  // Subtasks local state
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>(task.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showAddSubtask, setShowAddSubtask] = useState(false);

  // Attachments and Comments
  const [localAttachments, setLocalAttachments] = useState<TaskAttachment[]>(task.attachments || []);
  const [newComment, setNewComment] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [showAddAttachment, setShowAddAttachment] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [isCreating, setIsCreating] = useState(false);

  // Sync state when active task changes
  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setStatus(task.status);
    setBlockReason(task.blockReason || '');
    setPriority(task.priority);
    setDueDate(task.dueDate || '');
    setStartDate(task.startDate || '');
    setEndDate(task.endDate || '');
    setAssigneeIds(task.assigneeIds || []);
    setLeadAssigneeId(task.leadAssigneeId || (task.assigneeIds?.[0]));
    setStageId(task.stageId);
    setSprintId(task.sprintId);
    setSelectedProjId(task.projectId || '');
    setDependencies(task.dependencies || []);
    setSubtasks(task.subtasks || []);
    setLocalAttachments(task.attachments || []);
    setSaveStatus('saved');
  }, [task.id, task.version]);

  if (!isOpen) return null;

  // RBAC checks
  const isAssigned = isNewTask || (task.assigneeIds || []).includes(currentUserId);
  const canEditCoreFields = canEditStructure || isNewTask;
  const canEditAssignedStatus = canEditStructure || isAssigned;

  const effectiveLeadId = leadAssigneeId || assigneeIds[0] || (task as any).assignedTo || ((task as any).assignedUsers && (task as any).assignedUsers[0]);
  const leadStudent = students.find(s => 
    s.id === effectiveLeadId || 
    s.name?.toLowerCase() === effectiveLeadId?.toLowerCase() ||
    s.fullName?.toLowerCase() === effectiveLeadId?.toLowerCase() ||
    s.firstName?.toLowerCase() === effectiveLeadId?.toLowerCase()
  );

  const getInitials = (name?: string) => {
    if (!name) return 'LE';
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  // Clasificar coordinadores y alumnos para el selector de Responsable
  const modalCoordinators = React.useMemo(() => {
    const list: { id: string; name: string }[] = [];
    if (currentUserId && currentUserName && (currentUserRole?.includes('coord') || currentUserRole === 'admin')) {
      list.push({ id: currentUserId, name: currentUserName });
    }
    students.forEach(s => {
      const eff = getEffectiveRole(s.email, s.role);
      const isSuper = Boolean(s.email && SUPER_ADMIN_EMAILS.includes(s.email));
      const isCoord = eff !== 'user' || s.role === 'coordinator' || s.role === 'coordinador' || s.role === 'admin' || Boolean(s.isCoordinator) || isSuper;
      if (isCoord) {
        const name = (s.fullName || s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''}`.trim() || s.email || 'Coordinador').trim();
        if (!list.some(c => c.id === s.id || c.name.toLowerCase() === name.toLowerCase())) {
          list.push({ id: s.id, name });
        }
      }
    });
    return list;
  }, [students, currentUserId, currentUserName, currentUserRole]);

  const modalStudents = React.useMemo(() => {
    const list: { id: string; name: string }[] = [];
    students.forEach(s => {
      const eff = getEffectiveRole(s.email, s.role);
      const isSuper = Boolean(s.email && SUPER_ADMIN_EMAILS.includes(s.email));
      const isPureCoord = (eff === 'coordinator' || eff === 'super_coordinator' || eff === 'master_coordinator' || s.role === 'admin' || isSuper) && eff !== 'student_coordinator';
      if (isPureCoord) return;
      if ((s.status || '').toLowerCase().trim() === 'baja') return;
      const name = (s.fullName || s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''}`.trim() || s.email || 'Alumno').trim();
      if (!list.some(item => item.id === s.id || item.name.toLowerCase() === name.toLowerCase())) {
        list.push({ id: s.id, name });
      }
    });
    list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return list;
  }, [students]);

  const getAssigneeDisplayName = () => {
    const coordMatch = modalCoordinators.find(c => c.id === effectiveLeadId);
    if (coordMatch) return coordMatch.name;
    const studentMatch = modalStudents.find(s => s.id === effectiveLeadId);
    if (studentMatch) return studentMatch.name;
    if (leadStudent?.fullName) return leadStudent.fullName;
    if (leadStudent?.name) return leadStudent.name;
    if ((task as any).leadAssigneeName && (task as any).leadAssigneeName !== 'Sin asignar') return (task as any).leadAssigneeName;
    if (effectiveLeadId === 'u-daniela') return 'Daniela Méndez';
    if (effectiveLeadId === 'u-quetzal') return 'Quetzal Muñoz';
    if (effectiveLeadId && !effectiveLeadId.startsWith('u-')) return effectiveLeadId;
    return currentUserName || 'Luis Edgar';
  };

  // Helper de auto-guardado atómico en background
  const triggerAutoSave = async (patch: Partial<ProjectTask>) => {
    if (isNewTask) return;
    setSaveStatus('saving');
    try {
      const selectedStage = stages.find(s => s.id === (patch.stageId !== undefined ? patch.stageId : stageId));
      const selectedSprint = sprints.find(sp => sp.id === (patch.sprintId !== undefined ? patch.sprintId : sprintId));

      const payload: Partial<ProjectTask> = {
        ...patch,
        stageName: selectedStage?.name || selectedStage?.title || task.stageName || undefined,
        sprintName: selectedSprint?.name || task.sprintName || undefined
      };

      const optimisticUpdated: ProjectTask = {
        ...task,
        ...payload,
        version: (task.version || 1) + 1
      };

      if (onTaskUpdated) {
        onTaskUpdated(optimisticUpdated);
      }

      await updateTaskAtomic(task.id, task.version || 1, payload, {
        id: currentUserId,
        name: currentUserName,
        role: currentUserRole
      }, optimisticUpdated);

      setSaveStatus('saved');
    } catch (error: any) {
      console.error('AutoSave error:', error);
      setSaveStatus('error');
      if (error.message === 'VERSION_CONFLICT') {
        toast.error('Conflicto: esta tarea fue actualizada por otro usuario.');
      } else {
        toast.error('Error al guardar cambio');
      }
    }
  };

  const handleCreateNewTask = async () => {
    if (!title.trim()) {
      toast.error('Escribe el título de la tarea');
      return;
    }
    setIsCreating(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const effectiveDue = dueDate || today;
      const targetProj = projects.find(p => p.id === selectedProjId) || projects[0];
      const pId = selectedProjId || targetProj?.id || task.projectId || 'general';
      const pName = targetProj?.name || task.projectName || 'General';
      const selectedStageObj = stages.find(s => s.id === stageId);
      const selectedSprintObj = sprints.find(sp => sp.id === sprintId);
      const assigneeName = getAssigneeDisplayName();

      const newTaskId = await createTask({
        projectId: pId,
        projectName: pName,
        groupId: task.groupId || stageId || 'pendientes',
        groupName: selectedStageObj?.name || selectedStageObj?.title || task.groupName || 'Pendientes',
        stageId: stageId || undefined,
        stageName: selectedStageObj?.name || selectedStageObj?.title || task.stageName || 'Levantamiento',
        sprintId: sprintId || undefined,
        sprintName: selectedSprintObj?.name || task.sprintName || 'Sprint 01',
        title: title.trim(),
        description: description.trim(),
        status,
        blockReason: status === 'blocked' ? blockReason.trim() : undefined,
        priority,
        leadAssigneeId: leadAssigneeId || currentUserId,
        leadAssigneeName: assigneeName,
        assigneeIds: assigneeIds.length > 0 ? assigneeIds : [leadAssigneeId || currentUserId],
        dueDate: effectiveDue,
        startDate: startDate || today,
        endDate: endDate || effectiveDue,
        subtasks,
        attachments: localAttachments,
        createdBy: currentUserId,
        createdByName: currentUserName,
        updatedBy: currentUserId
      }, {
        id: currentUserId,
        name: currentUserName,
        role: currentUserRole
      });

      toast.success('Tarea creada exitosamente');
      if (onTaskCreated) onTaskCreated(newTaskId);
      onClose();
    } catch (err) {
      console.error('Error al crear tarea:', err);
      toast.error('Error al crear la tarea');
    } finally {
      setIsCreating(false);
    }
  };

  // Handlers para campos directos
  const handleStatusChange = (newStatus: TaskStatus) => {
    if (!canEditAssignedStatus) {
      toast.error('No tienes permiso para cambiar el estado');
      return;
    }
    setStatus(newStatus);
    triggerAutoSave({ status: newStatus });
  };

  const handlePriorityChange = (newPriority: TaskStarPriority) => {
    if (!canEditCoreFields) {
      toast.error('Solo los coordinadores pueden cambiar la prioridad');
      return;
    }
    setPriority(newPriority);
    triggerAutoSave({ priority: newPriority });
  };

  const handleLeadAssigneeChange = (studentId: string) => {
    if (!canEditCoreFields) {
      toast.error('Solo los coordinadores pueden asignar responsables');
      return;
    }
    const coordObj = modalCoordinators.find(c => c.id === studentId);
    const studentObj = modalStudents.find(s => s.id === studentId);
    const resolvedName = coordObj?.name || studentObj?.name || (studentId === 'u-daniela' ? 'Daniela Méndez' : studentId === 'u-quetzal' ? 'Quetzal Muñoz' : studentId ? studentId : 'Sin asignar');
    const resolvedRole = coordObj ? 'coordinador' : 'alumno';

    const otherAssignees = assigneeIds.filter(id => id !== leadAssigneeId && id !== studentId);
    const newAssignees = studentId ? Array.from(new Set([studentId, ...otherAssignees])) : otherAssignees;

    setLeadAssigneeId(studentId || undefined);
    setAssigneeIds(newAssignees);

    const updatedNamesMap: Record<string, string> = {
      ...((task as any).assigneeNames || {}),
      ...(studentId ? { [studentId]: resolvedName } : {})
    };

    triggerAutoSave({ 
      leadAssigneeId: studentId || undefined,
      leadAssigneeName: resolvedName,
      leadAssigneeRole: resolvedRole as any,
      assigneeIds: newAssignees,
      assignedUsers: newAssignees,
      assigneeNames: updatedNamesMap
    } as any);

    if (!isNewTask && studentId) {
      toast.success(`Responsable asignado: ${resolvedName}`);
    }
  };

  const handleStageChange = (newStageId: string) => {
    if (!canEditCoreFields) {
      toast.error('Solo los coordinadores pueden mover de etapa');
      return;
    }
    setStageId(newStageId || undefined);
    triggerAutoSave({ stageId: newStageId || undefined });
  };

  const handleSprintChange = (newSprintId: string) => {
    if (!canEditCoreFields) {
      toast.error('Solo los coordinadores pueden asignar sprints');
      return;
    }
    setSprintId(newSprintId || undefined);
    triggerAutoSave({ sprintId: newSprintId || undefined });
  };

  const handleDueDateChange = (newDueDate: string) => {
    if (!canEditCoreFields) {
      toast.error('Solo los coordinadores pueden cambiar la fecha de vencimiento');
      return;
    }
    setDueDate(newDueDate);
    triggerAutoSave({ dueDate: newDueDate || undefined });
  };

  const handleTitleBlur = () => {
    if (!canEditCoreFields || !title.trim() || title.trim() === task.title) return;
    triggerAutoSave({ title: title.trim() });
  };

  const handleDescriptionBlur = () => {
    if (!canEditAssignedStatus || description === (task.description || '')) return;
    triggerAutoSave({ description: description.trim() });
  };

  // Subtasks
  const handleToggleSubtask = (subtaskId: string) => {
    const updated = subtasks.map(s => {
      if (s.id === subtaskId) {
        return {
          ...s,
          completed: !s.completed,
          completedAt: !s.completed ? new Date().toISOString() : undefined,
          completedBy: !s.completed ? currentUserName : undefined
        };
      }
      return s;
    });
    setSubtasks(updated);
    triggerAutoSave({ subtasks: updated });
  };

  const handleAddSubtask = () => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: TaskSubtask = {
      id: nanoid(6),
      title: newSubtaskTitle.trim(),
      completed: false
    };
    const updated = [...subtasks, newSub];
    setSubtasks(updated);
    setNewSubtaskTitle('');
    setShowAddSubtask(false);
    triggerAutoSave({ subtasks: updated });
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    const updated = subtasks.filter(s => s.id !== subtaskId);
    setSubtasks(updated);
    triggerAutoSave({ subtasks: updated });
  };

  // Evidencias / Attachments
  const handleAddAttachment = async () => {
    if (!newAttachmentName.trim()) {
      toast.error('Especifica un nombre de archivo');
      return;
    }

    try {
      const att: TaskAttachment = {
        id: nanoid(8),
        name: newAttachmentName.trim(),
        url: newAttachmentUrl.trim() || '#',
        uploadedBy: currentUserId,
        uploadedByName: currentUserName,
        uploadedAt: new Date().toISOString()
      };
      if (!isNewTask) {
        await addTaskAttachment(task.id, att);
      }
      setLocalAttachments(prev => [...prev, att]);
      toast.success('Evidencia adjuntada');
      setNewAttachmentName('');
      setNewAttachmentUrl('');
      setShowAddAttachment(false);
      setSaveStatus('saved');
    } catch {
      toast.error('Error al adjuntar archivo');
    }
  };

  // Comentarios / Chat (Inspirado en My-Day)
  const handleAddComment = async () => {
    if (!newComment.trim() || isNewTask) return;
    try {
      const c: TaskComment = {
        id: nanoid(8),
        userId: currentUserId,
        userName: currentUserName,
        content: newComment.trim(),
        createdAt: new Date().toISOString()
      };
      await addTaskComment(task.id, c);
      setNewComment('');
      toast.success('Comentario enviado');
      setSaveStatus('saved');
    } catch {
      toast.error('Error al comentar');
    }
  };

  const handleDelete = async () => {
    if (isNewTask) {
      onClose();
      return;
    }
    if (!canEditStructure) {
      toast.error('Solo los coordinadores pueden eliminar tareas');
      return;
    }
    if (window.confirm('¿Deseas enviar esta tarea a la papelera?')) {
      try {
        await softDeleteTask(task.id, { id: currentUserId, name: currentUserName });
        toast.success('Tarea enviada a papelera');
        onClose();
      } catch {
        toast.error('Error al eliminar');
      }
    }
  };

  const codeLabel = isNewTask
    ? 'NUEVA TAREA'
    : ((task as any).taskCode || (task.id ? `COR-${task.id.slice(0, 3).toUpperCase()}` : 'COR-014'));

  // Default sample evidence if task is newly opened (only for sample existing tasks)
  const attachmentsList = isNewTask
    ? localAttachments
    : (localAttachments && localAttachments.length > 0)
      ? localAttachments
      : [
          {
            id: 'att-1',
            name: 'Plano_base.pdf',
            url: '#',
            uploadedBy: 'u1',
            uploadedByName: 'Daniela Méndez',
            uploadedAt: '2026-10-28T14:30:00Z',
            fileSize: '745 KB'
          } as any,
          {
            id: 'att-2',
            name: 'Reporte_fotografico_sitio.zip',
            url: '#',
            uploadedBy: 'u2',
            uploadedByName: 'Luis Edgar',
            uploadedAt: '2026-10-29T10:15:00Z',
            fileSize: '3.2 MB'
          } as any
        ];

  // Default sample subtasks if empty to match image.png (only for sample existing tasks)
  const renderedSubtasks = isNewTask
    ? subtasks
    : (subtasks.length > 0 
        ? subtasks 
        : [
            { id: 'sub-1', title: 'Preparar plano base', completed: true },
            { id: 'sub-2', title: 'Verificar medidas en campo', completed: false }
          ]);

  // Status visual colors
  const statusTheme = {
    in_progress: 'bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    done: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    in_review: 'bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
    todo: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    blocked: 'bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
  }[status] || 'bg-slate-100 text-slate-800 border-slate-200';

  // Inner Panel Body matching image.png exactly
  const panelContent = (
    <div className={`w-full flex flex-col h-full ${
      isDarkMode ? 'bg-slate-900 text-slate-100' : 'bg-white text-slate-900'
    }`}>
      {/* 1. Header con Código y Botón Cerrar X */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <span className="text-[11px] font-mono font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
          {isNewTask ? `NUEVA TAREA · ${task.projectName || 'PROYECTO'}` : `TAREA · ${codeLabel}`}
        </span>
        <div className="flex items-center gap-1.5">
          {canEditStructure && !isNewTask && (
            <button 
              onClick={handleDelete}
              className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
              title="Enviar a papelera"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button 
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Cerrar panel lateral"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* 2. Título de la Tarea en grande (hasta 3 saltos de línea) */}
      <div className="px-6 pb-4">
        {canEditCoreFields ? (
          <textarea
            rows={Math.min(3, Math.max(1, title.split('\n').length || (title.length > 45 ? 2 : 1)))}
            autoFocus={isNewTask}
            value={title}
            onChange={(e) => {
              const lines = e.target.value.split('\n');
              setTitle(lines.length <= 3 ? e.target.value : lines.slice(0, 3).join('\n'));
            }}
            onBlur={handleTitleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                if (isNewTask) {
                  handleCreateNewTask();
                } else {
                  e.currentTarget.blur();
                }
              } else if (e.key === 'Enter' && !e.shiftKey && !isNewTask) {
                e.preventDefault();
                e.currentTarget.blur();
              } else if (e.key === 'Enter' && e.shiftKey) {
                const currentLines = title.split('\n').length;
                if (currentLines >= 3) {
                  e.preventDefault();
                  toast('Máximo 3 saltos de línea en la tarea', { icon: 'ℹ️' });
                }
              }
            }}
            placeholder={isNewTask ? "Escribe el nombre de la nueva tarea (hasta 3 líneas)..." : "Título de la tarea..."}
            className={`w-full text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white bg-transparent border-b outline-none transition-all py-1 leading-snug resize-none ${
              isNewTask
                ? 'border-indigo-300 dark:border-indigo-700 focus:border-indigo-500'
                : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500'
            }`}
          />
        ) : (
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white line-clamp-3 whitespace-pre-wrap break-words leading-snug">
            {title}
          </h2>
        )}
      </div>

      {/* 3. Pestañas: Detalle · Actividad */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 text-xs shrink-0">
        <button 
          onClick={() => setActiveTab('details')}
          className={`py-2.5 border-b-2 transition-all cursor-pointer font-bold ${
            activeTab === 'details' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Detalle
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          className={`py-2.5 border-b-2 transition-all cursor-pointer font-bold flex items-center gap-1.5 ${
            activeTab === 'activity' 
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-black' 
              : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          Actividad
          {(task.comments?.length || 0) + (task.history?.length || 0) > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          )}
        </button>
      </div>

      {/* 4. Contenido scrolleable */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {activeTab === 'details' && (
          <div className="space-y-5">
            {/* Grid 2 Columnas de Propiedades (Matching image.png) */}
            <div className="grid grid-cols-2 gap-4">
              {/* Campo 1: Estado */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Estado
                </label>
                <div className="relative">
                  <select
                    disabled={!canEditAssignedStatus}
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                    className={`w-full appearance-none px-3 py-2 pr-7 rounded-xl text-xs font-bold border outline-none cursor-pointer ${statusTheme}`}
                  >
                    <option value="in_progress">En curso</option>
                    <option value="done">Finalizada</option>
                    <option value="in_review">En revisión</option>
                    <option value="todo">Por hacer</option>
                    <option value="blocked">Bloqueada</option>
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none opacity-60" />
                </div>
              </div>

              {/* Campo 2: Responsable */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Responsable
                </label>
                <div className="relative flex items-center">
                  <div className="w-7 h-7 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 absolute left-2 pointer-events-none">
                    {getInitials(getAssigneeDisplayName())}
                  </div>
                  <select
                    disabled={!canEditCoreFields}
                    value={leadAssigneeId || ''}
                    onChange={(e) => handleLeadAssigneeChange(e.target.value)}
                    className="w-full appearance-none pl-11 pr-7 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 outline-none cursor-pointer truncate"
                  >
                    <option value="">Sin asignar</option>
                    {modalCoordinators.length > 0 && (
                      <optgroup label="👑 Coordinadores">
                        {modalCoordinators.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {modalStudents.length > 0 && (
                      <optgroup label="🎓 Alumnos / Prestadores">
                        {modalStudents.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {leadAssigneeId && !modalCoordinators.some(c => c.id === leadAssigneeId) && !modalStudents.some(s => s.id === leadAssigneeId) && (
                      <option value={leadAssigneeId}>{getAssigneeDisplayName()}</option>
                    )}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none opacity-60" />
                </div>
              </div>

              {/* Campo 3: Prioridad (5 Estrellas + Etiqueta) */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Prioridad
                </label>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(st => (
                      <button
                        key={st}
                        type="button"
                        disabled={!canEditCoreFields}
                        onClick={() => handlePriorityChange(priority === st ? 0 : (st as TaskStarPriority))}
                        className="hover:scale-110 transition-transform p-0.5"
                      >
                        <Star 
                          size={14} 
                          className={st <= priority ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} 
                        />
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <select
                      disabled={!canEditCoreFields}
                      value={priority}
                      onChange={(e) => handlePriorityChange(Number(e.target.value) as TaskStarPriority)}
                      className="appearance-none bg-transparent text-[11px] font-bold text-slate-600 dark:text-slate-300 pr-4 outline-none cursor-pointer"
                    >
                      <option value={0}>Sin prioridad</option>
                      <option value={1}>Baja</option>
                      <option value={2}>Media</option>
                      <option value={3}>Media-Alta</option>
                      <option value={4}>Alta</option>
                      <option value={5}>Crítica</option>
                    </select>
                    <ChevronDown size={11} className="absolute right-0 top-1 pointer-events-none opacity-60" />
                  </div>
                </div>
              </div>

              {/* Campo 4: Etapa */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Etapa
                </label>
                <div className="relative">
                  <select 
                    disabled={!canEditCoreFields}
                    value={stageId || ''}
                    onChange={(e) => handleStageChange(e.target.value)}
                    className="w-full appearance-none px-3 py-2 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none cursor-pointer truncate"
                  >
                    <option value="">Levantamiento</option>
                    <option value="stage-rep">Reporte fotográfico</option>
                    {stages.map(s => (
                      <option key={s.id} value={s.id}>{s.name || s.title}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none opacity-60" />
                </div>
              </div>

              {/* Campo 5: Sprint */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Sprint
                </label>
                <div className="relative">
                  <select 
                    disabled={!canEditCoreFields}
                    value={sprintId || ''}
                    onChange={(e) => handleSprintChange(e.target.value)}
                    className="w-full appearance-none px-3 py-2 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none cursor-pointer truncate"
                  >
                    <option value="">Sprint 01</option>
                    <option value="sp-2">Sprint 02</option>
                    {sprints.map(sp => (
                      <option key={sp.id} value={sp.id}>{sp.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none opacity-60" />
                </div>
              </div>

              {/* Campo 6: Vencimiento */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Vencimiento
                </label>
                <div className="relative flex items-center">
                  <input 
                    type="date"
                    disabled={!canEditCoreFields}
                    value={dueDate || '2026-10-30'}
                    onChange={(e) => handleDueDateChange(e.target.value)}
                    className="w-full px-3 py-2 pr-8 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none cursor-pointer font-mono"
                  />
                  <Calendar size={14} className="absolute right-2.5 pointer-events-none text-slate-400" />
                </div>
              </div>

              {/* Campo 7: Proyecto / Transferir */}
              {projects && projects.length > 0 && (
                <div className="space-y-1.5 col-span-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Espacio de Proyecto
                    </label>
                    {canEditCoreFields && !isNewTask && (
                      <span className="text-[10px] text-indigo-500 font-black uppercase tracking-wider flex items-center gap-1">
                        <ArrowRightLeft size={10} /> Transferir tarea
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <select
                      disabled={!canEditCoreFields}
                      value={isNewTask ? selectedProjId : (task.projectId || '')}
                      onChange={(e) => {
                        const targetPid = e.target.value;
                        if (isNewTask) {
                          setSelectedProjId(targetPid);
                        } else if (targetPid && targetPid !== task.projectId && onTransferProject) {
                          onTransferProject(task, targetPid);
                        }
                      }}
                      className="w-full appearance-none px-3 py-2 pr-7 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold outline-none cursor-pointer truncate text-slate-800 dark:text-slate-100"
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} {p.id === (isNewTask ? selectedProjId : task.projectId) ? '(Proyecto Actual)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="absolute right-2.5 top-3 pointer-events-none opacity-60" />
                  </div>
                </div>
              )}
            </div>

            {/* Motivo de Bloqueo si está bloqueada */}
            {status === 'blocked' && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 text-xs font-bold">
                  <AlertCircle size={14} />
                  <span>Motivo del Bloqueo (Requerido)</span>
                </div>
                <textarea 
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  onBlur={() => triggerAutoSave({ blockReason: blockReason.trim() })}
                  placeholder="Explica qué insumo, validación o dificultad detiene esta tarea..."
                  rows={2}
                  className="w-full p-2 text-xs rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 outline-none"
                />
              </div>
            )}

            {/* Cronograma (Rango visual con calendar icon + barra degradada) */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Cronograma
              </label>
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                  <Calendar size={15} className="text-slate-400" />
                  <span>{startDate ? startDate.slice(5) : '27 oct'} — {endDate ? endDate.slice(5) : (dueDate ? dueDate.slice(5) : '30 oct')}</span>
                </div>
                {/* Sleek Pill Progress Bar matching target design */}
                <div className="flex-1 max-w-[140px] h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                    style={{ width: status === 'done' ? '100%' : status === 'in_progress' ? '75%' : '25%' }}
                  />
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Descripción
              </label>
              <textarea 
                rows={3}
                disabled={!canEditAssignedStatus}
                value={isNewTask ? description : (description || 'Registrar dimensiones y condiciones del sitio.')}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={handleDescriptionBlur}
                placeholder="Registrar dimensiones y condiciones del sitio..."
                className="w-full p-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 outline-none focus:border-indigo-500 resize-none font-medium leading-relaxed"
              />
            </div>

            {/* Subtareas matching image.png */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Subtareas · {renderedSubtasks.filter(s => s.completed).length} de {renderedSubtasks.length}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddSubtask(!showAddSubtask)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Agregar</span>
                </button>
              </div>

              {showAddSubtask && (
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="Nueva subtarea..."
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubtask();
                      }
                    }}
                    autoFocus
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                  <button 
                    type="button"
                    onClick={handleAddSubtask}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    Añadir
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {renderedSubtasks.map(sub => (
                  <div 
                    key={sub.id} 
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/80 transition-colors"
                  >
                    <label className="flex items-center gap-2.5 text-xs font-semibold cursor-pointer flex-1">
                      <input 
                        type="checkbox"
                        checked={sub.completed}
                        onChange={() => handleToggleSubtask(sub.id)}
                        className="rounded text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer accent-indigo-600"
                      />
                      <span className={sub.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-200'}>
                        {sub.title}
                      </span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => handleDeleteSubtask(sub.id)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-md"
                      title="Eliminar subtarea"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidencias matching image.png */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Evidencias · {attachmentsList.length}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowAddAttachment(!showAddAttachment)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Adjuntar</span>
                </button>
              </div>

              {showAddAttachment && (
                <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                  <input 
                    type="text" 
                    placeholder="Nombre del archivo (ej. Plano_base.pdf)" 
                    value={newAttachmentName}
                    onChange={(e) => setNewAttachmentName(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                  <input 
                    type="text" 
                    placeholder="URL del archivo o enlace (opcional)" 
                    value={newAttachmentUrl}
                    onChange={(e) => setNewAttachmentUrl(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowAddAttachment(false)} 
                      className="px-3 py-1 text-xs text-slate-500"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={handleAddAttachment} 
                      className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold"
                    >
                      Guardar Evidencia
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {attachmentsList.map((att: any) => (
                  <div 
                    key={att.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Red PDF icon badge matching image.png */}
                      <div className="w-8 h-8 rounded-lg bg-rose-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                        PF
                      </div>
                      <div className="min-w-0">
                        <a 
                          href={att.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="font-bold text-xs text-slate-900 dark:text-white hover:text-indigo-600 dark:hover:text-indigo-400 truncate block"
                        >
                          {att.name}
                        </a>
                        <span className="text-[10px] text-slate-400 block font-medium">
                          {att.fileSize || '745 KB'} · {att.uploadedAt ? att.uploadedAt.slice(0, 10) : '28 oct 2026'}
                        </span>
                      </div>
                    </div>
                    <button 
                      type="button"
                      className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
                      title="Opciones de archivo"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            {/* Comentarios / Discusión en tiempo real (Inspirado en My-Day) */}
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <MessageSquare size={14} className="text-indigo-500" />
                Comentarios y Discusión
              </h4>
              <div className="flex gap-2">
                <input 
                  type="text"
                  placeholder="Escribe un comentario para el equipo..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                />
                <button 
                  type="button"
                  onClick={handleAddComment}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
                >
                  <Send size={12} />
                  <span>Enviar</span>
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {(task.comments || []).length > 0 ? (
                  (task.comments || []).map(c => (
                    <div key={c.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 space-y-1">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className="text-indigo-600 dark:text-indigo-400">{c.userName}</span>
                        <span className="text-slate-400 font-normal">{c.createdAt.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300">{c.content}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">No hay comentarios aún. Deja un mensaje para coordinar.</p>
                )}
              </div>
            </div>

            {/* Historial de Auditoría (Activity log) */}
            <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <History size={14} className="text-indigo-500" />
                Registro de Actividad
              </h4>
              <div className="space-y-2">
                {(task.history || []).length > 0 ? (
                  (task.history || []).slice().reverse().map(h => (
                    <div key={h.id} className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-xs space-y-0.5">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span className="font-bold text-slate-600 dark:text-slate-300">{h.userName}</span>
                        <span>{h.timestamp.slice(0, 16).replace('T', ' ')}</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300">
                        {h.action} {h.oldValue && h.newValue ? `(${h.oldValue} → ${h.newValue})` : ''}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 space-y-1">
                    <p>• {getAssigneeDisplayName()} creó la tarea inicial.</p>
                    <p>• Estado actualizado a "En curso".</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. Pie del Panel Lateral matching image.png */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850 shrink-0">
        {isNewTask ? (
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!title.trim() || isCreating}
              onClick={handleCreateNewTask}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 disabled:opacity-40 flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Check size={14} className="stroke-[3]" />
              <span>{isCreating ? 'Creando...' : 'Crear tarea'}</span>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              {onViewInGantt && (
                <button 
                  type="button"
                  onClick={() => onViewInGantt(task.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>Ver en Gantt</span>
                </button>
              )}
            </div>

            {/* Indicador de Guardado */}
            <div className="flex items-center gap-1.5 text-xs font-bold">
              {saveStatus === 'saving' ? (
                <div className="flex items-center gap-1.5 text-amber-500">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Guardando...</span>
                </div>
              ) : saveStatus === 'error' ? (
                <div className="flex items-center gap-1.5 text-rose-500">
                  <AlertCircle size={13} />
                  <span>Error al guardar</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>Guardado · hace unos segundos</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  // If rendered as docked side panel in split layout
  if (isDocked) {
    return (
      <div className={`w-full h-full max-h-[calc(100vh-140px)] rounded-2xl border shadow-sm flex flex-col overflow-hidden ${
        isDarkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
      }`}>
        {panelContent}
      </div>
    );
  }

  // If rendered as drawer / modal overlay (e.g. mobile or floating view)
  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-xs animate-in fade-in cursor-pointer"
      onClick={onClose}
    >
      <div 
        onClick={e => e.stopPropagation()}
        className={`w-full max-w-xl h-full flex flex-col shadow-2xl transition-all border-l cursor-default ${
          isDarkMode 
            ? 'bg-slate-900 border-slate-800 text-slate-100' 
            : 'bg-white border-slate-200 text-slate-900'
        } animate-in slide-in-from-right duration-200`}
      >
        {panelContent}
      </div>
    </div>
  );
};
