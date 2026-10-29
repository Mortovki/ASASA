import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  Play, 
  Square, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  Briefcase, 
  Tag, 
  FileText, 
  Sparkles, 
  Timer, 
  ChevronRight, 
  Info,
  Link2,
  X,
  Loader2
} from 'lucide-react';
import { doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';

interface ClockInOutWidgetProps {
  student: any;
  projects: any[];
  categories: any[];
  isDarkMode: boolean;
  onSessionSubmitted?: () => void;
}

export interface ActiveClockIn {
  userId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  career?: string;
  projectId: string;
  projectName: string;
  categoryId: string;
  categoryName: string;
  clockInAt: string; // ISO string
  startTime: string; // HH:mm
  date: string; // YYYY-MM-DD
  notes?: string;
  status: 'active';
}

export const ClockInOutWidget: React.FC<ClockInOutWidgetProps> = ({
  student,
  projects,
  categories,
  isDarkMode,
  onSessionSubmitted
}) => {
  const currentUid = student?.id || auth.currentUser?.uid;

  // Active clock-in state
  const [activeClockIn, setActiveClockIn] = useState<ActiveClockIn | null>(() => {
    const cached = localStorage.getItem(`clock_in_${currentUid}`);
    return cached ? JSON.parse(cached) : null;
  });

  const [isLoadingActive, setIsLoadingActive] = useState(true);

  // Form states for new clock in
  const studentProjectIds = useMemo(() => {
    if (!student) return [];
    return Array.from(new Set(((student.projectIds && student.projectIds.length > 0) ? student.projectIds : ['p-general']) as string[])).filter(Boolean);
  }, [student]);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(studentProjectIds[0] || (projects[0]?.id || ''));
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(categories[0]?.id || 'cat-1');

  // Clock Out Modal State
  const [isClockOutModalOpen, setIsClockOutModalOpen] = useState(false);
  const [isSubmittingClockOut, setIsSubmittingClockOut] = useState(false);

  // Real-time ticker
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);

      if (activeClockIn?.clockInAt) {
        const start = new Date(activeClockIn.clockInAt).getTime();
        const diff = Math.max(0, Math.floor((now.getTime() - start) / 1000));
        setElapsedSeconds(diff);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [activeClockIn]);

  // Sync active clock-in with Firestore real-time listener
  useEffect(() => {
    if (!currentUid) {
      setIsLoadingActive(false);
      return;
    }

    const docRef = doc(db, 'active_clock_ins', currentUid);
    const unsubscribe = onSnapshot(docRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as ActiveClockIn;
        setActiveClockIn(data);
        localStorage.setItem(`clock_in_${currentUid}`, JSON.stringify(data));
      } else {
        setActiveClockIn(null);
        localStorage.removeItem(`clock_in_${currentUid}`);
      }
      setIsLoadingActive(false);
    }, (err) => {
      console.warn("Error listening to active clock in:", err);
      setIsLoadingActive(false);
    });

    return () => unsubscribe();
  }, [currentUid]);

  // Format digital clock time
  const formatDigitalTime = (date: Date) => {
    return date.toLocaleTimeString('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      hour12: true 
    });
  };

  // Format elapsed time HH:MM:SS
  const formatElapsed = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const seconds = totalSecs % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calculated decimal hours from elapsed seconds
  const currentElapsedHours = useMemo(() => {
    const hrs = elapsedSeconds / 3600;
    return Math.round(hrs * 100) / 100;
  }, [elapsedSeconds]);

  // Handle Start (Clock In)
  const handleClockIn = async () => {
    if (!currentUid) {
      toast.error('No se pudo identificar al estudiante.');
      return;
    }

    const targetProject = projects.find(p => p.id === selectedProjectId) || projects[0];
    const targetCategory = categories.find(c => c.id === selectedCategoryId) || categories[0];

    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const dateStr = now.toISOString().split('T')[0];

    const studentName = student 
      ? (student.name || `${student.firstName || ''} ${student.lastNamePaterno || ''}`.trim()) 
      : (auth.currentUser?.displayName || 'Alumno');

    const clockInData: ActiveClockIn = {
      userId: currentUid,
      studentId: currentUid,
      studentName: studentName || 'Alumno',
      studentEmail: student?.email || auth.currentUser?.email || '',
      career: student?.career || '',
      projectId: targetProject?.id || 'p-general',
      projectName: targetProject?.name || 'Proyecto General',
      categoryId: targetCategory?.id || 'cat-1',
      categoryName: targetCategory?.name || 'Administrativo',
      clockInAt: nowIso,
      startTime: timeStr,
      date: dateStr,
      status: 'active'
    };

    try {
      const docRef = doc(db, 'active_clock_ins', currentUid);
      await setDoc(docRef, clockInData);
      setActiveClockIn(clockInData);
      localStorage.setItem(`clock_in_${currentUid}`, JSON.stringify(clockInData));

      confetti({
        particleCount: 40,
        spread: 50,
        origin: { y: 0.7 }
      });

      toast.success(`⏱️ Clock In registrado a las ${timeStr}. ¡Buen turno de servicio social!`, {
        duration: 4000,
        icon: '🟢'
      });
    } catch (error) {
      console.error("Error al registrar Clock In:", error);
      handleFirestoreError(error, OperationType.WRITE, `active_clock_ins/${currentUid}`);
    }
  };

  // Open modal to confirm Clock Out
  const handleOpenClockOutModal = () => {
    if (!activeClockIn) return;
    setIsClockOutModalOpen(true);
  };

  // Confirm Clock Out and generate pending session record with auto-generated description
  const handleConfirmClockOut = async () => {
    if (!activeClockIn || !currentUid) return;

    setIsSubmittingClockOut(true);
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const endTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      // Calculate effective hours (minimum 0.5, rounded to 1 decimal)
      const startMs = new Date(activeClockIn.clockInAt).getTime();
      const endMs = now.getTime();
      const diffHrs = Math.max(0.1, (endMs - startMs) / (1000 * 60 * 60));
      const finalCalculatedHours = Math.round(diffHrs * 10) / 10;

      const sesionesCol = collection(db, 'sesiones');
      const newSessionRef = doc(sesionesCol);

      // Descripción generada automáticamente al terminar la sesión (no solicitada al usuario)
      const autoDescription = `[Clock In/Out] Sesión completada de ${activeClockIn.startTime} a ${endTimeStr} (${finalCalculatedHours}h) en ${activeClockIn.projectName} · ${activeClockIn.categoryName}. Generado automáticamente al finalizar sesión.`;

      const sessionRecord = {
        id: newSessionRef.id,
        userId: currentUid,
        studentId: currentUid,
        studentName: activeClockIn.studentName,
        projectId: activeClockIn.projectId,
        projectName: activeClockIn.projectName,
        categoryId: activeClockIn.categoryId,
        categoryName: activeClockIn.categoryName,
        date: activeClockIn.date,
        startTime: activeClockIn.startTime,
        endTime: endTimeStr,
        hours: finalCalculatedHours,
        horasCalculadas: finalCalculatedHours,
        estado: 'pendiente', // Requiere validación por coordinador
        validationStatus: 'pendiente',
        status: 'A',
        sessionType: 'clock_in_out',
        isClockInOut: true,
        clockInAt: activeClockIn.clockInAt,
        clockOutAt: nowIso,
        description: autoDescription,
        evidenceLink: '', // La evidencia la añade el/la coordinador(a)
        evidenceSetByCoordinator: false,
        requiresCoordinatorApproval: true,
        createdAt: nowIso,
        createdBy: currentUid
      };

      await setDoc(newSessionRef, sessionRecord);

      // Remove from active_clock_ins
      const activeDocRef = doc(db, 'active_clock_ins', currentUid);
      await deleteDoc(activeDocRef);

      setActiveClockIn(null);
      localStorage.removeItem(`clock_in_${currentUid}`);
      setIsClockOutModalOpen(false);

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success(
        `🎉 Clock Out completado (${finalCalculatedHours}h). Tu registro ha sido enviado para validación del coordinador.`,
        { duration: 6000 }
      );

      if (onSessionSubmitted) {
        onSessionSubmitted();
      }
    } catch (error) {
      console.error("Error al registrar Clock Out:", error);
      handleFirestoreError(error, OperationType.CREATE, 'sesiones');
    } finally {
      setIsSubmittingClockOut(false);
    }
  };

  return (
    <div className="w-full">
      {/* Tarjeta Principal del Reloj Checador */}
      <div 
        className={`p-5 sm:p-7 rounded-3xl border shadow-xl relative overflow-hidden transition-all ${
          activeClockIn
            ? (isDarkMode ? 'bg-[#121f18] border-emerald-500/40' : 'bg-gradient-to-br from-emerald-50 to-teal-50/70 border-emerald-300')
            : (isDarkMode ? 'bg-[#151518] border-white/10' : 'bg-white border-slate-200/90')
        }`}
      >
        {/* Glow de fondo si está activo */}
        {activeClockIn && (
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
        )}

        {/* Encabezado del Reloj */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 border-b pb-4 border-slate-200/60 dark:border-white/10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-xs ${
                activeClockIn
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : 'bg-indigo-600 text-white'
              }`}>
                <Clock size={12} /> {activeClockIn ? 'Turno en Vivo' : 'Reloj Checador'}
              </span>
              <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {currentTime.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
            <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              {activeClockIn ? 'Sesión de Trabajo Activa' : 'Registro de Asistencia en Sesión'}
            </h3>
          </div>

          {/* Reloj Digital en Vivo */}
          <div className={`px-4 py-2 rounded-2xl border text-center self-start sm:self-auto shadow-inner ${
            isDarkMode ? 'bg-black/40 border-white/10 text-emerald-400' : 'bg-slate-100/80 border-slate-200 text-emerald-700'
          }`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">Hora Local CDMX</span>
            <span className="text-lg sm:text-xl font-mono font-black tracking-wider">
              {formatDigitalTime(currentTime)}
            </span>
          </div>
        </div>

        {/* CONTENIDO SEGÚN ESTADO: ACTIVO O INACTIVO */}
        {activeClockIn ? (
          /* ESTADO ACTIVO: Cronómetro en Vivo y Botón de Clock Out */
          <div className="space-y-6">
            {/* Display del Cronómetro Gigante */}
            <div className={`p-6 sm:p-8 rounded-3xl border flex flex-col items-center justify-center gap-2 relative overflow-hidden shadow-inner ${
              isDarkMode ? 'bg-black/40 border-emerald-500/30' : 'bg-white border-emerald-200'
            }`}>
              <div className="flex items-center gap-2 text-emerald-500 font-black text-xs uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span>Tiempo Transcurrido en Sesión</span>
              </div>
              
              <div className="text-4xl sm:text-6xl font-mono font-black tracking-tight text-emerald-500 drop-shadow-sm my-1">
                {formatElapsed(elapsedSeconds)}
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                <span>Hora de entrada: <strong className="text-slate-800 dark:text-white">{activeClockIn.startTime}</strong></span>
                <span>•</span>
                <span>Horas estimadas: <strong className="text-emerald-500 font-black">{currentElapsedHours}h</strong></span>
              </div>
            </div>

            {/* Metadatos del Turno Activo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white/80 border-slate-200/80'
              }`}>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0">
                  <Briefcase size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Proyecto</span>
                  <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{activeClockIn.projectName}</p>
                </div>
              </div>

              <div className={`p-3.5 rounded-2xl border flex items-center gap-3 ${
                isDarkMode ? 'bg-white/5 border-white/5' : 'bg-white/80 border-slate-200/80'
              }`}>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Tag size={18} />
                </div>
                <div className="min-w-0">
                  <span className="text-[9px] uppercase font-black text-slate-400 block tracking-wider">Categoría</span>
                  <p className="text-xs font-bold truncate text-slate-900 dark:text-white">{activeClockIn.categoryName}</p>
                </div>
              </div>
            </div>

            {/* Alerta de validación por coordinador */}
            <div className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs ${
              isDarkMode ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}>
              <Info size={16} className="shrink-0 text-amber-500" />
              <span>
                Al finalizar tu turno y hacer <strong>Clock Out</strong>, este registro pasará a validación y acreditación por tu coordinador.
              </span>
            </div>

            {/* Botón de Clock Out */}
            <div>
              <button
                type="button"
                onClick={handleOpenClockOutModal}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-700 hover:from-red-700 hover:to-rose-800 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Square size={18} className="fill-current" /> Registrar Salida (Clock Out)
              </button>
            </div>
          </div>
        ) : (
          /* ESTADO INACTIVO: Configuración y Botón de Clock In */
          <div className="space-y-5">
            <p className={`text-xs font-medium leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
              Inicia tu turno de servicio social con un solo clic. El reloj computará con exactitud tu tiempo de trabajo y creará tu registro para validación del coordinador.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Selector de Proyecto */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Briefcase size={12} className="text-indigo-500" /> Proyecto Asignado
                </label>
                <select
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none transition-colors ${
                    isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'
                  }`}
                >
                  {projects.map(p => (
                    <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#18181b]' : ''}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Categoría */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Tag size={12} className="text-emerald-500" /> Categoría de Trabajo
                </label>
                <select
                  value={selectedCategoryId}
                  onChange={e => setSelectedCategoryId(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none transition-colors ${
                    isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-emerald-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-emerald-500'
                  }`}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#18181b]' : ''}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Botón de Clock In */}
            <div>
              <button
                type="button"
                onClick={handleClockIn}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-600/30 transition-all active:scale-95 cursor-pointer"
              >
                <Play size={18} className="fill-current" /> Iniciar Sesión (Clock In)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: REGISTRAR SALIDA (CLOCK OUT) */}
      {isClockOutModalOpen && activeClockIn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 sm:p-7 space-y-5 ${
            isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
          }`}>
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-white/10">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white shadow-xs">
                  <Square size={10} className="fill-current" /> Confirmar Salida
                </span>
                <h3 className="text-lg font-black tracking-tight">Finalizar Turno (Clock Out)</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsClockOutModalOpen(false)}
                className={`p-2 rounded-xl transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen del Tiempo Transcurrido */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-emerald-50/60 border-emerald-200'
            }`}>
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-400 block tracking-wider">Horario del Turno</span>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {activeClockIn.startTime} — {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {activeClockIn.projectName} · {activeClockIn.categoryName}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] uppercase font-black text-emerald-600 dark:text-emerald-400 block tracking-wider">Total a Reportar</span>
                <span className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  {Math.max(0.5, currentElapsedHours)}h
                </span>
              </div>
            </div>

            {/* Información de Resumen Automático y Evidencia por Coordinación */}
            <div className={`p-4 rounded-2xl border space-y-3 ${
              isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-start gap-2.5">
                <Sparkles size={16} className="text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Descripción generada automáticamente
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Al confirmar la salida, el sistema generará automáticamente la breve descripción del turno ({activeClockIn.startTime} a {new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })}) con {Math.max(0.5, currentElapsedHours)} horas registradas.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-2.5 border-t border-slate-200/60 dark:border-white/5">
                <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-slate-900 dark:text-white">
                    Evidencia y Validación por Coordinación
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    El enlace de evidencia institucional y la certificación de tus horas serán incorporados por tu coordinador(a) al momento de validar la sesión.
                  </p>
                </div>
              </div>
            </div>

            {/* Aviso de Validación por Coordinador */}
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-800'
            }`}>
              <Info size={16} className="shrink-0 text-indigo-500" />
              <span>
                Este registro quedará marcado como <strong>Pendiente de Validación</strong> para que tu coordinador lo revise y certifique en el sistema.
              </span>
            </div>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-white/10">
              <button
                type="button"
                onClick={() => setIsClockOutModalOpen(false)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isDarkMode ? 'text-slate-400 hover:bg-white/5' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmClockOut}
                disabled={isSubmittingClockOut}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
              >
                {isSubmittingClockOut ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} /> Confirmar y Enviar a Coordinador
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClockInOutWidget;
