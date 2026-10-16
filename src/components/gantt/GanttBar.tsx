import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Task } from '../../types/task';
import { DragMode } from '../../hooks/useGanttDrag';
import { KANBAN_COLUMNS } from '../../config/kanbanColumns';

interface GanttBarProps {
  task: Task;
  left: number;
  width: number;
  dayWidth: number;
  minDate?: Date;
  isDragging: boolean;
  dragMode?: DragMode;
  preview?: { startDate: Date; endDate: Date };
  onStartDrag: (e: React.MouseEvent | React.TouchEvent, taskId: string, mode: DragMode) => void;
  onClick: () => void;
  canEdit: boolean;
  isDarkMode?: boolean;
}

export const GanttBar: React.FC<GanttBarProps> = ({
  task,
  left,
  width,
  dayWidth,
  minDate,
  isDragging,
  dragMode,
  preview,
  onStartDrag,
  onClick,
  canEdit,
  isDarkMode = false
}) => {
  const isMouseDownRef = useRef(false);
  const dragDistanceRef = useRef(0);

  const statusConfig = KANBAN_COLUMNS.find(c => c.id === task.status);
  const baseColor = statusConfig?.color.replace('bg-', '') || 'slate-500';
  
  // Custom color support
  const taskColor = task.color || null;
  
  const isCritical = task.isCritical;
  const isMilestone = task.isMilestone;

  const displayStart = preview?.startDate || new Date(task.startDate || Date.now());
  const displayEnd = preview?.endDate || new Date(task.endDate || Date.now());

  // Dynamic coordinates while dragging/resizing
  let activeLeft = left;
  let activeWidth = Math.max(width, dayWidth * 0.5);

  if (preview && minDate) {
    const diffDays = Math.max(0, (displayStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    const durationDays = Math.max(0.5, (displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24));
    activeLeft = diffDays * dayWidth;
    activeWidth = durationDays * dayWidth;
  }

  const durationDays = Math.max(1, Math.round((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24)));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canEdit) return;
    isMouseDownRef.current = true;
    dragDistanceRef.current = 0;
    onStartDrag(e, task.id, 'move');
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (dragDistanceRef.current < 5) {
      onClick();
    }
  };

  if (isMilestone) {
    return (
      <div 
        className="gantt-interactive-bar relative group h-8 flex items-center justify-center select-none"
        style={{ 
          position: 'absolute',
          left: `${activeLeft}px`,
          width: `${dayWidth}px`,
          top: '8px'
        }}
      >
        <motion.div
          layoutId={`task-milestone-${task.id}`}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onTouchStart={(e) => canEdit && onStartDrag(e, task.id, 'move')}
          className={`
            w-6 h-6 rotate-45 cursor-pointer z-10 shadow-sm
            ${isDragging ? 'shadow-lg ring-2 ring-indigo-400 scale-110' : 'hover:scale-110'}
            ${isCritical ? 'ring-2 ring-red-500 ring-offset-2' : ''}
          `}
          style={{ 
            backgroundColor: taskColor || (baseColor.includes('-') ? `var(--color-${baseColor})` : baseColor),
          }}
        />
        {/* Milestone Label */}
        <span className="absolute left-full ml-2 text-[10px] font-black whitespace-nowrap bg-white/90 dark:bg-black/60 px-1.5 py-0.5 rounded-md backdrop-blur-xs pointer-events-none group-hover:z-50 shadow-xs">
          {task.title}
        </span>
      </div>
    );
  }

  return (
    <div 
      className="gantt-interactive-bar relative group h-8 select-none"
      style={{ 
        position: 'absolute',
        left: `${activeLeft}px`,
        width: `${activeWidth}px`,
        top: '8px'
      }}
    >
      {/* Barra Principal */}
      <motion.div
        layoutId={`task-bar-${task.id}`}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => canEdit && onStartDrag(e, task.id, 'move')}
        className={`
          h-full rounded-md shadow-sm cursor-grab active:cursor-grabbing relative overflow-hidden
          flex items-center px-2.5 transition-shadow select-none group/bar
          ${isDragging ? 'shadow-xl ring-2 ring-offset-1 ring-blue-500 z-50 scale-[1.01]' : 'hover:shadow-md'}
          ${isCritical ? 'ring-1 ring-red-400' : ''}
        `}
        style={{ 
          backgroundColor: taskColor || (baseColor.includes('-') ? `var(--color-${baseColor})` : baseColor),
          opacity: isDragging ? 0.95 : 1,
        }}
        title={`Tarea: ${task.title} (${durationDays} ${durationDays === 1 ? 'día' : 'días'}). ${canEdit ? 'Arrastra para mover o usa los extremos para alargar/acortar.' : ''}`}
      >
        {/* Indicador de Progreso si está completada */}
        {task.status === 'done' && (
          <div className="absolute inset-0 bg-black/10 pointer-events-none" />
        )}

        {/* Título de la Tarea */}
        <span className={`
          text-[11px] font-bold truncate select-none pointer-events-none z-10 pr-2
          ${['pending_approval'].includes(task.status) ? 'text-slate-900' : 'text-white'}
        `}>
          {task.title}
        </span>

        {/* Handles de Redimensionamiento interactivos para Alargar / Acortar */}
        {canEdit && (
          <>
            {/* Handle Izquierdo (Alargar fecha de inicio) */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/25 z-20 flex items-center justify-center transition-colors group/left"
              onMouseDown={(e) => { 
                e.stopPropagation(); 
                onStartDrag(e, task.id, 'resize-left'); 
              }}
              onTouchStart={(e) => { 
                e.stopPropagation(); 
                onStartDrag(e, task.id, 'resize-left'); 
              }}
              title="Arrastra para alargar o recortar fecha de inicio"
            >
              <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover/left:bg-white group-hover/left:h-4 transition-all" />
            </div>

            {/* Handle Derecho (Alargar fecha de fin / duración) */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/25 z-20 flex items-center justify-center transition-colors group/right"
              onMouseDown={(e) => { 
                e.stopPropagation(); 
                onStartDrag(e, task.id, 'resize-right'); 
              }}
              onTouchStart={(e) => { 
                e.stopPropagation(); 
                onStartDrag(e, task.id, 'resize-right'); 
              }}
              title="Arrastra para alargar o recortar fecha de fin"
            >
              <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover/right:bg-white group-hover/right:h-4 transition-all" />
            </div>
          </>
        )}
      </motion.div>

      {/* Tooltip de Feedback Visual durante Drag / Resize */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className={`absolute -top-12 left-1/2 -translate-x-1/2 text-white text-[10px] px-2.5 py-1 rounded-xl whitespace-nowrap z-[100] shadow-2xl pointer-events-none flex flex-col items-center border ${
              isDarkMode ? 'bg-[#181818] border-white/20' : 'bg-slate-900 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 font-black text-blue-400 uppercase text-[9px] tracking-wider">
              <span>{dragMode === 'move' ? 'Moviendo tarea' : dragMode === 'resize-left' ? 'Alargando inicio' : 'Alargando fin'}</span>
            </div>
            <div className="font-bold flex items-center gap-1.5 text-[11px]">
              <span>{format(displayStart, 'dd MMM', { locale: es })} - {format(displayEnd, 'dd MMM', { locale: es })}</span>
              <span className="bg-blue-500/20 text-blue-300 px-1 py-0.2 rounded font-black">
                {durationDays} {durationDays === 1 ? 'día' : 'días'}
              </span>
            </div>
            {/* Flechita del tooltip */}
            <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-[#181818] border-r border-b border-white/20' : 'bg-slate-900 border-r border-b border-slate-700'
            }`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
