import { useState, useEffect, useRef, useCallback } from 'react';
import { Task } from '../types/task';

export type DragMode = 'move' | 'resize-left' | 'resize-right';

interface DragState {
  taskId: string;
  mode: DragMode;
  startX: number;
  origStart: Date;
  origEnd: Date;
  dayWidth: number;
}

export function useGanttDrag(
  tasks: Task[],
  dayWidth: number,
  onSave: (taskId: string, newStart: Date, newEnd: Date) => Promise<void>
) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<Record<string, {
    startDate: Date;
    endDate: Date;
  }>>({});
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback((
    e: React.MouseEvent | React.TouchEvent,
    taskId: string,
    mode: DragMode
  ) => {
    // Only prevent default if it's not a move mode or if we want to handle it specifically
    // For 'move' on touch, we might use a long press, but for mouse it's immediate.
    if (!('touches' in e)) {
      e.preventDefault();
    }
    e.stopPropagation();

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const clientX = 'touches' in e ? e.touches[0].pageX : e.pageX;

    setDragging({
      taskId,
      mode,
      startX: clientX,
      origStart: new Date(task.startDate || Date.now()),
      origEnd: new Date(task.endDate || Date.now()),
      dayWidth: dayWidth,
    });

    document.body.style.userSelect = 'none';
    document.body.style.cursor =
      mode === 'move' ? 'grabbing'
      : mode === 'resize-left' ? 'ew-resize'
      : 'ew-resize';
  }, [tasks, dayWidth]);

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].pageX : e.pageX;
      const deltaX = clientX - dragging.startX;
      const deltaDays = Math.round(deltaX / dragging.dayWidth);

      if (deltaDays === 0) {
        // Even if deltaDays is 0, we might want to clear preview if it was set before
        // but usually we just keep the last valid one or the original.
        // If we don't update preview, the bar stays at original position.
        setPreview(prev => {
          const { [dragging.taskId]: _, ...rest } = prev;
          return rest;
        });
        return;
      }

      let newStart = new Date(dragging.origStart);
      let newEnd = new Date(dragging.origEnd);

      if (dragging.mode === 'move') {
        newStart = addDays(dragging.origStart, deltaDays);
        newEnd = addDays(dragging.origEnd, deltaDays);
      }
      else if (dragging.mode === 'resize-left') {
        newStart = addDays(dragging.origStart, deltaDays);
        const minEnd = addDays(newStart, 1);
        if (newEnd < minEnd) newEnd = minEnd;
      }
      else if (dragging.mode === 'resize-right') {
        newEnd = addDays(dragging.origEnd, deltaDays);
        const minEnd = addDays(dragging.origStart, 1);
        if (newEnd < minEnd) newEnd = minEnd;
      }

      setPreview(prev => ({
        ...prev,
        [dragging.taskId]: { startDate: newStart, endDate: newEnd }
      }));
    };

    const onUp = async () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';

      const pv = preview[dragging.taskId];
      if (pv) {
        // Only save if it actually changed
        if (pv.startDate.getTime() !== dragging.origStart.getTime() || 
            pv.endDate.getTime() !== dragging.origEnd.getTime()) {
          await onSave(dragging.taskId, pv.startDate, pv.endDate);
          if ('vibrate' in navigator) {
            navigator.vibrate(30);
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
  }, [dragging, preview, onSave]);

  function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  return {
    containerRef,
    dragging,
    preview,
    startDrag,
  };
}
