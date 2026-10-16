import React, { useState, useEffect, useCallback } from 'react';
import { Task, TaskList, getTaskLists, getTasks, createTask, updateTask, deleteTask } from '../services/googleTasksService';
import { CheckCircle2, Circle, Plus, Trash2, List, RefreshCw, ChevronRight, Calendar, AlertCircle, ExternalLink, MoreVertical, Search, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { showSuccessToast, showErrorToast, showLoadingToast, showConfirmToast } from '../utils/toastUtils';
import toast from 'react-hot-toast';

interface GoogleTasksViewProps {
  accessToken: string;
  isDarkMode: boolean;
}

export const GoogleTasksView: React.FC<GoogleTasksViewProps> = ({ accessToken, isDarkMode }) => {
  const [taskLists, setTaskLists] = useState<TaskList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTaskLists = useCallback(async () => {
    try {
      setIsLoading(true);
      const lists = await getTaskLists(accessToken);
      setTaskLists(lists);
      if (lists.length > 0 && !selectedListId) {
        setSelectedListId(lists[0].id);
      }
    } catch (error) {
      console.error('Error fetching task lists:', error);
      showErrorToast('Error al cargar las listas de tareas');
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, selectedListId]);

  const fetchTasks = useCallback(async (listId: string) => {
    try {
      setIsTasksLoading(true);
      const fetchedTasks = await getTasks(accessToken, listId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      showErrorToast('Error al cargar las tareas');
    } finally {
      setIsTasksLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    fetchTaskLists();
  }, [fetchTaskLists]);

  useEffect(() => {
    if (selectedListId) {
      fetchTasks(selectedListId);
    }
  }, [selectedListId, fetchTasks]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !selectedListId) return;

    const loadingToast = toast.loading('Creando tarea...');
    try {
      const newTask = await createTask(accessToken, selectedListId, { title: newTaskTitle });
      setTasks([newTask, ...tasks]);
      setNewTaskTitle('');
      showSuccessToast('Tarea creada correctamente');
    } catch (error) {
      console.error('Error creating task:', error);
      showErrorToast('Error al crear la tarea');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleToggleTask = async (task: Task) => {
    if (!selectedListId) return;

    const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
    const originalTasks = [...tasks];
    
    // Optimistic update
    setTasks(tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await updateTask(accessToken, selectedListId, task.id, { status: newStatus });
    } catch (error) {
      console.error('Error updating task:', error);
      setTasks(originalTasks);
      showErrorToast('Error al actualizar la tarea');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    if (!selectedListId) return;

    showConfirmToast(
      '¿Estás seguro de que deseas eliminar esta tarea?',
      async () => {
        const loadingToast = toast.loading('Eliminando tarea...');
        try {
          await deleteTask(accessToken, selectedListId, taskId);
          setTasks(tasks.filter(t => t.id !== taskId));
          showSuccessToast('Tarea eliminada');
        } catch (error) {
          console.error('Error deleting task:', error);
          showErrorToast('Error al eliminar la tarea');
        } finally {
          toast.dismiss(loadingToast);
        }
      },
      "Eliminar",
      "Cancelar"
    );
  };

  const filteredTasks = tasks.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeTasks = filteredTasks.filter(t => t.status === 'needsAction');
  const completedTasks = filteredTasks.filter(t => t.status === 'completed');

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
        <p className={`font-black text-xs uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
          Conectando con Google Tasks...
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className={`text-2xl sm:text-3xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Google Tasks
          </h1>
          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
            Gestiona tus tareas pendientes sincronizadas con tu cuenta de Google.
          </p>
        </div>
        <button 
          onClick={fetchTaskLists}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${
            isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm'
          }`}
        >
          <RefreshCw size={14} className={isTasksLoading ? 'animate-spin' : ''} />
          Sincronizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Task Lists Sidebar */}
        <div className="md:col-span-1 space-y-2">
          <div className="flex items-center gap-2 px-2 mb-2">
            <List size={16} className="text-indigo-500" />
            <h2 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
              Mis Listas
            </h2>
          </div>
          <div className="flex flex-col gap-1">
            {taskLists.map(list => (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                  selectedListId === list.id
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs font-bold truncate">{list.title}</span>
                <ChevronRight size={14} className={`transition-transform ${selectedListId === list.id ? 'translate-x-0' : '-translate-x-2 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'}`} />
              </button>
            ))}
          </div>
        </div>

        {/* Tasks List */}
        <div className="md:col-span-3 space-y-4">
          {/* New Task Input */}
          <form onSubmit={handleCreateTask} className={`p-1.5 rounded-2xl border flex items-center gap-2 transition-all focus-within:ring-2 focus-within:ring-indigo-500/20 ${
            isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
          }`}>
            <div className="pl-3 text-indigo-500">
              <Plus size={20} />
            </div>
            <input
              type="text"
              placeholder="¿Qué tienes pendiente?"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              className={`flex-1 bg-transparent border-none focus:ring-0 text-sm font-bold placeholder:font-normal ${
                isDarkMode ? 'text-white placeholder:text-gray-500' : 'text-slate-900 placeholder:text-slate-400'
              }`}
            />
            <button
              type="submit"
              disabled={!newTaskTitle.trim()}
              className={`px-4 py-2 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDarkMode ? 'bg-indigo-600 text-white hover:bg-indigo-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}
            >
              Añadir
            </button>
          </form>

          {/* Search and Filters placeholder */}
          <div className="flex items-center gap-4">
            <div className={`flex-1 relative flex items-center rounded-xl border transition-all ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'
            }`}>
              <Search size={14} className="absolute left-3 text-gray-500" />
              <input 
                type="text" 
                placeholder="Buscar tareas..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-transparent border-none focus:ring-0 pl-9 pr-4 py-2 text-xs font-medium"
              />
            </div>
          </div>

          <div className="space-y-6">
            {/* Active Tasks */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <CheckSquare size={14} className="text-amber-500" />
                <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                  Pendientes ({activeTasks.length})
                </h3>
              </div>
              <AnimatePresence mode="popLayout">
                {activeTasks.length > 0 ? (
                  activeTasks.map(task => (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`group flex items-center gap-3 p-4 rounded-2xl border transition-all ${
                        isDarkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-slate-100 hover:border-slate-200 hover:shadow-md shadow-sm'
                      }`}
                    >
                      <button 
                        onClick={() => handleToggleTask(task)}
                        className={`transition-colors ${isDarkMode ? 'text-gray-600 hover:text-indigo-400' : 'text-slate-300 hover:text-indigo-500'}`}
                      >
                        <Circle size={22} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-sm font-bold truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{task.title}</h4>
                        {task.notes && (
                          <p className={`text-[11px] truncate mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{task.notes}</p>
                        )}
                        {task.due && (
                          <div className="flex items-center gap-1 mt-1 text-[10px] font-black uppercase text-amber-500">
                            <Calendar size={10} />
                            {new Date(task.due).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className={`p-2 opacity-0 group-hover:opacity-100 transition-all text-red-400 hover:text-red-500`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  !isTasksLoading && (
                    <div className={`p-8 text-center rounded-2xl border border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                      <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                        {searchTerm ? 'No se encontraron tareas con ese nombre' : '¡Todo despejado! No tienes tareas pendientes.'}
                      </p>
                    </div>
                  )
                )}
              </AnimatePresence>
            </div>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-2">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <h3 className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    Completadas ({completedTasks.length})
                  </h3>
                </div>
                <div className="space-y-2 opacity-60 hover:opacity-100 transition-opacity">
                  {completedTasks.map(task => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${
                        isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'
                      }`}
                    >
                      <button 
                        onClick={() => handleToggleTask(task)}
                        className="text-emerald-500"
                      >
                        <CheckCircle2 size={20} />
                      </button>
                      <div className="flex-1 min-w-0">
                        <h4 className={`text-xs font-bold line-through ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>{task.title}</h4>
                      </div>
                      <button 
                        onClick={() => handleDeleteTask(task.id)}
                        className={`p-2 text-red-400 hover:text-red-500`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
