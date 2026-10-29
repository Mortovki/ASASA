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
  Layers
} from 'lucide-react';
import { ProjectTask, TaskGroup, TaskPriority, TaskStatus } from '../../types/tasks';
import { 
  subscribeToProjectTasks, 
  subscribeToAllTasks, 
  createTask, 
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
}

export const TaskWorkspace: React.FC<TaskWorkspaceProps> = ({
  initialProjectId,
  projects,
  students,
  currentUserId,
  currentUserName,
  currentUserRole,
  isDarkMode,
  onLogHoursForTask
}) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    initialProjectId || (projects.length > 0 ? projects[0].id : 'all')
  );
  const [activeTab, setActiveTab] = useState<'table' | 'kanban' | 'gantt' | 'calendar'>('table');
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [groups, setGroups] = useState<TaskGroup[]>(DEFAULT_GROUPS);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isSyncingGoogle, setIsSyncingGoogle] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickTaskTitle, setQuickTaskTitle] = useState('');
  const [quickTaskGroup, setQuickTaskGroup] = useState('pendientes');

  // Role permissions
  const isMasterOrSuper = currentUserRole === 'master_coordinator' || currentUserRole === 'super_coordinator' || currentUserRole === 'admin';
  const isCoord = isMasterOrSuper || currentUserRole === 'coordinator';
  const isStudentCoord = currentUserRole === 'student_coordinator';
  const isStudent = !isCoord && !isStudentCoord;

  // Active project object
  const currentProject = useMemo(() => {
    if (selectedProjectId === 'all') return null;
    return projects.find(p => p.id === selectedProjectId) || null;
  }, [selectedProjectId, projects]);

  const canEditStructure = isCoord || (isStudentCoord && currentProject?.coordinatorIds?.includes(currentUserId));
  const canEditStatus = true; // All students can update status on their assigned tasks

  // Real-time listener
  useEffect(() => {
    let unsubscribe: () => void;

    if (selectedProjectId && selectedProjectId !== 'all') {
      unsubscribe = subscribeToProjectTasks(selectedProjectId, (updated) => {
        setTasks(updated);
      });
    } else {
      unsubscribe = subscribeToAllTasks((updated) => {
        setTasks(updated);
      });
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [selectedProjectId]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // If student in global view, by default only show tasks where they are assigned or open
      if (isStudent && selectedProjectId === 'all') {
        const isAssigned = (task.assigneeIds || []).includes(currentUserId);
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
        if (!(task.assigneeIds || []).includes(selectedAssignee)) return false;
      }

      if (selectedStatus !== 'all') {
        if (task.status !== selectedStatus) return false;
      }

      if (selectedPriority !== 'all') {
        if (task.priority !== selectedPriority) return false;
      }

      return true;
    });
  }, [tasks, searchTerm, selectedAssignee, selectedStatus, selectedPriority, isStudent, currentUserId, selectedProjectId]);

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
          if (localMatch && localMatch.status !== 'listo') {
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

  const handleQuickCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      const pId = currentProject ? currentProject.id : (projects[0]?.id || 'general');
      const pName = currentProject ? currentProject.name : (projects[0]?.name || 'General');

      await createTask({
        projectId: pId,
        projectName: pName,
        groupId: quickTaskGroup,
        groupName: groups.find(g => g.id === quickTaskGroup)?.name || 'Pendientes',
        title: quickTaskTitle.trim(),
        assigneeIds: isStudent ? [currentUserId] : [],
        status: 'no_iniciado',
        priority: 'media',
        startDate: today,
        endDate: today,
        dueDate: today,
        createdBy: currentUserId,
        createdByName: currentUserName,
        updatedBy: currentUserId
      });

      setQuickTaskTitle('');
      setShowQuickAddModal(false);
      toast.success('Tarea agregada exitosamente');
    } catch (err) {
      toast.error('Error al crear tarea');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Section */}
      <div className={`p-6 rounded-3xl border shadow-sm space-y-5 ${
        isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-slate-200'
      }`}>
        {/* Project Selector & Main Action Bar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black">
              <Layers size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {projects.length > 0 ? (
                  <select
                    value={selectedProjectId}
                    onChange={e => setSelectedProjectId(e.target.value)}
                    className={`text-xl sm:text-2xl font-black bg-transparent border-none outline-none cursor-pointer tracking-tight ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {!initialProjectId && <option value="all" className="text-slate-800">Todos los Proyectos (Vista Consolidada)</option>}
                    {projects.map(p => (
                      <option key={p.id} value={p.id} className="text-slate-800">
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <h2 className="text-xl sm:text-2xl font-black">Tablero de Tareas</h2>
                )}
                <ChevronDown size={18} className="text-slate-400" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {filteredTasks.length} tareas activas · {currentProject ? currentProject.code || 'Proyecto' : 'Global'}
              </p>
            </div>
          </div>

          {/* Top Quick Actions */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {canEditStructure && (
              <button
                type="button"
                onClick={() => setShowQuickAddModal(true)}
                className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                <Plus size={16} />
                <span>Agregar tarea</span>
              </button>
            )}

            {canEditStructure && currentProject && (
              <button
                type="button"
                onClick={() => setIsAiModalOpen(true)}
                className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  isDarkMode 
                    ? 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10' 
                    : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                <Sparkles size={16} className="text-indigo-500" />
                <span>Sugerencias de IA</span>
                <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-indigo-600 text-white">Nuevo</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleSyncGoogleTasks}
              disabled={isSyncingGoogle}
              title="Sincronizar tareas con tu cuenta de Google Tasks"
              className={`px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                isDarkMode 
                  ? 'border-white/10 text-gray-300 hover:bg-white/5' 
                  : 'border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <RefreshCw size={14} className={isSyncingGoogle ? 'animate-spin text-indigo-500' : ''} />
              <span>Google Tasks</span>
            </button>
          </div>
        </div>

        {/* View Tabs Bar & Filters */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          {/* 4 Views Tabs */}
          <div className={`p-1 rounded-2xl flex items-center gap-1 ${
            isDarkMode ? 'bg-white/5' : 'bg-slate-100'
          }`}>
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'table'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Table size={15} />
              <span>Tabla principal</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('kanban')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'kanban'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Kanban size={15} />
              <span>Kanban</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('gantt')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'gantt'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={15} />
              <span>Gantt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === 'calendar'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarIcon size={15} />
              <span>Calendario</span>
            </button>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Search */}
            <div className="relative flex-1 md:w-56">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar tarea..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-bold outline-none border transition-all ${
                  isDarkMode 
                    ? 'bg-zinc-800 border-white/10 text-white placeholder:text-gray-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            </div>

            {/* Persona */}
            <select
              value={selectedAssignee}
              onChange={e => setSelectedAssignee(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Todas las personas</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name || s.firstName}
                </option>
              ))}
            </select>

            {/* Estado Filter */}
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}
            >
              <option value="all">Todos los estados</option>
              <option value="no_iniciado">No iniciado</option>
              <option value="en_curso">En curso</option>
              <option value="detenido">Detenido</option>
              <option value="listo">Listo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      <div>
        {activeTab === 'table' && (
          <TaskTableView
            tasks={filteredTasks}
            groups={groups}
            students={students}
            projectId={currentProject ? currentProject.id : 'all'}
            projectName={currentProject ? currentProject.name : 'General'}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            canEditStructure={canEditStructure}
            canEditStatus={canEditStatus}
            isDarkMode={isDarkMode}
            onSelectTask={task => setSelectedTask(task)}
            onAddGroup={canEditStructure ? handleAddGroup : undefined}
          />
        )}

        {activeTab === 'kanban' && (
          <TaskKanbanView
            tasks={filteredTasks}
            students={students}
            canEditStatus={canEditStatus}
            canEditStructure={canEditStructure}
            isDarkMode={isDarkMode}
            onSelectTask={task => setSelectedTask(task)}
            onQuickAddTask={canEditStructure ? (st) => {
              setShowQuickAddModal(true);
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
              setShowQuickAddModal(true);
            } : undefined}
          />
        )}
      </div>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={Boolean(selectedTask)}
          onClose={() => setSelectedTask(null)}
          students={students}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          canEditStructure={canEditStructure}
          canEditStatus={canEditStatus}
          isDarkMode={isDarkMode}
          onLogHoursForTask={onLogHoursForTask}
        />
      )}

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
          <div className={`w-full max-w-md p-6 rounded-3xl border shadow-2xl space-y-4 ${
            isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            <h3 className="text-base font-black uppercase tracking-tight">Nueva Tarea</h3>
            <form onSubmit={handleQuickCreateTask} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Título</label>
                <input
                  type="text"
                  placeholder="Nombre de la tarea..."
                  value={quickTaskTitle}
                  onChange={e => setQuickTaskTitle(e.target.value)}
                  autoFocus
                  className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${
                    isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Grupo / Fase</label>
                <select
                  value={quickTaskGroup}
                  onChange={e => setQuickTaskGroup(e.target.value)}
                  className={`w-full p-3 rounded-xl border text-xs font-bold outline-none ${
                    isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                  }`}
                >
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!quickTaskTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow disabled:opacity-40"
                >
                  Crear tarea
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
