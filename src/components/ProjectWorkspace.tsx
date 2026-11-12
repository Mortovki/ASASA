import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  GanttChartSquare, 
  Table2, 
  LayoutDashboard, 
  ArrowLeft, 
  RefreshCw, 
  CheckCircle2, 
  Trash2, 
  GitBranch, 
  Settings2, 
  Flag, 
  Zap, 
  Layers,
  Link as LinkIcon,
  Calendar,
  Users,
  Check,
  AlertCircle
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { Stage } from '../types/stage';
import { StageEditor } from './StageEditor';
import toast from 'react-hot-toast';
import GanttView from './GanttView';
import SprintTable from './SprintTable';
import ProjectDashboard from './ProjectDashboard';
import { CriticalPathAnalysis } from './CriticalPathAnalysis';
import DeletedTasksView from './DeletedTasksView';
import { ProjectResources } from './ProjectResources';
import { useTasks } from '../hooks/useTasks';
import { useSprints } from '../hooks/useSprints';
import { usePermissions } from '../hooks/usePermissions';
import { SprintConfigModal } from './sprints/SprintConfigModal';
import { TaskWorkspace } from './TaskWorkspace/TaskWorkspace';

type MainTab = 'resumen' | 'tareas' | 'planificacion' | 'recursos' | 'configuracion';
type PlanningSubTab = 'sprints' | 'stages' | 'cpm' | 'gantt';
type ConfigSubTab = 'general' | 'stages' | 'trash';

interface TaskDrillFilter {
  stageId?: string;
  status?: string;
  assigneeId?: string;
  isCritical?: boolean;
}

const ProjectWorkspace = ({ 
  projectId, 
  project, 
  userRole, 
  currentUser, 
  onBack, 
  students, 
  initialTaskId, 
  isDarkMode 
}: any) => {
  const [currentProject, setCurrentProject] = useState<any>(project);
  
  // 4-level navigation state: Default landing view is 'resumen'
  const [activeTab, setActiveTab] = useState<MainTab>('resumen');
  const [planningSubTab, setPlanningSubTab] = useState<PlanningSubTab>('sprints');
  const [configSubTab, setConfigSubTab] = useState<ConfigSubTab>('general');
  const [showSprintModal, setShowSprintModal] = useState(false);
  
  // Drill-down filter passed when clicking KPI/charts in Resumen
  const [drillFilter, setDrillFilter] = useState<TaskDrillFilter | null>(null);

  const { sprints, addSprint, updateSprint, deleteSprint } = useSprints(projectId);

  useEffect(() => {
    if (project) {
      setCurrentProject(project);
    }
  }, [project]);

  useEffect(() => {
    if (!projectId) return;
    const unsub = onSnapshot(doc(db, 'projects', projectId), (docSnap) => {
      if (docSnap.exists()) {
        setCurrentProject({ id: docSnap.id, ...docSnap.data() });
      }
    }, (error) => {
      console.error("Error listening to project document:", error);
    });
    return () => unsub();
  }, [projectId]);

  useEffect(() => {
    if (initialTaskId) {
      setActiveTab('tareas');
    }
  }, [initialTaskId]);

  const { 
    tasks, 
    loading: isLoading, 
    updateTaskStatus, 
    updateTaskField, 
    updateTaskFields,
    updateTaskDates,
    deleteTask, 
    restoreTask, 
    permanentDelete,
    addTask
  } = useTasks(projectId, userRole);
  
  const permissions = usePermissions(userRole);

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
      handleFirestoreError(error, OperationType.UPDATE, `projects/${projectId}`);
      throw error;
    }
  };

  // Callback from Resumen when user clicks a KPI, stage, status, or workload bar
  const handleDrillDownToTasks = (filter: TaskDrillFilter) => {
    setDrillFilter(filter);
    setActiveTab('tareas');
  };

  // Callback from Resumen to jump directly into planning tools
  const handleNavigateToPlanning = (tool: 'sprints' | 'stages' | 'cpm' | 'gantt') => {
    setPlanningSubTab(tool);
    setActiveTab('planificacion');
  };

  const MAIN_NAV_ITEMS = [
    { id: 'resumen', label: 'Resumen', icon: LayoutDashboard },
    { id: 'tareas', label: 'Tareas', icon: Layers },
    { id: 'planificacion', label: 'Planificación', icon: Calendar },
    { id: 'recursos', label: 'Recursos', icon: LinkIcon },
    { id: 'configuracion', label: 'Configuración', icon: Settings2 },
  ];

  return (
    <div className={`flex flex-col h-full ${isDarkMode ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
      {/* =========================================================================
          NIVEL 1: Encabezado del Proyecto (Breadcrumbs, Conexión/Guardado, Acciones)
          ========================================================================= */}
      <div className={`border-b z-20 relative shrink-0 ${isDarkMode ? 'bg-[#1e293b] border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button 
              onClick={onBack} 
              className={`p-2 rounded-xl transition-colors shrink-0 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Volver a Proyectos"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold min-w-0">
              <button 
                onClick={onBack} 
                className="text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shrink-0"
              >
                Proyectos
              </button>
              <span className="text-slate-300 dark:text-slate-600 font-normal shrink-0">/</span>
              <span className={`font-black tracking-tight truncate max-w-xs sm:max-w-md ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {currentProject?.name || project?.name || 'Proyecto'}
              </span>
            </div>
          </div>

          {/* Estado de sincronización y Acciones rápidas */}
          <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
            {/* Indicador de Guardado idéntico al diseño objetivo de Tareas */}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shadow-xs ${
              isDarkMode 
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/80' 
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}>
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span>Guardado</span>
            </div>

            {/* Botón de configuración de Sprints */}
            <button
              type="button"
              onClick={() => setShowSprintModal(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs cursor-pointer ${
                isDarkMode 
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20' 
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
              title="Configuración de Ciclos y Sprints"
            >
              <Zap size={14} className="text-amber-500 fill-amber-500" />
              <span>Sprints</span>
              {sprints.length > 0 && (
                <span className={`text-[10px] px-1.5 rounded-full font-black ${
                  isDarkMode ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-200 text-amber-800'
                }`}>
                  {sprints.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* =========================================================================
            NIVEL 2: Navegación Principal (Resumen · Tareas · Planificación · Recursos · Configuración)
            ========================================================================= */}
        <div className="px-4 sm:px-8 flex items-center border-t border-slate-100 dark:border-slate-800/80 overflow-x-auto hide-scrollbar">
          <div className="flex items-center gap-6 sm:gap-8">
            {MAIN_NAV_ITEMS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as MainTab);
                  }}
                  className={`py-3 px-1 font-bold text-xs sm:text-sm flex items-center gap-2 border-b-2 transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? (isDarkMode 
                          ? 'border-indigo-500 text-white font-black' 
                          : 'border-indigo-600 text-indigo-600 font-black')
                      : (isDarkMode 
                          ? 'border-transparent text-slate-400 hover:text-white' 
                          : 'border-transparent text-slate-500 hover:text-slate-900')
                  }`}
                >
                  <Icon size={16} className={isActive ? (isDarkMode ? 'text-indigo-400' : 'text-indigo-600') : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* =========================================================================
          NIVEL 3 & 4: Controles de Contexto y Área de Trabajo
          ========================================================================= */}
      <div className="flex-1 overflow-auto flex flex-col">
        {/* VISTA 1: RESUMEN (Dashboard con KPIs clicables hacia Tareas) */}
        {activeTab === 'resumen' && (
          <div className="p-4 sm:p-6 flex-1">
            <ProjectDashboard 
              tasks={tasks} 
              projectId={projectId} 
              project={currentProject}
              students={students} 
              isDarkMode={isDarkMode}
              userRole={userRole}
              onNavigateToTasks={handleDrillDownToTasks}
              onNavigateToPlanning={handleNavigateToPlanning}
            />
          </div>
        )}

        {/* VISTA 2: TAREAS (Tabla interactiva estilo Monday, Kanban, Gantt, Calendario) */}
        {activeTab === 'tareas' && (
          <div className="flex-1 p-4 sm:p-6 flex flex-col">
            <TaskWorkspace
              initialProjectId={projectId}
              projects={currentProject ? [currentProject] : []}
              enrolledProjectIds={projectId ? [projectId] : undefined}
              students={students}
              currentUserId={currentUser?.uid || ''}
              currentUserName={currentUser?.displayName || 'Usuario'}
              currentUserRole={userRole}
              isDarkMode={isDarkMode}
              stages={currentProject?.stages || []}
              sprints={sprints}
              initialGrouping="stage"
              initialStageFilter={drillFilter?.stageId || 'all'}
              initialStatusFilter={drillFilter?.status || 'all'}
              initialAssigneeFilter={drillFilter?.assigneeId || 'all'}
              initialIsCriticalFilter={drillFilter?.isCritical || false}
              onOpenSprintConfig={() => setShowSprintModal(true)}
              onNavigateToPlanning={handleNavigateToPlanning}
            />
          </div>
        )}

        {/* VISTA 3: PLANIFICACIÓN (Herramientas especializadas con sub-pestañas) */}
        {activeTab === 'planificacion' && (
          <div className="flex-1 flex flex-col p-4 sm:p-6">
            {/* Level 3: Sub-navigation bar for Planificación */}
            <div className="flex items-center gap-2 mb-4 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 self-start border border-slate-300/40 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setPlanningSubTab('sprints')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  planningSubTab === 'sprints'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Sprints y Ciclos
              </button>
              <button
                type="button"
                onClick={() => setPlanningSubTab('stages')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  planningSubTab === 'stages'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Etapas del Proyecto
              </button>
              <button
                type="button"
                onClick={() => setPlanningSubTab('cpm')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  planningSubTab === 'cpm'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Ruta Crítica (CPM)
              </button>
              <button
                type="button"
                onClick={() => setPlanningSubTab('gantt')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  planningSubTab === 'gantt'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Cronograma Gantt
              </button>
            </div>

            {/* Sub-view Area */}
            <div className="flex-1 min-h-0">
              {planningSubTab === 'sprints' && (
                <SprintTable 
                  tasks={tasks} 
                  projectId={projectId} 
                  project={currentProject}
                  userRole={userRole} 
                  currentUser={currentUser} 
                  students={students}
                  sprints={sprints}
                  onOpenSprintConfig={() => setShowSprintModal(true)}
                  updateTaskStatus={updateTaskStatus}
                  updateTaskField={updateTaskField}
                  updateTaskFields={updateTaskFields}
                  deleteTask={deleteTask}
                  addTask={addTask}
                  permissions={permissions}
                  isDarkMode={isDarkMode}
                />
              )}

              {planningSubTab === 'stages' && (
                <StageEditor
                  project={currentProject}
                  tasks={tasks}
                  onSave={handleSaveStages}
                  isDarkMode={isDarkMode}
                  addTask={addTask}
                  updateTaskStatus={updateTaskStatus}
                  updateTaskField={updateTaskField}
                  deleteTask={deleteTask}
                  students={students}
                  currentUser={currentUser}
                  userRole={userRole}
                  permissions={permissions}
                  onSelectTask={() => {
                    setActiveTab('tareas');
                  }}
                />
              )}

              {planningSubTab === 'cpm' && (
                <CriticalPathAnalysis 
                  tasks={tasks as any} 
                  stages={currentProject?.stages || []} 
                  isDarkMode={isDarkMode} 
                />
              )}

              {planningSubTab === 'gantt' && (
                <GanttView 
                  tasks={tasks} 
                  projectId={projectId} 
                  project={currentProject} 
                  userRole={userRole} 
                  currentUser={currentUser} 
                  students={students}
                  sprints={sprints}
                  addTask={addTask}
                  updateTaskStatus={updateTaskStatus}
                  updateTaskField={updateTaskField}
                  updateTaskFields={updateTaskFields}
                  updateTaskDates={updateTaskDates}
                  onSaveStages={handleSaveStages}
                  deleteTask={deleteTask}
                  permissions={permissions}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          </div>
        )}

        {/* VISTA 4: RECURSOS (Materiales, Enlaces y Documentación) */}
        {activeTab === 'recursos' && (
          <div className="p-4 sm:p-6 flex-1">
            <ProjectResources 
              projectId={projectId}
              permissions={permissions}
              isDarkMode={isDarkMode}
            />
          </div>
        )}

        {/* VISTA 5: CONFIGURACIÓN (General, Etapas y Papelera integrada) */}
        {activeTab === 'configuracion' && (
          <div className="p-4 sm:p-6 flex-1 flex flex-col space-y-4">
            {/* Level 3: Sub-navigation bar for Configuración */}
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 self-start border border-slate-300/40 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => setConfigSubTab('general')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  configSubTab === 'general'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Información General
              </button>
              {permissions.isCoordinator && (
                <button
                  type="button"
                  onClick={() => setConfigSubTab('stages')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    configSubTab === 'stages'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Etapas y Fechas
                </button>
              )}
              {permissions.isCoordinator && (
                <button
                  type="button"
                  onClick={() => setConfigSubTab('trash')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    configSubTab === 'trash'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400'
                  }`}
                >
                  <Trash2 size={13} />
                  <span>Papelera de Tareas</span>
                </button>
              )}
            </div>

            {/* Config Sub-view Content */}
            <div className="flex-1">
              {configSubTab === 'general' && (
                <div className={`p-6 rounded-2xl border space-y-6 max-w-3xl ${
                  isDarkMode ? 'bg-[#1e293b] border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}>
                  <div>
                    <h3 className="text-base font-black">Configuración del Proyecto</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Identificador, fechas maestras y descripción general del proyecto.
                    </p>
                  </div>

                  <div className="space-y-4 text-xs font-bold">
                    <div>
                      <label className="text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                        Nombre del Proyecto
                      </label>
                      <input 
                        type="text"
                        disabled
                        value={currentProject?.name || ''}
                        className={`w-full px-3 py-2 rounded-xl border opacity-80 ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                          Fecha de Inicio
                        </label>
                        <input 
                          type="date"
                          disabled
                          value={currentProject?.startDate || ''}
                          className={`w-full px-3 py-2 rounded-xl border opacity-80 ${
                            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                      <div>
                        <label className="text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                          Fecha de Conclusión
                        </label>
                        <input 
                          type="date"
                          disabled
                          value={currentProject?.endDate || ''}
                          className={`w-full px-3 py-2 rounded-xl border opacity-80 ${
                            isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-slate-400 uppercase text-[10px] tracking-wider block mb-1">
                        Descripción
                      </label>
                      <textarea 
                        rows={3}
                        disabled
                        value={currentProject?.description || 'Sin descripción detallada.'}
                        className={`w-full p-3 rounded-xl border opacity-80 resize-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-slate-100 border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              )}

              {configSubTab === 'stages' && permissions.isCoordinator && (
                <StageEditor
                  project={currentProject}
                  tasks={tasks}
                  onSave={handleSaveStages}
                  isDarkMode={isDarkMode}
                  addTask={addTask}
                  updateTaskStatus={updateTaskStatus}
                  updateTaskField={updateTaskField}
                  deleteTask={deleteTask}
                  students={students}
                  currentUser={currentUser}
                  userRole={userRole}
                  permissions={permissions}
                  onSelectTask={() => {
                    setActiveTab('tareas');
                  }}
                />
              )}

              {configSubTab === 'trash' && permissions.isCoordinator && (
                <DeletedTasksView 
                  projectId={projectId} 
                  restoreTask={restoreTask} 
                  permanentDelete={permanentDelete}
                  students={students}
                  isDarkMode={isDarkMode}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal de configuración de Sprints */}
      <SprintConfigModal
        isOpen={showSprintModal}
        onClose={() => setShowSprintModal(false)}
        projectId={projectId}
        project={currentProject}
        sprints={sprints}
        tasks={tasks}
        students={students}
        addSprint={addSprint}
        updateSprint={updateSprint}
        deleteSprint={deleteSprint}
        updateTaskField={updateTaskField}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default ProjectWorkspace;
