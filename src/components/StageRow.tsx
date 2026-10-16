import React, { useState } from 'react';
import { 
  Trash2, 
  GripVertical, 
  GitFork, 
  Calendar, 
  AlignLeft, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Sparkles,
  Target,
  ListTodo,
  Plus,
  ExternalLink,
  User as UserIcon,
  X,
  Loader2,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Stage, StageStatus } from '../types/stage';
import { ColorPicker } from './ui/ColorPicker';
import { motion, AnimatePresence } from 'motion/react';
import { KANBAN_COLUMNS } from '../config/kanbanColumns';
import { formatName } from '../utils/formatters';

interface StageRowProps {
  stage: Stage;
  index: number;
  allStages?: Stage[];
  tasks?: any[];
  onUpdate: (id: string, updates: Partial<Stage>) => void;
  onRemove: (id: string) => void;
  isDarkMode?: boolean;
  addTask?: (task: any) => Promise<string | void>;
  updateTaskStatus?: (taskId: string, newStatus: any, oldStatus?: any) => Promise<void>;
  updateTaskField?: (taskId: string, field: string, value: any, oldValue?: any) => Promise<void>;
  deleteTask?: (taskId: string) => Promise<void>;
  students?: any[];
  currentUser?: any;
  userRole?: string;
  permissions?: any;
  onSelectTask?: (taskId: string) => void;
}

export const StageRow: React.FC<StageRowProps> = ({ 
  stage, 
  index, 
  allStages = [], 
  tasks = [], 
  onUpdate, 
  onRemove, 
  isDarkMode,
  addTask,
  updateTaskStatus,
  updateTaskField,
  deleteTask,
  students = [],
  currentUser,
  userRole,
  permissions,
  onSelectTask
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isTasksOpen, setIsTasksOpen] = useState(true);
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskStatus, setNewTaskStatus] = useState<string>('todo');
  const [newTaskSP, setNewTaskSP] = useState<number>(1);
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<number>(3);
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);

  // Associated tasks metrics
  const stageTasks = tasks.filter(t => t.stageId === stage.id || t.phase === stage.name || t.phase === stage.id);
  const completedTasks = stageTasks.filter(t => t.status === 'done' || t.status === 'completed');
  const taskProgress = stageTasks.length > 0 ? Math.round((completedTasks.length / stageTasks.length) * 100) : 0;
  const stageSP = stageTasks.reduce((acc, t) => acc + (parseFloat(t.estimatedSP) || 0), 0);

  // Other stages that can be predecessors (excluding self)
  const candidatePredecessors = allStages.filter(s => s.id !== stage.id);

  // Predecessor stages objects
  const predecessorStages = allStages.filter(s => (stage.predecessors || []).includes(s.id));

  // Date conflicts: check if any predecessor ends after this stage starts
  const dateConflicts = predecessorStages.filter(pred => {
    if (!pred.endDate || !stage.startDate) return false;
    return new Date(pred.endDate).getTime() > new Date(stage.startDate).getTime();
  });

  const handleTogglePredecessor = (predId: string) => {
    const current = stage.predecessors || [];
    const next = current.includes(predId) 
      ? current.filter(id => id !== predId)
      : [...current, predId];
    onUpdate(stage.id, { predecessors: next });
  };

  const getStatusBadge = (status: StageStatus) => {
    switch (status) {
      case 'completed':
        return { label: 'Completada', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
      case 'active':
        return { label: 'En curso', color: 'bg-amber-500/10 text-amber-600 border-amber-500/20' };
      case 'blocked':
        return { label: 'Bloqueada', color: 'bg-rose-500/10 text-rose-600 border-rose-500/20' };
      default:
        return { label: 'Pendiente', color: 'bg-slate-500/10 text-slate-600 border-slate-500/20' };
    }
  };

  const handleCreateTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newTaskTitle.trim()) {
      toast.error('El título de la tarea es requerido');
      return;
    }
    if (!addTask) {
      toast.error('Función de agregar tarea no disponible');
      return;
    }

    setIsSubmittingTask(true);
    try {
      const isUser = userRole === 'user';
      const stageShort = stage.name.split(':')[0] || stage.name;
      const newTask = {
        title: newTaskTitle.trim(),
        description: '',
        status: isUser ? 'pending_approval' : newTaskStatus,
        priority: newTaskPriority,
        effort: newTaskSP,
        estimatedSP: newTaskSP,
        type: 'DISEÑO / MODELADO',
        stageId: stage.id,
        phase: stage.name,
        epic: `Sprint ${stageShort}`,
        assignedTo: newTaskAssignee || (isUser && currentUser?.uid ? currentUser.uid : ''),
        assignedUsers: newTaskAssignee ? [newTaskAssignee] : (isUser && currentUser?.uid ? [currentUser.uid] : []),
        startDate: stage.startDate || new Date().toISOString(),
        endDate: stage.endDate || new Date(Date.now() + 86400000).toISOString(),
        projectId: stage.projectId
      };

      await addTask(newTask);
      toast.success(isUser ? 'Propuesta enviada para aprobación' : 'Tarea agregada a la etapa');
      setNewTaskTitle('');
      setIsAddingTask(false);
    } catch (err) {
      console.error('Error al crear tarea en etapa:', err);
      toast.error('Error al agregar tarea');
    } finally {
      setIsSubmittingTask(false);
    }
  };

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className={`border rounded-3xl group transition-all duration-300 relative overflow-hidden shadow-sm hover:shadow-md ${
        isDarkMode 
          ? 'bg-[#1a1a1a] border-white/10 hover:border-indigo-500/40' 
          : 'bg-white border-slate-200 hover:border-indigo-300'
      }`}
    >
      {/* Top accent border with stage color */}
      <div 
        className="h-1.5 w-full transition-all" 
        style={{ backgroundColor: stage.color || '#3b82f6' }}
      />

      <div className="p-5 sm:p-6 space-y-5">
        {/* Stage Header Line */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`cursor-grab active:cursor-grabbing p-1 rounded-lg transition-colors ${
              isDarkMode ? 'text-gray-600 hover:text-gray-400' : 'text-slate-300 hover:text-slate-500'
            }`}>
              <GripVertical className="w-5 h-5" />
            </div>

            <div 
              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: stage.color || '#3b82f6' }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border ${
                  isDarkMode ? 'bg-white/5 text-gray-400 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  Etapa #{index + 1}
                </span>

                <select
                  value={stage.status || 'pending'}
                  onChange={(e) => onUpdate(stage.id, { status: e.target.value as StageStatus })}
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md border outline-none cursor-pointer transition-colors ${
                    getStatusBadge(stage.status).color
                  } ${isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}`}
                >
                  <option value="pending">Pendiente</option>
                  <option value="active">En curso</option>
                  <option value="completed">Completada</option>
                  <option value="blocked">Bloqueada</option>
                </select>

                {stageTasks.length > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'
                  }`}>
                    {stageTasks.length} {stageTasks.length === 1 ? 'tarea' : 'tareas'} • {taskProgress}%
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className={`p-2 rounded-xl transition-all ${
                isDarkMode ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              }`}
              title={isExpanded ? 'Contraer detalles' : 'Expandir detalles'}
            >
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => onRemove(stage.id)}
              className={`p-2 rounded-xl transition-all ${
                isDarkMode 
                  ? 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10' 
                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
              }`}
              title="Eliminar etapa"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Primary Row: Name & Color */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-8 space-y-1.5">
            <label className={`block text-[11px] font-black uppercase tracking-wider ${
              isDarkMode ? 'text-gray-300' : 'text-slate-700'
            }`}>
              Nombre de la Etapa
            </label>
            <input
              type="text"
              value={stage.name}
              onChange={(e) => onUpdate(stage.id, { name: e.target.value })}
              placeholder="Ej. Diagnóstico y Planificación Inicial"
              className={`w-full px-4 py-2.5 text-sm font-bold border rounded-2xl focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus:bg-white/10' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white'
              }`}
            />
          </div>

          <div className="sm:col-span-4 space-y-1.5">
            <label className={`block text-[11px] font-black uppercase tracking-wider ${
              isDarkMode ? 'text-gray-300' : 'text-slate-700'
            }`}>
              Color Distintivo
            </label>
            <ColorPicker 
              selectedColor={stage.color} 
              onSelect={(color) => onUpdate(stage.id, { color })} 
              isDarkMode={isDarkMode}
            />
          </div>
        </div>

        {/* Schedule Row: Dates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${
              isDarkMode ? 'text-gray-300' : 'text-slate-700'
            }`}>
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Fecha de Inicio
            </label>
            <input
              type="date"
              value={stage.startDate?.split('T')[0] || ''}
              onChange={(e) => onUpdate(stage.id, { startDate: new Date(`${e.target.value}T00:00:00`).toISOString() })}
              className={`w-full px-4 py-2.5 text-xs font-semibold border rounded-2xl focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-gray-200 focus:bg-white/10' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${
              isDarkMode ? 'text-gray-300' : 'text-slate-700'
            }`}>
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              Fecha de Cierre Estimada
            </label>
            <input
              type="date"
              value={stage.endDate?.split('T')[0] || ''}
              onChange={(e) => onUpdate(stage.id, { endDate: new Date(`${e.target.value}T00:00:00`).toISOString() })}
              className={`w-full px-4 py-2.5 text-xs font-semibold border rounded-2xl focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all ${
                isDarkMode 
                  ? 'bg-white/5 border-white/10 text-gray-200 focus:bg-white/10' 
                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'
              }`}
            />
          </div>
        </div>

        {/* High-Visibility Description & Scope Area (Multi-line, High Contrast) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 pt-1"
            >
              {/* Description field */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-200' : 'text-slate-900'
                  }`}>
                    <AlignLeft className="w-3.5 h-3.5 text-indigo-500" />
                    Descripción y Objetivos de la Etapa
                  </label>
                  <span className={`text-[10px] font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    Alta legibilidad • Visible en Gantt y reportes
                  </span>
                </div>
                <textarea
                  value={stage.description || ''}
                  onChange={(e) => onUpdate(stage.id, { description: e.target.value })}
                  placeholder="Detalla con claridad los entregables, alcance, criterios de éxito y requerimientos esperados para esta etapa..."
                  rows={3}
                  className={`w-full px-4 py-3 text-sm font-medium leading-relaxed border rounded-2xl outline-none transition-all resize-y min-h-[88px] ${
                    isDarkMode 
                      ? 'bg-[#151515] border-white/15 text-gray-100 placeholder:text-gray-500 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20' 
                      : 'bg-slate-50/80 border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20'
                  }`}
                />
              </div>

              {/* Associated Tasks Section (Desplegable interactivo) */}
              <div className={`rounded-2xl border transition-all ${
                isDarkMode ? 'bg-[#151515] border-white/10' : 'bg-slate-50/80 border-slate-200'
              }`}>
                {/* Accordion Header */}
                <div 
                  className={`p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                    isTasksOpen ? 'border-b' : ''
                  } ${
                    isDarkMode ? 'border-white/5 hover:bg-white/[0.02]' : 'border-slate-200 hover:bg-slate-100/50'
                  }`}
                  onClick={() => setIsTasksOpen(!isTasksOpen)}
                >
                  <div className="flex items-center gap-2.5">
                    <div 
                      className="p-1.5 rounded-lg text-white shadow-xs"
                      style={{ backgroundColor: stage.color || '#6366f1' }}
                    >
                      <ListTodo className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-black uppercase tracking-wider ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                          Tareas Asociadas
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          stageTasks.length > 0
                            ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                            : (isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-200 text-slate-600')
                        }`}>
                          {stageTasks.length}
                        </span>
                      </div>
                      <div className={`text-[11px] font-medium flex items-center gap-2 mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        <span>{completedTasks.length} de {stageTasks.length} completadas</span>
                        <span>•</span>
                        <span>{stageSP} Story Points</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Mini Progress Bar */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className={`w-20 h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                        <div 
                          className="h-full rounded-full transition-all duration-500"
                          style={{ 
                            width: `${taskProgress}%`,
                            backgroundColor: stage.color || '#10b981'
                          }}
                        />
                      </div>
                      <span className={`text-[10px] font-black tabular-nums ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                        {taskProgress}%
                      </span>
                    </div>

                    {/* Quick Add Task Button */}
                    {permissions?.canCreateTask !== false && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsTasksOpen(true);
                          setIsAddingTask(true);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Nueva Tarea</span>
                      </button>
                    )}

                    <div className={`p-1 rounded-lg transition-transform ${isTasksOpen ? 'rotate-180' : ''}`}>
                      <ChevronDown className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>

                {/* Collapsible Content */}
                <AnimatePresence>
                  {isTasksOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 space-y-3">
                        {/* Inline Task Creation Form */}
                        {isAddingTask && (
                          <motion.form
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onSubmit={handleCreateTask}
                            className={`p-3.5 rounded-xl border shadow-sm space-y-3 ${
                              isDarkMode ? 'bg-[#1c1c1c] border-indigo-500/30' : 'bg-white border-indigo-200'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-indigo-500 flex items-center gap-1.5">
                                <Plus className="w-3.5 h-3.5" />
                                Agregar tarea a {stage.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsAddingTask(false)}
                                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <input
                              type="text"
                              autoFocus
                              value={newTaskTitle}
                              onChange={(e) => setNewTaskTitle(e.target.value)}
                              placeholder="Título o nombre del entregable..."
                              className={`w-full px-3 py-2 text-xs font-bold rounded-lg border outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${
                                isDarkMode 
                                  ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-500' 
                                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400'
                              }`}
                            />

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {/* Status */}
                              <div>
                                <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Estado</label>
                                <select
                                  value={newTaskStatus}
                                  onChange={(e) => setNewTaskStatus(e.target.value)}
                                  className={`w-full px-2 py-1.5 text-[11px] font-bold rounded-lg border outline-none cursor-pointer ${
                                    isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  {KANBAN_COLUMNS.filter(c => !c.hideFromBoard && c.id !== 'pending_approval').map(c => (
                                    <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}>
                                      {c.title}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Story Points */}
                              <div>
                                <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Story Points</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={newTaskSP}
                                  onChange={(e) => setNewTaskSP(parseFloat(e.target.value) || 0)}
                                  className={`w-full px-2 py-1.5 text-[11px] font-bold rounded-lg border outline-none ${
                                    isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                />
                              </div>

                              {/* Responsable */}
                              <div>
                                <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Responsable</label>
                                <select
                                  value={newTaskAssignee}
                                  onChange={(e) => setNewTaskAssignee(e.target.value)}
                                  className={`w-full px-2 py-1.5 text-[11px] font-bold rounded-lg border outline-none cursor-pointer ${
                                    isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <option value="" className={isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}>Sin asignar</option>
                                  {students.map((s: any) => (
                                    <option key={s.id} value={s.id} className={isDarkMode ? 'bg-[#1e1e1e]' : 'bg-white'}>
                                      {formatName(s.firstName, s.lastNamePaterno)}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Prioridad */}
                              <div>
                                <label className="block text-[9px] font-black uppercase text-gray-400 mb-1">Prioridad</label>
                                <select
                                  value={newTaskPriority}
                                  onChange={(e) => setNewTaskPriority(parseInt(e.target.value) || 3)}
                                  className={`w-full px-2 py-1.5 text-[11px] font-bold rounded-lg border outline-none cursor-pointer ${
                                    isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                                  }`}
                                >
                                  <option value={1}>1 - Muy baja</option>
                                  <option value={2}>2 - Baja</option>
                                  <option value={3}>3 - Media</option>
                                  <option value={4}>4 - Alta</option>
                                  <option value={5}>5 - Crítica</option>
                                </select>
                              </div>
                            </div>

                            <div className="flex justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsAddingTask(false)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                Cancelar
                              </button>
                              <button
                                type="submit"
                                disabled={isSubmittingTask || !newTaskTitle.trim()}
                                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all cursor-pointer"
                              >
                                {isSubmittingTask ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                Guardar Tarea
                              </button>
                            </div>
                          </motion.form>
                        )}

                        {/* Tasks Items */}
                        {stageTasks.length === 0 ? (
                          <div className={`p-6 text-center rounded-xl border border-dashed ${
                            isDarkMode ? 'border-white/10 text-gray-500' : 'border-slate-300 text-slate-400'
                          }`}>
                            <p className="text-xs font-medium mb-2">No hay tareas asociadas directamente a esta etapa todavía.</p>
                            {permissions?.canCreateTask !== false && (
                              <button
                                type="button"
                                onClick={() => setIsAddingTask(true)}
                                className="text-xs font-bold text-indigo-500 hover:underline inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" /> Agregar primera tarea
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                            {stageTasks.map((t: any) => {
                              const assignedStudent = students.find((s: any) => s.id === (t.assignedUsers?.[0] || t.assignedTo));
                              const statusCfg = KANBAN_COLUMNS.find(c => c.id === t.status) || KANBAN_COLUMNS[1];
                              const isCompleted = t.status === 'done';

                              return (
                                <div
                                  key={t.id}
                                  className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 transition-all ${
                                    isDarkMode 
                                      ? 'bg-white/[0.03] border-white/5 hover:border-white/15' 
                                      : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-xs'
                                  }`}
                                >
                                  {/* Left: Status dropdown & Title */}
                                  <div className="flex items-center gap-3 flex-1 min-w-[200px]">
                                    {/* Quick Status Select */}
                                    <select
                                      value={t.status || 'todo'}
                                      onChange={(e) => updateTaskStatus?.(t.id, e.target.value, t.status)}
                                      disabled={!permissions?.canChangeStatus && !permissions?.canEditTask}
                                      className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border outline-none cursor-pointer transition-colors ${
                                        statusCfg.color
                                      } text-white ${isDarkMode ? 'border-white/10' : 'border-transparent'}`}
                                      title="Cambiar estado de la tarea"
                                    >
                                      {KANBAN_COLUMNS.filter(c => !c.hideFromBoard).map(c => (
                                        <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#1e1e1e] text-white' : 'bg-white text-slate-900'}>
                                          {c.title}
                                        </option>
                                      ))}
                                    </select>

                                    {/* Task title */}
                                    <div className="flex-1 min-w-0">
                                      <p 
                                        onClick={() => onSelectTask?.(t.id)}
                                        className={`text-xs font-bold truncate cursor-pointer hover:underline ${
                                          isCompleted ? 'line-through opacity-60' : ''
                                        } ${isDarkMode ? 'text-gray-200 hover:text-indigo-400' : 'text-slate-800 hover:text-indigo-600'}`}
                                        title={t.title}
                                      >
                                        {t.title}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Right: Badges & Actions */}
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {/* Sprint / Phase badge */}
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                      isDarkMode ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                                    }`}>
                                      {t.epic || `Sprint: ${stage.name.split(':')[0]}`}
                                    </span>

                                    {/* Story Points */}
                                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded border ${
                                      isDarkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                                    }`}>
                                      {t.estimatedSP || 0} SP
                                    </span>

                                    {/* Assignee Avatar */}
                                    <div 
                                      className="flex items-center gap-1.5"
                                      title={assignedStudent ? formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno) : 'Sin asignar'}
                                    >
                                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black ${
                                        assignedStudent 
                                          ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700')
                                          : (isDarkMode ? 'bg-white/10 text-gray-500' : 'bg-slate-200 text-slate-500')
                                      }`}>
                                        {assignedStudent ? `${assignedStudent.firstName[0]}${assignedStudent.lastNamePaterno[0]}` : '?'}
                                      </div>
                                      <span className={`text-[11px] font-medium hidden md:inline truncate max-w-[90px] ${
                                        isDarkMode ? 'text-gray-400' : 'text-slate-600'
                                      }`}>
                                        {assignedStudent ? assignedStudent.firstName : 'Sin asignar'}
                                      </span>
                                    </div>

                                    {/* Open in Kanban Button */}
                                    {onSelectTask && (
                                      <button
                                        type="button"
                                        onClick={() => onSelectTask(t.id)}
                                        className={`p-1.5 rounded-lg transition-colors border cursor-pointer ${
                                          isDarkMode 
                                            ? 'text-gray-400 hover:text-indigo-300 hover:bg-white/5 border-white/5' 
                                            : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-100 border-slate-200'
                                        }`}
                                        title="Ver tarea en Tablero Kanban"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {/* Delete task button */}
                                    {permissions?.canDeleteTask && deleteTask && (
                                      <button
                                        type="button"
                                        onClick={() => deleteTask(t.id)}
                                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                          isDarkMode ? 'text-gray-500 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                        }`}
                                        title="Eliminar tarea"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Interrelationships & Predecessors Section */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className={`flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider ${
                    isDarkMode ? 'text-gray-200' : 'text-slate-900'
                  }`}>
                    <GitFork className="w-3.5 h-3.5 text-indigo-500" />
                    Interrelación y Etapas Predecesoras (Ruta Crítica)
                  </label>
                  <span className={`text-[10px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    Influye en tiempos tempranos y holguras CPM
                  </span>
                </div>

                {/* Predecessors selector chips */}
                {candidatePredecessors.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {candidatePredecessors.map((otherStage) => {
                        const isSelected = (stage.predecessors || []).includes(otherStage.id);
                        return (
                          <button
                            key={otherStage.id}
                            type="button"
                            onClick={() => handleTogglePredecessor(otherStage.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? (isDarkMode 
                                    ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500 shadow-sm' 
                                    : 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm')
                                : (isDarkMode 
                                    ? 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200' 
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-white hover:text-slate-800')
                            }`}
                          >
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: otherStage.color || '#94a3b8' }}
                            />
                            <span>{otherStage.name || 'Etapa sin nombre'}</span>
                            {isSelected && (
                              <span className="text-[10px] font-black ml-1 text-indigo-400">✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Predecessors list summary */}
                    {predecessorStages.length > 0 && (
                      <p className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Esta etapa solo comenzará después de completar:{' '}
                        <span className="font-bold text-indigo-500">
                          {predecessorStages.map(s => s.name).join(', ')}
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    Agrega más etapas para establecer interrelaciones y dependencias operativas.
                  </p>
                )}

                {/* Date Conflict Warning Alert */}
                {dateConflicts.length > 0 && (
                  <div className={`p-3 rounded-2xl border flex items-start gap-2.5 text-xs font-semibold ${
                    isDarkMode ? 'bg-amber-500/10 border-amber-500/30 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
                  }`}>
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-bold">Advertencia de desfase cronológico:</p>
                      <ul className="list-disc list-inside mt-1 font-medium space-y-0.5">
                        {dateConflicts.map(c => (
                          <li key={c.id}>
                            La etapa predecesora &ldquo;{c.name}&rdquo; finaliza el {c.endDate?.split('T')[0]}, después de que esta etapa inicia ({stage.startDate?.split('T')[0]}).
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
