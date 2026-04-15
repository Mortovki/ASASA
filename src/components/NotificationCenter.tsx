import React, { useState, useMemo } from 'react';
import { Bell, X, Check, Trash2, Clock, CheckCircle2, XCircle, MoreVertical, MessageSquare, RefreshCw, AlertTriangle, GitBranch, Timer, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { useBreakpoint } from '../hooks/useBreakpoint';
import toast from 'react-hot-toast';
import { Notification } from '../types/notification';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  userId: string;
  onNavigate: (projectId: string, taskId?: string) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  isDarkMode?: boolean;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ 
  isOpen, 
  onClose, 
  notifications, 
  userId, 
  onNavigate,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearAll,
  isDarkMode
}) => {
  const { isMobile } = useBreakpoint();
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : filter === 'unread'
      ? notifications.filter(n => !n.read)
      : notifications.filter(n => n.read);

  const grouped = useMemo(() => {
    const groups: Record<string, Notification[]> = {
      'Hoy': [],
      'Ayer': [],
      'Anteriores': []
    };

    filteredNotifications.forEach(n => {
      const date = new Date(n.createdAt);
      if (isToday(date)) groups['Hoy'].push(n);
      else if (isYesterday(date)) groups['Ayer'].push(n);
      else groups['Anteriores'].push(n);
    });

    // Sort each group so unread notifications appear first
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        if (a.read === b.read) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
        return a.read ? 1 : -1;
      });
    });

    return groups;
  }, [filteredNotifications]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'task_approved':
        return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'task_rejected':
        return <XCircle className="text-rose-500" size={20} />;
      case 'approval_pending':
        return <Clock className="text-amber-500" size={20} />;
      case 'task_status_changed':
        return <RefreshCw className="text-blue-500" size={20} />;
      case 'task_stuck':
        return <AlertTriangle className="text-red-500" size={20} />;
      case 'note_added':
        return <MessageSquare className={isDarkMode ? 'text-gray-400' : 'text-slate-500'} size={20} />;
      case 'critical_path_updated':
        return <GitBranch className="text-purple-500" size={20} />;
      case 'task_near_deadline':
        return <Timer className="text-orange-500" size={20} />;
      case 'task_overdue':
        return <AlertCircle className="text-red-600" size={20} />;
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
            className={`fixed inset-0 backdrop-blur-sm z-[150] ${isDarkMode ? 'bg-black/60' : 'bg-slate-900/40'}`}
          />

          {/* Panel */}
          <motion.div
            initial={isMobile ? { y: '100%' } : { x: '100%' }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: '100%' } : { x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 bottom-0 shadow-2xl z-[151] flex flex-col ${
              isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'
            } ${
              isMobile 
                ? 'left-0 top-0 w-full' 
                : 'top-0 w-full max-w-md'
            }`}
          >
            {/* Header */}
            <div className={`p-5 border-b flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                  <Bell size={18} />
                </div>
                <div>
                  <h2 className={`font-bold text-sm ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Notificaciones</h2>
                  <p className={`text-[10px] font-medium ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    {notifications.filter(n => !n.read).length} sin leer
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className={`p-2 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Tabs & Actions */}
            <div className={`px-4 py-3 border-b flex flex-col gap-3 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <div className={`p-1 rounded-xl flex items-center justify-between ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
                <div className="flex items-center">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      filter === 'all' 
                        ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm') 
                        : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    onClick={() => setFilter('unread')}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      filter === 'unread' 
                        ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm') 
                        : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')
                    }`}
                  >
                    Sin leer
                  </button>
                  <button
                    onClick={() => setFilter('read')}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                      filter === 'read' 
                        ? (isDarkMode ? 'bg-white/10 text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm') 
                        : (isDarkMode ? 'text-gray-500 hover:text-gray-300' : 'text-slate-500 hover:text-slate-700')
                    }`}
                  >
                    Leídas
                  </button>
                </div>
              </div>
              
              {notifications.some(n => !n.read) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    markAllAsRead().then(() => toast.success('Todas las notificaciones marcadas como leídas'));
                  }}
                  className={`text-[10px] font-black uppercase tracking-widest px-3 py-2 rounded-lg transition-all border shadow-sm flex items-center justify-center gap-2 active:scale-95 w-full ${
                    isDarkMode 
                      ? 'text-indigo-400 border-indigo-500/20 hover:bg-indigo-500/10' 
                      : 'text-indigo-600 border-indigo-100 hover:text-white hover:bg-indigo-600'
                  }`}
                >
                  <Check size={12} />
                  Marcar todo leído
                </button>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {filteredNotifications.length === 0 ? (
                <div className={`h-full flex flex-col items-center justify-center space-y-4 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                  <div className={`p-6 rounded-full ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                    <Bell size={48} className="opacity-20" />
                  </div>
                  <p className="font-medium text-sm">
                    {filter === 'unread' ? 'No tienes notificaciones sin leer' : filter === 'read' ? 'No tienes notificaciones leídas' : 'No tienes notificaciones'}
                  </p>
                </div>
              ) : (
                Object.entries(grouped).map(([group, items]) => (
                  items.length > 0 && (
                    <div key={group} className="space-y-3">
                      <h3 className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>{group}</h3>
                      <div className="space-y-3">
                        {items.map((notification) => (
                          <motion.div
                            key={notification.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-4 rounded-2xl border transition-all relative group ${
                              notification.read 
                                ? (isDarkMode ? 'bg-white/5 border-white/5 opacity-50 grayscale shadow-none' : 'bg-white border-slate-100 opacity-60 grayscale-[0.8] shadow-sm') 
                                : (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 shadow-md' : 'bg-white border-indigo-100 shadow-md shadow-indigo-500/5')
                            }`}
                          >
                            <div className="flex gap-4">
                              <div className="mt-1 flex-shrink-0">
                                {getIcon(notification.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <h3 className={`text-sm font-bold truncate ${
                                    notification.read 
                                      ? (isDarkMode ? 'text-gray-400' : 'text-slate-700') 
                                      : (isDarkMode ? 'text-white' : 'text-indigo-950')
                                  }`}>
                                    {notification.title}
                                  </h3>
                                  <span className={`text-[10px] font-medium flex items-center gap-1 flex-shrink-0 ml-2 ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                                    <Clock size={10} />
                                    {format(new Date(notification.createdAt), 'HH:mm', { locale: es })}
                                  </span>
                                </div>
                                <p className={`text-xs leading-relaxed ${
                                  notification.read 
                                    ? (isDarkMode ? 'text-gray-500' : 'text-slate-500') 
                                    : (isDarkMode ? 'text-gray-300' : 'text-slate-600')
                                }`}>
                                  {notification.message}
                                </p>
                                <div className="mt-3 flex items-center justify-between">
                                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-400'}`}>
                                    {notification.projectName}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    {!notification.read && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          markAsRead(notification.id).then(() => toast.success('Notificación leída'));
                                        }}
                                        className={`p-1.5 rounded-lg transition-all ${isDarkMode ? 'text-gray-500 hover:text-indigo-400 hover:bg-white/5' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                        title="Marcar como leída"
                                      >
                                        <Check size={14} />
                                      </button>
                                    )}
                                    {notification.projectId && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onNavigate(notification.projectId!, notification.taskId || undefined);
                                          markAsRead(notification.id).then(() => toast.success('Notificación leída'));
                                          onClose();
                                        }}
                                        className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg ${
                                          isDarkMode ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                        }`}
                                      >
                                        Ver
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const loadingToast = toast.loading('Eliminando notificación...');
                                        deleteNotification(notification.id)
                                          .then(() => {
                                            toast.dismiss(loadingToast);
                                            toast.success('Notificación eliminada');
                                          })
                                          .catch((err) => {
                                            toast.dismiss(loadingToast);
                                            toast.error('Error al eliminar: ' + (err.message || 'Error desconocido'));
                                          });
                                      }}
                                      className={`p-2 rounded-lg transition-all active:scale-90 flex items-center justify-center ${
                                        isDarkMode ? 'text-gray-600 hover:text-rose-400 hover:bg-rose-500/10' : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                                      }`}
                                      title={`Eliminar notificación (${notification.id})`}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className={`p-4 border-t ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50/50 border-slate-100'}`}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll().then(() => toast.success('Todas las notificaciones eliminadas'));
                  }}
                  className={`w-full py-3 text-[10px] font-black transition-colors uppercase tracking-widest rounded-xl border ${isDarkMode ? 'text-gray-500 border-white/5 hover:text-rose-400 hover:border-rose-500/20' : 'text-slate-400 border-slate-200 hover:text-rose-600 hover:border-rose-200'}`}
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
