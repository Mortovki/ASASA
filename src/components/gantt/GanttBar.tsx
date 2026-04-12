import React from 'react';
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
  isDragging: boolean;
  dragMode?: DragMode;
  preview?: { startDate: Date; endDate: Date };
  onStartDrag: (e: React.MouseEvent | React.TouchEvent, taskId: string, mode: DragMode) => void;
  onClick: () => void;
  canEdit: boolean;
}

export const GanttBar: React.FC<GanttBarProps> = ({
  task,
  left,
  width,
  dayWidth,
  isDragging,
  dragMode,
  preview,
  onStartDrag,
  onClick,
  canEdit
}) => {
  const statusConfig = KANBAN_COLUMNS.find(c => c.id === task.status);
  const baseColor = statusConfig?.color.replace('bg-', '') || 'slate-500';
  
  // Si es la ruta crítica, darle un borde o sombra especial
  const isCritical = task.isCritical;

  const displayStart = preview?.startDate || new Date(task.startDate || Date.now());
  const displayEnd = preview?.endDate || new Date(task.endDate || Date.now());

  return (
    <div 
      className="relative group h-8"
      style={{ 
        position: 'absolute',
        left: `${left}px`,
        width: `${width}px`,
        top: '8px'
      }}
    >
      {/* Barra Principal */}
      <motion.div
        layoutId={`task-bar-${task.id}`}
        onClick={onClick}
        onMouseDown={(e) => canEdit && onStartDrag(e, task.id, 'move')}
        onTouchStart={(e) => canEdit && onStartDrag(e, task.id, 'move')}
        className={`
          h-full rounded-md shadow-sm cursor-pointer relative overflow-hidden
          flex items-center px-3 transition-shadow
          ${isDragging ? 'shadow-lg ring-2 ring-offset-1 ring-blue-400 z-50' : 'hover:shadow-md'}
          ${isCritical ? 'ring-1 ring-red-400' : ''}
        `}
        style={{ 
          backgroundColor: `var(--color-${baseColor})`,
          opacity: isDragging ? 0.9 : 1,
        }}
      >
        {/* Indicador de Progreso (opcional, si tuviéramos % completado) */}
        {task.status === 'done' && (
          <div className="absolute inset-0 bg-black/5 pointer-events-none" />
        )}

        {/* Título de la Tarea */}
        <span className={`
          text-[11px] font-bold truncate select-none
          ${['pending_approval'].includes(task.status) ? 'text-slate-900' : 'text-white'}
        `}>
          {task.title}
        </span>

        {/* Handles de Redimensionamiento (solo si puede editar) */}
        {canEdit && (
          <>
            {/* Handle Izquierdo */}
            <div 
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 z-10"
              onMouseDown={(e) => { e.stopPropagation(); onStartDrag(e, task.id, 'resize-left'); }}
              onTouchStart={(e) => { e.stopPropagation(); onStartDrag(e, task.id, 'resize-left'); }}
            />
            {/* Handle Derecho */}
            <div 
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-black/10 z-10"
              onMouseDown={(e) => { e.stopPropagation(); onStartDrag(e, task.id, 'resize-right'); }}
              onTouchStart={(e) => { e.stopPropagation(); onStartDrag(e, task.id, 'resize-right'); }}
            />
          </>
        )}
      </motion.div>

      {/* Tooltip de Feedback Visual durante Drag */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap z-[100] shadow-xl pointer-events-none flex flex-col items-center"
          >
            <div className="font-bold">
              {format(displayStart, 'dd MMM', { locale: es })} - {format(displayEnd, 'dd MMM', { locale: es })}
            </div>
            <div className="opacity-70">
              {Math.round(width / dayWidth)} días
            </div>
            {/* Flechita del tooltip */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Líneas Guía Verticales (opcional, se pueden pintar en el padre) */}
    </div>
  );
};
