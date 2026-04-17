import React, { useMemo, useState, useEffect } from 'react';
import { PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { Target, CheckCircle2, AlertTriangle, Clock, Calendar, LayoutGrid, BarChart3, PieChart as PieChartIcon, Activity, Users, MessageSquare, ChevronRight } from 'lucide-react';
import { formatName, formatFullName } from '../utils/formatters';
import { db } from '../firebase';
import { collectionGroup, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import { dedupeById } from '../utils/dedupe';

import ProjectProgressAnalysis from './ProjectProgressAnalysis';

const STATUS_COLORS: Record<string, string> = {
  todo: '#cbd5e1',
  working_on_it: '#f97316',
  waiting_review: '#3b82f6',
  stuck: '#ef4444',
  done: '#22c55e',
};

const STATUS_LABELS: Record<string, string> = {
  todo: 'Por Hacer',
  working_on_it: 'En Progreso',
  waiting_review: 'En Revisión',
  stuck: 'Atascado',
  done: 'Completado',
};

const ProjectDashboard = ({ tasks, projectId, project, students, isDarkMode }: any) => {
  const [selectedStageId, setSelectedStageId] = useState<string>(
    project?.stages?.[project?.currentStageIndex || 0]?.id || 'all'
  );
  const [projectNotes, setProjectNotes] = useState<any[]>([]);

  useEffect(() => {
    if (!projectId) return;

    let unsubscribeFallback: (() => void) | null = null;

    // Fetch all notes for this project using collectionGroup
    // Note: This requires a composite index on projectId and createdAt
    const notesQuery = query(
      collectionGroup(db, 'notes'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProjectNotes(dedupeById(notesData));
    }, (error) => {
      console.error("Error fetching project notes:", error);
      // Fallback: fetch without ordering if index is missing
      const fallbackQuery = query(
        collectionGroup(db, 'notes'),
        where('projectId', '==', projectId)
      );
      unsubscribeFallback = onSnapshot(fallbackQuery, (snapshot) => {
        const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const sorted = notesData.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 50);
        setProjectNotes(dedupeById(sorted));
      });
    });

    return () => {
      unsubscribe();
      if (unsubscribeFallback) unsubscribeFallback();
    };
  }, [projectId]);

  const filteredTasks = useMemo(() => {
    if (selectedStageId === 'all') return tasks;
    return tasks.filter((t: any) => t.stageId === selectedStageId);
  }, [tasks, selectedStageId]);

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((t: any) => t.status === 'done').length;
    const critical = filteredTasks.filter((t: any) => t.isCritical).length;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;
    const totalSP = filteredTasks.reduce((acc: number, t: any) => {
      const val = parseFloat(t.estimatedSP);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const doneSP = filteredTasks.filter((t: any) => t.status === 'done').reduce((acc: number, t: any) => {
      const val = parseFloat(t.estimatedSP);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return { total, done, critical, progress, totalSP, doneSP };
  }, [filteredTasks]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasks.forEach((t: any) => {
      counts[t.status] = (counts[t.status] || 0) + 1;
    });
    return Object.entries(counts).map(([status, count]) => ({
      name: STATUS_LABELS[status] || status,
      value: count,
      color: STATUS_COLORS[status] || '#94a3b8'
    }));
  }, [filteredTasks]);

  const userLoadData = useMemo(() => {
    const load: Record<string, number> = {};
    filteredTasks.forEach((t: any) => {
      if (t.assignedTo && t.status !== 'done') {
        load[t.assignedTo] = (load[t.assignedTo] || 0) + (t.effort || 1);
      }
    });
    return Object.entries(load).map(([uid, effort]) => {
      const student = students.find((s: any) => s.id === uid);
      return {
        name: student ? formatName(student.firstName, student.lastNamePaterno) : 'Sin Asignar',
        esfuerzo: effort
      };
    }).sort((a, b) => b.esfuerzo - a.esfuerzo);
  }, [filteredTasks, students]);

  const burndownData = useMemo(() => {
    const stage = project?.stages?.find((s: any) => s.id === selectedStageId);
    if (!stage || selectedStageId === 'all') return [];

    const start = new Date(stage.startDate);
    const end = new Date(stage.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const data = [];
    const totalSP = stats.totalSP;
    
    // Group completed tasks by date
    const completedByDate: Record<string, number> = {};
    filteredTasks.filter((t: any) => t.status === 'done' && t.completedAt).forEach((t: any) => {
      const date = new Date(t.completedAt).toISOString().split('T')[0];
      completedByDate[date] = (completedByDate[date] || 0) + (t.estimatedSP || 0);
    });

    let remaining = totalSP;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= totalDays; i++) {
      const currentDay = new Date(start);
      currentDay.setDate(start.getDate() + i);
      const dateStr = currentDay.toISOString().split('T')[0];
      
      remaining -= (completedByDate[dateStr] || 0);
      
      data.push({
        day: currentDay.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }),
        ideal: Math.max(0, totalSP - (totalSP / totalDays) * i),
        actual: currentDay <= today ? Math.max(0, remaining) : null
      });
    }
    return data;
  }, [project, selectedStageId, filteredTasks, stats.totalSP]);

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 200;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', handleScroll);
      // Use a small timeout to ensure DOM has updated after stages change
      const timeoutId = setTimeout(handleScroll, 100);
      
      // Also observe resize
      const resizeObserver = new ResizeObserver(() => handleScroll());
      resizeObserver.observe(ref);

      return () => {
        ref.removeEventListener('scroll', handleScroll);
        clearTimeout(timeoutId);
        resizeObserver.disconnect();
      };
    }
  }, [project?.stages]);

  return (
    <div className="space-y-6">
      {/* Stage Selector & Summary Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className={`text-3xl sm:text-4xl font-black tracking-tight leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Dashboard del Proyecto</h1>
          <p className={`font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Resumen de ejecución y métricas clave</p>
        </div>
        <div className="flex items-center gap-2 w-full">
          <button 
            onClick={() => scroll('left')} 
            className={`shrink-0 p-2 rounded-full shadow-sm border transition-all ${!showLeftArrow ? 'opacity-0 pointer-events-none' : ''} ${isDarkMode ? 'bg-slate-800 text-white border-white/10 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            aria-hidden={!showLeftArrow}
          >
            <ChevronRight size={16} className="rotate-180" />
          </button>
          
          <div ref={scrollRef} className="flex items-center gap-2 sm:gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory p-1.5 rounded-xl border shadow-sm flex-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            <button 
              onClick={() => setSelectedStageId('all')}
              className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg transition-all shrink-0 snap-center min-h-[44px] ${selectedStageId === 'all' ? 'bg-indigo-600 text-white shadow-md' : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')}`}
            >
              <LayoutGrid size={16} />
              <span className="whitespace-nowrap">Todo el Proyecto</span>
            </button>
            {project?.stages?.map((stage: any) => (
              <button 
                key={stage.id}
                onClick={() => setSelectedStageId(stage.id)}
                className={`flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold rounded-lg transition-all shrink-0 snap-center min-h-[44px] ${selectedStageId === stage.id ? 'bg-indigo-600 text-white shadow-md' : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')}`}
              >
                <Target size={16} />
                <span className="whitespace-nowrap">{stage.name}</span>
              </button>
            ))}
          </div>

          <button 
            onClick={() => scroll('right')} 
            className={`shrink-0 p-2 rounded-full shadow-sm border transition-all ${!showRightArrow ? 'opacity-0 pointer-events-none' : ''} ${isDarkMode ? 'bg-slate-800 text-white border-white/10 hover:bg-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            aria-hidden={!showRightArrow}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <div className={`p-4 sm:p-6 rounded-2xl shadow-sm border flex items-center gap-3 sm:gap-4 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <LayoutGrid size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Tareas</p>
            <p className={`text-lg sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stats.total}</p>
          </div>
        </div>
        <div className={`p-4 sm:p-6 rounded-2xl shadow-sm border flex items-center gap-3 sm:gap-4 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
            <CheckCircle2 size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Progreso</p>
            <p className={`text-lg sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stats.progress}%</p>
          </div>
        </div>
        <div className={`p-4 sm:p-6 rounded-2xl shadow-sm border flex items-center gap-3 sm:gap-4 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>
            <Target size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Puntos</p>
            <p className={`text-lg sm:text-2xl font-black truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stats.doneSP}/{stats.totalSP}</p>
          </div>
        </div>
        <div className={`p-4 sm:p-6 rounded-2xl shadow-sm border flex items-center gap-3 sm:gap-4 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600'}`}>
            <AlertTriangle size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Críticas</p>
            <p className={`text-lg sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stats.critical}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Chart */}
        <div className={`p-6 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <PieChartIcon size={18} className="text-indigo-500" />
              <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Estado de Tareas</h3>
            </div>
            <div className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Distribución</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                    color: isDarkMode ? '#fff' : '#000'
                  }}
                  itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* User Load Chart */}
        <div className={`p-6 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-indigo-500" />
              <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Carga por Usuario</h3>
            </div>
            <div className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Esfuerzo Activo</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <BarChart data={userLoadData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'} />
                <XAxis type="number" tick={{ fill: isDarkMode ? '#64748b' : '#94a3b8' }} />
                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12, fontWeight: 'bold', fill: isDarkMode ? '#64748b' : '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                    color: isDarkMode ? '#fff' : '#000'
                  }}
                  itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                />
                <Bar dataKey="esfuerzo" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Burndown Chart */}
      <div className={`p-6 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-indigo-500" />
            <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Burndown Chart</h3>
          </div>
          <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
            <Calendar size={14} />
            {selectedStageId === 'all' ? 'Proyecto Completo' : 'Etapa Seleccionada'}
          </div>
        </div>
        <div className="h-72">
          {burndownData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={burndownData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : '#e2e8f0'} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fontWeight: 'bold', fill: isDarkMode ? '#64748b' : '#94a3b8' }} />
                <YAxis tick={{ fontSize: 10, fontWeight: 'bold', fill: isDarkMode ? '#64748b' : '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: isDarkMode ? '#1a1a1a' : '#fff',
                    borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#e2e8f0',
                    color: isDarkMode ? '#fff' : '#000'
                  }}
                  itemStyle={{ color: isDarkMode ? '#fff' : '#000' }}
                />
                <Legend />
                <Line type="monotone" dataKey="ideal" stroke="#94a3b8" strokeDasharray="5 5" name="Ideal" dot={false} />
                <Line type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={3} name="Restante" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className={`flex flex-col items-center justify-center h-full font-medium gap-2 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
              <Clock size={48} className="opacity-20" />
              <p>Selecciona una etapa para ver el burndown detallado.</p>
            </div>
          )}
        </div>
      </div>

      {/* Global Progress Analysis */}
      <ProjectProgressAnalysis 
        project={project} 
        tasks={tasks} 
        isDarkMode={isDarkMode} 
      />

      {/* Comment History Section */}
      <div className={`p-6 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-indigo-500" />
            <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Historial de Comentarios</h3>
          </div>
          <div className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Actividad Reciente</div>
        </div>

        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
          {projectNotes.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare size={48} className={`mx-auto mb-4 opacity-20 ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`} />
              <p className={`font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>No hay comentarios aún en este proyecto.</p>
            </div>
          ) : (
            projectNotes.map((note) => (
              <div key={note.id} className={`p-4 rounded-xl border transition-all ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-slate-100'}`}>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}>
                      {note.authorName?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <p className={`text-xs font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{formatFullName(note.authorName)}</p>
                      <p className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>
                        {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(note.createdAt))}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                      Tarea: {note.taskTitle || 'Sin título'}
                    </p>
                    {note.parentId && (
                      <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded ml-2">Respuesta</span>
                    )}
                  </div>
                </div>
                <div className={`prose prose-sm max-w-none ${isDarkMode ? 'text-slate-400 prose-invert' : 'text-slate-600'} line-clamp-3 text-xs`}>
                  <ReactMarkdown>{note.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDashboard;
