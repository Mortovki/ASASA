import React, { useState } from 'react';
import { 
  X, 
  Calendar, 
  Clock, 
  User, 
  Paperclip, 
  MessageSquare, 
  Send, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Plus, 
  ExternalLink,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { ProjectTask, TaskPriority, TaskStatus, TaskComment, TaskAttachment } from '../../types/tasks';
import { updateTask, addTaskComment, addTaskAttachment, deleteTask } from '../../services/taskService';
import { nanoid } from 'nanoid';
import toast from 'react-hot-toast';

interface TaskDetailModalProps {
  task: ProjectTask;
  isOpen: boolean;
  onClose: () => void;
  students: any[];
  currentUserId: string;
  currentUserName: string;
  canEditStructure: boolean; // Coordinators only
  canEditStatus: boolean;    // Coordinators + assigned students
  isDarkMode: boolean;
  onLogHoursForTask?: (task: ProjectTask) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  students,
  currentUserId,
  currentUserName,
  canEditStructure,
  canEditStatus,
  isDarkMode,
  onLogHoursForTask
}) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate || '');
  const [startDate, setStartDate] = useState(task.startDate || '');
  const [endDate, setEndDate] = useState(task.endDate || '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task.assigneeIds || []);
  const [newComment, setNewComment] = useState('');
  const [newAttachmentName, setNewAttachmentName] = useState('');
  const [newAttachmentUrl, setNewAttachmentUrl] = useState('');
  const [showAddAttachment, setShowAddAttachment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSaveBasic = async () => {
    setIsSaving(true);
    try {
      await updateTask(task.id, {
        title: title.trim() || task.title,
        description: description.trim(),
        status,
        priority,
        dueDate: dueDate || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        assigneeIds
      });
      toast.success('Tarea actualizada');
    } catch (err) {
      toast.error('Error al actualizar tarea');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const comment: TaskComment = {
      id: nanoid(8),
      userId: currentUserId,
      userName: currentUserName || 'Usuario',
      content: newComment.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await addTaskComment(task.id, comment);
      setNewComment('');
      toast.success('Comentario agregado');
    } catch (err) {
      toast.error('Error al agregar comentario');
    }
  };

  const handleAddAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAttachmentName.trim() || !newAttachmentUrl.trim()) return;

    const attachment: TaskAttachment = {
      id: nanoid(8),
      name: newAttachmentName.trim(),
      url: newAttachmentUrl.trim(),
      uploadedBy: currentUserId,
      uploadedByName: currentUserName,
      uploadedAt: new Date().toISOString()
    };

    try {
      await addTaskAttachment(task.id, attachment);
      setNewAttachmentName('');
      setNewAttachmentUrl('');
      setShowAddAttachment(false);
      toast.success('Entregable adjuntado');
    } catch (err) {
      toast.error('Error al adjuntar entregable');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`¿Estás seguro de eliminar la tarea "${task.title}"?`)) return;
    try {
      await deleteTask(task.id);
      toast.success('Tarea eliminada');
      onClose();
    } catch (err) {
      toast.error('Error al eliminar tarea');
    }
  };

  const statusOptions: { value: TaskStatus; label: string; bg: string }[] = [
    { value: 'no_iniciado', label: 'No iniciado', bg: 'bg-slate-400' },
    { value: 'en_curso', label: 'En curso', bg: 'bg-amber-500' },
    { value: 'detenido', label: 'Detenido', bg: 'bg-red-500' },
    { value: 'listo', label: 'Listo', bg: 'bg-emerald-500' }
  ];

  const priorityOptions: { value: TaskPriority; label: string; color: string }[] = [
    { value: 'baja', label: 'Baja', color: 'text-blue-500 bg-blue-500/10' },
    { value: 'media', label: 'Media', color: 'text-indigo-500 bg-indigo-500/10' },
    { value: 'alta', label: 'Alta', color: 'text-purple-600 bg-purple-500/10' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-6 border-b flex items-center justify-between gap-4 ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
              {task.projectName} · {task.groupName}
            </span>
            {canEditStructure ? (
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                onBlur={handleSaveBasic}
                className={`w-full text-xl font-black bg-transparent border-b border-transparent hover:border-indigo-500/30 focus:border-indigo-500 outline-none transition-all mt-1 ${
                  isDarkMode ? 'text-white' : 'text-slate-900'
                }`}
              />
            ) : (
              <h2 className="text-xl font-black mt-1 truncate">{task.title}</h2>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEditStructure && (
              <button 
                onClick={handleDelete}
                className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                title="Eliminar tarea"
              >
                <Trash2 size={18} />
              </button>
            )}
            <button 
              onClick={onClose}
              className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-200 text-slate-500'}`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick status bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Estado */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <label className="text-[10px] font-black uppercase tracking-widest block text-slate-400 mb-2">Estado</label>
              {canEditStatus ? (
                <select 
                  value={status} 
                  onChange={e => {
                    const next = e.target.value as TaskStatus;
                    setStatus(next);
                    updateTask(task.id, { status: next });
                    toast.success('Estado actualizado');
                  }}
                  className={`w-full p-2 rounded-xl font-bold text-xs uppercase outline-none cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 text-white border border-white/10' : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                >
                  {statusOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-black uppercase">{task.status.replace('_', ' ')}</span>
              )}
            </div>

            {/* Prioridad */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <label className="text-[10px] font-black uppercase tracking-widest block text-slate-400 mb-2">Prioridad</label>
              {canEditStructure ? (
                <select 
                  value={priority} 
                  onChange={e => {
                    const next = e.target.value as TaskPriority;
                    setPriority(next);
                    updateTask(task.id, { priority: next });
                    toast.success('Prioridad actualizada');
                  }}
                  className={`w-full p-2 rounded-xl font-bold text-xs uppercase outline-none cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 text-white border border-white/10' : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                >
                  {priorityOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <span className="text-xs font-black uppercase">{task.priority}</span>
              )}
            </div>

            {/* Vencimiento */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <label className="text-[10px] font-black uppercase tracking-widest block text-slate-400 mb-2">Vencimiento</label>
              {canEditStructure ? (
                <input 
                  type="date" 
                  value={dueDate} 
                  onChange={e => {
                    setDueDate(e.target.value);
                    updateTask(task.id, { dueDate: e.target.value });
                  }}
                  className={`w-full p-2 rounded-xl font-bold text-xs outline-none ${
                    isDarkMode ? 'bg-zinc-800 text-white border border-white/10' : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                />
              ) : (
                <span className="text-xs font-bold">{task.dueDate || 'Sin fecha'}</span>
              )}
            </div>

            {/* Cronograma / Rango */}
            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
              <label className="text-[10px] font-black uppercase tracking-widest block text-slate-400 mb-2">Cronograma (Gantt)</label>
              <div className="flex items-center gap-1">
                <input 
                  type="date" 
                  value={startDate} 
                  disabled={!canEditStructure}
                  onChange={e => {
                    setStartDate(e.target.value);
                    updateTask(task.id, { startDate: e.target.value });
                  }}
                  className={`w-1/2 p-1.5 rounded-lg text-[10px] font-bold ${
                    isDarkMode ? 'bg-zinc-800 text-white' : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                />
                <span className="text-xs text-slate-400">-</span>
                <input 
                  type="date" 
                  value={endDate} 
                  disabled={!canEditStructure}
                  onChange={e => {
                    setEndDate(e.target.value);
                    updateTask(task.id, { endDate: e.target.value });
                  }}
                  className={`w-1/2 p-1.5 rounded-lg text-[10px] font-bold ${
                    isDarkMode ? 'bg-zinc-800 text-white' : 'bg-white text-slate-800 border border-slate-200'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Descripción y Objetivos</label>
            {canEditStructure ? (
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)}
                onBlur={handleSaveBasic}
                rows={3}
                placeholder="Escribe los detalles y requerimientos de la tarea..."
                className={`w-full p-4 rounded-2xl border text-sm outline-none transition-all focus:ring-2 focus:ring-indigo-500/20 ${
                  isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder:text-gray-600' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
            ) : (
              <p className={`p-4 rounded-2xl border text-sm ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                {task.description || 'Sin descripción detallada.'}
              </p>
            )}
          </div>

          {/* Assignees */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Responsables Asignados</label>
              {canEditStructure && (
                <span className="text-[10px] text-indigo-500 font-bold">Selecciona prestadores para asignar</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {assigneeIds.map(uid => {
                const student = students.find(s => s.id === uid || s.uid === uid);
                const name = student?.name || student?.firstName || 'Prestador';
                return (
                  <div 
                    key={uid} 
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold ${
                      isDarkMode ? 'bg-white/10 border-white/10 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-700'
                    }`}
                  >
                    <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-black">
                      {name[0]}
                    </div>
                    <span>{name}</span>
                    {canEditStructure && (
                      <button 
                        type="button"
                        onClick={() => {
                          const next = assigneeIds.filter(id => id !== uid);
                          setAssigneeIds(next);
                          updateTask(task.id, { assigneeIds: next });
                        }}
                        className="text-slate-400 hover:text-rose-500"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
              {canEditStructure && (
                <select 
                  onChange={e => {
                    if (e.target.value && !assigneeIds.includes(e.target.value)) {
                      const next = [...assigneeIds, e.target.value];
                      setAssigneeIds(next);
                      updateTask(task.id, { assigneeIds: next });
                    }
                    e.target.value = '';
                  }}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold outline-none cursor-pointer ${
                    isDarkMode ? 'bg-zinc-800 border-white/10 text-gray-300' : 'bg-slate-100 border-slate-200 text-slate-700'
                  }`}
                >
                  <option value="">+ Asignar persona</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Action: Log hours to Bitacora if task is completed */}
          {onLogHoursForTask && (
            <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
              status === 'listo'
                ? (isDarkMode ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200')
                : (isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200')
            }`}>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={16} /> Registro en Bitácora de Horas
                </h4>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                  Asienta directamente las horas de servicio invertidas en esta tarea.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  onLogHoursForTask(task);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-md transition-all flex items-center gap-2"
              >
                <BookOpen size={14} /> Asentar horas
              </button>
            </div>
          )}

          {/* Attachments Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <Paperclip size={14} /> Entregables y Archivos ({task.attachments?.length || 0})
              </label>
              <button 
                type="button" 
                onClick={() => setShowAddAttachment(!showAddAttachment)}
                className="text-xs text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1"
              >
                <Plus size={14} /> Agregar entregable
              </button>
            </div>

            {showAddAttachment && (
              <form onSubmit={handleAddAttachment} className={`p-4 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input 
                    type="text" 
                    placeholder="Nombre del archivo o entregable..." 
                    value={newAttachmentName}
                    onChange={e => setNewAttachmentName(e.target.value)}
                    className={`p-2.5 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                  <input 
                    type="url" 
                    placeholder="Enlace (Drive, Figma, OneDrive, etc.)..." 
                    value={newAttachmentUrl}
                    onChange={e => setNewAttachmentUrl(e.target.value)}
                    className={`p-2.5 rounded-xl border text-xs outline-none ${
                      isDarkMode ? 'bg-zinc-800 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAddAttachment(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(task.attachments || []).map(att => (
                <a 
                  key={att.id} 
                  href={att.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                    isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10 text-white' : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Paperclip size={14} className="text-indigo-500 shrink-0" />
                    <span className="text-xs font-bold truncate">{att.name}</span>
                  </div>
                  <ExternalLink size={14} className="text-slate-400 shrink-0" />
                </a>
              ))}
              {(!task.attachments || task.attachments.length === 0) && !showAddAttachment && (
                <p className="text-xs text-slate-400 italic">No hay archivos o entregables adjuntos.</p>
              )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-white/5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <MessageSquare size={14} /> Conversación y Seguimiento ({task.comments?.length || 0})
            </label>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(task.comments || []).map(comm => (
                <div 
                  key={comm.id} 
                  className={`p-3 rounded-2xl border text-xs space-y-1 ${
                    isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-indigo-500">{comm.userName}</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className={isDarkMode ? 'text-gray-300' : 'text-slate-700'}>{comm.content}</p>
                </div>
              ))}
              {(!task.comments || task.comments.length === 0) && (
                <p className="text-xs text-slate-400 italic">Sin comentarios aún. Escribe una nota para el equipo.</p>
              )}
            </div>

            <form onSubmit={handleAddComment} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Escribe un comentario o actualización..." 
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                className={`flex-1 p-3 rounded-xl border text-xs outline-none ${
                  isDarkMode ? 'bg-zinc-800 border-white/10 text-white placeholder:text-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
              <button 
                type="submit" 
                disabled={!newComment.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow transition-all disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-4 border-t flex justify-end ${isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50'}`}>
          <button 
            type="button" 
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
