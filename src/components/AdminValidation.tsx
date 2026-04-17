import * as React from 'react';
import { Check, X, Clock, CheckCircle2, XCircle, Send, MessageSquare, ShieldAlert, CheckSquare, Square } from 'lucide-react';
import { doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';
import { showSuccessToast, showErrorToast, showLoadingToast } from '../utils/toastUtils';
import toast from 'react-hot-toast';

const VALIDATION_STATUS = {
  'pendiente': { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  'aprobado': { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  'rechazado': { label: 'Rechazado', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
  'disputado': { label: 'Disputado', color: 'bg-indigo-100 text-indigo-700 border-indigo-200', icon: MessageSquare },
};

const SUPER_ADMIN_EMAILS = ["luisedgar.gutierrez17@gmail.com", "luisedgar.gutierrez1@gmail.com"];

export const AdminValidation = ({ students, setStudents, categories, projects, isDarkMode }: any) => {
  const [activeTab, setActiveTab] = React.useState<'pending' | 'disputed'>('pending');
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [rejectingRecords, setRejectingRecords] = React.useState<any[]>([]);
  const [rejectReason, setRejectReason] = React.useState('');

  const toggleSelect = (studentId: string, recordId: string) => {
    const id = `${studentId}|${recordId}`;
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAll = (records: any[]) => {
    if (selectedIds.length === records.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(records.map(r => `${r.studentId}|${r.id}`));
    }
  };

  const handleApproveRecords = async (recordsToApprove: { studentId: string, recordId: string }[]) => {
    const loadingToast = showLoadingToast(recordsToApprove.length === 1 ? "Aprobando registro..." : `Aprobando ${recordsToApprove.length} registros...`);
    try {
      const batch = writeBatch(db);
      recordsToApprove.forEach(r => {
        const sessionRef = doc(db, 'sesiones', r.recordId);
        batch.update(sessionRef, {
          estado: 'aprobado',
          updatedBy: auth.currentUser?.uid
        });
      });
      
      await batch.commit();
      toast.dismiss(loadingToast);
      showSuccessToast(recordsToApprove.length === 1 ? "Registro aprobado" : `${recordsToApprove.length} registros aprobados`);
      setSelectedIds([]);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error approving sessions:", error);
      handleFirestoreError(error, OperationType.UPDATE, `bulk-validation`);
    }
  };

  const handleRejectRecords = async () => {
    if (rejectingRecords.length === 0 || !rejectReason.trim()) return;

    const loadingToast = showLoadingToast(rejectingRecords.length === 1 ? "Rechazando registro..." : `Rechazando ${rejectingRecords.length} registros...`);
    try {
      const batch = writeBatch(db);
      rejectingRecords.forEach(r => {
        const sessionRef = doc(db, 'sesiones', r.id);
        batch.update(sessionRef, {
          estado: 'rechazado',
          rejectReason: rejectReason,
          acknowledgedRejection: false,
          updatedBy: auth.currentUser?.uid
        });
      });

      await batch.commit();

      // Group notifications by student
      const studentsToNotify: any[] = [];
      rejectingRecords.forEach(r => {
        let student = studentsToNotify.find(s => s.id === r.studentId);
        if (!student) {
          student = { id: r.studentId, email: r.studentEmail, name: r.studentName, records: [] };
          studentsToNotify.push(student);
        }
        student.records.push(r);
      });

      studentsToNotify.forEach(student => {
        if (student.email) {
          const subject = encodeURIComponent("Registro de horas rechazado");
          const recordsList = student.records.map((r: any) => `- ${r.date}: ${r.hours}h ("${r.description}")`).join('\n');
          const body = encodeURIComponent(`Hola ${student.name},\n\nLos siguientes registros de horas han sido rechazados por el siguiente motivo:\n\n${rejectReason}\n\nRegistros afectados:\n${recordsList}\n\nPor favor revisa tu panel para más detalles.`);
          window.open(`mailto:${student.email}?subject=${subject}&body=${body}`, '_blank');
        }
      });

      toast.dismiss(loadingToast);
      showSuccessToast(rejectingRecords.length === 1 ? "Registro rechazado" : `${rejectingRecords.length} registros rechazados`);
      setRejectingRecords([]);
      setRejectReason('');
      setSelectedIds([]);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error rejecting sessions:", error);
      handleFirestoreError(error, OperationType.UPDATE, `bulk-rejection`);
    }
  };

  const pendingRecords = React.useMemo(() => {
    const records: any[] = [];
    students.forEach((s: any) => {
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return;
      (s.records || []).forEach((r: any) => {
        if (r.validationStatus === 'pendiente') {
          records.push({ ...r, studentId: s.id, studentName: s.name, studentEmail: s.email });
        }
      });
    });
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [students]);

  const disputedRecords = React.useMemo(() => {
    const records: any[] = [];
    students.forEach((s: any) => {
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return;
      (s.records || []).forEach((r: any) => {
        if (r.validationStatus === 'disputado') {
          records.push({ ...r, studentId: s.id, studentName: s.name, studentEmail: s.email });
        }
      });
    });
    return records.sort((a, b) => new Date(b.disputeDate || b.date).getTime() - new Date(a.disputeDate || a.date).getTime());
  }, [students]);

  const currentRecords = activeTab === 'pending' ? pendingRecords : disputedRecords;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className={`text-3xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Validación de Horas</h2>
        
        <div className={`flex p-1 rounded-xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-100'}`}>
          <button 
            onClick={() => { setActiveTab('pending'); setSelectedIds([]); }}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'pending' ? (isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-900 shadow-sm') : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pendientes ({pendingRecords.length})
          </button>
          <button 
            onClick={() => { setActiveTab('disputed'); setSelectedIds([]); }}
            className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'disputed' ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30') : 'text-slate-500 hover:text-slate-700'}`}
          >
            Disputas ({disputedRecords.length})
          </button>
        </div>
      </div>

      <div className={`${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} p-6 rounded-[2rem] border shadow-sm`}>
        <div className="flex justify-between items-center mb-6 px-2">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => selectAll(currentRecords)}
              className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'}`}
            >
              {selectedIds.length === currentRecords.length && currentRecords.length > 0 ? <CheckSquare size={18} className="text-indigo-500" /> : <Square size={18} />}
              {selectedIds.length === currentRecords.length && currentRecords.length > 0 ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            {selectedIds.length > 0 && (
              <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                {selectedIds.length} seleccionados
              </span>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  const toApprove = selectedIds.map(id => {
                    const [studentId, recordId] = id.split('|');
                    return { studentId, recordId };
                  });
                  handleApproveRecords(toApprove);
                }}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2"
              >
                <Check size={14} /> Aprobar
              </button>
              <button 
                onClick={() => {
                  const toReject = selectedIds.map(id => {
                    const [studentId, recordId] = id.split('|');
                    return currentRecords.find(r => r.studentId === studentId && r.id === recordId);
                  }).filter(Boolean);
                  setRejectingRecords(toReject);
                }}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg shadow-rose-600/20 flex items-center gap-2"
              >
                <X size={14} /> Rechazar
              </button>
            </div>
          )}
        </div>

        {currentRecords.length === 0 ? (
          <div className="text-center py-20">
            <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${isDarkMode ? 'bg-white/5 text-gray-600' : 'bg-slate-50 text-slate-300'}`}>
              {activeTab === 'pending' ? <Clock size={32} /> : <ShieldAlert size={32} />}
            </div>
            <p className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
              {activeTab === 'pending' ? 'No hay registros pendientes' : 'No hay disputas activas'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {currentRecords.map((r: any) => {
              const cat = categories.find((c: any) => c.id === r.categoryId);
              const proj = projects.find((p: any) => p.id === r.projectId);
              const isSelected = selectedIds.includes(`${r.studentId}|${r.id}`);
              
              return (
                <div 
                  key={`${r.studentId}-${r.id}`} 
                  onClick={() => toggleSelect(r.studentId, r.id)}
                  className={`p-6 border rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all cursor-pointer group ${
                    isSelected 
                      ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/50' : 'bg-indigo-50 border-indigo-200') 
                      : (isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-100 hover:bg-slate-50')
                  }`}
                >
                  <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                    <div className={`w-6 h-6 rounded border flex items-center justify-center transition-all ${
                      isSelected 
                        ? 'bg-indigo-600 border-indigo-600 text-white' 
                        : (isDarkMode ? 'border-white/20 bg-white/5' : 'border-slate-300 bg-white')
                    }`}>
                      {isSelected && <Check size={14} />}
                    </div>
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black shrink-0 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                      {r.studentName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className={`font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{r.studentName}</p>
                        {r.validationStatus === 'disputado' && (
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-600 text-[8px] font-black uppercase rounded-full">Disputa</span>
                        )}
                      </div>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{r.date} • {Number(r.hours.toFixed(2))}h • {cat?.name || 'Otra'} • {proj?.name || 'General'}</p>
                      <p className={`text-sm mt-1 break-words line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>"{r.description}"</p>
                      {r.validationStatus === 'disputado' && r.disputeReason && (
                        <div className={`mt-3 p-3 rounded-xl border text-xs italic ${isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                          <p className="font-black uppercase text-[8px] mb-1 not-italic tracking-widest">Justificación de Disputa:</p>
                          "{r.disputeReason}"
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 self-end sm:self-center" onClick={e => e.stopPropagation()}>
                    <button 
                      onClick={() => handleApproveRecords([{ studentId: r.studentId, recordId: r.id }])} 
                      className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                      title="Aprobar"
                    >
                      <Check size={20} />
                    </button>
                    <button 
                      onClick={() => setRejectingRecords([r])} 
                      className={`p-3 rounded-xl transition-all ${isDarkMode ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white' : 'bg-rose-100 text-rose-600 hover:bg-rose-600 hover:text-white'}`}
                      title="Rechazar"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectingRecords.length > 0 && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`${isDarkMode ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'} rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200`}>
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                {rejectingRecords.length === 1 ? 'Rechazar Registro' : `Rechazar ${rejectingRecords.length} Registros`}
              </h3>
              <button onClick={() => { setRejectingRecords([]); setRejectReason(''); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className={`p-4 rounded-2xl border max-h-40 overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                {rejectingRecords.map((rec, idx) => (
                  <div key={idx} className={`${idx !== 0 ? 'mt-3 pt-3 border-t border-slate-200 dark:border-white/5' : ''}`}>
                    <p className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{rec.studentName}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">{rec.date} • {Number(rec.hours.toFixed(2))}h</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Motivo del Rechazo (Se enviará por correo)</label>
                <textarea 
                  className={`w-full p-4 border rounded-2xl font-bold outline-none transition-all text-sm shadow-inner resize-none h-32 ${
                    isDarkMode 
                      ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-rose-500/50' 
                      : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-rose-300'
                  }`}
                  placeholder="Explica por qué se rechazan estas horas..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setRejectingRecords([]); setRejectReason(''); }}
                  className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all ${isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRejectRecords}
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Enviar y Rechazar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
