import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp, TrendingDown, Minus, Info, Zap } from 'lucide-react';

interface Stage {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Task {
  id: string;
  status: string;
  stageId: string;
  estimatedSP?: number;
}

interface ProjectProgressAnalysisProps {
  project: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    stages: Stage[];
  };
  tasks: Task[];
  isDarkMode: boolean;
}

const ProjectProgressAnalysis: React.FC<ProjectProgressAnalysisProps> = ({ project, tasks, isDarkMode }) => {
  const analysis = useMemo(() => {
    if (!project) return null;

    const stages = project.stages || [];
    
    // Derive project start/end from stages if not present
    let startStr = project.startDate;
    let endStr = project.endDate;

    // Fallback dates for mockup if missing
    if (!startStr && (!stages || stages.length === 0)) {
      const d = new Date();
      d.setDate(d.getDate() - 26); // 26 days ago
      startStr = d.toISOString();
    }
    if (!endStr && (!stages || stages.length === 0)) {
      const d = new Date();
      d.setDate(d.getDate() + 10); // 10 days from now
      endStr = d.toISOString();
    }

    if (!startStr && stages.length > 0) {
      const startDates = stages.map(s => new Date(s.startDate).getTime()).filter(t => !isNaN(t));
      if (startDates.length > 0) startStr = new Date(Math.min(...startDates)).toISOString();
    }
    if (!endStr && stages.length > 0) {
      const endDates = stages.map(s => new Date(s.endDate).getTime()).filter(t => !isNaN(t));
      if (endDates.length > 0) endStr = new Date(Math.max(...endDates)).toISOString();
    }

    if (!startStr || !endStr) return null;

    const now = new Date();
    const start = new Date(startStr);
    const end = new Date(endStr);
    
    const totalTime = end.getTime() - start.getTime();
    const elapsed = Math.max(0, Math.min(totalTime, now.getTime() - start.getTime()));
    
    const timeProgress = totalTime > 0 ? (elapsed / totalTime) * 100 : 0;
    const totalDays = Math.ceil(totalTime / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.ceil(elapsed / (1000 * 60 * 60 * 24));

    // Task progress (weighted by SP if available, otherwise count)
    const totalTasks = tasks.length || 22; // Fallback for mockup
    const doneTasks = tasks.filter(t => t.status === 'done').length || 9; // Fallback for mockup
    
    const totalSP = tasks.reduce((acc, t) => acc + (Number(t.estimatedSP) || 0), 0);
    const doneSP = tasks.filter(t => t.status === 'done').reduce((acc, t) => acc + (Number(t.estimatedSP) || 0), 0);
    
    const taskProgress = totalSP > 0 ? (doneSP / totalSP) * 100 : (totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 41); // 41% fallback
    
    const gap = taskProgress - timeProgress;
    
    let riskStatus = 'En ritmo';
    let riskColor = 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    let interpretation = 'El proyecto avanza según lo planificado.';
    let action = 'Mantener el ritmo actual y monitorear hitos próximos.';
    let riskLevel = 'Bajo';

    if (gap < -15) {
      riskStatus = 'Atraso detectado';
      riskColor = 'text-red-500 bg-red-500/10 border-red-500/20';
      interpretation = 'El tiempo corre más rápido que la ejecución';
      action = 'Repriorizar tareas críticas y reducir bloqueos';
      riskLevel = 'Riesgo medio-alto';
    } else if (gap < -5) {
      riskStatus = 'Atención requerida';
      riskColor = 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      interpretation = 'Ligero desfase entre tiempo y avance.';
      action = 'Acelerar entregables pendientes de la etapa actual.';
      riskLevel = 'Riesgo medio';
    } else if (gap > 10) {
      riskStatus = 'Adelantado';
      riskColor = 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
      interpretation = 'La ejecución supera la expectativa temporal.';
      action = 'Validar calidad de entregables o adelantar etapas.';
      riskLevel = 'Eficiencia alta';
    }

    // Stage breakdown fallback for mockup if empty
    let finalStages = stages;
    if (stages.length === 0) {
      finalStages = [
        { id: 's1', name: 'Diagnóstico inicial', startDate: new Date(start.getTime()).toISOString(), endDate: new Date(start.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 's2', name: 'Diseño', startDate: new Date(start.getTime() + 11 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date(start.getTime() + 22 * 24 * 60 * 60 * 1000).toISOString() },
        { id: 's3', name: 'Taller participativo', startDate: new Date(start.getTime() + 23 * 24 * 60 * 60 * 1000).toISOString(), endDate: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString() },
      ];
    }

    const stageBreakdown = finalStages.map(stage => {
      const stageTasks = tasks.filter(t => t.stageId === stage.id);
      const sTotal = stageTasks.length;
      const sDone = stageTasks.filter(t => t.status === 'done').length;
      
      const sTotalSP = stageTasks.reduce((acc, t) => acc + (Number(t.estimatedSP) || 0), 0);
      const sDoneSP = stageTasks.filter(t => t.status === 'done').reduce((acc, t) => acc + (Number(t.estimatedSP) || 0), 0);
      
      let sProgress = sTotalSP > 0 ? (sDoneSP / sTotalSP) * 100 : (sTotal > 0 ? (sDone / sTotal) * 100 : 0);
      
      // Mockup values for empty stages
      if (stages.length === 0) {
        if (stage.id === 's1') sProgress = 78;
        if (stage.id === 's2') sProgress = 38;
        if (stage.id === 's3') sProgress = 5;
      }

      const sStart = new Date(stage.startDate);
      const sEnd = new Date(stage.endDate);
      const sTotalTime = sEnd.getTime() - sStart.getTime();
      const sElapsed = Math.max(0, Math.min(sTotalTime, now.getTime() - sStart.getTime()));
      const sTimeProgress = sTotalTime > 0 ? (sElapsed / sTotalTime) * 100 : 0;
      
      const sGap = sProgress - sTimeProgress;
      let sStatus = 'En ritmo';
      let sStatusColor = 'text-emerald-500 bg-emerald-500/10';
      
      if (sGap < -10) {
        sStatus = 'Atención';
        sStatusColor = 'text-amber-500 bg-amber-500/10';
      } else if (sGap > 10) {
        sStatus = 'Adelantado';
        sStatusColor = 'text-indigo-500 bg-indigo-500/10';
      } else if (now < sStart) {
        sStatus = 'Por arrancar';
        sStatusColor = 'text-slate-400 bg-slate-400/10';
      }

      return {
        ...stage,
        progress: Math.round(sProgress),
        timeProgress: Math.round(sTimeProgress),
        status: sStatus,
        statusColor: sStatusColor
      };
    });

    return {
      timeProgress: Math.round(timeProgress),
      taskProgress: Math.round(taskProgress),
      gap: Math.round(gap),
      totalDays,
      elapsedDays,
      totalTasks,
      doneTasks,
      riskStatus,
      riskColor,
      interpretation,
      action,
      riskLevel,
      stageBreakdown
    };
  }, [project, tasks]);

  if (!analysis) return null;

  return (
    <div className="space-y-6">
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: ${isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'};
        }
      `}} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Progreso contra tiempo y cumplimiento de tareas
          </h2>
          <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
            Mockup para contrastar el tiempo consumido del proyecto frente al avance real ejecutado.
          </p>
        </div>
        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
          Lectura crítica del ritmo del proyecto
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Comparative Bar & KPIs */}
        <div className={`lg:col-span-2 p-6 rounded-3xl border shadow-sm space-y-8 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between">
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Barra comparativa principal</h3>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${analysis.riskColor}`}>
              {analysis.riskStatus}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Tiempo Transcurrido</p>
              <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analysis.timeProgress}%</p>
              <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{analysis.elapsedDays} de {analysis.totalDays} días</p>
            </div>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Avance Real</p>
              <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analysis.taskProgress}%</p>
              <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>según tareas concluidas</p>
            </div>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Tareas Cerradas</p>
              <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analysis.doneTasks} / {analysis.totalTasks}</p>
              <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{analysis.totalTasks - analysis.doneTasks} pendientes</p>
            </div>
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Variación</p>
              <p className={`text-2xl font-black ${analysis.gap >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                {analysis.gap > 0 ? '+' : ''}{analysis.gap} pts
              </p>
              <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                {analysis.gap >= 0 ? 'el avance supera el tiempo' : 'el avance va por debajo'}
              </p>
            </div>
          </div>

          <div className={`p-6 rounded-3xl border ${isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/30 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h4 className={`text-base font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Ritmo general del proyecto</h4>
                <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Comparación entre tiempo consumido y tareas efectivamente completadas.</p>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${analysis.riskColor}`}>
                {analysis.riskLevel}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Tiempo consumido</span>
                  <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{analysis.timeProgress}%</span>
                </div>
                <div className={`h-3 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.timeProgress}%` }}
                    className="h-full bg-slate-400 rounded-full"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                  <span className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>Avance por tareas cumplidas</span>
                  <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{analysis.taskProgress}%</span>
                </div>
                <div className={`h-3 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${analysis.taskProgress}%` }}
                    className="h-full bg-indigo-600 rounded-full shadow-[0_0_15px_rgba(79,70,229,0.3)]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Lectura</p>
                <p className={`text-sm font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analysis.interpretation}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Acción Sugerida</p>
                <p className={`text-sm font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{analysis.action}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <p className={`text-[9px] font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Umbral</p>
                <p className={`text-sm font-black leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>alerta si la brecha supera 15 puntos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stage Breakdown */}
        <div className={`p-6 rounded-3xl border shadow-sm flex flex-col ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'}`}>
          <div className="flex items-center justify-between mb-6">
            <h3 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Detalle por etapa</h3>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              Comparación micro
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
            {analysis.stageBreakdown.map((stage) => (
              <div key={stage.id} className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50/50 border-slate-100 hover:bg-white hover:shadow-md'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{stage.name}</h4>
                    <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      {new Date(stage.startDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })} — {new Date(stage.endDate).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                    </p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${stage.statusColor}`}>
                    {stage.status}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
                      <span>Tiempo</span>
                      <span>{stage.timeProgress}%</span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-200/50'}`}>
                      <div className="h-full bg-slate-400 rounded-full" style={{ width: `${stage.timeProgress}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-[8px] font-black uppercase tracking-widest text-slate-400">
                      <span>Avance</span>
                      <span>{stage.progress}%</span>
                    </div>
                    <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDarkMode ? 'bg-white/5' : 'bg-slate-200/50'}`}>
                      <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${stage.progress}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectProgressAnalysis;
