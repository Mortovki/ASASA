import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Maximize, 
  ZoomIn, 
  ZoomOut, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  List, 
  LayoutGrid, 
  Activity, 
  Trash2,
  ChevronDown,
  ChevronRight,
  GitFork,
  Layers,
  Info,
  Calendar,
  X,
  Plus,
  User,
  Save,
  Check,
  ExternalLink,
  Edit3
} from 'lucide-react';
import TaskSidePanel from './TaskSidePanel';
import { computeCriticalPath } from '../utils/criticalPath';
import { Task } from '../types/task';
import { Stage } from '../types/stage';
import { SlackChip } from './ui/SlackChip';
import { StatusBadge } from './ui/StatusBadge';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { useGanttDrag } from '../hooks/useGanttDrag';
import { GanttBar } from './gantt/GanttBar';
import { GanttStageBar } from './gantt/GanttStageBar';
import { formatName } from '../utils/formatters';
import { safeFormatDate } from '../utils/dateUtils';
import { KANBAN_COLUMNS } from '../config/kanbanColumns';
import toast from 'react-hot-toast';
import { doc, updateDoc, collection, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ROW_HEIGHT = 48;
const HEADER_HEIGHT = 60;

interface StageGroupMeta {
  id: string;
  name: string;
  color: string;
  startDate: string;
  endDate: string;
  duration: number;
  description?: string | null;
  predecessors: string[];
  tasks: Task[];
  taskCount: number;
  completedCount: number;
  progressPercent: number;
  isStage: boolean;
  isCritical: boolean;
}

const GanttView = ({ 
  tasks, 
  projectId, 
  project, 
  userRole, 
  currentUser, 
  students,
  sprints = [],
  addTask,
  updateTaskStatus,
  updateTaskField,
  updateTaskFields,
  updateTaskDates,
  onSaveStages,
  deleteTask,
  permissions,
  isDarkMode
}: any) => {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedStageMeta, setSelectedStageMeta] = useState<StageGroupMeta | null>(null);
  const [scale, setScale] = useState<'days' | 'weeks' | 'months'>('days');
  const [collapsedStages, setCollapsedStages] = useState<Record<string, boolean>>({});
  const { isMobile } = useBreakpoint();

  // Stage date editing state for selectedStageMeta modal
  const [stageDates, setStageDates] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });
  const [isSavingDates, setIsSavingDates] = useState(false);

  // New task inline creation state
  const [showNewTaskForm, setShowNewTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<number>(3);
  const [newTaskType, setNewTaskType] = useState('LEVANTAMIENTO');
  const [newTaskEffort, setNewTaskEffort] = useState<number>(4);
  const [newTaskEstimatedSP, setNewTaskEstimatedSP] = useState<number>(1);
  const [newTaskStartDate, setNewTaskStartDate] = useState('');
  const [newTaskEndDate, setNewTaskEndDate] = useState('');
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const canEditStage = userRole === 'admin' || userRole === 'coordinator' || Boolean(permissions?.canEditProject);
  const canCreateTask = Boolean(permissions?.canCreateTask || userRole === 'admin' || userRole === 'coordinator');
  const canEditTask = Boolean(permissions?.canEditTask || userRole === 'admin' || userRole === 'coordinator');

  // Sync stageDates whenever selectedStageMeta opens or updates
  useEffect(() => {
    if (selectedStageMeta) {
      const sStart = (selectedStageMeta.startDate || new Date().toISOString()).split('T')[0];
      const sEnd = (selectedStageMeta.endDate || new Date().toISOString()).split('T')[0];
      setStageDates({ startDate: sStart, endDate: sEnd });
      setNewTaskStartDate(sStart);
      setNewTaskEndDate(sEnd);
      setShowNewTaskForm(false);
    }
  }, [selectedStageMeta?.id, selectedStageMeta?.startDate, selectedStageMeta?.endDate]);
  
  // Drag to scroll state
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    // Do not initiate pan-scrolling if clicking on interactive bars or controls
    if ((e.target as HTMLElement).closest('.gantt-interactive-bar, button, select, input, a')) {
      return;
    }
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
    const walk = (x - startX) * 2;
    containerRef.current.scrollLeft = scrollLeft - walk;
  };

  const DAY_WIDTH = useMemo(() => {
    switch (scale) {
      case 'days': return 40;
      case 'weeks': return 15;
      case 'months': return 5;
      default: return 40;
    }
  }, [scale]);

  const handleSaveStageDates = async (stageId: string, newStart: Date, newEnd: Date) => {
    if (!projectId) return;
    try {
      const currentStages = project?.stages || [];
      const updatedStages = currentStages.map((st: Stage) => {
        if (st.id === stageId) {
          return {
            ...st,
            startDate: newStart.toISOString(),
            endDate: newEnd.toISOString(),
            updatedAt: new Date().toISOString()
          };
        }
        return st;
      });

      if (onSaveStages) {
        await onSaveStages(updatedStages);
      } else {
        const projectRef = doc(db, 'projects', projectId);
        await updateDoc(projectRef, { stages: updatedStages });
      }
      toast.success('Fechas de la etapa actualizadas');
    } catch (err) {
      console.error('Error saving stage dates:', err);
      toast.error('Error al actualizar fechas de la etapa');
    }
  };

  const currentStageTasks = useMemo(() => {
    if (!selectedStageMeta) return [];
    return tasks.filter((t: any) => 
      (t.stageId === selectedStageMeta.id || t.phase === selectedStageMeta.name) && 
      t.status !== 'rejected' && 
      !t.deletedAt
    );
  }, [tasks, selectedStageMeta]);

  const handleSaveModalStageDates = async () => {
    if (!selectedStageMeta || !stageDates.startDate || !stageDates.endDate) return;
    if (new Date(stageDates.endDate) < new Date(stageDates.startDate)) {
      toast.error('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }
    setIsSavingDates(true);
    try {
      const newStart = new Date(`${stageDates.startDate}T00:00:00`);
      const newEnd = new Date(`${stageDates.endDate}T00:00:00`);
      await handleSaveStageDates(selectedStageMeta.id, newStart, newEnd);
      
      setSelectedStageMeta(prev => prev ? {
        ...prev,
        startDate: newStart.toISOString(),
        endDate: newEnd.toISOString(),
        duration: Math.max(1, Math.ceil((newEnd.getTime() - newStart.getTime()) / (1000 * 60 * 60 * 24)))
      } : null);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSavingDates(false);
    }
  };

  const handleCreateTaskInStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedStageMeta) {
      toast.error('Ingresa un título para la tarea');
      return;
    }
    setIsCreatingTask(true);
    try {
      const taskData: any = {
        title: newTaskTitle.trim(),
        description: '',
        status: 'todo',
        priority: newTaskPriority,
        effort: Number(newTaskEffort) || 1,
        estimatedSP: Number(newTaskEstimatedSP) || 1,
        type: newTaskType,
        assignedTo: newTaskAssignee || '',
        assignedUserName: students?.find((s: any) => s.id === newTaskAssignee)?.firstName || '',
        startDate: newTaskStartDate ? new Date(`${newTaskStartDate}T00:00:00`).toISOString() : selectedStageMeta.startDate,
        endDate: newTaskEndDate ? new Date(`${newTaskEndDate}T00:00:00`).toISOString() : selectedStageMeta.endDate,
        stageId: selectedStageMeta.id,
        phase: selectedStageMeta.name,
        dependencies: []
      };

      if (addTask) {
        await addTask(taskData);
      } else {
        const tasksRef = collection(db, 'projects', projectId, 'tasks');
        const newRef = doc(tasksRef);
        await setDoc(newRef, {
          ...taskData,
          id: newRef.id,
          projectId,
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.uid || '',
          deletedAt: null
        });
      }

      const assignedStudent = students?.find((s: any) => s.id === newTaskAssignee);
      toast.success(assignedStudent ? `Tarea creada y asignada a ${assignedStudent.firstName}` : 'Tarea creada en la etapa');
      setNewTaskTitle('');
      setShowNewTaskForm(false);
    } catch (err) {
      console.error('Error creating task in stage:', err);
      toast.error('Error al crear la tarea');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleAssignTaskInModal = async (taskId: string, newAssigneeId: string) => {
    try {
      const task = tasks.find((t: any) => t.id === taskId);
      await updateTaskField(taskId, 'assignedTo', newAssigneeId, task?.assignedTo);
      const student = students?.find((s: any) => s.id === newAssigneeId);
      toast.success(newAssigneeId ? `Tarea asignada a ${student?.firstName || 'estudiante'}` : 'Tarea sin asignar');
    } catch (err) {
      console.error('Error assigning task:', err);
      toast.error('Error al asignar la tarea');
    }
  };

  const {
    containerRef,
    dragging,
    preview,
    startDrag,
    hasMovedRef
  } = useGanttDrag(tasks, DAY_WIDTH, updateTaskDates, handleSaveStageDates);

  // Filter tasks (excluding pending approval / rejected)
  const filteredTasks = useMemo(() => {
    const unique = Array.from(new Map(tasks.map((t: any) => [t.id, t])).values());
    return unique.filter((t: any) => t.status !== 'pending_approval' && t.status !== 'rejected');
  }, [tasks]);

  // Compute CPM incorporating stage-level interdependencies
  const cpmTasks = useMemo(() => {
    try {
      return computeCriticalPath(filteredTasks as any, project?.stages || []) as any[];
    } catch (e) {
      console.error("Error computing CPM in Gantt:", e);
      return filteredTasks as any[];
    }
  }, [filteredTasks, project?.stages]);

  // Build stage groups & calculate timeline bounds
  const { 
    minDate, 
    maxDate, 
    totalDays, 
    stageGroups,
    stageCoordinates,
    taskCoordinates 
  } = useMemo(() => {
    const stages: Stage[] = project?.stages || [];
    const groups: StageGroupMeta[] = [];

    // Helper to get timestamps
    const now = new Date();
    let minTs = now.getTime();
    let maxTs = now.getTime() + 30 * 86400000;

    if (cpmTasks.length > 0) {
      minTs = new Date(`${(cpmTasks[0].startDate || now.toISOString()).split('T')[0]}T00:00:00`).getTime();
      maxTs = new Date(`${(cpmTasks[0].endDate || now.toISOString()).split('T')[0]}T00:00:00`).getTime();
    }

    // Process defined stages
    stages.forEach(stage => {
      const stageTasks = cpmTasks.filter(t => t.stageId === stage.id || t.phase === stage.name || t.phase === stage.id);
      
      // Determine effective dates for stage summary bar
      let sStartTs = stage.startDate ? new Date(stage.startDate).getTime() : minTs;
      let sEndTs = stage.endDate ? new Date(stage.endDate).getTime() : maxTs;

      stageTasks.forEach(t => {
        if (t.startDate) {
          const tStart = new Date(t.startDate).getTime();
          if (tStart < sStartTs) sStartTs = tStart;
        }
        if (t.endDate) {
          const tEnd = new Date(t.endDate).getTime();
          if (tEnd > sEndTs) sEndTs = tEnd;
        }
      });

      if (sStartTs < minTs) minTs = sStartTs;
      if (sEndTs > maxTs) maxTs = sEndTs;

      const duration = Math.max(1, Math.ceil((sEndTs - sStartTs) / (1000 * 60 * 60 * 24)));
      const completedCount = stageTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      const progressPercent = stageTasks.length > 0 
        ? Math.round((completedCount / stageTasks.length) * 100)
        : (stage.spTotal > 0 ? Math.round((stage.spDone / stage.spTotal) * 100) : (stage.status === 'completed' ? 100 : 0));

      const isCritical = stageTasks.some(t => t.isCritical);

      groups.push({
        id: stage.id,
        name: stage.name || 'Etapa sin nombre',
        color: stage.color || '#3b82f6',
        startDate: new Date(sStartTs).toISOString(),
        endDate: new Date(sEndTs).toISOString(),
        duration,
        description: stage.description,
        predecessors: stage.predecessors || [],
        tasks: stageTasks.sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()),
        taskCount: stageTasks.length,
        completedCount,
        progressPercent,
        isStage: true,
        isCritical
      });
    });

    // Also check tasks without an assigned stage
    const assignedTaskIds = new Set(groups.flatMap(g => g.tasks.map(t => t.id)));
    const unassignedTasks = cpmTasks.filter(t => !assignedTaskIds.has(t.id));

    if (unassignedTasks.length > 0) {
      let uStartTs = new Date(unassignedTasks[0].startDate || now.toISOString()).getTime();
      let uEndTs = new Date(unassignedTasks[0].endDate || now.toISOString()).getTime();

      unassignedTasks.forEach(t => {
        const ts = new Date(t.startDate || now.toISOString()).getTime();
        const te = new Date(t.endDate || now.toISOString()).getTime();
        if (ts < uStartTs) uStartTs = ts;
        if (te > uEndTs) uEndTs = te;
      });

      if (uStartTs < minTs) minTs = uStartTs;
      if (uEndTs > maxTs) maxTs = uEndTs;

      const duration = Math.max(1, Math.ceil((uEndTs - uStartTs) / (1000 * 60 * 60 * 24)));
      const completedCount = unassignedTasks.filter(t => t.status === 'done' || t.status === 'completed').length;
      const progressPercent = Math.round((completedCount / unassignedTasks.length) * 100);

      groups.push({
        id: 'unassigned',
        name: 'Tareas sin Etapa Asignada',
        color: '#64748b',
        startDate: new Date(uStartTs).toISOString(),
        endDate: new Date(uEndTs).toISOString(),
        duration,
        description: 'Tareas independientes no agrupadas en una fase del proyecto',
        predecessors: [],
        tasks: unassignedTasks.sort((a, b) => new Date(a.startDate || 0).getTime() - new Date(b.startDate || 0).getTime()),
        taskCount: unassignedTasks.length,
        completedCount,
        progressPercent,
        isStage: false,
        isCritical: unassignedTasks.some(t => t.isCritical)
      });
    }

    // Min and Max dates padding
    const min = new Date(minTs);
    const max = new Date(maxTs);
    min.setDate(min.getDate() - 7);
    max.setDate(max.getDate() + 14);

    if (scale === 'weeks' || scale === 'months') {
      min.setDate(min.getDate() - min.getDay());
    }
    if (scale === 'months') {
      min.setDate(1);
    }

    const diffTime = Math.abs(max.getTime() - min.getTime());
    const totalDays = Math.max(30, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // Calculate vertical and horizontal coordinates for both stage bars and task bars
    const stageCoords: Record<string, { xStart: number, xEnd: number, y: number }> = {};
    const taskCoords: Record<string, { xStart: number, xEnd: number, y: number }> = {};
    
    let yIndex = 0;

    groups.forEach(group => {
      // Stage header row coordinate
      const sStart = new Date(`${group.startDate.split('T')[0]}T00:00:00`);
      const sEnd = new Date(`${group.endDate.split('T')[0]}T00:00:00`);
      const sDiffStart = Math.max(0, Math.ceil((sStart.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)));
      const sDuration = Math.max(1, Math.ceil((sEnd.getTime() - sStart.getTime()) / (1000 * 60 * 60 * 24)));

      stageCoords[group.id] = {
        xStart: sDiffStart * DAY_WIDTH,
        xEnd: (sDiffStart + sDuration) * DAY_WIDTH,
        y: HEADER_HEIGHT + yIndex * ROW_HEIGHT + (ROW_HEIGHT / 2)
      };

      yIndex += 1; // Stage header row

      // If stage is collapsed, task rows are hidden
      const isCollapsed = collapsedStages[group.id];
      if (!isCollapsed) {
        group.tasks.forEach(task => {
          const tStart = new Date(`${(task.startDate || now.toISOString()).split('T')[0]}T00:00:00`);
          const tEnd = new Date(`${(task.endDate || now.toISOString()).split('T')[0]}T00:00:00`);
          const tDiffStart = Math.max(0, Math.ceil((tStart.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)));
          const tDuration = Math.max(1, Math.ceil((tEnd.getTime() - tStart.getTime()) / (1000 * 60 * 60 * 24)));

          taskCoords[task.id] = {
            xStart: tDiffStart * DAY_WIDTH,
            xEnd: (tDiffStart + tDuration) * DAY_WIDTH,
            y: HEADER_HEIGHT + yIndex * ROW_HEIGHT + (ROW_HEIGHT / 2)
          };

          yIndex += 1;
        });
      }
    });

    return {
      minDate: min,
      maxDate: max,
      totalDays,
      stageGroups: groups,
      stageCoordinates: stageCoords,
      taskCoordinates: taskCoords
    };
  }, [cpmTasks, project?.stages, scale, DAY_WIDTH, collapsedStages]);

  const handleAutoFit = () => {
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
    }
  };

  const toggleStageCollapse = (stageId: string) => {
    setCollapsedStages(prev => ({
      ...prev,
      [stageId]: !prev[stageId]
    }));
  };

  const toggleAllStages = () => {
    const allCollapsed = stageGroups.every(g => collapsedStages[g.id]);
    const next: Record<string, boolean> = {};
    stageGroups.forEach(g => {
      next[g.id] = !allCollapsed;
    });
    setCollapsedStages(next);
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

  const handleDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteTask(taskId);
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  // Mobile View
  if (isMobile) {
    return (
      <div className={`h-full flex flex-col ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-slate-50'}`}>
        <div className={`p-4 border-b flex justify-between items-center sticky top-0 z-10 ${
          isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'
        }`}>
          <div>
            <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              Cronograma de Etapas y Gantt
            </h3>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              Vista Móvil (CPM)
            </p>
          </div>
          <button className={`p-2 rounded-full ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
            <Activity size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {stageGroups.map(stage => (
            <div 
              key={stage.id} 
              className={`p-4 rounded-3xl border shadow-sm space-y-3 ${
                isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <h4 className="text-sm font-bold">{stage.name}</h4>
                </div>
                <span className="text-xs font-bold text-indigo-600">{stage.progressPercent}%</span>
              </div>

              {stage.description && (
                <p className="text-xs text-slate-600 dark:text-gray-300 line-clamp-2">
                  {stage.description}
                </p>
              )}

              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-white/5">
                {stage.tasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="p-2.5 rounded-xl border border-slate-100 dark:border-white/5 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold truncate">{task.title}</span>
                    <SlackChip slack={task.slack || 0} isCritical={task.isCritical || false} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Desktop / Tablet View
  const allStagesCollapsed = stageGroups.length > 0 && stageGroups.every(g => collapsedStages[g.id]);

  return (
    <div className={`h-full flex flex-col rounded-3xl shadow-sm border overflow-hidden ${
      isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'
    }`}>
      {/* Toolbar */}
      <div className={`p-4 border-b flex justify-between items-center gap-4 flex-wrap ${
        isDarkMode ? 'border-white/10 bg-[#1a1a1a]' : 'border-slate-200 bg-slate-50'
      }`}>
        <div className="flex items-center gap-3">
          {/* Scale Buttons */}
          <div className={`flex rounded-xl border p-1 shadow-sm ${
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
          }`}>
            <button 
              onClick={() => setScale('days')} 
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                scale === 'days' 
                  ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') 
                  : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')
              }`}
            >
              Días
            </button>
            <button 
              onClick={() => setScale('weeks')} 
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                scale === 'weeks' 
                  ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') 
                  : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')
              }`}
            >
              Semanas
            </button>
            <button 
              onClick={() => setScale('months')} 
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                scale === 'months' 
                  ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') 
                  : (isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-50')
              }`}
            >
              Meses
            </button>
          </div>

          {/* Toggle All Stages Button */}
          <button
            onClick={toggleAllStages}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border shadow-sm transition-all ${
              isDarkMode 
                ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Layers size={14} className="text-indigo-500" />
            <span>{allStagesCollapsed ? 'Expandir Etapas' : 'Contraer Etapas'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleAutoFit} 
            className={`flex items-center gap-2 text-xs font-bold transition-colors border px-4 py-2 rounded-xl shadow-sm ${
              isDarkMode 
                ? 'text-gray-300 hover:text-indigo-400 bg-white/5 border-white/10' 
                : 'text-slate-600 hover:text-indigo-600 bg-white border-slate-200'
            }`}
          >
            <Maximize size={15} /> 
            <span>Auto Fit</span>
          </button>
        </div>
      </div>

      {/* Gantt Area */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Left Panel (Stage & Task Hierarchical List) */}
        <div 
          className={`hidden sm:flex flex-col border-r z-20 shrink-0 ${
            isDarkMode ? 'border-white/10 bg-[#1a1a1a]' : 'border-slate-200 bg-white'
          }`} 
          style={{ width: 'clamp(240px, 32vw, 360px)' }}
        >
          <div className={`h-[60px] border-b flex items-center justify-between px-4 shrink-0 ${
            isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'
          }`}>
            <span className={`text-xs font-black uppercase tracking-widest ${
              isDarkMode ? 'text-gray-500' : 'text-slate-500'
            }`}>
              Etapas y Tareas
            </span>
            <span className={`text-[10px] font-bold ${
              isDarkMode ? 'text-gray-600' : 'text-slate-400'
            }`}>
              {stageGroups.length} fases • {cpmTasks.length} tareas
            </span>
          </div>

          <div 
            className="flex-1 overflow-y-auto hide-scrollbar" 
            id="gantt-left-panel" 
            onScroll={(e) => {
              const rightPanel = document.getElementById('gantt-right-panel');
              if (rightPanel) rightPanel.scrollTop = e.currentTarget.scrollTop;
            }}
          >
            {stageGroups.map(stage => {
              const isCollapsed = collapsedStages[stage.id];

              return (
                <React.Fragment key={stage.id}>
                  {/* Stage Summary Parent Row */}
                  <div 
                    onClick={() => toggleStageCollapse(stage.id)}
                    className={`h-12 border-b flex items-center px-3 gap-2 cursor-pointer transition-colors group select-none sticky top-0 z-10 ${
                      isDarkMode 
                        ? 'border-white/10 bg-[#202020] hover:bg-[#252525]' 
                        : 'border-slate-200 bg-slate-100/90 hover:bg-slate-200/70'
                    }`}
                  >
                    {/* Expand/Collapse Chevron */}
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleStageCollapse(stage.id);
                      }}
                      className={`p-1 rounded-md transition-transform ${
                        isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      {isCollapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {/* Stage Color Dot */}
                    <div 
                      className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: stage.color }}
                    />

                    {/* Stage Name & Details */}
                    <div className="flex-1 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-xs font-black uppercase tracking-tight truncate ${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}>
                          {stage.name}
                        </span>
                        {stage.isCritical && (
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" title="Etapa en Ruta Crítica" />
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 text-[9px] font-bold text-slate-500 dark:text-gray-400">
                        <span>{stage.taskCount} tareas</span>
                        <span>•</span>
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{stage.progressPercent}%</span>
                        {stage.predecessors.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-amber-600 dark:text-amber-400">Dep: {stage.predecessors.length}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Info Button for Stage Modal */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStageMeta(stage);
                      }}
                      className={`p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity ${
                        isDarkMode ? 'text-gray-400 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'
                      }`}
                      title="Ver objetivos y descripción completa de la etapa"
                    >
                      <Info size={14} />
                    </button>
                  </div>

                  {/* Contained Tasks (rendered only if NOT collapsed) */}
                  {!isCollapsed && stage.tasks.map(task => (
                    <div 
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`h-12 border-b flex items-center pl-8 pr-3 cursor-pointer transition-colors group ${
                        isDarkMode ? 'border-white/5 hover:bg-white/5' : 'border-slate-50 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex-1 min-w-0 pr-2">
                        <p className={`text-xs font-bold truncate transition-colors ${
                          isDarkMode ? 'text-gray-300 group-hover:text-indigo-400' : 'text-slate-800 group-hover:text-indigo-600'
                        }`}>
                          {task.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${task.isCritical ? 'bg-red-500' : 'bg-emerald-500'}`} />
                          <span className={`text-[9px] font-bold uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                            {task.duration}d
                          </span>
                          {task.slack !== undefined && (
                            <span className={`text-[9px] font-bold ${task.isCritical ? 'text-red-500' : 'text-slate-400'}`}>
                              H={task.slack}d
                            </span>
                          )}
                        </div>
                      </div>

                      {permissions?.canDeleteTask && (
                        <button
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className={`opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-1.5 rounded-lg transition-all ${
                            isDarkMode 
                              ? 'text-gray-500 hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                          }`}
                          title="Eliminar tarea"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Right Panel (Timeline Grid & Canvas) */}
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
            
            {/* Grid & SVG Dependency Layer */}
            <svg width="100%" height="100%" className="absolute top-0 left-0 pointer-events-none">
              <defs>
                <pattern id="grid" width={DAY_WIDTH} height={ROW_HEIGHT} patternUnits="userSpaceOnUse">
                  <path d={`M ${DAY_WIDTH} 0 L 0 0 0 ${ROW_HEIGHT}`} fill="none" stroke={isDarkMode ? '#333' : '#f8fafc'} strokeWidth="1"/>
                </pattern>
                <marker id="gantt-arrow-stage" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3z" fill="#8b5cf6" />
                </marker>
                <marker id="gantt-arrow-stage-crit" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3z" fill="#ef4444" />
                </marker>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
              
              {/* Stage-to-Stage Predecessor Dependency Lines */}
              {stageGroups.map(stage => {
                if (!stage.predecessors || stage.predecessors.length === 0) return null;
                const toCoords = stageCoordinates[stage.id];
                if (!toCoords) return null;

                return stage.predecessors.map((predId, idx) => {
                  const fromCoords = stageCoordinates[predId];
                  if (!fromCoords) return null;

                  const startX = fromCoords.xEnd;
                  const startY = fromCoords.y;
                  const endX = toCoords.xStart;
                  const endY = toCoords.y;

                  const midX = startX + 16;
                  const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                  const isCrit = stage.isCritical && stageGroups.find(s => s.id === predId)?.isCritical;

                  return (
                    <g key={`stage-dep-${predId}-${stage.id}-${idx}`}>
                      <path
                        d={path}
                        fill="none"
                        stroke={isCrit ? '#ef4444' : '#8b5cf6'}
                        strokeWidth={isCrit ? 2.5 : 2}
                        strokeDasharray={isCrit ? 'none' : '4 3'}
                        markerEnd={`url(#${isCrit ? 'gantt-arrow-stage-crit' : 'gantt-arrow-stage'})`}
                      />
                    </g>
                  );
                });
              })}

              {/* Task Dependency Lines (only drawn for visible, uncollapsed tasks) */}
              {cpmTasks.map(task => {
                const uniqueDeps = Array.from(new Set(task.dependencies || []));
                if (uniqueDeps.length === 0) return null;
                const toCoords = taskCoordinates[task.id];
                if (!toCoords) return null;

                return (
                  <g key={`deps-${task.id}`}>
                    {uniqueDeps.map((depId: string, depIdx) => {
                      const fromCoords = taskCoordinates[depId];
                      if (!fromCoords) return null;

                      const startX = fromCoords.xEnd;
                      const startY = fromCoords.y;
                      const endX = toCoords.xStart;
                      const endY = toCoords.y;
                      
                      const midX = startX + 10;
                      const path = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                      
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
            <div className={`absolute top-0 left-0 h-[60px] flex border-b z-10 sticky top-0 ${
              isDarkMode ? 'border-white/10 bg-[#1a1a1a]/95 backdrop-blur-sm' : 'border-slate-200 bg-white/95 backdrop-blur-sm'
            }`}>
              {dates.map((date, i) => {
                if (scale === 'months') {
                  if (date.getDate() === 1) {
                    return (
                      <div 
                        key={`month-${date.getTime()}-${i}`} 
                        className={`absolute h-full flex items-end pb-2 border-l pl-2 ${
                          isDarkMode ? 'border-white/10' : 'border-slate-200'
                        }`} 
                        style={{ left: i * DAY_WIDTH, width: 30 * DAY_WIDTH }}
                      >
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          {date.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
                        </span>
                      </div>
                    );
                  }
                  return null;
                }
                
                if (scale === 'weeks') {
                  if (date.getDay() === 1) {
                    return (
                      <div 
                        key={`week-${date.getTime()}-${i}`} 
                        className={`absolute h-full flex flex-col justify-end pb-2 border-l pl-2 ${
                          isDarkMode ? 'border-white/10' : 'border-slate-200'
                        }`} 
                        style={{ left: i * DAY_WIDTH, width: 7 * DAY_WIDTH }}
                      >
                        <span className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Semana</span>
                        <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          {date.getDate()} {date.toLocaleDateString('es-MX', { month: 'short' })}
                        </span>
                      </div>
                    );
                  }
                  return null;
                }

                // Days scale
                return (
                  <div 
                    key={`day-${date.getTime()}-${i}`} 
                    className={`shrink-0 flex flex-col justify-end pb-2 border-r text-center ${
                      date.getDay() === 0 || date.getDay() === 6 
                        ? (isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/50 border-slate-100') 
                        : (isDarkMode ? 'border-white/5' : 'border-slate-100')
                    }`} 
                    style={{ width: DAY_WIDTH }}
                  >
                    <span className={`text-[9px] font-black uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      {date.toLocaleDateString('es-MX', { weekday: 'narrow' })}
                    </span>
                    <span className={`text-xs font-bold ${
                      date.toDateString() === new Date().toDateString() 
                        ? 'text-red-500 font-black' 
                        : (isDarkMode ? 'text-gray-300' : 'text-slate-700')
                    }`}>
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>

              {/* Timeline Rows: Stage Summary Bars & Contained Tasks Bars */}
              <div className="pt-[60px] w-full">
                {(() => {
                  const canEditStage = userRole === 'admin' || userRole === 'coordinator' || permissions?.canEditProject;

                  return stageGroups.map(stage => {
                    const sCoords = stageCoordinates[stage.id];
                    const isCollapsed = collapsedStages[stage.id];

                    return (
                      <React.Fragment key={stage.id}>
                        {/* Stage Header Timeline Row (Contains the Interactive Stage Bar) */}
                        <div className={`h-12 w-full border-b relative group ${
                          isDarkMode ? 'border-white/10 bg-[#202020]/40' : 'border-slate-200/80 bg-slate-100/40'
                        }`}>
                          {sCoords && (
                            <GanttStageBar
                              stage={stage}
                              left={sCoords.xStart}
                              width={sCoords.xEnd - sCoords.xStart}
                              dayWidth={DAY_WIDTH}
                              minDate={minDate}
                              isDragging={dragging?.id === stage.id}
                              dragMode={dragging?.id === stage.id ? dragging.mode : undefined}
                              preview={preview[stage.id]}
                              onStartDrag={(e, stageId, mode, origStart, origEnd) => {
                                startDrag(e, stageId, mode, 'stage', origStart, origEnd);
                              }}
                              onClick={() => {
                                if (!hasMovedRef.current) {
                                  setSelectedStageMeta(stage);
                                }
                              }}
                              canEdit={canEditStage}
                              isDarkMode={isDarkMode}
                            />
                          )}
                        </div>

                        {/* Task Rows (only if not collapsed) */}
                        {!isCollapsed && stage.tasks.map((task: any) => {
                          const coords = taskCoordinates[task.id];
                          if (!coords) return null;
                          
                          const left = coords.xStart;
                          const width = coords.xEnd - coords.xStart;
                          const canEditTask = permissions?.canEditTask && (userRole === 'admin' || userRole === 'coordinator' || task.assignedTo === currentUser?.uid);

                          return (
                            <div key={task.id} className="h-12 border-b border-transparent relative group">
                              <GanttBar
                                task={task}
                                left={left}
                                width={width}
                                dayWidth={DAY_WIDTH}
                                minDate={minDate}
                                isDragging={dragging?.id === task.id}
                                dragMode={dragging?.id === task.id ? dragging.mode : undefined}
                                preview={preview[task.id]}
                                onStartDrag={(e, taskId, mode) => {
                                  startDrag(e, taskId, mode, 'task');
                                }}
                                onClick={() => {
                                  if (!hasMovedRef.current) {
                                    setSelectedTaskId(task.id);
                                  }
                                }}
                                canEdit={canEditTask}
                                isDarkMode={isDarkMode}
                              />
                            </div>
                          );
                        })}
                      </React.Fragment>
                    );
                  });
                })()}
              </div>

          </div>
        </div>
      </div>

      {/* Selected Stage Detail Popover / Modal (High Visibility Description & Scope) */}
      <AnimatePresence>
        {selectedStageMeta && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setSelectedStageMeta(null)}
          >
            <div 
              className={`w-full max-w-xl rounded-3xl border shadow-2xl p-6 sm:p-8 space-y-6 overflow-hidden ${
                isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded-full shrink-0 shadow-md"
                    style={{ backgroundColor: selectedStageMeta.color }}
                  />
                  <div>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                      isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                    }`}>
                      Etapa del Diagrama de Gantt
                    </span>
                    <h3 className="text-xl font-black leading-tight">
                      {selectedStageMeta.name}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedStageMeta(null)}
                  className={`p-2 rounded-xl transition-colors ${
                    isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-500'
                  }`}
                >
                  <X size={18} />
                </button>
              </div>

              {/* High Contrast Description & Objectives Section */}
              <div className={`p-4 sm:p-5 rounded-2xl border ${
                isDarkMode ? 'bg-white/5 border-white/10 text-gray-100' : 'bg-slate-50 border-slate-200 text-slate-900'
              }`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>
                    Descripción y Objetivos:
                  </span>
                </div>
                {selectedStageMeta.description ? (
                  <p className="text-xs sm:text-sm font-semibold leading-relaxed whitespace-pre-wrap">
                    {selectedStageMeta.description}
                  </p>
                ) : (
                  <p className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    No se ha ingresado una descripción para esta etapa.
                  </p>
                )}
              </div>

              {/* Metrics Grid with Interactive Date Editing (CSS Selectors 2 & 3) */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                  {/* Selector 2: Inicio */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus-within:border-indigo-500/50' : 'bg-slate-50 border-slate-200 focus-within:border-indigo-500'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Inicio
                      </p>
                      {canEditStage && (
                        <span className="text-[9px] text-indigo-500 font-bold flex items-center gap-0.5">
                          <Edit3 size={10} />
                          Editar
                        </span>
                      )}
                    </div>
                    {canEditStage ? (
                      <input
                        type="date"
                        value={stageDates.startDate}
                        onChange={(e) => setStageDates(prev => ({ ...prev, startDate: e.target.value }))}
                        className={`w-full text-xs font-bold bg-transparent outline-none cursor-pointer ${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}
                      />
                    ) : (
                      <p className="text-xs font-bold">
                        {safeFormatDate(stageDates.startDate || selectedStageMeta.startDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* Selector 3: Fin Estimado */}
                  <div className={`p-3 rounded-2xl border transition-all ${
                    isDarkMode ? 'bg-white/5 border-white/10 focus-within:border-indigo-500/50' : 'bg-slate-50 border-slate-200 focus-within:border-indigo-500'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Fin Estimado
                      </p>
                      {canEditStage && (
                        <span className="text-[9px] text-indigo-500 font-bold flex items-center gap-0.5">
                          <Edit3 size={10} />
                          Editar
                        </span>
                      )}
                    </div>
                    {canEditStage ? (
                      <input
                        type="date"
                        value={stageDates.endDate}
                        onChange={(e) => setStageDates(prev => ({ ...prev, endDate: e.target.value }))}
                        className={`w-full text-xs font-bold bg-transparent outline-none cursor-pointer ${
                          isDarkMode ? 'text-white' : 'text-slate-900'
                        }`}
                      />
                    ) : (
                      <p className="text-xs font-bold">
                        {safeFormatDate(stageDates.endDate || selectedStageMeta.endDate, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    )}
                  </div>

                  {/* Tareas Count */}
                  <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Tareas</p>
                    <p className="text-xs font-black">
                      {currentStageTasks.filter(t => t.status === 'done').length} / {currentStageTasks.length}
                    </p>
                  </div>

                  {/* Avance */}
                  <div className={`p-3 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[9px] font-black uppercase tracking-wider mb-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Avance</p>
                    <p className="text-xs font-black text-indigo-500">
                      {currentStageTasks.length > 0 
                        ? Math.round((currentStageTasks.filter(t => t.status === 'done').length / currentStageTasks.length) * 100) 
                        : selectedStageMeta.progressPercent}%
                    </p>
                  </div>
                </div>

                {/* Banner when stage dates are changed */}
                {(() => {
                  const origStart = (selectedStageMeta.startDate || '').split('T')[0];
                  const origEnd = (selectedStageMeta.endDate || '').split('T')[0];
                  const hasDatesChanged = stageDates.startDate !== origStart || stageDates.endDate !== origEnd;

                  if (!hasDatesChanged) return null;

                  const daysCount = stageDates.startDate && stageDates.endDate
                    ? Math.max(1, Math.round((new Date(`${stageDates.endDate}T00:00:00`).getTime() - new Date(`${stageDates.startDate}T00:00:00`).getTime()) / (86400000)))
                    : 1;

                  return (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 ${
                        isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-amber-50 border-amber-200 text-amber-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-xs font-bold">
                        <Calendar size={15} className="text-amber-500 shrink-0" />
                        <span>Fechas modificadas ({daysCount} {daysCount === 1 ? 'día' : 'días'}). Guarda para actualizar el Gantt.</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => setStageDates({ startDate: origStart, endDate: origEnd })}
                          className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-colors ${
                            isDarkMode ? 'border-white/10 hover:bg-white/5 text-gray-400' : 'border-slate-300 hover:bg-white text-slate-600'
                          }`}
                        >
                          Descartar
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveModalStageDates}
                          disabled={isSavingDates}
                          className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          <Save size={13} />
                          <span>{isSavingDates ? 'Guardando...' : 'Guardar Fechas'}</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })()}
              </div>

              {/* Task Management Section (Create and Assign Tasks) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wider ${
                      isDarkMode ? 'text-white' : 'text-slate-900'
                    }`}>
                      Tareas de esta Etapa ({currentStageTasks.length})
                    </h4>
                  </div>

                  {canCreateTask && (
                    <button
                      type="button"
                      onClick={() => setShowNewTaskForm(prev => !prev)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                        showNewTaskForm 
                          ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-200 text-slate-800')
                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                    >
                      {showNewTaskForm ? (
                        <>
                          <X size={13} />
                          <span>Cerrar Formulario</span>
                        </>
                      ) : (
                        <>
                          <Plus size={13} />
                          <span>Crear Tarea</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Inline Task Creation Form */}
                <AnimatePresence>
                  {showNewTaskForm && (
                    <motion.form
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      onSubmit={handleCreateTaskInStage}
                      className={`p-4 rounded-2xl border space-y-3 overflow-hidden ${
                        isDarkMode ? 'bg-[#222] border-indigo-500/30' : 'bg-indigo-50/50 border-indigo-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          isDarkMode ? 'text-indigo-400' : 'text-indigo-700'
                        }`}>
                          Nueva Tarea para &ldquo;{selectedStageMeta.name}&rdquo;
                        </span>
                      </div>

                      {/* Title input */}
                      <div>
                        <input
                          type="text"
                          required
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Título de la tarea (ej. Diagnóstico de instalaciones)..."
                          className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-bold border outline-none focus:ring-2 focus:ring-indigo-500 ${
                            isDarkMode ? 'bg-[#181818] border-white/10 text-white placeholder:text-gray-500' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                          }`}
                        />
                      </div>

                      {/* Assignee & Type Row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* Assignee Dropdown */}
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase tracking-wider ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}>
                            Asignar a
                          </label>
                          <select
                            value={newTaskAssignee}
                            onChange={(e) => setNewTaskAssignee(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none cursor-pointer ${
                              isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <option value="">Sin asignar (Backlog)</option>
                            {students?.map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.firstName} {s.lastNamePaterno || ''} ({s.matricula || 'Prestador'})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Task Type */}
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase tracking-wider ${
                            isDarkMode ? 'text-gray-400' : 'text-slate-500'
                          }`}>
                            Tipo de Tarea
                          </label>
                          <select
                            value={newTaskType}
                            onChange={(e) => setNewTaskType(e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none cursor-pointer ${
                              isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            {[
                              'LEVANTAMIENTO',
                              'DIAGNÓSTICO',
                              'SOCIAL / TALLER',
                              'REUNIÓN / COORDINACIÓN',
                              'DISEÑO / MODELADO',
                              'PLANOS EJECUTIVOS',
                              'COSTOS Y PRESUPUESTO',
                              'REVISIÓN / ENTREGA'
                            ].map(t => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Dates & Effort Row */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            Inicio Tarea
                          </label>
                          <input
                            type="date"
                            value={newTaskStartDate}
                            onChange={(e) => setNewTaskStartDate(e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border outline-none ${
                              isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            Fin Tarea
                          </label>
                          <input
                            type="date"
                            value={newTaskEndDate}
                            onChange={(e) => setNewTaskEndDate(e.target.value)}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border outline-none ${
                              isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            Esfuerzo (h)
                          </label>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={newTaskEffort}
                            onChange={(e) => setNewTaskEffort(Number(e.target.value))}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border outline-none ${
                              isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className={`text-[9px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            Prioridad
                          </label>
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(Number(e.target.value))}
                            className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                              isDarkMode ? 'bg-[#181818] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                            }`}
                          >
                            <option value={5}>5 Estrellas (Urgente)</option>
                            <option value={4}>4 Estrellas (Alta)</option>
                            <option value={3}>3 Estrellas (Media)</option>
                            <option value={2}>2 Estrellas (Baja)</option>
                            <option value={1}>1 Estrella (Mínima)</option>
                          </select>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowNewTaskForm(false)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-colors ${
                            isDarkMode ? 'border-white/10 hover:bg-white/5 text-gray-400' : 'border-slate-300 hover:bg-slate-100 text-slate-600'
                          }`}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={isCreatingTask || !newTaskTitle.trim()}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Plus size={14} />
                          <span>{isCreatingTask ? 'Creando...' : 'Crear y Asignar Tarea'}</span>
                        </button>
                      </div>
                    </motion.form>
                  )}
                </AnimatePresence>

                {/* Task List */}
                <div className={`rounded-2xl border divide-y overflow-hidden max-h-60 overflow-y-auto hide-scrollbar ${
                  isDarkMode ? 'bg-white/[0.02] border-white/10 divide-white/5' : 'bg-slate-50/50 border-slate-200 divide-slate-100'
                }`}>
                  {currentStageTasks.length === 0 ? (
                    <div className="p-6 text-center">
                      <p className={`text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Esta etapa aún no tiene tareas creadas.
                      </p>
                      {canCreateTask && !showNewTaskForm && (
                        <button
                          type="button"
                          onClick={() => setShowNewTaskForm(true)}
                          className="text-xs font-black text-indigo-500 hover:text-indigo-600 flex items-center gap-1 mx-auto cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Crear la primera tarea</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    currentStageTasks.map((t: any) => {
                      const assignedStudent = students?.find((s: any) => s.id === t.assignedTo);

                      return (
                        <div 
                          key={t.id}
                          className={`p-3 flex items-center justify-between gap-3 text-xs transition-colors ${
                            isDarkMode ? 'hover:bg-white/5' : 'hover:bg-white'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <StatusBadge status={t.status} size="sm" />
                              <button
                                type="button"
                                onClick={() => setSelectedTaskId(t.id)}
                                className={`font-bold truncate hover:text-indigo-500 text-left transition-colors cursor-pointer ${
                                  isDarkMode ? 'text-white' : 'text-slate-900'
                                }`}
                                title="Abrir detalles de la tarea"
                              >
                                {t.title}
                              </button>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500">
                              <span>{safeFormatDate(t.startDate, { month: 'short', day: 'numeric' })} &rarr; {safeFormatDate(t.endDate, { month: 'short', day: 'numeric' })}</span>
                              <span>•</span>
                              <span>{t.effort || 0} hrs</span>
                            </div>
                          </div>

                          {/* Direct Assignee Selector */}
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={t.assignedTo || ''}
                              onChange={(e) => handleAssignTaskInModal(t.id, e.target.value)}
                              className={`text-[11px] font-bold rounded-lg px-2 py-1 border transition-all cursor-pointer ${
                                t.assignedTo 
                                  ? (isDarkMode ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800')
                                  : (isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-500')
                              }`}
                              title="Reasignar tarea"
                            >
                              <option value="">Sin asignar</option>
                              {students?.map((s: any) => (
                                <option key={s.id} value={s.id}>
                                  {s.firstName} {s.lastNamePaterno || ''}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              onClick={() => setSelectedTaskId(t.id)}
                              className={`p-1.5 rounded-lg border transition-colors ${
                                isDarkMode ? 'border-white/10 hover:bg-white/10 text-gray-400' : 'border-slate-200 hover:bg-slate-100 text-slate-500'
                              }`}
                              title="Ver panel completo"
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Predecessors Summary */}
              {selectedStageMeta.predecessors && selectedStageMeta.predecessors.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    Etapas Predecesoras:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedStageMeta.predecessors.map((predId: string) => {
                      const pred = stageGroups.find(s => s.id === predId);
                      return (
                        <span 
                          key={predId}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                            isDarkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                          }`}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pred?.color || '#3b82f6' }} />
                          {pred?.name || predId}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setSelectedStageMeta(null)}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md active:scale-95 cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Task Side Panel */}
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
            sprints={sprints}
            updateTaskStatus={updateTaskStatus}
            updateTaskField={updateTaskField}
            updateTaskFields={updateTaskFields}
            deleteTask={deleteTask}
            isDarkMode={isDarkMode}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default GanttView;
