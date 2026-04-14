import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize, ZoomIn, ZoomOut, AlertTriangle, CheckCircle2, Clock, List, LayoutGrid, Activity, Trash2 } from 'lucide-react';
import TaskSidePanel from './TaskSidePanel';
import { computeCriticalPath } from '../utils/criticalPath';
import { Task } from '../types/task';
import { SlackChip } from './ui/SlackChip';
import { StatusBadge } from './ui/StatusBadge';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useGanttDrag } from '../hooks/useGanttDrag';
import { GanttBar } from './gantt/GanttBar';
import { formatName } from '../utils/formatters';

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 60;

import { KANBAN_COLUMNS } from '../config/kanbanColumns';

const GanttView = ({ 
  tasks, 
  projectId, 
  project, 
  userRole, 
  currentUser, 
  students,
  updateTaskStatus,
  updateTaskField,
  updateTaskDates,
  deleteTask,
  permissions,
  isDarkMode
}: any) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [scale, setScale] = useState<'days' | 'weeks' | 'months'>('days');
  const { isMobile } = useBreakpoint();
  
  // Drag to scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - containerRef.current.offsetLeft);
    setScrollLeft(containerRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll-fast
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Global mouse events for task dragging removed as they are handled by useGanttDrag

  const DAY_WIDTH = useMemo(() => {
    switch (scale) {
      case 'days': return 40;
      case 'weeks': return 15;
      case 'months': return 5;
      default: return 40;
    }
  }, [scale]);

  const {
    containerRef,
    dragging,
    preview,
    startDrag
  } = useGanttDrag(tasks, DAY_WIDTH, updateTaskDates);

  // Compute CPM
  const filteredTasks = useMemo(() => {
    const unique = Array.from(new Map(tasks.map(t => [t.id, t])).values());
    return unique.filter((t: any) => t.status !== 'pending_approval' && t.status !== 'rejected');
  }, [tasks]);

  const cpmTasks = useMemo(() => {
    try {
      return computeCriticalPath(filteredTasks as any) as any[];
    } catch (e) {
      console.error("Error computing CPM:", e);
      return filteredTasks as any[];
    }
  }, [filteredTasks]);

  const { minDate, maxDate, totalDays, groupedTasks } = useMemo(() => {
    if (!cpmTasks || cpmTasks.length === 0) {
      return { minDate: new Date(), maxDate: new Date(), totalDays: 30, groupedTasks: {} };
    }

    let min = new Date(cpmTasks[0].startDate || new Date());
    let max = new Date(cpmTasks[0].endDate || new Date());

    const groups: Record<string, Task[]> = {};

    cpmTasks.forEach((t: any) => {
      const start = new Date(t.startDate || new Date());
      const end = new Date(t.endDate || new Date());
      if (start < min) min = start;
      if (end > max) max = end;

      const groupKey = t.stageId || t.phase || 'Sin Fase';
      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(t);
    });

    // Adjust min/max based on scale to ensure full weeks/months are visible
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);

    if (scale === 'weeks' || scale === 'months') {
      // Start at the beginning of the week (Sunday)
      min.setDate(min.getDate() - min.getDay());
    }
    if (scale === 'months') {
      // Start at the beginning of the month
      min.setDate(1);
    }

    const diffTime = Math.abs(max.getTime() - min.getTime());
    const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    });

    return { minDate: min, maxDate: max, totalDays, groupedTasks: groups };
  }, [cpmTasks, scale]);

  const handleAutoFit = () => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  };

  const todayLineLeft = useMemo(() => {
    const today = new Date();
    if (today < minDate || today > maxDate) return -1;
    const diff = Math.ceil((today.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    return diff * DAY_WIDTH;
  }, [minDate, maxDate, DAY_WIDTH]);

  const dates = useMemo(() => {
    const d = [];
    let current = new Date(minDate);
    for (let i = 0; i < totalDays; i++) {
      d.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return d;
  }, [minDate, totalDays]);

  // Helper to get task coordinates for dependency lines
  const getTaskCoordinates = useMemo(() => {
    const coords: Record<string, { xStart: number, xEnd: number, y: number }> = {};
    let yIndex = 0;
    
    for (const [phase, phaseTasks] of Object.entries(groupedTasks)) {
      yIndex += 1; // Phase header
      for (let i = 0; i < phaseTasks.length; i++) {
        const task = phaseTasks[i];
        const start = new Date(task.startDate || new Date());
        const end = new Date(task.endDate || new Date());
        const diffStart = Math.ceil((start.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
        const duration = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 1;
        
        coords[task.id] = {
          xStart: diffStart * DAY_WIDTH,
          xEnd: (diffStart + duration) * DAY_WIDTH,
          y: HEADER_HEIGHT + yIndex * ROW_HEIGHT + (ROW_HEIGHT / 2)
        };
        yIndex += 1;
      }
    }
    return coords;
  }, [groupedTasks, minDate, DAY_WIDTH]);

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Mobile View: List of tasks prioritized by critical path
  if (isMobile) {
    const sortedTasks = [...cpmTasks].sort((a, b) => {
      if (a.isCritical && !b.isCritical) return -1;
      if (!a.isCritical && b.isCritical) return 1;
      return (a.slack || 0) - (b.slack || 0);
    });

    return (
      <div className={`h-full flex flex-col ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-50'}`}>
        <div className={`p-4 border-b flex justify-between items-center sticky top-0 z-10 ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
          <div>
            <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Cronograma</h3>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Vista Móvil (CPM)</p>
          </div>
          <button className={`p-2 rounded-full ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <Activity size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {sortedTasks.map(task => {
            const assignedStudent = students?.find((s: any) => s.id === task.assignedTo);
            const initials = assignedStudent ? `${assignedStudent.firstName.charAt(0)}${assignedStudent.lastNamePaterno.charAt(0)}` : '?';
            
            return (
              <div 
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className={`p-4 rounded-2xl border-2 shadow-sm transition-all active:scale-95 ${isDarkMode ? 'bg-white/5' : 'bg-white'} ${task.isCritical ? (isDarkMode ? 'border-red-500/30' : 'border-red-200') : (isDarkMode ? 'border-white/10' : 'border-slate-100')}`}
              >
                <div className="flex justify-between items-start mb-3">
                  <h4 className={`font-bold text-sm leading-tight pr-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{task.title}</h4>
                  <StatusBadge status={task.status} size="sm" />
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'}`}>
                    {initials}
                  </div>
                  <span className={`text-xs font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>{assignedStudent ? formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno) : 'Sin asignar'}</span>
                </div>

                <div className={`flex flex-wrap gap-2 items-center justify-between mt-4 border-t pt-3 ${isDarkMode ? 'border-white/10' : 'border-slate-50'}`}>
                  <div className={`text-xs font-medium flex items-center gap-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    <Clock size={12} />
                    {new Date(task.startDate).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })} - {new Date(task.endDate).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-2">
                    <SlackChip slack={task.slack || 0} isCritical={task.isCritical || false} />
                    {permissions?.canDeleteTask && (
                      <button
                        onClick={(e) => handleDeleteTask(task.id, e)}
                        className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                        title="Eliminar tarea"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <AnimatePresence>
          {selectedTaskId && (
            <TaskSidePanel 
              key={selectedTaskId}
              taskId={selectedTaskId} 
              projectId={projectId} 
              onClose={() => setSelectedTaskId(null)} 
              userRole={userRole}
              currentUser={currentUser}
              students={students}
              deleteTask={deleteTask}
              isDarkMode={isDarkMode}
            />
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Desktop / Tablet View
  return (
    <div className={`h-full flex flex-col rounded-3xl shadow-sm border overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
      {/* Toolbar */}
      <div className={`p-4 border-b flex justify-between items-center ${isDarkMode ? 'border-white/10 bg-[#1a1a1a]' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center gap-4">
          <div className={`flex rounded-xl border p-1 shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
            <button onClick={() => setScale('days')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${scale === 'days' ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')}`}>Días</button>
            <button onClick={() => setScale('weeks')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${scale === 'weeks' ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')}`}>Semanas</button>
            <button onClick={() => setScale('months')} className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-colors ${scale === 'months' ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')}`}>Meses</button>
          </div>
        </div>
        <button onClick={handleAutoFit} className={`flex items-center gap-2 text-xs font-bold transition-colors border px-4 py-2 rounded-xl shadow-sm ${isDarkMode ? 'text-gray-300 hover:text-indigo-400 bg-white/5 border-white/10' : 'text-slate-600 hover:text-indigo-600 bg-white border-slate-200'}`}>
          <Maximize size={16} /> Auto Fit
        </button>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel (Task List) */}
        <div className={`hidden sm:flex flex-col border-r z-20 shrink-0 ${isDarkMode ? 'border-white/10 bg-[#1a1a1a]' : 'border-slate-200 bg-white'}`} style={{ width: 'clamp(200px, 30vw, 320px)' }}>
          <div className={`h-[60px] border-b flex items-center px-4 shrink-0 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
            <span className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Tareas</span>
          </div>
          <div className="flex-1 overflow-y-auto hide-scrollbar" id="gantt-left-panel" onScroll={(e) => {
            const rightPanel = document.getElementById('gantt-right-panel');
            if (rightPanel) rightPanel.scrollTop = e.currentTarget.scrollTop;
          }}>
            {Object.entries(groupedTasks).map(([groupKey, phaseTasks]) => {
              const stage = project?.stages?.find((s: any) => s.id === groupKey);
              const displayName = stage ? stage.name : groupKey;
              const isStage = !!stage;

              return (
                <React.Fragment key={groupKey}>
                  <div className={`h-12 border-b flex items-center px-4 sticky top-0 z-10 gap-2 ${isDarkMode ? 'border-white/5 bg-[#1a1a1a]/90' : 'border-slate-100 bg-slate-50/80'}`}>
                    <div className={`w-1 h-3 rounded-full ${isStage ? '' : (isDarkMode ? 'bg-gray-600' : 'bg-slate-300')}`} style={isStage ? { backgroundColor: stage.color } : {}} />
                    <span className={`text-[10px] font-black uppercase tracking-widest truncate ${isDarkMode ? 'text-gray-400' : 'text-slate-700'}`}>{displayName}</span>
                  </div>
                  {phaseTasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`h-12 border-b flex items-center px-4 cursor-pointer transition-colors group ${isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'}`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className={`text-xs font-bold truncate transition-colors ${isDarkMode ? 'text-gray-300 group-hover:text-indigo-400' : 'text-slate-900 group-hover:text-indigo-600'}`}>{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`w-2 h-2 rounded-full ${task.isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <span className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{task.duration}d</span>
                        </div>
                      </div>
                      {permissions?.canDeleteTask && (
                        <button
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className={`opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1.5 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                          title="Eliminar tarea"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right Panel (Timeline) */}
        <div 
          className={`flex-1 overflow-auto relative hide-scrollbar ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
          id="gantt-right-panel" 
          ref={containerRef} 
          onScroll={(e) => {
            const leftPanel = document.getElementById('gantt-left-panel');
            if (leftPanel) leftPanel.scrollTop = e.currentTarget.scrollTop;
          }}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
        >
          <div style={{ width: totalDays * DAY_WIDTH, minHeight: '100%' }} className="relative">
            
            {/* Grid Background */}
            <svg width="100%" height="100%" className="absolute top-0 left-0 pointer-events-none">
              <defs>
                <pattern id="grid" width={DAY_WIDTH} height={ROW_HEIGHT} patternUnits="userSpaceOnUse">
                  <path d={`M ${DAY_WIDTH} 0 L 0 0 0 ${ROW_HEIGHT}`} fill="none" stroke={isDarkMode ? '#333' : '#f8fafc'} strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Dependency Lines */}
              {cpmTasks.map(task => {
                const uniqueDeps = Array.from(new Set(task.dependencies || []));
                if (uniqueDeps.length === 0) return null;
                const toCoords = getTaskCoordinates[task.id];
                if (!toCoords) return null;

                return (
                  <g key={`deps-${task.id}`}>
                    {uniqueDeps.map((depId: string, depIdx) => {
                      const fromCoords = getTaskCoordinates[depId];
                      if (!fromCoords) return null;

                      // Draw a path from the end of the dependency to the start of the task
                      const startX = fromCoords.xEnd;
                      const startY = fromCoords.y;
                      const endX = toCoords.xStart;
                      const endY = toCoords.y;
                      
                      // Simple elbow routing
                      const midX = startX + 10;
                      const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                      
                      // If the task is critical and the dependency is critical, color the line red
                      const depTask = cpmTasks.find(t => t.id === depId);
                      const isCriticalPath = task.isCritical && depTask?.isCritical;

                      return (
                        <g key={`${depId}-${task.id}-${depIdx}`}>
                          <path 
                            d={path} 
                            fill="none" 
                            stroke={isCriticalPath ? '#ef4444' : '#94a3b8'} 
                            strokeWidth={isCriticalPath ? 2 : 1.5}
                            strokeDasharray={isCriticalPath ? 'none' : '4 2'}
                          />
                          <polygon 
                            points={`${endX},${endY - 4} ${endX + 6},${endY} ${endX},${endY + 4}`} 
                            fill={isCriticalPath ? '#ef4444' : '#94a3b8'} 
                          />
                        </g>
                      );
                    })}
                  </g>
                );
              })}

              {/* Today Line */}
              {todayLineLeft >= 0 && (
                <line x1={todayLineLeft} y1={0} x2={todayLineLeft} y2="100%" stroke="#ef4444" strokeWidth="2" strokeDasharray="4 4" />
              )}
            </svg>

            {/* Header Dates */}
            <div className={`absolute top-0 left-0 h-[60px] flex border-b z-10 sticky top-0 ${isDarkMode ? 'border-white/10 bg-[#1a1a1a]/95 backdrop-blur-sm' : 'border-slate-200 bg-white/95 backdrop-blur-sm'}`}>
              {dates.map((date, i) => {
                // Render logic based on scale
                if (scale === 'months') {
                  if (date.getDate() === 1) {
                    return (
                      <div key={`month-${date.getTime()}-${i}`} className={`absolute h-full flex items-end pb-2 border-l pl-2 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`} style={{ left: i * DAY_WIDTH, width: 30 * DAY_WIDTH }}>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}</span>
                      </div>
                    );
                  }
                  return null;
                }
                
                if (scale === 'weeks') {
                  if (date.getDay() === 1) { // Monday
                    return (
                      <div key={`week-${date.getTime()}-${i}`} className={`absolute h-full flex flex-col justify-end pb-2 border-l pl-2 ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`} style={{ left: i * DAY_WIDTH, width: 7 * DAY_WIDTH }}>
                        <span className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Semana</span>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{date.getDate()} {date.toLocaleDateString('es-MX', { month: 'short' })}</span>
                      </div>
                    );
                  }
                  return null;
                }

                // Days scale
                return (
                  <div key={`day-${date.getTime()}-${i}`} className={`flex flex-col items-center justify-end pb-2 border-r shrink-0 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`} style={{ width: DAY_WIDTH }}>
                    <span className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{date.toLocaleDateString('es-MX', { weekday: 'short' }).charAt(0)}</span>
                    <span className={`text-xs font-bold ${date.getDay() === 0 || date.getDay() === 6 ? (isDarkMode ? 'text-gray-600' : 'text-slate-300') : (isDarkMode ? 'text-gray-300' : 'text-slate-700')}`}>{date.getDate()}</span>
                  </div>
                );
              })}
            </div>

            {/* Tasks Bars */}
            <div className="pt-[60px] w-full">
              {Object.entries(groupedTasks).map(([groupKey, phaseTasks]) => (
                <React.Fragment key={groupKey}>
                  {/* Phase Spacer */}
                  <div className={`h-12 w-full border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100/50'}`} />
                  
                  {phaseTasks.map((task: any) => {
                    const coords = getTaskCoordinates[task.id];
                    if (!coords) return null;
                    
                    const left = coords.xStart;
                    const width = coords.xEnd - coords.xStart;

                    const statusConfig = KANBAN_COLUMNS.find(c => c.id === task.status);
                    const baseColor = statusConfig?.color || 'bg-slate-500';

                    const canEdit = permissions?.canEditTask && (userRole === 'admin' || task.assignedTo === currentUser?.uid);

                    return (
                      <div key={task.id} className="h-12 border-b border-transparent relative group">
                        <GanttBar
                          task={task}
                          left={left}
                          width={width}
                          dayWidth={DAY_WIDTH}
                          isDragging={dragging?.taskId === task.id}
                          dragMode={dragging?.taskId === task.id ? dragging.mode : undefined}
                          preview={preview[task.id]}
                          onStartDrag={startDrag}
                          onClick={() => setSelectedTaskId(task.id)}
                          canEdit={canEdit}
                        />
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedTaskId && (
          <TaskSidePanel 
            key={selectedTaskId}
            taskId={selectedTaskId} 
            projectId={projectId} 
            onClose={() => setSelectedTaskId(null)} 
            userRole={userRole}
            currentUser={currentUser}
            students={students}
            updateTaskStatus={updateTaskStatus}
            updateTaskField={updateTaskField}
            deleteTask={deleteTask}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GanttView;
