import React, { useState, useEffect } from 'react';
import { Plus, Save, Layout, AlertCircle, CheckCircle2, Info, Calendar } from 'lucide-react';
import { nanoid } from 'nanoid';
import { Stage, STAGE_PRESETS, STAGE_PRESET_LABELS } from '../types/stage';
import { StageRow } from './StageRow';
import { validateStageDates } from '../utils/dateValidation';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { ConfirmModal } from './ui/ConfirmModal';

interface StageEditorProps {
  project: any;
  tasks: any[];
  onSave: (stages: Stage[], startDate?: string | null, endDate?: string | null) => Promise<void>;
  isDarkMode?: boolean;
}

export const StageEditor = ({ project, tasks, onSave, isDarkMode }: StageEditorProps) => {
  const [stages, setStages] = useState<Stage[]>(project.stages || []);
  const [startDate, setStartDate] = useState<string>(project.startDate || '');
  const [endDate, setEndDate] = useState<string>(project.endDate || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [stageToDelete, setStageToDelete] = useState<string | null>(null);

  // Calculate KPIs
  const kpis = React.useMemo(() => {
    const totalStages = stages.length;
    const activeTasks = tasks.filter(t => t.status !== 'done').length;
    const doneTasks = tasks.filter(t => t.status === 'done').length;
    const totalTasks = tasks.length;
    const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
    const totalSP = tasks.reduce((acc, t) => {
      const val = parseFloat(t.estimatedSP);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);
    const doneSP = tasks.filter(t => t.status === 'done').reduce((acc, t) => {
      const val = parseFloat(t.estimatedSP);
      return acc + (isNaN(val) ? 0 : val);
    }, 0);

    return { totalStages, activeTasks, totalTasks, progress, totalSP, doneSP };
  }, [stages, tasks]);

  useEffect(() => {
    const validationErrors = validateStageDates(stages, startDate || null, endDate || null);
    setErrors(validationErrors);
  }, [stages, startDate, endDate]);

  const addStage = () => {
    const newStage: Stage = {
      id: nanoid(6),
      projectId: project.id,
      name: '',
      color: '#3b82f6',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      description: '',
      order: stages.length,
      status: 'pending',
      leaderId: null,
      spTotal: 0,
      spDone: 0,
      sprintIds: [],
      predecessors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setStages([...stages, newStage]);
  };

  const removeStage = (id: string) => {
    setStages(stages.filter(s => s.id !== id));
    setStageToDelete(null);
  };

  const updateStage = (id: string, updates: Partial<Stage>) => {
    setStages(stages.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const applyPreset = (presetKey: string) => {
    const preset = STAGE_PRESETS[presetKey];
    if (!preset) return;

    const newStages: Stage[] = preset.map((p, index) => ({
      id: nanoid(6),
      projectId: project.id,
      name: p.name || '',
      color: p.color || '#3b82f6',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 86400000).toISOString(),
      description: '',
      order: index,
      status: 'pending',
      leaderId: null,
      spTotal: 0,
      spDone: 0,
      sprintIds: [],
      predecessors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    setStages(newStages);
    toast.success(`Preset "${STAGE_PRESET_LABELS[presetKey]}" aplicado`);
  };

  const handleSave = async () => {
    if (errors.length > 0) {
      toast.error('Corrige los errores antes de guardar');
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(stages, startDate || null, endDate || null);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className={`text-4xl font-display italic leading-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Gestión de Etapas del Proyecto</h1>
        <p className={`font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Define el ciclo operativo, fechas globales y el flujo de trabajo.</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Etapas Totales', value: kpis.totalStages, color: 'bg-indigo-500' },
          { label: 'Tareas Activas', value: kpis.activeTasks, color: 'bg-orange-500' },
          { label: 'Avance Global', value: `${kpis.progress}%`, color: 'bg-green-500' },
          { label: 'SP Completados', value: kpis.doneSP, color: 'bg-blue-500' },
          { label: 'Total SP', value: kpis.totalSP, color: 'bg-slate-400' },
        ].map((kpi, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}
          >
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{kpi.label}</p>
            <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{kpi.value}</p>
            <div className={`h-1 w-8 rounded-full mt-2 ${kpi.color}`} />
          </motion.div>
        ))}
      </div>

      {/* Pipeline Visualization */}
      {stages.length > 0 && (
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm overflow-x-auto hide-scrollbar snap-x snap-mandatory ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <div className="flex items-center min-w-max px-2 sm:px-4">
            {stages.map((stage, i) => (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center group relative snap-center">
                  <div 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-white font-black shadow-lg transition-transform group-hover:scale-110"
                    style={{ backgroundColor: stage.color }}
                  >
                    {i + 1}
                  </div>
                  <div className="mt-3 text-center">
                    <p className={`text-[10px] sm:text-xs font-bold max-w-[80px] sm:max-w-[100px] truncate ${isDarkMode ? 'text-gray-300' : 'text-slate-800'}`}>{stage.name || 'Sin nombre'}</p>
                    <p className={`text-[8px] sm:text-[10px] font-medium uppercase tracking-tighter ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                      {stage.startDate ? stage.startDate.slice(5) : '—'}
                    </p>
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div className={`w-8 sm:w-12 h-0.5 mx-2 mb-8 shrink-0 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Global Config & Presets */}
        <div className="space-y-6">
          <div className={`p-6 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
            <div className="space-y-4">
              <h3 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <Calendar className="w-4 h-4 text-indigo-500" />
                Cronograma Global
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className={`block text-[10px] font-bold mb-1.5 uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Inicio del Proyecto</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                </div>
                <div>
                  <label className={`block text-[10px] font-bold mb-1.5 uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Cierre del Proyecto</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className={`w-full px-4 py-2.5 border rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'}`}
                  />
                </div>
              </div>
            </div>

            <hr className={isDarkMode ? 'border-white/5' : 'border-slate-100'} />

            <div className="space-y-4">
              <h3 className={`text-sm font-bold flex items-center gap-2 uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                <Info className="w-4 h-4 text-indigo-500" />
                Plantillas Rápidas
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {Object.keys(STAGE_PRESETS).map(key => (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`w-full px-4 py-3 text-left text-xs font-bold border rounded-xl transition-all shadow-sm group ${isDarkMode ? 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-indigo-400 hover:border-indigo-500/50' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-indigo-600 hover:border-indigo-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      {STAGE_PRESET_LABELS[key]}
                      <Plus className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Validation Errors */}
          <AnimatePresence>
            {errors.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`border rounded-3xl p-6 space-y-3 ${isDarkMode ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}
              >
                <div className={`flex items-center gap-2 font-bold text-sm ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                  <AlertCircle className="w-4 h-4" />
                  Errores de Validación
                </div>
                <ul className={`text-xs space-y-2 list-disc list-inside font-medium ${isDarkMode ? 'text-red-400/80' : 'text-red-600'}`}>
                  {errors.map((err, i) => <li key={i}>{err}</li>)}
                </ul>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Stage List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className={`text-sm font-bold uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Configuración de Etapas ({stages.length})</h3>
            <button
              onClick={addStage}
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
              Nueva Etapa
            </button>
          </div>

          <div className="space-y-4">
            {stages.length === 0 ? (
              <div className={`text-center py-20 border-2 border-dashed rounded-[2rem] ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
                <Layout className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-800' : 'text-slate-200'}`} />
                <p className={`font-medium italic ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>No hay etapas configuradas aún.</p>
                <button onClick={addStage} className="text-indigo-600 text-sm font-bold hover:underline mt-2">Comenzar ahora</button>
              </div>
            ) : (
              <div className="space-y-4">
                {stages.map((stage, index) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    index={index}
                    onUpdate={updateStage}
                    onRemove={(id) => setStageToDelete(id)}
                    isDarkMode={isDarkMode}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Save Bar */}
      <div className={`fixed bottom-0 left-0 right-0 sm:left-auto sm:right-8 sm:bottom-8 p-4 sm:p-0 z-50 flex justify-center sm:justify-end ${isDarkMode ? 'bg-[#1a1a1a]/80 sm:bg-transparent border-t sm:border-none border-white/5 backdrop-blur-md sm:backdrop-blur-none' : 'bg-white/80 sm:bg-transparent border-t sm:border-none border-slate-100 backdrop-blur-md sm:backdrop-blur-none'}`}>
        <button
          onClick={handleSave}
          disabled={isSaving || errors.length > 0}
          className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 text-sm font-bold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xl shadow-indigo-500/40 transition-all hover:scale-105 active:scale-95"
        >
          {isSaving ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Save className="w-5 h-5" />
              Guardar Configuración
            </>
          )}
        </button>
      </div>

      <ConfirmModal
        isOpen={!!stageToDelete}
        onClose={() => setStageToDelete(null)}
        onConfirm={() => stageToDelete && removeStage(stageToDelete)}
        title="¿Eliminar Etapa?"
        message="¿Estás seguro de que deseas eliminar esta etapa? Todas las tareas asociadas quedarán sin etapa."
        confirmText="Eliminar"
      />
    </div>
  );
};
