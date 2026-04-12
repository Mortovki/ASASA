import React from 'react';
import { Plus, MoreVertical, Inbox } from 'lucide-react';
import { KanbanColumnId } from '../config/kanbanColumns';
import { KanbanLayout } from '../hooks/useKanbanLayout';

interface KanbanColumnProps {
  column: any;
  tasks: any[];
  layout: KanbanLayout;
  onAddTask?: (id: KanbanColumnId) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, statusId: string) => void;
  permissions: any;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  layout,
  onAddTask,
  onDragOver,
  onDrop,
  permissions,
  children,
  isDarkMode
}) => {
  const [isOver, setIsOver] = React.useState(false);
  const [dragCounter, setDragCounter] = React.useState(0);
  const isCompact = layout === 'mobile';
  
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(prev => prev + 1);
    setIsOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (onDragOver) {
      onDragOver(e);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(prev => {
      const newCount = prev - 1;
      if (newCount <= 0) {
        setIsOver(false);
        return 0;
      }
      return newCount;
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragCounter(0);
    setIsOver(false);
    if (onDrop) {
      onDrop(e, column.id);
    }
  };

  const totalSP = tasks.reduce((acc, t) => {
    const val = parseFloat(t.estimatedSP);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
  const totalEffort = tasks.reduce((acc, t) => {
    const val = parseFloat(t.effort);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);
  const isApproval = column.id === 'pending_approval';

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col h-full rounded-2xl border-2 transition-all duration-300 overflow-hidden
        ${isOver ? 'border-indigo-400 bg-indigo-50/30 scale-[1.01] shadow-lg' : (isDarkMode ? `border-white/5 ${column.bg.replace('bg-', 'bg-opacity-10 bg-')}` : `border-slate-200 ${column.bg}`)}
      `}
    >
      {/* Header */}
      <div className={`sticky top-0 z-10 ${isCompact ? 'py-3' : 'py-4'} px-4 ${column.color} text-white font-black flex justify-between items-center shrink-0 shadow-sm`}>
        <div className="flex items-center gap-2">
          {column.icon && <column.icon size={isCompact ? 16 : 18} />}
          <span className={`${isCompact ? 'text-base' : 'text-lg'} truncate`}>{column.title}</span>
          <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] font-black">
            {tasks.length}
          </span>
        </div>
        
        <div className="flex items-center gap-1">
          {permissions.canCreateTask && !isApproval && (
            <button 
              onClick={() => onAddTask?.(column.id)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <Plus size={18} />
            </button>
          )}
          {!isCompact && (
            <button className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <MoreVertical size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 p-3 overflow-y-auto space-y-3 custom-scrollbar`}>
        {tasks.length > 0 ? (
          children
        ) : (
          <div className={`h-full flex flex-col items-center justify-center py-12 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
            <Inbox size={48} className="mb-4 opacity-20" />
            <p className="text-xs font-bold text-center px-6">{column.emptyMessage}</p>
            {permissions.canCreateTask && !isApproval && (
              <button 
                onClick={() => onAddTask?.(column.id)}
                className={`mt-4 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-colors ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-700'}`}
              >
                <Plus size={14} /> Nueva tarea
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`p-3 border-t flex justify-between items-center shrink-0 ${layout !== 'mobile' ? 'sticky bottom-0 z-10' : ''} ${isDarkMode ? 'bg-black/20 backdrop-blur-sm border-white/5' : 'bg-white/80 backdrop-blur-sm border-slate-100'}`}>
        <div className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
          Total
        </div>
        <div className="flex gap-3">
          <div className={`text-[10px] font-black px-2 py-1 rounded-md border ${isDarkMode ? 'text-gray-400 bg-white/5 border-white/5' : 'text-slate-500 bg-white border-slate-100'}`}>
            {totalSP} SP
          </div>
          <div className={`text-[10px] font-black px-2 py-1 rounded-md border ${isDarkMode ? 'text-gray-400 bg-white/5 border-white/5' : 'text-slate-500 bg-white border-slate-100'}`}>
            {totalEffort}h
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanColumn;
