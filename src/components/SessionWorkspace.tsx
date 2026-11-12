import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Users, 
  User,
  Clock, 
  Calendar, 
  Briefcase, 
  Play, 
  Pause, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  XCircle, 
  Layers, 
  Sparkles, 
  Flag, 
  Plus, 
  Trash2, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown, 
  ChevronUp,
  UserPlus, 
  Check, 
  X, 
  Search, 
  ExternalLink, 
  FileText, 
  FileDown,
  ArrowLeft,
  ListTodo,
  Loader2,
  AlertTriangle,
  Award,
  Link2,
  Maximize2,
  Minimize2,
  Mic,
  Volume2,
  Radio,
  FileCheck,
  ArrowRightLeft,
  FolderKanban,
  Folder,
  SlidersHorizontal,
  ArrowUp,
  UserCheck,
  LogOut
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc,
  updateDoc, 
  addDoc, 
  deleteDoc,
  writeBatch, 
  query, 
  where,
  deleteField
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { 
  generateSessionSummary, 
  generateFallbackSummary, 
  generateDetailedSessionMinute, 
  DetailedMinuteResult,
  generateStudentClockOutReport,
  enforceUnder50WordsClient
} from '../services/aiSummaryService';
import { generateSessionPdf } from '../services/sessionPdfService';
import { Task, TaskStatus } from '../types/task';
import { Sprint } from '../types/project';
import { createTask, updateTaskAtomic } from '../services/taskService';
import { mapLegacyStatus } from '../types/tasks';
import TaskCompletionModal from './TaskCompletionModal';
import ClockInOutWidget from './ClockInOutWidget';
import SessionAudioRecorder from './SessionAudioRecorder';
import { SUPER_ADMIN_EMAILS } from '../hooks/usePermissions';

interface SessionParticipant {
  studentId: string;
  name: string;
  career?: string;
  startTime: string;
  endTime: string;
  hours: number;
  joinedLiveAt?: number;
  addedManuallyAt?: string;
  isClockedOut?: boolean;
  clockedOutAt?: string;
  individualReport?: string;
  sessionDocId?: string;
  isGeneratingReport?: boolean;
  status: 'present' | 'late' | 'excused';
}

interface SessionWorkspaceProps {
  projects: any[];
  students: any[];
  categories: any[];
  userRole: string;
  currentUser: any;
  onBack: () => void;
  isDarkMode: boolean;
  initialProjectId?: string;
  onOpenProjectDirectory?: () => void;
  onOpenProjectWorkspace?: (projectId: string) => void;
}

const DEFAULT_SESSION_CATEGORIES = [
  'Reunión Virtual',
  'Reunión Presencial',
  'Taller / Capacitación',
  'Revisión de Avances',
  'Gabinete / Campo'
];
const TOTAL_REQUIRED_HOURS = 480;

const isStudentFinished = (student: any): boolean => {
  if (!student) return false;
  if (student.isArchived) return true;
  const status = (student.status || '').toLowerCase().trim();
  const workStatus = (student.workStatus || '').toLowerCase().trim();
  if (status === 'finalizado' || status === 'concluido' || status === 'baja' || status === 'inactivo' || status === 'terminado') return true;
  if (workStatus === 'finalizado' || workStatus === 'concluido' || workStatus === 'baja' || workStatus === 'inactivo' || workStatus === 'terminado') return true;
  
  const fullName = `${student.firstName || ''} ${student.lastNamePaterno || ''} ${student.lastNameMaterno || ''} ${student.lastName || ''} ${student.name || ''} ${student.displayName || ''} ${student.nickname || ''} ${student.email || ''}`.toLowerCase();
  if ((fullName.includes('karla') && fullName.includes('espinoza')) || fullName.includes('karla espinoza')) return true;

  const approvedHours = (student.records || []).reduce((sum: number, r: any) => {
    const valStatus = (r.validationStatus || r.estado || '').toLowerCase().trim();
    const isApproved = valStatus === 'aprobado' || !valStatus || r.status === 'A' || valStatus === 'aprobada';
    if (isApproved && valStatus !== 'rechazado' && valStatus !== 'rechazada') {
      const h = Number(r.hours ?? r.horasCalculadas ?? 0);
      return sum + (isNaN(h) ? 0 : h);
    }
    return sum;
  }, 0);
  const directHours = Number(student.horasTotales || student.accumulatedHours || student.totalHours || student.horasAprobadas || student.approvedHours || 0);
  return Math.max(approvedHours, isNaN(directHours) ? 0 : directHours) >= TOTAL_REQUIRED_HOURS;
};

const KANBAN_CATEGORIES: { id: TaskStatus; title: string; shortLabel: string; color: string; border: string; bg: string; icon: any }[] = [
  { id: 'todo', title: 'Por hacer', shortLabel: 'Hacer', color: 'text-slate-600 dark:text-slate-300', border: 'border-slate-300 dark:border-white/10', bg: 'bg-slate-50 dark:bg-white/5', icon: ListTodo },
  { id: 'working_on_it', title: 'En progreso', shortLabel: 'Progreso', color: 'text-amber-600 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-500/20', bg: 'bg-amber-50/50 dark:bg-amber-500/5', icon: Loader2 },
  { id: 'waiting_review', title: 'En revisión', shortLabel: 'Revisión', color: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-500/20', bg: 'bg-blue-50/50 dark:bg-blue-500/5', icon: AlertCircle },
  { id: 'stuck', title: 'Atascado', shortLabel: 'Atascado', color: 'text-red-600 dark:text-red-400', border: 'border-red-300 dark:border-red-500/20', bg: 'bg-red-50/50 dark:bg-red-500/5', icon: XCircle },
  { id: 'done', title: 'Finalizado', shortLabel: 'Hecho', color: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-300 dark:border-emerald-500/20', bg: 'bg-emerald-50/50 dark:bg-emerald-500/5', icon: CheckCircle2 }
];

export const SessionWorkspace: React.FC<SessionWorkspaceProps> = ({
  projects,
  students,
  categories,
  userRole,
  currentUser,
  onBack,
  isDarkMode,
  initialProjectId,
  onOpenProjectDirectory,
  onOpenProjectWorkspace
}) => {
  // Configuración de la sesión
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId || projects[0]?.id || '');

  useEffect(() => {
    if (initialProjectId && projects.some(p => p.id === initialProjectId)) {
      setSelectedProjectId(initialProjectId);
    } else if (!selectedProjectId && projects.length > 0) {
      setSelectedProjectId(projects[0].id);
    }
  }, [initialProjectId, projects]);
  const [sessionCategory, setSessionCategory] = useState<string>('Reunión Presencial');
  const [sessionDate, setSessionDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [selectedSprintId, setSelectedSprintId] = useState<string>('');
  const [sprintStartDate, setSprintStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [sprintEndDate, setSprintEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [selectedStageName, setSelectedStageName] = useState<string>('Desarrollo');

  // Cronómetro en vivo
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [sessionStartTimeStr, setSessionStartTimeStr] = useState<string>('09:00');
  const [sessionEndTimeStr, setSessionEndTimeStr] = useState<string>('13:00');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Bitácora de la reunión
  const [meetingNotes, setMeetingNotes] = useState<string>('');

  // Participantes de la sesión
  const [participants, setParticipants] = useState<SessionParticipant[]>([]);
  const [isAddStudentModalOpen, setIsAddStudentModalOpen] = useState(false);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Tareas del proyecto en tiempo real
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [projectSprints, setProjectSprints] = useState<Sprint[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);

  // Filtro y expansión de categorías Kanban (inician sin desplegar por defecto)
  const [activeKanbanCategoryFilter, setActiveKanbanCategoryFilter] = useState<string>('all');
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({
    todo: true,
    in_progress: true,
    review: true,
    blocked: true,
    done: true
  });
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  // Modal para nueva tarea
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [newTaskForm, setNewTaskForm] = useState<{
    title: string;
    description: string;
    status: TaskStatus;
    priority: 'low' | 'medium' | 'high' | 'urgent' | 'milestone';
    assigneeRole: 'coordinador' | 'alumno';
    assigneeId: string;
    assigneeName: string;
    assignedUsers: string[];
    dueDate: string;
    attachmentName: string;
  }>({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assigneeRole: 'coordinador',
    assigneeId: currentUser?.uid || '',
    assigneeName: currentUser?.displayName || 'Coordinador',
    assignedUsers: [],
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
    attachmentName: ''
  });

  // Modal de Asignación Grupal de Horas
  const [isGroupTimeModalOpen, setIsGroupTimeModalOpen] = useState(false);
  const [groupStartTime, setGroupStartTime] = useState('09:00');
  const [groupEndTime, setGroupEndTime] = useState('13:00');
  const [groupHours, setGroupHours] = useState(4);

  // Modal de Reporte de Tarea Finalizada
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [isTaskCompletionModalOpen, setIsTaskCompletionModalOpen] = useState(false);
  const [sessionCompletedTasksCount, setSessionCompletedTasksCount] = useState<number>(0);
  const [completedTaskNames, setCompletedTaskNames] = useState<string[]>([]);

  // Modal para Transferir Tarea a otro Proyecto
  const [taskToTransfer, setTaskToTransfer] = useState<Task | null>(null);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [targetTransferProjectId, setTargetTransferProjectId] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);

  // Modal para Editar Asignados de la Tarea
  const [taskToEditAssignees, setTaskToEditAssignees] = useState<Task | null>(null);
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [assigneeSearchTerm, setAssigneeSearchTerm] = useState('');
  const [isSavingAssignees, setIsSavingAssignees] = useState(false);

  // Modo de visualización de Asistencia: 'individual' o 'group'
  const [attendanceViewMode, setAttendanceViewMode] = useState<'individual' | 'group'>('individual');

  // Modal de Cierre y Reporte IA
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState<string>('');
  const [isSubmittingBatch, setIsSubmittingBatch] = useState(false);

  // Grabación de Audio y Transcripción Presencial con IA
  const [transcription, setTranscription] = useState<string>('');
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [detailedMinute, setDetailedMinute] = useState<DetailedMinuteResult | null>(null);
  const [activeMinuteTab, setActiveMinuteTab] = useState<'summary' | 'minute' | 'transcript'>('summary');

  // Detectar si la modalidad seleccionada es presencial
  const isPresencial = useMemo(() => {
    const cat = (sessionCategory || '').toLowerCase();
    return cat.includes('presencial') || cat.includes('campo') || cat.includes('taller') || cat.includes('gabinete');
  }, [sessionCategory]);

  // Modo de Espacio de Trabajo: 'workspace' | 'clock_in_out' | 'coordinator_validation'
  const [workspaceMode, setWorkspaceMode] = useState<'workspace' | 'clock_in_out' | 'coordinator_validation'>(userRole === 'user' ? 'clock_in_out' : 'workspace');

  // Estados para secciones colapsables (inician sin desplegar al entrar a la pantalla de sesión)
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isKanbanSectionOpen, setIsKanbanSectionOpen] = useState(false);
  const [isAttendanceSectionOpen, setIsAttendanceSectionOpen] = useState(false);
  const [isRecordingSectionOpen, setIsRecordingSectionOpen] = useState(false);
  const [isNotesSectionOpen, setIsNotesSectionOpen] = useState(false);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Identificar el perfil de alumno actual si el usuario actual es alumno
  const currentUserStudent = useMemo(() => {
    const found = students.find(s => s.id === currentUser?.uid || s.email === currentUser?.email);
    if (found) return found;
    return {
      id: currentUser?.uid,
      name: currentUser?.displayName || 'Alumno',
      email: currentUser?.email,
      projectIds: [selectedProjectId]
    };
  }, [students, currentUser, selectedProjectId]);

  // Sesiones de Clock In / Out pendientes para validación del coordinador
  const [pendingClockSessions, setPendingClockSessions] = useState<any[]>([]);
  const [coordinatorEvidenceLinks, setCoordinatorEvidenceLinks] = useState<Record<string, string>>({});

  useEffect(() => {
    if (userRole === 'user') return;
    const q = query(
      collection(db, 'sesiones'),
      where('isClockInOut', '==', true),
      where('estado', '==', 'pendiente')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => new Date(b.createdAt || b.date).getTime() - new Date(a.createdAt || a.date).getTime());
      setPendingClockSessions(list);
    }, (err) => {
      console.warn("Error al cargar sesiones de clock in pendientes:", err);
    });
    return () => unsub();
  }, [userRole]);

  const handleApproveClockSession = async (session: any) => {
    try {
      const evidence = coordinatorEvidenceLinks[session.id] !== undefined ? coordinatorEvidenceLinks[session.id] : (session.evidenceLink || '');
      const sessionRef = doc(db, 'sesiones', session.id);
      await updateDoc(sessionRef, {
        estado: 'aprobado',
        validationStatus: 'aprobado',
        status: 'A',
        evidenceLink: evidence.trim(),
        evidenceSetByCoordinator: true,
        validatedBy: currentUser?.uid || auth.currentUser?.uid,
        validatedByName: currentUser?.displayName || 'Coordinador',
        validatedAt: new Date().toISOString()
      });
      toast.success(`Sesión de ${session.studentName} (${session.hours}h) validada y aprobada.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sesiones/${session.id}`);
    }
  };

  const handleRejectClockSession = async (session: any) => {
    const reason = window.prompt(`Motivo del rechazo para la sesión de ${session.studentName}:`, 'Horario o actividades incompletas');
    if (reason === null) return;
    try {
      const sessionRef = doc(db, 'sesiones', session.id);
      await updateDoc(sessionRef, {
        estado: 'rechazado',
        validationStatus: 'rechazado',
        rejectReason: reason,
        validatedBy: currentUser?.uid || auth.currentUser?.uid,
        validatedByName: currentUser?.displayName || 'Coordinador',
        validatedAt: new Date().toISOString()
      });
      toast.error(`Sesión de ${session.studentName} rechazada.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `sesiones/${session.id}`);
    }
  };

  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId) || projects[0];
  }, [projects, selectedProjectId]);

  // Lista de prestadores activos elegibles (no admins, no coordinadores, no baja, no finalizados)
  const activeStudents = useMemo(() => {
    return students.filter(s => {
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return false;
      if (s.role === 'admin' || s.role === 'coordinator') return false;
      if (s.isArchived) return false;
      const statusLower = (s.status || '').toLowerCase().trim();
      const workStatusLower = (s.workStatus || '').toLowerCase().trim();
      if (statusLower === 'baja' || statusLower === 'finalizado' || statusLower === 'inactivo' || statusLower === 'concluido' || statusLower === 'terminado') return false;
      if (workStatusLower === 'baja' || workStatusLower === 'finalizado' || workStatusLower === 'concluido' || workStatusLower === 'inactivo' || workStatusLower === 'terminado') return false;
      const fullName = `${s.firstName || ''} ${s.lastNamePaterno || ''} ${s.name || ''}`.toLowerCase();
      if (fullName.includes('karla') && fullName.includes('espinoza')) return false;
      return !isStudentFinished(s);
    });
  }, [students]);

  // Inicializar participantes con alumnos del proyecto si no hay ninguno seleccionado
  useEffect(() => {
    if (!selectedProjectId || participants.length > 0) return;
    const projectStudentIds: string[] = selectedProject?.studentIds || [];
    const initialList = activeStudents
      .filter(s => projectStudentIds.includes(s.id))
      .map(s => ({
        studentId: s.id,
        name: s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''}`.trim() || 'Alumno',
        career: s.career || '',
        startTime: '09:00',
        endTime: '13:00',
        hours: 4,
        status: 'present' as const
      }));
    if (initialList.length > 0) {
      setParticipants(initialList);
    }
  }, [selectedProjectId, selectedProject, activeStudents]);

  // Manejo del cronómetro
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  const formatTimer = (totalSecs: number) => {
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = async () => {
    setIsTimerRunning(true);
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setSessionStartTimeStr(timeStr);

    if (selectedProjectId) {
      try {
        await setDoc(doc(db, 'active_meetings', selectedProjectId), {
          id: selectedProjectId,
          projectId: selectedProjectId,
          projectName: selectedProject?.name || 'Proyecto',
          category: sessionCategory || 'Reunión Presencial',
          isPresencial: isPresencial,
          isVirtual: (sessionCategory || '').toLowerCase().includes('virtual'),
          isActive: true,
          startedAt: now.toISOString(),
          startTime: timeStr,
          coordinatorId: auth.currentUser?.uid || 'coord',
          coordinatorName: currentUser?.displayName || 'Coordinador',
          updatedAt: now.toISOString()
        }, { merge: true });
      } catch (err) {
        console.warn("Aviso al registrar reunión activa en Firestore:", err);
      }
    }
    toast.success('Sesión iniciada. Reunión activa para registro y cronómetro en marcha.');
  };

  const handlePauseSession = async () => {
    setIsTimerRunning(false);
    if (selectedProjectId) {
      try {
        await updateDoc(doc(db, 'active_meetings', selectedProjectId), {
          isActive: false,
          pausedAt: new Date().toISOString()
        });
      } catch (e) {}
    }
  };

  const handleResumeSession = async () => {
    setIsTimerRunning(true);
    if (selectedProjectId) {
      try {
        await updateDoc(doc(db, 'active_meetings', selectedProjectId), {
          isActive: true,
          resumedAt: new Date().toISOString()
        });
      } catch (e) {}
    }
  };

  // Sincronización en tiempo real de tareas del proyecto (Unificada entre Root /tasks y Subcolección)
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectTasks([]);
      return;
    }

    setIsLoadingTasks(true);
    let rootTasks: Task[] = [];
    let subTasks: Task[] = [];

    const mergeTasks = () => {
      const map = new Map<string, Task>();
      // 1. Tareas de la subcolección
      subTasks.forEach(t => map.set(t.id, t));
      // 2. Tareas de la colección root /tasks (unificando propiedades sin perder asignados)
      rootTasks.forEach(t => {
        const existing = map.get(t.id);
        if (existing) {
          const mergedAssignees = Array.from(new Set([
            ...(t.assignedUsers || []),
            ...(existing.assignedUsers || []),
            ...((t as any).assigneeIds || []),
            ...((existing as any).assigneeIds || [])
          ].filter(Boolean)));

          map.set(t.id, {
            ...existing,
            ...t,
            assignedUsers: mergedAssignees,
            assignedTo: t.assignedTo || existing.assignedTo || mergedAssignees[0] || null
          });
        } else {
          map.set(t.id, t);
        }
      });
      setProjectTasks(Array.from(map.values()));
      setIsLoadingTasks(false);
    };

    const normalizeToSessionStatus = (st: string | undefined): any => {
      if (!st) return 'todo';
      const s = String(st).toLowerCase().trim();
      if (s === 'in_progress' || s === 'working_on_it' || s === 'en_curso' || s === 'progreso') return 'working_on_it';
      if (s === 'in_review' || s === 'waiting_review' || s === 'en_revision' || s === 'revision') return 'waiting_review';
      if (s === 'blocked' || s === 'stuck' || s === 'bloqueada' || s === 'atascado' || s === 'detenido') return 'stuck';
      if (s === 'done' || s === 'finalizado' || s === 'finalizada' || s === 'listo' || s === 'hecho') return 'done';
      return 'todo';
    };

    // Escuchar colección principal 'tasks'
    const rootQuery = query(
      collection(db, 'tasks'),
      where('projectId', '==', selectedProjectId)
    );
    const unsubRoot = onSnapshot(rootQuery, (snapshot) => {
      rootTasks = snapshot.docs
        .map(d => {
          const data = d.data();
          const rawAssignees: string[] = Array.from(new Set([
            ...(Array.isArray(data.assigneeIds) ? data.assigneeIds : []),
            ...(Array.isArray(data.assignedUsers) ? data.assignedUsers : []),
            ...(data.assignedTo ? [data.assignedTo] : []),
            ...(data.leadAssigneeId ? [data.leadAssigneeId] : [])
          ].filter(Boolean)));

          return {
            id: d.id,
            projectId: selectedProjectId,
            ...data,
            status: normalizeToSessionStatus(data.status || data.sessionStatus),
            assignedUsers: rawAssignees,
            assignedTo: data.leadAssigneeId || rawAssignees[0] || null,
            phase: data.stageName || data.groupName || data.phase || 'General',
            endDate: data.dueDate || data.endDate || null
          } as any;
        })
        .filter((t: any) => !t.isDeleted);
      mergeTasks();
    }, (error) => {
      console.warn("Aviso al escuchar root tasks:", error);
    });

    // Escuchar subcolección de compatibilidad (sin filtro estricto de deletedAt para no omitir docs existentes)
    const subQuery = query(
      collection(db, 'projects', selectedProjectId, 'tasks')
    );
    const unsubSub = onSnapshot(subQuery, (snapshot) => {
      subTasks = snapshot.docs.map(d => {
        const dData = d.data();
        const rawAssignees: string[] = Array.from(new Set([
          ...(Array.isArray(dData.assigneeIds) ? dData.assigneeIds : []),
          ...(Array.isArray(dData.assignedUsers) ? dData.assignedUsers : []),
          ...(dData.assignedTo ? [dData.assignedTo] : []),
          ...(dData.leadAssigneeId ? [dData.leadAssigneeId] : [])
        ].filter(Boolean)));

        return {
          ...dData,
          id: d.id,
          assignedUsers: rawAssignees,
          assignedTo: dData.leadAssigneeId || rawAssignees[0] || null,
          status: normalizeToSessionStatus(dData.status || dData.sessionStatus)
        };
      }).filter((t: any) => !t.deletedAt && !t.isDeleted) as Task[];
      mergeTasks();
    }, (error) => {
      console.warn("Aviso al escuchar sub tasks:", error);
      setIsLoadingTasks(false);
    });

    return () => {
      unsubRoot();
      unsubSub();
    };
  }, [selectedProjectId]);

  // Sincronización en tiempo real de Sprints del proyecto
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectSprints([]);
      return;
    }

    const sprintsRef = collection(db, 'projects', selectedProjectId, 'sprints');
    const unsubscribe = onSnapshot(sprintsRef, (snapshot) => {
      const sprintsData = snapshot.docs.map(d => ({
        id: d.id,
        projectId: selectedProjectId,
        ...d.data()
      })) as Sprint[];
      setProjectSprints(sprintsData);
      if (sprintsData.length > 0 && !selectedSprintId) {
        setSelectedSprintId(sprintsData[0].id);
        if (sprintsData[0].startDate) setSprintStartDate(sprintsData[0].startDate);
        if (sprintsData[0].endDate) setSprintEndDate(sprintsData[0].endDate);
      }
    }, (err) => {
      console.warn("No se pudieron cargar sprints del proyecto:", err);
    });

    return () => unsubscribe();
  }, [selectedProjectId]);

  // Calcular horas a partir de horas de entrada y salida
  const calculateHoursFromTimes = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMins = (sh || 0) * 60 + (sm || 0);
    const endMins = (eh || 0) * 60 + (em || 0);
    const diff = endMins - startMins;
    return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
  };
  const calculateDuration = calculateHoursFromTimes;

  // Cambiar estado de una tarea directamente en Firestore y sincronizar con todo el sistema
  const handleUpdateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    if (!selectedProjectId) return;

    // Si se mueve a 'done' (Finalizado), abrir modal de reporte para certificar horas individuales/grupales
    if (newStatus === 'done') {
      const task = projectTasks.find(t => t.id === taskId);
      if (task) {
        setTaskToComplete(task);
        setIsTaskCompletionModalOpen(true);
        return;
      }
    }

    try {
      const now = new Date().toISOString();
      const stdStatus = newStatus === 'working_on_it' ? 'in_progress'
        : newStatus === 'waiting_review' ? 'in_review'
        : newStatus === 'stuck' ? 'blocked'
        : newStatus;

      const updates: any = {
        status: stdStatus,
        sessionStatus: newStatus,
        lastMovedAt: now,
        lastMovedBy: auth.currentUser?.uid || 'coordinador',
        updatedAt: now,
        updatedBy: auth.currentUser?.uid || 'coordinador'
      };

      // 1. Actualizar en colección unificada /tasks
      try {
        await setDoc(doc(db, 'tasks', taskId), { ...updates, projectId: selectedProjectId }, { merge: true });
      } catch (errRoot) {
        // Puede ser tarea previa en subcolección
      }

      // 2. Actualizar en subcolección para retrocompatibilidad
      try {
        await setDoc(doc(db, 'projects', selectedProjectId, 'tasks', taskId), updates, { merge: true });
      } catch (errSub) {
        // Tarea nacida en root
      }

      toast.success(`Tarea movida a ${KANBAN_CATEGORIES.find(c => c.id === newStatus)?.title || newStatus}`);
    } catch (error) {
      console.error("Error al actualizar tarea:", error);
      toast.error('No se pudo mover la tarea');
    }
  };

  // Callback al completar tarea y asentar sus horas
  const handleTaskCompletionSuccess = (completedTaskId: string, recordsCreated: any[]) => {
    setProjectTasks(prev => prev.map(t => t.id === completedTaskId ? { ...t, status: 'done' as TaskStatus } : t));
    const completedTask = projectTasks.find(t => t.id === completedTaskId);
    if (completedTask) {
      setCompletedTaskNames(prev => [...prev, completedTask.title]);
    }
    setSessionCompletedTasksCount(prev => prev + 1);
  };

  // Abrir modal de transferencia de tarea
  const openTransferModal = (task: Task) => {
    setTaskToTransfer(task);
    const otherProjects = projects.filter(p => p.id !== selectedProjectId);
    setTargetTransferProjectId(otherProjects[0]?.id || '');
    setIsTransferModalOpen(true);
  };

  // Transferir tarea a otro proyecto y sincronizar en Firestore
  const handleTransferTask = async () => {
    if (!taskToTransfer || !targetTransferProjectId) return;
    if (targetTransferProjectId === selectedProjectId) {
      toast.error('Selecciona un proyecto diferente al actual');
      return;
    }
    const targetProject = projects.find(p => p.id === targetTransferProjectId);
    if (!targetProject) {
      toast.error('Proyecto destino no encontrado');
      return;
    }

    setIsTransferring(true);
    const loadingToast = toast.loading(`Transfiriendo tarea a "${targetProject.name}"...`);

    try {
      const now = new Date().toISOString();
      const updates: any = {
        projectId: targetTransferProjectId,
        projectName: targetProject.name,
        updatedAt: now,
        updatedBy: auth.currentUser?.uid || 'coordinador'
      };

      // 1. Actualizar en colección unificada /tasks (esta es la fuente de verdad del sistema)
      try {
        await updateDoc(doc(db, 'tasks', taskToTransfer.id), updates);
      } catch (errRoot) {
        console.warn("Aviso al actualizar root task:", errRoot);
      }

      // 2. Mover en subcolecciones si existía para retrocompatibilidad
      try {
        await deleteDoc(doc(db, 'projects', selectedProjectId, 'tasks', taskToTransfer.id));
      } catch (_) {}

      try {
        await setDoc(doc(db, 'projects', targetTransferProjectId, 'tasks', taskToTransfer.id), {
          ...taskToTransfer,
          ...updates
        }, { merge: true });
      } catch (_) {}

      // Actualizar estado local eliminando la tarea del proyecto actual
      setProjectTasks(prev => prev.filter(t => t.id !== taskToTransfer.id));

      toast.dismiss(loadingToast);
      toast.success(`Tarea transferida a "${targetProject.name}" exitosamente.`);
      setIsTransferModalOpen(false);
      setTaskToTransfer(null);
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error("Error al transferir tarea:", err);
      toast.error('Error al transferir tarea de proyecto');
    } finally {
      setIsTransferring(false);
    }
  };

  // Abrir modal para editar asignados
  const openAssigneeModal = (task: Task) => {
    setTaskToEditAssignees(task);
    const currentAssignees: string[] = Array.from(new Set([
      ...((task as any).assigneeIds || []),
      ...(task.assignedUsers || []),
      ...(task.assignedTo ? [task.assignedTo] : []),
      ...((task as any).leadAssigneeId ? [(task as any).leadAssigneeId] : [])
    ].filter(Boolean)));
    setSelectedAssigneeIds(currentAssignees);
    setAssigneeSearchTerm('');
    setIsAssigneeModalOpen(true);
  };

  // Conmutar asignación de un alumno
  const toggleAssignee = (studentId: string, studentName?: string) => {
    setSelectedAssigneeIds(prev => {
      const match = prev.find(id => id === studentId || (studentName && id.toLowerCase() === studentName.toLowerCase()));
      if (match) {
        return prev.filter(id => id !== match);
      } else {
        return [...prev, studentId];
      }
    });
  };

  // Guardar asignados y reflejar en Firestore y en todos los proyectos
  const handleSaveAssignees = async () => {
    if (!taskToEditAssignees) return;
    setIsSavingAssignees(true);
    const loadingToast = toast.loading('Actualizando asignación...');

    try {
      const now = new Date().toISOString();
      const leadStudent = students.find(s => s.id === selectedAssigneeIds[0]);
      const leadName = leadStudent 
        ? (leadStudent.name || `${leadStudent.firstName || ''} ${leadStudent.lastNamePaterno || ''}`.trim() || 'Alumno')
        : (currentUser?.displayName || 'Coordinador');

      const updates: any = {
        assigneeIds: selectedAssigneeIds,
        assignedUsers: selectedAssigneeIds,
        leadAssigneeId: selectedAssigneeIds[0] || null,
        leadAssigneeName: selectedAssigneeIds.length > 0 ? leadName : 'Sin asignar',
        assignedTo: selectedAssigneeIds[0] || null,
        assigneeId: selectedAssigneeIds[0] || null,
        assigneeName: selectedAssigneeIds.length > 0 ? leadName : 'Sin asignar',
        updatedAt: now,
        updatedBy: auth.currentUser?.uid || 'coordinador'
      };

      // 1. Actualizar en colección unificada /tasks
      try {
        await setDoc(doc(db, 'tasks', taskToEditAssignees.id), {
          ...taskToEditAssignees,
          ...updates,
          projectId: selectedProjectId
        }, { merge: true });
      } catch (errRoot) {
        console.warn("Aviso al actualizar root task:", errRoot);
      }

      // 2. Actualizar en subcolección para retrocompatibilidad
      if (selectedProjectId) {
        try {
          await setDoc(doc(db, 'projects', selectedProjectId, 'tasks', taskToEditAssignees.id), updates, { merge: true });
        } catch (_) {}
      }

      // Actualizar estado local inmediatamente
      setProjectTasks(prev => prev.map(t => {
        if (t.id === taskToEditAssignees.id) {
          return {
            ...t,
            ...updates
          };
        }
        return t;
      }));

      toast.dismiss(loadingToast);
      toast.success(
        selectedAssigneeIds.length === 0
          ? 'Tarea sin asignados'
          : `Asignación actualizada (${selectedAssigneeIds.length} persona${selectedAssigneeIds.length > 1 ? 's' : ''})`
      );
      setIsAssigneeModalOpen(false);
      setTaskToEditAssignees(null);
    } catch (err) {
      toast.dismiss(loadingToast);
      console.error("Error al actualizar asignados:", err);
      toast.error('Error al actualizar asignación');
    } finally {
      setIsSavingAssignees(false);
    }
  };

  // Crear nueva tarea directamente en el proyecto y sincronizar en tiempo real
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskForm.title.trim()) {
      toast.error('El título de la tarea es obligatorio.');
      return;
    }
    if (!selectedProjectId) {
      toast.error('Selecciona un proyecto primero.');
      return;
    }

    try {
      const isMilestone = newTaskForm.priority === 'milestone';
      const starPriority = isMilestone ? 5 : (newTaskForm.priority === 'urgent' ? 5 : newTaskForm.priority === 'high' ? 4 : newTaskForm.priority === 'medium' ? 3 : 2);
      const today = new Date().toISOString().split('T')[0];
      const dueDate = newTaskForm.dueDate || sprintEndDate || today;

      const attachments = newTaskForm.attachmentName.trim() ? [{
        id: `att_${Date.now().toString(36)}`,
        name: newTaskForm.attachmentName.trim(),
        url: '#',
        uploadedBy: auth.currentUser?.uid || 'user',
        uploadedByName: currentUser?.displayName || 'Usuario',
        uploadedAt: new Date().toISOString()
      }] : [];

      const leadId = newTaskForm.assigneeId || newTaskForm.assignedUsers[0] || auth.currentUser?.uid || 'coordinador';
      const leadName = newTaskForm.assigneeName || currentUser?.displayName || 'Coordinador';
      const assigneeIds = newTaskForm.assignedUsers.length > 0 ? newTaskForm.assignedUsers : [leadId];

      // 1. Crear en colección unificada /tasks para que aparezca en Tabla, Kanban, Gantt, Calendario y Dashboard
      const createdId = await createTask({
        projectId: selectedProjectId,
        projectName: selectedProject?.name || 'Proyecto',
        title: newTaskForm.title.trim(),
        description: newTaskForm.description.trim(),
        status: mapLegacyStatus(newTaskForm.status),
        priority: starPriority as any,
        isMilestone: isMilestone,
        leadAssigneeId: leadId,
        leadAssigneeName: leadName,
        leadAssigneeRole: newTaskForm.assigneeRole,
        assigneeIds,
        dueDate,
        startDate: today,
        endDate: dueDate,
        sprintId: selectedSprintId || undefined,
        stageName: selectedStageName || undefined,
        attachments,
        subtasks: [],
        createdBy: auth.currentUser?.uid || 'coordinador',
        createdByName: currentUser?.displayName || 'Coordinador'
      }, {
        id: auth.currentUser?.uid || 'coordinador',
        name: currentUser?.displayName || 'Coordinador',
        role: userRole
      });

      // 2. Guardar también en subcolección para retrocompatibilidad absoluta
      try {
        const tasksRef = collection(db, 'projects', selectedProjectId, 'tasks');
        await addDoc(tasksRef, {
          id: createdId,
          title: newTaskForm.title.trim(),
          description: newTaskForm.description.trim(),
          status: newTaskForm.status,
          priority: starPriority,
          isMilestone: isMilestone,
          leadAssigneeId: leadId,
          leadAssigneeName: leadName,
          leadAssigneeRole: newTaskForm.assigneeRole,
          assignedUsers: assigneeIds,
          assignedTo: leadId,
          endDate: dueDate,
          dueDate: dueDate,
          sprintId: selectedSprintId || null,
          phase: selectedStageName,
          projectId: selectedProjectId,
          attachments,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || 'coordinador',
          deletedAt: null
        });
      } catch (errSub) {
        console.warn("Aviso al guardar en subcolección:", errSub);
      }

      toast.success(isMilestone ? '¡Hito creado y sincronizado con todo el sistema!' : 'Tarea creada y sincronizada con todo el sistema');
      setIsNewTaskModalOpen(false);
      setNewTaskForm({
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        assigneeRole: 'coordinador',
        assigneeId: currentUser?.uid || '',
        assigneeName: currentUser?.displayName || 'Coordinador',
        assignedUsers: [],
        dueDate: new Date(Date.now() + 86400000 * 3).toISOString().split('T')[0],
        attachmentName: ''
      });
    } catch (error) {
      console.error("Error al crear tarea:", error);
      toast.error('Error al crear tarea');
    }
  };

  // Obtener las tareas asignadas a un alumno específico en el proyecto actual
  const getStudentAssignedTasks = (studentId: string, studentName: string) => {
    const nameLower = (studentName || '').toLowerCase().trim();
    const firstToken = nameLower.split(' ')[0] || '';
    return projectTasks.filter(t => {
      const ids = [
        ...(t.assignedUsers || []),
        ...((t as any).assigneeIds || []),
        ...(t.assignedTo ? [t.assignedTo] : []),
        ...((t as any).leadAssigneeId ? [(t as any).leadAssigneeId] : [])
      ];
      if (ids.some(id => id === studentId || String(id).toLowerCase() === nameLower || (firstToken.length > 2 && String(id).toLowerCase().includes(firstToken)))) {
        return true;
      }
      const leadName = String((t as any).leadAssigneeName || (t as any).assigneeName || '').toLowerCase();
      if (leadName && (leadName.includes(nameLower) || (firstToken.length > 2 && leadName.includes(firstToken)))) {
        return true;
      }
      return false;
    });
  };

  // Incorporar alumno manualmente tomando automáticamente la hora exacta en la que se agregó y sincronizando con el Directorio de Proyectos
  const handleAddManualStudent = async (student: any) => {
    const now = new Date();
    const addedTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const defaultEnd = sessionEndTimeStr || '13:00';
    const calcH = calculateHoursFromTimes(addedTimeStr, defaultEnd);
    const initialHours = calcH > 0 ? calcH : 4;
    const studentDisplayName = student.name || `${student.firstName || ''} ${student.lastNamePaterno || ''}`.trim() || 'Alumno';

    setParticipants(prev => {
      if (prev.some(p => p.studentId === student.id)) return prev;
      return [
        ...prev,
        {
          studentId: student.id,
          name: studentDisplayName,
          career: student.career || '',
          startTime: addedTimeStr,
          endTime: defaultEnd,
          hours: initialHours,
          joinedLiveAt: Date.now(),
          addedManuallyAt: addedTimeStr,
          isClockedOut: false,
          status: 'present'
        }
      ];
    });

    // Sincronizar con el Directorio de Proyectos para asegurar la integración del alumno en el proyecto
    if (selectedProjectId && student.id) {
      try {
        const currentProjStudentIds: string[] = Array.isArray(selectedProject?.studentIds) ? selectedProject.studentIds : [];
        if (!currentProjStudentIds.includes(student.id)) {
          await setDoc(doc(db, 'projects', selectedProjectId), {
            studentIds: Array.from(new Set([...currentProjStudentIds, student.id])),
            updatedAt: now.toISOString()
          }, { merge: true });
        }
        const currentStudentProjIds: string[] = Array.isArray(student.projectIds) ? student.projectIds : [];
        if (!currentStudentProjIds.includes(selectedProjectId)) {
          const updatedProjIds = Array.from(new Set([...currentStudentProjIds, selectedProjectId]));
          await setDoc(doc(db, 'users', student.id), {
            projectIds: updatedProjIds,
            workStatus: 'Asignado'
          }, { merge: true }).catch(() => {});
          await setDoc(doc(db, 'public_profiles', student.id), {
            projectIds: updatedProjIds,
            workStatus: 'Asignado'
          }, { merge: true }).catch(() => {});
        }
      } catch (err) {
        console.warn('Aviso al sincronizar alumno con el directorio de proyectos:', err);
      }
    }

    toast.success(`${studentDisplayName} agregado a las ${addedTimeStr} hrs (Hora de ingreso capturada)`);
  };

  // Asistencia: Incorporar alumno en vivo ahora mismo (actualiza su hora de entrada a la actual)
  const handleCheckInLive = (studentId: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setParticipants(prev => prev.map(p => {
      if (p.studentId === studentId) {
        const calcH = calculateHoursFromTimes(timeStr, p.endTime);
        return {
          ...p,
          startTime: timeStr,
          hours: calcH > 0 ? calcH : p.hours,
          joinedLiveAt: Date.now(),
          addedManuallyAt: timeStr,
          isClockedOut: false,
          status: 'present'
        };
      }
      return p;
    }));
    toast.success(`Hora de entrada actualizada a las ${timeStr} hrs`);
  };

  // Clock Out Manual por Alumno: Toma la hora de salida actual y genera el reporte de menos de 50 palabras con sus actividades asignadas y lo visto en la sesión
  const handleManualClockOutStudent = async (studentId: string) => {
    const target = participants.find(p => p.studentId === studentId);
    if (!target) return;

    const now = new Date();
    const outTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const calcH = calculateHoursFromTimes(target.startTime, outTimeStr);
    const finalHours = calcH > 0 ? calcH : (target.hours > 0 ? target.hours : 1);

    setParticipants(prev => prev.map(p => p.studentId === studentId ? {
      ...p,
      endTime: outTimeStr,
      hours: finalHours,
      isGeneratingReport: true
    } : p));

    const loadingToast = toast.loading(`Registrando Clock Out de ${target.name} (${outTimeStr}) y generando reporte < 50 palabras...`);

    try {
      const assignedTasks = getStudentAssignedTasks(target.studentId, target.name);
      const reportUnder50 = await generateStudentClockOutReport({
        studentName: target.name,
        projectName: selectedProject?.name || 'Proyecto General',
        categoryName: sessionCategory,
        stageName: selectedStageName,
        date: sessionDate,
        startTime: target.startTime,
        endTime: outTimeStr,
        hours: finalHours,
        assignedTasks: assignedTasks.map(t => ({
          title: t.title,
          status: KANBAN_CATEGORIES.find(c => c.id === t.status)?.title || t.status,
          description: t.description
        })),
        sessionTasks: projectTasks.map(t => ({
          title: t.title,
          status: KANBAN_CATEGORIES.find(c => c.id === t.status)?.title || t.status
        })),
        meetingNotes,
        transcription
      });

      const sesionesCol = collection(db, 'sesiones');
      const docRef = target.sessionDocId ? doc(db, 'sesiones', target.sessionDocId) : doc(sesionesCol);
      const recordData: any = {
        id: docRef.id,
        userId: target.studentId,
        studentId: target.studentId,
        studentName: target.name,
        date: sessionDate,
        startTime: target.startTime,
        endTime: outTimeStr,
        hours: finalHours,
        horasCalculadas: finalHours,
        categoryId: sessionCategory,
        projectId: selectedProjectId,
        projectName: selectedProject?.name || '',
        description: reportUnder50,
        evidenceLink: evidenceUrl.trim() || '',
        estado: 'aprobado',
        validationStatus: 'aprobado',
        status: 'A',
        sessionType: 'manual_clockout',
        sprintId: selectedSprintId || null,
        isPresencial: isPresencial,
        clockedOutAt: now.toISOString(),
        createdAt: now.toISOString(),
        createdBy: auth.currentUser?.uid || 'admin'
      };

      await setDoc(docRef, recordData, { merge: true });

      setParticipants(prev => prev.map(p => p.studentId === studentId ? {
        ...p,
        endTime: outTimeStr,
        hours: finalHours,
        isClockedOut: true,
        clockedOutAt: outTimeStr,
        individualReport: reportUnder50,
        sessionDocId: docRef.id,
        isGeneratingReport: false
      } : p));

      toast.dismiss(loadingToast);
      const wCount = reportUnder50.split(/\s+/).filter(Boolean).length;
      toast.success(`Clock Out de ${target.name} registrado (${outTimeStr} · ${finalHours}h). Reporte de ${wCount} palabras guardado.`);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error('Error en Clock Out manual del alumno:', error);
      setParticipants(prev => prev.map(p => p.studentId === studentId ? { ...p, isGeneratingReport: false } : p));
      toast.error('No se pudo completar el Clock Out manual.');
    }
  };

  // Guardar edición manual del reporte individual (< 50 palabras) del alumno
  const handleSaveStudentIndividualReport = async (studentId: string, customReport: string) => {
    const target = participants.find(p => p.studentId === studentId);
    if (!target) return;
    const enforcedReport = enforceUnder50WordsClient(customReport);
    setParticipants(prev => prev.map(p => p.studentId === studentId ? { ...p, individualReport: enforcedReport } : p));
    if (target.sessionDocId) {
      try {
        await updateDoc(doc(db, 'sesiones', target.sessionDocId), {
          description: enforcedReport,
          startTime: target.startTime,
          endTime: target.endTime,
          hours: Number(target.hours) || 0,
          horasCalculadas: Number(target.hours) || 0,
          updatedAt: new Date().toISOString()
        });
        toast.success(`Reporte individual de ${target.name} actualizado (< 50 palabras)`);
      } catch (e) {
        console.warn('Error al actualizar reporte individual en Firestore:', e);
      }
    }
  };

  // Asistencia: Aplicar horario grupal
  const handleApplyGroupTime = () => {
    setParticipants(prev => prev.map(p => ({
      ...p,
      startTime: groupStartTime,
      endTime: groupEndTime,
      hours: Number(groupHours) || 0
    })));
    setIsGroupTimeModalOpen(false);
    toast.success(`Horario (${groupStartTime} - ${groupEndTime} · ${groupHours} hrs) aplicado a todos los alumnos`);
  };

  // Abrir modal de finalización y preparar reporte
  const handleOpenCompletionModal = async () => {
    if (participants.length === 0) {
      toast.error('Agrega al menos un alumno a la sesión antes de finalizarla.');
      return;
    }
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    setSessionEndTimeStr(timeStr);
    setIsTimerRunning(false);
    setIsSessionEnded(true);
    setIsCompletionModalOpen(true);

    if (selectedProjectId) {
      try {
        await updateDoc(doc(db, 'active_meetings', selectedProjectId), {
          isActive: false,
          endedAt: now.toISOString()
        });
      } catch (e) {}
    }
  };

  // Generar resumen con IA Gemini (gemini-3.8-flash) y minuta completa
  const handleGenerateAiSummary = async () => {
    setIsGeneratingAi(true);
    try {
      const sessionContext = {
        projectName: selectedProject?.name || 'Proyecto General',
        categoryName: sessionCategory,
        sprintName: projectSprints.find(s => s.id === selectedSprintId)?.name || 'Sprint de Seguimiento',
        stageName: selectedStageName,
        date: sessionDate,
        startTime: sessionStartTimeStr,
        endTime: sessionEndTimeStr,
        totalHours: participants[0]?.hours || 4,
        participants: participants.map(p => ({ name: p.name, hours: p.hours })),
        tasksDiscussed: projectTasks.map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority ? String(t.priority) : undefined,
          isMilestone: t.isMilestone,
          assignees: t.assignedUsers
        })),
        meetingNotes: meetingNotes,
        transcription: transcription.trim(),
        hasAudioRecording: Boolean(recordedAudioUrl || transcription.trim())
      };

      // 1. Generar Síntesis Oficial para el expediente (~100 palabras)
      const summary = await generateSessionSummary(sessionContext);
      setAiSummary(summary);

      // 2. Generar Minuta Detallada completa a partir de la transcripción presencial
      const minute = await generateDetailedSessionMinute(sessionContext);
      setDetailedMinute(minute);

      toast.success(
        transcription.trim() 
          ? '¡Minuta completa y resumen generados con la transcripción presencial!' 
          : 'Resumen institucional generado exitosamente'
      );
    } catch (error) {
      console.warn("Aviso al generar resumen:", error);
      toast.error('No se pudo generar el resumen automático.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Generar y descargar reporte oficial de la sesión en PDF
  const handleDownloadPdf = () => {
    // REGLA: El reporte oficial solo se puede generar cuando termine la sesión
    if (!isSessionEnded && !isCompletionModalOpen) {
      toast.error('El reporte oficial solo se puede generar cuando termine la sesión. Por favor finaliza la sesión primero.');
      handleOpenCompletionModal();
      return;
    }

    try {
      const sessionContext = {
        projectName: selectedProject?.name || 'Proyecto General',
        categoryName: sessionCategory,
        sprintName: projectSprints.find(s => s.id === selectedSprintId)?.name || 'Sprint de Seguimiento',
        stageName: selectedStageName,
        date: sessionDate,
        startTime: sessionStartTimeStr,
        endTime: sessionEndTimeStr,
        totalHours: participants[0]?.hours || 4,
        participants: participants.map(p => ({ name: p.name, hours: p.hours })),
        tasksDiscussed: projectTasks.map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority ? String(t.priority) : undefined,
          isMilestone: t.isMilestone,
          assignees: t.assignedUsers
        })),
        meetingNotes: meetingNotes,
        transcription: transcription.trim(),
        hasAudioRecording: Boolean(recordedAudioUrl || transcription.trim())
      };

      const summaryToUse = aiSummary.trim() || generateFallbackSummary(sessionContext);

      generateSessionPdf({
        projectName: selectedProject?.name || 'Proyecto General',
        categoryName: sessionCategory,
        sprintName: projectSprints.find(s => s.id === selectedSprintId)?.name || 'Sprint de Seguimiento',
        stageName: selectedStageName,
        date: sessionDate,
        startTime: sessionStartTimeStr,
        endTime: sessionEndTimeStr,
        totalHours: participants[0]?.hours || 4,
        coordinatorName: currentUser?.displayName || 'Coordinador del Proyecto',
        coordinatorEmail: currentUser?.email || '',
        aiSummary: summaryToUse,
        meetingNotes: meetingNotes,
        evidenceUrl: evidenceUrl,
        transcription: transcription.trim(),
        hasAudioRecording: Boolean(recordedAudioUrl || transcription.trim()),
        detailedMinute: detailedMinute?.fullMinuteText,
        topicsDiscussed: detailedMinute?.topicsDiscussed,
        agreements: detailedMinute?.agreements,
        nextSteps: detailedMinute?.nextSteps,
        participants: participants.map(p => ({
          studentId: p.studentId,
          name: p.name,
          career: p.career,
          hours: p.hours,
          startTime: p.startTime,
          endTime: p.endTime,
          status: p.status
        })),
        tasks: projectTasks.map(t => ({
          title: t.title,
          status: t.status,
          priority: t.priority,
          isMilestone: t.isMilestone,
          assignees: t.assignedUsers
        }))
      });

      toast.success('¡Reporte oficial en PDF descargado exitosamente!');
    } catch (error) {
      console.warn('Error al generar PDF de la sesión:', error);
      toast.error('Ocurrió un error al generar el PDF del reporte.');
    }
  };

  // Asentar y distribuir a Firestore
  const handleSaveAndDistributeRecords = async () => {
    if (!aiSummary.trim()) {
      toast.error('Por favor genera o redacta el resumen de la sesión antes de asentar.');
      return;
    }
    if (participants.length === 0) {
      toast.error('No hay alumnos para asentar.');
      return;
    }

    setIsSubmittingBatch(true);
    try {
      const batch = writeBatch(db);
      const sesionesCol = collection(db, 'sesiones');

      participants.forEach(p => {
        const targetDocRef = p.sessionDocId ? doc(db, 'sesiones', p.sessionDocId) : doc(sesionesCol);
        const recordData: any = {
          id: targetDocRef.id,
          userId: p.studentId,
          studentId: p.studentId,
          studentName: p.name,
          date: sessionDate,
          startTime: p.startTime || sessionStartTimeStr,
          endTime: p.endTime || sessionEndTimeStr,
          hours: Number(p.hours) || 0,
          horasCalculadas: Number(p.hours) || 0,
          categoryId: sessionCategory,
          projectId: selectedProjectId,
          projectName: selectedProject?.name || '',
          description: p.individualReport || aiSummary.trim(),
          officialSessionSummary: aiSummary.trim(),
          evidenceLink: evidenceUrl.trim(),
          estado: 'aprobado',
          validationStatus: 'aprobado',
          status: 'A',
          sessionType: p.isClockedOut ? 'manual_clockout' : 'grupal',
          sprintId: selectedSprintId || null,
          isPresencial: isPresencial,
          transcription: transcription.trim() || null,
          hasAudioRecording: Boolean(recordedAudioUrl || transcription.trim()),
          minuteTopics: detailedMinute?.topicsDiscussed || null,
          minuteAgreements: detailedMinute?.agreements || null,
          minuteNextSteps: detailedMinute?.nextSteps || null,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || 'admin'
        };
        batch.set(targetDocRef, recordData, { merge: true });
      });

      await batch.commit();

      // Si hay URL de evidencia, sincronizar automáticamente con los recursos del proyecto en el Directorio de Proyectos
      if (selectedProjectId && evidenceUrl.trim()) {
        try {
          const resId = `res_session_${Date.now()}`;
          await setDoc(doc(db, 'projects', selectedProjectId, 'resources', resId), {
            id: resId,
            projectId: selectedProjectId,
            title: `Evidencia de Sesión (${sessionDate} · ${sessionCategory})`,
            url: evidenceUrl.trim(),
            type: 'link',
            category: 'Evidencia de Sesión',
            addedBy: currentUser?.displayName || 'Coordinador',
            createdAt: new Date().toISOString()
          });
        } catch (errRes) {
          console.warn('Aviso al sincronizar evidencia con recursos del proyecto:', errRes);
        }
      }

      // Generar y descargar reporte oficial en PDF automáticamente al terminar la sesión
      try {
        handleDownloadPdf();
      } catch (e) {
        console.warn("Descarga automática de PDF pospuesta:", e);
      }

      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });

      toast.success(`¡Sesión asentada y distribuida con éxito para ${participants.length} alumno(s)! Reporte en PDF generado.`, {
        duration: 5000
      });

      if (selectedProjectId) {
        try {
          await updateDoc(doc(db, 'active_meetings', selectedProjectId), {
            isActive: false,
            distributedAt: new Date().toISOString()
          });
        } catch (e) {}
      }

      setIsCompletionModalOpen(false);
      onBack();
    } catch (error) {
      console.error("Error al asentar registros en lote:", error);
      handleFirestoreError(error, OperationType.CREATE, 'sesiones');
    } finally {
      setIsSubmittingBatch(false);
    }
  };

  const wordCount = useMemo(() => {
    if (!aiSummary.trim()) return 0;
    return aiSummary.trim().split(/\s+/).length;
  }, [aiSummary]);

  const toggleColumnCollapse = (columnId: string) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [columnId]: !prev[columnId]
    }));
  };

  // Tareas filtradas por búsqueda y categoría
  const filteredTasks = useMemo(() => {
    return projectTasks.filter(t => {
      if (activeKanbanCategoryFilter !== 'all' && t.status !== activeKanbanCategoryFilter) {
        return false;
      }
      if (taskSearchQuery.trim()) {
        const q = taskSearchQuery.toLowerCase();
        return t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [projectTasks, activeKanbanCategoryFilter, taskSearchQuery]);

  return (
    <div className={`space-y-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
      {/* Barra Superior de Control de Sesión */}
      <div className={`p-4 sm:p-6 rounded-2xl sm:rounded-3xl border shadow-sm flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className={`p-2.5 rounded-xl border transition-colors ${isDarkMode ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-slate-50 text-slate-600'}`}
            title="Regresar"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md border ${isTimerRunning ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse' : 'bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10'}`}>
                {isTimerRunning ? 'Sesión en Vivo' : 'Sesión Configurada'}
              </span>
              <span className="text-xs text-slate-400">· {sessionDate}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">Control de Sesión de Trabajo</h2>
          </div>
        </div>

        {/* Temporizador y Acciones Rápidas */}
        <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto justify-end">
          <div className={`px-4 py-2 rounded-2xl border flex items-center gap-3 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
            <Clock size={18} className={isTimerRunning ? 'text-indigo-500 animate-spin' : 'text-slate-400'} />
            <span className="font-mono text-lg font-black tracking-wider tabular-nums">
              {formatTimer(timerSeconds)}
            </span>
            <div className="flex items-center gap-1.5 border-l pl-2 border-slate-200 dark:border-white/10 shrink-0">
              {!isTimerRunning ? (
                <button
                  onClick={timerSeconds === 0 ? handleStartSession : handleResumeSession}
                  className={`p-1.5 sm:px-3 sm:py-1.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5 font-bold text-xs shadow-sm ${
                    timerSeconds === 0
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/30 animate-pulse'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/30'
                  }`}
                  title={timerSeconds === 0 ? "Iniciar Sesión de Trabajo" : "Reanudar Cronómetro"}
                >
                  <Play size={14} className="fill-current shrink-0" />
                  <span>{timerSeconds === 0 ? 'Iniciar Sesión' : 'Reanudar'}</span>
                </button>
              ) : (
                <button
                  onClick={handlePauseSession}
                  className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white transition-all active:scale-95 flex items-center gap-1.5 font-bold text-xs shadow-sm shadow-amber-500/30"
                  title="Pausar Cronómetro"
                >
                  <Pause size={14} className="fill-current shrink-0" />
                  <span>Pausar</span>
                </button>
              )}
              {timerSeconds > 0 && (
                <button
                  onClick={() => { setIsTimerRunning(false); setTimerSeconds(0); }}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                  title="Reiniciar Cronómetro"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={!isSessionEnded}
            onClick={() => {
              if (!isSessionEnded) {
                toast.error('El reporte solo se puede generar cuando termine la sesión.');
                handleOpenCompletionModal();
                return;
              }
              handleDownloadPdf();
            }}
            className={`px-4 py-2.5 rounded-2xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all shadow-sm ${
              !isSessionEnded
                ? 'opacity-40 cursor-not-allowed bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400 select-none'
                : isDarkMode 
                  ? 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10 hover:text-white active:scale-95' 
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 active:scale-95'
            }`}
            title={!isSessionEnded ? "El reporte solo se puede generar cuando termine la sesión" : "Descargar reporte oficial de la sesión en PDF"}
          >
            <FileDown size={15} className={!isSessionEnded ? "text-slate-400" : "text-emerald-500"} />
            <span>Reporte PDF</span>
            {!isSessionEnded && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-slate-400 font-bold lowercase tracking-normal">
                al terminar
              </span>
            )}
          </button>

          <button
            onClick={handleOpenCompletionModal}
            className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            <CheckCircle2 size={16} /> Finalizar Sesión & Reporte IA
          </button>
        </div>
      </div>

      {/* Selector de Modo de Sesión: Reloj Checador (Clock In/Out) vs Espacio de Trabajo vs Validaciones */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setWorkspaceMode('clock_in_out')}
            className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              workspaceMode === 'clock_in_out'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Clock size={15} /> Reloj Checador (Clock In / Out)
          </button>
          <button
            type="button"
            onClick={() => setWorkspaceMode('workspace')}
            className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
              workspaceMode === 'workspace'
                ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Users size={15} /> Sesión de Trabajo & Tareas
          </button>
          {userRole !== 'user' && (
            <button
              type="button"
              onClick={() => setWorkspaceMode('coordinator_validation')}
              className={`py-2 px-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                workspaceMode === 'coordinator_validation'
                  ? 'bg-white dark:bg-zinc-800 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CheckCircle2 size={15} /> Validación de Clock In / Out
              {pendingClockSessions.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendingClockSessions.length}
                </span>
              )}
            </button>
          )}
        </div>

        <div className="text-[11px] font-bold text-slate-400 px-3">
          {workspaceMode === 'clock_in_out' && 'Registro digital con reloj checador'}
          {workspaceMode === 'workspace' && 'Sesión manual / grupal, Kanban y reporte IA'}
          {workspaceMode === 'coordinator_validation' && 'Aprobaciones de servicio social'}
        </div>
      </div>

      {/* MODO RELOJ CHECADOR (CLOCK IN / OUT) */}
      {workspaceMode === 'clock_in_out' && (
        <div className="space-y-6">
          <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500 flex items-center gap-1.5 mb-1">
                  <Sparkles size={13} /> Sistema de Asistencia Digital
                </span>
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                  Reloj Checador Oficial de Servicio Social
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-1">
                  Haz Clock In al iniciar tu jornada y Clock Out al finalizar tus tareas. Tu registro quedará pendiente para validación del coordinador.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-xl text-xs font-bold border flex items-center gap-2 ${isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                  <AlertCircle size={14} /> Validación por coordinador requerida
                </span>
              </div>
            </div>

            <ClockInOutWidget
              student={currentUserStudent}
              projects={projects}
              categories={categories}
              isDarkMode={isDarkMode}
            />
          </div>
        </div>
      )}

      {/* MODO VALIDACIÓN DE COORDINADOR */}
      {workspaceMode === 'coordinator_validation' && userRole !== 'user' && (
        <div className={`p-6 sm:p-8 rounded-3xl border shadow-sm space-y-6 ${isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1.5 mb-1">
                <Clock size={13} /> Panel de Aprobaciones
              </span>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                Validación de Registros Clock In / Out
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Revisa y valida en tiempo real las sesiones reportadas por los estudiantes con el reloj checador digital.
              </p>
            </div>

            {pendingClockSessions.length > 0 && (
              <span className="px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {pendingClockSessions.length} pendientes
              </span>
            )}
          </div>

          {pendingClockSessions.length === 0 ? (
            <div className={`p-12 text-center rounded-2xl border border-dashed ${isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`}>
              <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
              <p className="font-bold text-sm">No hay registros de Clock In / Out pendientes de validación</p>
              <p className="text-xs text-slate-400 mt-1">Todos los registros de los alumnos han sido procesados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingClockSessions.map((session: any) => (
                <div
                  key={session.id}
                  className={`p-5 rounded-2xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-all ${
                    isDarkMode ? 'bg-white/5 border-white/10 hover:border-amber-500/40' : 'bg-slate-50 border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm">{session.studentName}</span>
                      {session.career && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400">
                          {session.career}
                        </span>
                      )}
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
                        <Clock size={11} /> Pendiente Coordinador
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-medium">
                      📅 {session.date} • ⏱️ {session.startTime || '—'} a {session.endTime || '—'} • <strong className="text-emerald-500 font-black">{session.hours} hrs</strong> • 📁 {session.projectName || 'Proyecto'}
                    </p>

                    {session.description && (
                      <p className="text-xs italic text-slate-300 dark:text-slate-300 bg-white/5 p-2 rounded-xl mt-1">
                        "{session.description}"
                      </p>
                    )}

                    {/* Asignación de Evidencia por Coordinación */}
                    <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-white/10 space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                        <Link2 size={12} className="text-emerald-500" /> Enlace de Evidencia Institucional (Asignada por Coordinación)
                      </label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="url"
                          placeholder="https://drive.google.com/... o enlace de evidencia / entregables"
                          value={coordinatorEvidenceLinks[session.id] !== undefined ? coordinatorEvidenceLinks[session.id] : (session.evidenceLink || '')}
                          onChange={e => setCoordinatorEvidenceLinks(prev => ({ ...prev, [session.id]: e.target.value }))}
                          className={`flex-1 px-3 py-1.5 rounded-xl text-xs font-medium border outline-none transition-colors ${
                            isDarkMode ? 'bg-black/30 border-white/10 text-white focus:border-emerald-500' : 'bg-white border-slate-200 text-slate-800 focus:border-emerald-500'
                          }`}
                        />
                        {session.evidenceLink && (
                          <a
                            href={session.evidenceLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg border text-indigo-500 hover:text-indigo-600 transition-colors shrink-0"
                            title="Abrir enlace existente"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => handleApproveClockSession(session)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                    >
                      <Check size={14} /> Validar / Aprobar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRejectClockSession(session)}
                      className="px-3.5 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
                    >
                      <X size={14} /> Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODO ESPACIO DE TRABAJO (KANBAN & ASISTENCIA) */}
      {workspaceMode === 'workspace' && (
        <>
          {/* Parámetros de la Sesión: Menú desplegable color Azul en una sola columna */}
          <div className={`rounded-2xl sm:rounded-3xl border shadow-sm transition-all overflow-hidden ${
            isDarkMode ? 'bg-[#141414] border-blue-500/25' : 'bg-white border-blue-200/90'
          }`}>
            <div 
              onClick={() => setIsConfigOpen(!isConfigOpen)}
              className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
                isDarkMode
                  ? 'bg-gradient-to-r from-blue-950/40 via-indigo-950/20 to-transparent hover:from-blue-950/55'
                  : 'bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white hover:from-blue-100/80'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                  <SlidersHorizontal size={20} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black tracking-tight text-blue-950 dark:text-blue-100 flex items-center gap-2 flex-wrap">
                    <span>Configuración y Parámetros de la Sesión</span>
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                    Categoría, proyecto vinculado al Directorio, sprint activo y etapa del sprint
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Resumen de configuración activa */}
                <div className="hidden md:flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-white dark:bg-white/10 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                    📁 {selectedProject?.name || 'Proyecto'}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                    🏷️ {sessionCategory}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                    ⚡ {projectSprints.find(s => s.id === selectedSprintId)?.name || 'Sprint General'}
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                    🚩 {selectedStageName}
                  </span>
                </div>

                {/* Botones de integración directa con el Directorio de Proyectos */}
                {onOpenProjectWorkspace && selectedProjectId && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProjectWorkspace(selectedProjectId);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
                    title="Abrir el Espacio de Trabajo de este proyecto"
                  >
                    <Briefcase size={13} /> Ir al Proyecto
                  </button>
                )}
                {onOpenProjectDirectory && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenProjectDirectory();
                    }}
                    className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 ${
                      isDarkMode
                        ? 'bg-white/10 hover:bg-white/15 text-blue-200 border-blue-500/30'
                        : 'bg-white hover:bg-blue-50 text-blue-800 border-blue-300 shadow-2xs'
                    }`}
                    title="Ver el Directorio General de Proyectos"
                  >
                    <Layers size={13} /> Directorio Proyectos
                  </button>
                )}

                <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 border border-blue-500/20 flex items-center justify-center text-blue-700 dark:text-blue-300 transition-colors">
                  {isConfigOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
              </div>
            </div>

            {/* Opciones en UNA SOLA COLUMNA */}
            {isConfigOpen && (
              <div className="p-4 sm:p-6 pt-3 border-t border-blue-100 dark:border-white/5 space-y-3.5">
                <div className="grid grid-cols-1 gap-3.5">
                  {/* Selector 1: Categoría de la Sesión */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Layers size={14} className="text-indigo-500" /> Categoría de la Sesión
                      </span>
                    </label>
                    <select
                      value={sessionCategory}
                      onChange={e => setSessionCategory(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none transition-colors ${
                        isDarkMode ? 'bg-[#18181b] border-white/10 text-white focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                      }`}
                    >
                      {DEFAULT_SESSION_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className={isDarkMode ? 'bg-[#18181b]' : ''}>{cat}</option>
                      ))}
                      {categories.map((c: any) => (
                        <option key={c.id || c.name} value={c.name} className={isDarkMode ? 'bg-[#18181b]' : ''}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector 2: Proyecto Vinculado */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Briefcase size={14} className="text-blue-500" /> Proyecto Vinculado (Sincronizado con Directorio de Proyectos)
                      </span>
                      <span className="text-[10px] font-semibold text-blue-500 lowercase">sincronización activa</span>
                    </label>
                    <select
                      value={selectedProjectId}
                      onChange={e => setSelectedProjectId(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none transition-colors ${
                        isDarkMode ? 'bg-[#18181b] border-white/10 text-white focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                      }`}
                    >
                      {projects.map(p => (
                        <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#18181b]' : ''}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector 3: Sprint Activo */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-amber-500" /> Sprint Activo
                      </span>
                    </label>
                    <select
                      value={selectedSprintId}
                      onChange={e => setSelectedSprintId(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none transition-colors ${
                        isDarkMode ? 'bg-[#18181b] border-white/10 text-white focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                      }`}
                    >
                      <option value="" className={isDarkMode ? 'bg-[#18181b]' : ''}>Sprint General</option>
                      {projectSprints.map(s => (
                        <option key={s.id} value={s.id} className={isDarkMode ? 'bg-[#18181b]' : ''}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector 4: Etapa del Sprint */}
                  <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Flag size={14} className="text-rose-500" /> Etapa del Sprint
                      </span>
                    </label>
                    <select
                      value={selectedStageName}
                      onChange={e => setSelectedStageName(e.target.value)}
                      className={`w-full px-4 py-2.5 rounded-xl border text-xs sm:text-sm font-bold outline-none transition-colors ${
                        isDarkMode ? 'bg-[#18181b] border-white/10 text-white focus:border-indigo-500' : 'bg-white border-slate-300 text-slate-900 focus:border-indigo-500'
                      }`}
                    >
                      <option value="Levantamiento / Diagnóstico" className={isDarkMode ? 'bg-[#18181b]' : ''}>Levantamiento / Diagnóstico</option>
                      <option value="Planificación" className={isDarkMode ? 'bg-[#18181b]' : ''}>Planificación</option>
                      <option value="Desarrollo / Ejecución" className={isDarkMode ? 'bg-[#18181b]' : ''}>Desarrollo / Ejecución</option>
                      <option value="Revisión / Validación" className={isDarkMode ? 'bg-[#18181b]' : ''}>Revisión / Validación</option>
                      <option value="Cierre y Entrega" className={isDarkMode ? 'bg-[#18181b]' : ''}>Cierre y Entrega</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Barra de Navegación Rápida entre Secciones con Botón Volver al Inicio */}
          <div className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-2.5 shadow-xs ${
            isDarkMode ? 'bg-[#141414] border-white/10' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setIsKanbanSectionOpen(true);
                  document.getElementById('sec-kanban')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
              >
                <ListTodo size={14} /> Tablero Kanban ({projectTasks.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAttendanceSectionOpen(true);
                  document.getElementById('sec-asistencia')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
              >
                <Users size={14} /> Asistencia ({participants.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRecordingSectionOpen(true);
                  document.getElementById('sec-grabacion')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
              >
                <Mic size={14} /> Grabación & Minuta IA
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsNotesSectionOpen(true);
                  document.getElementById('sec-bitacora')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
              >
                <FileText size={14} /> Bitácora
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const anyOpen = isConfigOpen || isKanbanSectionOpen || isAttendanceSectionOpen || isRecordingSectionOpen || isNotesSectionOpen;
                  const nextState = !anyOpen;
                  setIsConfigOpen(nextState);
                  setIsKanbanSectionOpen(nextState);
                  setIsAttendanceSectionOpen(nextState);
                  setIsRecordingSectionOpen(nextState);
                  setIsNotesSectionOpen(nextState);
                }}
                className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                  isDarkMode
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
                title="Contraer o desplegar todas las secciones"
              >
                <Layers size={13} className="text-indigo-500" />
                <span>{(isConfigOpen || isKanbanSectionOpen || isAttendanceSectionOpen || isRecordingSectionOpen || isNotesSectionOpen) ? 'Contraer Todo' : 'Desplegar Todo'}</span>
              </button>

              {/* Flecha para regresar rápido al inicio */}
              <button
                type="button"
                onClick={scrollToTop}
                title="Regresar rápido al inicio de la página"
                className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                  isDarkMode 
                    ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300 shadow-xs'
                }`}
              >
                <ArrowUp size={14} className="text-indigo-500" />
                <span>Volver al inicio</span>
              </button>
            </div>
          </div>

      {/* Área de Trabajo en Una Sola Columna */}
      <div className="flex flex-col space-y-5 w-full min-w-0">
        
        {/* SECCIÓN 1: Tablero Kanban Dinámico en Sesión */}
        <div id="sec-kanban" className={`rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden w-full min-w-0 transition-all ${isDarkMode ? 'bg-[#141414] border-indigo-500/25' : 'bg-white border-indigo-200/90'}`}>
          <div 
            onClick={() => setIsKanbanSectionOpen(!isKanbanSectionOpen)}
            className={`p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none transition-colors ${
              isDarkMode
                ? 'bg-gradient-to-r from-indigo-950/45 via-violet-950/20 to-transparent hover:from-indigo-950/60'
                : 'bg-gradient-to-r from-indigo-50/90 via-violet-50/40 to-white hover:from-indigo-100/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
                <ListTodo size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-indigo-950 dark:text-indigo-100 flex items-center gap-2">
                    Tablero Kanban en Sesión
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-indigo-600 text-white shadow-2xs flex items-center gap-1">
                    {projectTasks.length} {projectTasks.length === 1 ? 'tarea' : 'tareas'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Sincronizado en tiempo real con el Directorio de Proyectos ({selectedProject?.name || 'proyecto seleccionado'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsNewTaskModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Plus size={15} /> Asignar Tarea / Hito
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsKanbanSectionOpen(!isKanbanSectionOpen);
                }}
                className="p-2 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 border border-indigo-500/20 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-600/20 transition-colors"
                aria-label="Alternar visualización de Kanban"
              >
                <ChevronDown size={18} className={`transition-transform duration-200 ${isKanbanSectionOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {isKanbanSectionOpen && (
            <div className="p-4 sm:p-6 pt-4 space-y-4 border-t border-indigo-100 dark:border-white/5">
              {/* Selector de Pestañas / Píldoras Dinámicas de las 5 Categorías */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                <button
                  onClick={() => setActiveKanbanCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors border ${
                    activeKanbanCategoryFilter === 'all'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Todas las Columnas ({projectTasks.length})
                </button>

                {KANBAN_CATEGORIES.map(col => {
                  const count = projectTasks.filter(t => t.status === col.id).length;
                  const isActive = activeKanbanCategoryFilter === col.id;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setActiveKanbanCategoryFilter(col.id)}
                      className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-colors border flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <col.icon size={13} className={isActive ? 'text-white' : col.color} />
                      <span>{col.title}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Buscador de tareas */}
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filtrar tareas por título, descripción o responsable..."
                  value={taskSearchQuery}
                  onChange={e => setTaskSearchQuery(e.target.value)}
                  className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium outline-none border transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-indigo-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-indigo-500'}`}
                />
              </div>

              {/* Columnas Kanban Dinámicas Expandibles / Colapsables */}
              {isLoadingTasks ? (
                <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin text-indigo-500" /> Sincronizando tablero del proyecto...
                </div>
          ) : (
            <div className="space-y-3">
              {KANBAN_CATEGORIES
                .filter(col => activeKanbanCategoryFilter === 'all' || activeKanbanCategoryFilter === col.id)
                .map(col => {
                  const columnTasks = filteredTasks.filter(t => t.status === col.id);
                  const isCollapsed = !!collapsedColumns[col.id] && activeKanbanCategoryFilter === 'all';

                  return (
                    <div 
                      key={col.id}
                      className={`rounded-2xl border transition-all ${col.border} ${isDarkMode ? 'bg-[#141414]' : 'bg-white'}`}
                    >
                      {/* Cabecera de la Categoría con botón de colapsar/expandir */}
                      <div 
                        onClick={() => toggleColumnCollapse(col.id)}
                        className={`p-3.5 flex items-center justify-between cursor-pointer select-none rounded-2xl ${col.bg}`}
                      >
                        <div className="flex items-center gap-2">
                          <col.icon size={16} className={col.color} />
                          <span className="font-bold text-xs uppercase tracking-wider">{col.title}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDarkMode ? 'bg-white/10 text-white' : 'bg-white text-slate-700 shadow-xs'}`}>
                            {columnTasks.length}
                          </span>
                        </div>

                        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1">
                          {isCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                        </button>
                      </div>

                      {/* Lista de Tareas en la Categoría */}
                      {!isCollapsed && (
                        <div className="p-3 space-y-2.5">
                          {columnTasks.length === 0 ? (
                            <div className="py-4 text-center text-xs text-slate-400 italic">
                              Sin tareas en {col.title}
                            </div>
                          ) : (
                            columnTasks.map(task => {
                              const assignedUids: string[] = Array.from(new Set([
                                ...(task.assignedUsers || []),
                                ...((task as any).assigneeIds || []),
                                ...(task.assignedTo ? [task.assignedTo] : []),
                                ...((task as any).leadAssigneeId ? [(task as any).leadAssigneeId] : [])
                              ].filter(Boolean)));
                              const assignedStudents = assignedUids.map(uid => {
                                const match = students.find(s => 
                                  s.id === uid || 
                                  s.name?.toLowerCase() === uid.toLowerCase() ||
                                  s.fullName?.toLowerCase() === uid.toLowerCase() ||
                                  s.firstName?.toLowerCase() === uid.toLowerCase()
                                );
                                if (match) return match;
                                return { id: uid, name: uid };
                              }).filter(Boolean);

                              return (
                                <div
                                  key={task.id}
                                  className={`p-4 rounded-2xl border shadow-xs transition-all space-y-3 ${
                                    task.isMilestone
                                      ? 'border-indigo-400/50 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-indigo-500/5'
                                      : isDarkMode 
                                        ? 'bg-zinc-900/90 border-zinc-700/80 hover:border-zinc-600' 
                                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {/* Insignia Especial de HITO */}
                                        {task.isMilestone && (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider uppercase bg-indigo-600 text-white shadow-xs">
                                            <Flag size={11} className="fill-current" /> HITO
                                          </span>
                                        )}

                                        {/* Prioridad con contraste reforzado */}
                                        {!task.isMilestone && (
                                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                                            task.priority === 5 ? 'text-red-800 bg-red-100 border-red-300 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800' :
                                            task.priority === 4 ? 'text-amber-900 bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800' :
                                            task.priority === 3 ? 'text-blue-900 bg-blue-100 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800' :
                                            'text-slate-800 bg-slate-200 border-slate-300 dark:bg-zinc-800 dark:text-slate-300 dark:border-zinc-700'
                                          }`}>
                                            {task.priority === 5 ? 'Urgente' : task.priority === 4 ? 'Alta' : task.priority === 3 ? 'Media' : 'Baja'}
                                          </span>
                                        )}

                                        {task.phase && (
                                          <span className={`text-[11px] font-bold ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                            · {task.phase}
                                          </span>
                                        )}
                                      </div>

                                      {/* Título de la tarea: texto negro profundo en modo claro para máxima legibilidad */}
                                      <h4 className={`font-black text-sm sm:text-base leading-snug tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-950'}`}>
                                        {task.title}
                                      </h4>

                                      {/* Descripción con excelente contraste */}
                                      {task.description && (
                                        <p className={`text-xs font-medium leading-relaxed line-clamp-3 ${isDarkMode ? 'text-slate-300' : 'text-slate-800'}`}>
                                          {task.description}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  {/* Asignados y botón directo para editar */}
                                  <div className="pt-2.5 border-t border-slate-200/80 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`text-[11px] font-black uppercase tracking-wider ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                                        Asignados:
                                      </span>
                                      {assignedStudents.length === 0 ? (
                                        <span className={`text-[11px] italic ${isDarkMode ? 'text-slate-500' : 'text-slate-500'}`}>
                                          Sin asignar
                                        </span>
                                      ) : (
                                        assignedStudents.map((st: any) => (
                                          <span 
                                            key={st.id} 
                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold ${isDarkMode ? 'bg-white/10 text-slate-100 border border-white/15' : 'bg-slate-100 text-slate-900 border border-slate-300'}`}
                                            title={st.name}
                                          >
                                            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                                              {(st.name || 'A').charAt(0).toUpperCase()}
                                            </span>
                                            <span className="max-w-[100px] truncate">{st.name?.split(' ')[0]}</span>
                                          </span>
                                        ))
                                      )}

                                      {/* Botón para editar a quién está asignada */}
                                      <button
                                        type="button"
                                        onClick={() => openAssigneeModal(task)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 transition-all active:scale-95 ml-1"
                                        title="Editar a quién está asignada esta tarea"
                                      >
                                        <UserPlus size={11} /> {assignedStudents.length === 0 ? '+ Asignar' : 'Editar'}
                                      </button>
                                    </div>

                                    {/* Botones de acción: Finalizar, Mover de columna y Transferir a otro proyecto */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {/* Transferir a otro proyecto */}
                                      <button
                                        type="button"
                                        onClick={() => openTransferModal(task)}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-white/10 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40 dark:hover:text-indigo-300 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-white/15 transition-all active:scale-95 shadow-2xs"
                                        title="Transferir esta tarea a otro proyecto del sistema"
                                      >
                                        <ArrowRightLeft size={11} className="text-indigo-600 dark:text-indigo-400" /> Transferir
                                      </button>

                                      {/* Finalizar tarea */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTaskToComplete(task);
                                          setIsTaskCompletionModalOpen(true);
                                        }}
                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all active:scale-95 shadow-xs ${
                                          task.status === 'done'
                                            ? 'bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 border border-emerald-500/30'
                                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        }`}
                                        title="Reportar entrega de tarea y registrar horas (individual o grupal)"
                                      >
                                        <CheckCircle2 size={11} /> {task.status === 'done' ? 'Entregada' : 'Finalizar Tarea'}
                                      </button>

                                      {/* Mover estado */}
                                      <select
                                        value={task.status}
                                        onChange={e => handleUpdateTaskStatus(task.id, e.target.value as TaskStatus)}
                                        className={`text-[10px] font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-slate-200' : 'bg-white border-slate-300 text-slate-900'}`}
                                      >
                                        {KANBAN_CATEGORIES.map(c => (
                                          <option key={c.id} value={c.id} className={isDarkMode ? 'bg-zinc-900' : 'bg-white'}>
                                            Mover: {c.title}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
            </div>
          )}
        </div>

        {/* SECCIÓN 2: Control de Asistencia Dual y Clock Out Manual por Alumnx (Menú Desplegable Esmeralda) */}
        <div id="sec-asistencia" className={`rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden w-full min-w-0 transition-all ${isDarkMode ? 'bg-[#141414] border-emerald-500/25' : 'bg-white border-emerald-200/90'}`}>
          <div 
            onClick={() => setIsAttendanceSectionOpen(!isAttendanceSectionOpen)}
            className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
              isDarkMode
                ? 'bg-gradient-to-r from-emerald-950/45 via-teal-950/20 to-transparent hover:from-emerald-950/60'
                : 'bg-gradient-to-r from-emerald-50/90 via-teal-50/40 to-white hover:from-emerald-100/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/20">
                <Users size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-emerald-950 dark:text-emerald-100">
                    Control de Asistencia y Clock Out Individual
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-600 text-white shadow-2xs">
                    {participants.length} {participants.length === 1 ? 'alumnx' : 'alumnxs'}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Toma automática de hora de ingreso manual y Clock Out por alumnx con reporte IA (&lt; 50 palabras)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAddStudentModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
              >
                <UserPlus size={14} /> + Alumnx (Hora Actual)
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAttendanceSectionOpen(!isAttendanceSectionOpen);
                }}
                className="p-2 rounded-xl bg-emerald-600/10 dark:bg-emerald-500/20 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600/20 transition-colors"
                aria-label="Alternar visualización de Asistencia"
              >
                <ChevronDown size={18} className={`transition-transform duration-200 ${isAttendanceSectionOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {isAttendanceSectionOpen && (
            <div className="p-4 sm:p-6 pt-4 space-y-4 border-t border-emerald-100 dark:border-white/5">

            {/* Selector de Modo: Individual vs Grupal */}
            <div className="grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200/80 dark:border-white/10 gap-1 text-[11px] font-black uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setAttendanceViewMode('individual')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  attendanceViewMode === 'individual'
                    ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <User size={13} /> Asistencia Individual & Clock Out
              </button>
              <button
                type="button"
                onClick={() => setAttendanceViewMode('group')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  attendanceViewMode === 'group'
                    ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                }`}
              >
                <Users size={13} /> Asistencia Grupal
              </button>
            </div>

            {/* Panel de Controles Grupales si está en modo grupal */}
            {attendanceViewMode === 'group' && (
              <div className={`p-3.5 rounded-2xl border space-y-3 ${isDarkMode ? 'bg-white/5 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Sparkles size={12} /> Acciones en Bloque
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setParticipants(prev => prev.map(p => ({ ...p, status: 'present' })));
                        toast.success('Todos los alumnos marcados como Presentes');
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-xs"
                    >
                      Todos Presentes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setParticipants(prev => prev.map(p => ({ ...p, status: 'late' })));
                        toast('Todos los alumnos marcados con Retardo', { icon: '⏱️' });
                      }}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-xs"
                    >
                      Todos Retardo
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end pt-1 border-t border-emerald-500/10">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Entrada</label>
                    <input
                      type="time"
                      value={groupStartTime}
                      onChange={e => {
                        setGroupStartTime(e.target.value);
                        setGroupHours(calculateDuration(e.target.value, groupEndTime));
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Salida</label>
                    <input
                      type="time"
                      value={groupEndTime}
                      onChange={e => {
                        setGroupEndTime(e.target.value);
                        setGroupHours(calculateDuration(groupStartTime, e.target.value));
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block mb-1">Horas Totales</label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={groupHours}
                      onChange={e => setGroupHours(parseFloat(e.target.value) || 0)}
                      className={`w-full px-2.5 py-1.5 rounded-xl text-xs font-bold border outline-none ${isDarkMode ? 'bg-black/40 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                    />
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleApplyGroupTime}
                      className="w-full py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-xs"
                    >
                      Aplicar Horario
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de Alumnos en la Sesión */}
            <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
              {participants.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 border border-dashed rounded-2xl">
                  No hay alumnxs asignados a esta sesión. Haz clic en <strong>+ Alumnx (Hora Actual)</strong> para incorporar participantes registrando su hora exacta de entrada.
                </div>
              ) : (
                participants.map((p, idx) => {
                  const studentAssignedTasks = getStudentAssignedTasks(p.studentId, p.name);
                  const reportWordsCount = (p.individualReport || '').trim().split(/\s+/).filter(Boolean).length;

                  return (
                    <div
                      key={p.studentId}
                      className={`p-3.5 rounded-2xl border flex flex-col gap-3 transition-all ${
                        p.isClockedOut
                          ? isDarkMode
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : 'bg-emerald-50/40 border-emerald-300/80 shadow-xs'
                          : isDarkMode
                            ? 'bg-white/5 border-white/10'
                            : 'bg-slate-50 border-slate-200/90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-xl text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs ${
                            p.isClockedOut ? 'bg-emerald-600' : 'bg-indigo-600'
                          }`}>
                            {p.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-xs sm:text-sm font-black truncate leading-tight text-slate-900 dark:text-white">
                                {p.name}
                              </p>
                              {p.addedManuallyAt && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  Ingreso manual: {p.addedManuallyAt}
                                </span>
                              )}
                              {p.isClockedOut && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-600 text-white shadow-2xs flex items-center gap-1">
                                  <CheckCircle2 size={10} /> Clock Out: {p.clockedOutAt || p.endTime}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 flex-wrap mt-0.5">
                              {p.career && (
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{p.career}</p>
                              )}
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                · {studentAssignedTasks.length} {studentAssignedTasks.length === 1 ? 'actividad asignada' : 'actividades asignadas'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                          {/* Selector rápido de estatus individual de asistencia */}
                          <div className="flex items-center bg-slate-200/70 dark:bg-white/10 p-0.5 rounded-lg text-[9px] font-black uppercase">
                            <button
                              type="button"
                              onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, status: 'present' } : x))}
                              className={`px-1.5 py-0.5 rounded-md transition-all ${
                                (p.status || 'present') === 'present'
                                  ? 'bg-emerald-500 text-white shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                              }`}
                              title="Presente"
                            >
                              P
                            </button>
                            <button
                              type="button"
                              onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, status: 'late' } : x))}
                              className={`px-1.5 py-0.5 rounded-md transition-all ${
                                p.status === 'late'
                                  ? 'bg-amber-500 text-white shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                              }`}
                              title="Retardo"
                            >
                              R
                            </button>
                            <button
                              type="button"
                              onClick={() => setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, status: 'excused' } : x))}
                              className={`px-1.5 py-0.5 rounded-md transition-all ${
                                p.status === 'excused'
                                  ? 'bg-blue-500 text-white shadow-xs'
                                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                              }`}
                              title="Falta Justificada"
                            >
                              FJ
                            </button>
                          </div>

                          {/* Botón de Entrada Actual */}
                          <button
                            type="button"
                            onClick={() => handleCheckInLive(p.studentId)}
                            className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-1 ${
                              p.joinedLiveAt 
                                ? 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border border-blue-500/30' 
                                : isDarkMode ? 'bg-white/10 hover:bg-white/15 text-slate-300' : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                            title="Tomar la hora actual como hora de entrada"
                          >
                            <Clock size={11} /> {p.joinedLiveAt ? `Entrada ${p.startTime}` : 'Tomar Entrada'}
                          </button>

                          {/* Botón de Clock Out Manual por Alumnx con Reporte < 50 palabras */}
                          <button
                            type="button"
                            disabled={p.isGeneratingReport}
                            onClick={() => handleManualClockOutStudent(p.studentId)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1 shadow-xs active:scale-95 ${
                              p.isClockedOut
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                            } disabled:opacity-60`}
                            title="Registrar Clock Out manual a la hora actual y generar reporte de menos de 50 palabras con sus actividades asignadas y lo visto en la sesión"
                          >
                            {p.isGeneratingReport ? (
                              <>
                                <Loader2 size={11} className="animate-spin" /> Generando...
                              </>
                            ) : (
                              <>
                                <LogOut size={11} /> {p.isClockedOut ? 'Actualizar Clock Out' : 'Clock Out Manual'}
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setParticipants(prev => prev.filter(x => x.studentId !== p.studentId))}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            title="Eliminar de la sesión"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Actividades asignadas al alumnx en este proyecto */}
                      {studentAssignedTasks.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Actividades asignadas:
                          </span>
                          {studentAssignedTasks.map(t => (
                            <span
                              key={t.id}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                t.status === 'done'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-indigo-50 text-indigo-800 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800'
                              }`}
                            >
                              {t.title}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Inputs de Horario Individual */}
                      <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-slate-200/60 dark:border-white/10">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Hora de Entrada</span>
                          <input
                            type="time"
                            value={p.startTime}
                            onChange={e => {
                              const val = e.target.value;
                              setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, startTime: val, hours: calculateDuration(val, x.endTime) } : x));
                            }}
                            className={`w-full px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                          />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Hora de Salida (Clock Out)</span>
                          <input
                            type="time"
                            value={p.endTime}
                            onChange={e => {
                              const val = e.target.value;
                              setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, endTime: val, hours: calculateDuration(x.startTime, val) } : x));
                            }}
                            className={`w-full px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                          />
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-slate-500 dark:text-slate-400 block mb-0.5">Horas Calculadas</span>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={p.hours}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, hours: val } : x));
                            }}
                            className={`w-full px-2 py-1 rounded-lg text-xs font-bold border outline-none ${isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                          />
                        </div>
                      </div>

                      {/* Reporte Individual de Clock Out (< 50 palabras) */}
                      {(p.isClockedOut || p.individualReport) && (
                        <div className={`p-3 rounded-xl border space-y-2 ${
                          isDarkMode ? 'bg-black/40 border-emerald-500/30' : 'bg-white border-emerald-200 shadow-2xs'
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <Sparkles size={13} className="text-emerald-500" />
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                                Reporte Individual de Clock Out (Actividades Asignadas + Sesión)
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                                reportWordsCount < 50
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                  : 'bg-rose-100 text-rose-800 border-rose-300'
                              }`}>
                                {reportWordsCount} / 49 palabras (&lt; 50)
                              </span>
                              <button
                                type="button"
                                onClick={() => handleManualClockOutStudent(p.studentId)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-colors"
                              >
                                Regenerar IA
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveStudentIndividualReport(p.studentId, p.individualReport || '')}
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                              >
                                Guardar
                              </button>
                            </div>
                          </div>
                          <textarea
                            rows={2}
                            value={p.individualReport || ''}
                            onChange={e => {
                              const val = enforceUnder50WordsClient(e.target.value);
                              setParticipants(prev => prev.map((x, i) => i === idx ? { ...x, individualReport: val } : x));
                            }}
                            placeholder="Reporte de menos de 50 palabras con las actividades asignadas al alumnx y lo visto en la sesión..."
                            className={`w-full p-2.5 rounded-lg text-xs font-medium border outline-none resize-none ${
                              isDarkMode ? 'bg-zinc-900 border-white/10 text-slate-100' : 'bg-slate-50 border-slate-200 text-slate-800'
                            }`}
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            </div>
          )}
        </div>

        {/* SECCIÓN 3: Grabación y Transcripción Presencial con IA (Menú Desplegable Púrpura) */}
        <div id="sec-grabacion" className={`rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden w-full min-w-0 transition-all ${isDarkMode ? 'bg-[#141414] border-purple-500/25' : 'bg-white border-purple-200/90'}`}>
          <div 
            onClick={() => setIsRecordingSectionOpen(!isRecordingSectionOpen)}
            className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
              isDarkMode
                ? 'bg-gradient-to-r from-purple-950/45 via-fuchsia-950/20 to-transparent hover:from-purple-950/60'
                : 'bg-gradient-to-r from-purple-50/90 via-fuchsia-50/40 to-white hover:from-purple-100/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/20">
                <Mic size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-purple-950 dark:text-purple-100">
                    Grabación & Transcripción de Sesión con IA
                  </h3>
                  {isPresencial && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                      Modo Presencial Activo
                    </span>
                  )}
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Captura de audio, transcripción en tiempo real y redacción de minuta ejecutiva con Gemini
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsRecordingSectionOpen(!isRecordingSectionOpen);
                }}
                className="p-2 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 border border-purple-500/20 text-purple-700 dark:text-purple-300 hover:bg-purple-600/20 transition-colors"
                aria-label="Alternar visualización de Grabación"
              >
                <ChevronDown size={18} className={`transition-transform duration-200 ${isRecordingSectionOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {isRecordingSectionOpen && (
            <div className="p-4 sm:p-6 pt-4 border-t border-purple-100 dark:border-white/5">
              <SessionAudioRecorder
                isPresencial={isPresencial}
                isSessionActive={isTimerRunning || timerSeconds > 0}
                onStartSessionRequest={handleStartSession}
                transcription={transcription}
                onTranscriptionChange={setTranscription}
                onAudioRecorded={(url) => setRecordedAudioUrl(url)}
                isDarkMode={isDarkMode}
              />
            </div>
          )}
        </div>

        {/* SECCIÓN 4: Bitácora y Acuerdos de la Sesión */}
        <div id="sec-bitacora" className={`rounded-2xl sm:rounded-3xl border shadow-sm overflow-hidden w-full min-w-0 transition-all ${isDarkMode ? 'bg-[#141414] border-amber-500/25' : 'bg-white border-amber-200/90'}`}>
          <div 
            onClick={() => setIsNotesSectionOpen(!isNotesSectionOpen)}
            className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer select-none transition-colors ${
              isDarkMode
                ? 'bg-gradient-to-r from-amber-950/45 via-orange-950/20 to-transparent hover:from-amber-950/60'
                : 'bg-gradient-to-r from-amber-50/90 via-orange-50/40 to-white hover:from-amber-100/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-600 text-white shadow-sm shadow-amber-500/20">
                <FileText size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight text-amber-950 dark:text-amber-100">
                    Bitácora y Acuerdos de la Sesión
                  </h3>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium">
                  Notas y acuerdos vistos en la sesión (se integran en el reporte individual &lt; 50 palabras y minuta general)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsNotesSectionOpen(!isNotesSectionOpen);
                }}
                className="p-2 rounded-xl bg-amber-600/10 dark:bg-amber-500/20 border border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-600/20 transition-colors"
                aria-label="Alternar visualización de Bitácora"
              >
                <ChevronDown size={18} className={`transition-transform duration-200 ${isNotesSectionOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {isNotesSectionOpen && (
            <div className="p-4 sm:p-6 pt-4 border-t border-amber-100 dark:border-white/5 space-y-2">
              <textarea
                rows={5}
                placeholder="Escribe aquí los acuerdos, temas vistos en la sesión, avances de tareas o dificultades observadas durante la reunión..."
                value={meetingNotes}
                onChange={e => setMeetingNotes(e.target.value)}
                className={`w-full p-4 rounded-xl text-xs sm:text-sm font-medium border outline-none resize-none transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:border-amber-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-amber-500'}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Nueva Tarea / Hito con Asignación de Alumnos */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl max-h-[90vh] overflow-y-auto space-y-4 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/5">
              <div>
                <h3 className="text-lg font-black tracking-tight">Nueva Tarea / Hito</h3>
                <p className="text-xs text-slate-400">Se sincronizará en tiempo real con el proyecto</p>
              </div>
              <button 
                onClick={() => setIsNewTaskModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Título de la Tarea *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Modelado 3D de fachada o Levantamiento de cotas"
                  value={newTaskForm.title}
                  onChange={e => setNewTaskForm({ ...newTaskForm, title: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Descripción del Trabajo
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles técnicos, especificaciones y criterios de aceptación..."
                  value={newTaskForm.description}
                  onChange={e => setNewTaskForm({ ...newTaskForm, description: e.target.value })}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none resize-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              {/* Responsable: Coordinador o Alumno */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Responsable Principal (Coordinador o Alumno) *
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setNewTaskForm(prev => ({
                      ...prev,
                      assigneeRole: 'coordinador',
                      assigneeId: currentUser?.uid || 'coord',
                      assigneeName: currentUser?.displayName || 'Coordinador',
                      assignedUsers: [currentUser?.uid || 'coord']
                    }))}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      newTaskForm.assigneeRole === 'coordinador'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>👑 Coordinador</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const firstStudent = activeStudents[0];
                      setNewTaskForm(prev => ({
                        ...prev,
                        assigneeRole: 'alumno',
                        assigneeId: firstStudent ? firstStudent.id : '',
                        assigneeName: firstStudent ? firstStudent.name : 'Alumno',
                        assignedUsers: firstStudent ? [firstStudent.id] : []
                      }));
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                      newTaskForm.assigneeRole === 'alumno'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : isDarkMode ? 'bg-white/5 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>🎓 Alumno / Prestador</span>
                  </button>
                </div>

                {newTaskForm.assigneeRole === 'coordinador' ? (
                  <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                    isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                  }`}>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-black flex items-center justify-center">
                        LE
                      </div>
                      <span>{currentUser?.displayName || 'Luis Edgar (Coordinador)'}</span>
                    </div>
                    <span className="text-[10px] font-bold text-indigo-400 uppercase">Asignado</span>
                  </div>
                ) : (
                  <div>
                    <select
                      value={newTaskForm.assigneeId}
                      onChange={e => {
                        const std = activeStudents.find(s => s.id === e.target.value);
                        if (std) {
                          setNewTaskForm(prev => ({
                            ...prev,
                            assigneeId: std.id,
                            assigneeName: std.name,
                            assignedUsers: [std.id]
                          }));
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                        isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                      }`}
                    >
                      {activeStudents.map(s => (
                        <option key={s.id} value={s.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                          🎓 {s.name} {s.career ? `(${s.career})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Selector de Prioridad con Opción de HITO */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Prioridad *
                  </label>
                  <select
                    value={newTaskForm.priority}
                    onChange={e => setNewTaskForm({ ...newTaskForm, priority: e.target.value as any })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${
                      newTaskForm.priority === 'milestone'
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                        : isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <option value="low" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Baja</option>
                    <option value="medium" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Media</option>
                    <option value="high" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Alta</option>
                    <option value="urgent" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Urgente</option>
                    <option value="milestone" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>⚑ HITO (Milestone)</option>
                  </select>
                </div>

                {/* Estado inicial */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Estado Inicial
                  </label>
                  <select
                    value={newTaskForm.status}
                    onChange={e => setNewTaskForm({ ...newTaskForm, status: e.target.value as TaskStatus })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                  >
                    {KANBAN_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{c.title}</option>
                    ))}
                  </select>
                </div>

                {/* Vencimiento */}
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Vencimiento
                  </label>
                  <input
                    type="date"
                    value={newTaskForm.dueDate}
                    onChange={e => setNewTaskForm({ ...newTaskForm, dueDate: e.target.value })}
                    className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold outline-none ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              {/* Archivos / Evidencias */}
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Archivo / Evidencia Adjunta (Opcional)
                </label>
                <div className="relative">
                  <FileText size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Nombre del archivo o link (ej. Reporte_inicial.pdf, enlace Google Drive)..."
                    value={newTaskForm.attachmentName}
                    onChange={e => setNewTaskForm({ ...newTaskForm, attachmentName: e.target.value })}
                    className={`w-full pl-9 pr-3.5 py-2.5 rounded-xl border text-xs font-medium outline-none ${
                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${isDarkMode ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20"
                >
                  Guardar y Sincronizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Agregar Alumno a la Sesión (Toma automáticamente la hora actual) */}
      {isAddStudentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl max-h-[85vh] flex flex-col space-y-4 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/5">
              <div>
                <h3 className="text-lg font-black tracking-tight">Incorporar Alumnx a la Sesión</h3>
                <p className="text-xs text-slate-400">
                  Se registrará automáticamente la hora actual de ingreso y se vinculará al proyecto
                </p>
              </div>
              <button 
                onClick={() => setIsAddStudentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por nombre o carrera..."
                value={studentSearchTerm}
                onChange={e => setStudentSearchTerm(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 rounded-xl text-xs font-medium outline-none border ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {activeStudents
                .filter(s => {
                  const alreadyAdded = participants.some(p => p.studentId === s.id);
                  if (alreadyAdded) return false;
                  if (studentSearchTerm.trim()) {
                    const q = studentSearchTerm.toLowerCase();
                    return (s.name || '').toLowerCase().includes(q) || (s.career || '').toLowerCase().includes(q);
                  }
                  return true;
                })
                .map(student => (
                  <div
                    key={student.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}
                  >
                    <div>
                      <p className="text-xs font-bold">{student.name}</p>
                      <p className="text-[10px] text-slate-400">{student.career || 'Sin carrera asignada'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAddManualStudent(student)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 flex items-center gap-1"
                    >
                      <Clock size={12} /> + Agregar ({new Date().toTimeString().slice(0, 5)})
                    </button>
                  </div>
                ))}
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex justify-end">
              <button
                onClick={() => setIsAddStudentModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-white/10"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Horario Grupal */}
      {isGroupTimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl space-y-4 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-3 border-slate-100 dark:border-white/5">
              <h3 className="text-base font-black tracking-tight">Aplicar Horario en Grupo</h3>
              <button onClick={() => setIsGroupTimeModalOpen(false)} className="p-1 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Hora de Entrada
                </label>
                <input
                  type="time"
                  value={groupStartTime}
                  onChange={e => setGroupStartTime(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Hora de Salida
                </label>
                <input
                  type="time"
                  value={groupEndTime}
                  onChange={e => setGroupEndTime(e.target.value)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Horas Totales a Acreditar
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={groupHours}
                  onChange={e => setGroupHours(parseFloat(e.target.value) || 0)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-white/5">
              <button
                onClick={() => setIsGroupTimeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:bg-white/5"
              >
                Cancelar
              </button>
              <button
                onClick={handleApplyGroupTime}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20"
              >
                Aplicar a Todos
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* MODAL DE CIERRE, REPORTE Y RESUMEN IA (~100 PALABRAS) */}
      {isCompletionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-3xl p-6 sm:p-8 border shadow-2xl max-h-[92vh] overflow-y-auto space-y-6 ${isDarkMode ? 'bg-[#181818] border-white/10' : 'bg-white border-slate-200'}`}>
            <div className="flex items-center justify-between border-b pb-4 border-slate-100 dark:border-white/5">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <CheckCircle2 size={22} className="text-emerald-500" /> Cierre de Sesión y Reporte IA
                </h3>
                <p className="text-xs text-slate-400">
                  Generación de resumen institucional y distribución individual en Firestore
                </p>
              </div>
              <button 
                onClick={() => setIsCompletionModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            {/* Resumen Métrico de la Sesión */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-3.5 rounded-2xl border text-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Alumnos</span>
                <span className="text-xl font-black text-indigo-500">{participants.length}</span>
              </div>
              <div className={`p-3.5 rounded-2xl border text-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Horas Totales</span>
                <span className="text-xl font-black text-emerald-500">
                  {participants.reduce((acc, p) => acc + (p.hours || 0), 0)}h
                </span>
              </div>
              <div className={`p-3.5 rounded-2xl border text-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tareas Hechas</span>
                <span className="text-xl font-black text-blue-500">
                  {projectTasks.filter(t => t.status === 'done').length}
                </span>
              </div>
              <div className={`p-3.5 rounded-2xl border text-center ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Hitos Logrados</span>
                <span className="text-xl font-black text-purple-500">
                  {projectTasks.filter(t => t.isMilestone && t.status === 'done').length}
                </span>
              </div>
            </div>

            {/* Generador de Resumen con IA (~100 palabras) y Minuta Detallada */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <label className="text-xs font-black uppercase tracking-wider">
                    Minuta y Resumen Generados con IA
                  </label>
                  {wordCount > 0 && activeMinuteTab === 'summary' && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      wordCount >= 85 && wordCount <= 115 
                        ? 'bg-emerald-500/20 text-emerald-400' 
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {wordCount} palabras
                    </span>
                  )}
                  {transcription.trim().length > 15 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                      <Mic size={11} /> Transcripción presencial ({transcription.trim().split(/\s+/).length} palabras)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleGenerateAiSummary}
                  disabled={isGeneratingAi}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-purple-600/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isGeneratingAi ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Procesando con Gemini...
                    </>
                  ) : (
                    <>
                      <Sparkles size={13} /> Generar Resumen & Minuta con IA
                    </>
                  )}
                </button>
              </div>

              {/* Selector de Pestañas de Minuta */}
              <div className="flex items-center gap-1.5 border-b border-slate-200/80 dark:border-white/10 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveMinuteTab('summary')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeMinuteTab === 'summary'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText size={13} /> Resumen Oficial (~100 palabras)
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMinuteTab('minute')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeMinuteTab === 'minute'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles size={13} /> Minuta Detallada IA
                  {detailedMinute && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveMinuteTab('transcript')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    activeMinuteTab === 'transcript'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : isDarkMode ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Mic size={13} /> Audio & Transcripción
                  {transcription.trim() && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20">
                      {transcription.trim().split(/\s+/).length}
                    </span>
                  )}
                </button>
              </div>

              {/* Pestaña 1: Resumen Oficial (~100 palabras) */}
              {activeMinuteTab === 'summary' && (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    placeholder="Presiona 'Generar Resumen & Minuta con IA' para que Gemini sintetice la sesión y la transcripción presencial, o redáctalo manualmente..."
                    value={aiSummary}
                    onChange={e => setAiSummary(e.target.value)}
                    className={`w-full p-4 rounded-2xl text-xs font-medium border leading-relaxed outline-none resize-none transition-colors ${
                      isDarkMode 
                        ? 'bg-white/5 border-white/10 text-white focus:border-purple-500' 
                        : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-purple-500'
                    }`}
                  />
                  <p className="text-[11px] text-slate-400 italic">
                    * Este resumen oficial se registrará en el expediente de servicio social de cada uno de los {participants.length} alumnos y en el reporte PDF.
                  </p>
                </div>
              )}

              {/* Pestaña 2: Minuta Detallada IA con Puntos Clave */}
              {activeMinuteTab === 'minute' && (
                <div className="space-y-3">
                  {detailedMinute ? (
                    <div className="space-y-3">
                      {/* Temas Tratados */}
                      {detailedMinute.topicsDiscussed?.length > 0 && (
                        <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                          <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                            <FileText size={12} /> Temas Abordados y Discusión Presencial
                          </p>
                          <ul className="space-y-1.5">
                            {detailedMinute.topicsDiscussed.map((topic, i) => (
                              <li key={i} className="text-xs text-slate-300 dark:text-slate-300 flex items-start gap-2">
                                <span className="text-indigo-400 font-bold">•</span>
                                <span>{topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Acuerdos y Compromisos */}
                      {detailedMinute.agreements?.length > 0 && (
                        <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/50 border-emerald-200'}`}>
                          <p className="text-[10px] font-black uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                            <CheckCircle2 size={12} /> Acuerdos y Compromisos Adquiridos
                          </p>
                          <ul className="space-y-1.5">
                            {detailedMinute.agreements.map((agr, i) => (
                              <li key={i} className="text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
                                <span className="text-emerald-500 font-bold">{i + 1}.</span>
                                <span>{agr}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Próximos Pasos */}
                      {detailedMinute.nextSteps?.length > 0 && (
                        <div className={`p-3.5 rounded-2xl border space-y-2 ${isDarkMode ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-200'}`}>
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                            <Flag size={12} /> Próximos Pasos y Entregables del Sprint
                          </p>
                          <ul className="space-y-1.5">
                            {detailedMinute.nextSteps.map((step, i) => (
                              <li key={i} className="text-xs text-slate-800 dark:text-slate-200 flex items-start gap-2">
                                <span className="text-amber-500 font-bold">•</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Texto Completo de la Minuta (Se integrará en el PDF)
                        </label>
                        <textarea
                          rows={4}
                          value={detailedMinute.fullMinuteText}
                          onChange={e => setDetailedMinute({ ...detailedMinute, fullMinuteText: e.target.value })}
                          className={`w-full p-3 rounded-xl text-xs font-mono border leading-relaxed outline-none ${
                            isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={`p-6 text-center rounded-2xl border border-dashed space-y-2 ${
                      isDarkMode ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'
                    }`}>
                      <Sparkles size={28} className="mx-auto text-purple-400" />
                      <p className="text-xs font-bold">Aún no se ha generado la minuta detallada con IA</p>
                      <p className="text-[11px] text-slate-400">
                        Haz clic en <strong>"Generar Resumen & Minuta con IA"</strong> para procesar la transcripción y las actividades del sprint.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Pestaña 3: Audio y Transcripción Presencial */}
              {activeMinuteTab === 'transcript' && (
                <div className="space-y-3">
                  {recordedAudioUrl && (
                    <div className={`p-3 rounded-2xl border flex items-center gap-3 ${
                      isDarkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-200'
                    }`}>
                      <Volume2 size={16} className="text-indigo-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-500 mb-1">
                          Audio Registrado de la Sesión Presencial
                        </p>
                        <audio src={recordedAudioUrl} controls className="w-full h-8 outline-none" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                      <span>Transcripción de Audio de la Sesión</span>
                      <span>{transcription.trim() ? `${transcription.trim().split(/\s+/).length} palabras` : 'Vacía'}</span>
                    </label>
                    <textarea
                      rows={6}
                      value={transcription}
                      onChange={e => setTranscription(e.target.value)}
                      placeholder="Transcripción de la reunión presencial. Si no utilizaste el micrófono, puedes pegar notas adicionales aquí..."
                      className={`w-full p-3 rounded-xl text-xs font-mono border leading-relaxed outline-none resize-y ${
                        isDarkMode ? 'bg-black/30 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-800'
                      }`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Evidencia Adjunta */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Enlace de Evidencia (Google Drive, Acta o Fotografías)
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/..."
                value={evidenceUrl}
                onChange={e => setEvidenceUrl(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-medium border outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className={`w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 border transition-all active:scale-95 shadow-sm ${
                  isDarkMode 
                    ? 'bg-white/5 border-white/10 text-indigo-300 hover:bg-white/10 hover:border-indigo-500/50' 
                    : 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                }`}
                title="Descargar reporte oficial en formato PDF"
              >
                <FileDown size={15} /> Descargar Reporte PDF
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setIsCompletionModalOpen(false)}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold ${isDarkMode ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-600'}`}
                >
                  Volver a la Sesión
                </button>

                <button
                  type="button"
                  onClick={handleSaveAndDistributeRecords}
                  disabled={isSubmittingBatch || !aiSummary.trim()}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/20 disabled:opacity-50 transition-all active:scale-95"
                >
                  {isSubmittingBatch ? (
                    <>
                      <Loader2 size={15} className="animate-spin" /> Asentando en Firestore...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={16} /> Asentar, Distribuir & Descargar PDF ({participants.length} alumnos)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Transferir Tarea a otro Proyecto */}
      {isTransferModalOpen && taskToTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-5 ${isDarkMode ? 'bg-[#18181b] border-zinc-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <ArrowRightLeft size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Transferir Tarea</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Mover a otro espacio de proyecto</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTransferModalOpen(false);
                  setTaskToTransfer(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen de la tarea a mover */}
            <div className={`p-4 rounded-2xl border space-y-1.5 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tarea seleccionada:</span>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{taskToTransfer.title}</p>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <Folder size={13} className="text-indigo-500" />
                <span>Proyecto actual: <strong>{selectedProject?.name || 'Actual'}</strong></span>
              </div>
            </div>

            {/* Selector de proyecto destino */}
            <div className="space-y-2">
              <label className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <FolderKanban size={14} className="text-indigo-500" /> Selecciona el Proyecto Destino *
              </label>
              <select
                value={targetTransferProjectId}
                onChange={e => setTargetTransferProjectId(e.target.value)}
                className={`w-full p-3.5 rounded-2xl border font-bold text-sm outline-none transition-all cursor-pointer ${
                  isDarkMode 
                    ? 'bg-zinc-800 border-zinc-700 text-white focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                }`}
              >
                {projects
                  .filter(p => p.id !== selectedProjectId)
                  .map(p => (
                    <option key={p.id} value={p.id} className={isDarkMode ? 'bg-zinc-800' : 'bg-white'}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                La tarea se reasignará al nuevo proyecto y se reflejará en tiempo real en todas sus vistas (Tablas, Kanban, Gantt y Resumen).
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsTransferModalOpen(false);
                  setTaskToTransfer(null);
                }}
                className="flex-1 py-3 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-black uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-slate-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isTransferring || !targetTransferProjectId}
                onClick={handleTransferTask}
                className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTransferring ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Transfiriendo...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft size={14} /> Confirmar Transferencia
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Editar Asignados de la Tarea */}
      {isAssigneeModalOpen && taskToEditAssignees && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className={`w-full max-w-lg rounded-3xl p-6 border shadow-2xl space-y-5 max-h-[90vh] flex flex-col ${isDarkMode ? 'bg-[#18181b] border-zinc-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-white/10 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <UserPlus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Editar Asignados</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Gestiona quiénes tienen asignada esta tarea</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssigneeModalOpen(false);
                  setTaskToEditAssignees(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Resumen de la tarea */}
            <div className={`p-3.5 rounded-2xl border shrink-0 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tarea:</span>
              <p className="text-sm font-black text-slate-900 dark:text-white leading-snug">{taskToEditAssignees.title}</p>
            </div>

            {/* Buscador de alumnos */}
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={15} />
              <input
                type="text"
                placeholder="Buscar por nombre o correo..."
                value={assigneeSearchTerm}
                onChange={e => setAssigneeSearchTerm(e.target.value)}
                className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-medium outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-zinc-800 border-zinc-700 text-white focus:border-indigo-500' 
                    : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-indigo-500'
                }`}
              />
            </div>

            {/* Lista de Prestadores / Alumnos con checkbox */}
            <div className="space-y-1.5 overflow-y-auto max-h-[280px] pr-1 flex-1 custom-scrollbar">
              {students
                .filter(s => {
                  if (s.isArchived) return false;
                  if (!assigneeSearchTerm.trim()) return true;
                  const query = assigneeSearchTerm.toLowerCase();
                  const name = (s.name || `${s.firstName || ''} ${s.lastNamePaterno || ''}`).toLowerCase();
                  const email = (s.email || '').toLowerCase();
                  return name.includes(query) || email.includes(query);
                })
                .map(st => {
                  const displayName = st.name || `${st.firstName || ''} ${st.lastNamePaterno || ''}`.trim() || 'Alumno';
                  const isAssigned = selectedAssigneeIds.includes(st.id) || selectedAssigneeIds.some(id => id.toLowerCase() === displayName.toLowerCase());
                  const isLead = selectedAssigneeIds[0] === st.id || selectedAssigneeIds[0]?.toLowerCase() === displayName.toLowerCase();

                  return (
                    <div
                      key={st.id}
                      onClick={() => toggleAssignee(st.id, displayName)}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                        isAssigned
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                          : isDarkMode
                          ? 'bg-zinc-800/50 border-zinc-700/80 hover:bg-zinc-800'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                          isAssigned ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-300 text-slate-700 dark:bg-zinc-700 dark:text-zinc-200'
                        }`}>
                          {displayName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-black truncate ${isAssigned ? 'text-indigo-950 dark:text-indigo-200' : 'text-slate-800 dark:text-slate-200'}`}>
                            {displayName}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {st.email || st.career || 'Servicio Social'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isLead && (
                          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                            Líder
                          </span>
                        )}
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all ${
                          isAssigned 
                            ? 'bg-indigo-600 border-indigo-600 text-white' 
                            : 'border-slate-300 dark:border-zinc-600 bg-white dark:bg-zinc-800'
                        }`}>
                          {isAssigned && <Check size={13} strokeWidth={3} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/80 dark:border-white/10 shrink-0">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                {selectedAssigneeIds.length} seleccionado{selectedAssigneeIds.length !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssigneeModalOpen(false);
                    setTaskToEditAssignees(null);
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-white/10 text-xs font-black uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-all text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingAssignees}
                  onClick={handleSaveAssignees}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSavingAssignees ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Guardando...
                    </>
                  ) : (
                    <>
                      <Check size={14} /> Guardar Asignación
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Reportar Tarea Finalizada en Sesión con Horas Indiv/Grupales */}
      <TaskCompletionModal
        isOpen={isTaskCompletionModalOpen}
        onClose={() => {
          setIsTaskCompletionModalOpen(false);
          setTaskToComplete(null);
        }}
        task={taskToComplete}
        projectId={selectedProjectId}
        projectName={selectedProject?.name || ''}
        activeStudents={activeStudents}
        sessionDate={sessionDate}
        isDarkMode={isDarkMode}
        onTaskCompleted={handleTaskCompletionSuccess}
      />
    </div>
  );
};

export default SessionWorkspace;
