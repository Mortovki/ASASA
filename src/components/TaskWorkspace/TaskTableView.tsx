import React, { useState } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  MessageSquare, 
  Paperclip, 
  AlertCircle, 
  Check, 
  Trash2, 
  MoreHorizontal,
  Calendar,
  Clock,
  User as UserIcon
} from 'lucide-react';
import { ProjectTask, TaskGroup, TaskPriority, TaskStatus } from '../../types/tasks';
import { updateTask, createTask, deleteTask } from '../../services/taskService';
import toast from 'react-hot-toast';

interface TaskTableViewProps {
  tasks: ProjectTask[];
  groups: TaskGroup[];
  students: any[];
  projectId: string;
  projectName: string;
  currentUserId: string;
  currentUserName: string;
  canEditStructure: boolean;
  canEditStatus: boolean;
  isDarkMode: boolean;
  onSelectTask: (task: ProjectTask) => void;
  onAddGroup?: (name: string) => void;
}

export const TaskTableView: React.FC<TaskTableViewProps> = ({
  tasks,
  groups,
  students,
  projectId,
  projectName,
  currentUserId,
  currentUserName,
  canEditStructure,
  canEditStatus,
  isDarkMode,
  onSelectTask,
  onAddGroup
}) => {
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [newTaskTitle, setNewTaskTitle] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddGroupInput, setShowAddGroupInput] = useState(false);

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleQuickAddTask = async (groupId: string, groupName: string) => {
    const title = (newTaskTitle[groupId] || '').trim();
    if (!title) return;

    try {
      const today = new Date().toISOString().split('T')[0];
      await createTask({
        projectId,
        projectName,
        groupId,
        groupName,
        title,
        assigneeIds: [],
        status: 'no_iniciado',
        priority: 'media',
        startDate: today,
        endDate: today,
        dueDate: today,
        createdBy: currentUserId,
        createdByName: currentUserName,
        updatedBy: currentUserId
      });
      setNewTaskTitle(prev => ({ ...prev, [groupId]: '' }));
      toast.success('Tarea creada');
    } catch (err) {
      toast.error('Error al crear tarea');
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'listo':
        return 'bg-emerald-500 text-white';
      case 'en_curso':
        return 'bg-amber-500 text-white';
      case 'detenido':
        return 'bg-rose-500 text-white';
      default:
        return 'bg-slate-400 text-white';
    }
  };

  const getStatusLabel = (status: TaskStatus) => {
    switch (status) {
      case 'listo': return 'Listo';
      case 'en_curso': return 'En curso';
      case 'detenido': return 'Detenido';
      default: return 'No iniciado';
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'alta':
        return 'bg-indigo-900 text-indigo-100';
      case 'media':
        return 'bg-indigo-600 text-white';
      case 'baja':
        return 'bg-blue-400 text-white';
      default:
        return 'bg-slate-300 text-slate-800';
    }
  };

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(`${dateStr}T12:00:00Z`);
      return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatRelativeTime = (isoString?: string) => {
    if (!isoString) return '-';
    const diffMins = Math.floor((Date.now() - new Date(isoString).getTime()) / 60000);
    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} h`;
    return `Hace ${Math.floor(diffHours / 24)} d`;
  };

  return (
    <div className="space-y-8 select-none">
      {groups.map(group => {
        const groupTasks = tasks.filter(t => t.groupId === group.id || (group.id === 'pendientes' && !t.groupId));
        const isCollapsed = collapsedGroups[group.id];

        // Summary stats
        const doneCount = groupTasks.filter(t => t.status === 'listo').length;
        const inProgressCount = groupTasks.filter(t => t.status === 'en_curso').length;
        const stuckCount = groupTasks.filter(t => t.status === 'detenido').length;
        const notStartedCount = groupTasks.filter(t => t.status === 'no_iniciado').length;
        const totalFiles = groupTasks.reduce((acc, t) => acc + (t.attachments?.length || 0), 0);

        return (
          <div key={group.id} className="space-y-2">
            {/* Group Header */}
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
              >
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
              </button>
              <h3 
                className="text-sm font-black tracking-tight uppercase"
                style={{ color: group.color || '#6366f1' }}
              >
                {group.name}
              </h3>
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                {groupTasks.length}
              </span>
            </div>

            {/* Table Container */}
            {!isCollapsed && (
              <div className={`overflow-x-auto rounded-2xl border ${isDarkMode ? 'border-white/10 bg-[#1e1e24]' : 'border-slate-200 bg-white shadow-sm'}`}>
                <table className="w-full text-left border-collapse text-xs">
                  {/* Table Head */}
                  <thead>
                    <tr className={`border-b ${isDarkMode ? 'border-white/10 text-gray-400 bg-white/5' : 'border-slate-200 text-slate-500 bg-slate-50'}`}>
                      <th className="py-2.5 px-3 w-8 text-center font-bold">
                        <input type="checkbox" className="rounded border-slate-300 cursor-pointer" />
                      </th>
                      <th className="py-2.5 px-4 font-bold min-w-[240px]">Tarea</th>
                      <th className="py-2.5 px-3 font-bold w-32 text-center">Responsable</th>
                      <th className="py-2.5 px-3 font-bold w-36 text-center">Estado</th>
                      <th className="py-2.5 px-3 font-bold w-32 text-center">Vencimiento</th>
                      <th className="py-2.5 px-3 font-bold w-28 text-center">Prioridad</th>
                      <th className="py-2.5 px-3 font-bold w-24 text-center">Archivos</th>
                      <th className="py-2.5 px-3 font-bold w-40 text-center">Cronograma</th>
                      <th className="py-2.5 px-3 font-bold w-36 text-center">Última actualización</th>
                      <th className="py-2.5 px-3 font-bold w-12 text-center"></th>
                    </tr>
                  </thead>

                  {/* Table Body */}
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {groupTasks.map(task => {
                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'listo';
                      const assignees = (task.assigneeIds || []).map(id => students.find(s => s.id === id || s.uid === id)).filter(Boolean);

                      return (
                        <tr 
                          key={task.id} 
                          onClick={() => onSelectTask(task)}
                          className={`group hover:bg-indigo-50/40 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                            isDarkMode ? 'text-gray-200' : 'text-slate-800'
                          }`}
                        >
                          {/* Checkbox */}
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <input 
                              type="checkbox" 
                              checked={task.status === 'listo'}
                              onChange={async (e) => {
                                const nextStatus: TaskStatus = e.target.checked ? 'listo' : 'no_iniciado';
                                await updateTask(task.id, { status: nextStatus });
                              }}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer" 
                            />
                          </td>

                          {/* Tarea Title */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-bold truncate text-[13px] ${task.status === 'listo' ? 'line-through opacity-50' : ''}`}>
                                {task.title}
                              </span>
                              <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  type="button" 
                                  title="Ver conversación"
                                  className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-200 text-slate-500'}`}
                                >
                                  <MessageSquare size={13} />
                                </button>
                                {task.comments && task.comments.length > 0 && (
                                  <span className="text-[10px] font-black text-indigo-500">
                                    {task.comments.length}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Responsables */}
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-center -space-x-1.5">
                              {assignees.length > 0 ? (
                                assignees.slice(0, 3).map((st: any, i: number) => (
                                  <div 
                                    key={i} 
                                    title={st.name || st.firstName}
                                    className="w-7 h-7 rounded-full bg-indigo-600 text-white font-black text-[10px] flex items-center justify-center border-2 border-white dark:border-[#1e1e24] shadow-sm"
                                  >
                                    {(st.firstName || st.name || 'P')[0]}
                                  </div>
                                ))
                              ) : (
                                <div className="w-7 h-7 rounded-full border border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-400">
                                  <UserIcon size={12} />
                                </div>
                              )}
                              {assignees.length > 3 && (
                                <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-gray-300 font-bold text-[9px] flex items-center justify-center border-2 border-white dark:border-[#1e1e24]">
                                  +{assignees.length - 3}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Estado Pill */}
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            {canEditStatus ? (
                              <div className="relative inline-block w-full">
                                <select 
                                  value={task.status}
                                  onChange={async (e) => {
                                    await updateTask(task.id, { status: e.target.value as TaskStatus });
                                  }}
                                  className={`w-full py-1 px-2.5 rounded-lg text-center font-black text-[11px] uppercase tracking-wider appearance-none cursor-pointer border-none shadow-sm transition-transform active:scale-95 ${getStatusColor(task.status)}`}
                                >
                                  <option value="no_iniciado" className="bg-white text-slate-800">No iniciado</option>
                                  <option value="en_curso" className="bg-white text-slate-800">En curso</option>
                                  <option value="detenido" className="bg-white text-slate-800">Detenido</option>
                                  <option value="listo" className="bg-white text-slate-800">Listo</option>
                                </select>
                              </div>
                            ) : (
                              <span className={`inline-block w-full py-1 px-2.5 rounded-lg text-center font-black text-[11px] uppercase tracking-wider shadow-sm ${getStatusColor(task.status)}`}>
                                {getStatusLabel(task.status)}
                              </span>
                            )}
                          </td>

                          {/* Vencimiento */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isOverdue && <AlertCircle size={13} className="text-rose-500 animate-pulse" />}
                              <span className={`font-bold ${isOverdue ? 'text-rose-500' : 'text-slate-500 dark:text-gray-400'}`}>
                                {formatShortDate(task.dueDate)}
                              </span>
                            </div>
                          </td>

                          {/* Prioridad */}
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-block py-1 px-3 rounded-lg font-black text-[10px] uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
                              {task.priority}
                            </span>
                          </td>

                          {/* Archivos / Entregables */}
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1 text-slate-500 dark:text-gray-400">
                              <Paperclip size={13} className={task.attachments?.length ? 'text-indigo-500' : ''} />
                              <span className="font-bold">{task.attachments?.length || 0}</span>
                            </div>
                          </td>

                          {/* Cronograma / Fechas */}
                          <td className="py-2.5 px-3 text-center">
                            <span className="inline-block py-1 px-2.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-white/5 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-white/10">
                              {formatShortDate(task.startDate)} - {formatShortDate(task.endDate || task.dueDate)}
                            </span>
                          </td>

                          {/* Última actualización */}
                          <td className="py-2.5 px-3 text-center text-slate-400 text-[11px] font-bold">
                            {formatRelativeTime(task.lastUpdated)}
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-3 text-center" onClick={e => e.stopPropagation()}>
                            {canEditStructure && (
                              <button 
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`¿Eliminar tarea "${task.title}"?`)) {
                                    await deleteTask(task.id);
                                    toast.success('Tarea eliminada');
                                  }
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-500 rounded transition-opacity"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Quick Add Row */}
                    {canEditStructure && (
                      <tr className={isDarkMode ? 'bg-white/2' : 'bg-slate-50/50'}>
                        <td className="py-2.5 px-3 text-center">
                          <Plus size={14} className="text-slate-400 mx-auto" />
                        </td>
                        <td colSpan={9} className="py-2 px-4">
                          <form 
                            onSubmit={(e) => {
                              e.preventDefault();
                              handleQuickAddTask(group.id, group.name);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input 
                              type="text" 
                              placeholder="+ Agregar tarea..."
                              value={newTaskTitle[group.id] || ''}
                              onChange={(e) => setNewTaskTitle({ ...newTaskTitle, [group.id]: e.target.value })}
                              className={`w-full bg-transparent border-none outline-none text-xs font-bold ${
                                isDarkMode ? 'text-white placeholder:text-gray-600' : 'text-slate-800 placeholder:text-slate-400'
                              }`}
                            />
                            {newTaskTitle[group.id] && (
                              <button 
                                type="submit" 
                                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                              >
                                Agregar
                              </button>
                            )}
                          </form>
                        </td>
                      </tr>
                    )}
                  </tbody>

                  {/* Summary Footer Row */}
                  <tfoot>
                    <tr className={`border-t font-bold ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                      <td colSpan={2} className="py-2.5 px-4 text-slate-400 text-[10px] uppercase tracking-wider">
                        Resumen {groupTasks.length} tareas
                      </td>
                      <td colSpan={2} className="py-2.5 px-3">
                        {/* Mini progress bar */}
                        {groupTasks.length > 0 && (
                          <div className="h-2 w-full rounded-full overflow-hidden flex bg-slate-200 dark:bg-white/10">
                            <div style={{ width: `${(doneCount / groupTasks.length) * 100}%` }} className="bg-emerald-500 h-full" title={`Listo: ${doneCount}`} />
                            <div style={{ width: `${(inProgressCount / groupTasks.length) * 100}%` }} className="bg-amber-500 h-full" title={`En curso: ${inProgressCount}`} />
                            <div style={{ width: `${(stuckCount / groupTasks.length) * 100}%` }} className="bg-rose-500 h-full" title={`Detenido: ${stuckCount}`} />
                            <div style={{ width: `${(notStartedCount / groupTasks.length) * 100}%` }} className="bg-slate-400 h-full" title={`No iniciado: ${notStartedCount}`} />
                          </div>
                        )}
                      </td>
                      <td colSpan={2}></td>
                      <td className="py-2.5 px-3 text-center text-[11px] text-slate-500 font-bold">
                        {totalFiles} archivos
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Add New Group */}
      {canEditStructure && onAddGroup && (
        <div className="pt-2">
          {showAddGroupInput ? (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (newGroupName.trim()) {
                  onAddGroup(newGroupName.trim());
                  setNewGroupName('');
                  setShowAddGroupInput(false);
                }
              }}
              className="flex items-center gap-2 max-w-sm"
            >
              <input 
                type="text" 
                placeholder="Nombre del nuevo grupo..." 
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                autoFocus
                className={`p-2.5 rounded-xl border text-xs font-bold outline-none flex-1 ${
                  isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
              <button 
                type="submit" 
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow"
              >
                Crear
              </button>
              <button 
                type="button" 
                onClick={() => setShowAddGroupInput(false)}
                className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-slate-600"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddGroupInput(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed text-xs font-black uppercase tracking-wider transition-colors ${
                isDarkMode ? 'border-white/20 text-gray-400 hover:bg-white/5 hover:text-white' : 'border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Plus size={16} /> Agregar grupo nuevo
            </button>
          )}
        </div>
      )}
    </div>
  );
};
