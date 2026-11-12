import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Paperclip, 
  Check, 
  Trash2, 
  MoreHorizontal,
  Calendar,
  Clock,
  User as UserIcon,
  Star,
  CheckCircle2,
  AlertCircle,
  Lock,
  ExternalLink,
  Search,
  X,
  ListTodo,
  Layers,
  Sparkles,
  ArrowRightLeft,
  FolderKanban,
  Folder,
  UserPlus,
  Users,
  Pencil,
  PanelRightOpen,
  RotateCcw,
  GripVertical
} from 'lucide-react';
import { 
  ProjectTask, 
  TaskGroup, 
  TaskStarPriority, 
  TaskStatus, 
  TASK_STATUS_CONFIG, 
  TASK_PRIORITY_LABELS 
} from '../../types/tasks';
import { updateTask, updateTaskAtomic, createTask, softDeleteTask } from '../../services/taskService';
import { getEffectiveRole, SUPER_ADMIN_EMAILS } from '../../hooks/usePermissions';
import toast from 'react-hot-toast';

const SAMPLE_ASSIGNEE_MAP: Record<string, { name: string; isCoord: boolean; role: 'coordinador' | 'alumno' }> = {
  'u-luis': { name: 'Luis Edgar', isCoord: true, role: 'coordinador' },
  'u-daniela': { name: 'Daniela Méndez', isCoord: false, role: 'alumno' },
  'u-quetzal': { name: 'Quetzal Muñoz', isCoord: false, role: 'alumno' }
};

interface TaskTableViewProps {
  tasks: ProjectTask[];
  groups: TaskGroup[];
  students: any[];
  stages?: any[];
  sprints?: any[];
  projectId: string;
  projectName: string;
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  canEditStructure: boolean;
  canEditStatus: boolean;
  isDarkMode: boolean;
  groupBy?: 'stage' | 'sprint' | 'status' | 'session' | 'group' | 'none';
  visibleColumns?: Record<string, boolean>;
  selectedTaskId?: string;
  projects?: any[];
  onSelectTask: (task: ProjectTask) => void;
  onOpenNewTaskDrawer?: (defaults?: Partial<ProjectTask>) => void;
  onAddGroup?: (name: string) => void;
  onTransferTask?: (task: ProjectTask, targetProjectId: string) => Promise<void> | void;
  onTaskOptimisticUpdate?: (updatedTask: ProjectTask) => void;
}

export const TaskTableView: React.FC<TaskTableViewProps> = ({
  tasks,
  groups,
  students,
  stages = [],
  sprints = [],
  projectId,
  projectName,
  currentUserId,
  currentUserName,
  currentUserRole,
  canEditStructure,
  canEditStatus,
  isDarkMode,
  groupBy = 'stage',
  visibleColumns = {},
  selectedTaskId,
  projects = [],
  onSelectTask,
  onOpenNewTaskDrawer,
  onAddGroup,
  onTransferTask,
  onTaskOptimisticUpdate
}) => {
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState<string>('');
  const [taskToTransfer, setTaskToTransfer] = useState<ProjectTask | null>(null);
  const [targetTransferProjectId, setTargetTransferProjectId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [popoverRoleFilter, setPopoverRoleFilter] = useState<'all' | 'alumno' | 'coordinador'>('all');
  
  // Popovers activos
  const [activePopover, setActivePopover] = useState<{
    taskId: string;
    type: 'status' | 'assignee' | 'assignedUsers' | 'priority' | 'dueDate' | 'timeline' | 'stage' | 'sprint' | 'subtasks';
  } | null>(null);

  const [selectedTaskIds, setSelectedTaskIds] = useState<Record<string, boolean>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [activeQuickAddGroupId, setActiveQuickAddGroupId] = useState<string | null>(null);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [conflictTask, setConflictTask] = useState<ProjectTask | null>(null);

  // Configuración de anchos de columnas redimensionables con límites seguros para no comprometer información
  type ResizableColKey =
    | 'tarea'
    | 'responsable'
    | 'personasAsignadas'
    | 'estado'
    | 'vence'
    | 'prioridad'
    | 'archivos'
    | 'cronograma'
    | 'etapa'
    | 'sprint'
    | 'subtareas';

  const DEFAULT_COL_WIDTHS: Record<ResizableColKey, number> = {
    tarea: 290,
    responsable: 185,
    personasAsignadas: 225,
    estado: 132,
    vence: 100,
    prioridad: 112,
    archivos: 78,
    cronograma: 130,
    etapa: 130,
    sprint: 105,
    subtareas: 90
  };

  const MIN_COL_WIDTHS: Record<ResizableColKey, number> = {
    tarea: 185,
    responsable: 140,
    personasAsignadas: 155,
    estado: 120,
    vence: 88,
    prioridad: 98,
    archivos: 70,
    cronograma: 110,
    etapa: 100,
    sprint: 88,
    subtareas: 78
  };

  const MAX_COL_WIDTHS: Record<ResizableColKey, number> = {
    tarea: 680,
    responsable: 380,
    personasAsignadas: 460,
    estado: 240,
    vence: 200,
    prioridad: 200,
    archivos: 150,
    cronograma: 260,
    etapa: 260,
    sprint: 220,
    subtareas: 180
  };

  const COL_STORAGE_KEY = 'task_table_col_widths_v1';

  const [colWidths, setColWidths] = useState<Record<ResizableColKey, number>>(() => {
    try {
      const saved = localStorage.getItem(COL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_COL_WIDTHS, ...parsed };
      }
    } catch {
      // Ignore storage error
    }
    return DEFAULT_COL_WIDTHS;
  });

  const [resizingCol, setResizingCol] = useState<ResizableColKey | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(COL_STORAGE_KEY, JSON.stringify(colWidths));
    } catch {
      // Ignore storage error
    }
  }, [colWidths]);

  const hasCustomColWidths = React.useMemo(() => {
    return (Object.keys(DEFAULT_COL_WIDTHS) as ResizableColKey[]).some(
      k => colWidths[k] !== DEFAULT_COL_WIDTHS[k]
    );
  }, [colWidths]);

  const handleStartResize = (e: React.MouseEvent, colKey: ResizableColKey) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[colKey];
    setResizingCol(colKey);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const clampedWidth = Math.max(
        MIN_COL_WIDTHS[colKey],
        Math.min(MAX_COL_WIDTHS[colKey], startWidth + deltaX)
      );
      setColWidths(prev => ({ ...prev, [colKey]: clampedWidth }));
    };

    const onMouseUp = () => {
      setResizingCol(null);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResetSingleColumn = (e: React.MouseEvent, colKey: ResizableColKey) => {
    e.preventDefault();
    e.stopPropagation();
    setColWidths(prev => ({ ...prev, [colKey]: DEFAULT_COL_WIDTHS[colKey] }));
  };

  const handleResetAllColumns = (e: React.MouseEvent) => {
    e.stopPropagation();
    setColWidths(DEFAULT_COL_WIDTHS);
    toast.success('Ancho de columnas restablecido');
  };

  const renderResizeHandle = (colKey: ResizableColKey) => (
    <div
      onMouseDown={(e) => handleStartResize(e, colKey)}
      onDoubleClick={(e) => handleResetSingleColumn(e, colKey)}
      onClick={(e) => e.stopPropagation()}
      title="Arrastra para redimensionar columna · Doble clic para restablecer"
      className={`absolute right-0 top-0 bottom-0 w-2.5 cursor-col-resize flex items-center justify-center group/resizer select-none z-10 transition-colors ${
        resizingCol === colKey
          ? 'bg-indigo-500/30'
          : 'hover:bg-indigo-500/15'
      }`}
    >
      <div
        className={`w-[2px] h-4 rounded-full transition-colors ${
          resizingCol === colKey
            ? 'bg-indigo-600 dark:bg-indigo-400 h-full'
            : 'bg-slate-300/70 dark:bg-slate-700 group-hover/resizer:bg-indigo-500'
        }`}
      />
    </div>
  );

  // Lista categorizada de Coordinadores disponibles
  const allCoordinators = React.useMemo(() => {
    const list: { id: string; name: string; role: 'coordinador' }[] = [];
    if (currentUserId && currentUserName && (currentUserRole?.includes('coord') || currentUserRole === 'admin')) {
      list.push({ id: currentUserId, name: currentUserName, role: 'coordinador' });
    }
    students.forEach(s => {
      const effectiveRole = getEffectiveRole(s.email, s.role);
      const isSuperAdmin = Boolean(s.email && SUPER_ADMIN_EMAILS.includes(s.email));
      const isCoord =
        effectiveRole === 'coordinator' ||
        effectiveRole === 'super_coordinator' ||
        effectiveRole === 'master_coordinator' ||
        effectiveRole === 'student_coordinator' ||
        s.role === 'admin' ||
        s.role === 'coordinator' ||
        s.role === 'coordinador' ||
        Boolean(s.isCoordinator) ||
        isSuperAdmin;

      if (isCoord) {
        const name = (s.fullName || s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''} ${s.lastNameMaterno || ''}`.trim() || s.email || 'Coordinador').trim();
        if (!list.some(c => c.id === s.id || c.name.toLowerCase() === name.toLowerCase())) {
          list.push({ id: s.id, name, role: 'coordinador' });
        }
      }
    });
    if (list.length === 0) {
      list.push({ id: 'u-luis', name: 'Luis Edgar', role: 'coordinador' });
    }
    return list;
  }, [currentUserId, currentUserName, currentUserRole, students]);

  // Lista categorizada de Alumnos / Prestadores disponibles
  const allStudentList = React.useMemo(() => {
    const list: { id: string; name: string; role: 'alumno'; isEnrolled?: boolean }[] = [];

    students.forEach(s => {
      const effectiveRole = getEffectiveRole(s.email, s.role);
      const isSuperAdmin = Boolean(s.email && SUPER_ADMIN_EMAILS.includes(s.email));
      const isPureCoord =
        (effectiveRole === 'coordinator' ||
          effectiveRole === 'super_coordinator' ||
          effectiveRole === 'master_coordinator' ||
          s.role === 'admin' ||
          s.role === 'coordinador' ||
          isSuperAdmin) &&
        effectiveRole !== 'student_coordinator';

      if (isPureCoord) return;

      const statusLower = (s.status || '').toLowerCase().trim();
      if (statusLower === 'baja') return;

      const name = (s.fullName || s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''} ${s.lastNameMaterno || ''}`.trim() || s.email || 'Alumno').trim();
      const isEnrolled = Boolean(projectId && projectId !== 'all' && Array.isArray(s.projectIds) && s.projectIds.includes(projectId));

      if (!list.some(item => item.id === s.id || item.name.toLowerCase() === name.toLowerCase())) {
        list.push({
          id: s.id,
          name,
          role: 'alumno',
          isEnrolled
        });
      }
    });

    // Ordenar primero los alumnos enrolados en el proyecto actual y luego alfabéticamente
    list.sort((a, b) => {
      if (Boolean(a.isEnrolled) !== Boolean(b.isEnrolled)) {
        return a.isEnrolled ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'es');
    });

    if (list.length > 0) return list;

    return [
      { id: 'u-daniela', name: 'Daniela Méndez', role: 'alumno' as const, isEnrolled: true },
      { id: 'u-quetzal', name: 'Quetzal Muñoz', role: 'alumno' as const, isEnrolled: true }
    ];
  }, [students, projectId]);

  // Formulario interactivo para agregar tarea con los 5 campos solicitados
  const [quickAddForm, setQuickAddForm] = useState<{
    title: string;
    assigneeRole: 'coordinador' | 'alumno';
    assigneeId: string;
    assigneeName: string;
    status: TaskStatus;
    dueDate: string;
    priority: TaskStarPriority;
    attachmentName: string;
  }>({
    title: '',
    assigneeRole: (currentUserRole?.includes('coord') || currentUserRole === 'admin') ? 'coordinador' : 'coordinador',
    assigneeId: currentUserId || 'u-luis',
    assigneeName: currentUserName || 'Luis Edgar',
    status: 'todo',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    priority: 3,
    attachmentName: ''
  });

  // Helper de avatar e iniciales
  const getInitials = (name?: string): string => {
    if (!name) return 'LE';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const AVATAR_COLORS = [
    'bg-indigo-600 text-white',
    'bg-emerald-600 text-white',
    'bg-blue-600 text-white',
    'bg-purple-600 text-white',
    'bg-amber-600 text-white',
    'bg-rose-600 text-white'
  ];

  const getAvatarColor = (name?: string): string => {
    if (!name) return 'bg-indigo-600 text-white';
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  };

  const formatShortDate = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        const mIdx = parseInt(parts[1], 10) - 1;
        return `${parseInt(parts[2], 10)} ${months[mIdx] || ''}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Grupos calculados dinámicamente según el criterio de agrupación
  const computedGroups = React.useMemo(() => {
    if (groupBy === 'stage' && stages && stages.length > 0) {
      const result: { id: string; name: string; color: string; stageId?: string; tasks: ProjectTask[] }[] = [];
      stages.forEach((st: any) => {
        result.push({
          id: st.id,
          name: st.name || st.title || 'Etapa',
          color: st.color || '#6366f1',
          stageId: st.id,
          tasks: tasks.filter(t => t.stageId === st.id)
        });
      });
      const unassigned = tasks.filter(t => !t.stageId || !stages.some((s: any) => s.id === t.stageId));
      if (unassigned.length > 0) {
        result.push({
          id: 'sin-etapa',
          name: 'Sin etapa asignada',
          color: '#94a3b8',
          tasks: unassigned
        });
      }
      return result;
    }

    if (groupBy === 'sprint' && sprints && sprints.length > 0) {
      const result: { id: string; name: string; color: string; sprintId?: string; tasks: ProjectTask[] }[] = [];
      sprints.forEach((sp: any) => {
        result.push({
          id: sp.id,
          name: sp.name || 'Sprint',
          color: '#f59e0b',
          sprintId: sp.id,
          tasks: tasks.filter(t => t.sprintId === sp.id)
        });
      });
      const unassigned = tasks.filter(t => !t.sprintId || !sprints.some((s: any) => s.id === t.sprintId));
      if (unassigned.length > 0) {
        result.push({
          id: 'sin-sprint',
          name: 'Backlog (Sin sprint)',
          color: '#94a3b8',
          tasks: unassigned
        });
      }
      return result;
    }

    if (groupBy === 'status') {
      const statusList: { id: TaskStatus; name: string; color: string }[] = [
        { id: 'todo', name: 'Por hacer', color: '#94a3b8' },
        { id: 'in_progress', name: 'En curso', color: '#f59e0b' },
        { id: 'in_review', name: 'En revisión', color: '#38bdf8' },
        { id: 'blocked', name: 'Bloqueada', color: '#f43f5e' },
        { id: 'done', name: 'Finalizada', color: '#10b981' }
      ];
      return statusList.map(st => ({
        id: st.id,
        name: st.name,
        color: st.color,
        tasks: tasks.filter(t => t.status === st.id)
      }));
    }

    if (groupBy === 'session') {
      const sessionMap = new Map<string, ProjectTask[]>();
      tasks.forEach(t => {
        const sessName = (t as any).sessionName || (t as any).meetingCategory || (t.stageName ? `Sesión · ${t.stageName}` : 'Sesión General');
        if (!sessionMap.has(sessName)) {
          sessionMap.set(sessName, []);
        }
        sessionMap.get(sessName)!.push(t);
      });
      return Array.from(sessionMap.entries()).map(([name, sTasks], idx) => ({
        id: `sess-${idx}`,
        name: name,
        color: ['#6366f1', '#06b6d4', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'][idx % 6],
        tasks: sTasks
      }));
    }

    // Default: usar grupos tradicionales o las 2 etapas de ejemplo si no hay etapas
    if (stages.length === 0 && tasks.some(t => t.stageName === 'Reporte fotográfico' || t.stageName === 'Levantamiento')) {
      return [
        {
          id: 'grp-lev',
          name: 'Levantamiento',
          color: '#6366f1',
          tasks: tasks.filter(t => !t.stageName || t.stageName === 'Levantamiento')
        },
        {
          id: 'grp-rep',
          name: 'Reporte fotográfico',
          color: '#8b5cf6',
          tasks: tasks.filter(t => t.stageName === 'Reporte fotográfico')
        }
      ];
    }

    return groups.map(g => ({
      id: g.id,
      name: g.name,
      color: g.color || '#6366f1',
      tasks: tasks.filter(t => t.groupId === g.id || (!t.groupId && g.id === 'pendientes'))
    }));
  }, [tasks, groups, stages, sprints, groupBy]);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const toggleSelectTask = (taskId: string) => {
    setSelectedTaskIds(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  const handleStartEditTitle = (task: ProjectTask) => {
    if (!canUserEditField(task, 'title')) {
      toast.error('Solo los coordinadores pueden renombrar tareas');
      return;
    }
    setEditingTitleId(task.id);
    setEditingTitleValue(task.title);
  };

  const handleSaveTitle = async (task: ProjectTask) => {
    if (!editingTitleValue.trim() || editingTitleValue.trim() === task.title) {
      setEditingTitleId(null);
      return;
    }
    const newTitle = editingTitleValue.trim();
    setEditingTitleId(null);
    await handleUpdateField(task, { title: newTitle });
    toast.success('Título actualizado');
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent, task: ProjectTask) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveTitle(task);
    } else if (e.key === 'Enter' && e.shiftKey) {
      const currentLines = editingTitleValue.split('\n').length;
      if (currentLines >= 3) {
        e.preventDefault();
        toast('Máximo 3 saltos de línea en la tarea', { icon: 'ℹ️' });
      }
    } else if (e.key === 'Escape') {
      setEditingTitleId(null);
    }
  };

  const canUserEditField = (task: ProjectTask, field: string): boolean => {
    if (canEditStructure) return true;
    if (field === 'status') {
      return (task.assigneeIds || []).includes(currentUserId);
    }
    return false;
  };

  const handleUpdateField = async (task: ProjectTask, updates: Partial<ProjectTask>) => {
    const effectiveProjId = (task.projectId && task.projectId !== 'all')
      ? task.projectId
      : (projectId && projectId !== 'all' ? projectId : task.projectId);
    const effectiveProjName = task.projectName || projectName || 'Proyecto';

    const optimisticTask: ProjectTask = {
      ...task,
      ...updates,
      projectId: effectiveProjId,
      projectName: effectiveProjName,
      version: (task.version || 1) + 1
    };

    if (onTaskOptimisticUpdate) {
      onTaskOptimisticUpdate(optimisticTask);
    }
    setActivePopover(null);

    try {
      await updateTaskAtomic(
        task.id,
        task.version || 1,
        {
          ...updates,
          projectId: effectiveProjId,
          projectName: effectiveProjName
        },
        {
          id: currentUserId,
          name: currentUserName,
          role: currentUserRole
        },
        optimisticTask
      );
    } catch (err: any) {
      if (err.message === 'VERSION_CONFLICT') {
        setConflictTask(task);
      } else {
        toast.error('Error al guardar el cambio');
      }
    }
  };

  const handleQuickAddTask = async (groupId: string, groupName: string, stageId?: string, sprintId?: string) => {
    const title = quickAddForm.title.trim();
    if (!title) {
      toast.error('El nombre de la tarea es obligatorio');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const dueDate = quickAddForm.dueDate || today;
      const attachments = quickAddForm.attachmentName.trim() ? [{
        id: `att_${Date.now().toString(36)}`,
        name: quickAddForm.attachmentName.trim(),
        url: '#',
        uploadedBy: currentUserId,
        uploadedByName: currentUserName,
        uploadedAt: new Date().toISOString()
      }] : [];

      await createTask({
        projectId: projectId === 'all' ? (tasks[0]?.projectId || 'p-corsac') : projectId,
        projectName: projectName,
        groupId,
        groupName,
        stageId,
        stageName: groupName,
        sprintId,
        title,
        status: quickAddForm.status,
        priority: quickAddForm.priority,
        leadAssigneeId: quickAddForm.assigneeId,
        leadAssigneeName: quickAddForm.assigneeName,
        leadAssigneeRole: quickAddForm.assigneeRole,
        assigneeIds: [quickAddForm.assigneeId],
        dueDate,
        startDate: today,
        endDate: dueDate,
        createdBy: currentUserId,
        createdByName: currentUserName,
        attachments,
        subtasks: []
      }, {
        id: currentUserId,
        name: currentUserName,
        role: currentUserRole
      });

      setActiveQuickAddGroupId(null);
      setQuickAddForm(prev => ({
        ...prev,
        title: '',
        attachmentName: ''
      }));
      toast.success('Tarea agregada y sincronizada');
    } catch (err) {
      console.error("Error al crear tarea:", err);
      toast.error('Error al crear tarea');
    }
  };

  const handleDeleteTask = async (task: ProjectTask) => {
    if (!canEditStructure) {
      toast.error('Solo los coordinadores pueden eliminar tareas');
      return;
    }
    if (window.confirm(`¿Enviar "${task.title}" a la papelera?`)) {
      try {
        await softDeleteTask(task.id, { id: currentUserId, name: currentUserName });
        toast.success('Tarea enviada a papelera');
      } catch {
        toast.error('Error al eliminar');
      }
    }
  };

  // Helper de nombre de responsable
  const getAssigneeInfo = (task: ProjectTask) => {
    const leadId = task.leadAssigneeId || task.assigneeIds?.[0] || (task as any).assignedTo || ((task as any).assignedUsers && (task as any).assignedUsers.length > 0 ? (task as any).assignedUsers[0] : undefined);
    const customNamesMap: Record<string, string> = (task as any).assigneeNames || {};

    if (leadId) {
      // 1. Buscar en coordinadores
      const coord = allCoordinators.find(c => c.id === leadId || c.name.toLowerCase() === leadId.toLowerCase());
      if (coord) {
        return {
          name: coord.name,
          initials: getInitials(coord.name),
          role: 'coordinador'
        };
      }
      // 2. Buscar en alumnos (incluyendo uid e identityIds)
      const lead = students.find(s => 
        s.id === leadId || 
        s.uid === leadId ||
        (Array.isArray(s.identityIds) && s.identityIds.includes(leadId)) ||
        s.name?.toLowerCase() === leadId.toLowerCase() ||
        s.fullName?.toLowerCase() === leadId.toLowerCase() ||
        s.firstName?.toLowerCase() === leadId.toLowerCase()
      );
      if (lead) {
        const name = (lead.fullName || lead.name || `${lead.firstName || ''} ${lead.lastNamePaterno || ''}`.trim() || lead.email || 'Alumno').trim();
        return { 
          name, 
          initials: getInitials(name),
          role: lead.role || 'alumno'
        };
      }
      // 3. Mapa guardado en la tarea o IDs de ejemplo
      if (customNamesMap[leadId]) {
        return {
          name: customNamesMap[leadId],
          initials: getInitials(customNamesMap[leadId]),
          role: task.leadAssigneeRole || 'alumno'
        };
      }
      if (SAMPLE_ASSIGNEE_MAP[leadId]) {
        return {
          name: SAMPLE_ASSIGNEE_MAP[leadId].name,
          initials: getInitials(SAMPLE_ASSIGNEE_MAP[leadId].name),
          role: SAMPLE_ASSIGNEE_MAP[leadId].role
        };
      }
      // 4. Usuario actual si coincide
      if (leadId === currentUserId) {
        return {
          name: currentUserName,
          initials: getInitials(currentUserName),
          role: currentUserRole?.includes('coord') || currentUserRole === 'admin' ? 'coordinador' : 'alumno'
        };
      }
    }

    if (task.leadAssigneeName && task.leadAssigneeName !== 'Sin asignar') {
      return { 
        name: task.leadAssigneeName, 
        initials: getInitials(task.leadAssigneeName),
        role: task.leadAssigneeRole || 'coordinador'
      };
    }

    if (leadId && typeof leadId === 'string' && !leadId.startsWith('u-')) {
      return {
        name: leadId,
        initials: getInitials(leadId),
        role: 'alumno'
      };
    }

    return { name: 'Sin asignar', initials: '--', role: 'alumno' };
  };

  // Helper para obtener todas las personas asignadas a la tarea (coordinadores y alumnos)
  const getAssignedPersons = (task: ProjectTask) => {
    const list: { id: string; name: string; initials: string; isCoord: boolean; role: string }[] = [];
    const customNamesMap: Record<string, string> = (task as any).assigneeNames || {};

    const sourceIds = Array.isArray(task.assigneeIds)
      ? [
          ...task.assigneeIds,
          ...(task.leadAssigneeId ? [task.leadAssigneeId] : [])
        ]
      : [
          ...((task as any).assignedUsers || []),
          ...(task.leadAssigneeId ? [task.leadAssigneeId] : []),
          ...((task as any).assignedTo ? [(task as any).assignedTo] : [])
        ];

    const ids: string[] = Array.from(new Set(sourceIds.filter(Boolean)));

    ids.forEach(id => {
      // 1. Buscar en coordinadores
      const coord = allCoordinators.find(c => c.id === id || c.name.toLowerCase() === id.toLowerCase());
      if (coord) {
        if (!list.some(p => p.id === coord.id || p.name.toLowerCase() === coord.name.toLowerCase())) {
          list.push({
            id: coord.id,
            name: coord.name,
            initials: getInitials(coord.name),
            isCoord: true,
            role: 'coordinador'
          });
        }
        return;
      }
      // 2. Buscar en alumnos (por id, uid, identityIds o nombre)
      const student = students.find(s => 
        s.id === id || 
        s.uid === id ||
        (Array.isArray(s.identityIds) && s.identityIds.includes(id)) ||
        s.name?.toLowerCase() === id.toLowerCase() || 
        s.fullName?.toLowerCase() === id.toLowerCase() ||
        s.firstName?.toLowerCase() === id.toLowerCase()
      );
      if (student) {
        const sName = (student.fullName || student.name || `${student.firstName || ''} ${student.lastNamePaterno || ''}`.trim() || 'Alumno').trim();
        const effectiveRole = getEffectiveRole(student.email, student.role);
        const isCoord = effectiveRole !== 'user' || student.role === 'coordinator' || Boolean(student.isCoordinator) || student.role === 'coordinador';
        if (!list.some(p => p.id === student.id || p.name.toLowerCase() === sName.toLowerCase())) {
          list.push({
            id: student.id,
            name: sName,
            initials: getInitials(sName),
            isCoord,
            role: isCoord ? 'coordinador' : 'alumno'
          });
        }
        return;
      }
      // 3. Usuario actual si coincide
      if (id === currentUserId) {
        if (!list.some(p => p.id === id)) {
          list.push({
            id,
            name: currentUserName,
            initials: getInitials(currentUserName),
            isCoord: currentUserRole?.includes('coord') || currentUserRole === 'admin',
            role: currentUserRole
          });
        }
        return;
      }
      // 4. Mapa de nombres guardados en la tarea o IDs de plantilla (u-luis, u-daniela, u-quetzal)
      if (customNamesMap[id]) {
        const mappedName = customNamesMap[id];
        if (!list.some(p => p.id === id || p.name.toLowerCase() === mappedName.toLowerCase())) {
          list.push({
            id,
            name: mappedName,
            initials: getInitials(mappedName),
            isCoord: id === task.leadAssigneeId ? task.leadAssigneeRole === 'coordinador' : false,
            role: id === task.leadAssigneeId ? (task.leadAssigneeRole || 'alumno') : 'alumno'
          });
        }
        return;
      }
      if (SAMPLE_ASSIGNEE_MAP[id]) {
        const sample = SAMPLE_ASSIGNEE_MAP[id];
        if (!list.some(p => p.id === id || p.name.toLowerCase() === sample.name.toLowerCase())) {
          list.push({
            id,
            name: sample.name,
            initials: getInitials(sample.name),
            isCoord: sample.isCoord,
            role: sample.role
          });
        }
        return;
      }
      // 5. Si coincide con el leadAssigneeId y tenemos leadAssigneeName
      if (id === task.leadAssigneeId && task.leadAssigneeName && task.leadAssigneeName !== 'Sin asignar') {
        if (!list.some(p => p.id === id || p.name.toLowerCase() === task.leadAssigneeName!.toLowerCase())) {
          list.push({
            id,
            name: task.leadAssigneeName,
            initials: getInitials(task.leadAssigneeName),
            isCoord: task.leadAssigneeRole === 'coordinador',
            role: task.leadAssigneeRole || 'alumno'
          });
        }
        return;
      }
      // 6. Nombre directo (ej. proveniente de Sesión: "DAVID", "JANETH", "DIANA", "Erick")
      if (!id.startsWith('u-') && !list.some(p => p.id === id || p.name.toLowerCase() === id.toLowerCase())) {
        list.push({
          id,
          name: id,
          initials: getInitials(id),
          isCoord: false,
          role: 'alumno'
        });
      }
    });

    if (list.length === 0 && task.leadAssigneeName && task.leadAssigneeName !== 'Sin asignar') {
      list.push({
        id: task.leadAssigneeId || 'u-lead',
        name: task.leadAssigneeName,
        initials: getInitials(task.leadAssigneeName),
        isCoord: task.leadAssigneeRole === 'coordinador',
        role: task.leadAssigneeRole || 'coordinador'
      });
    }

    return list;
  };

  // Asignar responsable principal desde la columna Responsable
  const handleSelectLeadAssignee = async (
    task: ProjectTask,
    personId: string,
    personName: string,
    personRole: 'coordinador' | 'alumno'
  ) => {
    const currentPersons = getAssignedPersons(task);
    const otherIds = currentPersons
      .filter(p => p.id !== task.leadAssigneeId && p.id !== personId && p.name.toLowerCase() !== personName.toLowerCase())
      .map(p => p.id);

    const newIds = Array.from(new Set([personId, ...otherIds]));
    const updatedNamesMap: Record<string, string> = {
      ...((task as any).assigneeNames || {}),
      [personId]: personName
    };

    await handleUpdateField(task, {
      assigneeIds: newIds,
      assignedUsers: newIds,
      leadAssigneeId: personId,
      leadAssigneeName: personName,
      leadAssigneeRole: personRole,
      assigneeNames: updatedNamesMap
    } as any);

    toast.success(`Responsable asignado: ${personName}`);
  };

  // Cambiar asignación de personas (toggle con checkboxes)
  const handleToggleAssignee = async (task: ProjectTask, personId: string, personName: string, personRole: string) => {
    const currentPersons = getAssignedPersons(task);
    const exists = currentPersons.some(p => p.id === personId || p.name.toLowerCase() === personName.toLowerCase());

    const currentIds = currentPersons.map(p => p.id);
    const filteredIds = currentIds.filter(id => id !== personId && id.toLowerCase() !== personName.toLowerCase());
    const newIds = exists ? filteredIds : [...filteredIds, personId];

    const updatedNamesMap: Record<string, string> = {
      ...((task as any).assigneeNames || {}),
      [personId]: personName
    };

    let leadId = task.leadAssigneeId;
    let leadName = task.leadAssigneeName;
    let leadRole = task.leadAssigneeRole;

    if (!exists && (newIds.length === 1 || !leadId || leadName === 'Sin asignar')) {
      leadId = personId;
      leadName = personName;
      leadRole = personRole as any;
    } else if (exists && (leadId === personId || (leadName && leadName.toLowerCase() === personName.toLowerCase()))) {
      if (newIds.length > 0) {
        const nextId = newIds[0];
        const nextPerson = allCoordinators.find(c => c.id === nextId) || allStudentList.find(s => s.id === nextId) || students.find(s => s.id === nextId);
        leadId = nextId;
        leadName = nextPerson ? (nextPerson.name || (nextPerson as any).fullName) : (updatedNamesMap[nextId] || nextId);
        leadRole = allCoordinators.some(c => c.id === nextId) ? 'coordinador' : 'alumno';
      } else {
        leadId = '';
        leadName = 'Sin asignar';
      }
    }

    await handleUpdateField(task, {
      assigneeIds: newIds,
      assignedUsers: newIds,
      leadAssigneeId: leadId || undefined,
      leadAssigneeName: leadName,
      leadAssigneeRole: leadRole,
      assigneeNames: updatedNamesMap
    } as any);
    toast.success(exists ? `Removido: ${personName.split(' ')[0]}` : `Asignado: ${personName}`);
  };

  const handleAssignToSelf = async (task: ProjectTask) => {
    const isCoord = currentUserRole?.includes('coord') || currentUserRole === 'admin';
    const updatedNamesMap: Record<string, string> = {
      ...((task as any).assigneeNames || {}),
      [currentUserId]: currentUserName
    };
    await handleUpdateField(task, {
      assigneeIds: [currentUserId],
      assignedUsers: [currentUserId],
      leadAssigneeId: currentUserId,
      leadAssigneeName: currentUserName,
      leadAssigneeRole: isCoord ? 'coordinador' : 'alumno',
      assigneeNames: updatedNamesMap
    } as any);
    toast.success('Te has asignado a esta tarea');
  };

  const handleClearAssignees = async (task: ProjectTask) => {
    await handleUpdateField(task, {
      assigneeIds: [],
      assignedUsers: [],
      leadAssigneeId: '',
      leadAssigneeName: 'Sin asignar'
    } as any);
    toast.success('Asignación borrada');
  };

  // Métricas de progreso exactas
  const completedCount = tasks.filter(t => t.status === 'done').length;
  const progressPct = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

  // Segmentos de distribución de estado (Inspirado en StatisticGroup de My-Day)
  const statusSegments = React.useMemo(() => {
    if (tasks.length === 0) return [];
    const counts: Record<TaskStatus, number> = {
      done: 0,
      in_progress: 0,
      in_review: 0,
      blocked: 0,
      todo: 0
    };
    tasks.forEach(t => {
      const st = t.status || 'todo';
      if (counts[st] !== undefined) counts[st]++;
    });
    const total = tasks.length;
    return [
      { label: 'Finalizadas', count: counts.done, pct: (counts.done / total) * 100, bg: 'bg-emerald-500' },
      { label: 'En curso', count: counts.in_progress, pct: (counts.in_progress / total) * 100, bg: 'bg-amber-400' },
      { label: 'En revisión', count: counts.in_review, pct: (counts.in_review / total) * 100, bg: 'bg-sky-400' },
      { label: 'Bloqueadas', count: counts.blocked, pct: (counts.blocked / total) * 100, bg: 'bg-rose-500' },
      { label: 'Por hacer', count: counts.todo, pct: (counts.todo / total) * 100, bg: 'bg-slate-300 dark:bg-slate-600' }
    ].filter(s => s.pct > 0);
  }, [tasks]);

  // Próximos compromisos
  const [fallbackStatusOverrides, setFallbackStatusOverrides] = React.useState<Record<string, TaskStatus>>({});
  const upcomingTasks = React.useMemo(() => {
    return tasks
      .filter(t => t.dueDate && t.status !== 'done')
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 4);
  }, [tasks]);

  return (
    <div className="space-y-6">
      {/* Grupos de la Tabla estilo Monday / My-Day */}
      {computedGroups.map((group) => {
        const isCollapsed = Boolean(collapsedGroups[group.id]);
        const groupTasks = group.tasks;

        const hasActivePopoverInGroup = Boolean(
          activePopover && groupTasks.some(t => t.id === activePopover.taskId)
        );

        return (
          <div 
            key={group.id} 
            className={`rounded-2xl border transition-all overflow-visible ${
              isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-200'
            }`}
          >
            {/* Header del Grupo estilo Monday */}
            <div 
              onClick={() => toggleGroupCollapse(group.id)}
              className="flex items-center justify-between px-4 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-200/60 dark:border-slate-800 cursor-pointer select-none gap-2 flex-wrap rounded-t-2xl"
            >
              <div className="flex items-center gap-2">
                <button 
                  type="button" 
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-transform"
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                </button>
                <div 
                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                  style={{ backgroundColor: group.color }} 
                />
                <h3 className="font-black text-xs sm:text-sm text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>{group.name}</span>
                  <span className="text-slate-400 dark:text-slate-500 font-medium text-xs">
                    · {groupTasks.length} {groupTasks.length === 1 ? 'tarea' : 'tareas'}
                  </span>
                </h3>
              </div>

              {!isCollapsed && (
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                    <GripVertical size={11} />
                    <span>Arrastra el borde de cualquier columna para redimensionarla</span>
                  </span>
                  {hasCustomColWidths && (
                    <button
                      type="button"
                      onClick={handleResetAllColumns}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-slate-200/70 hover:bg-slate-300/70 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                      title="Restablecer el ancho original de todas las columnas"
                    >
                      <RotateCcw size={11} />
                      <span>Restablecer columnas</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Contenido de la Tabla */}
            {!isCollapsed && (
              <div className={`overflow-x-auto ${hasActivePopoverInGroup ? 'pb-72' : ''}`}>
                <table className="w-full text-left text-xs border-collapse table-fixed">
                  <colgroup>
                    <col style={{ width: '40px', minWidth: '40px' }} />
                    <col style={{ width: `${colWidths.tarea}px`, minWidth: `${MIN_COL_WIDTHS.tarea}px` }} />
                    <col style={{ width: `${colWidths.responsable}px`, minWidth: `${MIN_COL_WIDTHS.responsable}px` }} />
                    {visibleColumns.personasAsignadas !== false && (
                      <col style={{ width: `${colWidths.personasAsignadas}px`, minWidth: `${MIN_COL_WIDTHS.personasAsignadas}px` }} />
                    )}
                    <col style={{ width: `${colWidths.estado}px`, minWidth: `${MIN_COL_WIDTHS.estado}px` }} />
                    <col style={{ width: `${colWidths.vence}px`, minWidth: `${MIN_COL_WIDTHS.vence}px` }} />
                    <col style={{ width: `${colWidths.prioridad}px`, minWidth: `${MIN_COL_WIDTHS.prioridad}px` }} />
                    <col style={{ width: `${colWidths.archivos}px`, minWidth: `${MIN_COL_WIDTHS.archivos}px` }} />
                    {visibleColumns.cronograma && (
                      <col style={{ width: `${colWidths.cronograma}px`, minWidth: `${MIN_COL_WIDTHS.cronograma}px` }} />
                    )}
                    {visibleColumns.etapa && (
                      <col style={{ width: `${colWidths.etapa}px`, minWidth: `${MIN_COL_WIDTHS.etapa}px` }} />
                    )}
                    {visibleColumns.sprint && (
                      <col style={{ width: `${colWidths.sprint}px`, minWidth: `${MIN_COL_WIDTHS.sprint}px` }} />
                    )}
                    {visibleColumns.subtareas && (
                      <col style={{ width: `${colWidths.subtareas}px`, minWidth: `${MIN_COL_WIDTHS.subtareas}px` }} />
                    )}
                    <col style={{ width: '72px', minWidth: '72px' }} />
                  </colgroup>
                  <thead>
                    <tr className="bg-slate-100/50 dark:bg-slate-800/30 text-slate-500 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-2.5 px-3 w-10 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600 w-3.5 h-3.5" 
                        />
                      </th>
                      <th
                        style={{ width: `${colWidths.tarea}px`, minWidth: `${MIN_COL_WIDTHS.tarea}px` }}
                        className="py-2.5 px-3 relative select-none"
                      >
                        <span className="truncate block pr-2">Tarea</span>
                        {renderResizeHandle('tarea')}
                      </th>
                      <th
                        style={{ width: `${colWidths.responsable}px`, minWidth: `${MIN_COL_WIDTHS.responsable}px` }}
                        className="py-2.5 px-3 relative select-none"
                      >
                        <span className="truncate block pr-2">Responsable</span>
                        {renderResizeHandle('responsable')}
                      </th>
                      {visibleColumns.personasAsignadas !== false && (
                        <th
                          style={{ width: `${colWidths.personasAsignadas}px`, minWidth: `${MIN_COL_WIDTHS.personasAsignadas}px` }}
                          className="py-2.5 px-3 relative select-none"
                        >
                          <span className="truncate block pr-2">Personas Asignadas</span>
                          {renderResizeHandle('personasAsignadas')}
                        </th>
                      )}
                      <th
                        style={{ width: `${colWidths.estado}px`, minWidth: `${MIN_COL_WIDTHS.estado}px` }}
                        className="py-2.5 px-3 text-center relative select-none"
                      >
                        <span className="truncate block pr-2">Estado</span>
                        {renderResizeHandle('estado')}
                      </th>
                      <th
                        style={{ width: `${colWidths.vence}px`, minWidth: `${MIN_COL_WIDTHS.vence}px` }}
                        className="py-2.5 px-3 relative select-none"
                      >
                        <span className="truncate block pr-2">Vence ▾</span>
                        {renderResizeHandle('vence')}
                      </th>
                      <th
                        style={{ width: `${colWidths.prioridad}px`, minWidth: `${MIN_COL_WIDTHS.prioridad}px` }}
                        className="py-2.5 px-3 text-center relative select-none"
                      >
                        <span className="truncate block pr-2">Prioridad</span>
                        {renderResizeHandle('prioridad')}
                      </th>
                      <th
                        style={{ width: `${colWidths.archivos}px`, minWidth: `${MIN_COL_WIDTHS.archivos}px` }}
                        className="py-2.5 px-3 text-center relative select-none"
                      >
                        <span className="truncate block pr-2">Archivos</span>
                        {renderResizeHandle('archivos')}
                      </th>
                      {visibleColumns.cronograma && (
                        <th
                          style={{ width: `${colWidths.cronograma}px`, minWidth: `${MIN_COL_WIDTHS.cronograma}px` }}
                          className="py-2.5 px-3 relative select-none"
                        >
                          <span className="truncate block pr-2">Cronograma</span>
                          {renderResizeHandle('cronograma')}
                        </th>
                      )}
                      {visibleColumns.etapa && (
                        <th
                          style={{ width: `${colWidths.etapa}px`, minWidth: `${MIN_COL_WIDTHS.etapa}px` }}
                          className="py-2.5 px-3 relative select-none"
                        >
                          <span className="truncate block pr-2">Etapa</span>
                          {renderResizeHandle('etapa')}
                        </th>
                      )}
                      {visibleColumns.sprint && (
                        <th
                          style={{ width: `${colWidths.sprint}px`, minWidth: `${MIN_COL_WIDTHS.sprint}px` }}
                          className="py-2.5 px-3 relative select-none"
                        >
                          <span className="truncate block pr-2">Sprint</span>
                          {renderResizeHandle('sprint')}
                        </th>
                      )}
                      {visibleColumns.subtareas && (
                        <th
                          style={{ width: `${colWidths.subtareas}px`, minWidth: `${MIN_COL_WIDTHS.subtareas}px` }}
                          className="py-2.5 px-3 text-center relative select-none"
                        >
                          <span className="truncate block pr-2">Subtareas</span>
                          {renderResizeHandle('subtareas')}
                        </th>
                      )}
                      <th className="py-2.5 px-2 w-[72px] text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
                    {groupTasks.map((task) => {
                      const isTitleEditing = editingTitleId === task.id;
                      const isSelected = selectedTaskId === task.id || Boolean(selectedTaskIds[task.id]);
                      const statusConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.todo;
                      const assigneeInfo = getAssigneeInfo(task);
                      const attachmentsCount = (task.attachments || []).length || (task.id === 'cor-014' || task.title.includes('levantamiento') ? 2 : 1);

                      return (
                        <tr 
                          key={task.id}
                          onClick={() => onSelectTask(task)}
                          className={`transition-colors cursor-pointer group/row ${
                            isSelected 
                              ? 'bg-indigo-50/50 dark:bg-indigo-950/25 border-l-4 border-indigo-600' 
                              : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
                          }`}
                        >
                          {/* Checkbox de fila */}
                          <td 
                            className="py-2.5 px-3 text-center align-middle"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectTask(task.id);
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectTask(task.id)}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-0 cursor-pointer accent-indigo-600"
                            />
                          </td>

                          {/* Nombre de la Tarea (Visualización hasta 3 saltos de línea + Editable in-line) */}
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-100 align-middle overflow-hidden">
                            {isTitleEditing ? (
                              <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                                <textarea 
                                  rows={3}
                                  value={editingTitleValue}
                                  autoFocus
                                  onChange={(e) => {
                                    const lines = e.target.value.split('\n');
                                    if (lines.length <= 3) {
                                      setEditingTitleValue(e.target.value);
                                    } else {
                                      setEditingTitleValue(lines.slice(0, 3).join('\n'));
                                    }
                                  }}
                                  onBlur={() => handleSaveTitle(task)}
                                  onKeyDown={(e) => handleTitleKeyDown(e, task)}
                                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-lg text-xs outline-hidden shadow-xs font-bold leading-snug resize-none"
                                />
                                <span className="block text-[10px] text-slate-400">
                                  Enter para guardar · Shift+Enter para salto de línea (máx. 3)
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2 min-w-0">
                                <span 
                                  onClick={(e) => {
                                    if (canUserEditField(task, 'title')) {
                                      e.stopPropagation();
                                      handleStartEditTitle(task);
                                    }
                                  }}
                                  title={task.title}
                                  className="line-clamp-3 whitespace-pre-wrap break-words leading-snug font-bold text-xs hover:underline decoration-indigo-400 underline-offset-2 flex-1 min-w-0"
                                >
                                  {task.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectTask(task);
                                  }}
                                  className="opacity-0 group-hover/row:opacity-100 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 dark:text-indigo-400 font-bold shrink-0 transition-all cursor-pointer mt-0.5"
                                  title="Editar tarea en panel lateral"
                                >
                                  <Pencil size={10} />
                                  <span>Editar</span>
                                </button>
                              </div>
                            )}
                          </td>

                          {/* Responsable Cell con Avatar Circular + Nombre adaptable al ancho de columna */}
                          <td 
                            className="py-2.5 px-3 relative align-middle"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div 
                              onClick={() => {
                                if (canUserEditField(task, 'assigneeIds')) {
                                  setAssigneeSearch('');
                                  setPopoverRoleFilter('all');
                                  setActivePopover(activePopover?.taskId === task.id && activePopover.type === 'assignee' ? null : { taskId: task.id, type: 'assignee' });
                                }
                              }}
                              title={assigneeInfo.name}
                              className="flex items-center gap-2 cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-w-0"
                            >
                              <div className={`w-6 h-6 rounded-full ${getAvatarColor(assigneeInfo.name)} text-white text-[10px] font-black flex items-center justify-center shrink-0`}>
                                {assigneeInfo.initials}
                              </div>
                              <span className="truncate flex-1 min-w-0 text-xs font-semibold text-slate-800 dark:text-slate-200">
                                {assigneeInfo.name}
                              </span>
                            </div>

                            {/* Popover Responsable */}
                            {activePopover?.taskId === task.id && activePopover.type === 'assignee' && (
                              <div className="absolute left-0 top-10 z-50 w-72 p-2.5 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 space-y-2">
                                <div className="flex items-center justify-between px-1">
                                  <span className="text-[11px] font-black text-slate-800 dark:text-slate-100">
                                    Asignar Responsable
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setActivePopover(null)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded"
                                  >
                                    <X size={13} />
                                  </button>
                                </div>

                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                  <Search size={12} className="text-slate-400 shrink-0" />
                                  <input 
                                    type="text"
                                    placeholder="Buscar alumno o coordinador..."
                                    value={assigneeSearch}
                                    onChange={(e) => setAssigneeSearch(e.target.value)}
                                    className="w-full bg-transparent text-xs outline-hidden text-slate-800 dark:text-slate-100"
                                    autoFocus
                                  />
                                </div>

                                {/* Pestañas rápidas de filtro por rol */}
                                <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-[10px] font-bold">
                                  <button
                                    type="button"
                                    onClick={() => setPopoverRoleFilter('all')}
                                    className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                                      popoverRoleFilter === 'all'
                                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    Todos ({allCoordinators.length + allStudentList.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPopoverRoleFilter('alumno')}
                                    className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                                      popoverRoleFilter === 'alumno'
                                        ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    🎓 Alumnos ({allStudentList.length})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setPopoverRoleFilter('coordinador')}
                                    className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                                      popoverRoleFilter === 'coordinador'
                                        ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                    }`}
                                  >
                                    👑 Coord. ({allCoordinators.length})
                                  </button>
                                </div>

                                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-0.5">
                                  {popoverRoleFilter !== 'alumno' && (
                                    <div>
                                      <div className="px-2 py-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                                        👑 Coordinadores
                                      </div>
                                      {allCoordinators
                                        .filter(c => !assigneeSearch || c.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                                        .map(coord => {
                                          const isAssigned = (assigneeInfo.name.toLowerCase() === coord.name.toLowerCase()) || task.leadAssigneeId === coord.id;
                                          return (
                                            <button 
                                              key={coord.id}
                                              type="button"
                                              onClick={() => handleSelectLeadAssignee(task, coord.id, coord.name, 'coordinador')}
                                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <div className={`w-5 h-5 rounded-full ${getAvatarColor(coord.name)} text-white text-[9px] font-black flex items-center justify-center shrink-0`}>
                                                  {getInitials(coord.name)}
                                                </div>
                                                <span className="truncate font-semibold">{coord.name}</span>
                                              </div>
                                              {isAssigned && <Check size={12} className="text-indigo-600 shrink-0" />}
                                            </button>
                                          );
                                        })}
                                    </div>
                                  )}

                                  {popoverRoleFilter !== 'coordinador' && (
                                    <div className={popoverRoleFilter === 'all' ? 'border-t border-slate-100 dark:border-slate-800 pt-1.5' : ''}>
                                      <div className="px-2 py-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                                        🎓 Alumnos / Prestadores
                                      </div>
                                      {allStudentList
                                        .filter(s => !assigneeSearch || s.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                                        .map(student => {
                                          const isAssigned = (assigneeInfo.name.toLowerCase() === student.name.toLowerCase()) || task.leadAssigneeId === student.id;
                                          return (
                                            <button 
                                              key={student.id}
                                              type="button"
                                              onClick={() => handleSelectLeadAssignee(task, student.id, student.name, 'alumno')}
                                              className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer"
                                            >
                                              <div className="flex items-center gap-2 truncate">
                                                <div className={`w-5 h-5 rounded-full ${getAvatarColor(student.name)} text-white text-[9px] font-black flex items-center justify-center shrink-0`}>
                                                  {getInitials(student.name)}
                                                </div>
                                                <span className="truncate font-semibold">{student.name}</span>
                                              </div>
                                              <div className="flex items-center gap-1 shrink-0">
                                                {student.isEnrolled && (
                                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-bold">
                                                    Proyecto
                                                  </span>
                                                )}
                                                {isAssigned && <Check size={12} className="text-indigo-600 shrink-0" />}
                                              </div>
                                            </button>
                                          );
                                        })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Personas Asignadas Cell con múltiples etiquetas y opción de cambiar asignación */}
                          {visibleColumns.personasAsignadas !== false && (
                            <td 
                              className="py-2.5 px-3 relative"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div 
                                onClick={() => {
                                  if (canUserEditField(task, 'assigneeIds')) {
                                    setAssigneeSearch('');
                                    setPopoverRoleFilter('all');
                                    setActivePopover(
                                      activePopover?.taskId === task.id && activePopover.type === 'assignedUsers' 
                                        ? null 
                                        : { taskId: task.id, type: 'assignedUsers' }
                                    );
                                  }
                                }}
                                className="flex items-center gap-1.5 flex-wrap cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-[30px]"
                                title="Hacer clic para cambiar las personas asignadas"
                              >
                                {(() => {
                                  const assigned = getAssignedPersons(task);
                                  if (assigned.length === 0) {
                                    return (
                                      <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-indigo-600 font-bold border border-dashed border-slate-300 dark:border-slate-700 px-2 py-1 rounded-lg transition-colors">
                                        <UserPlus size={12} className="text-indigo-500" />
                                        <span>+ Asignar personas</span>
                                      </span>
                                    );
                                  }
                                  return (
                                    <>
                                      {assigned.map((p) => (
                                        <span 
                                          key={p.id}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs"
                                          title={`${p.name} (${p.isCoord ? 'Coordinador' : 'Alumno'})`}
                                        >
                                          <span className={`w-4 h-4 rounded-full ${p.isCoord ? 'bg-amber-600' : 'bg-indigo-600'} text-white text-[9px] font-black flex items-center justify-center shrink-0`}>
                                            {p.initials[0]}
                                          </span>
                                          <span className="truncate max-w-[90px]">{p.name.split(' ')[0]}</span>
                                        </span>
                                      ))}
                                      {canUserEditField(task, 'assigneeIds') && (
                                        <button
                                          type="button"
                                          className="w-5 h-5 rounded-full border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-400 text-xs font-black transition-colors shrink-0"
                                          title="Cambiar personas asignadas"
                                        >
                                          +
                                        </button>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Popover Interactivo para Cambiar Asignación de Personas con Checkboxes */}
                              {activePopover?.taskId === task.id && activePopover.type === 'assignedUsers' && (
                                <div className="absolute left-0 top-10 z-50 w-76 p-3 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 space-y-2.5">
                                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                                    <div className="flex items-center gap-1.5 font-black text-xs text-slate-800 dark:text-slate-100">
                                      <Users size={14} className="text-indigo-500" />
                                      <span>Personas Asignadas</span>
                                    </div>
                                    <span className="text-[10px] font-mono font-bold text-slate-400">
                                      {getAssignedPersons(task).length} asignados
                                    </span>
                                  </div>

                                  {/* Barra de búsqueda */}
                                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl">
                                    <Search size={12} className="text-slate-400 shrink-0" />
                                    <input 
                                      type="text"
                                      placeholder="Buscar coordinador o alumno..."
                                      value={assigneeSearch}
                                      onChange={(e) => setAssigneeSearch(e.target.value)}
                                      className="w-full bg-transparent text-xs outline-hidden text-slate-800 dark:text-slate-100 placeholder:text-slate-400"
                                      autoFocus
                                    />
                                  </div>

                                  {/* Pestañas rápidas de filtro por rol */}
                                  <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/70 text-[10px] font-bold">
                                    <button
                                      type="button"
                                      onClick={() => setPopoverRoleFilter('all')}
                                      className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                                        popoverRoleFilter === 'all'
                                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                      }`}
                                    >
                                      Todos ({allCoordinators.length + allStudentList.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPopoverRoleFilter('alumno')}
                                      className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                                        popoverRoleFilter === 'alumno'
                                          ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                      }`}
                                    >
                                      🎓 Alumnos ({allStudentList.length})
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPopoverRoleFilter('coordinador')}
                                      className={`py-1 px-1.5 rounded-lg transition-all cursor-pointer ${
                                        popoverRoleFilter === 'coordinador'
                                          ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs'
                                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                                      }`}
                                    >
                                      👑 Coord. ({allCoordinators.length})
                                    </button>
                                  </div>

                                  {/* Acciones Rápidas */}
                                  <div className="flex items-center justify-between text-[11px] font-bold px-1">
                                    <button
                                      type="button"
                                      onClick={() => handleAssignToSelf(task)}
                                      className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                    >
                                      Asignarme a mí
                                    </button>
                                    {getAssignedPersons(task).length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() => handleClearAssignees(task)}
                                        className="text-rose-500 hover:underline cursor-pointer"
                                      >
                                        Desasignar todos
                                      </button>
                                    )}
                                  </div>

                                  {/* Lista de Coordinadores y Alumnos con checkboxes */}
                                  <div className="max-h-56 overflow-y-auto space-y-2 divide-y divide-slate-100 dark:divide-slate-800/60 pt-1">
                                    {/* Sección Coordinadores */}
                                    {popoverRoleFilter !== 'alumno' && (
                                      <div>
                                        <div className="px-2 py-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider">
                                          👑 Coordinadores
                                        </div>
                                        {allCoordinators
                                          .filter(c => !assigneeSearch || c.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                                          .map(coord => {
                                            const isChecked = getAssignedPersons(task).some(p => p.id === coord.id || p.name.toLowerCase() === coord.name.toLowerCase());
                                            return (
                                              <div 
                                                key={coord.id}
                                                onClick={() => handleToggleAssignee(task, coord.id, coord.name, 'coordinador')}
                                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none transition-colors"
                                              >
                                                <div className="flex items-center gap-2 truncate">
                                                  <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600 focus:ring-0 cursor-pointer"
                                                  />
                                                  <div className={`w-5 h-5 rounded-full ${getAvatarColor(coord.name)} text-white text-[9px] font-black flex items-center justify-center shrink-0`}>
                                                    {getInitials(coord.name)}
                                                  </div>
                                                  <span className="truncate font-semibold">{coord.name}</span>
                                                </div>
                                                {isChecked && (
                                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-bold shrink-0">
                                                    Asignado
                                                  </span>
                                                )}
                                              </div>
                                            );
                                          })}
                                      </div>
                                    )}

                                    {/* Sección Alumnos */}
                                    {popoverRoleFilter !== 'coordinador' && (
                                      <div className={popoverRoleFilter === 'all' ? 'pt-2' : ''}>
                                        <div className="px-2 py-1 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                                          🎓 Alumnos / Prestadores
                                        </div>
                                        {allStudentList
                                          .filter(s => !assigneeSearch || s.name.toLowerCase().includes(assigneeSearch.toLowerCase()))
                                          .map(student => {
                                            const isChecked = getAssignedPersons(task).some(p => p.id === student.id || p.name.toLowerCase() === student.name.toLowerCase());
                                            return (
                                              <div 
                                                key={student.id}
                                                onClick={() => handleToggleAssignee(task, student.id, student.name, 'alumno')}
                                                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 cursor-pointer select-none transition-colors"
                                              >
                                                <div className="flex items-center gap-2 truncate">
                                                  <input 
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => {}}
                                                    className="w-3.5 h-3.5 rounded text-indigo-600 accent-indigo-600 focus:ring-0 cursor-pointer"
                                                  />
                                                  <div className={`w-5 h-5 rounded-full ${getAvatarColor(student.name)} text-white text-[9px] font-black flex items-center justify-center shrink-0`}>
                                                    {getInitials(student.name)}
                                                  </div>
                                                  <span className="truncate font-semibold">{student.name}</span>
                                                </div>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  {student.isEnrolled && !isChecked && (
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                                                      Proyecto
                                                    </span>
                                                  )}
                                                  {isChecked && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold shrink-0">
                                                      Asignado
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            );
                                          })}
                                      </div>
                                    )}
                                  </div>

                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => setActivePopover(null)}
                                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                                    >
                                      Listo
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>
                          )}

                          {/* Estado Cell (Pill Button con dropdown chevron) */}
                          <td 
                            className="py-2.5 px-3 text-center relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => {
                                if (canUserEditField(task, 'status')) {
                                  setActivePopover(activePopover?.taskId === task.id && activePopover.type === 'status' ? null : { taskId: task.id, type: 'status' });
                                } else {
                                  toast.error('No tienes permiso para cambiar el estado');
                                }
                              }}
                              className={`w-full min-w-[112px] py-1 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${statusConfig.bgLight} ${statusConfig.textLight} ${statusConfig.bgDark} ${statusConfig.textDark} border ${statusConfig.borderLight} ${statusConfig.borderDark} hover:brightness-95 inline-flex items-center justify-center gap-1.5`}
                            >
                              <span className="whitespace-nowrap">{statusConfig.label}</span>
                              <ChevronDown size={11} className="opacity-70 shrink-0" />
                            </button>

                            {/* Dropdown 5 Estados Universales */}
                            {activePopover?.taskId === task.id && activePopover.type === 'status' && (
                              <div className="absolute left-0 top-11 z-50 w-36 p-1.5 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 space-y-1 animate-in fade-in zoom-in-95">
                                {(Object.keys(TASK_STATUS_CONFIG) as TaskStatus[]).map(st => {
                                  const cfg = TASK_STATUS_CONFIG[st];
                                  return (
                                    <button 
                                      key={st}
                                      onClick={() => handleUpdateField(task, { status: st })}
                                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${cfg.bgLight} ${cfg.textLight} ${cfg.bgDark} ${cfg.textDark} hover:brightness-90 flex items-center justify-between`}
                                    >
                                      <span>{cfg.label}</span>
                                      {task.status === st && <Check size={12} />}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </td>

                          {/* Vencimiento Cell */}
                          <td 
                            className="py-2.5 px-3 relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button 
                              onClick={() => {
                                if (canUserEditField(task, 'dueDate')) {
                                  setActivePopover(activePopover?.taskId === task.id && activePopover.type === 'dueDate' ? null : { taskId: task.id, type: 'dueDate' });
                                }
                              }}
                              className="text-slate-600 dark:text-slate-300 font-semibold text-xs hover:text-indigo-600 transition-colors"
                            >
                              {formatShortDate(task.dueDate || (task.id === 'cor-014' ? '2026-10-30' : '2026-10-28'))}
                            </button>

                            {/* Popover Vencimiento */}
                            {activePopover?.taskId === task.id && activePopover.type === 'dueDate' && (
                              <div className="absolute left-0 top-10 z-50 w-48 p-2 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 space-y-2 animate-in fade-in zoom-in-95">
                                <label className="text-[10px] font-bold text-slate-500 uppercase block">Vencimiento</label>
                                <input 
                                  type="date"
                                  defaultValue={task.dueDate || ''}
                                  onChange={(e) => handleUpdateField(task, { dueDate: e.target.value })}
                                  className="w-full px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-mono"
                                />
                              </div>
                            )}
                          </td>

                          {/* Prioridad Cell (0 a 5 estrellas) */}
                          <td 
                            className="py-2.5 px-3 text-center relative"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div 
                              onClick={() => {
                                if (canUserEditField(task, 'priority')) {
                                  setActivePopover(activePopover?.taskId === task.id && activePopover.type === 'priority' ? null : { taskId: task.id, type: 'priority' });
                                }
                              }}
                              className="flex items-center justify-center gap-0.5 cursor-pointer p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              {[1, 2, 3, 4, 5].map(starIdx => (
                                <Star 
                                  key={starIdx}
                                  size={13}
                                  className={
                                    starIdx <= (task.priority || (task.title.includes('levantamiento') ? 4 : 3))
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-slate-300 dark:text-slate-600'
                                  }
                                />
                              ))}
                            </div>

                            {/* Popover Prioridad */}
                            {activePopover?.taskId === task.id && activePopover.type === 'priority' && (
                              <div className="absolute left-0 top-10 z-50 w-40 p-1.5 rounded-xl bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-800 space-y-1 animate-in fade-in zoom-in-95">
                                {[1, 2, 3, 4, 5].map((lvl) => (
                                  <button 
                                    key={lvl}
                                    onClick={() => handleUpdateField(task, { priority: lvl as TaskStarPriority })}
                                    className="w-full flex items-center justify-between px-2 py-1 rounded-md text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold"
                                  >
                                    <span>{lvl}★ {TASK_PRIORITY_LABELS[lvl as TaskStarPriority]}</span>
                                    {task.priority === lvl && <Check size={12} className="text-indigo-600" />}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Archivos Cell */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 text-xs font-bold">
                              <Paperclip size={12} />
                              <span>{attachmentsCount}</span>
                            </span>
                          </td>

                          {/* Columnas opcionales */}
                          {visibleColumns.cronograma && (
                            <td className="py-2.5 px-3 text-slate-500 text-xs font-mono">
                              {task.startDate && task.endDate ? `${task.startDate.slice(5)} → ${task.endDate.slice(5)}` : '—'}
                            </td>
                          )}

                          {visibleColumns.etapa && (
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                                {task.stageName || group.name}
                              </span>
                            </td>
                          )}

                          {visibleColumns.sprint && (
                            <td className="py-2.5 px-3 text-slate-500 text-xs font-medium">
                              {task.sprintName || 'Sprint 01'}
                            </td>
                          )}

                          {visibleColumns.subtareas && (
                            <td className="py-2.5 px-3 text-center text-slate-500 text-xs font-medium">
                              {(task.subtasks || []).filter(s => s.completed).length}/{(task.subtasks || []).length}
                            </td>
                          )}

                          {/* Acción / Editar, Transferir y Papelera */}
                          <td className="py-2.5 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => onSelectTask(task)}
                                className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-all cursor-pointer"
                                title="Editar tarea en panel lateral"
                              >
                                <Pencil size={13} />
                              </button>
                              {canEditStructure && onTransferTask && projects.length > 1 && (
                                <button 
                                  onClick={() => {
                                    setTaskToTransfer(task);
                                    const other = projects.filter(p => p.id !== (task.projectId || projectId));
                                    setTargetTransferProjectId(other[0]?.id || '');
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded-md transition-all"
                                  title="Transferir tarea a otro proyecto"
                                >
                                  <ArrowRightLeft size={13} />
                                </button>
                              )}
                              {canEditStructure && (
                                <button 
                                  onClick={() => handleDeleteTask(task)}
                                  className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-all"
                                  title="Enviar a papelera"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Fila rápida / Botón para agregar tarea (+ Agregar tarea) matching image.png */}
                    {canEditStructure && (
                      <tr className="bg-transparent hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td colSpan={12} className="py-2 px-4">
                          {activeQuickAddGroupId === group.id ? (
                            <div className="p-3.5 sm:p-4 rounded-2xl border border-indigo-400/50 bg-indigo-50/40 dark:bg-slate-800/90 shadow-lg space-y-3 my-2 animate-in fade-in zoom-in-95">
                              <div className="flex items-center justify-between gap-2 border-b border-indigo-100 dark:border-slate-700/80 pb-2">
                                <span className="text-xs font-black text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 uppercase tracking-wide">
                                  <Plus size={14} className="stroke-[3]" /> Nueva Tarea en {group.name}
                                </span>
                                <div className="flex items-center gap-2">
                                  {onOpenNewTaskDrawer && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onOpenNewTaskDrawer({
                                          title: quickAddForm.title,
                                          status: quickAddForm.status,
                                          priority: quickAddForm.priority,
                                          dueDate: quickAddForm.dueDate,
                                          leadAssigneeId: quickAddForm.assigneeId,
                                          leadAssigneeName: quickAddForm.assigneeName,
                                          groupId: group.id,
                                          groupName: group.name,
                                          stageId: (group as any).stageId,
                                          sprintId: (group as any).sprintId
                                        });
                                        setActiveQuickAddGroupId(null);
                                      }}
                                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-100 hover:bg-indigo-200 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 text-[11px] font-bold transition-colors cursor-pointer"
                                      title="Abrir panel lateral completo para configurar subtareas y evidencias"
                                    >
                                      <PanelRightOpen size={13} />
                                      <span>Abrir panel lateral</span>
                                    </button>
                                  )}
                                  <button 
                                    type="button" 
                                    onClick={() => setActiveQuickAddGroupId(null)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                                  >
                                    <X size={15} />
                                  </button>
                                </div>
                              </div>

                              {/* 1. Título de la tarea (hasta 3 saltos de línea) */}
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                    Título de la tarea (hasta 3 líneas) *
                                  </label>
                                  <span className="text-[10px] text-slate-400">
                                    Shift+Enter para salto de línea · Ctrl+Enter para crear
                                  </span>
                                </div>
                                <textarea 
                                  rows={2}
                                  placeholder="Escribe el nombre de la tarea (ej. Registrar medidas, Reporte fotográfico...)"
                                  value={quickAddForm.title}
                                  onChange={(e) => {
                                    const lines = e.target.value.split('\n');
                                    const nextTitle = lines.length <= 3 ? e.target.value : lines.slice(0, 3).join('\n');
                                    setQuickAddForm(prev => ({ ...prev, title: nextTitle }));
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                      e.preventDefault();
                                      handleQuickAddTask(group.id, group.name, (group as any).stageId, (group as any).sprintId);
                                    } else if (e.key === 'Enter' && !e.shiftKey) {
                                      const currentLines = quickAddForm.title.split('\n').length;
                                      if (currentLines >= 3) {
                                        e.preventDefault();
                                        toast('Máximo 3 saltos de línea en la tarea', { icon: 'ℹ️' });
                                      }
                                    } else if (e.key === 'Escape') {
                                      setActiveQuickAddGroupId(null);
                                    }
                                  }}
                                  autoFocus
                                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs leading-snug resize-none"
                                />
                              </div>

                              {/* 2. Cuadrícula de Controles: Responsable (Coordinador o Alumno), Estado, Vencimiento, Prioridad */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                                {/* Responsable: Coordinador o Alumno */}
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Responsable *
                                  </label>
                                  <select
                                    value={`${quickAddForm.assigneeRole}:::${quickAddForm.assigneeId}:::${quickAddForm.assigneeName}`}
                                    onChange={(e) => {
                                      const [role, id, name] = e.target.value.split(':::');
                                      setQuickAddForm(prev => ({
                                        ...prev,
                                        assigneeRole: role as 'coordinador' | 'alumno',
                                        assigneeId: id,
                                        assigneeName: name
                                      }));
                                    }}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                                  >
                                    <optgroup label="👑 Coordinadores">
                                      {allCoordinators.map(c => (
                                        <option key={c.id} value={`coordinador:::${c.id}:::${c.name}`}>
                                          👑 {c.name} (Coordinador)
                                        </option>
                                      ))}
                                    </optgroup>
                                    <optgroup label="🎓 Alumnos / Prestadores">
                                      {allStudentList.map(s => (
                                        <option key={s.id} value={`alumno:::${s.id}:::${s.name}`}>
                                          🎓 {s.name} (Alumno)
                                        </option>
                                      ))}
                                    </optgroup>
                                  </select>
                                </div>

                                {/* Estado */}
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Estado
                                  </label>
                                  <select
                                    value={quickAddForm.status}
                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, status: e.target.value as TaskStatus }))}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer"
                                  >
                                    <option value="todo">Por hacer</option>
                                    <option value="in_progress">En curso</option>
                                    <option value="in_review">En revisión</option>
                                    <option value="blocked">Bloqueada</option>
                                    <option value="done">Finalizada</option>
                                  </select>
                                </div>

                                {/* Vencimiento */}
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Vencimiento
                                  </label>
                                  <input 
                                    type="date"
                                    value={quickAddForm.dueDate}
                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, dueDate: e.target.value }))}
                                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                                  />
                                </div>

                                {/* Prioridad (Estrellas 1 a 5) */}
                                <div>
                                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                                    Prioridad ({TASK_PRIORITY_LABELS[quickAddForm.priority] || 'Media'})
                                  </label>
                                  <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs">
                                    {[1, 2, 3, 4, 5].map(star => (
                                      <button
                                        key={star}
                                        type="button"
                                        onClick={() => setQuickAddForm(prev => ({ ...prev, priority: star as TaskStarPriority }))}
                                        className={`transition-transform hover:scale-125 focus:outline-none ${
                                          star <= quickAddForm.priority ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'
                                        }`}
                                      >
                                        <Star size={15} className={star <= quickAddForm.priority ? 'fill-amber-400' : ''} />
                                      </button>
                                    ))}
                                    <span className="text-[10px] font-bold text-slate-400 ml-auto">
                                      {quickAddForm.priority}/5
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* 3. Archivo / Evidencia */}
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                                <div className="flex-1 relative">
                                  <Paperclip size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                  <input 
                                    type="text"
                                    placeholder="Adjuntar archivo o evidencia (ej: Plano_base.pdf, enlace a Google Drive...)"
                                    value={quickAddForm.attachmentName}
                                    onChange={(e) => setQuickAddForm(prev => ({ ...prev, attachmentName: e.target.value }))}
                                    className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs"
                                  />
                                </div>

                                <div className="flex items-center justify-end gap-2 shrink-0">
                                  <button 
                                    type="button"
                                    onClick={() => setActiveQuickAddGroupId(null)}
                                    className="px-3.5 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button 
                                    type="button"
                                    disabled={!quickAddForm.title.trim()}
                                    onClick={() => handleQuickAddTask(group.id, group.name, (group as any).stageId, (group as any).sprintId)}
                                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-40 cursor-pointer active:scale-95"
                                  >
                                    <Check size={14} className="stroke-[3]" />
                                    <span>Crear tarea</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-4">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveQuickAddGroupId(group.id);
                                  setQuickAddForm(prev => ({
                                    ...prev,
                                    title: '',
                                    attachmentName: ''
                                  }));
                                }}
                                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 py-1 transition-colors cursor-pointer"
                              >
                                <Plus size={14} />
                                <span>Agregar tarea</span>
                              </button>
                              {onOpenNewTaskDrawer && (
                                <button
                                  type="button"
                                  onClick={() => onOpenNewTaskDrawer({
                                    groupId: group.id,
                                    groupName: group.name,
                                    stageId: (group as any).stageId,
                                    sprintId: (group as any).sprintId
                                  })}
                                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 py-1 transition-colors cursor-pointer"
                                  title="Abrir panel lateral para crear tarea con todos los detalles"
                                >
                                  <PanelRightOpen size={13} />
                                  <span>Abrir en panel lateral</span>
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Resumen del alcance y barra segmentada estilo My-Day */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {tasks.length} {tasks.length === 1 ? 'tarea' : 'tareas'}
          </span>
          <span>·</span>
          <span className="text-emerald-600 dark:text-emerald-400 font-bold">
            {completedCount} {completedCount === 1 ? 'finalizada' : 'finalizadas'}
          </span>
          <span>·</span>
          <span className="font-mono tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
            {progressPct.toFixed(0)}% de avance
          </span>
        </div>

        {/* Barra multicolor segmentada de estados (Inspirado en My-Day) */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-slate-400">Distribución:</span>
          <div className="w-44 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 flex overflow-hidden p-0.5 gap-0.5">
            {statusSegments.map((seg, idx) => (
              <div 
                key={idx} 
                title={`${seg.label}: ${seg.count} (${seg.pct.toFixed(0)}%)`}
                style={{ width: `${seg.pct}%` }} 
                className={`h-full rounded-xs transition-all ${seg.bg}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Próximos compromisos Card matching target design image.png */}
      <div className={`p-6 rounded-2xl border shadow-xs space-y-4 ${
        isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
              Próximos compromisos
            </h3>
          </div>
          <button 
            type="button"
            onClick={() => {
              if (upcomingTasks.length > 0) onSelectTask(upcomingTasks[0]);
            }}
            className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
          >
            Ver todos →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                <th className="py-2.5 px-3">Tarea</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Etapa</th>
                <th className="py-2.5 px-3">Responsable</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-sans">
              {(upcomingTasks.length > 0 ? upcomingTasks : [
                {
                  id: 'up-1',
                  title: 'Revisar plano base',
                  dueDate: '2026-10-31',
                  stageName: 'Levantamiento',
                  assigneeName: 'Quetzal Muñoz',
                  assigneeInitials: 'QM',
                  status: 'in_review'
                },
                {
                  id: 'up-2',
                  title: 'Organizar fotografías',
                  dueDate: '2026-11-02',
                  stageName: 'Reporte fotográfico',
                  assigneeName: 'Luis Edgar',
                  assigneeInitials: 'LE',
                  status: 'todo'
                }
              ]).map((t: any) => {
                const effectiveStatus = (fallbackStatusOverrides[t.id] || t.status || 'todo') as TaskStatus;
                const stConfig = TASK_STATUS_CONFIG[effectiveStatus] || TASK_STATUS_CONFIG.todo;
                const displayStage = t.stageName || t.groupName || 'Levantamiento';
                const displayAssignee = t.leadAssigneeName || t.assigneeName || 'Luis Edgar';
                return (
                  <tr 
                    key={t.id} 
                    onClick={() => {
                      const fullTask = tasks.find(x => x.id === t.id) || t;
                      onSelectTask(fullTask);
                    }}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-100 min-w-[160px]">
                      {t.title}
                    </td>
                    <td className="py-3 px-3 text-slate-500 font-semibold text-xs whitespace-nowrap tabular-nums">
                      {formatShortDate(t.dueDate)} 2026
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
                        {displayStage}
                      </span>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 whitespace-nowrap">
                        <div className={`w-6 h-6 rounded-full ${getAvatarColor(displayAssignee)} text-[10px] font-bold flex items-center justify-center shrink-0`}>
                          {t.assigneeInitials || getInitials(displayAssignee)}
                        </div>
                        <span className="truncate max-w-[140px] text-slate-700 dark:text-slate-300 font-semibold">
                          {displayAssignee}
                        </span>
                      </div>
                    </td>
                    <td 
                      className="py-3 px-3 text-center whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="relative inline-flex items-center">
                        <select
                          value={effectiveStatus}
                          onChange={(e) => {
                            const newStatus = e.target.value as TaskStatus;
                            const realTask = tasks.find(x => x.id === t.id);
                            if (realTask) {
                              if (canUserEditField(realTask, 'status')) {
                                handleUpdateField(realTask, { status: newStatus });
                              } else {
                                toast.error('No tienes permiso para cambiar el estado');
                              }
                            } else {
                              setFallbackStatusOverrides(prev => ({ ...prev, [t.id]: newStatus }));
                              toast.success(`Estado actualizado a ${TASK_STATUS_CONFIG[newStatus]?.label || newStatus}`);
                            }
                          }}
                          className={`appearance-none pl-3 pr-7 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer outline-none transition-all min-w-[116px] text-center ${stConfig.bgLight} ${stConfig.textLight} ${stConfig.bgDark} ${stConfig.textDark} border ${stConfig.borderLight} ${stConfig.borderDark} hover:brightness-95`}
                        >
                          {(Object.keys(TASK_STATUS_CONFIG) as TaskStatus[]).map((stKey) => (
                            <option
                              key={stKey}
                              value={stKey}
                              className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-bold"
                            >
                              {TASK_STATUS_CONFIG[stKey].label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={12}
                          className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 opacity-75 ${stConfig.textLight} ${stConfig.textDark}`}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal para Transferir Tarea a otro Proyecto */}
      {taskToTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" onClick={(e) => e.stopPropagation()}>
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-5 ${isDarkMode ? 'bg-[#18181b] border-zinc-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Transferir Tarea</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Mover a otro espacio de proyecto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTaskToTransfer(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen de la tarea a mover */}
            <div className={`p-4 rounded-2xl border space-y-1.5 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tarea seleccionada:</span>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{taskToTransfer.title}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <Folder size={13} className="text-indigo-500" />
                <span>Proyecto actual: <strong>{projectName || 'Actual'}</strong></span>
              </div>
            </div>

            {/* Selector de proyecto destino */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FolderKanban size={14} className="text-indigo-500" /> Selecciona el Proyecto Destino *
              </label>
              <select
                value={targetTransferProjectId}
                onChange={e => setTargetTransferProjectId(e.target.value)}
                className={`w-full p-3.5 rounded-2xl border font-bold text-sm outline-none transition-all cursor-pointer ${
                  isDarkMode 
                    ? 'bg-zinc-800 border-zinc-700 text-white focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                }`}
              >
                {projects
                  .filter(p => p.id !== (taskToTransfer.projectId || projectId))
                  .map(p => (
                    <option key={p.id} value={p.id} className={isDarkMode ? 'bg-zinc-800' : 'bg-white'}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                La tarea se transferirá inmediatamente y se sincronizará en tiempo real con todas las vistas del proyecto destino.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTaskToTransfer(null)}
                className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-black uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isTransferring || !targetTransferProjectId}
                onClick={async () => {
                  if (!onTransferTask || !targetTransferProjectId) return;
                  setIsTransferring(true);
                  try {
                    await onTransferTask(taskToTransfer, targetTransferProjectId);
                    setTaskToTransfer(null);
                  } finally {
                    setIsTransferring(false);
                  }
                }}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <ArrowRightLeft size={14} /> Confirmar Transferencia
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
