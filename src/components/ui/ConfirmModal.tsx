import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  isDarkMode?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  isDarkMode = false
}) => {
  const colors = {
    danger: {
      bg: 'bg-red-500',
      text: 'text-red-600',
      hover: 'hover:bg-red-700',
      border: isDarkMode ? 'border-red-900/50' : 'border-red-100',
      shadow: 'shadow-red-500/30'
    },
    warning: {
      bg: 'bg-amber-500',
      text: 'text-amber-600',
      hover: 'hover:bg-amber-700',
      border: isDarkMode ? 'border-amber-900/50' : 'border-amber-100',
      shadow: 'shadow-amber-500/30'
    },
    info: {
      bg: 'bg-indigo-600',
      text: 'text-indigo-600',
      hover: 'hover:bg-indigo-700',
      border: isDarkMode ? 'border-indigo-900/50' : 'border-indigo-100',
      shadow: 'shadow-indigo-500/30'
    }
  };

  const color = colors[type];

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className={`absolute inset-0 backdrop-blur-sm ${isDarkMode ? 'bg-black/80' : 'bg-slate-900/60'}`}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className={`relative w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-100'}`}
          >
            <div className="p-8 sm:p-10">
              <div className="flex justify-between items-start mb-6">
                <div className={`${color.bg} p-4 rounded-2xl shadow-lg ${color.shadow}`}>
                  <AlertCircle size={32} className="text-white" />
                </div>
                <button 
                  onClick={onClose}
                  className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3 mb-8">
                <h3 className={`text-2xl font-black tracking-tight leading-none uppercase ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {title}
                </h3>
                <p className={`font-bold text-sm uppercase tracking-widest leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  {message}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={onClose}
                  className={`flex-1 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-95 ${isDarkMode ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {cancelText}
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className={`flex-1 px-6 py-4 ${color.bg} text-white rounded-2xl font-black text-xs uppercase tracking-widest ${color.hover} transition-all active:scale-95 shadow-lg ${color.shadow}`}
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
