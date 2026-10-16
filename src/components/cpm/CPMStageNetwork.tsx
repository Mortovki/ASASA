import React, { useRef, useState, useEffect } from 'react';
import { StageCPM } from '../../types/criticalPath';
import { Plus, Minus, RotateCcw, AlertTriangle, Layers, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface CPMStageNetworkProps {
  stages: StageCPM[];
  onSelectStage?: (id: string) => void;
  selectedStageId?: string | null;
  isDarkMode?: boolean;
}

const STAGE_NW = 210;
const STAGE_NH = 110;

export const CPMStageNetwork: React.FC<CPMStageNetworkProps> = ({
  stages,
  onSelectStage,
  selectedStageId,
  isDarkMode = false
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [transform, setTransform] = useState({ x: 40, y: 40, scale: 0.85 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });

  // Compute hierarchical layout based on stage predecessors
  const positionedStages = React.useMemo(() => {
    if (!stages || stages.length === 0) return [];

    const layers: { [key: string]: number } = {};
    const stageMap = new Map(stages.map(s => [s.id, s]));

    const getLayer = (id: string, visited = new Set<string>()): number => {
      if (visited.has(id)) return 0;
      if (layers[id] !== undefined) return layers[id];
      visited.add(id);

      const stage = stageMap.get(id);
      if (!stage || !stage.predecessors || stage.predecessors.length === 0) {
        layers[id] = 0;
        return 0;
      }

      const depLayers = stage.predecessors.map(predId => getLayer(predId, new Set(visited)));
      const layer = (depLayers.length > 0 ? Math.max(...depLayers) : -1) + 1;
      layers[id] = layer;
      return layer;
    };

    stages.forEach(s => getLayer(s.id));

    const layerCounts: { [key: number]: number } = {};
    return stages.map(s => {
      const layer = layers[s.id] || 0;
      const index = layerCounts[layer] || 0;
      layerCounts[layer] = index + 1;

      return {
        ...s,
        x: layer * (STAGE_NW + 110) + 60,
        y: index * (STAGE_NH + 80) + 60
      };
    });
  }, [stages]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-stage-id]')) return;
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
    if (positionedStages.length === 0 || !svgRef.current) return;

    const minX = Math.min(...positionedStages.map(s => s.x)) - 40;
    const minY = Math.min(...positionedStages.map(s => s.y)) - 40;
    const maxX = Math.max(...positionedStages.map(s => s.x + STAGE_NW)) + 40;
    const maxY = Math.max(...positionedStages.map(s => s.y + STAGE_NH)) + 40;

    const rect = svgRef.current.getBoundingClientRect();
    const width = Math.max(maxX - minX, 100);
    const height = Math.max(maxY - minY, 100);

    const scaleX = rect.width / width;
    const scaleY = rect.height / height;
    const newScale = Math.min(scaleX, scaleY, 1) * 0.88;

    setTransform({
      scale: Math.max(0.3, newScale),
      x: (rect.width - width * newScale) / 2 - minX * newScale,
      y: (rect.height - height * newScale) / 2 - minY * newScale
    });
  };

  useEffect(() => {
    fitView();
  }, [positionedStages.length]);

  return (
    <div className={`relative w-full h-full min-h-[460px] overflow-hidden rounded-3xl border shadow-inner flex flex-col ${
      isDarkMode ? 'bg-[#0a0a0a] border-white/5' : 'bg-slate-50 border-slate-200'
    }`}>
      {/* Zoom / Pan Controls */}
      <div className={`absolute top-4 right-4 z-10 flex gap-2 backdrop-blur-sm p-1.5 rounded-2xl border shadow-sm ${
        isDarkMode ? 'bg-[#1a1a1a]/80 border-white/10' : 'bg-white/80 border-slate-200'
      }`}>
        <button 
          onClick={() => setTransform(p => ({ ...p, scale: Math.min(2.5, p.scale * 1.2) }))} 
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Zoom in"
        >
          <Plus size={16} />
        </button>
        <button 
          onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.2, p.scale * 0.8) }))} 
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Zoom out"
        >
          <Minus size={16} />
        </button>
        <button 
          onClick={fitView} 
          className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/5 text-gray-400' : 'hover:bg-slate-100 text-slate-600'}`}
          title="Ajustar al lienzo"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      {/* SVG Canvas */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing flex-1"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <defs>
          <marker id="stage-arrow-crit" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3z" fill="#ef4444" />
          </marker>
          <marker id="stage-arrow-norm" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3z" fill="#6366f1" />
          </marker>
          <pattern id="stage-dot-grid" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1" fill={isDarkMode ? '#333' : '#cbd5e1'} />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#stage-dot-grid)" />

        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
          {/* Connector Links Between Predecessors and Successors */}
          {positionedStages.map(stage => {
            if (!stage.predecessors || stage.predecessors.length === 0) return null;

            return stage.predecessors.map(predId => {
              const predStage = positionedStages.find(s => s.id === predId);
              if (!predStage) return null;

              const startX = predStage.x + STAGE_NW;
              const startY = predStage.y + STAGE_NH / 2;
              const endX = stage.x;
              const endY = stage.y + STAGE_NH / 2;

              const dx = endX - startX;
              const controlX1 = startX + dx * 0.45;
              const controlX2 = startX + dx * 0.55;

              const isCriticalConn = stage.isCritical && predStage.isCritical;

              return (
                <g key={`${predId}-${stage.id}`}>
                  <path
                    d={`M ${startX} ${startY} C ${controlX1} ${startY}, ${controlX2} ${endY}, ${endX} ${endY}`}
                    fill="none"
                    stroke={isCriticalConn ? '#ef4444' : (isDarkMode ? '#6366f1' : '#818cf8')}
                    strokeWidth={isCriticalConn ? 3 : 2}
                    strokeDasharray={isCriticalConn ? 'none' : '4 3'}
                    markerEnd={`url(#${isCriticalConn ? 'stage-arrow-crit' : 'stage-arrow-norm'})`}
                  />
                </g>
              );
            });
          })}

          {/* Stage CPM Nodes */}
          {positionedStages.map(stage => {
            const isSelected = selectedStageId === stage.id;
            const isCrit = stage.isCritical;

            return (
              <g
                key={stage.id}
                data-stage-id={stage.id}
                transform={`translate(${stage.x}, ${stage.y})`}
                onClick={() => onSelectStage?.(stage.id)}
                className="cursor-pointer group"
              >
                {/* Node Box */}
                <rect
                  width={STAGE_NW}
                  height={STAGE_NH}
                  rx="16"
                  fill={isDarkMode ? '#1a1a1a' : '#ffffff'}
                  stroke={isSelected ? '#6366f1' : (isCrit ? '#ef4444' : (isDarkMode ? '#2d2d2d' : '#e2e8f0'))}
                  strokeWidth={isSelected ? 3 : (isCrit ? 2.5 : 1.5)}
                  className="transition-all duration-200 group-hover:filter group-hover:brightness-105"
                  filter={isCrit ? 'drop-shadow(0 4px 10px rgba(239,68,68,0.2))' : 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))'}
                />

                {/* Top Accent Band with Stage Color */}
                <path
                  d={`M 0 16 A 16 16 0 0 1 16 0 L ${STAGE_NW - 16} 0 A 16 16 0 0 1 ${STAGE_NW} 16 L ${STAGE_NW} 24 L 0 24 Z`}
                  fill={stage.color || '#3b82f6'}
                />

                {/* Stage Title */}
                <text
                  x={12}
                  y={16}
                  fill="#ffffff"
                  fontSize="10"
                  fontWeight="bold"
                  className="select-none tracking-wider uppercase"
                >
                  {stage.name.length > 20 ? `${stage.name.slice(0, 18)}...` : stage.name}
                </text>

                {/* CPM Top Row: Early Start (ES) | Duration (D) | Early Finish (EF) */}
                <g transform="translate(10, 32)">
                  <rect width="60" height="28" rx="6" fill={isDarkMode ? '#222' : '#f8fafc'} />
                  <text x="30" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isDarkMode ? '#888' : '#64748b'}>ES</text>
                  <text x="30" y="24" textAnchor="middle" fontSize="10" fontWeight="black" fill={isDarkMode ? '#fff' : '#0f172a'}>D{stage.earlyStart ?? 0}</text>

                  <rect x="65" width="60" height="28" rx="6" fill={isDarkMode ? '#262626' : '#f1f5f9'} />
                  <text x="95" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isDarkMode ? '#888' : '#64748b'}>DUR</text>
                  <text x="95" y="24" textAnchor="middle" fontSize="10" fontWeight="black" fill={isDarkMode ? '#fff' : '#0f172a'}>{stage.duration}d</text>

                  <rect x="130" width="60" height="28" rx="6" fill={isDarkMode ? '#222' : '#f8fafc'} />
                  <text x="160" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isDarkMode ? '#888' : '#64748b'}>EF</text>
                  <text x="160" y="24" textAnchor="middle" fontSize="10" fontWeight="black" fill={isDarkMode ? '#fff' : '#0f172a'}>D{stage.earlyFinish ?? stage.duration}</text>
                </g>

                {/* CPM Bottom Row: Late Start (LS) | Slack (Holgura) | Late Finish (LF) */}
                <g transform="translate(10, 66)">
                  <rect width="60" height="28" rx="6" fill={isDarkMode ? '#222' : '#f8fafc'} />
                  <text x="30" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isDarkMode ? '#888' : '#64748b'}>LS</text>
                  <text x="30" y="24" textAnchor="middle" fontSize="10" fontWeight="black" fill={isDarkMode ? '#fff' : '#0f172a'}>D{stage.lateStart ?? 0}</text>

                  {/* Slack (Holgura) */}
                  <rect 
                    x="65" 
                    width="60" 
                    height="28" 
                    rx="6" 
                    fill={isCrit ? (isDarkMode ? '#450a0a' : '#fee2e2') : (isDarkMode ? '#262626' : '#f1f5f9')} 
                  />
                  <text x="95" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isCrit ? '#ef4444' : (isDarkMode ? '#888' : '#64748b')}>
                    {isCrit ? 'CRÍTICA' : 'HOLGURA'}
                  </text>
                  <text 
                    x="95" 
                    y="24" 
                    textAnchor="middle" 
                    fontSize="10" 
                    fontWeight="black" 
                    fill={isCrit ? '#ef4444' : '#10b981'}
                  >
                    H={stage.slack ?? 0}d
                  </text>

                  <rect x="130" width="60" height="28" rx="6" fill={isDarkMode ? '#222' : '#f8fafc'} />
                  <text x="160" y="12" textAnchor="middle" fontSize="8" fontWeight="bold" fill={isDarkMode ? '#888' : '#64748b'}>LF</text>
                  <text x="160" y="24" textAnchor="middle" fontSize="10" fontWeight="black" fill={isDarkMode ? '#fff' : '#0f172a'}>D{stage.lateFinish ?? stage.duration}</text>
                </g>

                {/* Critical Badge Tag */}
                {isCrit && (
                  <g transform={`translate(${STAGE_NW - 54}, -8)`}>
                    <rect width="48" height="16" rx="8" fill="#ef4444" />
                    <text x="24" y="11" textAnchor="middle" fontSize="8" fontWeight="black" fill="#ffffff">RUTA CRÍTICA</text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
};
