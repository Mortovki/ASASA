import React from 'react';
import { Task } from '../../types/criticalPath';
import { StatusBadge } from '../ui/StatusBadge';

interface CPMGanttProps {
  tasks: Task[];
  projectDuration: number;
  showCriticalPath?: boolean;
  onSelectTask?: (id: string) => void;
  isDarkMode?: boolean;
}

export const CPMGantt: React.FC<CPMGanttProps> = ({ 
  tasks, 
  projectDuration, 
  showCriticalPath = true,
  onSelectTask,
  isDarkMode
}) => {
  const sortedTasks = [...tasks].sort((a, b) => (a.earlyStart || 0) - (b.earlyStart || 0));
  const W = 600; // Base width for the timeline

  return (
    <div className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col h-full ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
      <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
        <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Gantt CPM + Holguras</h3>
        <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
          Visualización de tiempos tempranos, tardíos y holguras.
        </p>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="min-w-[800px]">
          {/* Timeline Header */}
          <div className="flex items-center gap-4 mb-6">
            <div className="w-48 shrink-0"></div>
            <div className="relative flex-1 h-6">
              {Array.from({ length: Math.ceil(projectDuration / 5) + 1 }).map((_, i) => {
                const day = i * 5;
                if (day > projectDuration) return null;
                return (
                  <div 
                    key={day} 
                    className={`absolute top-0 text-[10px] font-black font-mono -translate-x-1/2 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}
                    style={{ left: `${(day / projectDuration) * 100}%` }}
                  >
                    D{day}
                  </div>
                );
              })}
            </div>
            <div className={`w-24 shrink-0 text-right text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>Esfuerzo</div>
          </div>

          {/* Rows */}
          <div className="space-y-3">
            {sortedTasks.map(task => {
              const isCrit = showCriticalPath && task.isCritical;
              const left = ((task.earlyStart || 0) / projectDuration) * 100;
              const width = ((task.duration || 1) / projectDuration) * 100;
              const slackWidth = ((task.slack || 0) / projectDuration) * 100;
              const color = task.color || '#6366f1';

              return (
                <div key={task.id} className="flex items-center gap-4 group">
                  <div className="w-48 shrink-0">
                    <p className={`text-sm font-bold truncate transition-colors cursor-pointer ${isDarkMode ? 'text-gray-300 group-hover:text-indigo-400' : 'text-slate-700 group-hover:text-indigo-600'}`} onClick={() => onSelectTask?.(task.id)}>
                      {task.title}
                    </p>
                  </div>
                  
                  <div className={`relative flex-1 h-8 rounded-lg overflow-hidden border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    {/* Slack Bar */}
                    {task.slack! > 0 && (
                      <div 
                        className="absolute top-0 h-full opacity-10"
                        style={{ 
                          left: `${left}%`, 
                          width: `${width + slackWidth}%`,
                          backgroundColor: color
                        }}
                      />
                    )}
                    
                    {/* Main Task Bar */}
                    <div 
                      className="absolute top-1.5 h-5 rounded-md shadow-sm cursor-pointer transition-all hover:brightness-110"
                      style={{ 
                        left: `${left}%`, 
                        width: `${width}%`,
                        backgroundColor: isCrit ? '#ef4444' : color
                      }}
                      onClick={() => onSelectTask?.(task.id)}
                    >
                      {width > 5 && (
                        <div className="h-full flex items-center justify-end px-2">
                          <span className="text-[8px] font-black text-white/80 font-mono">{task.effort}p</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="w-24 shrink-0 text-right">
                    <p className={`text-xs font-black font-mono ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{task.earlyStart}→{task.earlyFinish}</p>
                    <p className="text-[10px] font-bold text-orange-500 font-mono">{task.effort} p·s</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`p-4 border-t flex flex-wrap gap-4 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Ruta Crítica</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-500" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Ruta Normal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-500 opacity-20" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Holgura</span>
        </div>
      </div>
    </div>
  );
};
