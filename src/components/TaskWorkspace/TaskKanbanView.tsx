import React from 'react';
import { 
  Calendar, 
  MessageSquare, 
  Paperclip, 
  AlertCircle, 
  User, 
  Plus,
  ArrowRight
} from 'lucide-react';
import { ProjectTask, TaskPriority, TaskStatus } from '../../types/tasks';
import { updateTask } from '../../services/taskService';
import toast from 'react-hot-toast';

interface TaskKanbanViewProps {
  tasks: ProjectTask[];
  students: any[];
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
}

export const TaskKanbanView: React.FC<TaskKanbanViewProps> = ({
  tasks,
  students,
  canEditStatus,
  canEditStructure,
  isDarkMode,
  onSelectTask,
  onQuickAddTask
}) => {
  const columns: ColumnConfig[] = [
    { 
      id: 'listo', 
      title: 'Listo', 
      headerBg: 'bg-emerald-500 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-t-4 border-t-emerald-500'
    },
    { 
      id: 'en_curso', 
      title: 'En curso', 
      headerBg: 'bg-amber-500 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-t-4 border-t-amber-500'
    },
    { 
      id: 'detenido', 
      title: 'Detenido', 
      headerBg: 'bg-rose-500 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-t-4 border-t-rose-500'
    },
    { 
      id: 'no_iniciado', 
      title: 'No iniciado', 
      headerBg: 'bg-slate-500 text-white', 
      countBg: 'bg-white/20 text-white',
      borderColor: 'border-t-4 border-t-slate-500'
    }
  ];

  const formatShortDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(`${dateStr}T12:00:00Z`);
      return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'alta':
        return 'text-purple-600 bg-purple-500/10 border border-purple-500/20';
      case 'media':
        return 'text-indigo-600 bg-indigo-500/10 border border-indigo-500/20';
      case 'baja':
        return 'text-blue-500 bg-blue-500/10 border border-blue-500/20';
      default:
        return 'text-slate-500 bg-slate-100';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (!taskId) return;

    try {
      await updateTask(taskId, { status: targetStatus });
      toast.success('Estado actualizado');
    } catch (err) {
      toast.error('Error al mover tarea');
    }
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-start select-none">
      {columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.id);

        return (
          <div 
            key={col.id} 
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, col.id)}
            className={`rounded-2xl border flex flex-col min-h-[500px] overflow-hidden ${
              isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-slate-50/60 border-slate-200'
            }`}
          >
            {/* Column Header */}
            <div className={`p-3.5 flex items-center justify-between font-black text-xs uppercase tracking-wider ${col.headerBg}`}>
              <div className="flex items-center gap-2">
                <span>{col.title}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${col.countBg}`}>
                  {colTasks.length}
                </span>
              </div>
              {canEditStructure && onQuickAddTask && (
                <button 
                  type="button" 
                  onClick={() => onQuickAddTask(col.id)}
                  title="Nueva tarea en esta columna"
                  className="p-1 hover:bg-black/10 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* Column Cards */}
            <div className="p-3 space-y-3 flex-1 overflow-y-auto">
              {colTasks.map(task => {
                const assignees = (task.assigneeIds || []).map(id => students.find(s => s.id === id || s.uid === id)).filter(Boolean);
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'listo';

                return (
                  <div
                    key={task.id}
                    draggable={canEditStatus}
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', task.id)}
                    onClick={() => onSelectTask(task)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all hover:shadow-md hover:scale-[1.01] space-y-3 ${
                      isDarkMode 
                        ? 'bg-[#222228] border-white/5 hover:border-indigo-500/40 text-white' 
                        : 'bg-white border-slate-200 hover:border-indigo-300 text-slate-900 shadow-sm'
                    }`}
                  >
                    {/* Card Title & Project Tag */}
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-indigo-500 block truncate">
                        {task.projectName}
                      </span>
                      <h4 className="text-xs font-black uppercase mt-1 leading-snug line-clamp-2">
                        {task.title}
                      </h4>
                    </div>

                    {/* Meta row: Date and Priority */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-white/5">
                      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-gray-400">
                        <Calendar size={12} className={isOverdue ? 'text-rose-500' : ''} />
                        <span className={isOverdue ? 'text-rose-500 font-black' : ''}>
                          {formatShortDate(task.dueDate)}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
                        {task.priority}
                      </span>
                    </div>

                    {/* Card Footer: Assignees & Icons */}
                    <div className="flex items-center justify-between pt-1">
                      {/* Assignees */}
                      <div className="flex items-center -space-x-1.5">
                        {assignees.length > 0 ? (
                          assignees.slice(0, 3).map((st: any, i: number) => (
                            <div 
                              key={i} 
                              title={st.name || st.firstName}
                              className="w-6 h-6 rounded-full bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center border-2 border-white dark:border-[#222228] shadow-sm"
                            >
                              {(st.firstName || st.name || 'P')[0]}
                            </div>
                          ))
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-400">
                            <User size={10} />
                          </div>
                        )}
                        {assignees.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-zinc-800 text-slate-600 dark:text-gray-300 font-bold text-[8px] flex items-center justify-center border-2 border-white dark:border-[#222228]">
                            +{assignees.length - 3}
                          </div>
                        )}
                      </div>

                      {/* Icons */}
                      <div className="flex items-center gap-3 text-slate-400 text-xs">
                        {task.attachments && task.attachments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Paperclip size={12} />
                            <span className="text-[10px] font-bold">{task.attachments.length}</span>
                          </div>
                        )}
                        {task.comments && task.comments.length > 0 && (
                          <div className="flex items-center gap-1 text-indigo-500">
                            <MessageSquare size={12} />
                            <span className="text-[10px] font-black">{task.comments.length}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {colTasks.length === 0 && (
                <div className={`py-12 text-center rounded-xl border border-dashed ${
                  isDarkMode ? 'border-white/5 text-gray-600' : 'border-slate-200 text-slate-400'
                }`}>
                  <p className="text-[11px] font-bold">Sin tareas en esta etapa</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
