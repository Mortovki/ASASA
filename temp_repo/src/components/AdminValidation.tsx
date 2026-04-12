import * as React from 'react';
import { Check, X, Clock, CheckCircle2, XCircle, Send } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../firebase';
import toast from 'react-hot-toast';

const VALIDATION_STATUS = {
  'pendiente': { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  'aprobado': { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  'rechazado': { label: 'Rechazado', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
};

export const AdminValidation = ({ students, setStudents, categories, projects }: any) => {
  const [rejectingRecord, setRejectingRecord] = React.useState<any>(null);
  const [rejectReason, setRejectReason] = React.useState('');

  const handleApproveRecord = async (studentId: string, recordId: string) => {
    const updatedStudents = students.map((s: any) => {
      if (s.id === studentId) {
        return {
          ...s,
          records: (s.records || []).map((r: any) => 
            r.id === recordId ? { ...r, validationStatus: 'aprobado' } : r
          )
        };
      }
      return s;
    });

    setStudents(updatedStudents);

    try {
      const studentToUpdate = updatedStudents.find((s: any) => s.id === studentId);
      if (studentToUpdate) {
        const dataToSave = {
          ...studentToUpdate,
          uid: studentId,
          role: studentToUpdate.role || 'user',
          createdAt: studentToUpdate.createdAt || new Date().toISOString()
        };
        await setDoc(doc(db, 'users', studentId), dataToSave, { merge: true });
        toast.success("Registro aprobado");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${studentId}`);
    }
  };

  const handleRejectRecord = async () => {
    if (!rejectingRecord || !rejectReason.trim()) return;

    const { studentId, id: recordId } = rejectingRecord;

    const updatedStudents = students.map((s: any) => {
      if (s.id === studentId) {
        return {
          ...s,
          records: (s.records || []).map((r: any) => 
            r.id === recordId ? { 
              ...r, 
              validationStatus: 'rechazado',
              rejectReason: rejectReason,
              acknowledgedRejection: false
            } : r
          )
        };
      }
      return s;
    });

    setStudents(updatedStudents);

    try {
      const studentToUpdate = updatedStudents.find((s: any) => s.id === studentId);
      if (studentToUpdate) {
        const dataToSave = {
          ...studentToUpdate,
          uid: studentId,
          role: studentToUpdate.role || 'user',
          createdAt: studentToUpdate.createdAt || new Date().toISOString()
        };
        await setDoc(doc(db, 'users', studentId), dataToSave, { merge: true });
        
        // Simulate sending email
        if (studentToUpdate.email) {
          const subject = encodeURIComponent("Registro de horas rechazado");
          const body = encodeURIComponent(`Hola ${studentToUpdate.name},\n\nTu registro de horas ha sido rechazado por el siguiente motivo:\n\n${rejectReason}\n\nPor favor revisa tu panel para más detalles.`);
          window.open(`mailto:${studentToUpdate.email}?subject=${subject}&body=${body}`, '_blank');
        }

        toast.success("Registro rechazado y notificación enviada");
        setRejectingRecord(null);
        setRejectReason('');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${studentId}`);
    }
  };

  const pendingRecords = React.useMemo(() => {
    const records: any[] = [];
    students.forEach((s: any) => {
      if (s.email === 'mortovki@gmail.com') return;
      (s.records || []).forEach((r: any) => {
        if (r.validationStatus === 'pendiente') {
          records.push({ ...r, studentId: s.id, studentName: s.name, studentEmail: s.email });
        }
      });
    });
    return records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [students]);

  return (
    <div className="space-y-8">
      <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Validación de Horas</h2>
      <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
        {pendingRecords.length === 0 ? (
          <p className="text-center py-10 text-slate-400 font-black uppercase tracking-widest">No hay registros pendientes de validación</p>
        ) : (
          <div className="space-y-4">
            {pendingRecords.map((r: any) => {
              const cat = categories.find((c: any) => c.id === r.categoryId);
              const proj = projects.find((p: any) => p.id === r.projectId);
              return (
                <div key={`${r.studentId}-${r.id}`} className="p-6 border border-slate-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50 transition-all">
                  <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto">
                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 shrink-0">
                      {r.studentName.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900">{r.studentName}</p>
                      <p className="text-xs text-slate-500">{r.date} • {Number(r.hours.toFixed(2))}h • {cat?.name || 'Otra'} • {proj?.name || 'General'}</p>
                      <p className="text-sm text-slate-600 mt-1 break-words line-clamp-2">"{r.description}"</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleApproveRecord(r.studentId, r.id)} className="p-3 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-600 hover:text-white transition-all">
                      <Check size={20} />
                    </button>
                    <button onClick={() => setRejectingRecord(r)} className="p-3 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all">
                      <X size={20} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {rejectingRecord && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">Rechazar Registro</h3>
              <button onClick={() => { setRejectingRecord(null); setRejectReason(''); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-sm font-bold text-slate-700">{rejectingRecord.studentName}</p>
                <p className="text-xs text-slate-500 mt-1">{rejectingRecord.date} • {Number(rejectingRecord.hours.toFixed(2))}h</p>
                <p className="text-xs text-slate-600 mt-2 italic">"{rejectingRecord.description}"</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motivo del Rechazo (Se enviará por correo)</label>
                <textarea 
                  className="w-full p-4 border border-slate-200 rounded-2xl bg-slate-50 font-bold outline-none focus:bg-white focus:border-rose-300 transition-all text-sm shadow-inner resize-none h-32"
                  placeholder="Explica por qué se rechazan estas horas..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                ></textarea>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => { setRejectingRecord(null); setRejectReason(''); }}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleRejectRecord}
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
