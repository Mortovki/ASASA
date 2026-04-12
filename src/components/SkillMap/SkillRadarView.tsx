import React from 'react';
import { CategoryStats } from '../../utils/skillAnalysis';
import { motion } from 'motion/react';

interface SkillRadarViewProps {
  stats: CategoryStats[];
  hasReference: boolean;
  isDarkMode: boolean;
}

export const SkillRadarView: React.FC<SkillRadarViewProps> = ({ stats, hasReference, isDarkMode }) => {
  const size = 400;
  const center = size / 2;
  const radius = size * 0.4;
  const angleStep = (Math.PI * 2) / stats.length;

  const getPoint = (value: number, index: number) => {
    const r = (value / 100) * radius;
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle)
    };
  };

  const userPoints = stats.map((s, i) => getPoint(s.userValue, i));
  const refPoints = stats.map((s, i) => getPoint(s.referenceValue, i));

  const userPath = userPoints.map(p => `${p.x},${p.y}`).join(' ');
  const refPath = refPoints.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      <div className="relative w-full max-w-[500px] aspect-square">
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full overflow-visible">
          {/* Background circles */}
          {[0.2, 0.4, 0.6, 0.8, 1].map((scale, i) => (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius * scale}
              fill="none"
              stroke={isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}
              strokeWidth="1"
            />
          ))}

          {/* Axes */}
          {stats.map((s, i) => {
            const point = getPoint(100, i);
            return (
              <g key={s.id}>
                <line
                  x1={center}
                  y1={center}
                  x2={point.x}
                  y2={point.y}
                  stroke={isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}
                  strokeWidth="1"
                />
                <text
                  x={point.x + (point.x - center) * 0.15}
                  y={point.y + (point.y - center) * 0.15}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-black uppercase tracking-widest"
                  fill={s.color}
                >
                  {s.name}
                </text>
              </g>
            );
          })}

          {/* Reference Polygon */}
          {hasReference && (
            <motion.polygon
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              points={refPath}
              fill="rgba(148, 163, 184, 0.1)"
              stroke="#94a3b8"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
          )}

          {/* User Polygon */}
          <motion.polygon
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            points={userPath}
            fill="rgba(99, 102, 241, 0.2)"
            stroke="#6366f1"
            strokeWidth="3"
            strokeLinejoin="round"
          />

          {/* Data Points */}
          {userPoints.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="#6366f1"
              className="shadow-lg"
            />
          ))}
        </svg>

        {/* Legend */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
              Perfil Actual
            </span>
          </div>
          {hasReference && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-slate-400 border-dashed" />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                Referencia
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Analysis Summary */}
      <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
        {stats.slice(0, 3).map(s => (
          <div key={s.id} className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                {s.name}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {s.userValue}%
              </span>
              {hasReference && (
                <span className={`text-xs font-bold ${s.gap >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  {s.gap > 0 ? `+${s.gap}` : s.gap}% vs ref
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
