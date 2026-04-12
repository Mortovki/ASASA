import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  isDarkMode?: boolean;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children, isDarkMode }) => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Prevent background scrolling when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 z-40 backdrop-blur-sm sm:hidden"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 sm:hidden flex flex-col max-h-[90vh] shadow-2xl border-t transition-colors ${
              isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing" onClick={onClose}>
              <div className={`w-12 h-1.5 rounded-full ${isDarkMode ? 'bg-white/20' : 'bg-slate-300'}`} />
            </div>
            <div className={`flex items-center justify-between px-6 py-4 border-b ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
              <h3 className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{title}</h3>
              <button onClick={onClose} className={`p-2 rounded-full transition-colors ${
                isDarkMode ? 'bg-white/10 text-gray-400 hover:bg-white/20 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
