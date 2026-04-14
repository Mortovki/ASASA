import React, { useState, useEffect, useRef } from 'react';
import { 
  GanttChartSquare, 
  Columns, 
  Table2, 
  LayoutDashboard, 
  ArrowLeft, 
  Activity, 
  RefreshCw, 
  MoreHorizontal, 
  Link as LinkIcon,
  ChevronDown,
  CheckCircle2,
  Trash2,
  GitBranch,
  Columns2,
  LucideIcon,
  Settings2,
  ChevronRight,
  Flag,
  Bell,
  Share2,
  Search,
  User
} from 'lucide-react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Stage } from '../types/stage';
import { StageEditor } from './StageEditor';
import toast from 'react-hot-toast';
import GanttView from './GanttView';
import KanbanBoard from './KanbanBoard';
import SprintTable from './SprintTable';
import ProjectDashboard from './ProjectDashboard';
import { CriticalPathAnalysis } from './CriticalPathAnalysis';
import DeletedTasksView from './DeletedTasksView';
import { ProjectResources } from './ProjectResources';
import { useTasks } from '../hooks/useTasks';
import { usePermissions } from '../hooks/usePermissions';
import { motion, AnimatePresence } from 'motion/react';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { BottomSheet } from './ui/BottomSheet';

interface Tab {
  id: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const ProjectWorkspace = ({ projectId, project, userRole, currentUser, onBack, students, initialTaskId, isDarkMode, onOpenNotifications, unreadNotifications }: any) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(initialTaskId || null);
  const [selectedAssignee, setSelectedAssignee] = useState<string>('all');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [showStageEditor, setShowStageEditor] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const { isMobile, width, breakpoint } = useBreakpoint();
  const isTablet = breakpoint === 'tablet';

  useEffect(() => {
    if (initialTaskId) {
      setActiveTab('kanban');
      setSelectedTaskId(initialTaskId);
    }
  }, [initialTaskId]);

  // Cerrar al hacer clic fuera (solo escritorio/tablet)
  useEffect(() => {
    if (isMobile || !moreMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(e.target as Node) &&
        !moreButtonRef.current?.contains(e.target as Node)
      ) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [moreMenuOpen, isMobile]);

  // Cerrar al presionar Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreMenuOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Navegación por teclado en el menú (solo escritorio/tablet)
  useEffect(() => {
    if (!moreMenuOpen || isMobile) return;
    const handler = (e: KeyboardEvent) => {
      const menuItems = moreMenuRef.current?.querySelectorAll('[role="menuitem"]') as NodeListOf<HTMLButtonElement>;
      if (!menuItems?.length) return;

      const currentIndex = Array.from(menuItems).indexOf(document.activeElement as HTMLButtonElement);

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % menuItems.length;
        menuItems[nextIndex].focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        menuItems[prevIndex].focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [moreMenuOpen, isMobile]);

  // Cerrar el menú al cambiar de pestaña
  useEffect(() => {
    setMoreMenuOpen(false);
  }, [activeTab]);

  const { 
    tasks, 
    loading: isLoading, 
    updateTaskStatus, 
    updateTaskField, 
    updateTaskDates,
    deleteTask, 
    restoreTask, 
    permanentDelete,
    addTask
  } = useTasks(projectId, userRole);
  
  const permissions = usePermissions(userRole);

  const filteredTasks = tasks.filter((task: any) => {
    if (selectedAssignee === 'all') return true;
    if (selectedAssignee === 'unassigned') return !task.assignedTo;
    return task.assignedTo === selectedAssignee;
  });

  const handleSaveStages = async (stages: Stage[], startDate?: string | null, endDate?: string | null) => {
    try {
      const projectRef = doc(db, 'projects', projectId);
      const updates: any = { stages };
      if (startDate !== undefined) updates.startDate = startDate;
      if (endDate !== undefined) updates.endDate = endDate;
      
      await updateDoc(projectRef, updates);
      toast.success('Configuración del proyecto actualizada');
    } catch (error) {
      console.error("Error updating stages:", error);
      toast.error('Error al actualizar la configuración');
      const { handleFirestoreError, OperationType } = await import('../firebase');
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
      throw error;
    }
  };

  const handleSetStage = async (index: number) => {
    if (userRole !== 'admin') return;
    try {
      const projectRef = doc(db, 'projects', projectId);
      await updateDoc(projectRef, { currentStageIndex: index });
      toast.success(`Etapa cambiada a: ${project.stages[index].name}`);
    } catch (error) {
      console.error("Error setting stage:", error);
      toast.error('Error al cambiar de etapa');
      const { handleFirestoreError, OperationType } = await import('../firebase');
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
    }
  };

  const ALL_TABS: Tab[] = [
    { id: 'dashboard', label: 'Dashboard', shortLabel: 'Panel', icon: LayoutDashboard },
    { id: 'kanban', label: 'Tablero', shortLabel: 'Tablero', icon: Columns2 },
    { id: 'gantt', label: 'Gantt', shortLabel: 'Gantt', icon: GanttChartSquare },
    { id: 'sprints', label: 'Sprints', shortLabel: 'Sprints', icon: Table2 },
    { id: 'stages', label: 'Etapas', shortLabel: 'Etapas', icon: Flag, adminOnly: true },
    { id: 'resources', label: 'Recursos', shortLabel: 'Recursos', icon: LinkIcon },
    { id: 'cpm', label: 'Ruta Crítica', shortLabel: 'Ruta', icon: GitBranch },
    { id: 'trash', label: 'Papelera', shortLabel: 'Papelera', icon: Trash2, adminOnly: true },
  ];

  const filteredAllTabs = ALL_TABS.filter(t => !t.adminOnly || userRole === 'admin');
  const visibleTabs = filteredAllTabs.filter(t => t.id !== 'cpm' && t.id !== 'trash' && t.id !== 'stages');
  const overflowTabs = filteredAllTabs.filter(t => t.id === 'cpm' || t.id === 'trash' || t.id === 'stages');

  const hasOverflow = overflowTabs.length > 0;
  const activeIsInOverflow = overflowTabs.some(t => t.id === activeTab);

  const renderTab = (tab: Tab) => {
    const Icon = tab.icon;
    const isActive = activeTab === tab.id;
    const pendingCount = tab.id === 'kanban' && userRole === 'admin' 
      ? tasks.filter((t: any) => t.status === 'pending_approval').length 
      : 0;

    return (
      <button
        key={tab.id}
        onClick={() => {
          setActiveTab(tab.id);
          setMoreMenuOpen(false);
        }}
        className={`
          flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl 
          text-sm font-bold transition-all whitespace-nowrap relative shrink-0 
          ${isMobile || isTablet ? 'snap-center' : ''} 
          ${isActive 
            ? (isDarkMode ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50') 
            : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50')}
        `}
        title={isMobile || isTablet ? tab.label : undefined}
      >
        <Icon size={18} />
        {!isMobile && !isTablet && (
          <span>{tab.label}</span>
        )}
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
      {/* Header Section */}
      <div className={`border-b z-20 relative shadow-sm ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-200'}`}>
        {/* Top Row: Project Info */}
        <div className={`px-4 sm:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between border-b gap-3 ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white border-slate-100'} ${isTablet ? 'h-14' : ''}`}>
          <div className="flex flex-col gap-3 w-full sm:w-auto">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3 sm:gap-4">
                <button onClick={onBack} className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}`}>
                  <ArrowLeft size={18} />
                </button>
                <div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className={`font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'} ${isTablet ? 'text-lg max-w-[150px]' : 'text-base sm:text-2xl max-w-[140px] sm:max-w-md xl:max-w-xl'}`}>
                      {project?.name || 'Proyecto'}
                    </h2>
                    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border shadow-sm shrink-0 ${isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-50 text-green-700 border-green-200/60'}`}>
                      <motion.div 
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-green-500 rounded-full"
                      />
                      <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest">En vivo</span>
                    </div>
                  </div>
                  {!isTablet && <p className={`text-[8px] sm:text-[10px] font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Espacio de Trabajo</p>}
                </div>
              </div>

              {isMobile && (
                <button 
                  onClick={() => userRole === 'admin' && setActiveTab('stages')}
                  className={`p-1.5 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Settings2 size={18} />
                </button>
              )}
            </div>

            {/* Mobile Assignee Selector - Specifically for Kanban/Sprints */}
            {isMobile && (activeTab === 'kanban' || activeTab === 'sprints') && (
              <div className="relative flex items-center w-full">
                <select
                  value={selectedAssignee}
                  onChange={(e) => setSelectedAssignee(e.target.value)}
                  className={`appearance-none pl-8 pr-8 py-2 text-xs font-medium rounded-xl border shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full ${
                    isDarkMode 
                      ? 'bg-[#2a2a2a] border-white/10 text-white hover:bg-[#333]' 
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <option value="all">Todos los prestadores</option>
                  <option value="unassigned">Sin asignar</option>
                  {students?.map((s: any, idx: number) => (
                    <option key={`${s.id || 'student'}-${idx}`} value={s.id}>
                      {s.firstName} {s.lastNamePaterno || ''}
                    </option>
                  ))}
                </select>
                <div className="absolute left-2.5 pointer-events-none">
                  <User size={14} className={isDarkMode ? 'text-gray-400' : 'text-slate-400'} />
                </div>
                <div className="absolute right-2.5 pointer-events-none">
                  <ChevronDown size={14} className={isDarkMode ? 'text-gray-400' : 'text-slate-400'} />
                </div>
              </div>
            )}
          </div>
          
          {/* Desktop/Tablet Assignee Selector */}
          {!isMobile && (
            <div className="flex items-center gap-2">
              {(activeTab === 'kanban' || activeTab === 'sprints') && (
                <div className="relative flex items-center mr-2">
                  <select
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    className={`appearance-none pl-8 pr-8 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-xl border shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-full ${
                      isDarkMode 
                        ? 'bg-[#2a2a2a] border-white/10 text-white hover:bg-[#333]' 
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <option value="all">Todos los prestadores</option>
                    <option value="unassigned">Sin asignar</option>
                    {students?.map((s: any, idx: number) => (
                      <option key={`${s.id || 'student'}-${idx}`} value={s.id}>
                        {s.firstName} {s.lastNamePaterno || ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute left-2.5 pointer-events-none">
                    <User size={14} className={isDarkMode ? 'text-gray-400' : 'text-slate-400'} />
                  </div>
                  <div className="absolute right-2.5 pointer-events-none">
                    <ChevronDown size={14} className={isDarkMode ? 'text-gray-400' : 'text-slate-400'} />
                  </div>
                </div>
              )}
              <button 
                onClick={() => userRole === 'admin' && setActiveTab('stages')}
                className={`p-1.5 sm:p-2 transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                title="Configuración de Etapas"
              >
                <Settings2 size={18} />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Row: Navigation Tabs */}
        <div className="px-2 sm:px-8 py-2 flex items-center justify-center">
          <div className={`p-1 rounded-2xl w-full lg:w-auto relative border shadow-inner flex justify-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100/80 border-slate-200/50'}`}>
            <div className={`flex gap-1 overflow-x-auto hide-scrollbar flex-1 lg:flex-none justify-center ${isMobile || isTablet ? 'snap-x snap-mandatory' : ''}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {visibleTabs.map(renderTab)}
            </div>
            
            {hasOverflow && (
              <div className="relative ml-1 shrink-0">
                <button
                  ref={moreButtonRef}
                  onClick={() => setMoreMenuOpen(prev => !prev)}
                  aria-expanded={moreMenuOpen}
                  aria-haspopup="true"
                  aria-label="Más pestañas"
                  className={`
                    flex items-center gap-1.5 px-4 py-2 rounded-xl
                    text-sm font-bold transition-all duration-150
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400
                    ${moreMenuOpen || activeIsInOverflow
                      ? (isDarkMode ? 'bg-white/10 text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200/50')
                      : (isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50')}
                  `}
                >
                  <MoreHorizontal className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Más</span>
                  <motion.span
                    animate={{ rotate: moreMenuOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="hidden sm:inline"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </motion.span>

                  {activeIsInOverflow && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-500 rounded-full" />
                  )}
                </button>

                {!isMobile && (
                  <AnimatePresence>
                    {moreMenuOpen && (
                      <motion.div
                        ref={moreMenuRef}
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={`
                          absolute right-0 top-full mt-2 z-50
                          min-w-[200px]
                          rounded-2xl shadow-xl
                          border
                          py-1.5 overflow-hidden
                          ${isDarkMode ? 'bg-[#2a2a2a] border-white/10' : 'bg-white border-slate-100'}
                        `}
                        role="menu"
                      >
                        {overflowTabs.map(tab => (
                          <button
                            key={tab.id}
                            role="menuitem"
                            onClick={() => {
                              setActiveTab(tab.id);
                              setMoreMenuOpen(false);
                            }}
                            className={`
                              w-full flex items-center gap-3
                              px-4 py-3 text-sm text-left
                              transition-colors duration-100
                              focus:outline-none focus-visible:bg-indigo-50
                              ${activeTab === tab.id
                                ? (isDarkMode ? 'bg-white/10 text-white font-bold' : 'bg-indigo-50 text-indigo-700 font-bold')
                                : (isDarkMode ? 'text-gray-300 hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50')}
                            `}
                          >
                            <tab.icon className={`w-4 h-4 flex-shrink-0
                              ${activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400'}`}
                            />
                            {tab.label}
                            {activeTab === tab.id && (
                              <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            )}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobile && (
        <BottomSheet
          isOpen={moreMenuOpen}
          onClose={() => setMoreMenuOpen(false)}
          title="Más opciones"
          isDarkMode={isDarkMode}
        >
          <div className="pb-8">
            {overflowTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setMoreMenuOpen(false);
                }}
                className={`
                  w-full flex items-center gap-4
                  px-4 py-4 rounded-2xl mb-2
                  transition-all active:scale-[0.98]
                  ${activeTab === tab.id
                    ? (isDarkMode ? 'bg-white/10 border border-white/20' : 'bg-indigo-50 border border-indigo-200')
                    : (isDarkMode ? 'bg-white/5 border border-transparent' : 'bg-slate-50 border border-transparent')}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center
                  flex-shrink-0
                  ${activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : (isDarkMode ? 'bg-[#1a1a1a] text-gray-400 border border-white/10' : 'bg-white text-slate-500 border border-slate-200')}
                `}>
                  <tab.icon className="w-5 h-5" />
                </div>
                <span className={`text-sm font-bold
                  ${activeTab === tab.id ? (isDarkMode ? 'text-white' : 'text-indigo-700') : (isDarkMode ? 'text-gray-300' : 'text-slate-800')}`}>
                  {tab.label}
                </span>
                {activeTab === tab.id && (
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 ml-auto" />
                )}
              </button>
            ))}
          </div>
        </BottomSheet>
      )}

      <div className={`flex-1 ${activeTab === 'kanban' || activeTab === 'gantt' ? 'overflow-hidden' : 'overflow-auto'} p-4 sm:p-6 ${isDarkMode ? 'bg-[#0a0a0a]' : 'bg-slate-50'}`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <ProjectDashboard 
                tasks={tasks} 
                projectId={projectId} 
                project={project}
                students={students} 
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'kanban' && (
              <KanbanBoard 
                tasks={filteredTasks} 
                projectId={projectId} 
                userRole={userRole} 
                currentUser={currentUser} 
                students={students}
                updateTaskStatus={updateTaskStatus}
                updateTaskField={updateTaskField}
                deleteTask={deleteTask}
                addTask={addTask}
                permissions={permissions}
                initialTaskId={selectedTaskId}
                onTaskOpened={() => setSelectedTaskId(null)}
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'gantt' && (
              <GanttView 
                tasks={tasks} 
                projectId={projectId} 
                project={project} 
                userRole={userRole} 
                currentUser={currentUser} 
                students={students}
                updateTaskStatus={updateTaskStatus}
                updateTaskField={updateTaskField}
                updateTaskDates={updateTaskDates}
                deleteTask={deleteTask}
                permissions={permissions}
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'sprints' && (
              <SprintTable 
                tasks={filteredTasks} 
                projectId={projectId} 
                project={project}
                userRole={userRole} 
                currentUser={currentUser} 
                students={students}
                updateTaskStatus={updateTaskStatus}
                updateTaskField={updateTaskField}
                deleteTask={deleteTask}
                addTask={addTask}
                permissions={permissions}
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'stages' && (
              <StageEditor
                project={project}
                tasks={tasks}
                onSave={handleSaveStages}
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'resources' && (
              <ProjectResources 
                projectId={projectId}
                permissions={permissions}
                isDarkMode={isDarkMode}
              />
            )}
            {activeTab === 'cpm' && <CriticalPathAnalysis tasks={tasks as any} isDarkMode={isDarkMode} />}
            {activeTab === 'trash' && (
              <DeletedTasksView 
                projectId={projectId} 
                restoreTask={restoreTask} 
                permanentDelete={permanentDelete}
                students={students}
                isDarkMode={isDarkMode}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectWorkspace;
