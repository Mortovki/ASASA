import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { DragMode } from '../../hooks/useGanttDrag';

interface StageGroupMeta {
  id: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  duration: number;
  description?: string | null;
  predecessors: string[];
  tasks: any[];
  taskCount: number;
  completedCount: number;
  progressPercent: number;
  isStage: boolean;
  isCritical: boolean;
}

interface GanttStageBarProps {
  stage: StageGroupMeta;
  left: number;
  width: number;
  dayWidth: number;
  minDate: Date;
  isDragging: boolean;
  dragMode?: DragMode;
  preview?: { startDate: Date; endDate: Date };
  onStartDrag: (
    e: React.MouseEvent | React.TouchEvent,
    stageId: string,
    mode: DragMode,
    origStart: string,
    origEnd: string
  ) => void;
  onClick: () => void;
  canEdit: boolean;
  isDarkMode?: boolean;
}

export const GanttStageBar: React.FC<GanttStageBarProps> = ({
  stage,
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

  const displayStart = preview?.startDate || new Date(`${stage.startDate.split('T')[0]}T00:00:00`);
  const displayEnd = preview?.endDate || new Date(`${stage.endDate.split('T')[0]}T00:00:00`);

  // Calculate dynamic left and width if preview is active
  let activeLeft = left;
  let activeWidth = Math.max(width, 36);

  if (preview && minDate) {
    const diffDays = Math.max(0, Math.ceil((displayStart.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)));
    const durationDays = Math.max(1, Math.ceil((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24)));
    activeLeft = diffDays * dayWidth;
    activeWidth = Math.max(durationDays * dayWidth, 36);
  }

  const durationDays = Math.max(1, Math.ceil((displayEnd.getTime() - displayStart.getTime()) / (1000 * 60 * 60 * 24)));

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!canEdit) return;
    isMouseDownRef.current = true;
    dragDistanceRef.current = 0;
    onStartDrag(e, stage.id, 'move', stage.startDate, stage.endDate);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Only open details if we didn't drag
    if (dragDistanceRef.current < 5) {
      onClick();
    }
  };

  return (
    <div
      className="gantt-interactive-bar absolute top-2 h-8 select-none z-10"
      style={{
        left: `${activeLeft}px`,
        width: `${activeWidth}px`,
      }}
    >
      {/* Main Interactive Bar */}
      <motion.div
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onTouchStart={(e) => canEdit && onStartDrag(e, stage.id, 'move', stage.startDate, stage.endDate)}
        className={`h-full rounded-xl shadow-md flex items-center px-3 relative overflow-hidden transition-all group ${
          canEdit ? 'cursor-grab active:cursor-grabbing hover:brightness-110' : 'cursor-pointer hover:brightness-105'
        } ${
          isDragging 
            ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black/50 scale-[1.02] shadow-xl z-30' 
            : 'hover:shadow-lg'
        }`}
        style={{
          backgroundColor: stage.color || '#3b82f6',
        }}
        title={`Etapa: ${stage.name} (${durationDays} días). ${canEdit ? 'Arrastra para mover o usa los extremos para cambiar duración.' : ''}`}
      >
        {/* Progress Fill Bar */}
        <div
          className="absolute top-0 bottom-0 left-0 bg-white/25 backdrop-blur-xs transition-all pointer-events-none"
          style={{ width: `${stage.progressPercent}%` }}
        />

        {/* Left Notch Bracket Accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-black/25 pointer-events-none" />
        {/* Right Notch Bracket Accent */}
        <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-black/25 pointer-events-none" />

        {/* Content Label */}
        <div className="relative z-10 flex items-center justify-between w-full text-white text-[11px] font-black uppercase tracking-wider drop-shadow-sm pointer-events-none truncate">
          <span className="truncate pr-1">
            {stage.name}
          </span>
          {activeWidth >= 70 && (
            <span className="shrink-0 text-[10px] font-black bg-black/30 px-1.5 py-0.5 rounded-md ml-1">
              {stage.progressPercent}%
            </span>
          )}
        </div>

        {/* Resize Handles (Left and Right) */}
        {canEdit && (
          <>
            {/* Left Resize Handle (Expand / Reduce Start Date) */}
            <div
              className="absolute left-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/30 z-20 flex items-center justify-center transition-colors group/left"
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartDrag(e, stage.id, 'resize-left', stage.startDate, stage.endDate);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onStartDrag(e, stage.id, 'resize-left', stage.startDate, stage.endDate);
              }}
              title="Arrastra para cambiar fecha de inicio"
            >
              <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover/left:bg-white group-hover/left:h-4 transition-all" />
            </div>

            {/* Right Resize Handle (Expand / Reduce End Date) */}
            <div
              className="absolute right-0 top-0 bottom-0 w-3 cursor-ew-resize hover:bg-black/30 z-20 flex items-center justify-center transition-colors group/right"
              onMouseDown={(e) => {
                e.stopPropagation();
                onStartDrag(e, stage.id, 'resize-right', stage.startDate, stage.endDate);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                onStartDrag(e, stage.id, 'resize-right', stage.startDate, stage.endDate);
              }}
              title="Arrastra para cambiar duración / fecha de fin"
            >
              <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover/right:bg-white group-hover/right:h-4 transition-all" />
            </div>
          </>
        )}
      </motion.div>

      {/* Floating Tooltip during dragging / resizing */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0, y: 5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className={`absolute -top-12 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl text-white text-[10px] font-black whitespace-nowrap z-50 shadow-2xl pointer-events-none flex flex-col items-center gap-0.5 border ${
              isDarkMode ? 'bg-[#181818] border-white/20' : 'bg-slate-900 border-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="uppercase tracking-wider text-amber-400">
                {dragMode === 'move' ? 'Moviendo etapa' : dragMode === 'resize-left' ? 'Ajustando inicio' : 'Ajustando fin'}
              </span>
            </div>
            <div className="flex items-center gap-2 font-bold text-[11px]">
              <span>{format(displayStart, 'dd MMM yyyy', { locale: es })} &rarr; {format(displayEnd, 'dd MMM yyyy', { locale: es })}</span>
              <span className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-300 font-black">
                {durationDays} {durationDays === 1 ? 'día' : 'días'}
              </span>
            </div>
            {/* Tooltip pointer arrow */}
            <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 ${
              isDarkMode ? 'bg-[#181818] border-r border-b border-white/20' : 'bg-slate-900 border-r border-b border-slate-700'
            }`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
