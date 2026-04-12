import { 
  Clock, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Plus, 
  Inbox,
  XCircle,
  ListTodo
} from 'lucide-react';

export type KanbanColumnId = 'pending_approval' | 'todo' | 'working_on_it' | 'waiting_review' | 'stuck' | 'done' | 'rejected';

export interface KanbanColumn {
  id: KanbanColumnId;
  title: string;
  shortLabel: string;
  color: string;
  bg: string;
  icon: any;
  emptyMessage: string;
  hideFromBoard?: boolean;
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'pending_approval',
    title: 'Por aprobar',
    shortLabel: 'Pend.',
    color: 'bg-amber-500',
    bg: 'bg-amber-50',
    icon: Clock,
    emptyMessage: 'No hay propuestas pendientes'
  },
  {
    id: 'todo',
    title: 'Por hacer',
    shortLabel: 'Hacer',
    color: 'bg-slate-500',
    bg: 'bg-slate-50',
    icon: ListTodo,
    emptyMessage: 'No hay tareas por hacer'
  },
  {
    id: 'working_on_it',
    title: 'En progreso',
    shortLabel: 'Prog.',
    color: 'bg-orange-500',
    bg: 'bg-orange-50',
    icon: Loader2,
    emptyMessage: 'No hay tareas en progreso'
  },
  {
    id: 'waiting_review',
    title: 'En revisión',
    shortLabel: 'Rev.',
    color: 'bg-blue-500',
    bg: 'bg-blue-50',
    icon: AlertCircle,
    emptyMessage: 'No hay tareas esperando revisión'
  },
  {
    id: 'stuck',
    title: 'Atascado',
    shortLabel: 'Atas.',
    color: 'bg-red-500',
    bg: 'bg-red-50',
    icon: AlertCircle,
    emptyMessage: '¡Genial! No hay tareas atascadas'
  },
  {
    id: 'done',
    title: 'Finalizado',
    shortLabel: 'Fin.',
    color: 'bg-green-500',
    bg: 'bg-green-50',
    icon: CheckCircle2,
    emptyMessage: 'Completa tareas para verlas aquí'
  },
  {
    id: 'rejected',
    title: 'Rechazada',
    shortLabel: 'Rech.',
    color: 'bg-rose-500',
    bg: 'bg-rose-50',
    icon: XCircle,
    emptyMessage: 'No hay tareas rechazadas',
    hideFromBoard: true
  }
];
