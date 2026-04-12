import React from 'react';
import { motion } from 'motion/react';
import { 
  Star, 
  MessageSquare, 
  AlertTriangle, 
  Trash2, 
  CheckCircle2, 
  XCircle,
  MoveHorizontal,
  User
} from 'lucide-react';
import { KanbanColumnId, KANBAN_COLUMNS } from '../config/kanbanColumns';
import { formatName } from '../utils/formatters';
import PriorityDot from './PriorityDot';

interface KanbanCardProps {
  task: any;
  layout: 'desktop' | 'tablet' | 'mobile';
  userRole: string;
  permissions: any;
  draggedTask: string | null;
  initials: string;
  assignedStudent: any;
  onSelect: (taskId: string) => void;
  onDelete: (taskId: string) => void;
  onApprove: (task: any) => void;
  onReject: (task: any) => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onDragEnd: () => void;
  onMoveTask?: (taskId: string, newStatus: KanbanColumnId) => void;
  isDarkMode?: boolean;
}

const typeLabels: Record<string, string> = {
  feature: 'Función',
  bug: 'Error',
  quality: 'Calidad',
  security: 'Seguridad',
  operations: 'Operación'
};

const typeBadgeColors: Record<string, string> = {
  feature: 'bg-purple-100 text-purple-700',
  bug: 'bg-red-100 text-red-700',
  quality: 'bg-blue-100 text-blue-700',
  security: 'bg-slate-800 text-white',
  operations: 'bg-emerald-100 text-emerald-700'
};

const darkTypeBadgeColors: Record<string, string> = {
  feature: 'bg-purple-500/10 text-purple-400',
  bug: 'bg-red-500/10 text-red-400',
  quality: 'bg-blue-500/10 text-blue-400',
  security: 'bg-white/10 text-white',
  operations: 'bg-emerald-500/10 text-emerald-400'
};

const KanbanCard: React.FC<KanbanCardProps> = ({
  task,
  layout,
  userRole,
  permissions,
  draggedTask,
  initials,
  assignedStudent,
  onSelect,
  onDelete,
  onApprove,
  onReject,
  onDragStart,
  onDragEnd,
  onMoveTask,
  isDarkMode
}) => {
  const isPending = task.status === 'pending_approval';
  const isCompact = layout === 'mobile';
  const [showMoveMenu, setShowMoveMenu] = React.useState(false);

  const renderPriority = (priority: number) => {
    if (isCompact) return <PriorityDot priority={priority} />;
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star 
            key={i} 
            size={12} 
            className={i < (priority || 3) ? 'text-yellow-400 fill-yellow-400' : (isDarkMode ? 'text-gray-700' : 'text-slate-200')} 
          />
        ))}
      </div>
    );
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isPending) return;
    onSelect(task.id);
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      draggable={!isPending && layout !== 'mobile'}
      onDragStart={(e: any) => onDragStart(e, task.id)}
      onDragEnd={onDragEnd}
      onClick={handleCardClick}
      className={`rounded-xl shadow-sm border cursor-pointer hover:shadow-md transition-all active:scale-[0.98] group relative select-none
        ${isCompact ? 'p-3' : 'p-4'}
        ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}
        ${task.isCritical 
          ? (isDarkMode ? 'border-red-500/30 hover:border-red-500/50' : 'border-red-300 hover:border-red-400') 
          : (isDarkMode ? 'border-white/5 hover:border-indigo-500/30' : 'border-slate-200 hover:border-indigo-300')
        }
        ${draggedTask === task.id ? 'opacity-40 scale-90 grayscale' : ''}
        ${isPending ? (isDarkMode ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/30') : ''}
      `}
    >
      {permissions.canDeleteTask && !isPending && !isCompact && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          className={`absolute -top-2 -right-2 p-1.5 rounded-full shadow-md border opacity-0 group-hover:opacity-100 transition-all z-10 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-gray-500 hover:text-red-400' : 'bg-white border-slate-100 text-slate-400 hover:text-red-600'}`}
        >
          <Trash2 size={14} />
        </button>
      )}

      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${isDarkMode ? (darkTypeBadgeColors[task.type] || 'bg-white/5 text-gray-400') : (typeBadgeColors[task.type] || 'bg-slate-100 text-slate-700')}`}>
            {typeLabels[task.type] || task.type}
          </span>
          {task.isCritical && (
            <span className={`flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${isDarkMode ? 'text-red-400 bg-red-400/10' : 'text-red-600 bg-red-50'}`} title="Ruta Crítica">
              <AlertTriangle size={10} /> CPM
            </span>
          )}
        </div>
        {renderPriority(task.priority)}
      </div>
      
      <h4 className={`font-bold leading-tight mb-3 transition-colors ${isCompact ? 'text-sm' : 'text-base'} ${isDarkMode ? 'text-white group-hover:text-indigo-400' : 'text-slate-800 group-hover:text-indigo-600'}`}>
        {task.title}
      </h4>
      
      {isPending && userRole === 'admin' ? (
        <div className="flex gap-2 mt-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onApprove(task); }}
            className="flex-1 bg-emerald-600 text-white py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 hover:bg-emerald-700 transition-colors"
          >
            <CheckCircle2 size={12} /> Aprobar
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onReject(task); }}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase flex items-center justify-center gap-1 transition-colors ${isDarkMode ? 'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20' : 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100'}`}
          >
            <XCircle size={12} /> Rechazar
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-end mt-auto">
          <div className="flex items-center gap-2">
            <div 
              className={`${isCompact ? 'w-5 h-5' : 'w-6 h-6'} rounded-full flex items-center justify-center text-[10px] font-black border shadow-sm ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300 border-white/10' : 'bg-indigo-100 text-indigo-700 border-white'}`} 
              title={assignedStudent ? formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno) : 'Sin asignar'}
            >
              {initials}
            </div>
            <div className={`flex items-center gap-1 text-xs font-semibold ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
              <MessageSquare size={12} />
              <span>{task.noteCount || 0}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {(layout === 'tablet' || isCompact) && !isPending && (
              <div className="relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCompact) {
                      onMoveTask?.(task.id, task.status);
                    } else {
                      setShowMoveMenu(!showMoveMenu);
                    }
                  }}
                  className={`p-1 transition-colors ${isDarkMode ? 'text-gray-600 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}
                >
                  <MoveHorizontal size={14} />
                </button>
                {showMoveMenu && !isCompact && (
                  <div className={`absolute bottom-full right-0 mb-2 w-40 rounded-xl shadow-xl border py-1 z-50 overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-100'}`}>
                    {KANBAN_COLUMNS.filter(c => c.id !== 'pending_approval' && c.id !== task.status).map(col => (
                      <button
                        key={col.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveTask?.(task.id, col.id);
                          setShowMoveMenu(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-[10px] font-bold transition-colors flex items-center gap-2 ${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-50'}`}
                      >
                        <div className={`w-2 h-2 rounded-full ${col.color}`} />
                        Mover a {col.shortLabel}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className={`text-[10px] font-black px-2 py-1 rounded-md ${isDarkMode ? 'text-gray-400 bg-white/5' : 'text-slate-400 bg-slate-100'}`}>
              SP: {task.estimatedSP || 0}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default KanbanCard;
