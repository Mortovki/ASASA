import toast from 'react-hot-toast';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import React from 'react';

export const showSuccessToast = (message: React.ReactNode) => {
  const isDark = document.documentElement.classList.contains('dark');
  toast.custom((t) => createPortal(
    <div className={`fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none p-4 transition-all duration-500 ease-out ${t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className={`max-w-md w-full ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'} backdrop-blur-xl border-2 shadow-2xl rounded-[2rem] pointer-events-auto flex flex-col items-center p-8 gap-6 text-center`}>
        <div className="bg-emerald-500 p-4 rounded-full shadow-lg shadow-emerald-500/30">
          <CheckCircle2 size={32} className="text-white" />
        </div>
        <div className="space-y-2">
          <p className={`font-black text-xs uppercase tracking-[0.2em] ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>¡Éxito!</p>
          <div className={`font-bold text-sm leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'} whitespace-pre-wrap`}>{message}</div>
        </div>
        <button 
          onClick={() => toast.dismiss(t.id)} 
          className={`px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-black'}`}
        >
          Entendido
        </button>
      </div>
    </div>,
    document.body
  ), { duration: 5000 });
};

export const showErrorToast = (message: string, onRetry?: () => void) => {
  const isDark = document.documentElement.classList.contains('dark');
  toast.custom((t) => createPortal(
    <div className={`fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none p-4 transition-all duration-500 ease-out ${t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className={`max-w-md w-full ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'} backdrop-blur-xl border-2 shadow-2xl rounded-[2rem] pointer-events-auto flex flex-col items-center p-8 gap-6 text-center`}>
        <div className="bg-rose-500 p-4 rounded-full shadow-lg shadow-rose-500/30">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="space-y-2">
          <p className={`font-black text-xs uppercase tracking-[0.2em] ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>Error</p>
          <p className={`font-bold text-xs uppercase tracking-widest leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>{message}</p>
        </div>
        <div className="flex gap-3 w-full">
          {onRetry && (
            <button 
              onClick={() => { toast.dismiss(t.id); onRetry(); }} 
              className="flex-1 px-6 py-3 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-rose-700 transition-all active:scale-95 shadow-lg"
            >
              Reintentar
            </button>
          )}
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className={`${onRetry ? 'flex-1' : 'w-full'} px-6 py-3 bg-slate-900 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all active:scale-95 shadow-lg`}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  ), { duration: 5000 });
};

export const showLoadingToast = (message: string) => {
  const isDark = document.documentElement.classList.contains('dark');
  return toast.custom((t) => createPortal(
    <div className={`fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none p-4 transition-all duration-500 ease-out ${t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className={`max-w-md w-full ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'} backdrop-blur-xl border-2 shadow-2xl rounded-[2rem] pointer-events-auto flex flex-col items-center p-8 gap-6 text-center`}>
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock size={24} className="text-indigo-500" />
          </div>
        </div>
        <div className="space-y-2">
          <p className={`font-black text-xs uppercase tracking-[0.2em] ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>Procesando</p>
          <p className={`font-bold text-xs uppercase tracking-widest leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>{message}</p>
        </div>
      </div>
    </div>,
    document.body
  ), { duration: Infinity });
};

export const showConfirmToast = (message: string, onConfirm: () => void) => {
  const isDark = document.documentElement.classList.contains('dark');
  toast.custom((t) => createPortal(
    <div className={`fixed inset-0 flex items-center justify-center z-[99999] pointer-events-none p-4 transition-all duration-500 ease-out ${t.visible ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
      <div className={`max-w-md w-full ${isDark ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'} backdrop-blur-xl border-2 shadow-2xl rounded-[2rem] pointer-events-auto flex flex-col items-center p-8 gap-6 text-center`}>
        <div className="bg-amber-500 p-4 rounded-full shadow-lg shadow-amber-500/30">
          <AlertCircle size={32} className="text-white" />
        </div>
        <div className="space-y-2">
          <p className={`font-black text-xs uppercase tracking-[0.2em] ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Confirmar</p>
          <p className={`font-bold text-xs uppercase tracking-widest leading-relaxed ${isDark ? 'text-white' : 'text-slate-900'}`}>{message}</p>
        </div>
        <div className="flex gap-3 w-full">
          <button 
            onClick={() => toast.dismiss(t.id)} 
            className={`flex-1 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm ${isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Cancelar
          </button>
          <button 
            onClick={() => { toast.dismiss(t.id); onConfirm(); }} 
            className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95 shadow-lg"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>,
    document.body
  ), { duration: Infinity });
};
