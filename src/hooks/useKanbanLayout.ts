import { useState, useEffect } from 'react';
import { KANBAN_COLUMNS, KanbanColumnId } from '../config/kanbanColumns';

export type KanbanLayout = 'desktop' | 'tablet' | 'mobile';

interface KanbanLayoutState {
  layout: KanbanLayout;
  activeColumnId: KanbanColumnId | null;
  setActiveColumn: (id: KanbanColumnId) => void;
  columnCount: number;
}

export function useKanbanLayout(): KanbanLayoutState {
  const getLayout = (w: number): KanbanLayout =>
    w >= 1280 ? 'desktop' : w >= 768 ? 'tablet' : 'mobile';

  const [layout, setLayout] = useState<KanbanLayout>(
    () => getLayout(window.innerWidth)
  );
  const [activeColumnId, setActiveColumnId] =
    useState<KanbanColumnId | null>(null);

  useEffect(() => {
    const obs = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      setLayout(getLayout(w));
    });
    obs.observe(document.documentElement);
    return () => obs.disconnect();
  }, []);

  // Al entrar a móvil, seleccionar la primera columna con tareas
  useEffect(() => {
    if (layout === 'mobile' && !activeColumnId) {
      setActiveColumnId(KANBAN_COLUMNS[0].id);
    }
  }, [layout, activeColumnId]);

  return {
    layout,
    activeColumnId,
    setActiveColumn: setActiveColumnId,
    columnCount: layout === 'desktop' ? 6 : layout === 'tablet' ? 2 : 1,
  };
}
