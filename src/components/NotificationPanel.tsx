import React from 'react';
import { Bell, X, Check, Trash2, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc, deleteDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../firebase';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'task_approved' | 'task_rejected' | 'info';
  createdAt: string;
  read: boolean;
  taskId?: string;
  projectId?: string;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  userId: string;
  onNavigate: (projectId: string, taskId?: string) => void;
  isDarkMode?: boolean;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ isOpen, onClose, notifications, userId, onNavigate, isDarkMode }) => {
  const markAsRead = async (id: string) => {
    try {
      const docRef = doc(db, 'users', userId, 'notifications', id);
      await updateDoc(docRef, { read: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        const docRef = doc(db, 'users', userId, 'notifications', n.id);
        batch.update(docRef, { read: true });
      });
      await batch.commit();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      const docRef = doc(db, 'users', userId, 'notifications', id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const clearAll = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        const docRef = doc(db, 'users', userId, 'notifications', n.id);
        batch.delete(docRef);
      });
      await batch.commit();
    } catch (error) {
      console.error("Error clearing all notifications:", error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_approved':
        return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'task_rejected':
        return <XCircle className="text-rose-500" size={20} />;
      default:
        return <Bell className="text-indigo-500" size={20} />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`fixed inset-0 backdrop-blur-sm z-[100] ${isDarkMode ? 'bg-black/60' : 'bg-slate-900/40'}`}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 bottom-0 w-full max-w-md shadow-2xl z-[101] flex flex-col ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}
          >
            <div className={`p-6 border-b flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Bell size={20} />
                </div>
                <div>
                  <h2 className={`font-bold ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Notificaciones</h2>
                  <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    {notifications.filter(n => !n.read).length} sin leer
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-indigo-400 hover:bg-white/5' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    title="Marcar todo como leído"
                  >
                    <Check size={20} />
                  </button>
                )}
                <button
                  onClick={onClose}
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center space-y-4 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                  <div className={`p-6 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <Bell size={48} className="opacity-20" />
                  </div>
                  <p className="font-medium">No tienes notificaciones</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <motion.div
                    key={notification.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-2xl border transition-all relative group ${
                      notification.read 
                        ? (isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-100') 
                        : (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 shadow-sm' : 'bg-indigo-50/30 border-indigo-100 shadow-sm')
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="mt-1">
                        {getIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <h3 className={`text-sm font-bold truncate ${
                            notification.read 
                              ? (isDarkMode ? 'text-gray-400' : 'text-slate-700') 
                              : (isDarkMode ? 'text-white' : 'text-indigo-900')
                          }`}>
                            {notification.title}
                          </h3>
                          <span className={`text-[10px] font-medium flex items-center gap-1 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                            <Clock size={10} />
                            {format(new Date(notification.createdAt), 'HH:mm', { locale: es })}
                          </span>
                        </div>
                        <p className={`text-xs leading-relaxed ${
                          notification.read 
                            ? (isDarkMode ? 'text-gray-500' : 'text-slate-500') 
                            : (isDarkMode ? 'text-gray-300' : 'text-indigo-700/70')
                        }`}>
                          {notification.message}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                            {format(new Date(notification.createdAt), "d 'de' MMMM", { locale: es })}
                          </span>
                          <div className="flex items-center gap-3">
                            {notification.projectId && (
                              <button
                                onClick={() => {
                                  onNavigate(notification.projectId!, notification.taskId);
                                  markAsRead(notification.id);
                                  onClose();
                                }}
                                className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${
                                  isDarkMode ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-indigo-50 text-indigo-600 hover:text-indigo-700'
                                }`}
                              >
                                Ver Tarea
                              </button>
                            )}
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.read && (
                                <button
                                  onClick={() => markAsRead(notification.id)}
                                  className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}
                                >
                                  Marcar leída
                                </button>
                              )}
                              <button
                                onClick={() => deleteNotification(notification.id)}
                                className={`p-1 rounded-md transition-colors ${isDarkMode ? 'text-gray-600 hover:text-rose-400' : 'text-slate-300 hover:text-rose-500'}`}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className={`p-4 border-t ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                <button
                  onClick={clearAll}
                  className={`w-full py-3 text-xs font-bold transition-colors uppercase tracking-widest ${isDarkMode ? 'text-gray-500 hover:text-rose-400' : 'text-slate-500 hover:text-rose-600'}`}
                >
                  Limpiar todas las notificaciones
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default NotificationPanel;
