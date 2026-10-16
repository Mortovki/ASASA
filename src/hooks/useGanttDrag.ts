import { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../types/task';

export type DragMode = 'move' | 'resize-left' | 'resize-right';
export type GanttItemType = 'task' | 'stage';

export interface DragState {
  id: string;
  type: GanttItemType;
  mode: DragMode;
  startX: number;
  origStart: Date;
  origEnd: Date;
  dayWidth: number;
  hasMoved: boolean;
}

export interface PreviewDates {
  startDate: Date;
  endDate: Date;
  type: GanttItemType;
}

export function useGanttDrag(
  tasks: Task[],
  dayWidth: number,
  onSaveTask: (taskId: string, newStart: Date, newEnd: Date) => Promise<void>,
  onSaveStage?: (stageId: string, newStart: Date, newEnd: Date) => Promise<void>
) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<Record<string, PreviewDates>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const hasMovedRef = useRef<boolean>(false);

  const startDrag = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    id: string,
    mode: DragMode,
    itemType: GanttItemType = 'task',
    customOrigStart?: string | Date,
    customOrigEnd?: string | Date
  ) => {
    if (!('touches' in e)) {
      e.preventDefault();
    }
    e.stopPropagation();

    let origStart: Date;
    let origEnd: Date;

    if (customOrigStart && customOrigEnd) {
      origStart = typeof customOrigStart === 'string'
        ? new Date(`${customOrigStart.split('T')[0]}T00:00:00`)
        : new Date(customOrigStart);
      origEnd = typeof customOrigEnd === 'string'
        ? new Date(`${customOrigEnd.split('T')[0]}T00:00:00`)
        : new Date(customOrigEnd);
    } else {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      origStart = new Date(task.startDate || Date.now());
      origEnd = new Date(task.endDate || Date.now());
    }

    const clientX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    hasMovedRef.current = false;

    setDragging({
      id,
      type: itemType,
      mode,
      startX: clientX,
      origStart,
      origEnd,
      dayWidth,
      hasMoved: false
    });

    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      mode === 'move' ? 'grabbing' : 'ew-resize';
  }, [tasks, dayWidth]);

  useEffect(() => {
    if (!dragging) return;

    function addDays(date: Date, days: number): Date {
      const d = new Date(date);
      d.setDate(d.getDate() + days);
      return d;
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].pageX : e.pageX;
      const deltaX = clientX - dragging.startX;
      
      if (Math.abs(deltaX) > 3) {
        hasMovedRef.current = true;
      }

      const deltaDays = Math.round(deltaX / dragging.dayWidth);

      if (deltaDays === 0) {
        setPreview(prev => {
          if (!prev[dragging.id]) return prev;
          const { [dragging.id]: _, ...rest } = prev;
          return rest;
        });
        return;
      }

      let newStart = new Date(dragging.origStart);
      let newEnd = new Date(dragging.origEnd);

      if (dragging.mode === 'move') {
        newStart = addDays(dragging.origStart, deltaDays);
        newEnd = addDays(dragging.origEnd, deltaDays);
      } else if (dragging.mode === 'resize-left') {
        newStart = addDays(dragging.origStart, deltaDays);
        const minEnd = addDays(newStart, 1);
        if (newEnd < minEnd) newEnd = minEnd;
      } else if (dragging.mode === 'resize-right') {
        newEnd = addDays(dragging.origEnd, deltaDays);
        const minEnd = addDays(dragging.origStart, 1);
        if (newEnd < minEnd) newEnd = minEnd;
      }

      setPreview(prev => ({
        ...prev,
        [dragging.id]: { startDate: newStart, endDate: newEnd, type: dragging.type }
      }));
    };

    const onUp = async () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const pv = preview[dragging.id];
      const didMove = hasMovedRef.current;

      if (pv && didMove) {
        const changed =
          pv.startDate.getTime() !== dragging.origStart.getTime() ||
          pv.endDate.getTime() !== dragging.origEnd.getTime();

        if (changed) {
          if (dragging.type === 'stage' && onSaveStage) {
            await onSaveStage(dragging.id, pv.startDate, pv.endDate);
          } else if (dragging.type === 'task') {
            await onSaveTask(dragging.id, pv.startDate, pv.endDate);
          }
          if ('vibrate' in navigator) {
            try {
              navigator.vibrate(30);
            } catch (_) {}
          }
        }
      }

      setDragging(null);
      setPreview({});
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [dragging, preview, onSaveTask, onSaveStage]);

  return {
    containerRef,
    dragging,
    preview,
    startDrag,
    hasMovedRef
  };
}
