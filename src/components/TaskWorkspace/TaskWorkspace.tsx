import React, { useState, useEffect, useMemo } from 'react';
import { 
  Table, 
  Kanban, 
  BarChart3, 
  Calendar as CalendarIcon, 
  Search, 
  Filter, 
  User as UserIcon, 
  Plus, 
  Sparkles, 
  RefreshCw, 
  CheckCircle2, 
  ArrowUpDown,
  SlidersHorizontal,
  ChevronDown,
  Layers,
  X,
  Star,
  Paperclip,
  Check,
  Lock,
  Briefcase
} from 'lucide-react';
import { 
  ProjectTask, 
  TaskGroup, 
  TaskPriority, 
  TaskStatus,
  TaskStarPriority,
  TASK_PRIORITY_LABELS
} from '../../types/tasks';
import { 
  subscribeToProjectTasks, 
  subscribeToAllTasks, 
  createTask, 
  runTaskDataMigration,
  normalizeTask,
  sanitizeForFirestore,
  DEFAULT_GROUPS 
} from '../../services/taskService';
import { 
  getGoogleTasksToken, 
  getOrCreateProjectTaskList, 
  syncTaskToGoogle, 
  fetchTasksFromGoogle 
} from '../../services/googleTasksService';
import { TaskTableView } from './TaskTableView';
import { TaskKanbanView } from './TaskKanbanView';
import { TaskGanttView } from './TaskGanttView';
import { TaskCalendarView } from './TaskCalendarView';
import { TaskDetailModal } from './TaskDetailModal';
import { AiTaskSuggestionsModal } from './AiTaskSuggestionsModal';
import { doc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

interface TaskWorkspaceProps {
  initialProjectId?: string;
  projects: any[];
  students: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  isDarkMode: boolean;
  onLogHoursForTask?: (task: ProjectTask) => void;
  stages?: any[];
  sprints?: any[];
  initialView?: 'table' | 'kanban' | 'gantt' | 'calendar';
  initialGrouping?: 'stage' | 'sprint' | 'status' | 'session' | 'group' | 'none';
  initialStageFilter?: string;
  initialStatusFilter?: string;
  initialAssigneeFilter?: string;
  initialIsCriticalFilter?: boolean;
  onOpenSprintConfig?: () => void;
  onNavigateToPlanning?: (tool: 'sprints' | 'stages' | 'cpm' | 'gantt') => void;
  enrolledProjectIds?: string[];
  onOpenProjectDirectory?: () => void;
}

export const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({
  initialProjectId,
  projects,
  students,
  currentUserId,
  currentUserName,
  currentUserRole,
  isDarkMode,
  onLogHoursForTask,
  stages = [],
  sprints = [],
  initialView = 'table',
  initialGrouping = 'stage',
  initialStageFilter = 'all',
  initialStatusFilter = 'all',
  initialAssigneeFilter = 'all',
  initialIsCriticalFilter = false,
  onOpenSprintConfig,
  onNavigateToPlanning,
  enrolledProjectIds,
  onOpenProjectDirectory
}) => {
  // Role permissions
  const isMasterOrSuper = currentUserRole === 'master_coordinator' || currentUserRole === 'super_coordinator' || currentUserRole === 'admin';
  const isCoord = isMasterOrSuper || currentUserRole === 'coordinator';
  const isStudentCoord = currentUserRole === 'student_coordinator';
  const isStudent = !isCoord && !isStudentCoord;

  // Strictly filter projects for non-coordinator users to only those where they are enrolled
  const allowedProjects = useMemo(() => {
    if (isCoord) return projects;
    const studentRecord = students.find(s => s.id === currentUserId || s.uid === currentUserId);
    const enrolledSet = new Set<string>([
      ...(enrolledProjectIds || []),
      ...(studentRecord?.projectIds || [])
    ].filter(Boolean));
    return projects.filter(p =>
      enrolledSet.has(p.id) ||
      (Array.isArray(p.coordinatorIds) && p.coordinatorIds.includes(currentUserId))
    );
  }, [isCoord, projects, students, currentUserId, enrolledProjectIds]);

  const allowedProjectsKey = useMemo(
    () => allowedProjects.map(p => p.id).filter(Boolean).sort().join(','),
    [allowedProjects]
  );

  const allowedProjectIds = useMemo(
    () => new Set(allowedProjectsKey ? allowedProjectsKey.split(',') : []),
    [allowedProjectsKey]
  );

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => {
    if (initialProjectId && (isCoord || allowedProjects.some(p => p.id === initialProjectId))) {
      return initialProjectId;
    }
    if (allowedProjects.length > 0) {
      return allowedProjects[0].id;
    }
    return isCoord ? 'all' : '';
  });

  useEffect(() => {
    if (isCoord) return;
    if (allowedProjects.length === 0) {
      if (selectedProjectId !== '') setSelectedProjectId('');
      return;
    }
    const isValidSelection =
      (selectedProjectId === 'all' && allowedProjects.length > 1) ||
      allowedProjectIds.has(selectedProjectId);
    if (!isValidSelection) {
      setSelectedProjectId(allowedProjects[0].id);
    }
  }, [isCoord, allowedProjectsKey, selectedProjectId]);
  const [activeTab, setActiveTab] = useState<'table' | 'kanban' | 'gantt' | 'calendar'>(initialView);
  const [groupBy, setGroupBy] = useState<'stage' | 'sprint' | 'status' | 'session' | 'group' | 'none'>(initialGrouping);
  const [selectedStage, setSelectedStage] = useState<string>(initialStageFilter);
  const [selectedSprint, setSelectedSprint] = useState<string>('all');
  const [isCriticalFilter, setIsCriticalFilter] = useState<boolean>(initialIsCriticalFilter);
  const [showGroupByMenu, setShowGroupByMenu] = useState(false);
  const [showColumnsMenu, setShowColumnsMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({
    personasAsignadas: true,
    cronograma: false,
    etapa: false,
    sprint: false,
    subtareas: false
  });
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>(DEFAULT_GROUPS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(initialAssigneeFilter);
  const [selectedStatus, setSelectedStatus] = useState(initialStatusFilter);
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);

  // Lista categorizada de Coordinadores y Alumnos para asignación
  const allCoordinators = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    if (currentUserName && (currentUserRole?.includes('coord') || currentUserRole === 'admin')) {
      list.push({ id: currentUserId, name: currentUserName });
    } else {
      list.push({ id: 'u-luis', name: 'Luis Edgar' });
    }
    students.filter(s => s.role === 'coordinator' || s.isCoordinator || s.role === 'coordinador').forEach(s => {
      const name = s.fullName || s.name || s.email;
      if (!list.some(c => c.id === s.id || c.name === name)) {
        list.push({ id: s.id, name });
      }
    });
    return list;
  }, [currentUserId, currentUserName, currentUserRole, students]);

  const allStudentList = useMemo(() => {
    const studentOnly = students.filter(s => s.role !== 'coordinator' && !s.isCoordinator && s.role !== 'coordinador');
    if (studentOnly.length > 0) {
      return studentOnly.map(s => ({
        id: s.id,
        name: s.fullName || s.name || s.email || 'Alumno'
      }));
    }
    if (students.length > 0) {
      return students.map(s => ({
        id: s.id,
        name: s.fullName || s.name || s.email || 'Alumno'
      }));
    }
    return [
      { id: 'u-daniela', name: 'Daniela Méndez' },
      { id: 'u-quetzal', name: 'Quetzal Muñoz' }
    ];
  }, [students]);

  const [quickTaskForm, setQuickTaskForm] = useState<{
    title: string;
    group: string;
    assigneeRole: 'coordinador' | 'alumno';
    assigneeId: string;
    assigneeName: string;
    status: TaskStatus;
    dueDate: string;
    priority: TaskStarPriority;
    attachmentName: string;
  }>({
    title: '',
    group: 'pendientes',
    assigneeRole: (currentUserRole?.includes('coord') || currentUserRole === 'admin') ? 'coordinador' : 'coordinador',
    assigneeId: currentUserId || 'u-luis',
    assigneeName: currentUserName || 'Luis Edgar',
    status: 'todo',
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    priority: 3,
    attachmentName: ''
  });

  // Active project object
  const currentProject = useMemo(() => {
    if (!selectedProjectId || selectedProjectId === 'all') return null;
    return allowedProjects.find(p => p.id === selectedProjectId) || null;
  }, [selectedProjectId, allowedProjects]);

  const [localTaskOverrides, setLocalTaskOverrides] = useState<Record<string, ProjectTask>>({});

  // Limpiar overrides al cambiar de proyecto
  useEffect(() => {
    setLocalTaskOverrides({});
  }, [selectedProjectId]);

  const sampleIdPrefix = (selectedProjectId && selectedProjectId !== 'all') ? `${selectedProjectId}_` : '';
  const sampleProjName = currentProject?.name || 'CORSAC Remodelación';

  // Sample tasks fallback scoped per project so assignments never collide across projects
  const sampleCorsacTasks: ProjectTask[] = useMemo(() => [
    normalizeTask({
      id: `${sampleIdPrefix}cor-014`,
      projectId: selectedProjectId,
      projectName: sampleProjName,
      version: 1,
      stageId: 'stage-lev',
      stageName: 'Levantamiento',
      sprintId: 'sp-01',
      sprintName: 'Sprint 01',
      groupId: 'grp-lev',
      groupName: 'Levantamiento',
      title: 'Realizar levantamiento',
      description: 'Registrar dimensiones y condiciones del sitio.',
      status: 'in_progress',
      priority: 4,
      leadAssigneeId: 'u-luis',
      leadAssigneeName: 'Luis Edgar',
      assigneeIds: ['u-luis'],
      dueDate: '2026-10-30',
      startDate: '2026-10-27',
      endDate: '2026-10-30',
      subtasks: [
        { id: 'sub-1', title: 'Preparar plano base', completed: true },
        { id: 'sub-2', title: 'Verificar medidas en campo', completed: false }
      ],
      attachments: [
        {
          id: 'att-1',
          name: 'Plano_base.pdf',
          url: '#',
          uploadedBy: 'u-daniela',
          uploadedByName: 'Daniela Méndez',
          uploadedAt: '2026-10-28T10:00:00Z',
          fileSize: '745 KB'
        } as any,
        {
          id: 'att-2',
          name: 'Reporte_fotografico_sitio.zip',
          url: '#',
          uploadedBy: 'u-luis',
          uploadedByName: 'Luis Edgar',
          uploadedAt: '2026-10-29T12:00:00Z',
          fileSize: '3.2 MB'
        } as any
      ],
      comments: [
        {
          id: 'com-1',
          userId: 'u-daniela',
          userName: 'Daniela Méndez',
          content: 'Plano base escaneado, esperando verificación de cotas.',
          createdAt: '2026-10-28T11:00:00Z'
        }
      ],
      history: [
        {
          id: 'h-1',
          userId: 'u-luis',
          userName: 'Luis Edgar',
          action: 'Actualizó estado a En curso',
          timestamp: '2026-10-29T14:00:00Z'
        }
      ]
    }),
    normalizeTask({
      id: `${sampleIdPrefix}cor-015`,
      projectId: selectedProjectId,
      projectName: sampleProjName,
      version: 1,
      stageId: 'stage-lev',
      stageName: 'Levantamiento',
      sprintId: 'sp-01',
      sprintName: 'Sprint 01',
      groupId: 'grp-lev',
      groupName: 'Levantamiento',
      title: 'Registrar medidas',
      description: 'Toma de medidas en campo y verificación de paños.',
      status: 'done',
      priority: 3,
      leadAssigneeId: 'u-daniela',
      leadAssigneeName: 'Daniela Méndez',
      assigneeIds: ['u-daniela'],
      dueDate: '2026-10-28',
      startDate: '2026-10-25',
      endDate: '2026-10-28',
      subtasks: [{ id: 'sub-3', title: 'Registro de cotas', completed: true }],
      attachments: [{ id: 'att-3', name: 'Medidas_campo.xlsx', url: '#' }] as any
    }),
    normalizeTask({
      id: `${sampleIdPrefix}cor-016`,
      projectId: selectedProjectId,
      projectName: sampleProjName,
      version: 1,
      stageId: 'stage-lev',
      stageName: 'Levantamiento',
      sprintId: 'sp-01',
      sprintName: 'Sprint 01',
      groupId: 'grp-lev',
      groupName: 'Levantamiento',
      title: 'Revisar plano base',
      description: 'Revisión técnica de escalas y ejes estructurales.',
      status: 'in_review',
      priority: 3,
      leadAssigneeId: 'u-quetzal',
      leadAssigneeName: 'Quetzal Muñoz',
      assigneeIds: ['u-quetzal'],
      dueDate: '2026-10-31',
      startDate: '2026-10-28',
      endDate: '2026-10-31',
      subtasks: [{ id: 'sub-4', title: 'Cotejo con catastro', completed: true }],
      attachments: [{ id: 'att-4', name: 'Plano_revisado.dwg', url: '#' }] as any
    }),
    normalizeTask({
      id: `${sampleIdPrefix}cor-017`,
      projectId: selectedProjectId,
      projectName: sampleProjName,
      version: 1,
      stageId: 'stage-rep',
      stageName: 'Reporte fotográfico',
      sprintId: 'sp-01',
      sprintName: 'Sprint 01',
      groupId: 'grp-rep',
      groupName: 'Reporte fotográfico',
      title: 'Organizar fotografías',
      description: 'Clasificación de fotos por zonas y patologías.',
      status: 'todo',
      priority: 2,
      leadAssigneeId: 'u-luis',
      leadAssigneeName: 'Luis Edgar',
      assigneeIds: ['u-luis'],
      dueDate: '2026-11-02',
      startDate: '2026-11-01',
      endDate: '2026-11-02',
      subtasks: [],
      attachments: []
    }),
    normalizeTask({
      id: `${sampleIdPrefix}cor-018`,
      projectId: selectedProjectId,
      projectName: sampleProjName,
      version: 1,
      stageId: 'stage-rep',
      stageName: 'Reporte fotográfico',
      sprintId: 'sp-01',
      sprintName: 'Sprint 01',
      groupId: 'grp-rep',
      groupName: 'Reporte fotográfico',
      title: 'Integrar reporte',
      description: 'Consolidación del informe técnico final.',
      status: 'blocked',
      blockReason: 'Faltan fotografías del área de cubiertas.',
      priority: 3,
      leadAssigneeId: 'u-daniela',
      leadAssigneeName: 'Daniela Méndez',
      assigneeIds: ['u-daniela'],
      dueDate: '2026-11-04',
      startDate: '2026-11-02',
      endDate: '2026-11-04',
      subtasks: [{ id: 'sub-5', title: 'Plantilla de informe', completed: false }],
      attachments: [{ id: 'att-5', name: 'Borrador_reporte.docx', url: '#' }] as any
    })
  ], [selectedProjectId, sampleIdPrefix, sampleProjName]);

  const handleTaskOptimisticUpdate = React.useCallback((updatedTask: ProjectTask) => {
    setLocalTaskOverrides(prev => ({
      ...prev,
      [updatedTask.id]: updatedTask
    }));

    if (selectedTask && selectedTask.id === updatedTask.id) {
      setSelectedTask(updatedTask);
    }

    // Si el proyecto estaba usando las 5 tareas base de plantilla (tasks.length === 0),
    // persistir también las otras 4 tareas base para que no desaparezcan al activarse la suscripción de Firestore
    if (tasks.length === 0 && selectedProjectId && selectedProjectId !== 'all') {
      const siblingSamples = sampleCorsacTasks.filter(st => st.id !== updatedTask.id);
      siblingSamples.forEach(st => {
        const cleanSample = sanitizeForFirestore({
          ...st,
          projectId: selectedProjectId,
          projectName: sampleProjName,
          deletedAt: null
        });
        setDoc(doc(db, 'tasks', st.id), cleanSample, { merge: true }).catch(() => {});
        setDoc(doc(db, 'projects', selectedProjectId, 'tasks', st.id), cleanSample, { merge: true }).catch(() => {});
      });
    }
  }, [tasks.length, selectedProjectId, sampleCorsacTasks, sampleProjName, selectedTask]);

  const effectiveTasks = useMemo(() => {
    const baseList = tasks.length > 0 ? tasks : (isCoord ? sampleCorsacTasks : []);
    return baseList.map(t => {
      const override = localTaskOverrides[t.id];
      if (!override) return t;
      // Si el override tiene mayor o igual versión, conservar cambios optimistas
      if ((override.version || 1) >= (t.version || 1)) {
        return { ...t, ...override };
      }
      return t;
    });
  }, [tasks, isCoord, sampleCorsacTasks, localTaskOverrides]);

  // Sincronizar filtros externos si cambian
  useEffect(() => {
    if (initialStageFilter !== undefined) setSelectedStage(initialStageFilter);
    if (initialStatusFilter !== undefined) setSelectedStatus(initialStatusFilter);
    if (initialAssigneeFilter !== undefined) setSelectedAssignee(initialAssigneeFilter);
    if (initialIsCriticalFilter !== undefined) setIsCriticalFilter(initialIsCriticalFilter);
    if (initialView) setActiveTab(initialView);
  }, [initialStageFilter, initialStatusFilter, initialAssigneeFilter, initialIsCriticalFilter, initialView]);

  const canEditStructure = isCoord || (isStudentCoord && currentProject?.coordinatorIds?.includes(currentUserId));
  const canEditStatus = true; // All students can update status on their assigned tasks

  // Real-time listener
  useEffect(() => {
    if (!isCoord && !allowedProjectsKey) {
      setTasks([]);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    if (selectedProjectId && selectedProjectId !== 'all') {
      if (!isCoord && !allowedProjectIds.has(selectedProjectId)) {
        setTasks([]);
        return;
      }
      unsubscribe = subscribeToProjectTasks(selectedProjectId, (updated) => {
        setTasks(updated);
      });
    } else {
      unsubscribe = subscribeToAllTasks((updated) => {
        setTasks(isCoord ? updated : updated.filter(t => allowedProjectIds.has(t.projectId)));
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedProjectId, isCoord, allowedProjectsKey]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return effectiveTasks.filter(task => {
      // Non-coordinators can only see tasks belonging to their enrolled projects
      if (!isCoord && !allowedProjectIds.has(task.projectId)) {
        return false;
      }

      // If student in global view, by default only show tasks where they are assigned or open
      if (isStudent && selectedProjectId === 'all') {
        const isAssigned = (task.assigneeIds || []).includes(currentUserId) || task.leadAssigneeId === currentUserId;
        if (!isAssigned) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = (task.description || '').toLowerCase().includes(q);
        const matchesProject = task.projectName.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesProject) return false;
      }

      if (selectedAssignee !== 'all') {
        const matchesLead = task.leadAssigneeId === selectedAssignee;
        const matchesList = (task.assigneeIds || []).includes(selectedAssignee);
        const matchesLegacy = (task as any).assignedTo === selectedAssignee;
        if (!matchesLead && !matchesList && !matchesLegacy) return false;
      }

      if (selectedStatus !== 'all') {
        if (task.status !== selectedStatus) return false;
      }

      if (selectedPriority !== 'all') {
        if (String(task.priority) !== selectedPriority) return false;
      }

      if (selectedStage !== 'all') {
        if (task.stageId !== selectedStage) return false;
      }

      if (selectedSprint !== 'all') {
        if (task.sprintId !== selectedSprint) return false;
      }

      if (isCriticalFilter) {
        if (!task.isCritical) return false;
      }

      return true;
    });
  }, [effectiveTasks, searchTerm, selectedAssignee, selectedStatus, selectedPriority, selectedStage, selectedSprint, isCriticalFilter, isStudent, isCoord, allowedProjectIds, currentUserId, selectedProjectId]);

  // Google Tasks bidirectional sync
  const handleSyncGoogleTasks = async () => {
    setIsSyncingGoogle(true);
    const toastId = toast.loading('Conectando con Google Tasks...');

    try {
      const token = await getGoogleTasksToken(true);
      if (!token) {
        toast.dismiss(toastId);
        return;
      }

      const projName = currentProject ? currentProject.name : 'General';
      const listId = await getOrCreateProjectTaskList(token, projName);

      // 1. Push local tasks to Google Tasks
      let pushedCount = 0;
      for (const t of filteredTasks.slice(0, 15)) {
        await syncTaskToGoogle(token, listId, t);
        pushedCount++;
      }

      // 2. Pull remote tasks from Google Tasks
      const remoteItems = await fetchTasksFromGoogle(token, listId);
      let updatedCount = 0;

      for (const rItem of remoteItems) {
        if (rItem.status === 'completed') {
          // If a corresponding task exists locally and is not done, we can sync it
          const localMatch = tasks.find(t => t.googleTaskId === rItem.id || t.title.toLowerCase() === rItem.title.toLowerCase());
          if (localMatch && localMatch.status !== 'done') {
            updatedCount++;
          }
        }
      }

      toast.success(`Google Tasks sincronizado: ${pushedCount} tareas enviadas`, { id: toastId });
    } catch (err: any) {
      console.error('Error syncing Google Tasks:', err);
      toast.error(`Error al sincronizar: ${err.message || 'Desconocido'}`, { id: toastId });
    } finally {
      setIsSyncingGoogle(false);
    }
  };

  const handleAddGroup = (name: string) => {
    const newGroup: TaskGroup = {
      id: name.toLowerCase().replace(/\s+/g, '_'),
      name,
      color: '#6366f1',
      order: groups.length
    };
    setGroups([...groups, newGroup]);
    toast.success(`Grupo "${name}" creado`);
  };

  const handleOpenNewTaskDrawer = (defaults?: Partial<ProjectTask>) => {
    const today = new Date().toISOString().split('T')[0];
    const pId = currentProject ? currentProject.id : (allowedProjects[0]?.id || projects[0]?.id || 'general');
    const pName = currentProject ? currentProject.name : (allowedProjects[0]?.name || projects[0]?.name || 'General');
    const draftTask: ProjectTask = normalizeTask({
      id: '__new__',
      projectId: pId,
      projectName: pName,
      version: 1,
      title: defaults?.title || '',
      description: defaults?.description || '',
      status: defaults?.status || 'todo',
      priority: defaults?.priority ?? 3,
      groupId: defaults?.groupId || 'pendientes',
      groupName: defaults?.groupName || 'Pendientes',
      stageId: defaults?.stageId,
      stageName: defaults?.stageName,
      sprintId: defaults?.sprintId,
      sprintName: defaults?.sprintName,
      leadAssigneeId: defaults?.leadAssigneeId || currentUserId,
      leadAssigneeName: defaults?.leadAssigneeName || currentUserName,
      assigneeIds: defaults?.assigneeIds || [currentUserId],
      dueDate: defaults?.dueDate || today,
      startDate: defaults?.startDate || today,
      endDate: defaults?.endDate || defaults?.dueDate || today,
      subtasks: [],
      attachments: defaults?.attachments || [],
      createdBy: currentUserId,
      createdByName: currentUserName
    });
    setSelectedTask(draftTask);
  };

  const handleQuickCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskForm.title.trim()) {
      toast.error('El título de la tarea es obligatorio');
      return;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const dueDate = quickTaskForm.dueDate || today;
      const pId = currentProject ? currentProject.id : (projects[0]?.id || 'general');
      const pName = currentProject ? currentProject.name : (projects[0]?.name || 'General');

      const attachments = quickTaskForm.attachmentName.trim() ? [{
        id: `att_${Date.now().toString(36)}`,
        name: quickTaskForm.attachmentName.trim(),
        url: '#',
        uploadedBy: currentUserId,
        uploadedByName: currentUserName,
        uploadedAt: new Date().toISOString()
      }] : [];

      await createTask({
        projectId: pId,
        projectName: pName,
        groupId: quickTaskForm.group,
        groupName: groups.find(g => g.id === quickTaskForm.group)?.name || 'Pendientes',
        title: quickTaskForm.title.trim(),
        leadAssigneeId: quickTaskForm.assigneeId,
        leadAssigneeName: quickTaskForm.assigneeName,
        leadAssigneeRole: quickTaskForm.assigneeRole,
        assigneeIds: [quickTaskForm.assigneeId],
        status: quickTaskForm.status,
        priority: quickTaskForm.priority,
        startDate: today,
        endDate: dueDate,
        dueDate: dueDate,
        attachments,
        subtasks: [],
        createdBy: currentUserId,
        createdByName: currentUserName,
        updatedBy: currentUserId
      }, {
        id: currentUserId,
        name: currentUserName,
        role: currentUserRole
      });

      setQuickTaskForm(prev => ({
        ...prev,
        title: '',
        attachmentName: ''
      }));
      setShowQuickAddModal(false);
      toast.success('Tarea creada y sincronizada');
    } catch (err) {
      console.error(err);
      toast.error('Error al crear tarea');
    }
  };

  // Transferencia de tarea entre proyectos
  const handleTransferTaskToProject = async (task: ProjectTask, targetProjectId: string) => {
    if (!targetProjectId || targetProjectId === task.projectId) return;
    const targetProject = projects.find(p => p.id === targetProjectId);
    if (!targetProject) return;

    const loadingToast = toast.loading(`Transfiriendo tarea a "${targetProject.name}"...`);
    try {
      const now = new Date().toISOString();
      const updates: any = {
        projectId: targetProjectId,
        projectName: targetProject.name,
        updatedAt: now,
        updatedBy: currentUserId
      };

      await updateDoc(doc(db, 'tasks', task.id), updates);
      try {
        await deleteDoc(doc(db, 'projects', task.projectId, 'tasks', task.id));
      } catch (_) {}
      try {
        await setDoc(doc(db, 'projects', targetProjectId, 'tasks', task.id), {
          ...task,
          ...updates
        }, { merge: true });
      } catch (_) {}

      toast.dismiss(loadingToast);
      toast.success(`Tarea transferida a "${targetProject.name}" exitosamente.`);
      setSelectedTask(null);
      setTasks(prev => prev.filter(t => t.id !== task.id));
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error("Error al transferir tarea:", err);
      toast.error("Error al transferir tarea de proyecto");
    }
  };

  // Calculation of progress: done / total active non-deleted in scope
  const totalScopeTasks = filteredTasks.length;
  const completedScopeTasks = filteredTasks.filter(t => t.status === 'done').length;
  const progressRatio = totalScopeTasks > 0 ? (completedScopeTasks / totalScopeTasks) * 100 : null;

  const handleRunMigration = async () => {
    if (!window.confirm('¿Deseas normalizar las tareas existentes al esquema de 5 estados estándar y prioridades 0-5? Se generará un respaldo automático.')) {
      return;
    }
    const toastId = toast.loading('Normalizando tareas...');
    try {
      const res = await runTaskDataMigration();
      if (res.success) {
        toast.success(res.report.join(' · '), { id: toastId });
      } else {
        toast.error('Error durante la migración de tareas', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error en migración', { id: toastId });
    }
  };

  if (!isCoord && allowedProjects.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        <div className={`p-8 sm:p-14 rounded-3xl border text-center max-w-2xl mx-auto my-8 space-y-5 shadow-sm ${
          isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
            <Lock size={28} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl sm:text-2xl font-black tracking-tight">
              Sin proyectos enrolados
            </h2>
            <p className={`text-xs sm:text-sm max-w-md mx-auto leading-relaxed ${
              isDarkMode ? 'text-slate-400' : 'text-slate-500'
            }`}>
              Actualmente no estás enrolado en ningún proyecto activo. Por privacidad, la información y el tablero de tareas solo están disponibles para los integrantes asignados a cada proyecto.
            </p>
          </div>
          {onOpenProjectDirectory && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenProjectDirectory}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-600/20 transition-all active:scale-95 cursor-pointer"
              >
                <Briefcase size={16} />
                <span>Ver Directorio de Proyectos</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Section */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-sm space-y-4 sm:space-y-5 overflow-hidden ${
        isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-slate-200'
      }`}>
        {/* Project Selector & Main Action Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black shrink-0">
              <Layers size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 max-w-full">
                {allowedProjects.length > 0 ? (
                  <div className="relative inline-flex items-center max-w-full">
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className={`text-lg sm:text-2xl font-black bg-transparent border-none outline-none cursor-pointer tracking-tight truncate pr-6 max-w-full ${
                        isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {!initialProjectId && (isCoord || allowedProjects.length > 1) && (
                        <option value="all" className="text-slate-800">
                          {isCoord ? 'Todos los Proyectos (Vista Consolidada)' : 'Mis Proyectos Enrolados (Vista Consolidada)'}
                        </option>
                      )}
                      {allowedProjects.map(p => (
                        <option key={p.id} value={p.id} className="text-slate-800">
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} className="text-slate-400 absolute right-0 pointer-events-none" />
                  </div>
                ) : (
                  <h2 className="text-lg sm:text-2xl font-black truncate">Tablero de Tareas</h2>
                )}
              </div>

              {/* Exact Progress Denominator */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1 text-xs">
                {progressRatio !== null ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="w-20 sm:w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-300" 
                        style={{ width: `${progressRatio}%` }}
                      />
                    </div>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-[11px] sm:text-xs">
                      {completedScopeTasks}/{totalScopeTasks} finalizadas ({progressRatio.toFixed(1)}%)
                    </span>
                  </div>
                ) : (
                  <span className="text-slate-400 italic text-[11px]">Sin tareas para calcular</span>
                )}
                <span className="text-slate-300 dark:text-slate-700 hidden xs:inline">·</span>
                <span className="text-slate-400 uppercase tracking-widest font-bold text-[9px] sm:text-[10px]">
                  {currentProject ? currentProject.code || 'Proyecto' : 'Global'}
                </span>
              </div>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {canEditStructure && (
              <button
                type="button"
                onClick={handleRunMigration}
                title="Normalizar y migrar datos de tareas al esquema unificado con respaldo automático"
                className={`flex-1 sm:flex-none px-3 py-2 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isDarkMode ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <RefreshCw size={13} />
                <span>Normalizar Datos</span>
              </button>
            )}

            {canEditStructure && (
              <button
                type="button"
                onClick={() => handleOpenNewTaskDrawer()}
                className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-1.5 active:scale-95 whitespace-nowrap cursor-pointer"
              >
                <Plus size={15} />
                <span>Agregar tarea</span>
              </button>
            )}

            {canEditStructure && currentProject && (
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isDarkMode 
                    ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10' 
                    : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Sparkles size={15} className="text-indigo-500" />
                <span>Sugerencias de IA</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSyncGoogleTasks}
              disabled={isSyncingGoogle}
              title="Sincronizar tareas con tu cuenta de Google Tasks"
              className={`flex-1 sm:flex-none px-3.5 py-2 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                isDarkMode 
                  ? 'border-white/10 text-gray-300 hover:bg-white/5' 
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RefreshCw size={13} className={isSyncingGoogle ? 'animate-spin text-indigo-500' : ''} />
              <span>Google Tasks</span>
            </button>
          </div>
        </div>

        {/* View Tabs Bar, Grouping & Columns Controls */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 space-y-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            {/* 4 Views Tabs */}
            <div className={`p-1 rounded-2xl flex items-center gap-1 overflow-x-auto hide-scrollbar max-w-full ${
              isDarkMode ? 'bg-white/5' : 'bg-slate-100'
            }`}>
              <button
                type="button"
                onClick={() => setActiveTab('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'table'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Table size={14} />
                <span>Tabla</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'kanban'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Kanban size={14} />
                <span>Kanban</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('gantt')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'gantt'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BarChart3 size={14} />
                <span>Gantt</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 ${
                  activeTab === 'calendar'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <CalendarIcon size={14} />
                <span>Calendario</span>
              </button>
            </div>

            {/* Right Controls: Grouping & Columns Config */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Grouping Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowGroupByMenu(!showGroupByMenu)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isDarkMode ? 'bg-zinc-800/80 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <Layers size={14} className="text-indigo-500" />
                  <span>
                    Agrupar: {groupBy === 'stage' ? 'Etapa' : groupBy === 'session' ? 'Sesiones' : groupBy === 'sprint' ? 'Sprint' : groupBy === 'status' ? 'Estado' : 'Sin agrupar'}
                  </span>
                  <ChevronDown size={13} className="text-slate-400" />
                </button>

                {showGroupByMenu && (
                  <div className="absolute right-0 top-11 z-50 w-52 p-1.5 rounded-xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200 dark:border-white/10 space-y-1 animate-in fade-in zoom-in-95">
                    <button
                      type="button"
                      onClick={() => { setGroupBy('stage'); setShowGroupByMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium ${groupBy === 'stage' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      Etapas del proyecto (Secciones)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGroupBy('session'); setShowGroupByMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium ${groupBy === 'session' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      Sesiones de trabajo
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGroupBy('sprint'); setShowGroupByMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium ${groupBy === 'sprint' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      Sprint activo
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGroupBy('status'); setShowGroupByMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium ${groupBy === 'status' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      Estado
                    </button>
                    <button
                      type="button"
                      onClick={() => { setGroupBy('none'); setShowGroupByMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium ${groupBy === 'none' ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}
                    >
                      Sin agrupar (lista continua)
                    </button>
                  </div>
                )}
              </div>

              {/* Columns Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowColumnsMenu(!showColumnsMenu)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                    isDarkMode ? 'bg-zinc-800/80 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}
                >
                  <SlidersHorizontal size={14} className="text-indigo-500" />
                  <span>Columnas</span>
                  <ChevronDown size={13} className="text-slate-400" />
                </button>

                {showColumnsMenu && (
                  <div className="absolute right-0 top-11 z-50 w-48 p-2 rounded-xl bg-white dark:bg-zinc-900 shadow-xl border border-slate-200 dark:border-white/10 space-y-1.5 animate-in fade-in zoom-in-95">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-2">
                      Columnas Visibles
                    </span>
                    <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.personasAsignadas !== false} 
                        onChange={e => setVisibleColumns({ ...visibleColumns, personasAsignadas: e.target.checked })} 
                        className="rounded text-indigo-600"
                      />
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">Personas asignadas</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.cronograma} 
                        onChange={e => setVisibleColumns({ ...visibleColumns, cronograma: e.target.checked })} 
                        className="rounded text-indigo-600"
                      />
                      <span>Cronograma</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.etapa} 
                        onChange={e => setVisibleColumns({ ...visibleColumns, etapa: e.target.checked })} 
                        className="rounded text-indigo-600"
                      />
                      <span>Etapa</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.sprint} 
                        onChange={e => setVisibleColumns({ ...visibleColumns, sprint: e.target.checked })} 
                        className="rounded text-indigo-600"
                      />
                      <span>Sprint</span>
                    </label>
                    <label className="flex items-center gap-2 px-2 py-1 text-xs hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={visibleColumns.subtareas} 
                        onChange={e => setVisibleColumns({ ...visibleColumns, subtareas: e.target.checked })} 
                        className="rounded text-indigo-600"
                      />
                      <span>Subtareas</span>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Filter Bar matching image_6bf0f5b1.png */}
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tareas..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold outline-none border transition-all ${
                  isDarkMode 
                    ? 'bg-zinc-800/80 border-white/10 text-white placeholder:text-gray-500 focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Filter Etapa */}
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Etapa: Todas</option>
              {stages.map((st: any) => (
                <option key={st.id} value={st.id}>
                  {st.name || st.title}
                </option>
              ))}
            </select>

            {/* Filter Responsable */}
            <select
              value={selectedAssignee}
              onChange={e => setSelectedAssignee(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Responsable: Todos</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName || s.name || s.firstName}
                </option>
              ))}
            </select>

            {/* Filter Sprint */}
            <select
              value={selectedSprint}
              onChange={e => setSelectedSprint(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Sprint: Todos</option>
              {sprints.map((sp: any) => (
                <option key={sp.id} value={sp.id}>
                  {sp.name}
                </option>
              ))}
            </select>

            {/* Filter Estado */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Estado: Todos</option>
              <option value="todo">Por hacer</option>
              <option value="in_progress">En curso</option>
              <option value="in_review">En revisión</option>
              <option value="blocked">Bloqueada</option>
              <option value="done">Finalizada</option>
            </select>

            {/* Botón Limpiar filtros si alguno está activo */}
            {(searchTerm || selectedStage !== 'all' || selectedAssignee !== 'all' || selectedStatus !== 'all' || selectedSprint !== 'all' || isCriticalFilter) && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setSelectedStage('all');
                  setSelectedAssignee('all');
                  setSelectedStatus('all');
                  setSelectedSprint('all');
                  setIsCriticalFilter(false);
                }}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-colors border ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                Limpiar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main View Area: Despliegue en UNA SOLA COLUMNA para máxima visibilidad */}
      <div className="w-full relative min-h-[550px]">
        {/* Vista principal 100% ancho en una sola columna */}
        <div className="w-full min-w-0">
          {activeTab === 'table' && (
            <TaskTableView
              tasks={filteredTasks}
              groups={groups}
              students={students}
              stages={stages}
              sprints={sprints}
              groupBy={groupBy}
              visibleColumns={visibleColumns}
              projectId={currentProject ? currentProject.id : 'all'}
              projectName={currentProject ? currentProject.name : 'General'}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
              canEditStructure={canEditStructure}
              canEditStatus={canEditStatus}
              isDarkMode={isDarkMode}
              selectedTaskId={selectedTask?.id}
              projects={projects}
              onSelectTask={task => setSelectedTask(task)}
              onOpenNewTaskDrawer={canEditStructure ? handleOpenNewTaskDrawer : undefined}
              onAddGroup={canEditStructure ? handleAddGroup : undefined}
              onTransferTask={handleTransferTaskToProject}
              onTaskOptimisticUpdate={handleTaskOptimisticUpdate}
            />
          )}

          {activeTab === 'kanban' && (
            <TaskKanbanView
              tasks={filteredTasks}
              students={students}
              currentUserId={currentUserId}
              currentUserName={currentUserName}
              currentUserRole={currentUserRole}
              canEditStatus={canEditStatus}
              canEditStructure={canEditStructure}
              isDarkMode={isDarkMode}
              onSelectTask={task => setSelectedTask(task)}
              onQuickAddTask={canEditStructure ? (st) => {
                handleOpenNewTaskDrawer({ status: st });
              } : undefined}
            />
          )}

          {activeTab === 'gantt' && (
            <TaskGanttView
              tasks={filteredTasks}
              isDarkMode={isDarkMode}
              onSelectTask={task => setSelectedTask(task)}
            />
          )}

          {activeTab === 'calendar' && (
            <TaskCalendarView
              tasks={filteredTasks}
              isDarkMode={isDarkMode}
              onSelectTask={task => setSelectedTask(task)}
              onQuickAddTaskOnDate={canEditStructure ? (dateStr) => {
                handleOpenNewTaskDrawer({ dueDate: dateStr, startDate: dateStr, endDate: dateStr });
              } : undefined}
            />
          )}
        </div>

        {/* Modal de Detalle de Tarea como overlay / drawer centrado o lateral sin comprimir la vista principal a 2 columnas */}
        {selectedTask && (
          <TaskDetailModal
            task={selectedTask}
            isOpen={Boolean(selectedTask)}
            onClose={() => setSelectedTask(null)}
            students={students}
            allTasks={effectiveTasks}
            stages={stages}
            sprints={sprints}
            projects={projects}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserRole={currentUserRole}
            canEditStructure={canEditStructure}
            canEditStatus={canEditStatus}
            isDarkMode={isDarkMode}
            isDocked={false}
            onLogHoursForTask={onLogHoursForTask}
            onTransferProject={handleTransferTaskToProject}
            onTaskUpdated={(updated) => {
              handleTaskOptimisticUpdate(updated);
              setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
            }}
            onViewInGantt={() => {
              setSelectedTask(null);
              setActiveTab('gantt');
            }}
          />
        )}
      </div>

      {/* AI Suggestions Modal */}
      {isAiModalOpen && currentProject && (
        <AiTaskSuggestionsModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          projectId={currentProject.id}
          projectName={currentProject.name}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          isDarkMode={isDarkMode}
        />
      )}

      {/* Quick Add Task Modal */}
      {showQuickAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className={`w-full max-w-lg p-6 rounded-3xl border shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto ${
            isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/10">
              <h3 className="text-base font-black uppercase tracking-tight flex items-center gap-2">
                <Plus size={18} className="text-indigo-600" /> Nueva Tarea del Proyecto
              </h3>
              <button 
                type="button" 
                onClick={() => setShowQuickAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickCreateTask} className="space-y-4">
              {/* Título */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título *</label>
                <input
                  type="text"
                  required
                  placeholder="Nombre de la tarea..."
                  value={quickTaskForm.title}
                  onChange={e => setQuickTaskForm({ ...quickTaskForm, title: e.target.value })}
                  autoFocus
                  className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${
                    isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              {/* Grupo y Responsable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grupo / Fase</label>
                  <select
                    value={quickTaskForm.group}
                    onChange={e => setQuickTaskForm({ ...quickTaskForm, group: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {groups.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsable (Coordinador / Alumno) *</label>
                  <select
                    value={`${quickTaskForm.assigneeRole}:::${quickTaskForm.assigneeId}:::${quickTaskForm.assigneeName}`}
                    onChange={e => {
                      const [role, id, name] = e.target.value.split(':::');
                      setQuickTaskForm({
                        ...quickTaskForm,
                        assigneeRole: role as 'coordinador' | 'alumno',
                        assigneeId: id,
                        assigneeName: name
                      });
                    }}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
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
              </div>

              {/* Estado y Vencimiento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Estado</label>
                  <select
                    value={quickTaskForm.status}
                    onChange={e => setQuickTaskForm({ ...quickTaskForm, status: e.target.value as TaskStatus })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-bold outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    <option value="todo">Por hacer</option>
                    <option value="in_progress">En curso</option>
                    <option value="in_review">En revisión</option>
                    <option value="blocked">Bloqueada</option>
                    <option value="done">Finalizada</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Vencimiento</label>
                  <input
                    type="date"
                    value={quickTaskForm.dueDate}
                    onChange={e => setQuickTaskForm({ ...quickTaskForm, dueDate: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border text-xs font-semibold outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              {/* Prioridad con Estrellas */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Prioridad ({TASK_PRIORITY_LABELS[quickTaskForm.priority] || 'Media'})
                </label>
                <div className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                  isDarkMode ? 'bg-zinc-800 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setQuickTaskForm({ ...quickTaskForm, priority: star as TaskStarPriority })}
                      className="p-1 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        size={18}
                        className={star <= quickTaskForm.priority ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}
                      />
                    </button>
                  ))}
                  <span className="text-xs font-bold text-slate-400 ml-auto">
                    {quickTaskForm.priority} de 5 estrellas
                  </span>
                </div>
              </div>

              {/* Archivo adjunto o evidencia */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Archivo / Evidencia (Opcional)</label>
                <div className="relative">
                  <Paperclip size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nombre del archivo o link (ej. Plano_base.pdf, enlace Drive)..."
                    value={quickTaskForm.attachmentName}
                    onChange={e => setQuickTaskForm({ ...quickTaskForm, attachmentName: e.target.value })}
                    className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!quickTaskForm.title.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Check size={14} className="stroke-[3]" />
                  <span>Crear tarea</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
