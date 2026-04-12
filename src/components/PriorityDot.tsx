import React from 'react';

interface PriorityDotProps {
  priority: number;
  size?: number;
}

const PriorityDot: React.FC<PriorityDotProps> = ({ priority, size = 8 }) => {
  const getColor = (p: number) => {
    if (p >= 5) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
    if (p >= 4) return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]';
    if (p >= 3) return 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.5)]';
    if (p >= 2) return 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]';
    return 'bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]';
  };

  return (
    <div 
      className={`rounded-full ${getColor(priority)} transition-all duration-300`}
      style={{ width: size, height: size }}
      title={`Prioridad: ${priority}`}
    />
  );
};

export default PriorityDot;
