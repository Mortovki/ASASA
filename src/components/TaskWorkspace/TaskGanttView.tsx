import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Download, 
  ZoomIn, 
  ZoomOut,
  Maximize2
} from 'lucide-react';
import { ProjectTask, TaskStatus } from '../../types/tasks';

interface TaskGanttViewProps {
  tasks: ProjectTask[];
  isDarkMode: boolean;
  onSelectTask: (task: ProjectTask) => void;
}

export const TaskGanttView: React.FC<TaskGanttViewProps> = ({
  tasks,
  isDarkMode,
  onSelectTask
}) => {
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [viewMode, setViewMode] = useState<'days' | 'weeks'>('days');

  // Calculate 14 days window around reference date
  const { days, startOfWeek, endOfWeek, weekLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Anchor to Sunday
    const anchor = new Date(today);
    anchor.setDate(today.getDate() - today.getDay() + (currentWeekOffset * 7));

    const dayList: Date[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      dayList.push(d);
    }

    const start = dayList[0];
    const end = dayList[6];

    const weekLabelStr = `Semana ${Math.ceil(anchor.getDate() / 7) + 40} · ${start.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}`;

    return {
      days: dayList,
      startOfWeek: start,
      endOfWeek: end,
      weekLabel: weekLabelStr
    };
  }, [currentWeekOffset]);

  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'listo': return 'bg-emerald-500 hover:bg-emerald-600';
      case 'en_curso': return 'bg-amber-500 hover:bg-amber-600';
      case 'detenido': return 'bg-rose-500 hover:bg-rose-600';
      default: return 'bg-slate-400 hover:bg-slate-500';
    }
  };

  const getShortDayName = (date: Date) => {
    const days = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];
    return days[date.getDay()];
  };

  return (
    <div className={`rounded-2xl border overflow-hidden select-none ${
      isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Gantt Top Toolbar */}
      <div className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-black uppercase tracking-wider">Gantt</h3>
          <span className="text-xs text-slate-400 font-bold">{weekLabel}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentWeekOffset(prev => prev - 1)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
              isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setCurrentWeekOffset(0)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider transition-colors ${
              currentWeekOffset === 0
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : (isDarkMode ? 'border-white/10 text-gray-300 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-100')
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={() => setCurrentWeekOffset(prev => prev + 1)}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
              isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Gantt Matrix Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[950px]">
          {/* Header row with Days */}
          <div className={`grid grid-cols-12 border-b text-xs font-black uppercase ${
            isDarkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-slate-200 bg-slate-100 text-slate-600'
          }`}>
            <div className="col-span-4 p-3 border-r dark:border-white/10 border-slate-200">
              Tarea y Rango
            </div>
            <div className="col-span-8 grid grid-cols-7 text-center">
              {days.slice(0, 7).map((day, idx) => {
                const dayStr = day.toISOString().split('T')[0];
                const isToday = dayStr === todayStr;

                return (
                  <div 
                    key={idx}
                    className={`py-2 px-1 border-r last:border-none border-slate-200 dark:border-white/10 ${
                      isToday ? 'bg-indigo-600 text-white rounded-t-lg' : ''
                    }`}
                  >
                    <span className="block text-[10px] font-bold opacity-80">{getShortDayName(day)}</span>
                    <span className="text-xs font-black">{day.getDate()}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows for each Task */}
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {tasks.map(task => {
              const startDate = task.startDate ? new Date(`${task.startDate}T12:00:00Z`) : null;
              const endDate = (task.endDate || task.dueDate) ? new Date(`${task.endDate || task.dueDate}T12:00:00Z`) : null;

              // Calculate start and end indices within the 7 visible days
              const firstDayTime = days[0].getTime();
              const oneDayMs = 24 * 60 * 60 * 1000;

              let startOffset = 0;
              let spanDays = 1;
              let isVisibleInWeek = false;

              if (startDate && endDate) {
                const diffStart = Math.round((startDate.getTime() - firstDayTime) / oneDayMs);
                const diffEnd = Math.round((endDate.getTime() - firstDayTime) / oneDayMs);

                if (diffEnd >= 0 && diffStart < 7) {
                  isVisibleInWeek = true;
                  startOffset = Math.max(0, diffStart);
                  const endOffset = Math.min(6, diffEnd);
                  spanDays = Math.max(1, endOffset - startOffset + 1);
                }
              }

              return (
                <div 
                  key={task.id}
                  onClick={() => onSelectTask(task)}
                  className={`grid grid-cols-12 items-center text-xs hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer transition-colors ${
                    isDarkMode ? 'text-gray-200' : 'text-slate-800'
                  }`}
                >
                  {/* Task meta info on left */}
                  <div className="col-span-4 p-3 border-r dark:border-white/10 border-slate-200 truncate flex items-center justify-between gap-2">
                    <span className="font-bold truncate text-[13px]">{task.title}</span>
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">
                      {task.startDate ? new Date(`${task.startDate}T12:00:00Z`).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '-'} - {task.dueDate ? new Date(`${task.dueDate}T12:00:00Z`).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' }) : '-'}
                    </span>
                  </div>

                  {/* Timeline bar area */}
                  <div className="col-span-8 grid grid-cols-7 relative h-12 items-center px-1">
                    {/* Vertical grid lines */}
                    {Array.from({ length: 7 }).map((_, i) => (
                      <div key={i} className="h-full border-r border-dashed border-slate-200 dark:border-white/5 last:border-none" />
                    ))}

                    {/* Horizontal Gantt Bar */}
                    {isVisibleInWeek && (
                      <div 
                        style={{
                          left: `${(startOffset / 7) * 100}%`,
                          width: `${(spanDays / 7) * 100}%`
                        }}
                        className={`absolute top-2.5 h-7 rounded-xl text-white font-bold text-[11px] flex items-center px-2.5 shadow-sm transition-all overflow-hidden truncate ${getStatusColor(task.status)}`}
                      >
                        <span className="truncate">{task.title}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {tasks.length === 0 && (
              <div className="py-12 text-center text-slate-400 text-xs font-bold">
                No hay tareas con cronograma definido.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
