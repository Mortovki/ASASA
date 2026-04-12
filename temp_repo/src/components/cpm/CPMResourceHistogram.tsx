import React from 'react';
import { Task } from '../../types/criticalPath';

interface CPMResourceHistogramProps {
  tasks: Task[];
  projectDuration: number;
  isDarkMode?: boolean;
}

export const CPMResourceHistogram: React.FC<CPMResourceHistogramProps> = ({ 
  tasks, 
  projectDuration,
  isDarkMode
}) => {
  const loadPerDay = React.useMemo(() => {
    const load = new Array(Math.ceil(projectDuration) + 1).fill(0);
    tasks.forEach(task => {
      const start = Math.floor(task.earlyStart || 0);
      const end = Math.ceil(task.earlyFinish || 0);
      const effortPerDay = (task.effort || 0) / (task.duration || 1);
      
      for (let d = start; d < end; d++) {
        if (d < load.length) {
          load[d] += effortPerDay;
        }
      }
    });
    return load;
  }, [tasks, projectDuration]);

  const maxLoad = Math.max(...loadPerDay, 1);
  const H = 160;

  return (
    <div className={`rounded-3xl border shadow-sm overflow-hidden flex flex-col h-full ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
      <div className={`p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
        <h3 className={`text-lg font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Histograma de Carga</h3>
        <p className={`text-xs font-medium mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
          Distribución del esfuerzo (persona-día) a lo largo del tiempo.
        </p>
      </div>

      <div className="flex-1 overflow-x-auto p-6">
        <div className="min-w-[600px] h-full flex flex-col">
          <div className="relative flex-1 flex items-end gap-1">
            {loadPerDay.map((load, day) => {
              const height = (load / maxLoad) * H;
              const isOverload = load > 5; // Arbitrary threshold for visual feedback
              
              return (
                <div 
                  key={day} 
                  className="flex-1 flex flex-col items-center group"
                >
                  <div className="relative w-full flex flex-col items-center">
                    {load > 0 && (
                      <div 
                        className={`w-full rounded-t-md transition-all duration-300 ${isOverload ? 'bg-red-400' : 'bg-indigo-400'} group-hover:brightness-110`}
                        style={{ height: `${height}px` }}
                      />
                    )}
                    <span className={`mt-2 text-[9px] font-black font-mono ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>D{day}</span>
                  </div>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-lg shadow-xl ${isDarkMode ? 'bg-slate-700 text-white' : 'bg-slate-800 text-white'}`}>
                      {load.toFixed(1)} p·d
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className={`p-4 border-t flex gap-4 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-indigo-400" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Carga Normal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-400" />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Carga Alta</span>
        </div>
      </div>
    </div>
  );
};
