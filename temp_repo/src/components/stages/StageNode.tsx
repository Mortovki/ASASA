import React from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, AlertCircle, Play, Users } from 'lucide-react';
import { Stage } from '../../types/stage';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface StageNodeProps {
  stage: Stage;
  isFirst?: boolean;
  isLast?: boolean;
  onClick?: (stage: Stage) => void;
}

export const StageNode: React.FC<StageNodeProps> = ({ 
  stage, 
  isFirst = false, 
  isLast = false,
  onClick 
}) => {
  const getStatusConfig = (status: Stage['status']) => {
    switch (status) {
      case 'completed':
        return {
          color: '#01696f',
          icon: <CheckCircle2 className="w-5 h-5" />,
          label: 'Completada',
          bg: 'bg-[#01696f]/10',
          border: 'border-[#01696f]'
        };
      case 'active':
        return {
          color: '#f97316',
          icon: <Play className="w-5 h-5" />,
          label: 'En curso',
          bg: 'bg-[#f97316]/10',
          border: 'border-[#f97316]'
        };
      case 'blocked':
        return {
          color: '#ef4444',
          icon: <AlertCircle className="w-5 h-5" />,
          label: 'Bloqueada',
          bg: 'bg-[#ef4444]/10',
          border: 'border-[#ef4444]'
        };
      default:
        return {
          color: '#94a3b8',
          icon: <Clock className="w-5 h-5" />,
          label: 'Pendiente',
          bg: 'bg-[#94a3b8]/10',
          border: 'border-[#94a3b8]'
        };
    }
  };

  const config = getStatusConfig(stage.status);
  const progress = stage.spTotal > 0 ? (stage.spDone / stage.spTotal) * 100 : 0;

  return (
    <div className="relative flex flex-col items-center min-w-[280px] group">
      {/* Línea conectora horizontal */}
      {!isFirst && (
        <div 
          className="absolute left-0 top-10 w-1/2 h-1 bg-slate-200 -translate-x-full"
          style={{ 
            backgroundColor: stage.status === 'completed' ? '#01696f' : '#e2e8f0' 
          }}
        />
      )}
      {!isLast && (
        <div 
          className="absolute right-0 top-10 w-1/2 h-1 bg-slate-200 translate-x-full"
          style={{ 
            backgroundColor: stage.status === 'completed' ? '#01696f' : '#e2e8f0' 
          }}
        />
      )}

      {/* Nodo Circular */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onClick?.(stage)}
        className={`
          relative z-10 w-20 h-20 rounded-full border-4 flex items-center justify-center
          transition-all duration-300 shadow-lg
          ${config.bg} ${config.border}
        `}
        style={{ color: config.color }}
      >
        {config.icon}
        
        {/* Badge de Progreso Circular */}
        <svg className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 36}`}
            strokeDashoffset={`${2 * Math.PI * 36 * (1 - progress / 100)}`}
            className="opacity-20"
          />
        </svg>
      </motion.button>

      {/* Información de la Etapa */}
      <div className="mt-4 text-center px-4">
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-tight line-clamp-1">
          {stage.name}
        </h4>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
          {config.label}
        </p>
        
        {/* Fechas */}
        <div className="flex items-center justify-center gap-2 mt-2 text-[10px] text-slate-500 font-medium">
          <span>{format(new Date(stage.startDate), 'dd MMM', { locale: es })}</span>
          <span>-</span>
          <span>{format(new Date(stage.endDate), 'dd MMM', { locale: es })}</span>
        </div>

        {/* Barra de Progreso Lineal */}
        <div className="mt-3 w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            className="h-full rounded-full"
            style={{ backgroundColor: config.color }}
          />
        </div>
        
        <div className="flex justify-between items-center mt-1">
          <span className="text-[9px] font-bold text-slate-400 uppercase">
            {Math.round(progress)}% SP
          </span>
          <div className="flex items-center gap-1 text-[9px] font-bold text-slate-400">
            <Users size={10} />
            <span>{stage.leaderId ? 'Líder' : 'Sin líder'}</span>
          </div>
        </div>
      </div>

      {/* Tooltip de Predecesoras (si existen) */}
      {stage.predecessors.length > 0 && (
        <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap">
          Depende de {stage.predecessors.length} etapa(s)
        </div>
      )}
    </div>
  );
};
