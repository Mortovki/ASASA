import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Plus
} from 'lucide-react';
import { ProjectTask, TaskStatus } from '../../types/tasks';

interface TaskCalendarViewProps {
  tasks: ProjectTask[];
  isDarkMode: boolean;
  onSelectTask: (task: ProjectTask) => void;
  onQuickAddTaskOnDate?: (dateStr: string) => void;
}

export const TaskCalendarView: React.FC<TaskCalendarViewProps> = ({
  tasks,
  isDarkMode,
  onSelectTask,
  onQuickAddTaskOnDate
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = useMemo(() => {
    return currentDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  }, [currentDate]);

  // Generate 35-42 calendar days
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    // Sunday is 0, Monday is 1 in getDay()
    // Align to Monday start: (day + 6) % 7
    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDayIndex);

    const cells: { date: Date; dateStr: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 35; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dStr = d.toISOString().split('T')[0];

      cells.push({
        date: d,
        dateStr: dStr,
        isCurrentMonth: d.getMonth() === month,
        isToday: dStr === todayStr
      });
    }

    return cells;
  }, [year, month]);

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case 'listo': return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      case 'en_curso': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'detenido': return 'bg-rose-500 hover:bg-rose-600 text-white';
      default: return 'bg-slate-400 hover:bg-slate-500 text-white';
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const dayHeaders = ['lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.', 'dom.'];

  return (
    <div className={`rounded-2xl border overflow-hidden select-none ${
      isDarkMode ? 'bg-[#18181b] border-white/10' : 'bg-white border-slate-200 shadow-sm'
    }`}>
      {/* Calendar Header Controls */}
      <div className={`p-4 border-b flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
        isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-3">
          <CalendarIcon size={18} className="text-indigo-500" />
          <h3 className="text-base font-black uppercase tracking-wider capitalize">{monthName}</h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrevMonth}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
              isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={handleToday}
            className={`px-3 py-1.5 rounded-lg border text-xs font-black uppercase tracking-wider transition-colors ${
              isDarkMode ? 'border-white/10 text-gray-300 hover:bg-white/10' : 'border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            Hoy
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors ${
              isDarkMode ? 'border-white/10 hover:bg-white/10 text-white' : 'border-slate-300 hover:bg-slate-200 text-slate-700'
            }`}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className={`grid grid-cols-7 border-b text-center text-[11px] font-black uppercase tracking-wider py-2.5 ${
        isDarkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-slate-200 bg-slate-100 text-slate-600'
      }`}>
        {dayHeaders.map(day => (
          <div key={day}>{day}</div>
        ))}
      </div>

      {/* Calendar 35 days grid */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-white/5">
        {calendarCells.map((cell, idx) => {
          // Find tasks that fall on this day (either dueDate or date range)
          const cellTasks = tasks.filter(task => {
            const due = task.dueDate;
            const start = task.startDate;
            const end = task.endDate || task.dueDate;

            if (due === cell.dateStr) return true;
            if (start && end && cell.dateStr >= start && cell.dateStr <= end) return true;
            return false;
          });

          return (
            <div
              key={idx}
              className={`min-h-[110px] p-2 flex flex-col justify-between transition-colors group relative ${
                !cell.isCurrentMonth
                  ? (isDarkMode ? 'opacity-30 bg-black/10' : 'opacity-40 bg-slate-50/50')
                  : (isDarkMode ? 'hover:bg-white/2' : 'hover:bg-slate-50/50')
              }`}
            >
              {/* Day header */}
              <div className="flex items-center justify-between">
                <span className={`text-xs font-black inline-flex items-center justify-center w-6 h-6 rounded-full ${
                  cell.isToday
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : (isDarkMode ? 'text-gray-300' : 'text-slate-700')
                }`}>
                  {cell.date.getDate()}
                </span>
                {onQuickAddTaskOnDate && (
                  <button
                    type="button"
                    onClick={() => onQuickAddTaskOnDate(cell.dateStr)}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-indigo-600 rounded transition-opacity"
                    title="Nueva tarea en esta fecha"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>

              {/* Tasks Bars inside cell */}
              <div className="space-y-1 my-1 flex-1 overflow-y-auto max-h-20">
                {cellTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    onClick={() => onSelectTask(task)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold truncate cursor-pointer shadow-xs transition-transform hover:scale-[1.02] ${getStatusColor(task.status)}`}
                  >
                    {task.title}
                  </div>
                ))}
                {cellTasks.length > 3 && (
                  <span className="text-[9px] font-bold text-slate-400 block text-right">
                    +{cellTasks.length - 3} más
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend Footer */}
      <div className={`p-4 border-t flex items-center justify-center gap-6 text-xs font-bold ${
        isDarkMode ? 'border-white/10 bg-white/5 text-gray-400' : 'border-slate-200 bg-slate-50 text-slate-600'
      }`}>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>Detenido</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span>En curso</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>Listo</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-slate-400" />
          <span>No iniciado</span>
        </div>
      </div>
    </div>
  );
};
