import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Paperclip, 
  AlertCircle, 
  User, 
  Plus,
  Star,
  CheckCircle2,
  ListTodo,
  Clock,
  ArrowRight,
  ArrowUp,
  Columns,
  Rows,
  ChevronDown,
  ChevronUp,
  Layers,
  Sparkles,
  ArrowRightLeft
} from 'lucide-react';
import { 
  ProjectTask, 
  TaskStarPriority, 
  TaskStatus, 
  TASK_STATUS_CONFIG, 
  TASK_PRIORITY_LABELS,
  mapLegacyStatus
} from '../../types/tasks';
import { updateTaskAtomic } from '../../services/taskService';
import toast from 'react-hot-toast';

interface TaskKanbanViewProps {
  tasks: ProjectTask[];
  students: any[];
  currentUserId: string;
  currentUserName: string;
  currentUserRole: string;
  canEditStatus: boolean;
  canEditStructure: boolean;
  isDarkMode: boolean;
  onSelectTask: (task: ProjectTask) => void;
  onQuickAddTask?: (status: TaskStatus) => void;
}

interface ColumnConfig {
  id: TaskStatus;
  title: string;
  headerBg: string;
  countBg: string;
  borderColor: string;
  badgeBg: string;
  accentColor: string;
}

/**
 * Normaliza cualquier variante de estado (incluyendo las usadas en la pantalla de Sesión)
 * para que las tareas empaten 100% de manera bidireccional.
 */
export const normalizeKanbanStatus = (status: string | undefined): TaskStatus => {
  if (!status) return 'todo';
  const s = String(status).toLowerCase().trim();
  if (s === 'working_on_it' || s === 'in_progress' || s === 'en_curso' || s === 'en_proceso' || s === 'progreso') return 'in_progress';
  if (s === 'waiting_review' || s === 'in_review' || s === 'en_revision' || s === 'revision') return 'in_review';
  if (s === 'stuck' || s === 'blocked' || s === 'bloqueada' || s === 'atascado' || s === 'detenido') return 'blocked';
  if (s === 'done' || s === 'finalizado' || s === 'finalizada' || s === 'listo' || s === 'hecho' || s === 'completado') return 'done';
  return 'todo';
};

export const TaskKanbanView: React.FC<TaskKanbanViewProps> = ({
  tasks,
  students,
  currentUserId,
  currentUserName,
  currentUserRole,
  canEditStatus,
  canEditStructure,
  isDarkMode,
  onSelectTask,
  onQuickAddTask
}) => {
  // Despliegue en una sola columna por defecto según la solicitud del usuario
  const [layoutMode, setLayoutMode] = useState<'single' | 'columns'>('single');
  // Secciones colapsadas en vista de una columna
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  // Visibilidad del botón flotante para volver arriba
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 200) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSectionCollapse = (statusId: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [statusId]: !prev[statusId]
    }));
  };

  // 5 Categorías universales sincronizadas con la pantalla de sesión y sistema
  const columns: ColumnConfig[] = [
    { 
      id: 'todo', 
      title: 'Por hacer', 
      headerBg: 'bg-slate-600 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-slate-300 dark:border-slate-700',
      badgeBg: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
      accentColor: '#64748b'
    },
    { 
      id: 'in_progress', 
      title: 'En curso', 
      headerBg: 'bg-amber-600 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-amber-300 dark:border-amber-700/60',
      badgeBg: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
      accentColor: '#d97706'
    },
    { 
      id: 'in_review', 
      title: 'En revisión', 
      headerBg: 'bg-blue-600 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-blue-300 dark:border-blue-700/60',
      badgeBg: 'bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-blue-300',
      accentColor: '#2563eb'
    },
    { 
      id: 'blocked', 
      title: 'Bloqueada', 
      headerBg: 'bg-rose-600 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-rose-300 dark:border-rose-700/60',
      badgeBg: 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-300',
      accentColor: '#e11d48'
    },
    { 
      id: 'done', 
      title: 'Finalizada', 
      headerBg: 'bg-emerald-600 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-emerald-300 dark:border-emerald-700/60',
      badgeBg: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300',
      accentColor: '#059669'
    }
  ];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (normalizeKanbanStatus(task.status) === targetStatus) return;

    await handleStatusChange(task, targetStatus);
  };

  const handleStatusChange = async (task: ProjectTask, targetStatus: TaskStatus) => {
    // RBAC: Alumnos solo pueden mover sus propias tareas
    const isCoord = canEditStructure || currentUserRole?.includes('coord') || currentUserRole === 'admin';
    const isAssigned = (task.assigneeIds || []).includes(currentUserId) || task.leadAssigneeId === currentUserId;
    if (!isCoord && !isAssigned) {
      toast.error('Solo puedes cambiar el estado de las tareas asignadas a ti');
      return;
    }

    try {
      // Guardar status estándar y sessionStatus para empatar 100% con ambas vistas
      const sessionEquivalent = targetStatus === 'in_progress' ? 'working_on_it'
        : targetStatus === 'in_review' ? 'waiting_review'
        : targetStatus === 'blocked' ? 'stuck'
        : targetStatus;

      await updateTaskAtomic(task.id, task.version, { 
        status: targetStatus,
        sessionStatus: sessionEquivalent
      } as any, {
        id: currentUserId,
        name: currentUserName,
        role: currentUserRole
      });
      toast.success(`Tarea movida a "${TASK_STATUS_CONFIG[targetStatus].label}"`);
    } catch (err: any) {
      if (err.message === 'VERSION_CONFLICT') {
        toast.error('Conflicto: la tarea fue modificada por otro usuario');
      } else {
        toast.error(err.message || 'Error al actualizar estado');
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, task: ProjectTask) => {
    e.dataTransfer.setData('text/plain', task.id);
  };

  // Helper para resolver el nombre visible del responsable de forma infalible
  const getAssigneeInfo = (task: ProjectTask) => {
    // 1. Directamente del documento de la tarea
    if (task.leadAssigneeName && task.leadAssigneeName.trim() && task.leadAssigneeName !== 'Sin asignar') {
      return {
        name: task.leadAssigneeName,
        isCoord: task.leadAssigneeRole === 'coordinador' || task.leadAssigneeName.toLowerCase().includes('luis')
      };
    }
    const legacyAssigneeName = (task as any).assigneeName;
    if (legacyAssigneeName && typeof legacyAssigneeName === 'string' && legacyAssigneeName.trim() && legacyAssigneeName !== 'Sin asignar') {
      return {
        name: legacyAssigneeName,
        isCoord: task.leadAssigneeRole === 'coordinador'
      };
    }

    // 2. Búsqueda por ID o nombre en la lista de alumnos/usuarios
    const leadId = task.leadAssigneeId || task.assigneeIds?.[0] || (task as any).assignedTo;
    if (leadId) {
      const match = students.find(s => 
        s.id === leadId || 
        s.name?.toLowerCase() === leadId.toLowerCase() ||
        s.fullName?.toLowerCase() === leadId.toLowerCase() ||
        s.firstName?.toLowerCase() === leadId.toLowerCase()
      );
      if (match) {
        return {
          name: match.fullName || match.name || `${match.firstName || ''} ${match.lastNamePaterno || ''}`.trim() || 'Alumno',
          isCoord: match.role === 'coordinator' || match.isCoordinator
        };
      }
      if (leadId === currentUserId) {
        return {
          name: currentUserName,
          isCoord: currentUserRole?.includes('coord') || currentUserRole === 'admin'
        };
      }
      return {
        name: leadId,
        isCoord: false
      };
    }

    // 3. Revisión de assignedUsers de compatibilidad
    const assignedUsers = (task as any).assignedUsers;
    if (Array.isArray(assignedUsers) && assignedUsers.length > 0) {
      const firstId = assignedUsers[0];
      const match = students.find(s => s.id === firstId);
      if (match) {
        return {
          name: match.fullName || match.name || 'Alumno',
          isCoord: false
        };
      }
      if (firstId === currentUserId) {
        return {
          name: currentUserName,
          isCoord: currentUserRole?.includes('coord') || currentUserRole === 'admin'
        };
      }
      return { name: firstId, isCoord: false };
    }

    return { name: 'Sin asignar', isCoord: false };
  };

  return (
    <div className="w-full space-y-4">
      {/* Barra de control superior con flecha para volver al inicio y selector de modo */}
      <div className={`p-3.5 rounded-2xl border flex flex-wrap items-center justify-between gap-3 shadow-xs ${
        isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-slate-200'
      }`}>
        <div className="flex items-center gap-2">
          {/* Flecha para regresar rápido al inicio */}
          <button
            type="button"
            onClick={scrollToTop}
            title="Regresar rápido al inicio de la página"
            className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              isDarkMode 
                ? 'bg-white/5 border-white/10 text-gray-200 hover:bg-white/10 hover:text-white' 
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <ArrowUp size={15} className="text-indigo-500" />
            <span>Regresar al inicio</span>
          </button>

          {/* Resumen de contadores de estado */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            {columns.map(col => {
              const count = tasks.filter(t => normalizeKanbanStatus(t.status || (t as any).sessionStatus) === col.id).length;
              return (
                <span 
                  key={col.id} 
                  className={`px-2 py-0.5 rounded-lg font-bold text-[11px] ${col.badgeBg}`}
                >
                  {col.title}: {count}
                </span>
              );
            })}
          </div>
        </div>

        {/* Conmutador de modo: 1 columna (Recomendado) vs 5 columnas */}
        <div className={`p-1 rounded-xl flex items-center gap-1 border ${
          isDarkMode ? 'bg-zinc-800/80 border-white/10' : 'bg-slate-100 border-slate-200'
        }`}>
          <button
            type="button"
            onClick={() => setLayoutMode('single')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              layoutMode === 'single'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Rows size={14} />
            <span>Una columna</span>
          </button>
          <button
            type="button"
            onClick={() => setLayoutMode('columns')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
              layoutMode === 'columns'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Columns size={14} />
            <span>5 columnas</span>
          </button>
        </div>
      </div>

      {/* VISTA 1: Despliegue en UNA SOLA COLUMNA (Vertical, legible y sin scroll horizontal) */}
      {layoutMode === 'single' ? (
        <div className="space-y-4">
          {columns.map(column => {
            const colTasks = tasks.filter(t => normalizeKanbanStatus(t.status || (t as any).sessionStatus) === column.id);
            const isCollapsed = !!collapsedSections[column.id];

            return (
              <div
                key={column.id}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`rounded-2xl border transition-all ${
                  isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-slate-200'
                } shadow-xs overflow-hidden`}
              >
                {/* Cabecera ancha de sección */}
                <div 
                  className={`p-3.5 flex items-center justify-between cursor-pointer select-none ${column.headerBg}`}
                  onClick={() => toggleSectionCollapse(column.id)}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="p-1 rounded-lg hover:bg-white/20 transition-colors"
                      title={isCollapsed ? 'Expandir sección' : 'Colapsar sección'}
                    >
                      {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                    </button>
                    <h4 className="font-black text-sm tracking-wide">
                      {column.title}
                    </h4>
                    <span className={`text-xs font-mono px-2.5 py-0.5 rounded-full font-black ${column.countBg}`}>
                      {colTasks.length} {colTasks.length === 1 ? 'tarea' : 'tareas'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    {canEditStructure && onQuickAddTask && (
                      <button 
                        type="button"
                        onClick={() => onQuickAddTask(column.id)}
                        className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                        title={`Agregar tarea a ${column.title}`}
                      >
                        <Plus size={14} />
                        <span className="hidden sm:inline">Agregar tarea</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Contenido de la sección en una sola columna: Grid espacioso y sin recortes */}
                {!isCollapsed && (
                  <div className="p-4">
                    {colTasks.length === 0 ? (
                      <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl text-slate-400 dark:text-gray-400 text-xs">
                        <ListTodo size={20} className="mb-1 text-slate-400" />
                        <span>No hay tareas en "{column.title}"</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                        {colTasks.map(task => {
                          const assigneeInfo = getAssigneeInfo(task);
                          const subtasksDone = (task.subtasks || []).filter(s => s.completed).length;
                          const subtasksTotal = (task.subtasks || []).length;
                          const hasAttachments = (task.attachments || []).length > 0;
                          const currentNormStatus = normalizeKanbanStatus(task.status || (task as any).sessionStatus);

                          return (
                            <div
                              key={task.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, task)}
                              onClick={() => onSelectTask(task)}
                              className={`p-4 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:shadow-md flex flex-col justify-between gap-3 ${
                                isDarkMode 
                                  ? 'bg-zinc-900/90 border-white/10 hover:border-indigo-500/60' 
                                  : 'bg-slate-50 border-slate-200 hover:border-indigo-400 shadow-xs'
                              }`}
                            >
                              {/* Fila superior: Etapa y Prioridad 5 Estrellas */}
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] truncate max-w-[180px] ${
                                  isDarkMode ? 'bg-white/10 text-gray-200' : 'bg-slate-200 text-slate-700'
                                }`}>
                                  {task.stageName || task.groupName || 'General'}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0" title={`Prioridad: ${task.priority || 0}/5`}>
                                  {[1, 2, 3, 4, 5].map(st => (
                                    <Star 
                                      key={st} 
                                      size={12} 
                                      className={st <= (task.priority || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-zinc-700'} 
                                    />
                                  ))}
                                </div>
                              </div>

                              {/* Título de la tarea: fuente con alto contraste visible */}
                              <h5 className="font-bold text-sm text-slate-900 dark:text-white leading-snug break-words">
                                {task.title}
                              </h5>

                              {/* Descripción breve si existe */}
                              {task.description && (
                                <p className="text-xs text-slate-600 dark:text-gray-300 line-clamp-2">
                                  {task.description}
                                </p>
                              )}

                              {/* Alerta de bloqueo */}
                              {currentNormStatus === 'blocked' && task.blockReason && (
                                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-rose-600" />
                                  <span className="line-clamp-2">{task.blockReason}</span>
                                </div>
                              )}

                              {/* Selector rápido de cambio de estado para no depender solo de arrastre */}
                              <div className="pt-2 border-t border-slate-200 dark:border-white/10 flex items-center justify-between gap-2" onClick={e => e.stopPropagation()}>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400">
                                  Estado:
                                </span>
                                <select
                                  value={currentNormStatus}
                                  onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus)}
                                  className={`px-2 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer transition-colors ${
                                    isDarkMode 
                                      ? 'bg-zinc-800 border-white/10 text-gray-200 hover:border-indigo-400' 
                                      : 'bg-white border-slate-300 text-slate-800 hover:border-indigo-500'
                                  }`}
                                >
                                  <option value="todo">Por hacer</option>
                                  <option value="in_progress">En curso</option>
                                  <option value="in_review">En revisión</option>
                                  <option value="blocked">Bloqueada</option>
                                  <option value="done">Finalizada</option>
                                </select>
                              </div>

                              {/* Pie de la tarjeta: Responsable visible y metadatos */}
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-gray-300 pt-1">
                                {/* Responsable con Avatar e Inicial */}
                                <div className="flex items-center gap-2 min-w-0">
                                  <div 
                                    className={`w-6 h-6 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 shadow-xs ${
                                      assigneeInfo.isCoord ? 'bg-amber-600' : 'bg-indigo-600'
                                    }`}
                                    title={assigneeInfo.name}
                                  >
                                    {(assigneeInfo.name || 'U')[0].toUpperCase()}
                                  </div>
                                  <span className="font-bold text-xs truncate max-w-[120px] text-slate-800 dark:text-gray-200" title={assigneeInfo.name}>
                                    {assigneeInfo.name}
                                  </span>
                                </div>

                                {/* Metadatos: subtareas, archivos, vencimiento */}
                                <div className="flex items-center gap-2 font-mono text-[11px] shrink-0">
                                  {subtasksTotal > 0 && (
                                    <span className="flex items-center gap-0.5 text-slate-600 dark:text-gray-300 font-bold" title="Subtareas completadas">
                                      <ListTodo size={12} className="text-indigo-500" /> {subtasksDone}/{subtasksTotal}
                                    </span>
                                  )}
                                  {hasAttachments && (
                                    <span className="flex items-center gap-0.5 text-slate-600 dark:text-gray-300 font-bold" title="Archivos adjuntos">
                                      <Paperclip size={12} className="text-blue-500" /> {task.attachments?.length}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className="flex items-center gap-0.5 text-slate-600 dark:text-gray-300 font-bold" title="Fecha de vencimiento">
                                      <Clock size={12} className="text-amber-500" /> {task.dueDate.slice(5)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA 2: Tablero clásico de 5 columnas para usuarios que lo prefieran */
        <div className="w-full overflow-x-auto pb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 min-w-[1000px]">
            {columns.map(column => {
              const colTasks = tasks.filter(t => normalizeKanbanStatus(t.status || (t as any).sessionStatus) === column.id);

              return (
                <div
                  key={column.id}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className={`rounded-2xl border transition-all flex flex-col max-h-[820px] ${column.borderColor} ${
                    isDarkMode 
                      ? 'bg-slate-900/60 border-slate-800' 
                      : 'bg-slate-50/70 border-slate-200 shadow-xs'
                  }`}
                >
                  {/* Cabecera de Columna */}
                  <div className={`p-3.5 rounded-t-xl flex items-center justify-between ${column.headerBg}`}>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-xs tracking-wide">
                        {column.title}
                      </h4>
                      <span className={`text-[11px] font-mono px-2 py-0.5 rounded-full font-bold ${column.countBg}`}>
                        {colTasks.length}
                      </span>
                    </div>
                    {canEditStructure && onQuickAddTask && (
                      <button 
                        type="button"
                        onClick={() => onQuickAddTask(column.id)}
                        className="p-1 rounded-md hover:bg-white/20 transition-colors"
                        title={`Agregar tarea a ${column.title}`}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>

                  {/* Lista de Tarjetas */}
                  <div className="p-2.5 flex-1 overflow-y-auto space-y-2.5 min-h-[160px]">
                    {colTasks.length === 0 ? (
                      <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 text-xs">
                        <span>Sin tareas</span>
                      </div>
                    ) : (
                      colTasks.map(task => {
                        const assigneeInfo = getAssigneeInfo(task);
                        const subtasksDone = (task.subtasks || []).filter(s => s.completed).length;
                        const subtasksTotal = (task.subtasks || []).length;
                        const hasAttachments = (task.attachments || []).length > 0;
                        const currentNormStatus = normalizeKanbanStatus(task.status || (task as any).sessionStatus);

                        return (
                          <div
                            key={task.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, task)}
                            onClick={() => onSelectTask(task)}
                            className={`p-3 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:shadow-md ${
                              isDarkMode 
                                ? 'bg-slate-800/90 border-slate-700/80 hover:border-indigo-500/50' 
                                : 'bg-white border-slate-200/90 hover:border-indigo-400'
                            } space-y-2.5`}
                          >
                            {/* Etapa y Prioridad */}
                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="truncate max-w-[120px] font-medium text-slate-500 dark:text-slate-400">
                                {task.stageName || task.groupName || 'General'}
                              </span>
                              <div className="flex items-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(st => (
                                  <Star 
                                    key={st} 
                                    size={11} 
                                    className={st <= (task.priority || 0) ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'} 
                                  />
                                ))}
                              </div>
                            </div>

                            {/* Título de la Tarea con fuente legible */}
                            <h5 className="font-bold text-xs text-slate-900 dark:text-slate-100 leading-snug break-words">
                              {task.title}
                            </h5>

                            {/* Motivo de Bloqueo si aplica */}
                            {currentNormStatus === 'blocked' && task.blockReason && (
                              <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 flex items-start gap-1.5">
                                <AlertCircle size={12} className="shrink-0 mt-0.5" />
                                <span className="line-clamp-2">{task.blockReason}</span>
                              </div>
                            )}

                            {/* Pie de la Tarjeta */}
                            <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px] text-slate-500">
                              {/* Responsable */}
                              <div className="flex items-center gap-1.5 min-w-0">
                                <div 
                                  className={`w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                    assigneeInfo.isCoord ? 'bg-amber-600' : 'bg-indigo-600'
                                  }`}
                                  title={assigneeInfo.name}
                                >
                                  {(assigneeInfo.name || 'U')[0].toUpperCase()}
                                </div>
                                <span className="truncate max-w-[80px] font-semibold text-slate-700 dark:text-slate-300">
                                  {assigneeInfo.name}
                                </span>
                              </div>

                              {/* Metadatos (Subtareas, Archivos, Fecha) */}
                              <div className="flex items-center gap-2 font-mono text-[10px]">
                                {subtasksTotal > 0 && (
                                  <span className="flex items-center gap-0.5 text-slate-500">
                                    <ListTodo size={11} /> {subtasksDone}/{subtasksTotal}
                                  </span>
                                )}
                                {hasAttachments && (
                                  <span className="flex items-center gap-0.5 text-slate-500">
                                    <Paperclip size={11} /> {task.attachments?.length}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="flex items-center gap-0.5 text-slate-500">
                                    <Clock size={11} /> {task.dueDate.slice(5)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Botón flotante para regresar rápido al inicio */}
      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-600/40 flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all transform hover:-translate-y-0.5 active:translate-y-0"
          title="Regresar al inicio de la página"
        >
          <ArrowUp size={16} />
          <span>Regresar al inicio</span>
        </button>
      )}
    </div>
  );
};
