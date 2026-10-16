import React, { useState, useMemo, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Inbox, 
  Send, 
  XCircle, 
  ChevronLeft, 
  ChevronRight,
  MoveHorizontal,
  LayoutGrid,
  List,
  Layers,
  Zap
} from 'lucide-react';
import toast from 'react-hot-toast';
import TaskSidePanel from './TaskSidePanel';
import { computeCriticalPath } from '../utils/criticalPath';
import { Task } from '../types/criticalPath';
import { useKanbanLayout } from '../hooks/useKanbanLayout';
import { KANBAN_COLUMNS, KanbanColumnId } from '../config/kanbanColumns';
import KanbanCard from './KanbanCard';
import KanbanColumn from './KanbanColumn';
import { BottomSheet } from './ui/BottomSheet';

const KanbanBoard = ({ 
  tasks, 
  projectId, 
  project,
  userRole, 
  currentUser, 
  students, 
  sprints = [],
  onOpenSprintConfig,
  updateTaskStatus, 
  updateTaskField, 
  updateTaskFields, 
  deleteTask, 
  addTask, 
  permissions, 
  initialTaskId, 
  onTaskOpened,
  isDarkMode
}: any) => {
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId || null);
  const [isProposingTask, setIsProposingTask] = useState(false);
  const [rejectionModal, setRejectionModal] = useState<{ taskId: string, title: string } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [selectedStageId, setSelectedStageId] = useState<string>('all');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('all');
  
  const { layout, activeColumnId, setActiveColumn, columnCount } = useKanbanLayout();
  
  const currentStage = project?.stages?.[project?.currentStageIndex || 0];

  const [proposalForm, setProposalForm] = useState({
    title: '',
    description: '',
    type: 'LEVANTAMIENTO',
    effort: 1,
    startDate: currentStage?.startDate || new Date().toISOString(),
    endDate: currentStage?.endDate || new Date(Date.now() + 86400000).toISOString()
  });

  const boardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTaskId) {
      setSelectedTaskId(initialTaskId);
      onTaskOpened?.();
    }
  }, [initialTaskId, onTaskOpened]);

  // Remove Intersection Observer for tablet position indicator
  // as useKanbanLayout handles layout state

  const cpmTasks = useMemo(() => {
    try {
      let filtered = tasks;
      if (selectedStageId !== 'all') {
        const stageObj = project?.stages?.find((s: any) => s.id === selectedStageId);
        filtered = filtered.filter((t: any) => t.stageId === selectedStageId || (stageObj && t.phase === stageObj.name));
      }
      if (selectedSprintId !== 'all') {
        if (selectedSprintId === 'unassigned') {
          filtered = filtered.filter((t: any) => !t.sprintId);
        } else {
          filtered = filtered.filter((t: any) => t.sprintId === selectedSprintId);
        }
      }
      return computeCriticalPath(filtered as Task[]);
    } catch (e) {
      console.error("Error computing CPM:", e);
      return tasks as Task[];
    }
  }, [tasks, selectedStageId, selectedSprintId, project?.stages]);

  const columnsToRender = useMemo(() => {
    const baseColumns = KANBAN_COLUMNS.filter(c => !c.hideFromBoard);
    if (userRole === 'admin') {
      return baseColumns;
    }
    return baseColumns.filter(c => c.id !== 'pending_approval');
  }, [userRole]);

  const tasksByStatus = useMemo(() => {
    const groups: Record<string, any[]> = {};
    columnsToRender.forEach(col => {
      // Deduplicate tasks by ID
      const columnTasks = cpmTasks.filter(t => t.status === col.id);
      groups[col.id] = Array.from(new Map(columnTasks.map(t => [t.id, t])).values());
    });
    return groups;
  }, [cpmTasks, columnsToRender]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    if (!permissions.canChangeStatus) {
      e.preventDefault();
      return;
    }
    setDraggedTask(taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!permissions.canChangeStatus) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    if (!draggedTask) return;

    const task = tasks.find((t: any) => t.id === draggedTask);
    if (task && task.status !== statusId) {
      await updateTaskStatus(draggedTask, statusId as any, task.status);
    }
    setDraggedTask(null);
  };

  const handleAddTask = async (statusId: string) => {
    if (!permissions.canCreateTask) {
      toast.error('No tienes permisos para crear tareas');
      return;
    }

    if (userRole === 'user') {
      setIsProposingTask(true);
      return;
    }

    try {
      const targetStage = selectedStageId !== 'all'
        ? project?.stages?.find((s: any) => s.id === selectedStageId)
        : currentStage;
      const targetSprint = (selectedSprintId !== 'all' && selectedSprintId !== 'unassigned')
        ? sprints.find((s: any) => s.id === selectedSprintId)
        : null;

      const newTask = {
        title: 'Nueva Tarea',
        description: '',
        status: statusId,
        priority: 3,
        effort: 1,
        type: 'LEVANTAMIENTO',
        assignedTo: '',
        assignedUsers: [],
        startDate: targetStage?.startDate || targetSprint?.startDate || new Date().toISOString(),
        endDate: targetStage?.endDate || targetSprint?.endDate || new Date(Date.now() + 86400000).toISOString(),
        stageId: targetStage?.id || null,
        sprintId: targetSprint?.id || null,
        phase: targetStage?.name || targetSprint?.name || 'Sprint 1',
        epic: targetStage ? `Fase ${targetStage.name.split(':')[0]}` : '',
        estimatedSP: 1,
        categoryId: ''
      };
      const newTaskId = await addTask(newTask);
      if (newTaskId) {
        setSelectedTaskId(newTaskId);
        toast.success('Tarea creada');
      }
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error('Error al crear tarea');
    }
  };

  const handleProposeTask = async () => {
    if (!proposalForm.title.trim()) {
      toast.error('El título es requerido');
      return;
    }
    try {
      const targetSprint = (selectedSprintId !== 'all' && selectedSprintId !== 'unassigned')
        ? sprints.find((s: any) => s.id === selectedSprintId)
        : null;

      const newTask = {
        ...proposalForm,
        status: 'pending_approval',
        priority: 3,
        assignedTo: currentUser?.uid,
        assignedUsers: [currentUser?.uid].filter(Boolean),
        stageId: currentStage?.id || '',
        sprintId: targetSprint?.id || null,
        phase: currentStage?.name || '',
        epic: '',
        estimatedSP: 0,
        categoryId: ''
      };
      const newTaskId = await addTask(newTask);
      if (newTaskId) {
        toast.success('Propuesta enviada para revisión');
        setIsProposingTask(false);
        setProposalForm({
          title: '',
          description: '',
          type: 'LEVANTAMIENTO',
          effort: 1,
          startDate: currentStage?.startDate || new Date().toISOString(),
          endDate: currentStage?.endDate || new Date(Date.now() + 86400000).toISOString()
        });
      }
    } catch (error) {
      console.error("Error proposing task:", error);
      toast.error('Error al proponer tarea');
    }
  };

  const handleApproveTask = async (task: any) => {
    try {
      await updateTaskStatus(task.id, 'working_on_it', 'pending_approval');
    } catch (error) {
      console.error("Error approving task:", error);
      toast.error('Error al aprobar tarea');
    }
  };

  const handleRejectTask = async () => {
    if (!rejectionModal || rejectionReason.length < 10) {
      toast.error('El motivo debe tener al menos 10 caracteres');
      return;
    }
    try {
      const { taskId } = rejectionModal;
      await updateTaskStatus(taskId, 'rejected', 'pending_approval');
      setRejectionModal(null);
      setRejectionReason('');
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast.error('Error al rechazar tarea');
    }
  };

  const handleMoveTask = async (taskId: string, newStatus: KanbanColumnId) => {
    try {
      const task = tasks.find((t: any) => t.id === taskId);
      if (task && task.status !== newStatus) {
        await updateTaskStatus(taskId, newStatus, task.status);
      }
    } catch (error) {
      console.error("Error moving task:", error);
      toast.error('Error al mover tarea');
    }
    setMovingTaskId(null);
  };

  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(true);
  const tabsRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (tabsRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tabsRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5);
    }
  };

  const scroll = (direction: 'left' | 'right') => {
    if (tabsRef.current) {
      const scrollAmount = 200;
      tabsRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const ref = tabsRef.current;
    if (ref) {
      ref.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => ref.removeEventListener('scroll', handleScroll);
    }
  }, [activeColumnId]);

  const mobileTabs = columnsToRender.map(col => ({
    id: col.id,
    label: col.shortLabel,
    badge: (tasksByStatus[col.id] || []).length,
    icon: col.icon,
    color: col.color
  }));

  const activeColumn = columnsToRender.find(c => c.id === activeColumnId);

  return (
    <div className={`h-full flex flex-col overflow-hidden ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-50/50'}`}>
      {/* Stage Pills Filter Bar */}
      {project?.stages && project.stages.length > 0 && (
        <div className={`px-4 py-2.5 border-b shrink-0 flex items-center gap-2 overflow-x-auto hide-scrollbar z-10 transition-colors ${
          isDarkMode ? 'bg-[#141414] border-white/5' : 'bg-white border-slate-200 shadow-xs'
        }`}>
          <div className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider shrink-0 mr-1 ${
            isDarkMode ? 'text-gray-400' : 'text-slate-500'
          }`}>
            <Layers size={13} className="text-indigo-500" />
            <span className="hidden sm:inline">Etapa:</span>
          </div>

          {/* All stages button */}
          <button
            type="button"
            onClick={() => setSelectedStageId('all')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
              selectedStageId === 'all'
                ? (isDarkMode 
                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 shadow-xs' 
                    : 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs')
                : (isDarkMode 
                    ? 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white' 
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-900')
            }`}
          >
            <span>Todas</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
              selectedStageId === 'all' 
                ? (isDarkMode ? 'bg-indigo-500/30 text-indigo-200' : 'bg-indigo-200 text-indigo-800') 
                : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-600')
            }`}>
              {tasks.length}
            </span>
          </button>

          {/* Individual stage pills */}
          {project.stages.map((stage: any, sIdx: number) => {
            const isSelected = selectedStageId === stage.id;
            const isCurrentActive = project.currentStageIndex === sIdx;
            const stageTasksCount = tasks.filter((t: any) => t.stageId === stage.id || t.phase === stage.name).length;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setSelectedStageId(isSelected ? 'all' : stage.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'shadow-xs font-black'
                    : (isDarkMode 
                        ? 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10' 
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-white')
                }`}
                style={isSelected ? {
                  backgroundColor: `${stage.color || '#6366f1'}20`,
                  borderColor: stage.color || '#6366f1',
                  color: stage.color || '#6366f1'
                } : {}}
              >
                <span 
                  className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs" 
                  style={{ backgroundColor: stage.color || '#6366f1' }}
                />
                <span className="truncate max-w-[150px]">{stage.name}</span>
                {isCurrentActive && (
                  <span className={`text-[9px] font-black uppercase px-1 py-0.2 rounded ${
                    isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    Activa
                  </span>
                )}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-black ${
                  isSelected
                    ? 'bg-white/20'
                    : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-600')
                }`}>
                  {stageTasksCount}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Sprints Filter & Management Bar */}
      <div className={`px-4 py-2 border-b shrink-0 flex items-center justify-between gap-2 overflow-x-auto hide-scrollbar z-10 transition-colors ${
        isDarkMode ? 'bg-[#121212] border-white/5' : 'bg-slate-50/80 border-slate-200'
      }`}>
        <div className="flex items-center gap-1.5 overflow-x-auto hide-scrollbar">
          <div className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider shrink-0 mr-1 ${
            isDarkMode ? 'text-amber-400' : 'text-amber-600'
          }`}>
            <Zap size={13} className="fill-amber-500 text-amber-500" />
            <span className="hidden sm:inline">Sprint:</span>
          </div>

          {/* All sprints button */}
          <button
            type="button"
            onClick={() => setSelectedSprintId('all')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
              selectedSprintId === 'all'
                ? (isDarkMode 
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs font-black' 
                    : 'bg-amber-100/70 text-amber-900 border-amber-300 shadow-xs font-black')
                : (isDarkMode 
                    ? 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900')
            }`}
          >
            <span>Todos</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              selectedSprintId === 'all'
                ? (isDarkMode ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-200 text-amber-800')
                : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-600')
            }`}>
              {tasks.length}
            </span>
          </button>

          {/* Individual Sprint Pills */}
          {sprints.map((sprint: any) => {
            const isSelected = selectedSprintId === sprint.id;
            const sprintTasksCount = tasks.filter((t: any) => t.sprintId === sprint.id).length;
            return (
              <button
                key={sprint.id}
                type="button"
                onClick={() => setSelectedSprintId(isSelected ? 'all' : sprint.id)}
                className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                  isSelected
                    ? (isDarkMode 
                        ? 'bg-amber-500/25 text-amber-300 border-amber-500 shadow-xs font-black' 
                        : 'bg-amber-100 text-amber-900 border-amber-400 shadow-xs font-black')
                    : (isDarkMode 
                        ? 'bg-white/5 text-gray-300 border-white/5 hover:bg-white/10' 
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100')
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 shadow-xs" />
                <span className="truncate max-w-[140px]">{sprint.name}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  isSelected
                    ? (isDarkMode ? 'bg-amber-400/20 text-amber-200' : 'bg-amber-200 text-amber-800')
                    : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-600')
                }`}>
                  {sprintTasksCount}
                </span>
              </button>
            );
          })}

          {/* Backlog / Sin Sprint Pill */}
          <button
            type="button"
            onClick={() => setSelectedSprintId(selectedSprintId === 'unassigned' ? 'all' : 'unassigned')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
              selectedSprintId === 'unassigned'
                ? (isDarkMode 
                    ? 'bg-slate-700 text-white border-slate-500 shadow-xs font-black' 
                    : 'bg-slate-200 text-slate-900 border-slate-400 shadow-xs font-black')
                : (isDarkMode 
                    ? 'bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white' 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100')
            }`}
          >
            <span>Backlog (Sin Sprint)</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              selectedSprintId === 'unassigned'
                ? (isDarkMode ? 'bg-slate-600 text-white' : 'bg-slate-300 text-slate-800')
                : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-600')
            }`}>
              {tasks.filter((t: any) => !t.sprintId).length}
            </span>
          </button>
        </div>

        {/* Action Button: Configurar Sprints */}
        {onOpenSprintConfig && (
          <button
            type="button"
            onClick={onOpenSprintConfig}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
              isDarkMode 
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20' 
                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100 shadow-xs'
            }`}
            title="Abrir Configuración de Sprints"
          >
            <Zap size={13} className="text-amber-500 fill-amber-500" />
            <span className="hidden sm:inline">Configurar Sprints</span>
            <span className="sm:hidden">Sprints</span>
          </button>
        )}
      </div>

      {/* Mobile Header with Tabs */}
      {layout === 'mobile' && (
        <div className={`px-4 py-4 border-b shrink-0 relative flex items-center ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200 shadow-sm'}`}>
          {showLeftArrow && (
            <button onClick={() => scroll('left')} className={`absolute left-1 z-10 p-1 rounded-full shadow-lg ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
              <ChevronLeft size={16} />
            </button>
          )}
          <div ref={tabsRef} className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar snap-x snap-mandatory px-6">
            {mobileTabs.map(tab => {
              const isActive = activeColumnId === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveColumn(tab.id as KanbanColumnId)}
                  className={`flex items-center gap-3 px-5 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all snap-center shrink-0 border-2 whitespace-nowrap
                    ${isActive 
                      ? `${tab.color.replace('bg-', 'border-')} ${tab.color.replace('bg-', 'text-')} ${isDarkMode ? 'bg-white/5' : 'bg-white'} shadow-md scale-105` 
                      : `${isDarkMode ? 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10' : 'bg-slate-50 border-transparent text-slate-400 hover:bg-slate-100'}`
                    }`}
                >
                  <div className={`p-1.5 rounded-lg ${isActive ? tab.color + ' text-white' : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500')}`}>
                    {tab.icon && <tab.icon size={14} />}
                  </div>
                  {tab.label}
                  <span className={`px-2 py-0.5 rounded-full text-[9px] ${isActive ? tab.color + ' text-white' : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-500')}`}>
                    {tab.badge}
                  </span>
                </button>
              );
            })}
          </div>
          {showRightArrow && (
            <button onClick={() => scroll('right')} className={`absolute right-1 z-10 p-1 rounded-full shadow-lg ${isDarkMode ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
              <ChevronRight size={16} />
            </button>
          )}
        </div>
      )}

      {/* Board Container */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        <div 
          ref={boardRef}
          className={`flex-1 p-4 overflow-x-auto custom-scrollbar
            ${layout === 'desktop' ? 'grid grid-cols-[repeat(6,minmax(250px,1fr))] gap-4 snap-x snap-mandatory overscroll-x-contain' : ''}
            ${layout === 'tablet' ? 'grid grid-cols-[repeat(6,minmax(320px,1fr))] gap-4 snap-x snap-mandatory overscroll-x-contain' : ''}
            ${layout === 'mobile' ? 'flex flex-col h-full' : ''}
          `}
        >
          {layout === 'mobile' ? (
            <div className="flex-1 overflow-y-auto px-1 pb-24">
              <AnimatePresence>
                {activeColumn && (
                  <motion.div
                    key={activeColumn.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex-1 flex flex-col"
                  >
                    <KanbanColumn
                      column={activeColumn}
                      tasks={tasksByStatus[activeColumn.id] || []}
                      layout={layout}
                      permissions={permissions}
                      onAddTask={handleAddTask}
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      isDarkMode={isDarkMode}
                    >
                      {(tasksByStatus[activeColumn.id] || []).map(task => {
                        const assignedStudent = students.find((s: any) => s.id === task.assignedTo);
                        const initials = assignedStudent ? `${assignedStudent.firstName.charAt(0)}${assignedStudent.lastNamePaterno.charAt(0)}` : '?';
                        return (
                          <KanbanCard 
                            key={task.id}
                            task={task}
                            layout={layout}
                            userRole={userRole}
                            permissions={permissions}
                            draggedTask={draggedTask}
                            initials={initials}
                            assignedStudent={assignedStudent}
                            students={students}
                            stages={project?.stages || []}
                            sprints={sprints}
                            onFilterByStage={(stageId) => setSelectedStageId(stageId)}
                            onFilterBySprint={(sprintId) => setSelectedSprintId(sprintId)}
                            onSelect={setSelectedTaskId}
                            onDelete={deleteTask}
                            onApprove={handleApproveTask}
                            onReject={(task) => setRejectionModal({ taskId: task.id, title: task.title })}
                            onDragStart={handleDragStart}
                            onDragEnd={() => setDraggedTask(null)}
                            onMoveTask={(taskId) => setMovingTaskId(taskId)}
                            isDarkMode={isDarkMode}
                          />
                        );
                      })}
                    </KanbanColumn>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            columnsToRender.map(col => (
              <div key={col.id} className="h-full snap-center">
                <KanbanColumn
                  column={col}
                  tasks={tasksByStatus[col.id] || []}
                  layout={layout}
                  permissions={permissions}
                  onAddTask={handleAddTask}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  isDarkMode={isDarkMode}
                >
                  {(tasksByStatus[col.id] || []).map(task => {
                    const assignedStudent = students.find((s: any) => s.id === task.assignedTo);
                    const initials = assignedStudent ? `${assignedStudent.firstName.charAt(0)}${assignedStudent.lastNamePaterno.charAt(0)}` : '?';
                    return (
                      <KanbanCard 
                        key={task.id}
                        task={task}
                        layout={layout}
                        userRole={userRole}
                        permissions={permissions}
                        draggedTask={draggedTask}
                        initials={initials}
                        assignedStudent={assignedStudent}
                        students={students}
                        stages={project?.stages || []}
                        sprints={sprints}
                        onFilterByStage={(stageId) => setSelectedStageId(stageId)}
                        onFilterBySprint={(sprintId) => setSelectedSprintId(sprintId)}
                        onSelect={setSelectedTaskId}
                        onDelete={deleteTask}
                        onApprove={handleApproveTask}
                        onReject={(task) => setRejectionModal({ taskId: task.id, title: task.title })}
                        onDragStart={handleDragStart}
                        onDragEnd={() => setDraggedTask(null)}
                        onMoveTask={(taskId, newStatus) => layout === 'tablet' ? handleMoveTask(taskId, newStatus) : setMovingTaskId(taskId)}
                        isDarkMode={isDarkMode}
                      />
                    );
                  })}
                </KanbanColumn>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Mobile Move Task BottomSheet */}
      <BottomSheet 
        isOpen={!!movingTaskId} 
        onClose={() => setMovingTaskId(null)}
        title="Mover tarea a..."
        isDarkMode={isDarkMode}
      >
        <div className="grid grid-cols-1 gap-3 p-4">
          {KANBAN_COLUMNS.filter(c => c.id !== 'pending_approval').map(col => (
            <button
              key={col.id}
              onClick={() => movingTaskId && handleMoveTask(movingTaskId, col.id)}
              className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'border-white/5 hover:border-indigo-500/30 active:bg-white/5' : 'border-slate-100 hover:border-indigo-100 active:bg-slate-50'}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${col.color} flex items-center justify-center text-white`}>
                  <col.icon size={20} />
                </div>
                <div className="text-left">
                  <p className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{col.title}</p>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{col.shortLabel}</p>
                </div>
              </div>
              <ChevronRight size={20} className={isDarkMode ? 'text-gray-600' : 'text-slate-300'} />
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Task Proposal Modal */}
      <AnimatePresence>
        {isProposingTask && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className={`w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}
            >
              <div className={`p-6 border-b flex justify-between items-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                <div>
                  <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Proponer Tarea</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Formulario Reducido</p>
                </div>
                <button onClick={() => setIsProposingTask(false)} className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-200'}`}>
                  <XCircle size={24} className={isDarkMode ? 'text-gray-500' : 'text-slate-400'} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Título de la tarea *</label>
                  <input 
                    type="text" 
                    value={proposalForm.title}
                    onChange={e => setProposalForm({...proposalForm, title: e.target.value})}
                    placeholder="Ej: Reparar fuga en baño principal"
                    className={`w-full p-4 border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/5 text-white placeholder:text-gray-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  />
                </div>

                <div className="space-y-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Descripción</label>
                  <textarea 
                    value={proposalForm.description}
                    onChange={e => setProposalForm({...proposalForm, description: e.target.value})}
                    placeholder="Detalles adicionales sobre la tarea..."
                    className={`w-full p-4 border rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm min-h-[100px] ${isDarkMode ? 'bg-white/5 border-white/5 text-white placeholder:text-gray-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Tipo</label>
                    <select 
                      value={proposalForm.type || 'LEVANTAMIENTO'}
                      onChange={e => setProposalForm({...proposalForm, type: e.target.value})}
                      className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
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
                        <option key={t} value={t} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Esfuerzo (Horas)</label>
                    <input 
                      type="number" 
                      step="0.5"
                      min="0.5"
                      max="480"
                      value={proposalForm.effort || 0}
                      onChange={e => setProposalForm({...proposalForm, effort: Number(e.target.value)})}
                      className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/5 text-white' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha Inicio</label>
                    <input 
                      type="date" 
                      value={proposalForm.startDate.split('T')[0]}
                      onChange={e => setProposalForm({...proposalForm, startDate: new Date(`${e.target.value}T00:00:00`).toISOString()})}
                      className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/5 text-white [color-scheme:dark]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha Fin</label>
                    <input 
                      type="date" 
                      value={proposalForm.endDate.split('T')[0]}
                      onChange={e => setProposalForm({...proposalForm, endDate: new Date(`${e.target.value}T00:00:00`).toISOString()})}
                      className={`w-full p-3 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold ${isDarkMode ? 'bg-white/5 border-white/5 text-white [color-scheme:dark]' : 'bg-slate-50 border-slate-200 text-slate-700'}`}
                    />
                  </div>
                </div>

                <div className="pt-4 space-y-4">
                  <button 
                    onClick={handleProposeTask}
                    className={`w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-lg ${isDarkMode ? 'shadow-indigo-500/10' : 'shadow-indigo-200'}`}
                  >
                    <Send size={18} /> Proponer Tarea
                  </button>
                  <p className={`text-xs text-center ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                    Tu tarea será revisada por el administrador antes de aparecer en el tablero del proyecto.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectionModal && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}
            >
              <div className={`p-6 border-b ${isDarkMode ? 'bg-red-500/10 border-white/5' : 'bg-red-50 border-slate-100'}`}>
                <h3 className={`text-xl font-black ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>Rechazar Tarea</h3>
                <p className={`text-xs font-bold uppercase tracking-widest truncate ${isDarkMode ? 'text-red-500/70' : 'text-red-500'}`}>{rejectionModal.title}</p>
              </div>
              <div className="p-6 space-y-4">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Motivo del rechazo (mín. 10 caracteres)</label>
                <textarea 
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Explica por qué se rechaza la propuesta..."
                  className={`w-full p-4 border rounded-2xl focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[120px] ${isDarkMode ? 'bg-white/5 border-white/5 text-white placeholder:text-gray-600' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => { setRejectionModal(null); setRejectionReason(''); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-slate-500 hover:bg-slate-100'}`}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleRejectTask}
                    disabled={rejectionReason.length < 10}
                    className="flex-1 bg-red-600 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    Confirmar Rechazo
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

export default KanbanBoard;
