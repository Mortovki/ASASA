import React, { useState, useMemo, useEffect } from 'react';
import { Star, ChevronDown, ChevronRight, Filter, User, AlertTriangle, Plus, Send, Loader2, MapPin, Search, X, CheckSquare, Square, MinusSquare, Zap } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import TaskSidePanel from './TaskSidePanel';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ChartContainer } from './ChartContainer';
import { BulkActionsDock } from './BulkActionsDock';
import { ConfirmModal } from './ui/ConfirmModal';
import { StatusBadge } from './ui/StatusBadge';
import { computeCriticalPath } from '../utils/criticalPath';
import { Task } from '../types/criticalPath';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { KANBAN_COLUMNS, KanbanColumnId } from '../config/kanbanColumns';
import { formatName } from '../utils/formatters';

const SprintTable = ({ 
  tasks, 
  projectId, 
  project,
  userRole, 
  currentUser, 
  students,
  sprints = [],
  onOpenSprintConfig,
  updateTaskStatus,
  updateTaskField,
  updateTaskFields,
  deleteTask,
  addTask,
  permissions,
  isDarkMode
}: any) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
  const [newTasks, setNewTasks] = useState<Record<string, { title: string, status: KanbanColumnId, isSubmitting: boolean }>>({});
  const { isMobile } = useBreakpoint();

  const cpmTasks = useMemo(() => {
    try {
      const uniqueTasks = Array.from(new Map(tasks.map((t: any) => [t.id, t])).values());
      return computeCriticalPath(uniqueTasks as Task[]);
    } catch (e) {
      console.error("Error computing CPM:", e);
      return tasks as Task[];
    }
  }, [tasks]);

  const togglePhase = (phase: string) => {
    setExpandedPhases(prev => ({ ...prev, [phase]: !prev[phase] }));
  };

  const handlePriorityChange = async (taskId: string, priority: number, oldPriority: number) => {
    if (!permissions.canEditTask) {
      toast.error('No tienes permisos para cambiar la prioridad');
      return;
    }
    try {
      await updateTaskField(taskId, 'priority', priority, oldPriority);
    } catch (error) {
      console.error("Error updating priority:", error);
      toast.error('Error al actualizar prioridad');
    }
  };

  const handleQuickAdd = async (groupKey: string, isStage: boolean) => {
    const newTaskData = newTasks[groupKey];
    if (!newTaskData || !newTaskData.title.trim()) {
      toast.error('El título es requerido');
      return;
    }

    setNewTasks(prev => ({ ...prev, [groupKey]: { ...prev[groupKey], isSubmitting: true } }));

    try {
      const stage = isStage ? project?.stages?.find((s: any) => s.id === groupKey) : null;
      
      const isUser = userRole === 'user';
      const task = {
        title: newTaskData.title,
        status: isUser ? 'pending_approval' : newTaskData.status,
        phase: isStage ? (stage?.name || '') : (groupKey === 'Sin Sprint' ? '' : groupKey),
        stageId: isStage ? groupKey : null,
        projectId,
        priority: 3,
        effort: 1,
        type: 'LEVANTAMIENTO',
        assignedTo: isUser ? currentUser?.uid : '',
        startDate: stage?.startDate || new Date().toISOString(),
        endDate: stage?.endDate || new Date(Date.now() + 86400000).toISOString(),
        estimatedSP: isUser ? 0 : 1
      };

      const newId = await addTask(task);
      if (newId) {
        toast.success(isUser ? 'Propuesta enviada para revisión' : 'Tarea creada');
        setNewTasks(prev => ({ 
          ...prev, 
          [groupKey]: { title: '', status: 'todo', isSubmitting: false } 
        }));
      }
    } catch (error) {
      console.error("Error adding task:", error);
      toast.error('Error al crear tarea');
      setNewTasks(prev => ({ ...prev, [groupKey]: { ...prev[groupKey], isSubmitting: false } }));
    }
  };

  const filteredTasks = useMemo(() => {
    return cpmTasks.filter((t: any) => {
      if (t.status === 'pending_approval' || t.status === 'rejected') return false;
      
      if (filterUser) {
        const uids = t.assignedUsers || (t.assignedTo ? [t.assignedTo] : []);
        if (!uids.includes(filterUser)) return false;
      }
      
      if (filterStatus && t.status !== filterStatus) return false;

      if (filterPriority && t.priority !== Number(filterPriority)) return false;

      if (filterStage) {
        const matchesStageId = t.stageId === filterStage;
        const stageObj = project?.stages?.find((s: any) => s.id === filterStage);
        const matchesStageName = stageObj && (t.phase === stageObj.name || t.phase === stageObj.id);
        if (!matchesStageId && !matchesStageName) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = (t.title || '').toLowerCase().includes(q);
        const epicMatch = (t.epic || '').toLowerCase().includes(q);
        const descMatch = (t.description || '').toLowerCase().includes(q);
        const assignedStudent = students.find((s: any) => s.id === (t.assignedUsers?.[0] || t.assignedTo));
        const studentMatch = assignedStudent ? `${assignedStudent.firstName} ${assignedStudent.lastNamePaterno}`.toLowerCase().includes(q) : false;
        if (!titleMatch && !epicMatch && !descMatch && !studentMatch) return false;
      }

      return true;
    });
  }, [cpmTasks, filterUser, filterStatus, filterPriority, filterStage, searchQuery, students, project?.stages]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredTasks.forEach((t: any) => {
      const sprint = sprints.find((s: any) => s.id === t.sprintId);
      const stage = project?.stages?.find((s: any) => s.id === t.stageId);
      const groupKey = sprint ? sprint.name : (stage ? stage.name : (t.phase || 'Sin Sprint (Backlog)'));
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(t);
    });
    return groups;
  }, [filteredTasks, sprints, project?.stages]);

  const handleToggleSelectTask = (taskId: string, e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    if (selectedTaskIds.size === filteredTasks.length && filteredTasks.length > 0) {
      setSelectedTaskIds(new Set());
    } else {
      setSelectedTaskIds(new Set(filteredTasks.map((t: any) => t.id)));
    }
  };

  const handleTogglePhaseSelection = (phaseTasks: any[], e?: any) => {
    if (e && e.stopPropagation) e.stopPropagation();
    const phaseIds = phaseTasks.map((t: any) => t.id);
    const allSelected = phaseIds.length > 0 && phaseIds.every(id => selectedTaskIds.has(id));
    setSelectedTaskIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        phaseIds.forEach(id => next.delete(id));
      } else {
        phaseIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleBulkUpdateStatus = async (newStatus: string) => {
    if (!permissions.canEditTask) {
      toast.error('No tienes permisos para editar tareas');
      return;
    }
    const ids = Array.from(selectedTaskIds);
    try {
      await Promise.all(ids.map(id => {
        const task = tasks.find((t: any) => t.id === id);
        return updateTaskStatus(id, newStatus, task?.status);
      }));
      toast.success(`${ids.length} tareas actualizadas a ${newStatus}`);
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar tareas en lote');
    }
  };

  const handleBulkUpdateAssignee = async (assigneeId: string) => {
    if (!permissions.canEditTask) {
      toast.error('No tienes permisos para reasignar tareas');
      return;
    }
    const ids = Array.from(selectedTaskIds);
    try {
      await Promise.all(ids.map(id => {
        const task = tasks.find((t: any) => t.id === id);
        return updateTaskField(id, 'assignedTo', assigneeId, task?.assignedTo);
      }));
      toast.success(`${ids.length} tareas reasignadas`);
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Error al reasignar tareas');
    }
  };

  const handleBulkUpdatePriority = async (newPriority: number) => {
    if (!permissions.canEditTask) {
      toast.error('No tienes permisos para cambiar prioridad');
      return;
    }
    const ids = Array.from(selectedTaskIds);
    try {
      await Promise.all(ids.map(id => {
        const task = tasks.find((t: any) => t.id === id);
        return updateTaskField(id, 'priority', newPriority, task?.priority || 3);
      }));
      toast.success(`Prioridad actualizada para ${ids.length} tareas`);
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Error al actualizar prioridades');
    }
  };

  const handleBulkDeleteConfirm = async () => {
    if (!permissions.canDeleteTask) {
      toast.error('No tienes permisos para eliminar tareas');
      return;
    }
    const ids = Array.from(selectedTaskIds);
    try {
      await Promise.all(ids.map(id => deleteTask(id)));
      toast.success(`${ids.length} tareas eliminadas`);
      setSelectedTaskIds(new Set());
      setIsBulkDeleteModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error('Error al eliminar tareas');
    }
  };

  const renderStars = (taskId: string, priority: number) => {
    return (
      <div className="flex gap-0.5 cursor-pointer">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={`star-${i}`} 
            size={14} 
            onClick={(e) => { e.stopPropagation(); handlePriorityChange(taskId, i + 1, priority); }}
            className={i < priority ? 'text-yellow-400 fill-yellow-400' : (isDarkMode ? 'text-gray-700 hover:text-yellow-200' : 'text-slate-200 hover:text-yellow-200')} 
          />
        ))}
      </div>
    );
  };

  const generateBurndownData = (sprintTasks: any[]) => {
    const totalSP = sprintTasks.reduce((acc: number, t: any) => acc + (t.estimatedSP || 0), 0);
    const data = [];
    let remaining = totalSP;
    for (let i = 0; i <= 10; i++) {
      if (i > 0) remaining -= Math.floor(Math.random() * (totalSP / 10));
      if (remaining < 0) remaining = 0;
      data.push({
        day: `Día ${i}`,
        ideal: totalSP - (totalSP / 10) * i,
        actual: i <= 5 ? remaining : null
      });
    }
    return data;
  };

  const renderMobileTaskCard = (task: any) => {
    const assignedStudent = students.find((s: any) => s.id === task.assignedTo);
    const statusConfig = KANBAN_COLUMNS.find(c => c.id === task.status);
    const textColor = statusConfig?.color.replace('bg-', 'text-') || (isDarkMode ? 'text-white' : 'text-slate-800');
    const borderColor = statusConfig?.color.replace('bg-', 'border-') || (isDarkMode ? 'border-white/10' : 'border-slate-200');

    return (
      <div 
        key={task.id} 
        onClick={() => setSelectedTaskId(task.id)}
        className={`p-4 rounded-xl shadow-sm border-l-4 mb-3 cursor-pointer active:scale-95 transition-all ${
          task.isCritical ? 'border-red-500' : borderColor
        } border-y border-r ${
          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
        }`}
        style={task.color ? { borderLeftColor: task.color } : {}}
      >
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedTaskIds.has(task.id)}
              onChange={() => handleToggleSelectTask(task.id)}
              onClick={(e) => e.stopPropagation()}
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
            />
            <div className="flex gap-1.5 flex-wrap">
              <StatusBadge status={task.status} size="sm" />
              {task.isMilestone && (
                <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                  isDarkMode ? 'bg-amber-400/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                }`} title="Hito">
                  <MapPin size={10} /> HITO
                </span>
              )}
            </div>
          </div>
          {renderStars(task.id, task.priority || 3)}
        </div>
        <div className="flex items-center gap-2 mb-1">
          <h4 className={`font-bold text-sm ${textColor}`}>{task.title}</h4>
          {task.isCritical && (
            <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
            }`} title="Ruta Crítica">
              <AlertTriangle size={10} /> CPM
            </span>
          )}
        </div>
        {(() => {
          const taskStage = project?.stages?.find((s: any) => s.id === task.stageId || s.name === task.phase);
          return (
            <div className="flex items-center gap-1.5 flex-wrap mb-3 text-xs">
              {taskStage && (
                <span 
                  className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border"
                  style={{
                    backgroundColor: `${taskStage.color || '#3b82f6'}15`,
                    color: taskStage.color || '#3b82f6',
                    borderColor: `${taskStage.color || '#3b82f6'}30`
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: taskStage.color || '#3b82f6' }} />
                  {taskStage.name}
                </span>
              )}
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'
              }`}>
                {task.epic || 'Sprint general'}
              </span>
            </div>
          );
        })()}
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
              isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-600'
            }`}>
              {assignedStudent ? `${assignedStudent.firstName.charAt(0)}${assignedStudent.lastNamePaterno.charAt(0)}` : '?'}
            </div>
            <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
              {assignedStudent ? formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno) : 'Sin asignar'}
            </span>
          </div>
          <div className="flex gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className={`px-2 py-1 rounded-md tabular-nums ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-100 text-slate-500'}`}>Esfuerzo: {task.effort || 0}</span>
            <span className={`px-2 py-1 rounded-md tabular-nums ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>SP: {task.estimatedSP || 0}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${
      isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200'
    }`}>
      {/* Search and Multi-Column Filters */}
      <div className={`p-4 border-b flex flex-col gap-3 transition-colors ${
        isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Global Search Bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search size={16} className={`absolute left-3 top-1/2 -translate-y-1/2 ${
              isDarkMode ? 'text-slate-500' : 'text-slate-400'
            }`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, epic o estudiante..."
              className={`w-full pl-9 pr-9 py-2 rounded-xl text-xs font-semibold outline-none focus:ring-2 transition-all ${
                isDarkMode
                  ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20 placeholder:text-gray-500'
                  : 'bg-white border border-slate-200 text-slate-900 focus:ring-indigo-500 placeholder:text-slate-400'
              }`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                }`}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Stats & Active Filter Count */}
          <div className="flex items-center gap-2 self-end md:self-auto text-xs font-bold">
            <span className={`tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              {filteredTasks.length} de {cpmTasks.length} tareas
            </span>
            {(searchQuery || filterUser || filterStatus || filterPriority || filterStage) && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterUser('');
                  setFilterStatus('');
                  setFilterPriority('');
                  setFilterStage('');
                }}
                className="px-2 py-1 rounded-lg text-[11px] font-bold text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-1 cursor-pointer"
                title="Limpiar todos los filtros"
              >
                <X size={12} />
                <span>Limpiar</span>
              </button>
            )}
          </div>
        </div>

        {/* Multi-Criteria Selects */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className={`flex items-center gap-1.5 font-bold text-[11px] uppercase tracking-wider ${
            isDarkMode ? 'text-gray-500' : 'text-slate-500'
          }`}>
            <Filter size={13} />
            <span>Filtrar:</span>
          </div>

          {/* Etapa */}
          {project?.stages && project.stages.length > 0 && (
            <select
              value={filterStage}
              onChange={e => setFilterStage(e.target.value)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 transition-all cursor-pointer ${
                filterStage ? (isDarkMode ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/40' : 'bg-indigo-50 text-indigo-700 border border-indigo-200') : ''
              } ${
                isDarkMode 
                  ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20' 
                  : 'bg-white border border-slate-200 text-slate-900 focus:ring-indigo-500'
              }`}
            >
              <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Todas las Etapas</option>
              {project.stages.map((st: any) => (
                <option key={st.id} value={st.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                  {st.name}
                </option>
              ))}
            </select>
          )}

          {/* Responsable */}
          <select 
            value={filterUser} 
            onChange={e => setFilterUser(e.target.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 transition-all ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20' 
                : 'bg-white border border-slate-200 text-slate-900 focus:ring-indigo-500'
            }`}
          >
            <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Todos los Responsables</option>
            {students.map((s: any) => (
              <option key={s.id} value={s.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                {formatName(s.firstName, s.lastNamePaterno)}
              </option>
            ))}
          </select>

          {/* Estado */}
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 transition-all ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20' 
                : 'bg-white border border-slate-200 text-slate-900 focus:ring-indigo-500'
            }`}
          >
            <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Todos los Estados</option>
            {KANBAN_COLUMNS.map(col => (
              <option key={col.id} value={col.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                {col.title}
              </option>
            ))}
          </select>

          {/* Prioridad */}
          <select 
            value={filterPriority} 
            onChange={e => setFilterPriority(e.target.value)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 transition-all ${
              isDarkMode 
                ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20' 
                : 'bg-white border border-slate-200 text-slate-900 focus:ring-indigo-500'
            }`}
          >
            <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Toda Prioridad</option>
            <option value="5" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>5 Estrellas (Urgente)</option>
            <option value="4" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>4 Estrellas (Alta)</option>
            <option value="3" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>3 Estrellas (Media)</option>
            <option value="2" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>2 Estrellas (Baja)</option>
            <option value="1" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>1 Estrella (Mínima)</option>
          </select>

          {/* Configurar Sprints Action */}
          {onOpenSprintConfig && (
            <button
              type="button"
              onClick={onOpenSprintConfig}
              className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shadow-xs ${
                isDarkMode 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20' 
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Configurar Sprints e Iteraciones"
            >
              <Zap size={13} className="text-amber-500 fill-amber-500" />
              <span>Configurar Sprints</span>
            </button>
          )}

          {/* Selection indicator if any items selected */}
          {selectedTaskIds.size > 0 && (
            <div className={`${!onOpenSprintConfig ? 'ml-auto' : ''} flex items-center gap-2`}>
              <span className={`text-xs font-bold tabular-nums px-2 py-1 rounded-lg ${
                isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-50 text-indigo-700'
              }`}>
                {selectedTaskIds.size} seleccionadas
              </span>
              <button
                onClick={handleSelectAllVisible}
                className={`text-xs font-semibold underline transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-indigo-600'
                }`}
              >
                {selectedTaskIds.size === filteredTasks.length ? 'Deseleccionar todas' : 'Seleccionar visibles'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-auto transition-colors ${isDarkMode ? 'bg-[#121212]' : 'bg-slate-50/50'}`}>
        {isMobile ? (
          <div className="p-4 space-y-6">
            {Object.entries(groupedTasks).map(([groupKey, phaseTasks]) => {
              const isExpanded = expandedPhases[groupKey] !== false;
              const totalSP = phaseTasks.reduce((acc, t) => acc + (t.estimatedSP || 0), 0);
              const doneCount = phaseTasks.filter(t => t.status === 'done').length;
              const newTask = newTasks[groupKey] || { title: '', status: 'todo', isSubmitting: false };
              const statusConfig = KANBAN_COLUMNS.find(c => c.id === newTask.status);
              const borderColor = statusConfig?.color.replace('bg-', 'border-') || (isDarkMode ? 'border-white/10' : 'border-slate-200');
              
              const stage = project?.stages?.find((s: any) => s.id === groupKey);
              const displayName = stage ? stage.name : groupKey;
              const isStage = !!stage;

              return (
                <div key={groupKey} className="space-y-3">
                  <div 
                    className={`flex items-center justify-between p-3 rounded-xl border shadow-sm cursor-pointer transition-colors ${
                      isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                    }`}
                    onClick={() => togglePhase(groupKey)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                      <div className={`w-1 h-4 rounded-full ${isStage ? '' : (isDarkMode ? 'bg-white/20' : 'bg-slate-300')}`} style={isStage ? { backgroundColor: stage.color } : {}} />
                      <span className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{displayName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-500'
                      }`}>{phaseTasks.length}</span>
                    </div>
                    <div className={`text-xs font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                      Progreso: {Math.round((doneCount / phaseTasks.length) * 100) || 0}%
                    </div>
                  </div>

                  {isExpanded && (
                    <div className={`pl-2 border-l-2 space-y-3 ${isDarkMode ? 'border-white/10' : 'border-indigo-100'}`}>
                      <div className={`p-3 rounded-xl border shadow-sm h-44 flex flex-col transition-colors ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                      }`}>
                        <ChartContainer height={155} minHeight={140} isDarkMode={isDarkMode}>
                          <LineChart data={generateBurndownData(phaseTasks)} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'} />
                            <XAxis dataKey="day" tick={{fontSize: 10, fill: isDarkMode ? '#666' : '#94a3b8'}} />
                            <YAxis tick={{fontSize: 10, fill: isDarkMode ? '#666' : '#94a3b8'}} />
                            <Tooltip 
                              contentStyle={isDarkMode ? { backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' } : {}}
                            />
                            <Line type="monotone" dataKey="ideal" stroke={isDarkMode ? '#444' : '#94a3b8'} strokeDasharray="5 5" dot={false} />
                            <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} />
                          </LineChart>
                        </ChartContainer>
                      </div>
                      {phaseTasks.map(task => renderMobileTaskCard(task))}
                      
                      {/* Mobile Quick Add */}
                      {permissions.canCreateTask && (
                        <div className={`p-4 rounded-xl shadow-sm border-l-4 border-y border-r mb-3 transition-colors ${
                          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                        } ${borderColor}`}>
                          <div className="flex gap-2 mb-3">
                            <select 
                              value={newTask.status}
                              onChange={e => setNewTasks(prev => ({ ...prev, [groupKey]: { ...newTask, status: e.target.value as KanbanColumnId } }))}
                              className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border outline-none ${
                                statusConfig?.color
                              } text-white ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                            >
                              {KANBAN_COLUMNS.filter(c => !c.hideFromBoard).map(col => (
                                <option key={col.id} value={col.id} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-slate-900'}>{col.title}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex gap-2 items-center">
                            <div className="flex-1 min-w-0">
                              <input 
                                type="text"
                                value={newTask.title}
                                onChange={e => setNewTasks(prev => ({ ...prev, [groupKey]: { ...newTask, title: e.target.value } }))}
                                onKeyDown={e => e.key === 'Enter' && handleQuickAdd(groupKey, isStage)}
                                placeholder="Nueva tarea..."
                                className={`w-full rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 transition-all ${
                                  isDarkMode 
                                    ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20 placeholder:text-gray-600' 
                                    : 'bg-slate-50 border border-slate-200 text-slate-900 focus:ring-indigo-500'
                                }`}
                              />
                            </div>
                            <button 
                              onClick={() => handleQuickAdd(groupKey, isStage)}
                              disabled={newTask.isSubmitting || !newTask.title.trim()}
                              className="flex-shrink-0 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors h-[38px] w-[38px] flex items-center justify-center"
                            >
                              {newTask.isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {Object.keys(groupedTasks).length === 0 && (
              <div className={`p-8 text-center font-medium rounded-xl border transition-colors ${
                isDarkMode ? 'bg-white/5 border-white/10 text-gray-500' : 'bg-white border-slate-200 text-slate-500'
              }`}>
                No hay tareas que coincidan con los filtros.
              </div>
            )}
          </div>
        ) : (
          <table className={`w-full text-left border-collapse transition-colors ${isDarkMode ? 'bg-[#121212]' : 'bg-white'}`}>
            <thead className={`sticky top-0 shadow-sm z-10 transition-colors ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
              <tr>
                <th className={`p-4 w-12 text-center border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                  <input
                    type="checkbox"
                    checked={filteredTasks.length > 0 && selectedTaskIds.size === filteredTasks.length}
                    onChange={handleSelectAllVisible}
                    className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                    title="Seleccionar todas las tareas visibles"
                  />
                </th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>Tarea</th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>Responsable</th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>Estado</th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>Prioridad</th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>Tipo</th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>Esfuerzo</th>
                <th className={`p-4 text-xs font-black uppercase tracking-widest border-b ${isDarkMode ? 'text-gray-500 border-white/10' : 'text-slate-400 border-slate-200'}`}>SP Est.</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groupedTasks).map(([groupKey, phaseTasks]) => {
                const isExpanded = expandedPhases[groupKey] !== false; // Default true
                const totalSP = phaseTasks.reduce((acc, t) => acc + (t.estimatedSP || 0), 0);
                const doneCount = phaseTasks.filter(t => t.status === 'done').length;
                const newTask = newTasks[groupKey] || { title: '', status: 'todo', isSubmitting: false };
                const statusConfig = KANBAN_COLUMNS.find(c => c.id === newTask.status);
                const borderColor = statusConfig?.color || (isDarkMode ? 'bg-white/20' : 'bg-slate-200');
                
                const stage = project?.stages?.find((s: any) => s.id === groupKey);
                const displayName = stage ? stage.name : groupKey;
                const isStage = !!stage;

                return (
                  <React.Fragment key={groupKey}>
                    {/* Phase Header */}
                    <tr 
                      className={`transition-colors cursor-pointer group ${
                        isDarkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-50 hover:bg-slate-100'
                      }`} 
                      onClick={() => togglePhase(groupKey)}
                    >
                      <td colSpan={8} className={`p-4 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={phaseTasks.length > 0 && phaseTasks.every((t: any) => selectedTaskIds.has(t.id))}
                              onChange={(e) => handleTogglePhaseSelection(phaseTasks, e)}
                              onClick={(e) => e.stopPropagation()}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4 mr-1"
                              title="Seleccionar fase completa"
                            />
                            {isExpanded ? <ChevronDown size={18} className="text-slate-400 group-hover:text-indigo-600" /> : <ChevronRight size={18} className="text-slate-400 group-hover:text-indigo-600" />}
                            <div className={`w-1 h-4 rounded-full ${isStage ? '' : (isDarkMode ? 'bg-white/20' : 'bg-slate-300')}`} style={isStage ? { backgroundColor: stage.color } : {}} />
                            <span className={`font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{displayName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              isDarkMode ? 'bg-white/10 text-gray-400 border-white/10' : 'bg-white text-slate-500 border-slate-200'
                            }`}>{phaseTasks.length} tareas</span>
                          </div>
                          <div className={`flex gap-4 text-xs font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                            <span>Progreso: {Math.round((doneCount / phaseTasks.length) * 100) || 0}%</span>
                            <span className="tabular-nums">Total SP: {totalSP}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Burndown Chart (if expanded) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className={`p-0 border-b transition-colors ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200'}`}>
                          <div className="h-48 p-4 border-l-4 border-indigo-500 flex flex-col">
                            <ChartContainer height={192} minHeight={180} isDarkMode={isDarkMode}>
                              <LineChart data={generateBurndownData(phaseTasks)} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'} />
                                <XAxis dataKey="day" tick={{fontSize: 10, fill: isDarkMode ? '#666' : '#94a3b8'}} />
                                <YAxis tick={{fontSize: 10, fill: isDarkMode ? '#666' : '#94a3b8'}} />
                                <Tooltip 
                                  contentStyle={isDarkMode ? { backgroundColor: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' } : {}}
                                />
                                <Line type="monotone" dataKey="ideal" stroke={isDarkMode ? '#444' : '#94a3b8'} strokeDasharray="5 5" dot={false} />
                                <Line type="monotone" dataKey="actual" stroke="#6366f1" strokeWidth={2} />
                              </LineChart>
                            </ChartContainer>
                          </div>
                        </td>
                      </tr>
                    )}

                    {/* Tasks */}
                    {isExpanded && phaseTasks.map((task: any) => {
                      const assignedStudent = students.find((s: any) => s.id === task.assignedTo);
                      const statusConfig = KANBAN_COLUMNS.find(c => c.id === task.status);
                      const textColor = statusConfig?.color.replace('bg-', 'text-') || (isDarkMode ? 'text-white' : 'text-slate-800');
                      const borderColor = statusConfig?.color || (isDarkMode ? 'bg-white/20' : 'bg-slate-200');

                      return (
                        <tr 
                          key={task.id} 
                          onClick={() => setSelectedTaskId(task.id)}
                          className={`border-b transition-colors cursor-pointer ${
                            isDarkMode 
                              ? `border-white/5 hover:bg-white/[0.02] ${task.isCritical ? 'bg-red-500/5' : ''} ${selectedTaskIds.has(task.id) ? 'bg-indigo-500/10' : ''}` 
                              : `border-slate-100 hover:bg-indigo-50/30 ${task.isCritical ? 'bg-red-50/10' : ''} ${selectedTaskIds.has(task.id) ? 'bg-indigo-50/50' : ''}`
                          }`}
                        >
                          <td className="p-4 w-12 text-center" onClick={e => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.has(task.id)}
                              onChange={() => handleToggleSelectTask(task.id)}
                              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer w-4 h-4"
                            />
                          </td>
                          <td className="p-4 relative">
                            {/* Status Indicator Bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.isCritical ? 'bg-red-500' : borderColor}`} style={task.color ? { backgroundColor: task.color } : {}} />
                            
                            <div className="flex items-center gap-2">
                              <div className={`font-bold text-sm ${textColor}`}>{task.title}</div>
                              {task.isMilestone && (
                                <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  isDarkMode ? 'bg-amber-400/10 text-amber-400' : 'bg-amber-50 text-amber-600'
                                }`} title="Hito">
                                  <MapPin size={10} /> HITO
                                </span>
                              )}
                              {task.isCritical && (
                                <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                                }`} title="Ruta Crítica">
                                  <AlertTriangle size={10} /> CPM
                                </span>
                              )}
                            </div>
                            {(() => {
                              const taskStage = project?.stages?.find((s: any) => s.id === task.stageId || s.name === task.phase);
                              return (
                                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                  {taskStage && (
                                    <span 
                                      className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border"
                                      style={{
                                        backgroundColor: `${taskStage.color || '#3b82f6'}15`,
                                        color: taskStage.color || '#3b82f6',
                                        borderColor: `${taskStage.color || '#3b82f6'}30`
                                      }}
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: taskStage.color || '#3b82f6' }} />
                                      {taskStage.name}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                    isDarkMode ? 'text-gray-400 bg-white/5' : 'text-slate-600 bg-slate-100'
                                  }`}>
                                    {task.epic || 'Sprint general'}
                                  </span>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="p-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const uids = task.assignedUsers || (task.assignedTo ? [task.assignedTo] : []);
                                const firstUid = uids[0];
                                const assignedStudent = students.find((s: any) => s.id === firstUid);
                                return (
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                      isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-600'
                                    }`}>
                                      {assignedStudent ? `${assignedStudent.firstName.charAt(0)}${assignedStudent.lastNamePaterno.charAt(0)}` : '?'}
                                    </div>
                                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                                      {assignedStudent ? formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno) : 'Sin asignar'}
                                      {uids.length > 1 && <span className="ml-1 text-indigo-500">+{uids.length - 1}</span>}
                                    </span>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                          <td className="p-4" onClick={e => e.stopPropagation()}>
                            <select
                              value={task.status || ''}
                              onChange={async (e) => {
                                if (!permissions.canEditTask) return;
                                const newStatus = e.target.value;
                                try {
                                  await updateTaskStatus(task.id, newStatus, task.status);
                                } catch (error) {
                                  toast.error('Error al actualizar estado');
                                }
                              }}
                              disabled={!permissions.canEditTask}
                              className={`rounded-lg px-2 py-1 text-[10px] font-black outline-none focus:ring-2 disabled:opacity-50 uppercase tracking-widest cursor-pointer transition-all ${
                                isDarkMode 
                                  ? 'bg-white/5 border border-white/10 focus:ring-white/20' 
                                  : 'bg-slate-50 border border-slate-200 focus:ring-indigo-500'
                              } ${textColor}`}
                            >
                              {KANBAN_COLUMNS.map(col => (
                                <option key={col.id} value={col.id} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-slate-900'}>
                                  {col.title}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-4">
                            {renderStars(task.id, task.priority || 3)}
                          </td>
                          <td className="p-4" onClick={e => e.stopPropagation()}>
                            <select
                              value={task.type || 'LEVANTAMIENTO'}
                              onChange={async (e) => {
                                if (!permissions.canEditTask) return;
                                const newType = e.target.value;
                                try {
                                  await updateTaskField(task.id, 'type', newType, task.type);
                                } catch (error) {
                                  toast.error('Error al actualizar tipo');
                                }
                              }}
                              disabled={!permissions.canEditTask}
                              className={`bg-transparent border-none text-[10px] font-black uppercase outline-none focus:ring-0 cursor-pointer transition-colors max-w-[120px] truncate ${
                                isDarkMode ? 'text-gray-500 hover:text-white' : 'text-slate-500 hover:text-indigo-600'
                              }`}
                            >
                              {[
                                'LEVANTAMIENTO',
                                'DIAGNÓSTICO',
                                'SOCIAL / TALLER',
                                'REUNIÓN / COORDINACIÓN',
                                'DISEÑO / MODELADO',
                                'PLANOS EJECUTIVOS',
                                'COSTOS Y PRESUPUESTO',
                                'REVISIÓN / ENTREGA'
                              ].map(t => (
                                <option key={t} value={t} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{t}</option>
                              ))}
                            </select>
                          </td>
                          <td className={`p-4 text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-700'}`}>{task.effort || 0}</td>
                          <td className={`p-4 text-sm font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-700'}`}>{task.estimatedSP || 0}</td>
                        </tr>
                      );
                    })}

                    {/* Quick Add Row */}
                    {isExpanded && permissions.canCreateTask && (
                      <tr className={`border-b transition-colors ${isDarkMode ? 'border-white/5 bg-white/[0.01]' : 'border-slate-100 bg-slate-50/30'}`}>
                        <td className="p-4 w-12 text-center"></td>
                        <td className="p-4 relative">
                          <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderColor}`} />
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newTask.title}
                              onChange={e => setNewTasks(prev => ({ ...prev, [groupKey]: { ...newTask, title: e.target.value } }))}
                              onKeyDown={e => e.key === 'Enter' && handleQuickAdd(groupKey, isStage)}
                              placeholder="Nueva tarea..."
                              className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 transition-all ${
                                isDarkMode 
                                  ? 'bg-white/5 border border-white/10 text-white focus:ring-white/20 placeholder:text-gray-600' 
                                  : 'bg-white border border-slate-200 text-slate-900 focus:ring-indigo-500'
                              }`}
                            />
                            <button 
                              onClick={() => handleQuickAdd(groupKey, isStage)}
                              disabled={newTask.isSubmitting || !newTask.title.trim()}
                              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                              {newTask.isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className={`flex items-center gap-2 italic text-xs ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                            <User size={14} /> Sin asignar
                          </div>
                        </td>
                        <td className="p-4">
                          <select 
                            value={newTask.status}
                            onChange={e => setNewTasks(prev => ({ ...prev, [groupKey]: { ...newTask, status: e.target.value as KanbanColumnId } }))}
                            className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md border outline-none ${
                              statusConfig?.color
                            } text-white ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}
                          >
                            {KANBAN_COLUMNS.filter(c => !c.hideFromBoard).map(col => (
                              <option key={col.id} value={col.id} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-slate-900'}>{col.title}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-0.5 opacity-30">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={`star-${i}`} size={14} className={i < 3 ? 'text-yellow-400 fill-yellow-400' : (isDarkMode ? 'text-gray-700' : 'text-slate-200')} />
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>LEVANTAMIENTO</span>
                        </td>
                        <td className={`p-4 text-sm font-bold tabular-nums ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>1</td>
                        <td className={`p-4 text-sm font-bold tabular-nums ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>1</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {Object.keys(groupedTasks).length === 0 && (
                <tr>
                  <td colSpan={8} className={`p-8 text-center font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    No hay tareas que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Floating Bulk Actions Bar */}
      <BulkActionsDock
        selectedCount={selectedTaskIds.size}
        onClearSelection={() => setSelectedTaskIds(new Set())}
        onUpdateStatus={handleBulkUpdateStatus}
        onUpdateAssignee={handleBulkUpdateAssignee}
        onUpdatePriority={handleBulkUpdatePriority}
        onBulkDelete={() => setIsBulkDeleteModalOpen(true)}
        students={students}
        isDarkMode={isDarkMode}
        canEdit={permissions.canEditTask}
        canDelete={permissions.canDeleteTask}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmModal
        isOpen={isBulkDeleteModalOpen}
        onClose={() => setIsBulkDeleteModalOpen(false)}
        onConfirm={handleBulkDeleteConfirm}
        title="Eliminar tareas seleccionadas"
        message={`¿Estás seguro de que deseas eliminar permanentemente las ${selectedTaskIds.size} tareas seleccionadas? Esta acción no se puede revertir.`}
        confirmText="Eliminar tareas"
        cancelText="Cancelar"
        type="danger"
        isDarkMode={isDarkMode}
      />

      <AnimatePresence>
        {selectedTaskId && (
          <TaskSidePanel 
            key={selectedTaskId}
            taskId={selectedTaskId} 
            projectId={projectId} 
            onClose={() => setSelectedTaskId(null)} 
            userRole={userRole}
            currentUser={currentUser}
            students={students}
            sprints={sprints}
            updateTaskStatus={updateTaskStatus}
            updateTaskField={updateTaskField}
            updateTaskFields={updateTaskFields}
            deleteTask={deleteTask}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default SprintTable;
