import React, { useState, useMemo, useEffect } from 'react';
import { Star, ChevronDown, ChevronRight, Filter, User, AlertTriangle, Plus, Send, Loader2 } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import TaskSidePanel from './TaskSidePanel';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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
  updateTaskStatus,
  updateTaskField,
  deleteTask,
  addTask,
  permissions,
  isDarkMode
}: any) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  const [filterUser, setFilterUser] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
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
      toast.success('Prioridad actualizada');
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
      const stage = isStage ? project.stages.find((s: any) => s.id === groupKey) : null;
      
      const isUser = userRole === 'user';
      const task = {
        title: newTaskData.title,
        status: isUser ? 'pending_approval' : newTaskData.status,
        phase: isStage ? (stage?.name || '') : (groupKey === 'Sin Sprint' ? '' : groupKey),
        stageId: isStage ? groupKey : null,
        projectId,
        priority: 3,
        effort: 1,
        type: 'feature',
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
      if (filterUser && t.assignedTo !== filterUser) return false;
      if (filterStatus && t.status !== filterStatus) return false;
      return true;
    });
  }, [cpmTasks, filterUser, filterStatus]);

  const groupedTasks = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredTasks.forEach((t: any) => {
      const groupKey = t.stageId || t.phase || 'Sin Sprint';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(t);
    });
    return groups;
  }, [filteredTasks]);

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
      >
        <div className="flex justify-between items-start mb-2">
          <StatusBadge status={task.status} size="sm" />
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
        <div className={`text-xs mb-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{task.epic || 'Sin Epic'}</div>
        
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
            <span className={`px-2 py-1 rounded-md ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-100 text-slate-500'}`}>Esfuerzo: {task.effort || 0}</span>
            <span className={`px-2 py-1 rounded-md ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>SP: {task.estimatedSP || 0}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`h-full flex flex-col rounded-2xl shadow-sm border overflow-hidden transition-colors ${
      isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200'
    }`}>
      {/* Filters */}
      <div className={`p-4 border-b flex flex-col sm:flex-row gap-4 items-start sm:items-center transition-colors ${
        isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-slate-50 border-slate-200'
      }`}>
        <div className={`flex items-center gap-2 font-bold text-xs uppercase tracking-widest ${
          isDarkMode ? 'text-gray-500' : 'text-slate-500'
        }`}>
          <Filter size={16} /> Filtros:
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <select 
            value={filterUser} 
            onChange={e => setFilterUser(e.target.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 transition-all w-full sm:w-auto ${
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
          <select 
            value={filterStatus} 
            onChange={e => setFilterStatus(e.target.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold outline-none focus:ring-2 transition-all w-full sm:w-auto ${
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
                      <div className={`p-3 rounded-xl border shadow-sm h-40 transition-colors ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
                      }`}>
                        <ResponsiveContainer width="100%" height="100%">
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
                        </ResponsiveContainer>
                      </div>
                      {phaseTasks.map(task => {
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
                          >
                            <div className="flex justify-between items-start mb-2">
                              <StatusBadge status={task.status} size="sm" />
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
                            <div className={`text-xs mb-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{task.epic || 'Sin Epic'}</div>
                            
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
                                <span className={`px-2 py-1 rounded-md ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-100 text-slate-500'}`}>Esfuerzo: {task.effort || 0}</span>
                                <span className={`px-2 py-1 rounded-md ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>SP: {task.estimatedSP || 0}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      
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
                      <td colSpan={7} className={`p-4 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronDown size={18} className="text-slate-400 group-hover:text-indigo-600" /> : <ChevronRight size={18} className="text-slate-400 group-hover:text-indigo-600" />}
                            <div className={`w-1 h-4 rounded-full ${isStage ? '' : (isDarkMode ? 'bg-white/20' : 'bg-slate-300')}`} style={isStage ? { backgroundColor: stage.color } : {}} />
                            <span className={`font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{displayName}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                              isDarkMode ? 'bg-white/10 text-gray-400 border-white/10' : 'bg-white text-slate-500 border-slate-200'
                            }`}>{phaseTasks.length} tareas</span>
                          </div>
                          <div className={`flex gap-4 text-xs font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                            <span>Progreso: {Math.round((doneCount / phaseTasks.length) * 100) || 0}%</span>
                            <span>Total SP: {totalSP}</span>
                          </div>
                        </div>
                      </td>
                    </tr>

                    {/* Burndown Chart (if expanded) */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={7} className={`p-0 border-b transition-colors ${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200'}`}>
                          <div className="h-48 p-4 border-l-4 border-indigo-500">
                            <ResponsiveContainer width="100%" height="100%">
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
                            </ResponsiveContainer>
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
                              ? `border-white/5 hover:bg-white/[0.02] ${task.isCritical ? 'bg-red-500/5' : ''}` 
                              : `border-slate-100 hover:bg-indigo-50/30 ${task.isCritical ? 'bg-red-50/10' : ''}`
                          }`}
                        >
                          <td className="p-4 relative">
                            {/* Status Indicator Bar */}
                            <div className={`absolute left-0 top-0 bottom-0 w-1 ${task.isCritical ? 'bg-red-500' : borderColor}`} />
                            
                            <div className="flex items-center gap-2">
                              <div className={`font-bold text-sm ${textColor}`}>{task.title}</div>
                              {task.isCritical && (
                                <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
                                  isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-50 text-red-600'
                                }`} title="Ruta Crítica">
                                  <AlertTriangle size={10} /> CPM
                                </span>
                              )}
                            </div>
                            <div className={`text-xs ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>{task.epic || 'Sin Epic'}</div>
                          </td>
                          <td className="p-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-600'
                              }`}>
                                {assignedStudent ? `${assignedStudent.firstName.charAt(0)}${assignedStudent.lastNamePaterno.charAt(0)}` : '?'}
                              </div>
                              <select
                                value={task.assignedTo || ''}
                                onChange={async (e) => {
                                  if (!permissions.canEditTask) return;
                                  const newUserId = e.target.value;
                                  try {
                                    await updateTaskField(task.id, 'assignedTo', newUserId, task.assignedTo);
                                    toast.success('Responsable actualizado');
                                  } catch (error) {
                                    toast.error('Error al actualizar responsable');
                                  }
                                }}
                                disabled={!permissions.canEditTask}
                                className={`bg-transparent border-none text-sm font-semibold outline-none focus:ring-0 cursor-pointer transition-colors ${
                                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-indigo-600'
                                }`}
                              >
                                <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Sin asignar</option>
                                {students.map((s: any) => (
                                  <option key={s.id} value={s.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                                    {formatName(s.firstName, s.lastNamePaterno)}
                                  </option>
                                ))}
                              </select>
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
                                  toast.success('Estado actualizado');
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
                              value={task.type || 'feature'}
                              onChange={async (e) => {
                                if (!permissions.canEditTask) return;
                                const newType = e.target.value;
                                try {
                                  await updateTaskField(task.id, 'type', newType, task.type);
                                  toast.success('Tipo actualizado');
                                } catch (error) {
                                  toast.error('Error al actualizar tipo');
                                }
                              }}
                              disabled={!permissions.canEditTask}
                              className={`bg-transparent border-none text-xs font-bold capitalize outline-none focus:ring-0 cursor-pointer transition-colors ${
                                isDarkMode ? 'text-gray-500 hover:text-white' : 'text-slate-500 hover:text-indigo-600'
                              }`}
                            >
                              <option value="feature" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Feature</option>
                              <option value="bug" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Bug</option>
                              <option value="chore" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Chore</option>
                              <option value="documentation" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Doc</option>
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
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>feature</span>
                        </td>
                        <td className={`p-4 text-sm font-bold ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>1</td>
                        <td className={`p-4 text-sm font-bold ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>1</td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {Object.keys(groupedTasks).length === 0 && (
                <tr>
                  <td colSpan={7} className={`p-8 text-center font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    No hay tareas que coincidan con los filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

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
            updateTaskStatus={updateTaskStatus}
            updateTaskField={updateTaskField}
            deleteTask={deleteTask}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>

    </div>
  );
};

export default SprintTable;
