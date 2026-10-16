import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  CheckSquare, 
  X, 
  Trash2, 
  UserCheck, 
  CheckCircle2, 
  Star, 
  ChevronDown, 
  AlertCircle 
} from 'lucide-react';
import { KANBAN_COLUMNS } from '../config/kanbanColumns';
import { formatName } from '../utils/formatters';

interface BulkActionsDockProps {
  selectedCount: number;
  onClearSelection: () => void;
  onUpdateStatus: (newStatus: string) => Promise<void>;
  onUpdateAssignee: (assigneeId: string) => Promise<void>;
  onUpdatePriority: (priority: number) => Promise<void>;
  onBulkDelete: () => void;
  students: any[];
  isDarkMode?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export const BulkActionsDock: React.FC<BulkActionsDockProps> = ({
  selectedCount,
  onClearSelection,
  onUpdateStatus,
  onUpdateAssignee,
  onUpdatePriority,
  onBulkDelete,
  students,
  isDarkMode = false,
  canEdit = true,
  canDelete = true,
}) => {
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [assigneeMenuOpen, setAssigneeMenuOpen] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 80, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 80, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] sm:max-w-2xl w-full px-4"
      >
        <div
          className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-2xl border backdrop-blur-xl transition-all ${
            isDarkMode
              ? 'bg-[#181f30]/95 border-slate-700/80 text-white shadow-black/50'
              : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-300/50'
          }`}
        >
          {/* Selected Counter & Clear */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/15 text-indigo-400 font-bold text-xs tracking-tight">
              <CheckSquare size={14} className="text-indigo-500" />
              <span className="tabular-nums font-black">{selectedCount}</span>
              <span className="hidden sm:inline">seleccionadas</span>
            </div>
            <button
              onClick={onClearSelection}
              className={`p-1.5 rounded-lg transition-colors text-xs font-semibold flex items-center gap-1 ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Deseleccionar todo"
            >
              <X size={14} />
              <span className="hidden md:inline">Limpiar</span>
            </button>
          </div>

          {/* Action Triggers */}
          <div className="flex items-center gap-2 flex-wrap relative">
            {/* Status Dropdown */}
            {canEdit && (
              <div className="relative">
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setStatusMenuOpen(!statusMenuOpen);
                    setAssigneeMenuOpen(false);
                    setPriorityMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <CheckCircle2 size={13} className="text-indigo-500" />
                  <span>Estado</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>

                {statusMenuOpen && (
                  <div
                    className={`absolute bottom-full mb-2 left-0 w-44 rounded-xl border p-1 shadow-xl z-50 transition-all ${
                      isDarkMode ? 'bg-[#1b2234] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-black tracking-wider px-2 py-1 opacity-50">
                      Cambiar estado
                    </div>
                    {KANBAN_COLUMNS.filter(c => !c.hideFromBoard).map(col => (
                      <button
                        key={col.id}
                        disabled={isProcessing}
                        onClick={async () => {
                          setIsProcessing(true);
                          setStatusMenuOpen(false);
                          await onUpdateStatus(col.id);
                          setIsProcessing(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-colors ${
                          isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${col.color}`} />
                        {col.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assignee Dropdown */}
            {canEdit && (
              <div className="relative">
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setAssigneeMenuOpen(!assigneeMenuOpen);
                    setStatusMenuOpen(false);
                    setPriorityMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <UserCheck size={13} className="text-emerald-500" />
                  <span>Asignar</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>

                {assigneeMenuOpen && (
                  <div
                    className={`absolute bottom-full mb-2 left-0 w-52 max-h-60 overflow-y-auto rounded-xl border p-1 shadow-xl z-50 transition-all ${
                      isDarkMode ? 'bg-[#1b2234] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-black tracking-wider px-2 py-1 opacity-50">
                      Asignar a
                    </div>
                    <button
                      disabled={isProcessing}
                      onClick={async () => {
                        setIsProcessing(true);
                        setAssigneeMenuOpen(false);
                        await onUpdateAssignee('');
                        setIsProcessing(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors italic ${
                        isDarkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                      }`}
                    >
                      Sin asignar
                    </button>
                    {students.map((s: any) => (
                      <button
                        key={s.id}
                        disabled={isProcessing}
                        onClick={async () => {
                          setIsProcessing(true);
                          setAssigneeMenuOpen(false);
                          await onUpdateAssignee(s.id);
                          setIsProcessing(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold truncate transition-colors ${
                          isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                        }`}
                      >
                        {formatName(s.firstName, s.lastNamePaterno)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Priority Dropdown */}
            {canEdit && (
              <div className="relative">
                <button
                  disabled={isProcessing}
                  onClick={() => {
                    setPriorityMenuOpen(!priorityMenuOpen);
                    setStatusMenuOpen(false);
                    setAssigneeMenuOpen(false);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-200'
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                  }`}
                >
                  <Star size={13} className="text-amber-400" />
                  <span>Prioridad</span>
                  <ChevronDown size={12} className="opacity-60" />
                </button>

                {priorityMenuOpen && (
                  <div
                    className={`absolute bottom-full mb-2 right-0 w-36 rounded-xl border p-1 shadow-xl z-50 transition-all ${
                      isDarkMode ? 'bg-[#1b2234] border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <div className="text-[10px] uppercase font-black tracking-wider px-2 py-1 opacity-50">
                      Establecer
                    </div>
                    {[5, 4, 3, 2, 1].map(p => (
                      <button
                        key={p}
                        disabled={isProcessing}
                        onClick={async () => {
                          setIsProcessing(true);
                          setPriorityMenuOpen(false);
                          await onUpdatePriority(p);
                          setIsProcessing(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-between transition-colors ${
                          isDarkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex gap-0.5">
                          {Array.from({ length: p }).map((_, i) => (
                            <Star key={i} size={11} className="text-amber-400 fill-amber-400" />
                          ))}
                        </div>
                        <span className="text-[10px] font-black tabular-nums opacity-60">P{p}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bulk Delete */}
            {canDelete && (
              <button
                disabled={isProcessing}
                onClick={onBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20"
                title="Eliminar tareas seleccionadas"
              >
                <Trash2 size={13} />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default BulkActionsDock;
