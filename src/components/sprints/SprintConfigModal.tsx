import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Plus, 
  Calendar, 
  Zap, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  Edit2, 
  Search, 
  Filter, 
  ArrowRight, 
  Layers, 
  Star, 
  Users, 
  CheckSquare, 
  Square, 
  AlertCircle,
  TrendingUp,
  FolderGit2
} from 'lucide-react';
import { Sprint } from '../../types/project';
import { Task } from '../../types/task';
import { Stage } from '../../types/stage';
import { KANBAN_COLUMNS } from '../../config/kanbanColumns';
import { StatusBadge } from '../ui/StatusBadge';
import { ConfirmModal } from '../ui/ConfirmModal';
import { formatName } from '../../utils/formatters';
import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase';
import toast from 'react-hot-toast';

interface SprintConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  project: any;
  sprints: Sprint[];
  tasks: Task[];
  students: any[];
  addSprint: (sprintData: Partial<Sprint>) => Promise<string>;
  updateSprint: (sprintId: string, updates: Partial<Sprint>) => Promise<void>;
  deleteSprint: (sprintId: string) => Promise<void>;
  updateTaskField: (taskId: string, field: keyof Task, newValue: any, oldValue: any) => Promise<void>;
  isDarkMode?: boolean;
}

export const SprintConfigModal: React.FC<SprintConfigModalProps> = ({
  isOpen,
  onClose,
  projectId,
  project,
  sprints,
  tasks,
  students,
  addSprint,
  updateSprint,
  deleteSprint,
  updateTaskField,
  isDarkMode = false
}) => {
  const [activeTab, setActiveTab] = useState<'sprints' | 'tasks'>('sprints');
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [editingSprintId, setEditingSprintId] = useState<string | null>(null);

  // Form state for creating/editing sprints
  const [formName, setFormName] = useState('');
  const [formGoal, setFormGoal] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formStageId, setFormStageId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Task association tab filters
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('');
  const [taskViewFilter, setTaskViewFilter] = useState<'all' | 'in_sprint' | 'backlog'>('in_sprint');
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  // Confirm delete modal state
  const [sprintToDelete, setSprintToDelete] = useState<Sprint | null>(null);

  // Set default sprint if none selected
  React.useEffect(() => {
    if (sprints.length > 0 && !selectedSprintId) {
      setSelectedSprintId(sprints[0].id);
    }
  }, [sprints, selectedSprintId]);

  // Reset form when switching to create mode
  const initCreateForm = () => {
    setEditingSprintId(null);
    const nextNumber = sprints.length + 1;
    setFormName(`Sprint ${nextNumber}`);
    setFormGoal('');
    
    // Suggest dates: either tomorrow or start of next period
    let start = new Date();
    if (sprints.length > 0) {
      const lastSprint = sprints[sprints.length - 1];
      if (lastSprint.endDate) {
        const lastEnd = new Date(lastSprint.endDate);
        if (!isNaN(lastEnd.getTime())) {
          start = new Date(lastEnd.getTime() + 86400000);
        }
      }
    }
    const end = new Date(start.getTime() + 14 * 86400000);
    setFormStartDate(start.toISOString().split('T')[0]);
    setFormEndDate(end.toISOString().split('T')[0]);
    setFormStageId(project?.stages?.[project?.currentStageIndex || 0]?.id || '');
  };

  React.useEffect(() => {
    if (isOpen && !editingSprintId && !formName) {
      initCreateForm();
    }
  }, [isOpen, sprints.length]);

  const handleEditSprint = (sprint: Sprint) => {
    setEditingSprintId(sprint.id);
    setFormName(sprint.name);
    setFormGoal(sprint.goal || sprint.description || '');
    setFormStartDate(sprint.startDate ? sprint.startDate.split('T')[0] : '');
    setFormEndDate(sprint.endDate ? sprint.endDate.split('T')[0] : '');
    setFormStageId(sprint.stageId || '');
    setActiveTab('sprints');
  };

  const handleSetDuration = (days: number) => {
    if (!formStartDate) return;
    const start = new Date(formStartDate);
    const end = new Date(start.getTime() + days * 86400000);
    setFormEndDate(end.toISOString().split('T')[0]);
  };

  const handleSubmitSprint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('El nombre del Sprint es requerido');
      return;
    }
    if (!formStartDate || !formEndDate) {
      toast.error('Las fechas de inicio y fin son requeridas');
      return;
    }
    if (new Date(formEndDate) < new Date(formStartDate)) {
      toast.error('La fecha de fin no puede ser anterior a la de inicio');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingSprintId) {
        await updateSprint(editingSprintId, {
          name: formName.trim(),
          goal: formGoal.trim(),
          startDate: formStartDate,
          endDate: formEndDate,
          stageId: formStageId || null
        });
        toast.success(`Sprint "${formName}" actualizado`);
        setEditingSprintId(null);
      } else {
        const newId = await addSprint({
          name: formName.trim(),
          goal: formGoal.trim(),
          startDate: formStartDate,
          endDate: formEndDate,
          stageId: formStageId || null
        });
        setSelectedSprintId(newId);
        initCreateForm();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSprintConfirmed = async () => {
    if (!sprintToDelete) return;
    const sprintId = sprintToDelete.id;
    try {
      // Find tasks assigned to this sprint and unassign them
      const assignedTasks = tasks.filter(t => t.sprintId === sprintId);
      if (assignedTasks.length > 0) {
        const batch = writeBatch(db);
        assignedTasks.forEach(task => {
          const taskRef = doc(db, 'projects', projectId, 'tasks', task.id);
          batch.update(taskRef, { sprintId: null });
        });
        await batch.commit();
      }

      await deleteSprint(sprintId);
      if (selectedSprintId === sprintId) {
        setSelectedSprintId(sprints.find(s => s.id !== sprintId)?.id || '');
      }
      setSprintToDelete(null);
    } catch (err) {
      console.error('Error deleting sprint:', err);
      toast.error('Error al eliminar sprint');
    }
  };

  // Associate / Dissociate task with sprint
  const handleAssignTaskToSprint = async (taskId: string, targetSprintId: string | null) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      await updateTaskField(taskId, 'sprintId', targetSprintId, task.sprintId || null);
      if (targetSprintId) {
        const spName = sprints.find(s => s.id === targetSprintId)?.name || 'Sprint';
        toast.success(`Tarea asociada a ${spName}`);
      } else {
        toast.success('Tarea enviada al Backlog (Sin Sprint)');
      }
    } catch (err) {
      console.error('Error assigning task to sprint:', err);
      toast.error('Error al actualizar la tarea');
    }
  };

  // Batch assign selected tasks to active sprint
  const handleBatchAssign = async (targetSprintId: string | null) => {
    if (selectedTaskIds.size === 0) return;
    const taskIds = Array.from(selectedTaskIds);

    try {
      const batch = writeBatch(db);
      taskIds.forEach(id => {
        const taskRef = doc(db, 'projects', projectId, 'tasks', id);
        batch.update(taskRef, { sprintId: targetSprintId });
      });
      await batch.commit();

      if (targetSprintId) {
        const spName = sprints.find(s => s.id === targetSprintId)?.name || 'Sprint';
        toast.success(`${taskIds.length} tareas asociadas a ${spName}`);
      } else {
        toast.success(`${taskIds.length} tareas enviadas al Backlog`);
      }
      setSelectedTaskIds(new Set());
    } catch (err) {
      console.error('Error batch updating tasks:', err);
      toast.error('Error al actualizar tareas en lote');
    }
  };

  // Metrics for all sprints
  const sprintStats = useMemo(() => {
    const stats: Record<string, { total: number; done: number; sp: number; hours: number }> = {};
    sprints.forEach(s => {
      stats[s.id] = { total: 0, done: 0, sp: 0, hours: 0 };
    });

    tasks.forEach(t => {
      if (t.sprintId && stats[t.sprintId]) {
        stats[t.sprintId].total += 1;
        if (t.status === 'done') stats[t.sprintId].done += 1;
        stats[t.sprintId].sp += Number(t.estimatedSP) || 0;
        stats[t.sprintId].hours += Number(t.effort) || 0;
      }
    });

    const unassignedCount = tasks.filter(t => !t.sprintId).length;
    return { perSprint: stats, unassignedCount, totalTasks: tasks.length };
  }, [sprints, tasks]);

  // Tasks filtered for association tab
  const filteredTasksForTab = useMemo(() => {
    return tasks.filter(task => {
      // Exclude soft-deleted tasks
      if (task.deletedAt) return false;

      // View filter
      if (taskViewFilter === 'in_sprint') {
        if (!selectedSprintId || task.sprintId !== selectedSprintId) return false;
      } else if (taskViewFilter === 'backlog') {
        if (task.sprintId) return false;
      }

      // Status filter
      if (taskStatusFilter && task.status !== taskStatusFilter) return false;

      // Search query
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase().trim();
        const titleMatch = (task.title || '').toLowerCase().includes(q);
        const epicMatch = (task.epic || '').toLowerCase().includes(q);
        const student = students.find(s => s.id === task.assignedTo);
        const studentMatch = student ? `${student.firstName} ${student.lastNamePaterno}`.toLowerCase().includes(q) : false;
        if (!titleMatch && !epicMatch && !studentMatch) return false;
      }

      return true;
    });
  }, [tasks, selectedSprintId, taskViewFilter, taskStatusFilter, taskSearch, students]);

  const currentSelectedSprint = sprints.find(s => s.id === selectedSprintId);

  const getSprintStatus = (sprint: Sprint) => {
    if (!sprint.startDate || !sprint.endDate) return { label: 'Planificado', color: 'blue' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(sprint.startDate);
    const end = new Date(sprint.endDate);

    if (today < start) {
      return { label: 'Próximo', color: 'indigo' };
    } else if (today > end) {
      return { label: 'Finalizado', color: 'slate' };
    } else {
      return { label: 'En curso', color: 'emerald' };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          className={`w-full max-w-5xl h-[90vh] max-h-[850px] rounded-3xl shadow-2xl flex flex-col overflow-hidden border ${
            isDarkMode ? 'bg-[#141414] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}
        >
          {/* Header */}
          <div className={`px-6 py-4 border-b flex items-center justify-between shrink-0 ${
            isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-slate-50 border-slate-100'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center justify-center shadow-xs">
                <Zap size={22} className="fill-amber-500" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight">Configuración de Sprints</h3>
                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  Ciclos de trabajo e iteraciones del proyecto y vinculación de tareas Kanban
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tabs Switcher */}
              <div className={`p-1 rounded-xl flex items-center gap-1 border ${
                isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-200/60 border-slate-200'
              }`}>
                <button
                  type="button"
                  onClick={() => setActiveTab('sprints')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'sprints'
                      ? (isDarkMode ? 'bg-white/15 text-white shadow-xs' : 'bg-white text-indigo-700 shadow-xs')
                      : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  <Calendar size={14} />
                  <span>Sprints ({sprints.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'tasks'
                      ? (isDarkMode ? 'bg-white/15 text-white shadow-xs' : 'bg-white text-indigo-700 shadow-xs')
                      : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                  }`}
                >
                  <FolderGit2 size={14} />
                  <span>Asociar Tareas ({tasks.length})</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className={`p-2 rounded-xl transition-colors cursor-pointer ${
                  isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-200'
                }`}
                title="Cerrar"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'sprints' ? (
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                {/* Metric Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Total Sprints</p>
                    <p className="text-2xl font-black mt-1 text-indigo-500">{sprints.length}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Tareas en Sprints</p>
                    <p className="text-2xl font-black mt-1 text-emerald-500">
                      {tasks.filter(t => t.sprintId).length}
                    </p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Sin Sprint (Backlog)</p>
                    <p className="text-2xl font-black mt-1 text-amber-500">{sprintStats.unassignedCount}</p>
                  </div>
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Etapas Vinculadas</p>
                    <p className="text-2xl font-black mt-1 text-blue-500">
                      {project?.stages?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Form to Create / Edit Sprint */}
                <div className={`p-5 rounded-2xl border shadow-xs transition-colors ${
                  editingSprintId 
                    ? (isDarkMode ? 'bg-indigo-950/20 border-indigo-500/40' : 'bg-indigo-50/50 border-indigo-200')
                    : (isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200')
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-amber-500" />
                      <h4 className="font-black text-sm uppercase tracking-wider">
                        {editingSprintId ? 'Editar Sprint' : 'Definir Nuevo Ciclo de Trabajo'}
                      </h4>
                    </div>
                    {editingSprintId && (
                      <button
                        type="button"
                        onClick={initCreateForm}
                        className={`text-xs font-bold underline cursor-pointer ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}
                      >
                        Cancelar Edición
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSubmitSprint} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Sprint Name */}
                      <div className="space-y-1.5 sm:col-span-2">
                        <label className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          Nombre del Sprint *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            placeholder="Ej: Sprint 1, Sprint 2..."
                            className={`flex-1 px-3.5 py-2 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 border ${
                              isDarkMode ? 'bg-[#1f1f1f] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                            }`}
                            required
                          />
                          {!editingSprintId && (
                            <button
                              type="button"
                              onClick={() => setFormName(`Sprint ${sprints.length + 1}`)}
                              className={`px-3 py-2 text-xs font-bold rounded-xl border shrink-0 cursor-pointer ${
                                isDarkMode ? 'bg-white/10 border-white/10 text-gray-300 hover:bg-white/15' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                              }`}
                              title="Auto-generar siguiente número"
                            >
                              Auto
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Associated Stage */}
                      <div className="space-y-1.5">
                        <label className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          Etapa Asociada (Opcional)
                        </label>
                        <select
                          value={formStageId}
                          onChange={(e) => setFormStageId(e.target.value)}
                          className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 border cursor-pointer ${
                            isDarkMode ? 'bg-[#1f1f1f] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                        >
                          <option value="">Sin etapa asignada</option>
                          {project?.stages?.map((stage: Stage) => (
                            <option key={stage.id} value={stage.id}>
                              {stage.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Goal / Description */}
                    <div className="space-y-1.5">
                      <label className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                        Objetivo del Sprint (Opcional)
                      </label>
                      <input
                        type="text"
                        value={formGoal}
                        onChange={(e) => setFormGoal(e.target.value)}
                        placeholder="Ej: Completar levantamiento físico y diagnóstico urbano inicial"
                        className={`w-full px-3.5 py-2 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500 border ${
                          isDarkMode ? 'bg-[#1f1f1f] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      />
                    </div>

                    {/* Date Range & Duration Shortcuts */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          <Calendar size={13} />
                          <span>Fecha de Inicio *</span>
                        </label>
                        <input
                          type="date"
                          value={formStartDate}
                          onChange={(e) => setFormStartDate(e.target.value)}
                          className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 border ${
                            isDarkMode ? 'bg-[#1f1f1f] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={`text-xs font-bold flex items-center gap-1.5 ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                          <Calendar size={13} />
                          <span>Fecha de Fin *</span>
                        </label>
                        <input
                          type="date"
                          value={formEndDate}
                          onChange={(e) => setFormEndDate(e.target.value)}
                          className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500 border ${
                            isDarkMode ? 'bg-[#1f1f1f] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                          }`}
                          required
                        />
                      </div>
                    </div>

                    {/* Quick Duration Shortcuts */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className={`text-[11px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Duración rápida:
                      </span>
                      {[
                        { label: '1 semana', days: 7 },
                        { label: '2 semanas (Estándar)', days: 14 },
                        { label: '3 semanas', days: 21 },
                        { label: '1 mes', days: 30 }
                      ].map(d => (
                        <button
                          key={d.label}
                          type="button"
                          onClick={() => handleSetDuration(d.days)}
                          className={`text-xs font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                            isDarkMode 
                              ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:text-white' 
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-indigo-600'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}

                      <div className="ml-auto">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {editingSprintId ? <Edit2 size={14} /> : <Plus size={14} />}
                          <span>{editingSprintId ? 'Guardar Cambios' : 'Crear Sprint'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Sprints List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                      <Zap size={15} className="text-amber-500" />
                      <span>Ciclos Configurados ({sprints.length})</span>
                    </h4>
                  </div>

                  {sprints.length === 0 ? (
                    <div className={`p-8 text-center rounded-2xl border border-dashed ${
                      isDarkMode ? 'border-white/10 text-gray-400 bg-white/5' : 'border-slate-300 text-slate-500 bg-slate-50'
                    }`}>
                      <Calendar size={32} className="mx-auto mb-2 text-slate-400 opacity-60" />
                      <p className="font-bold text-sm">No hay sprints configurados para este proyecto.</p>
                      <p className="text-xs mt-1 text-slate-400">
                        Usa el formulario superior para definir tu primer ciclo (ej. Sprint 1) de 14 días.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {sprints.map(sprint => {
                        const status = getSprintStatus(sprint);
                        const stats = sprintStats.perSprint[sprint.id] || { total: 0, done: 0, sp: 0, hours: 0 };
                        const progress = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
                        const stage = project?.stages?.find((st: Stage) => st.id === sprint.stageId);

                        return (
                          <div
                            key={sprint.id}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-4 ${
                              isDarkMode ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-slate-200 hover:border-indigo-200 shadow-xs'
                            }`}
                          >
                            <div>
                              {/* Top row */}
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-black text-base">{sprint.name}</h5>
                                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                      status.color === 'emerald'
                                        ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-100 text-emerald-800')
                                        : status.color === 'indigo'
                                          ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-indigo-100 text-indigo-800')
                                          : (isDarkMode ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30' : 'bg-slate-100 text-slate-600')
                                    }`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  {sprint.goal && (
                                    <p className={`text-xs mt-1 line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                                      {sprint.goal}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleEditSprint(sprint)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                                    }`}
                                    title="Editar Sprint"
                                  >
                                    <Edit2 size={15} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setSprintToDelete(sprint)}
                                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                      isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                    }`}
                                    title="Eliminar Sprint"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              </div>

                              {/* Dates & Stage */}
                              <div className="flex items-center gap-2 flex-wrap mt-3 text-xs">
                                <span className={`flex items-center gap-1 font-semibold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                  <Calendar size={13} className="text-amber-500" />
                                  <span>{sprint.startDate || 'Sin fecha'} &rarr; {sprint.endDate || 'Sin fecha'}</span>
                                </span>

                                {stage && (
                                  <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border"
                                    style={{
                                      backgroundColor: `${stage.color || '#3b82f6'}15`,
                                      borderColor: `${stage.color || '#3b82f6'}35`,
                                      color: stage.color || '#3b82f6'
                                    }}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color || '#3b82f6' }} />
                                    <span>{stage.name}</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Progress & Quick Stats */}
                            <div className={`p-3 rounded-xl border space-y-2 ${
                              isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50/80 border-slate-100'
                            }`}>
                              <div className="flex items-center justify-between text-xs font-bold">
                                <span className={isDarkMode ? 'text-gray-400' : 'text-slate-600'}>
                                  {stats.total} {stats.total === 1 ? 'tarea' : 'tareas'} ({stats.done} completadas)
                                </span>
                                <span className="text-indigo-500">{progress}%</span>
                              </div>

                              <div className={`w-full h-2 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                                <div
                                  className="h-full bg-indigo-500 transition-all rounded-full"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1">
                                <span>Puntos de Historia: {stats.sp} SP</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSprintId(sprint.id);
                                    setActiveTab('tasks');
                                    setTaskViewFilter('in_sprint');
                                  }}
                                  className="text-indigo-500 hover:underline flex items-center gap-1 font-black cursor-pointer"
                                >
                                  <span>Asociar Tareas</span>
                                  <ArrowRight size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* TAB 2: ASOCIAR TAREAS KANBAN */
              <div className="flex-1 overflow-hidden flex flex-col p-4 sm:p-6 gap-4">
                {/* Selector of Target Sprint & Controls */}
                <div className={`p-4 rounded-2xl border flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between shrink-0 ${
                  isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <label className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                        Sprint de Trabajo:
                      </label>
                      <select
                        value={selectedSprintId}
                        onChange={(e) => setSelectedSprintId(e.target.value)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-black outline-none focus:ring-2 focus:ring-indigo-500 border cursor-pointer ${
                          isDarkMode ? 'bg-[#1f1f1f] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                        }`}
                      >
                        {sprints.map(sp => (
                          <option key={sp.id} value={sp.id}>
                            {sp.name} ({sprintStats.perSprint[sp.id]?.total || 0} tareas)
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentSelectedSprint && (
                      <div className="hidden sm:block text-xs font-semibold pl-2">
                        <p className={isDarkMode ? 'text-gray-400' : 'text-slate-500'}>
                          {currentSelectedSprint.startDate} &rarr; {currentSelectedSprint.endDate}
                        </p>
                        {currentSelectedSprint.goal && (
                          <p className="text-[11px] text-amber-500 truncate max-w-xs">{currentSelectedSprint.goal}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* View Filter Toggle */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className={`p-1 rounded-xl flex items-center gap-1 border ${
                      isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200'
                    }`}>
                      <button
                        type="button"
                        onClick={() => setTaskViewFilter('in_sprint')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          taskViewFilter === 'in_sprint'
                            ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 font-black')
                            : (isDarkMode ? 'text-gray-400' : 'text-slate-600')
                        }`}
                      >
                        En este Sprint ({tasks.filter(t => t.sprintId === selectedSprintId).length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskViewFilter('backlog')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          taskViewFilter === 'backlog'
                            ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 font-black')
                            : (isDarkMode ? 'text-gray-400' : 'text-slate-600')
                        }`}
                      >
                        Backlog / Sin Sprint ({sprintStats.unassignedCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTaskViewFilter('all')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          taskViewFilter === 'all'
                            ? (isDarkMode ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 font-black')
                            : (isDarkMode ? 'text-gray-400' : 'text-slate-600')
                        }`}
                      >
                        Todas ({tasks.length})
                      </button>
                    </div>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                <div className="flex items-center gap-3 flex-wrap shrink-0">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`} />
                    <input
                      type="text"
                      value={taskSearch}
                      onChange={(e) => setTaskSearch(e.target.value)}
                      placeholder="Buscar tareas por título o estudiante..."
                      className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 border ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                      }`}
                    />
                  </div>

                  <select
                    value={taskStatusFilter}
                    onChange={(e) => setTaskStatusFilter(e.target.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold outline-none border cursor-pointer ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="">Todos los Estados</option>
                    {KANBAN_COLUMNS.map(col => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>

                  {/* Multi-selection toggle */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedTaskIds.size === filteredTasksForTab.length && filteredTasksForTab.length > 0) {
                          setSelectedTaskIds(new Set());
                        } else {
                          setSelectedTaskIds(new Set(filteredTasksForTab.map(t => t.id)));
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {selectedTaskIds.size === filteredTasksForTab.length && filteredTasksForTab.length > 0 ? (
                        <CheckSquare size={14} className="text-indigo-500" />
                      ) : (
                        <Square size={14} />
                      )}
                      <span>Seleccionar visibles</span>
                    </button>
                  </div>
                </div>

                {/* Batch Actions Dock when items selected */}
                {selectedTaskIds.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 shrink-0 ${
                      isDarkMode ? 'bg-indigo-950/40 border-indigo-500/40' : 'bg-indigo-50 border-indigo-200 shadow-xs'
                    }`}
                  >
                    <span className="text-xs font-black text-indigo-500">
                      {selectedTaskIds.size} {selectedTaskIds.size === 1 ? 'tarea seleccionada' : 'tareas seleccionadas'}
                    </span>

                    <div className="flex items-center gap-2">
                      {selectedSprintId && (
                        <button
                          type="button"
                          onClick={() => handleBatchAssign(selectedSprintId)}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-black uppercase tracking-wider hover:bg-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Zap size={13} />
                          <span>Asignar a {currentSelectedSprint?.name || 'Sprint'}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleBatchAssign(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          isDarkMode ? 'bg-white/10 border-white/10 text-gray-300 hover:bg-white/15' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        Desasociar (Mover a Backlog)
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedTaskIds(new Set())}
                        className={`p-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                          isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                        }`}
                        title="Deseleccionar todas"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Tasks List */}
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {filteredTasksForTab.length === 0 ? (
                    <div className={`p-8 text-center rounded-2xl border ${
                      isDarkMode ? 'bg-white/5 border-white/5 text-gray-400' : 'bg-white border-slate-200 text-slate-500'
                    }`}>
                      <AlertCircle size={24} className="mx-auto mb-2 text-slate-400 opacity-60" />
                      <p className="font-bold text-sm">No se encontraron tareas con los filtros actuales.</p>
                      <p className="text-xs mt-1 text-slate-400">
                        {taskViewFilter === 'in_sprint' 
                          ? 'Este sprint aún no tiene tareas asociadas. Cambia a "Backlog / Sin Sprint" para vincular tareas existentes.' 
                          : 'Prueba cambiando los términos de búsqueda o filtros.'}
                      </p>
                    </div>
                  ) : (
                    filteredTasksForTab.map(task => {
                      const assignedStudent = students.find(s => s.id === task.assignedTo);
                      const isTaskInActiveSprint = task.sprintId === selectedSprintId;
                      const taskSprint = sprints.find(s => s.id === task.sprintId);
                      const isSelected = selectedTaskIds.has(task.id);

                      return (
                        <div
                          key={task.id}
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                            isSelected 
                              ? (isDarkMode ? 'bg-indigo-900/20 border-indigo-500/50' : 'bg-indigo-50/60 border-indigo-300')
                              : (isDarkMode ? 'bg-white/5 border-white/5 hover:border-white/15' : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs')
                          }`}
                        >
                          {/* Left: Checkbox & Info */}
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedTaskIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(task.id)) next.delete(task.id);
                                  else next.add(task.id);
                                  return next;
                                });
                              }}
                              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h5 className="font-bold text-sm truncate max-w-md">{task.title}</h5>
                                <StatusBadge status={task.status} size="sm" />
                                {task.isMilestone && (
                                  <span className={`text-[9px] font-black px-1.5 py-0.2 rounded ${
                                    isDarkMode ? 'bg-amber-400/10 text-amber-400' : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    HITO
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-wrap mt-1 text-xs">
                                {assignedStudent && (
                                  <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                                    isDarkMode ? 'text-gray-400' : 'text-slate-500'
                                  }`}>
                                    <Users size={12} />
                                    <span>{formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno)}</span>
                                  </span>
                                )}

                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {task.type}
                                </span>

                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                  taskSprint 
                                    ? (isDarkMode ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-800 border border-amber-200')
                                    : (isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-100 text-slate-500')
                                }`}>
                                  {taskSprint ? `Sprint: ${taskSprint.name}` : 'Sin Sprint (Backlog)'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Sprint Selector & Action Button */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            {/* Direct Dropdown to change Sprint */}
                            <select
                              value={task.sprintId || ''}
                              onChange={(e) => handleAssignTaskToSprint(task.id, e.target.value || null)}
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold outline-none border cursor-pointer ${
                                isDarkMode 
                                  ? 'bg-[#1f1f1f] border-white/10 text-gray-200 focus:ring-1 focus:ring-indigo-500' 
                                  : 'bg-slate-50 border-slate-200 text-slate-800 focus:ring-1 focus:ring-indigo-500'
                              }`}
                            >
                              <option value="">Sin Sprint (Backlog)</option>
                              {sprints.map(sp => (
                                <option key={sp.id} value={sp.id}>
                                  {sp.name}
                                </option>
                              ))}
                            </select>

                            {/* One-click toggle button for current selected sprint */}
                            {selectedSprintId && (
                              isTaskInActiveSprint ? (
                                <button
                                  type="button"
                                  onClick={() => handleAssignTaskToSprint(task.id, null)}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 transition-all cursor-pointer"
                                  title="Quitar de este sprint y mover a Backlog"
                                >
                                  Desasociar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAssignTaskToSprint(task.id, selectedSprintId)}
                                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                  title={`Asociar directamente a ${currentSelectedSprint?.name || 'Sprint'}`}
                                >
                                  <Plus size={13} />
                                  <span>Asociar</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className={`px-6 py-3 border-t flex items-center justify-between shrink-0 text-xs ${
            isDarkMode ? 'bg-[#1a1a1a] border-white/5 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'
          }`}>
            <span>
              {sprints.length} {sprints.length === 1 ? 'sprint configurado' : 'sprints configurados'} &bull; {tasks.filter(t => t.sprintId).length} tareas asignadas en Firestore
            </span>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              Listo
            </button>
          </div>
        </motion.div>
      </div>

      {/* Delete Sprint Confirmation Modal */}
      <ConfirmModal
        isOpen={!!sprintToDelete}
        title={`¿Eliminar ${sprintToDelete?.name || 'este Sprint'}?`}
        message={`Esta acción eliminará el sprint. Las tareas asociadas a este sprint no se borrarán; serán desvinculadas automáticamente y pasarán al Backlog.`}
        confirmText="Eliminar Sprint"
        cancelText="Cancelar"
        type="danger"
        onConfirm={handleDeleteSprintConfirmed}
        onClose={() => setSprintToDelete(null)}
        isDarkMode={isDarkMode}
      />
    </>
  );
};
