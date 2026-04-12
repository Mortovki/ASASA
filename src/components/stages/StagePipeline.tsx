import React from 'react';
import { motion, Reorder } from 'motion/react';
import { StageNode } from './StageNode';
import { Stage } from '../../types/stage';
import { ChevronRight, ChevronLeft, Plus } from 'lucide-react';

interface StagePipelineProps {
  stages: Stage[];
  onReorder?: (newOrder: Stage[]) => void;
  onAddStage?: () => void;
  onSelectStage?: (stage: Stage) => void;
  isLoading?: boolean;
}

export const StagePipeline: React.FC<StagePipelineProps> = ({
  stages,
  onReorder,
  onAddStage,
  onSelectStage,
  isLoading = false
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - clientWidth / 2 : scrollLeft + clientWidth / 2;
      scrollRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#01696f] border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cargando pipeline...</p>
        </div>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200 p-8 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <Plus className="text-slate-400" size={32} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-tight">No hay etapas definidas</h3>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 max-w-xs">
          Comienza creando la primera etapa para visualizar el flujo de trabajo del proyecto.
        </p>
        <button
          onClick={onAddStage}
          className="mt-6 px-6 py-3 bg-[#01696f] text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#015a5f] transition-all shadow-lg shadow-[#01696f]/20 flex items-center gap-2"
        >
          <Plus size={16} />
          <span>Nueva Etapa</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Botones de Navegación */}
      <button
        onClick={() => scroll('left')}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white rounded-full shadow-xl border border-slate-100 text-slate-400 hover:text-[#01696f] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronLeft size={24} />
      </button>
      <button
        onClick={() => scroll('right')}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-20 p-2 bg-white rounded-full shadow-xl border border-slate-100 text-slate-400 hover:text-[#01696f] opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ChevronRight size={24} />
      </button>

      {/* Contenedor del Pipeline */}
      <div 
        ref={scrollRef}
        className="overflow-x-auto no-scrollbar pb-8 pt-12 px-4"
      >
        {onReorder ? (
          <Reorder.Group
            axis="x"
            values={stages}
            onReorder={onReorder}
            className="flex items-start gap-0 min-w-max"
          >
            {stages.map((stage, index) => (
              <Reorder.Item
                key={stage.id}
                value={stage}
                className="cursor-grab active:cursor-grabbing"
              >
                <StageNode
                  stage={stage}
                  isFirst={index === 0}
                  isLast={index === stages.length - 1}
                  onClick={onSelectStage}
                />
              </Reorder.Item>
            ))}
            
            {/* Botón Añadir al final */}
            <div className="flex flex-col items-center min-w-[120px] pt-4">
              <button
                onClick={onAddStage}
                className="w-12 h-12 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 hover:border-[#01696f] hover:text-[#01696f] transition-all"
              >
                <Plus size={24} />
              </button>
              <span className="mt-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Añadir</span>
            </div>
          </Reorder.Group>
        ) : (
          <div className="flex items-start gap-0 min-w-max">
            {stages.map((stage, index) => (
              <StageNode
                key={stage.id}
                stage={stage}
                isFirst={index === 0}
                isLast={index === stages.length - 1}
                onClick={onSelectStage}
              />
            ))}
          </div>
        )}
      </div>

      {/* Indicador Visual de Scroll */}
      <div className="flex justify-center gap-1 mt-4">
        {stages.map((s, i) => (
          <div 
            key={`dot-${s.id}`}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              s.status === 'active' ? 'bg-[#f97316] w-4' : 'bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
