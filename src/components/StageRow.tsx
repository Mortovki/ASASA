import React from 'react';
import { Trash2, GripVertical } from 'lucide-react';
import { Stage } from '../types/stage';
import { ColorPicker } from './ui/ColorPicker';
import { motion } from 'motion/react';

interface StageRowProps {
  stage: Stage;
  index: number;
  onUpdate: (id: string, updates: Partial<Stage>) => void;
  onRemove: (id: string) => void;
  isDarkMode?: boolean;
}

export const StageRow = ({ stage, index, onUpdate, onRemove, isDarkMode }: StageRowProps) => {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-4 sm:gap-6 p-4 sm:p-6 border rounded-[2rem] group transition-all duration-300 relative ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 hover:border-indigo-500/50 hover:shadow-indigo-500/5' : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md'}`}
    >
      <div className="flex flex-col items-center gap-4 mt-2 shrink-0">
        <div className={`cursor-grab active:cursor-grabbing transition-colors ${isDarkMode ? 'text-gray-700 hover:text-gray-600' : 'text-slate-300 hover:text-slate-400'}`}>
          <GripVertical className="w-5 h-5" />
        </div>
      </div>
      
      <div className="flex-1 space-y-4 sm:space-y-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          <div className="flex-[3] space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Nombre de la Etapa</label>
            <input
              type="text"
              value={stage.name}
              onChange={(e) => onUpdate(stage.id, { name: e.target.value })}
              placeholder="Ej. Diagnóstico Inicial"
              className={`w-full px-4 py-2.5 text-sm font-bold border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-800 focus:bg-white'}`}
            />
          </div>
          <div className="flex-[2] space-y-1.5 min-w-[180px]">
            <label className={`block text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Color</label>
            <ColorPicker 
              selectedColor={stage.color} 
              onSelect={(color) => onUpdate(stage.id, { color })} 
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha Inicio</label>
            <input
              type="date"
              value={stage.startDate?.split('T')[0] || ''}
              onChange={(e) => onUpdate(stage.id, { startDate: e.target.value })}
              className={`w-full px-4 py-2.5 text-xs font-medium border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-300 focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-600 focus:bg-white'}`}
            />
          </div>
          <div className="space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha Fin</label>
            <input
              type="date"
              value={stage.endDate?.split('T')[0] || ''}
              onChange={(e) => onUpdate(stage.id, { endDate: e.target.value })}
              className={`w-full px-4 py-2.5 text-xs font-medium border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-300 focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-600 focus:bg-white'}`}
            />
          </div>
          <div className="lg:col-span-1 space-y-1.5">
            <label className={`block text-[10px] font-bold uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Descripción de la Etapa</label>
            <textarea
              value={stage.description || ''}
              onChange={(e) => onUpdate(stage.id, { description: e.target.value })}
              placeholder="Objetivos..."
              className={`w-full px-4 py-2.5 text-xs font-medium border rounded-xl resize-none focus:ring-2 focus:ring-indigo-500/20 outline-none h-[42px] transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-300 focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-600 focus:bg-white'}`}
            />
          </div>
        </div>
      </div>

      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <button
          onClick={() => onRemove(stage.id)}
          className={`p-2 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 active:scale-90 ${isDarkMode ? 'text-gray-700 hover:text-red-400 hover:bg-red-400/10' : 'text-slate-300 hover:text-red-500 hover:bg-red-50'}`}
          title="Eliminar etapa"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};
