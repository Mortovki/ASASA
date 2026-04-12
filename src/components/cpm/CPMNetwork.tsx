import React, { useRef, useState, useEffect } from 'react';
import { Task } from '../../types/criticalPath';
import { motion } from 'motion/react';

interface CPMNetworkProps {
  tasks: Task[];
  showCriticalPath?: boolean;
  onSelectTask?: (id: string) => void;
  selectedTaskId?: string | null;
  isDarkMode?: boolean;
}

const NW = 160;
const NH = 90;

export const CPMNetwork: React.FC<CPMNetworkProps> = ({ 
  tasks, 
  showCriticalPath = true, 
  onSelectTask,
  selectedTaskId,
  isDarkMode
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 0.8 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Simple layout algorithm if x/y are missing
  const positionedTasks = React.useMemo(() => {
    const layers: { [key: string]: number } = {};
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    
    const getLayer = (id: string): number => {
      if (layers[id] !== undefined) return layers[id];
      const task = taskMap.get(id);
      if (!task || !task.dependencies || task.dependencies.length === 0) {
        layers[id] = 0;
        return 0;
      }
      const depLayers = task.dependencies.map(depId => getLayer(depId));
      const layer = Math.max(...depLayers) + 1;
      layers[id] = layer;
      return layer;
    };

    tasks.forEach(t => getLayer(t.id));

    const layerCounts: { [key: number]: number } = {};
    return tasks.map(t => {
      const layer = layers[t.id] || 0;
      const index = layerCounts[layer] || 0;
      layerCounts[layer] = index + 1;
      
      return {
        ...t,
        x: t.x ?? (layer * (NW + 100) + 60),
        y: t.y ?? (index * (NH + 60) + 60)
      };
    });
  }, [tasks]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-task-id]')) return;
    setIsPanning(true);
    setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setTransform(prev => ({
      ...prev,
      x: e.clientX - startPos.x,
      y: e.clientY - startPos.y
    }));
  };

  const handleMouseUp = () => setIsPanning(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const scaleFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(2.5, Math.max(0.2, transform.scale * scaleFactor));
    
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      setTransform(prev => ({
        scale: newScale,
        x: mx - scaleFactor * (mx - prev.x),
        y: my - scaleFactor * (my - prev.y)
      }));
    }
  };

  const fitView = () => {
    if (positionedTasks.length === 0 || !svgRef.current) return;
    
    const minX = Math.min(...positionedTasks.map(t => t.x!)) - 40;
    const minY = Math.min(...positionedTasks.map(t => t.y!)) - 40;
    const maxX = Math.max(...positionedTasks.map(t => t.x! + NW)) + 40;
    const maxY = Math.max(...positionedTasks.map(t => t.y! + NH)) + 40;
    
    const rect = svgRef.current.getBoundingClientRect();
    const width = maxX - minX;
    const height = maxY - minY;
    
    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const newScale = Math.min(scaleX, scaleY, 1) * 0.9;
    
    setTransform({
      scale: newScale,
      x: (rect.width - width * newScale) / 2 - minX * newScale,
      y: (rect.height - height * newScale) / 2 - minY * newScale
    });
  };

  useEffect(() => {
    fitView();
  }, [positionedTasks.length]);

  return (
    <div className={`relative w-full h-full overflow-hidden rounded-3xl border shadow-inner ${isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-slate-50 border-slate-200'}`}>
      <div className={`absolute top-4 right-4 z-10 flex gap-2 backdrop-blur-sm p-1.5 rounded-2xl border shadow-sm ${isDarkMode ? 'bg-[#1a1a1a]/80 border-white/10' : 'bg-white/80 border-slate-200'}`}>
        <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(2.5, p.scale * 1.2) }))} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-600'}`}><Plus size={16} /></button>
        <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.2, p.scale * 0.8) }))} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-600'}`}><Minus size={16} /></button>
        <button onClick={fitView} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-600'}`}><RotateCcw size={16} /></button>
      </div>

      <svg 
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker id="arrow-crit" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3z" fill="#ef4444" />
          </marker>
          <marker id="arrow-normal" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3z" fill="#6366f1" />
          </marker>
          <marker id="arrow-slack" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3z" fill="#f59e0b" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Edges */}
          {positionedTasks.map(task => (
            Array.from(new Set(task.dependencies || [])).map(depId => {
              const dep = positionedTasks.find(t => t.id === depId);
              if (!dep) return null;
              
              const isCrit = showCriticalPath && task.isCritical && dep.isCritical && dep.earlyFinish === task.earlyStart;
              const hasSlack = !isCrit && (task.slack! > 0 || dep.slack! > 0);
              
              const x1 = dep.x! + NW;
              const y1 = dep.y! + NH / 2;
              const x2 = task.x!;
              const y2 = task.y! + NH / 2;
              
              const color = isCrit ? '#ef4444' : hasSlack ? '#f59e0b' : '#6366f1';
              const marker = isCrit ? 'arrow-crit' : hasSlack ? 'arrow-slack' : 'arrow-normal';
              
              return (
                <path
                  key={`${depId}-${task.id}`}
                  d={`M${x1},${y1} C${x1 + 40},${y1} ${x2 - 40},${y2} ${x2},${y2}`}
                  fill="none"
                  stroke={color}
                  strokeWidth={isCrit ? 2.5 : 1.5}
                  strokeDasharray={hasSlack && !isCrit ? '6 4' : 'none'}
                  markerEnd={`url(#${marker})`}
                  opacity={0.6}
                />
              );
            })
          ))}

          {/* Nodes */}
          {positionedTasks.map(task => {
            const isCrit = showCriticalPath && task.isCritical;
            const isSelected = selectedTaskId === task.id;
            const color = task.color || '#6366f1';
            
            return (
              <g 
                key={task.id} 
                transform={`translate(${task.x}, ${task.y})`}
                className="cursor-pointer select-none"
                onClick={() => onSelectTask?.(task.id)}
                data-task-id={task.id}
              >
                {/* Shadow/Glow */}
                {isSelected && (
                  <rect 
                    x="-4" y="-4" width={NW + 8} height={NH + 8} rx="14" 
                    fill="none" stroke="#6366f1" strokeWidth="3" opacity="0.4"
                  />
                )}
                
                {/* Main Card */}
                <rect 
                  width={NW} height={NH} rx="12" 
                  fill={isDarkMode ? '#1a1a1a' : 'white'} 
                  stroke={isCrit ? '#ef4444' : isSelected ? '#6366f1' : (isDarkMode ? '#333' : '#e2e8f0')} 
                  strokeWidth={isCrit || isSelected ? 2.5 : 1.5}
                  className="shadow-sm"
                />
                
                {/* Header Bar */}
                <path 
                  d={`M8,0 h${NW-16} a8,8 0 0 1 8,8 v2 h-${NW} v-2 a8,8 0 0 1 8,-8 z`} 
                  fill={color} 
                />

                {/* ES | LS */}
                <text x="10" y="24" fontSize="10" fontWeight="800" fill="#6366f1" fontFamily="monospace">{task.earlyStart}</text>
                <text x={NW - 10} y="24" fontSize="10" fontWeight="800" fill={isCrit ? '#ef4444' : '#f59e0b'} textAnchor="end" fontFamily="monospace">{task.lateStart}</text>
                
                <line x1="0" y1="30" x2={NW} y2="30" stroke={isDarkMode ? '#333' : '#f1f5f9'} strokeWidth="1" />

                {/* Title */}
                <text x={NW / 2} y="46" fontSize="11" fontWeight="700" fill={isDarkMode ? '#fff' : '#1e293b'} textAnchor="middle">
                  {task.title.length > 22 ? task.title.slice(0, 20) + '...' : task.title}
                </text>

                {/* Duration | Effort */}
                <text x={NW / 2} y="60" fontSize="9" fontWeight="600" fill={isDarkMode ? '#64748b' : '#94a3b8'} textAnchor="middle">
                  {task.duration}d · <tspan fill="#f59e0b">{task.effort || 0}p·s</tspan>
                </text>

                <line x1="0" y1="68" x2={NW} y2="68" stroke={isDarkMode ? '#333' : '#f1f5f9'} strokeWidth="1" />

                {/* EF | LF | Slack */}
                <text x="10" y="82" fontSize="10" fontWeight="800" fill="#6366f1" fontFamily="monospace">{task.earlyFinish}</text>
                <text x={NW / 2} y="82" fontSize="10" fontWeight="800" fill={isCrit ? '#ef4444' : '#f59e0b'} textAnchor="middle" fontFamily="monospace">{task.lateFinish}</text>
                <text x={NW - 10} y="82" fontSize="10" fontWeight="800" fill={isCrit ? '#ef4444' : '#f59e0b'} textAnchor="end" fontFamily="monospace">H:{task.slack}</text>

                {/* Effort Progress Bar */}
                <rect x="0" y={NH - 4} width={NW} height="4" rx="2" fill={isDarkMode ? '#333' : '#f1f5f9'} />
                <rect x="0" y={NH - 4} width={NW * Math.min(1, (task.effort || 0) / 20)} height="4" rx="2" fill={color} />
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};

import { Plus, Minus, RotateCcw } from 'lucide-react';
