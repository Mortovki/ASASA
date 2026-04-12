import React, { useMemo, useState } from 'react';
import { computeCriticalPath } from '../utils/criticalPath';
import { Task } from '../types/criticalPath';
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  LayoutGrid, 
  GitBranch, 
  BarChart3, 
  Filter, 
  Zap, 
  ChevronRight, 
  X,
  Plus,
  Minus,
  RotateCcw
} from 'lucide-react';
import { CPMNetwork } from './cpm/CPMNetwork';
import { CPMGantt } from './cpm/CPMGantt';
import { CPMResourceHistogram } from './cpm/CPMResourceHistogram';
import { CPMMetrics } from './cpm/CPMMetrics';
import { motion, AnimatePresence } from 'motion/react';

interface CriticalPathAnalysisProps {
  tasks: Task[];
  isDarkMode?: boolean;
}

export const CriticalPathAnalysis: React.FC<CriticalPathAnalysisProps> = ({ tasks, isDarkMode }) => {
  const [activeView, setActiveView] = useState<'network' | 'gantt' | 'resources'>('network');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCriticalOnly, setShowCriticalOnly] = useState(false);
  const [activePhase, setActivePhase] = useState<string>('all');

  // Compute CPM
  const cpmTasks = useMemo(() => {
    try {
      // Ensure unique tasks by ID before computing CPM
      const uniqueTasks = Array.from(new Map(tasks.map(t => [t.id, t])).values());
      return computeCriticalPath(uniqueTasks);
    } catch (e) {
      console.error("Error computing CPM:", e);
      return tasks;
    }
  }, [tasks]);

  const projectDuration = Math.max(...cpmTasks.map(t => t.earlyFinish || 0), 0);
  const phases = Array.from(new Set(cpmTasks.map(t => t.phase).filter(Boolean)));

  const filteredTasks = cpmTasks.filter(t => {
    if (showCriticalOnly && !t.isCritical) return false;
    if (activePhase !== 'all' && t.phase !== activePhase) return false;
    return true;
  });

  const selectedTask = cpmTasks.find(t => t.id === selectedTaskId);

  const views = [
    { id: 'network', label: 'Red AON', icon: GitBranch },
    { id: 'gantt', label: 'Gantt', icon: LayoutGrid },
    { id: 'resources', label: 'Recursos', icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col h-full gap-6">
      {/* Header & View Toggle */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className={`text-2xl sm:text-3xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ruta Crítica (CPM)</h2>
          <p className={`font-medium mt-1 uppercase text-[10px] sm:text-xs tracking-[0.2em] ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
            Análisis de Tiempos y Esfuerzos
          </p>
        </div>

        <div className={`flex items-center gap-2 p-1 rounded-2xl border shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200/50'}`}>
          {views.map(v => (
            <button
              key={v.id}
              onClick={() => setActiveView(v.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeView === v.id 
                  ? (isDarkMode ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50') 
                  : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50')
              }`}
            >
              <v.icon size={14} />
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Metrics Strip */}
      <CPMMetrics tasks={cpmTasks} projectDuration={projectDuration} isDarkMode={isDarkMode} />

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[600px]">
        
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Filters */}
          <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
            <div>
              <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Filtrar Fase</h3>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setActivePhase('all')}
                  className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                    activePhase === 'all' 
                      ? 'bg-indigo-600 text-white border-indigo-600' 
                      : (isDarkMode ? 'bg-white/5 text-gray-400 border-white/10 hover:border-indigo-500/50' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200')
                  }`}
                >
                  Todas
                </button>
                {phases.map(p => (
                  <button 
                    key={p}
                    onClick={() => setActivePhase(p!)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                      activePhase === p 
                        ? 'bg-indigo-600 text-white border-indigo-600' 
                        : (isDarkMode ? 'bg-white/5 text-gray-400 border-white/10 hover:border-indigo-500/50' : 'bg-white text-slate-500 border-slate-200 hover:border-indigo-200')
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <h3 className={`text-[10px] font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Visibilidad</h3>
              <button 
                onClick={() => setShowCriticalOnly(!showCriticalOnly)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${
                  showCriticalOnly 
                    ? (isDarkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-700') 
                    : (isDarkMode ? 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10' : 'bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100')
                }`}
              >
                <div className="flex items-center gap-2">
                  <Zap size={16} className={showCriticalOnly ? 'text-red-500' : (isDarkMode ? 'text-gray-600' : 'text-slate-400')} />
                  <span className="text-xs font-bold">Solo Ruta Crítica</span>
                </div>
                <div className={`w-8 h-4 rounded-full relative transition-colors ${showCriticalOnly ? 'bg-red-500' : (isDarkMode ? 'bg-white/10' : 'bg-slate-300')}`}>
                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${showCriticalOnly ? 'left-4.5' : 'left-0.5'}`} />
                </div>
              </button>
            </div>
          </div>

          {/* Task List Mini */}
          <div className={`rounded-3xl border shadow-sm flex flex-col h-[400px] overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className={`p-4 border-b flex items-center justify-between ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Actividades ({filteredTasks.length})</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {filteredTasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className={`w-full text-left p-3 rounded-2xl border transition-all ${
                    selectedTaskId === t.id 
                      ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30 ring-2 ring-indigo-500/20' : 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-100') 
                      : (isDarkMode ? 'bg-white/5 border-white/5 hover:border-indigo-500/30 hover:bg-white/10' : 'bg-white border-slate-100 hover:border-indigo-100 hover:bg-slate-50/50')
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-[9px] font-black font-mono ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>{t.id}</span>
                    {t.isCritical && <Zap size={10} className="text-red-500 fill-red-500" />}
                  </div>
                  <p className={`text-xs font-bold line-clamp-1 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{t.title}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{t.duration}d</span>
                    <span className="text-[9px] font-bold text-orange-500 uppercase tracking-widest">{t.effort}p·s</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* View Content */}
        <div className="lg:col-span-3 relative">
          <AnimatePresence mode="wait">
            {activeView === 'network' && (
              <motion.div 
                key="network" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <CPMNetwork 
                  tasks={filteredTasks} 
                  showCriticalPath={true} 
                  onSelectTask={setSelectedTaskId}
                  selectedTaskId={selectedTaskId}
                  isDarkMode={isDarkMode}
                />
              </motion.div>
            )}
            {activeView === 'gantt' && (
              <motion.div 
                key="gantt" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <CPMGantt 
                  tasks={filteredTasks} 
                  projectDuration={projectDuration} 
                  onSelectTask={setSelectedTaskId}
                  isDarkMode={isDarkMode}
                />
              </motion.div>
            )}
            {activeView === 'resources' && (
              <motion.div 
                key="resources" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                <CPMResourceHistogram 
                  tasks={filteredTasks} 
                  projectDuration={projectDuration} 
                  isDarkMode={isDarkMode}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Detail Panel Overlay */}
          <AnimatePresence>
            {selectedTaskId && selectedTask && (
              <motion.div
                initial={{ opacity: 0, x: 20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 20, scale: 0.95 }}
                className={`absolute bottom-6 right-6 w-80 rounded-3xl border shadow-2xl z-20 p-6 overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-widest font-mono mb-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{selectedTask.id} · {selectedTask.phase}</p>
                    <h3 className={`text-sm font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedTask.title}</h3>
                  </div>
                  <button 
                    onClick={() => setSelectedTaskId(null)}
                    className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-500' : 'hover:bg-slate-100 text-slate-400'}`}
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  {[
                    { l: 'ES', v: selectedTask.earlyStart, c: 'text-indigo-600' },
                    { l: 'EF', v: selectedTask.earlyFinish, c: 'text-indigo-600' },
                    { l: 'Dur', v: selectedTask.duration, c: isDarkMode ? 'text-gray-400' : 'text-slate-600' },
                    { l: 'LS', v: selectedTask.lateStart, c: selectedTask.isCritical ? 'text-red-600' : 'text-amber-600' },
                    { l: 'LF', v: selectedTask.lateFinish, c: selectedTask.isCritical ? 'text-red-600' : 'text-amber-600' },
                    { l: 'Holg', v: selectedTask.slack, c: selectedTask.isCritical ? 'text-red-600' : 'text-amber-600' },
                  ].map((cell, i) => (
                    <div key={i} className={`p-2 rounded-xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                      <p className={`text-[8px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>{cell.l}</p>
                      <p className={`text-xs font-black font-mono ${cell.c}`}>{cell.v}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-4">
                  <div>
                    <div className={`flex justify-between text-[10px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      <span>Esfuerzo</span>
                      <span className="text-orange-600">{selectedTask.effort} p·s</span>
                    </div>
                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                      <div 
                        className="h-full bg-orange-500 rounded-full" 
                        style={{ width: `${Math.min(100, (selectedTask.effort || 0) / 20 * 100)}%` }} 
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(selectedTask.resources || [])).map((r, i) => (
                      <span key={`${r}-${i}`} className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-600'}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

