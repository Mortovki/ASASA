import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { Trash2, RotateCcw, Search, Calendar, User, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';
import { handleFirestoreError, OperationType } from '../firebase';
import { ConfirmModal } from './ui/ConfirmModal';

import { dedupeById } from '../utils/dedupe';
import { formatName } from '../utils/formatters';

const DeletedTasksView = ({ projectId, restoreTask, permanentDelete, students, isDarkMode }: any) => {
  const [deletedTasks, setDeletedTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    const deletedRef = collection(db, `projects/${projectId}/deletedTasks`);
    const q = query(deletedRef, orderBy('deletedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasksData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeletedTasks(dedupeById(tasksData));
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `projects/${projectId}/deletedTasks`);
    });

    return () => unsubscribe();
  }, [projectId]);

  const filteredTasks = deletedTasks.filter(t => 
    (t.title || '').toLowerCase().includes((searchTerm || '').toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Papelera de Reciclaje</h3>
          <p className={`text-xs font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Tareas eliminadas recientemente</p>
        </div>
        
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Buscar en papelera..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm outline-none transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:ring-indigo-500/50' : 'bg-white border-slate-200 text-slate-900 focus:ring-indigo-500'}`}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map(task => {
            const assignedStudent = students?.find((s: any) => s.id === task.assignedTo);
            return (
              <motion.div 
                key={task.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group transition-colors ${isDarkMode ? 'bg-[#1a1a1a] border-white/5 hover:border-indigo-500/50' : 'bg-white border-slate-200 hover:border-indigo-200'}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{task.title}</h4>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${isDarkMode ? 'text-gray-400 bg-white/5 border-white/10' : 'text-slate-400 bg-slate-50 border-slate-100'}`}>
                      {task.status}
                    </span>
                  </div>
                  <div className={`flex flex-wrap items-center gap-4 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-500'}`}>
                    <span className="flex items-center gap-1"><User size={12}/> {assignedStudent ? formatName(assignedStudent.firstName, assignedStudent.lastNamePaterno) : 'Sin asignar'}</span>
                    <span className={`flex items-center gap-1 ${isDarkMode ? 'text-red-400/80' : 'text-red-400'}`}><Calendar size={12}/> Eliminado: {new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(new Date(task.deletedAt))}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => restoreTask(task.id, task)}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                  >
                    <RotateCcw size={14} /> Restaurar
                  </button>
                  <button 
                    onClick={() => setTaskToDelete(task.id)}
                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    <Trash2 size={14} /> Eliminar
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filteredTasks.length === 0 && (
          <div className={`text-center py-12 rounded-3xl border-2 border-dashed ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <div className={`w-12 h-12 rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-[#1a1a1a] text-gray-700' : 'bg-white text-slate-300'}`}>
              <Trash2 size={24} />
            </div>
            <p className={`font-bold ${isDarkMode ? 'text-gray-600' : 'text-slate-500'}`}>La papelera está vacía</p>
            <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${isDarkMode ? 'text-gray-800' : 'text-slate-400'}`}>No hay tareas eliminadas que coincidan</p>
          </div>
        )}
      </div>

      <div className={`border p-4 rounded-2xl flex gap-3 ${isDarkMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-amber-50 border-amber-100'}`}>
        <AlertTriangle className="text-amber-500 shrink-0" size={20} />
        <div className="space-y-1">
          <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-amber-400' : 'text-amber-900'}`}>Nota para Administradores</p>
          <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-amber-400/80' : 'text-amber-700'}`}>
            Las tareas en la papelera conservan su historial de actividad. Al restaurarlas, volverán al tablero principal en su último estado conocido.
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!taskToDelete}
        onClose={() => setTaskToDelete(null)}
        onConfirm={() => {
          if (taskToDelete) permanentDelete(taskToDelete);
        }}
        title="¿Eliminar Permanentemente?"
        message="¿Estás seguro de que deseas eliminar permanentemente esta tarea? Esta acción no se puede deshacer."
        confirmText="Eliminar"
        isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default DeletedTasksView;
