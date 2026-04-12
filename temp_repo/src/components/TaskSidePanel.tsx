import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Edit2, Trash2, MessageSquare, Clock, User, Users, Tag, Star, Calendar, FileText, History, CheckCircle2, XCircle, GitBranch } from 'lucide-react';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, collection, query, onSnapshot, addDoc, deleteDoc, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import { usePermissions } from '../hooks/usePermissions';
import { handleFirestoreError, OperationType } from '../firebase';
import { ConfirmModal } from './ui/ConfirmModal';
import { notifyNoteAdded, getProjectAdmins } from '../services/notificationService';
import { KANBAN_COLUMNS } from '../config/kanbanColumns';
import { dedupeById } from '../utils/dedupe';
import { formatName, formatFullName } from '../utils/formatters';

const STATUS_OPTIONS = KANBAN_COLUMNS.map(col => ({
  value: col.id,
  label: col.title,
  color: `${col.bg} ${col.color.replace('bg-', 'text-')}`
}));

const TYPE_OPTIONS = ['feature', 'bug', 'quality', 'security', 'operations'];

const TaskSidePanel = ({ 
  taskId, 
  projectId, 
  onClose, 
  userRole, 
  currentUser, 
  students,
  updateTaskStatus,
  updateTaskField,
  deleteTask,
  isDarkMode
}: any) => {
  const [task, setTask] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details');
  const [rejectionModal, setRejectionModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const permissions = usePermissions(userRole);

  useEffect(() => {
    if (!taskId || !projectId) return;

    const taskRef = doc(db, `projects/${projectId}/tasks/${taskId}`);
    const unsubscribeTask = onSnapshot(taskRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        setTask(data);
        setEditForm(data);
      }
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}/tasks/${taskId}`);
    });

    const notesRef = collection(db, `projects/${projectId}/tasks/${taskId}/notes`);
    const qNotes = query(notesRef, orderBy('createdAt', 'desc'));
    const unsubscribeNotes = onSnapshot(qNotes, (snapshot) => {
      const notesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotes(dedupeById(notesData));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}/tasks/${taskId}/notes`);
    });

    const activityRef = collection(db, `projects/${projectId}/tasks/${taskId}/activity`);
    const qActivity = query(activityRef, orderBy('createdAt', 'desc'));
    const unsubscribeActivity = onSnapshot(qActivity, (snapshot) => {
      const activityData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setActivity(dedupeById(activityData));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}/tasks/${taskId}/activity`);
    });

    return () => {
      unsubscribeTask();
      unsubscribeNotes();
      unsubscribeActivity();
    };
  }, [taskId, projectId]);

  const handleSave = async () => {
    if (!permissions.canEditTask) {
      toast.error('No tienes permisos para editar tareas');
      return;
    }
    try {
      if (updateTaskField) {
        // Update multiple fields if possible, or loop
        for (const [key, value] of Object.entries(editForm)) {
          if (task[key] !== value && key !== 'id') {
            await updateTaskField(taskId, key, value, task[key]);
          }
        }
      } else {
        await updateDoc(doc(db, `projects/${projectId}/tasks/${taskId}`), editForm);
      }
      setIsEditing(false);
      toast.success('Tarea actualizada');
    } catch (error) {
      console.error("Error updating task:", error);
      toast.error('Error al actualizar tarea');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!permissions.canChangeStatus) {
      toast.error('No tienes permisos para cambiar el estado');
      return;
    }
    try {
      if (updateTaskStatus) {
        await updateTaskStatus(taskId, newStatus, task.status);
      } else {
        await updateDoc(doc(db, `projects/${projectId}/tasks/${taskId}`), { status: newStatus });
      }
      toast.success('Estado actualizado');
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error('Error al actualizar estado');
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    try {
      const authorName = currentUser?.displayName || 'Usuario';
      await addDoc(collection(db, `projects/${projectId}/tasks/${taskId}/notes`), {
        content: newNote,
        authorUid: currentUser?.uid || 'unknown',
        authorName: authorName,
        createdAt: new Date().toISOString(),
        editedAt: null
      });
      
      const currentUsr = {
        uid: currentUser?.uid || 'unknown',
        firstName: currentUser?.displayName?.split(' ')[0] || 'Usuario',
        lastNamePaterno: currentUser?.displayName?.split(' ')[1] || ''
      };

      const noteObj = { content: newNote };
      if (task.assignedTo && task.assignedTo !== currentUsr.uid) {
        await notifyNoteAdded(task.assignedTo, task, noteObj, currentUsr);
      }
      const admins = await getProjectAdmins(projectId);
      await Promise.all(admins
        .filter(a => a.uid !== currentUsr.uid && a.uid !== task.assignedTo)
        .map(a => notifyNoteAdded(a.uid, task, noteObj, currentUsr))
      );

      setNewNote('');
      toast.success('Nota agregada');
    } catch (error) {
      console.error("Error adding note:", error);
      toast.error('Error al agregar nota');
    }
  };

  const handleDelete = async () => {
    if (!permissions.canDeleteTask) {
      toast.error('No tienes permisos para eliminar tareas');
      return;
    }
    try {
      if (deleteTask) {
        await deleteTask(taskId);
      } else {
        await deleteDoc(doc(db, `projects/${projectId}/tasks/${taskId}`));
      }
      toast.success('Tarea eliminada');
      onClose();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error('Error al eliminar tarea');
    }
  };

  const handleApprove = async () => {
    if (!permissions.canApproveTask) return;
    try {
      await updateTaskStatus(taskId, 'todo', 'pending_approval');
      toast.success('Tarea aprobada');
    } catch (error) {
      console.error("Error approving task:", error);
      toast.error('Error al aprobar tarea');
    }
  };

  const handleReject = async () => {
    if (!permissions.canRejectTask || rejectionReason.length < 10) return;
    try {
      await updateTaskStatus(taskId, 'rejected', 'pending_approval', rejectionReason);
      
      // Add rejection note
      await addDoc(collection(db, `projects/${projectId}/tasks/${taskId}/notes`), {
        content: `RECHAZO: ${rejectionReason}`,
        authorUid: currentUser?.uid,
        authorName: currentUser?.displayName || 'Admin',
        tag: 'rechazo',
        createdAt: new Date().toISOString()
      });

      toast.success('Tarea rechazada');
      setRejectionModal(false);
      setRejectionReason('');
    } catch (error) {
      console.error("Error rejecting task:", error);
      toast.error('Error al rechazar tarea');
    }
  };

  const isPending = task?.status === 'pending_approval';
  const isRejected = task?.status === 'rejected';

  if (isLoading) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`fixed inset-0 ${isDarkMode ? 'bg-black/40' : 'bg-slate-900/20'} backdrop-blur-sm z-50 flex justify-end`}
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className={`w-full sm:max-w-2xl ${isDarkMode ? 'bg-[#1a1a1a] border-l border-white/5' : 'bg-white'} h-full shadow-2xl flex flex-col overflow-hidden`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`p-4 sm:p-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'} flex justify-between items-start gap-4`}>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input 
                  value={editForm.title || ''} 
                  onChange={e => setEditForm({...editForm, title: e.target.value})}
                  className={`w-full text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} border-b-2 border-indigo-500 focus:outline-none bg-transparent`}
                />
              ) : (
                <h2 className={`text-xl sm:text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'} truncate`}>{task?.title}</h2>
              )}
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-2 sm:mt-4">
                <select 
                  value={task?.status || ''} 
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={isPending || isRejected}
                  className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest outline-none cursor-pointer disabled:cursor-not-allowed ${STATUS_OPTIONS.find(o => o.value === task?.status)?.color || (isDarkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-700')}`}
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-slate-900'}>{opt.label}</option>
                  ))}
                </select>

                <div className={`flex items-center gap-2 text-xs sm:text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-semibold`}>
                  <User size={14} className="sm:w-4 sm:h-4" />
                  {isEditing ? (
                    <select 
                      value={editForm.assignedTo || ''} 
                      onChange={e => setEditForm({...editForm, assignedTo: e.target.value})}
                      className={`${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200'} border rounded-lg px-2 py-1 outline-none text-xs sm:text-sm`}
                    >
                      <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Sin asignar</option>
                      {students.map((s: any) => (
                        <option key={s.id} value={s.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{formatName(s.firstName, s.lastNamePaterno)}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="truncate max-w-[100px] sm:max-w-none" title={students.find((s: any) => s.id === task?.assignedTo)?.career || ''}>
                      {formatName(students.find((s: any) => s.id === task?.assignedTo)?.firstName, students.find((s: any) => s.id === task?.assignedTo)?.lastNamePaterno)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              {isPending && permissions.canApproveTask && (
                <>
                  <button 
                    onClick={handleApprove}
                    className={`p-1.5 sm:p-2 text-emerald-600 ${isDarkMode ? 'hover:bg-emerald-500/10' : 'hover:bg-emerald-50'} rounded-xl transition-colors`} 
                    title="Aprobar tarea"
                  >
                    <CheckCircle2 size={20} className="sm:w-6 sm:h-6" />
                  </button>
                  <button 
                    onClick={() => setRejectionModal(true)}
                    className={`p-1.5 sm:p-2 text-red-600 ${isDarkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'} rounded-xl transition-colors`} 
                    title="Rechazar tarea"
                  >
                    <XCircle size={20} className="sm:w-6 sm:h-6" />
                  </button>
                </>
              )}
              {permissions.canDeleteTask && !isPending && (
                <button onClick={() => setShowDeleteConfirm(true)} className={`p-1.5 sm:p-2 ${isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'} rounded-xl transition-colors`} title="Eliminar tarea"><Trash2 size={18} className="sm:w-5 sm:h-5" /></button>
              )}
              {permissions.canEditTask && !isPending && !isRejected && (
                isEditing ? (
                  <button onClick={handleSave} className={`p-1.5 sm:p-2 text-indigo-600 ${isDarkMode ? 'hover:bg-indigo-500/10' : 'hover:bg-indigo-50'} rounded-xl transition-colors`} title="Guardar cambios"><Save size={18} className="sm:w-5 sm:h-5" /></button>
                ) : (
                  <button onClick={() => setIsEditing(true)} className={`p-1.5 sm:p-2 ${isDarkMode ? 'text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'} rounded-xl transition-colors`} title="Editar tarea"><Edit2 size={18} className="sm:w-5 sm:h-5" /></button>
                )
              )}
              <button onClick={onClose} className={`p-1.5 sm:p-2 ${isDarkMode ? 'text-slate-500 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-500 hover:bg-red-50'} rounded-xl transition-colors`} title="Cerrar panel"><X size={20} className="sm:w-6 sm:h-6" /></button>
            </div>
          </div>

          {/* Tabs */}
          <div className={`px-4 sm:px-6 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-100'} flex gap-4 sm:gap-6`}>
            <button 
              onClick={() => setActiveTab('details')}
              className={`py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'details' ? 'border-indigo-600 text-indigo-600' : `border-transparent ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}`}
            >
              Detalles
            </button>
            <button 
              onClick={() => setActiveTab('activity')}
              className={`py-3 sm:py-4 text-[10px] sm:text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'activity' ? 'border-indigo-600 text-indigo-600' : `border-transparent ${isDarkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600'}`}`}
            >
              Actividad
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 sm:pb-6">
            {activeTab === 'details' ? (
              <div className="space-y-8">
                {/* Metadata Grid */}
            <div className={`grid grid-cols-2 sm:grid-cols-3 gap-6 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} p-6 rounded-2xl border`}>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Calendar size={12}/> Inicio</span>
                {isEditing ? (
                  <input type="date" value={editForm.startDate?.split('T')[0] || ''} onChange={e => setEditForm({...editForm, startDate: new Date(e.target.value).toISOString()})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} />
                ) : (
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} text-sm`}>{task?.startDate ? new Intl.DateTimeFormat('es-MX').format(new Date(task.startDate)) : '-'}</p>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Calendar size={12}/> Fin</span>
                {isEditing ? (
                  <input type="date" value={editForm.endDate?.split('T')[0] || ''} onChange={e => setEditForm({...editForm, endDate: new Date(e.target.value).toISOString()})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} />
                ) : (
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} text-sm`}>{task?.endDate ? new Intl.DateTimeFormat('es-MX').format(new Date(task.endDate)) : '-'}</p>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Star size={12}/> Prioridad</span>
                {isEditing ? (
                  <select value={editForm.priority || 3} onChange={e => setEditForm({...editForm, priority: Number(e.target.value)})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`}>
                    {[1,2,3,4,5].map(n => <option key={n} value={n} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{n} Estrellas</option>)}
                  </select>
                ) : (
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={14} className={i < (task?.priority || 3) ? 'text-yellow-400 fill-yellow-400' : (isDarkMode ? 'text-white/10' : 'text-slate-200')} />
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Tag size={12}/> Tipo</span>
                {isEditing ? (
                  <select value={editForm.type || 'feature'} onChange={e => setEditForm({...editForm, type: e.target.value})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`}>
                    {TYPE_OPTIONS.map(t => <option key={t} value={t} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{t}</option>)}
                  </select>
                ) : (
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} text-sm capitalize`}>{task?.type || '-'}</p>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Clock size={12}/> Esfuerzo</span>
                {isEditing ? (
                  <input type="number" value={editForm.effort || 0} onChange={e => setEditForm({...editForm, effort: Number(e.target.value)})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} />
                ) : (
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} text-sm`}>{task?.effort || 0} pts</p>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Tag size={12}/> Sprint/Fase</span>
                {isEditing ? (
                  <input type="text" value={editForm.phase || ''} onChange={e => setEditForm({...editForm, phase: e.target.value})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} />
                ) : (
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} text-sm`}>{task?.phase || '-'}</p>
                )}
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-3">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Users size={12}/> Recursos (Separados por coma)</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editForm.resources?.join(', ') || ''} 
                    onChange={e => setEditForm({...editForm, resources: e.target.value.split(',').map((r: string) => r.trim()).filter(Boolean)})} 
                    className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} 
                    placeholder="ARQ, DIS, EST..."
                  />
                ) : (
                  <div className="flex flex-wrap gap-2 mt-1">
                    {task?.resources?.map((r: string) => (
                      <span key={r} className={`px-2 py-1 ${isDarkMode ? 'bg-white/5 text-slate-400 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'} rounded-lg text-[10px] font-bold uppercase tracking-widest border`}>
                        {r}
                      </span>
                    )) || <p className="text-slate-400 text-xs font-medium">Sin recursos asignados</p>}
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><Tag size={12}/> Color</span>
                {isEditing ? (
                  <input type="color" value={editForm.color || '#6366f1'} onChange={e => setEditForm({...editForm, color: e.target.value})} className={`w-full h-8 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} rounded-lg px-1 py-1 outline-none cursor-pointer`} />
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <div className={`w-6 h-6 rounded-lg border ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`} style={{ backgroundColor: task?.color || '#6366f1' }} />
                    <span className={`text-xs font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-500'} font-mono uppercase`}>{task?.color || '#6366f1'}</span>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <span className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest flex items-center gap-1`}><GitBranch size={12}/> Posición X/Y</span>
                {isEditing ? (
                  <div className="flex gap-2">
                    <input type="number" value={editForm.x || 0} onChange={e => setEditForm({...editForm, x: Number(e.target.value)})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} placeholder="X" />
                    <input type="number" value={editForm.y || 0} onChange={e => setEditForm({...editForm, y: Number(e.target.value)})} className={`w-full text-sm font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-lg px-2 py-1 outline-none`} placeholder="Y" />
                  </div>
                ) : (
                  <p className={`font-bold ${isDarkMode ? 'text-slate-300' : 'text-slate-700'} text-sm font-mono`}>{task?.x || 0} , {task?.y || 0}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-3">
              <h3 className={`text-sm font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-800'} uppercase tracking-widest flex items-center gap-2`}><FileText size={16} /> Descripción</h3>
              {isEditing ? (
                <textarea 
                  value={editForm.description || ''} 
                  onChange={e => setEditForm({...editForm, description: e.target.value})}
                  className={`w-full p-4 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200'} rounded-2xl min-h-[120px] focus:ring-2 focus:ring-indigo-500 outline-none text-sm`}
                  placeholder="Descripción de la tarea..."
                />
              ) : (
                <div className={`prose prose-sm max-w-none ${isDarkMode ? 'text-slate-400 bg-white/5 border-white/5 prose-invert' : 'text-slate-600 bg-white border-slate-100'} p-4 rounded-2xl border`}>
                  <ReactMarkdown>{task?.description || '*Sin descripción*'}</ReactMarkdown>
                </div>
              )}
            </div>

                {/* Notes Section */}
                <div className={`space-y-6 pt-6 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
                  <h3 className={`text-sm font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-800'} uppercase tracking-widest flex items-center gap-2`}><MessageSquare size={16} /> Notas y Comentarios</h3>
                  
                  <div className={`${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} p-4 rounded-2xl border space-y-3`}>
                    <textarea 
                      value={newNote}
                      onChange={e => setNewNote(e.target.value)}
                      placeholder="Escribe una nota (soporta Markdown)..."
                      className={`w-full p-3 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200'} rounded-xl min-h-[80px] focus:ring-2 focus:ring-indigo-500 outline-none text-sm`}
                    />
                    <div className="flex justify-end">
                      <button 
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-700 transition-colors disabled:opacity-50"
                      >
                        Agregar Nota
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {notes.map((note: any) => (
                      <div key={note.id} className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100 shadow-sm'} p-4 rounded-2xl border space-y-3`}>
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'} flex items-center justify-center text-xs font-black`}>
                              {note.authorName?.charAt(0) || 'U'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className={`text-sm font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-800'}`}>{formatFullName(note.authorName)}</p>
                                {note.tag === 'rechazo' && (
                                  <span className="bg-red-100 text-red-600 text-[8px] font-black uppercase px-1.5 py-0.5 rounded">Rechazo</span>
                                )}
                              </div>
                              <p className={`text-[10px] font-semibold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>
                                {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(note.createdAt))}
                              </p>
                            </div>
                          </div>
                          {note.authorUid === currentUser?.uid && (
                            <button className={`text-slate-400 ${isDarkMode ? 'hover:text-indigo-400' : 'hover:text-indigo-600'} p-1`}><Edit2 size={14} /></button>
                          )}
                        </div>
                        <div className={`prose prose-sm max-w-none ${isDarkMode ? 'text-slate-400 prose-invert' : 'text-slate-600'} pl-10`}>
                          <ReactMarkdown>{note.content}</ReactMarkdown>
                        </div>
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <p className={`text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-sm font-medium py-8`}>No hay notas aún.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className={`text-sm font-black ${isDarkMode ? 'text-slate-300' : 'text-slate-800'} uppercase tracking-widest flex items-center gap-2`}><History size={16} /> Historial de Cambios</h3>
                <div className="space-y-4">
                  {activity.map((item: any) => (
                    <div key={item.id} className="flex gap-4 relative">
                      <div className="w-8 flex flex-col items-center shrink-0">
                        <div className={`w-8 h-8 rounded-full ${isDarkMode ? 'bg-white/5 text-slate-500 border-white/10' : 'bg-slate-100 text-slate-500 border-slate-200'} flex items-center justify-center z-10`}>
                          <Clock size={14} />
                        </div>
                        <div className={`w-0.5 flex-1 ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'} -mt-1`} />
                      </div>
                      <div className="flex-1 pb-6">
                        <div className={`${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'} p-4 rounded-2xl border`}>
                          <div className="flex justify-between items-center mb-2">
                            <span className={`text-xs font-black ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{formatFullName(item.authorName)}</span>
                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase`}>
                              {new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(item.createdAt))}
                            </span>
                          </div>
                          <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} leading-relaxed`}>
                            {item.type === 'status_change' ? (
                              <>Cambió el estado de <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'}`}>{STATUS_OPTIONS.find(o => o.value === item.oldValue)?.label}</span> a <span className="font-bold text-indigo-600">{STATUS_OPTIONS.find(o => o.value === item.newValue)?.label}</span></>
                            ) : item.type === 'field_update' ? (
                              <>Actualizó <span className={`font-bold ${isDarkMode ? 'text-slate-200' : 'text-slate-900'} capitalize`}>{item.field}</span></>
                            ) : (
                              <>{item.type}</>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activity.length === 0 && (
                    <p className={`text-center ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} text-sm font-medium py-8`}>No hay actividad registrada.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>

      {/* Rejection Modal */}
      <AnimatePresence>
        {rejectionModal && (
          <div className={`fixed inset-0 ${isDarkMode ? 'bg-black/60' : 'bg-slate-900/40'} backdrop-blur-sm z-[70] flex items-center justify-center p-4`}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`${isDarkMode ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} w-full max-w-md rounded-3xl shadow-2xl overflow-hidden`}
            >
              <div className={`p-6 border-b ${isDarkMode ? 'border-white/5 bg-red-500/10' : 'border-slate-100 bg-red-50'}`}>
                <h3 className={`text-xl font-black ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>Rechazar Tarea</h3>
                <p className={`text-xs font-bold ${isDarkMode ? 'text-red-500/70' : 'text-red-500'} uppercase tracking-widest truncate`}>{task?.title}</p>
              </div>
              <div className="p-6 space-y-4">
                <label className={`text-[10px] font-black ${isDarkMode ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>Motivo del rechazo (mín. 10 caracteres)</label>
                <textarea 
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Explica por qué se rechaza la propuesta..."
                  className={`w-full p-4 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200'} rounded-2xl focus:ring-2 focus:ring-red-500 outline-none text-sm min-h-[120px]`}
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => { setRejectionModal(false); setRejectionReason(''); }}
                    className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'} transition-colors`}
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleReject}
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
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="¿Eliminar Tarea?"
        message="¿Estás seguro de que deseas mover esta tarea a la papelera?"
        confirmText="Eliminar"
        isDarkMode={isDarkMode}
      />
    </AnimatePresence>
  );
};

export default TaskSidePanel;
