import React from 'react';
import { Task } from '../../types/criticalPath';
import { Clock, Activity, AlertTriangle, Users, Flag, Zap } from 'lucide-react';

interface CPMMetricsProps {
  tasks: Task[];
  projectDuration: number;
  isDarkMode?: boolean;
}

export const CPMMetrics: React.FC<CPMMetricsProps> = ({ 
  tasks, 
  projectDuration,
  isDarkMode
}) => {
  const criticalTasks = tasks.filter(t => t.isCritical);
  const totalEffort = tasks.reduce((s, a) => s + (a.effort || 0), 0);
  const criticalEffort = criticalTasks.reduce((s, a) => s + (a.effort || 0), 0);
  const maxSlack = Math.max(...tasks.map(t => t.slack || 0), 0);
  
  const metrics = [
    { label: 'Duración', value: projectDuration, unit: 'días', icon: Clock, color: 'text-indigo-600', bg: isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50' },
    { label: 'Esfuerzo Total', value: totalEffort, unit: 'p·s', icon: Activity, color: 'text-orange-600', bg: isDarkMode ? 'bg-orange-500/10' : 'bg-orange-50' },
    { label: 'Esfuerzo Crítico', value: criticalEffort, unit: 'p·s', icon: Zap, color: 'text-red-600', bg: isDarkMode ? 'bg-red-500/10' : 'bg-red-50' },
    { label: 'Tareas Críticas', value: criticalTasks.length, unit: 'acts', icon: AlertTriangle, color: 'text-red-600', bg: isDarkMode ? 'bg-red-500/10' : 'bg-red-50' },
    { label: 'Holgura Máx.', value: maxSlack, unit: 'días', icon: Flag, color: 'text-amber-600', bg: isDarkMode ? 'bg-amber-500/10' : 'bg-amber-50' },
    { label: 'Total Actividades', value: tasks.length, unit: 'acts', icon: Users, color: isDarkMode ? 'text-gray-400' : 'text-slate-600', bg: isDarkMode ? 'bg-white/5' : 'bg-slate-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {metrics.map((m, i) => (
        <div key={`metric-${m.label}-${i}`} className={`p-4 rounded-3xl border shadow-sm flex flex-col gap-2 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-xl ${m.bg} ${m.color}`}>
              <m.icon size={16} />
            </div>
            <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{m.label}</span>
          </div>
          <p className={`text-2xl font-black ${m.color}`}>
            {m.value} <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>{m.unit}</span>
          </p>
        </div>
      ))}
    </div>
  );
};
