import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutGrid, 
  List, 
  Plus, 
  Settings2, 
  Info,
  Calendar,
  BarChart3
} from 'lucide-react';
import { StagePipeline } from './StagePipeline';
import { useStages } from '../../hooks/useStages';
import { Stage } from '../../types/stage';

interface StageManagementViewProps {
  projectId: string;
}

export const StageManagementView: React.FC<StageManagementViewProps> = ({ projectId }) => {
  const { stages, loading, reorderStages } = useStages(projectId);
  const [viewMode, setViewMode] = useState<'pipeline' | 'table'>('pipeline');
  const [showEditor, setShowEditor] = useState(false);
  const [selectedStage, setSelectedStage] = useState<Stage | null>(null);

  const handleReorder = async (newStages: Stage[]) => {
    try {
      await reorderStages(newStages);
    } catch (error) {
      console.error('Failed to reorder stages:', error);
    }
  };

  const handleAddStage = () => {
    setSelectedStage(null);
    setShowEditor(true);
  };

  const handleEditStage = (stage: Stage) => {
    setSelectedStage(stage);
    setShowEditor(true);
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-[2.5rem] shadow-sm border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#01696f]/10 rounded-2xl flex items-center justify-center text-[#01696f]">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 uppercase tracking-tight">Pipeline de Etapas</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Gestión del flujo de trabajo y cronograma
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Switcher de Vista */}
          <div className="bg-slate-100 p-1 rounded-2xl flex gap-1">
            <button
              onClick={() => setViewMode('pipeline')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'pipeline' ? 'bg-white text-[#01696f] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <LayoutGrid size={20} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-xl transition-all ${
                viewMode === 'table' ? 'bg-white text-[#01696f] shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <List size={20} />
            </button>
          </div>

          <button
            onClick={handleAddStage}
            className="px-6 py-3 bg-[#01696f] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#015a5f] transition-all shadow-lg shadow-[#01696f]/20 flex items-center gap-2"
          >
            <Plus size={16} />
            <span>Nueva Etapa</span>
          </button>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="flex-1 overflow-y-auto p-8">
        <AnimatePresence mode="wait">
          {viewMode === 'pipeline' ? (
            <motion.div
              key="pipeline-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Resumen de Estado */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                      <Calendar size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Etapa Actual</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {stages.find(s => s.status === 'active')?.name || 'Ninguna activa'}
                  </h3>
                </div>
                
                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-teal-100 rounded-xl flex items-center justify-center text-[#01696f]">
                      <BarChart3 size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Progreso Global</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <h3 className="text-3xl font-black text-slate-800">
                      {stages.length > 0 
                        ? Math.round((stages.filter(s => s.status === 'completed').length / stages.length) * 100) 
                        : 0}%
                    </h3>
                    <span className="text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Completado</span>
                  </div>
                </div>

                <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                      <Settings2 size={18} />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuración</span>
                  </div>
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed">
                    Arrastra las etapas para reordenar el flujo de trabajo.
                  </p>
                </div>
              </div>

              {/* Pipeline Visual */}
              <div className="bg-slate-50/50 rounded-[3rem] p-8 border border-slate-100">
                <StagePipeline
                  stages={stages}
                  isLoading={loading}
                  onReorder={handleReorder}
                  onAddStage={handleAddStage}
                  onSelectStage={handleEditStage}
                />
              </div>

              {/* Leyenda y Ayuda */}
              <div className="flex items-center gap-6 px-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#94a3b8]" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Pendiente</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#f97316]" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">En Curso</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#01696f]" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Completada</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bloqueada</span>
                </div>
                <div className="ml-auto flex items-center gap-2 text-slate-400">
                  <Info size={14} />
                  <span className="text-[9px] font-bold uppercase tracking-widest">Usa el scroll lateral para ver más</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="table-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center justify-center h-64 text-slate-400"
            >
              <p className="text-[10px] font-black uppercase tracking-widest">Vista de tabla en desarrollo...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
