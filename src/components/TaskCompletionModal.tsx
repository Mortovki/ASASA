import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  Users, 
  User, 
  FileText, 
  Link2, 
  X, 
  Flag, 
  AlertCircle, 
  Calendar,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import toast from 'react-hot-toast';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { doc, collection, writeBatch, updateDoc, setDoc } from 'firebase/firestore';

export interface TaskCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: any | null;
  projectId: string;
  projectName: string;
  activeStudents: any[];
  sessionDate: string;
  isDarkMode: boolean;
  onTaskCompleted: (completedTaskId: string, recordsCreated: any[]) => void;
}

export const TaskCompletionModal: React.FC<TaskCompletionModalProps> = ({
  isOpen,
  onClose,
  task,
  projectId,
  projectName,
  activeStudents,
  sessionDate,
  isDarkMode,
  onTaskCompleted
}) => {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [hoursMode, setHoursMode] = useState<'group' | 'individual'>('group');
  const [groupHours, setGroupHours] = useState<number>(2);
  const [individualHours, setIndividualHours] = useState<Record<string, number>>({});
  const [description, setDescription] = useState<string>('');
  const [evidenceLink, setEvidenceLink] = useState<string>('');
  const [completionDate, setCompletionDate] = useState<string>(sessionDate || new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize form whenever task opens
  useEffect(() => {
    if (!isOpen || !task) return;

    // Detect assigned students on the task
    const assigned: string[] = Array.isArray(task.assignedUsers) && task.assignedUsers.length > 0
      ? task.assignedUsers
      : (task.assignedTo ? [task.assignedTo] : []);

    // Filter to those present in activeStudents if possible, otherwise use assigned
    const initialSelected = assigned.length > 0 
      ? assigned.filter(id => activeStudents.some(s => s.id === id || s.uid === id))
      : (activeStudents.length > 0 ? [activeStudents[0].id] : []);

    const finalSelected = initialSelected.length > 0 ? initialSelected : (activeStudents.slice(0, 1).map(s => s.id));
    setSelectedStudentIds(finalSelected);

    // Initial individual hours
    const initIndiv: Record<string, number> = {};
    activeStudents.forEach(s => {
      initIndiv[s.id] = 2;
    });
    setIndividualHours(initIndiv);
    setGroupHours(2);
    setHoursMode(finalSelected.length > 1 ? 'group' : 'individual');
    setDescription(`Se concluyeron los requerimientos y entregables de la tarea "${task.title}".`);
    setEvidenceLink('');
    setCompletionDate(sessionDate || new Date().toISOString().split('T')[0]);
  }, [isOpen, task, activeStudents, sessionDate]);

  if (!isOpen || !task) return null;

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds(prev => 
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleSelectAll = () => {
    setSelectedStudentIds(activeStudents.map(s => s.id));
  };

  const handleClearAll = () => {
    setSelectedStudentIds([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedStudentIds.length === 0) {
      toast.error('Selecciona al menos a un alumno involucrado en la tarea.');
      return;
    }

    if (!description.trim()) {
      toast.error('Agrega una breve descripción de la tarea finalizada.');
      return;
    }

    // Verify hours > 0
    if (hoursMode === 'group' && (!groupHours || groupHours <= 0)) {
      toast.error('Ingresa un número válido de horas mayor a 0.');
      return;
    }

    if (hoursMode === 'individual') {
      const hasInvalidHours = selectedStudentIds.some(id => !individualHours[id] || individualHours[id] <= 0);
      if (hasInvalidHours) {
        toast.error('Verifica que todos los alumnos seleccionados tengan horas mayores a 0.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const sesionesCol = collection(db, 'sesiones');
      const recordsCreated: any[] = [];
      const nowIso = new Date().toISOString();
      const currentUid = auth.currentUser?.uid || 'admin';

      selectedStudentIds.forEach(studentId => {
        const student = activeStudents.find(s => s.id === studentId);
        const studentName = student ? (student.name || `${student.firstName || ''} ${student.lastNamePaterno || ''}`.trim()) : 'Alumno';
        const assignedHours = hoursMode === 'group' ? Number(groupHours) : Number(individualHours[studentId] || 0);

        const newDocRef = doc(sesionesCol);
        const recordData = {
          id: newDocRef.id,
          userId: studentId,
          studentId: studentId,
          studentName: studentName,
          projectId: task.projectId || projectId,
          projectName: projectName || 'Proyecto General',
          taskId: task.id,
          taskTitle: task.title,
          description: `[Tarea Finalizada: ${task.title}] ${description.trim()}`,
          evidenceLink: evidenceLink.trim(),
          hours: assignedHours,
          horasCalculadas: assignedHours,
          validationStatus: 'aprobado',
          estado: 'aprobado',
          status: 'A',
          sessionType: 'tarea_finalizada',
          isTaskCompletion: true,
          date: completionDate,
          createdAt: nowIso,
          createdBy: currentUid
        };

        batch.set(newDocRef, recordData);
        recordsCreated.push(recordData);
      });

      // Update task in Firestore to status 'done'
      const targetProjectId = task.projectId || projectId;
      if (targetProjectId && task.id) {
        const taskRef = doc(db, `projects/${targetProjectId}/tasks`, task.id);
        batch.set(taskRef, {
          status: 'done',
          completedAt: nowIso,
          completedByStudentIds: selectedStudentIds,
          completionNotes: description.trim(),
          hoursLogged: hoursMode === 'group' ? groupHours : Object.values(individualHours).reduce((a, b) => a + b, 0)
        }, { merge: true });
      }

      await batch.commit();

      confetti({
        particleCount: 75,
        spread: 60,
        origin: { y: 0.6 }
      });

      toast.success(`🎉 Tarea "${task.title}" finalizada y ${recordsCreated.length} registro(s) de horas generados con éxito.`, {
        duration: 5000
      });

      onTaskCompleted(task.id, recordsCreated);
      onClose();
    } catch (error) {
      console.error("Error al reportar tarea finalizada:", error);
      handleFirestoreError(error, OperationType.CREATE, 'sesiones');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCalculatedHours = hoursMode === 'group'
    ? selectedStudentIds.length * Number(groupHours || 0)
    : selectedStudentIds.reduce((sum, id) => sum + Number(individualHours[id] || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-2xl rounded-2xl sm:rounded-3xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        {/* Header */}
        <div className={`p-4 sm:p-6 border-b flex items-start justify-between gap-3 ${
          isDarkMode ? 'border-white/10 bg-white/5' : 'border-slate-100 bg-slate-50/70'
        }`}>
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                <CheckCircle2 size={12} /> Reportar Tarea Finalizada
              </span>
              {task.isMilestone && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-xs">
                  <Flag size={11} className="fill-current" /> HITO
                </span>
              )}
              {projectName && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                  isDarkMode ? 'bg-white/10 text-slate-300' : 'bg-slate-200 text-slate-700'
                }`}>
                  {projectName}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black tracking-tight truncate leading-tight">
              {task.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-xl transition-colors shrink-0 ${
              isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
            }`}
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Alumnos Involucrados */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-400">
                <Users size={14} className="text-indigo-500" /> Alumnos Involucrados ({selectedStudentIds.length}/{activeStudents.length})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] font-bold text-indigo-500 hover:text-indigo-600 transition-colors"
                >
                  Seleccionar Todos
                </button>
                <span className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Limpiar
                </button>
              </div>
            </div>

            <div className={`p-2.5 rounded-xl border max-h-48 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 ${
              isDarkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'
            }`}>
              {activeStudents.length === 0 ? (
                <div className="col-span-2 py-4 text-center text-xs text-slate-400">
                  No hay prestadores activos disponibles en este momento.
                </div>
              ) : (
                activeStudents.map(student => {
                  const isChecked = selectedStudentIds.includes(student.id);
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer select-none transition-all ${
                        isChecked 
                          ? isDarkMode 
                            ? 'bg-indigo-500/20 border-indigo-500/50 text-white' 
                            : 'bg-indigo-50 border-indigo-200 text-indigo-900 shadow-xs'
                          : isDarkMode 
                            ? 'bg-white/5 border-white/5 text-slate-300 hover:border-white/10' 
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleStudent(student.id)}
                        className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="w-6 h-6 rounded-md bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                        {(student.name || 'A').charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate leading-tight">
                          {student.name || `${student.firstName || ''} ${student.lastNamePaterno || ''}`}
                        </p>
                        {student.career && (
                          <p className="text-[10px] text-slate-400 truncate">{student.career}</p>
                        )}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Modo de Asignación de Horas */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-400">
                <Clock size={14} className="text-indigo-500" /> Asignación de Horas
              </label>
              <div className="inline-flex rounded-xl p-0.5 border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-black/30">
                <button
                  type="button"
                  onClick={() => setHoursMode('group')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    hoursMode === 'group'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Grupal (Igual)
                </button>
                <button
                  type="button"
                  onClick={() => setHoursMode('individual')}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    hoursMode === 'individual'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Individual (Distinto)
                </button>
              </div>
            </div>

            {hoursMode === 'group' ? (
              <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                <div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    Horas por cada alumno seleccionado:
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Se acreditarán de forma independiente en el expediente de cada uno.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0.5"
                    step="0.5"
                    max="100"
                    value={groupHours}
                    onChange={e => setGroupHours(Math.max(0.5, parseFloat(e.target.value) || 0))}
                    className={`w-24 px-3 py-2 rounded-xl text-sm font-black text-center border outline-none ${
                      isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                  <span className="text-xs font-bold text-slate-400">hrs/alumno</span>
                </div>
              </div>
            ) : (
              <div className={`p-3 rounded-xl border space-y-2 max-h-48 overflow-y-auto ${
                isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'
              }`}>
                {selectedStudentIds.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">
                    Selecciona alumnos arriba para definir sus horas individuales.
                  </p>
                ) : (
                  selectedStudentIds.map(studentId => {
                    const student = activeStudents.find(s => s.id === studentId);
                    const studentName = student ? (student.name || `${student.firstName || ''} ${student.lastNamePaterno || ''}`) : 'Alumno';
                    return (
                      <div key={studentId} className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-black/5 dark:bg-white/5">
                        <span className="text-xs font-bold truncate">{studentName}</span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            max="100"
                            value={individualHours[studentId] ?? 2}
                            onChange={e => {
                              const val = Math.max(0.5, parseFloat(e.target.value) || 0);
                              setIndividualHours(prev => ({ ...prev, [studentId]: val }));
                            }}
                            className={`w-20 px-2 py-1 rounded-lg text-xs font-bold text-center border outline-none ${
                              isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                            }`}
                          />
                          <span className="text-[11px] font-medium text-slate-400">hrs</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Fecha y Descripción Breve */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1 sm:col-span-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Calendar size={12} /> Fecha de Entrega
              </label>
              <input
                type="date"
                value={completionDate}
                onChange={e => setCompletionDate(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                  isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Link2 size={12} /> Enlace de Evidencia (Opcional)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... o enlace de entrega"
                value={evidenceLink}
                onChange={e => setEvidenceLink(e.target.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs font-bold border outline-none ${
                  isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                }`}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <FileText size={12} /> Breve Descripción del Trabajo Realizado
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe puntualmente el entregable, avance técnico o actividad completada..."
              className={`w-full p-3 rounded-xl text-xs font-medium border outline-none transition-all ${
                isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-indigo-400' : 'bg-white border-slate-200 text-slate-800 focus:border-indigo-500'
              }`}
            />
          </div>

          {/* Resumen de Impacto */}
          <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
            isDarkMode ? 'bg-indigo-950/30 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50/70 border-indigo-100 text-indigo-900'
          }`}>
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-indigo-500" />
              Se generarán {selectedStudentIds.length} registro(s) de bitácora independiente(s)
            </span>
            <span className="font-black">
              Total Horas: {totalCalculatedHours.toFixed(1)} hrs
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                isDarkMode ? 'text-slate-400 hover:text-white hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedStudentIds.length === 0}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle2 size={15} />
              )}
              Certificar Tarea y Asentar Registros
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default TaskCompletionModal;
