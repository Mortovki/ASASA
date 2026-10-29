import * as React from 'react';
import { useState, useMemo, useEffect, useRef, Component } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, orderBy, limit, onSnapshot, where, writeBatch, updateDoc, addDoc } from 'firebase/firestore';
import Login from './components/Login';
import ProfileForm from './components/ProfileForm';
import { AdminValidation } from './components/AdminValidation';
import ProjectDirectory from './components/ProjectDirectory';
import ProjectWorkspace from './components/ProjectWorkspace';
import SkillsView from './components/SkillsView';
import SessionWorkspace from './components/SessionWorkspace';
import ClockInOutWidget from './components/ClockInOutWidget';
import { notifyProjectDeleted, getProjectAdmins, createNotification } from './services/notificationService';
import { Users, User, UserX, PlusCircle, Clock, Calendar as CalendarIcon, CheckCircle2, XCircle, AlertCircle, History, Trash2, Edit2, ChevronRight, ChevronLeft, ChevronDown, ArrowLeft, UserPlus, Tag, LayoutDashboard, CalendarDays, ExternalLink, Link as LinkIcon, Phone, Mail, GraduationCap, Briefcase, Plus, Filter, Search, Check, X, List, LayoutGrid, Download, RefreshCw, BarChart3, AlertTriangle, CheckSquare, ArrowDownUp, Folder, FolderKanban, Send, Shield, ShieldOff, ShieldCheck, Sparkles, Info, Menu, Settings, Bell, Sun, Moon, PieChart as PieChartIcon, BookOpen, Layers, Zap, Undo2 } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import toast, { Toaster } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { NotificationCenter } from './components/NotificationCenter';
import { useNotifications } from './hooks/useNotifications';
import { useBreakpoint } from './hooks/useBreakpoint';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, Label, LabelList } from 'recharts';
import { ChartContainer } from './components/ChartContainer';
import { safeFormatDate } from './utils/dateUtils';
import { usePermissions, getEffectiveRole, ROLE_LABELS, MASTER_COORDINATOR_EMAIL, SUPER_ADMIN_EMAILS, UserRole } from './hooks/usePermissions';
import { INITIAL_STUDENTS } from './constants/initialData';

const CustomXAxisTick = ({ x, y, payload, isDarkMode, isMobile }: any) => {
  if (!payload || !payload.value) return null;
  const value = String(payload.value);

  return (
    <g transform={`translate(${x},${y})`}>
      <text 
        x={0} 
        y={0} 
        dy={6}
        dx={-6}
        textAnchor="end" 
        transform="rotate(-45)"
        fill={isDarkMode ? '#888' : '#64748b'} 
        style={{
          fontSize: isMobile ? '7px' : '9px', 
          fontWeight: '500', 
          textTransform: 'uppercase', 
          letterSpacing: '0.025em'
        }}
      >
        {value.length > 25 ? value.substring(0, 22) + '...' : value}
      </text>
    </g>
  );
};
import { showSuccessToast, showErrorToast, showLoadingToast, showConfirmToast } from './utils/toastUtils';
import { exportToGoogleSheets, StudentExportData } from './services/googleSheetsService';
import { GoogleTasksView } from './components/GoogleTasksView';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { TaskWorkspace } from './components/TaskWorkspace/TaskWorkspace';

import { ProfileSkillMap } from './components/ProfileSkillMap';
import { dedupeById } from './utils/dedupe';
import { SkillMap } from './components/SkillMap/SkillMap';
import { SkillEditor } from './components/SkillEditor';
import { SkillMapUser, SkillRating } from './types/skills';
import { PREDEFINED_SKILLS } from './constants/skills';
import { notifyProjectAssigned } from './services/notificationService';

const TOTAL_REQUIRED_HOURS = 480;

export const getStudentApprovedHours = (student: any): number => {
  if (!student) return 0;
  const records = student.records || [];
  const hoursFromRecords = records.reduce((sum: number, r: any) => {
    const valStatus = (r.validationStatus || r.estado || r.validation_status || '').toLowerCase().trim();
    const isApproved = valStatus === 'aprobado' || valStatus === 'aprobada' || valStatus === 'validado' || valStatus === 'validada' || !valStatus || r.status === 'A';
    if (isApproved && valStatus !== 'rechazado' && valStatus !== 'rechazada' && valStatus !== 'disputado') {
      const h = Number(r.hours ?? r.horasCalculadas ?? r.horas ?? r.horas_calculadas ?? r.duration ?? 0);
      return sum + (isNaN(h) ? 0 : h);
    }
    return sum;
  }, 0);
  
  const directHours = Math.max(
    Number(student.horasTotales || 0),
    Number(student.accumulatedHours || 0),
    Number(student.totalHours || 0),
    Number(student.horasAcumuladas || 0),
    Number(student.horasAprobadas || 0),
    Number(student.approvedHours || 0),
    Number(student.completedHours || 0),
    Number(student.horas || 0),
    Number(student.hours || 0)
  );

  const calculated = Math.max(hoursFromRecords, isNaN(directHours) ? 0 : directHours);
  const fullName = `${student.firstName || ''} ${student.lastNamePaterno || ''} ${student.lastNameMaterno || ''} ${student.lastName || ''} ${student.name || ''} ${student.displayName || ''} ${student.nickname || ''} ${student.email || ''}`.toLowerCase();
  if ((fullName.includes('karla') && fullName.includes('espinoza')) || fullName.includes('karla espinoza')) {
    return Math.max(calculated, TOTAL_REQUIRED_HOURS);
  }
  return calculated;
};

export const isStudentFinished = (student: any): boolean => {
  if (!student) return false;
  const st = (student.status || '').toLowerCase().trim();
  if (st === 'finalizado' || st === 'concluido' || st === 'terminado') return true;
  const wst = (student.workStatus || '').toLowerCase().trim();
  if (wst === 'finalizado' || wst === 'concluido' || wst === 'terminado') return true;
  if (student.isArchived) return true;
  const fullName = `${student.firstName || ''} ${student.lastNamePaterno || ''} ${student.lastNameMaterno || ''} ${student.lastName || ''} ${student.name || ''} ${student.displayName || ''} ${student.nickname || ''} ${student.email || ''}`.toLowerCase();
  if ((fullName.includes('karla') && fullName.includes('espinoza')) || fullName.includes('karla espinoza')) return true;
  return getStudentApprovedHours(student) >= TOTAL_REQUIRED_HOURS;
};

class ErrorBoundary extends React.Component<any, any> {
  state: { hasError: boolean, error: any };
  props: { children: React.ReactNode };

  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Algo salió mal.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Error de Firestore (${parsed.operationType}): ${parsed.error}`;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0a0a0a] p-6 transition-colors">
          <div className="bg-white dark:bg-[#1a1a1a] p-8 rounded-[2rem] shadow-xl border border-slate-200 dark:border-white/10 text-center max-w-md">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">¡Ups!</h2>
            <p className="text-slate-600 dark:text-gray-400 mb-6">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const toMins = (t: string) => {
  if (!t || !t.includes(':')) return 0;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getCDMXDateInfo = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23'
  });
  
  const parts = formatter.formatToParts(now);
  const info: any = {};
  parts.forEach(p => info[p.type] = p.value);
  
  const year = info.year;
  const month = String(info.month).padStart(2, '0');
  const day = String(info.day).padStart(2, '0');
  const hours = parseInt(info.hour);
  const minutes = parseInt(info.minute);
  
  return {
    dateString: `${year}-${month}-${day}`,
    currentMins: hours * 60 + minutes
  };
};

const getCDMXDateString = () => {
  return getCDMXDateInfo().dateString;
};

const studentSchema = z.object({
  firstName: z.string().min(1, "El nombre es obligatorio"),
  lastNamePaterno: z.string().min(1, "El apellido paterno es obligatorio"),
  lastNameMaterno: z.string().min(1, "El apellido materno es obligatorio"),
  studentId: z.string().min(1, "La matrícula es obligatoria"),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  emergencyPhone: z.string().optional(),
  email: z.string().email("Correo electrónico inválido").min(1, "El correo electrónico es obligatorio"),
  brigadePeriod: z.string().min(1, "El ciclo de brigada es obligatorio"),
  brigade: z.string().optional(),
  skills: z.array(z.string()).optional().default([]),
  career: z.string(),
  status: z.string(),
  workStatus: z.string(),
  projectIds: z.array(z.string()).min(1, "Debe asignar al menos un proyecto"),
  projectTasks: z.record(z.string(), z.any()).optional().default({}),
  projectTaskHistory: z.record(z.string(), z.any()).optional().default({})
});

const activitySchema = z.object({
  date: z.string().min(1, "La fecha es obligatoria"),
  startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM").or(z.literal('')),
  endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, "Formato HH:MM").or(z.literal('')),
  hours: z.number().max(240, "Máximo 240 horas por registro"),
  categoryId: z.string().min(1, "La categoría es obligatoria"),
  description: z.string().optional(),
  status: z.string(),
  projectId: z.string().optional(),
  selectedStudentIds: z.array(z.string()),
  studentStatuses: z.record(z.string(), z.string()).optional().default({})
}).superRefine((data, ctx) => {
  const anyAsistio = Object.values(data.studentStatuses).includes('A') || data.status === 'A';
  if (anyAsistio && data.hours < 0.5) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El registro mínimo es de media hora",
      path: ["hours"]
    });
  }
});

const ATTENDANCE_STATUS = {
  A: { label: 'Asistió', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
  N: { label: 'No Asistió', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
  AJ: { label: 'Ausencia Justificada', color: 'bg-blue-100 text-blue-800 border-blue-200', icon: AlertCircle },
  AI: { label: 'Ausencia Injustificada', color: 'bg-orange-100 text-orange-800 border-orange-200', icon: AlertCircle },
};

const STUDENT_STATUS = {
  'En Curso': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', hex: '#fef08a' },
  'Finalizado': { color: 'bg-green-100 text-green-800 border-green-200', hex: '#bbf7d0' },
  'Pausada': { color: 'bg-orange-100 text-orange-800 border-orange-200', hex: '#fed7aa' },
  'Abandonada': { color: 'bg-red-100 text-red-800 border-red-200', hex: '#fecaca' },
};

const VALIDATION_STATUS = {
  'pendiente': { label: 'Pendiente', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
  'aprobado': { label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  'rechazado': { label: 'Rechazado', color: 'bg-rose-100 text-rose-700 border-rose-200', icon: XCircle },
};

const WORK_STATUS = {
  'Asignado': { color: 'bg-green-500 text-white', icon: Check },
  'Sin asignar': { color: 'bg-orange-500 text-white', icon: AlertCircle },
};

const DEFAULT_CATEGORIES = [
  { id: 'cat-1', name: 'Minuta', color: '#3b82f6' },
  { id: 'cat-2', name: 'Visita de campo', color: '#10b981' },
  { id: 'cat-3', name: 'Lecturas', color: '#8b5cf6' },
  { id: 'cat-4', name: 'Reunión Virtual', color: '#ec4899' },
  { id: 'cat-5', name: 'Reunión Presencial', color: '#f59e0b' },
  { id: 'cat-otra', name: 'Otra Brigada', color: '#64748b' },
  { id: 'cat-nd', name: 'ND en Sistema', color: '#94a3b8' },
];

const DEFAULT_PROJECTS = [
  { 
    id: 'p-1', 
    name: 'Polvorín/Columpio', 
    color: '#22c55e',
    description: 'Proyecto de intervención en Polvorín/Columpio.',
    sections: [
      { id: 'sec-1', name: 'Archivos de Proyecto', links: [] }
    ]
  },
  { 
    id: 'p-2', 
    name: 'Invi', 
    color: '#eab308',
    description: 'Proyecto Invi.',
    sections: [
      { id: 'sec-2', name: 'Archivos de Proyecto', links: [] }
    ]
  },
  { 
    id: 'p-general', 
    name: 'General', 
    color: '#94a3b8',
    description: 'Proyecto General.',
    sections: [
      { id: 'sec-3', name: 'Archivos de Proyecto', links: [] }
    ]
  },
];

const CAREER_OPTIONS = ['Arquitectura', 'Arquitectura del Paisaje', 'Urbanismo', 'Otro'];

const getDisplayName = (student: any) => {
  if (!student) return 'Desconocido';
  if (student.nickname) return student.nickname;
  if (student.firstName && student.lastNamePaterno) {
    const firstNames = student.firstName.trim().split(' ');
    return `${firstNames[0]} ${student.lastNamePaterno}`;
  }
  return student.name || 'Desconocido';
};

const triggerCelebration = () => {
  const duration = 5 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval: any = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
    confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
  }, 250);
};

const getFullName = (student: any) => {
  if (!student) return 'Desconocido';
  if (student.firstName) {
    return `${student.firstName} ${student.lastNamePaterno} ${student.lastNameMaterno || ''}`.trim();
  }
  return student.name || 'Desconocido';
};

const Sidebar = ({ 
  view, 
  setView, 
  setEditingRecordId, 
  userRole, 
  setUserRole, 
  setCurrentUserId, 
  currentUserId, 
  firstStudentId, 
  user, 
  onOpenProfile, 
  students, 
  projects, 
  setSelectedProjectId, 
  selectedProjectId, 
  unreadNotifications, 
  onOpenNotifications,
  isDarkMode,
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  userProfile,
  isLoadingConfig
}: any) => {
  const { breakpoint } = useBreakpoint();
  const [isExpanded, setIsExpanded] = useState(false);
  const currentStudent = students.find((s: any) => s.id === currentUserId) || (userProfile?.uid === currentUserId ? { ...userProfile, id: userProfile.uid } : null);
  const pendingValidationsCount = useMemo(() => {
    return students.reduce((acc: number, s: any) => {
      const pending = (s.records || []).filter((r: any) => r.validationStatus === 'pendiente').length;
      return acc + pending;
    }, 0);
  }, [students]);

  const isCoordinatorLevel = useMemo(() => {
    return userRole === 'admin' || userRole === 'coordinator' || userRole === 'super_coordinator' || userRole === 'master_coordinator' || Boolean(user?.email && SUPER_ADMIN_EMAILS.includes(user.email));
  }, [userRole, user?.email]);

  const enrolledProjects = useMemo(() => {
    // Admins and coordinators see all projects automatically
    if (isCoordinatorLevel) {
      return projects.map((p: any) => p.id);
    }
    // Regular users see only their enrolled projects
    const pIds = currentStudent?.projectIds || userProfile?.projectIds || [];
    return Array.from(new Set(pIds));
  }, [isCoordinatorLevel, currentStudent?.projectIds, userProfile?.projectIds, projects]);

  const isRail = breakpoint === 'tablet';
  const isMobile = breakpoint === 'mobile';

  const sidebarWidth = isMobile ? 'w-72' : (isRail ? (isExpanded ? 'w-64' : 'w-20') : 'w-64');

  return (
    <>
      {/* Overlay for mobile and expanded rail on tablet */}
      <AnimatePresence>
        {((isMobile && isMobileMenuOpen) || (isRail && isExpanded)) && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (isMobile) setIsMobileMenuOpen(false);
              if (isRail) setIsExpanded(false);
            }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[90]"
          />
        )}
      </AnimatePresence>

      <div 
        className={`
          ${isMobile ? 'fixed inset-y-0 left-0 z-[100]' : (isRail && isExpanded ? 'fixed inset-y-0 left-0 z-[100]' : 'relative z-[80]')}
          ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
          ${sidebarWidth} 
          ${isDarkMode ? 'bg-[#121212] border-r border-white/10' : 'bg-slate-900'} 
          text-white flex flex-col shadow-2xl transition-all duration-300 ease-in-out
        `}
      >
        <div className={`p-5 border-b ${isDarkMode ? 'border-white/5' : 'border-slate-800'} flex items-center justify-between`}>
          <div className={`flex items-center min-w-0 ${isRail && !isExpanded ? 'justify-center w-full' : 'gap-3'}`}>
            <div className="bg-indigo-500 p-2 rounded-xl text-white flex-shrink-0 shadow-lg shadow-indigo-500/20">
              <GraduationCap size={20} />
            </div>
            {(!isRail || isExpanded) && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-[9px] leading-none uppercase tracking-[0.2em] text-indigo-400/80 mb-1">Asistencia</span>
                <span className="font-black text-xs leading-none uppercase tracking-widest text-white truncate">Prestadores</span>
              </div>
            )}
          </div>
          {isMobile && (
            <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-slate-400 hover:text-white">
              <X size={20} />
            </button>
          )}
        </div>

        <div className={`p-4 flex-1 space-y-2 mt-4 overflow-y-auto ${isRail && !isExpanded ? 'flex flex-col items-center' : ''}`}>
          {userRole !== 'user' ? (
            <>
              <div className="mb-4 w-full">
                {(!isRail || isExpanded) && (
                  <p className={`text-[10px] font-black uppercase tracking-widest px-4 mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Vista Admin</p>
                )}
                <SidebarItem
                  icon={<LayoutDashboard size={20} />}
                  label="Dashboard Admin"
                  active={view === 'dashboard'}
                  onClick={() => { setView('dashboard'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<CalendarIcon size={20} />}
                  label="Calendario"
                  active={view === 'calendar'}
                  onClick={() => { setView('calendar'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
                {isCoordinatorLevel && (
                  <SidebarItem
                    icon={<Layers size={20} />}
                    label="Sesión"
                    active={view === 'session'}
                    onClick={() => { setView('session'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                    collapsed={isRail && !isExpanded}
                    isDarkMode={isDarkMode}
                  />
                )}
                <SidebarItem
                  icon={<CheckSquare size={20} />}
                  label="Validación"
                  active={view === 'validation'}
                  onClick={() => { setView('validation'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  badge={pendingValidationsCount > 0 ? (pendingValidationsCount > 99 ? '99+' : pendingValidationsCount) : undefined}
                  badgeStyle="bg-white text-red-600 font-black animate-breathing"
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<Briefcase size={20} />}
                  label="Directorio Proyectos"
                  active={view === 'project-directory'}
                  onClick={() => { setSelectedProjectId(null); setView('project-directory'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<Tag size={20} />}
                  label="Habilidades"
                  active={view === 'skill-map'}
                  onClick={() => { setView('skill-map'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<FolderKanban size={20} />}
                  label="Tablero de Tareas"
                  active={view === 'task-board'}
                  onClick={() => { setView('task-board'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<CheckSquare size={20} />}
                  label="Google Tasks"
                  active={view === 'google-tasks'}
                  onClick={() => { setView('google-tasks'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<Bell size={20} />}
                  label="Notificaciones"
                  active={false}
                  onClick={() => { onOpenNotifications(); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  badge={unreadNotifications > 0 ? unreadNotifications : undefined}
                  isDarkMode={isDarkMode}
                />
                <SidebarItem
                  icon={<Settings size={20} />}
                  label="Configuración"
                  active={view === 'categories'}
                  onClick={() => { setView('categories'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                  collapsed={isRail && !isExpanded}
                  isDarkMode={isDarkMode}
                />
              </div>

              {true && (
                <div className={`pt-4 border-t w-full ${isDarkMode ? 'border-white/5' : 'border-slate-800'}`}>
                  {(!isRail || isExpanded) && (
                    <p className={`text-[10px] font-black uppercase tracking-widest px-4 mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Vista Usuario</p>
                  )}
                  <SidebarItem
                    icon={<History size={20} />}
                    label="Mi Progreso"
                    active={view === 'user-dashboard'}
                    onClick={() => { setView('user-dashboard'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                    collapsed={isRail && !isExpanded}
                    isDarkMode={isDarkMode}
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <SidebarItem
                icon={<LayoutDashboard size={20} />}
                label="Mi Progreso"
                active={view === 'user-dashboard'}
                onClick={() => { setView('user-dashboard'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                collapsed={isRail && !isExpanded}
                isDarkMode={isDarkMode}
              />
              <SidebarItem
                icon={<CalendarIcon size={20} />}
                label="Calendario"
                active={view === 'calendar'}
                onClick={() => { setView('calendar'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                collapsed={isRail && !isExpanded}
                isDarkMode={isDarkMode}
              />
              <SidebarItem
                icon={<Briefcase size={20} />}
                label="Directorio Proyectos"
                active={view === 'project-directory'}
                onClick={() => { setSelectedProjectId(null); setView('project-directory'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                collapsed={isRail && !isExpanded}
                isDarkMode={isDarkMode}
              />
              <SidebarItem
                icon={<Tag size={20} />}
                label="Habilidades"
                active={view === 'skill-map'}
                onClick={() => { setView('skill-map'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                collapsed={isRail && !isExpanded}
                isDarkMode={isDarkMode}
              />
              <SidebarItem
                icon={<FolderKanban size={20} />}
                label="Mis Tareas (Tablero)"
                active={view === 'task-board'}
                onClick={() => { setView('task-board'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                collapsed={isRail && !isExpanded}
                isDarkMode={isDarkMode}
              />
              <SidebarItem
                icon={<CheckSquare size={20} />}
                label="Google Tasks"
                active={view === 'google-tasks'}
                onClick={() => { setView('google-tasks'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                collapsed={isRail && !isExpanded}
                isDarkMode={isDarkMode}
              />
            </>
          )}

          <div className={`pt-6 border-t w-full ${isDarkMode ? 'border-white/5' : 'border-slate-800'}`}>
            {(!isRail || isExpanded) && (
              <div className="px-4 mb-4 flex items-center justify-between">
                <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Mis Proyectos</p>
                <span className="bg-indigo-500/10 text-indigo-400 text-[9px] font-black px-2 py-0.5 rounded-full border border-indigo-500/20">
                  {projects.filter((p: any) => enrolledProjects.includes(p.id)).length}
                </span>
              </div>
            )}
            
            <div className={`space-y-2 px-2 ${isRail && !isExpanded ? 'flex flex-col items-center' : ''}`}>
              {isLoadingConfig ? (
                (!isRail || isExpanded) && (
                  <div className="space-y-2 px-2">
                    {[1, 2, 3].map(i => (
                      <div key={`placeholder-sidebar-${i}`} className="h-14 bg-white/5 rounded-2xl animate-pulse" />
                    ))}
                  </div>
                )
              ) : projects.filter((p: any) => enrolledProjects.includes(p.id)).length > 0 ? (
                projects.filter((p: any) => enrolledProjects.includes(p.id)).map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedProjectId(p.id); setView('project-workspace'); setEditingRecordId(null); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all group relative border ${
                      view === 'project-workspace' && selectedProjectId === p.id
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/40 scale-[1.02]' 
                        : `${isDarkMode ? 'text-gray-400 border-transparent hover:border-white/10 hover:bg-white/5' : 'text-slate-400 border-transparent hover:border-slate-700 hover:bg-slate-800'}`
                    } ${isRail && !isExpanded ? 'justify-center px-0' : ''}`}
                  >
                    <div 
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm transition-all group-hover:scale-110 group-hover:rotate-3"
                      style={{ 
                        backgroundColor: view === 'project-workspace' && selectedProjectId === p.id ? 'rgba(255,255,255,0.2)' : `${p.color}15`, 
                        color: view === 'project-workspace' && selectedProjectId === p.id ? 'white' : p.color,
                        border: `1px solid ${p.color}30`
                      }}
                    >
                      <Folder size={18} />
                    </div>
                    {(!isRail || isExpanded) && (
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-xs font-black truncate tracking-tight">{p.name}</p>
                        <p className={`text-[9px] font-bold uppercase tracking-widest opacity-50 truncate`}>
                          Acceso Directo
                        </p>
                      </div>
                    )}
                    {view === 'project-workspace' && selectedProjectId === p.id && (!isRail || isExpanded) && (
                      <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    )}
                  </button>
                ))
              ) : (
                (!isRail || isExpanded) && (
                  <div className={`mx-2 p-6 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center text-center space-y-2 ${isDarkMode ? 'border-white/5 bg-white/5' : 'border-slate-800/50 bg-slate-800/20'}`}>
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-slate-500">
                      <Briefcase size={20} />
                    </div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sin Proyectos</p>
                    <button 
                      onClick={() => { setView('project-directory'); if (isMobile) setIsMobileMenuOpen(false); }}
                      className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 uppercase tracking-widest transition-colors"
                    >
                      Ir al Directorio
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <div className={`p-4 border-t ${isDarkMode ? 'border-white/5' : 'border-slate-800'} ${isRail && !isExpanded ? 'flex flex-col items-center' : ''}`}>
          <div 
            className={`w-full flex items-center gap-3 p-2 rounded-xl text-slate-400 group ${isRail && !isExpanded ? 'justify-center' : ''}`}
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-black text-xs flex-shrink-0 relative">
              {user?.displayName?.charAt(0) || 'U'}
              <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 border-2 border-slate-900 rounded-full" title={userRole} />
            </div>
            {(!isRail || isExpanded) && (
              <div className="flex-1 text-left min-w-0">
                <p className="text-xs font-bold truncate">{user?.displayName || 'Usuario'}</p>
                <div className="flex items-center gap-2">
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{userRole}</p>
                  {userRole !== 'user' && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); onOpenProfile(); if (isRail) setIsExpanded(false); if (isMobile) setIsMobileMenuOpen(false); }}
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                      title="Editar Perfil"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {isRail && !isExpanded && (
            <button 
              onClick={() => setIsExpanded(true)}
              className="mt-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all"
              title="Expandir menú"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {(!isRail || isExpanded) && (
            <button 
              onClick={() => auth.signOut()}
              className="w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
            >
              <ShieldOff size={20} /> <span className="font-medium">Cerrar Sesión</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

const SidebarItem = ({ icon, label, active, onClick, collapsed, badge, badgeStyle, isDarkMode }: any) => (
  <button
    onClick={onClick}
    title={collapsed ? label : undefined}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all group relative ${
      active 
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
        : `${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`
    } ${collapsed ? 'justify-center px-0' : ''}`}
  >
    <div className="flex-shrink-0 relative">
      {icon}
      {collapsed && badge && (
        <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] shadow-sm border-2 ${isDarkMode ? 'border-[#121212]' : 'border-slate-900'} ${badgeStyle || 'bg-rose-500 text-white font-bold'}`}>
          {badge}
        </div>
      )}
    </div>
    {(!collapsed) && (
      <span className="font-bold flex-1 text-left truncate">{label}</span>
    )}
    {!collapsed && badge && (
      <div className={`px-2 py-0.5 rounded-full flex items-center justify-center text-[10px] shadow-sm ${badgeStyle || 'bg-rose-500 text-white font-bold'}`}>
        {badge}
      </div>
    )}
  </button>
);

const UserDashboard = ({ student, setStudents, userRole, categories, setCategories, projects, students, checkTimeOverlap, selectedRecords, setSelectedRecords, handleDeleteSelected, setView, setSelectedProjectId, isDarkMode }: any) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isPureCoordinator = (
    userRole === 'admin' || 
    userRole === 'coordinator' || 
    userRole === 'super_coordinator' || 
    userRole === 'master_coordinator' || 
    student?.role === 'coordinator' || 
    student?.role === 'super_coordinator' || 
    student?.role === 'master_coordinator'
  ) && userRole !== 'student_coordinator' && student?.role !== 'student_coordinator';

  const studentProjectIds = isPureCoordinator
    ? (projects.length > 0 ? projects.map((p: any) => p.id) : ['p-general'])
    : (student 
        ? Array.from(new Set(((student.projectIds && student.projectIds.length > 0) ? student.projectIds : ['p-general']) as string[]))
            .filter(Boolean)
        : ['p-general']);
  
  const projectStats = useMemo(() => {
    if (!student) return [];
    const stats: Record<string, number> = {};
    studentProjectIds.forEach((pid: string) => {
      stats[pid] = 0;
    });
    (student?.records || []).forEach((r: any) => {
      if (r.validationStatus === 'aprobado' || !r.validationStatus) {
        stats[r.projectId] = (stats[r.projectId] || 0) + r.hours;
      }
    });
    return Object.entries(stats).map(([pid, hours]) => {
      const p = projects.find((proj: any) => proj.id === pid);
      return { id: pid, name: p?.name || pid, hours, color: p?.color || '#cbd5e1' };
    });
  }, [student?.records, projects, studentProjectIds]);

  const categoryStats = useMemo(() => {
    if (!student) return [];
    const stats: Record<string, { hours: number, color: string }> = {};
    (student?.records || []).forEach((r: any) => {
      if (r.validationStatus === 'aprobado') {
        const cat = categories.find((c: any) => c.id === r.categoryId);
        const catName = cat?.name || 'Otra';
        const catColor = cat?.color || '#cbd5e1';
        if (!stats[catName]) {
          stats[catName] = { hours: 0, color: catColor };
        }
        const hours = typeof r.hours === 'number' ? r.hours : parseFloat(r.hours) || 0;
        stats[catName].hours += hours;
      }
    });
    return Object.entries(stats).map(([name, data]) => ({ 
      name, 
      value: Math.max(0, Number(data.hours.toFixed(2)) || 0), 
      color: data.color 
    }));
  }, [student?.records, categories]);

  const [form, setForm] = useState({
    date: getCDMXDateString(),
    startTime: '09:00',
    endTime: '13:00',
    categoryId: '',
    projectId: studentProjectIds[0] || '',
    description: '',
    evidenceLink: '',
  });
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', color: '#6366f1' });
  const [tagInput, setTagInput] = useState('');
  const [activeTagProject, setActiveTagProject] = useState<string | null>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [sessionRegisterMode, setSessionRegisterMode] = useState<'clock' | 'manual'>('clock');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc' | 'pending'>('desc');

  const totalHours = useMemo(() => {
    const calculated = (student?.records || []).reduce((acc: number, r: any) => {
      if (r.validationStatus === 'aprobado' || r.estado === 'aprobado') {
        const val = parseFloat(r.hours || r.horasCalculadas);
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);
    
    if (typeof student?.horasTotales === 'number' && student.horasTotales > 0) {
      return Math.max(student.horasTotales, calculated);
    }
    return calculated;
  }, [student?.horasTotales, student?.records]);

  const totalPendingHours = useMemo(() => {
    return (student?.records || []).reduce((acc: number, r: any) => {
      if (r.validationStatus === 'pendiente' || r.estado === 'pendiente' || (!r.validationStatus && !r.estado)) {
        const val = parseFloat(r.hours || r.horasCalculadas);
        return acc + (isNaN(val) ? 0 : val);
      }
      return acc;
    }, 0);
  }, [student?.records]);

  const progress = Math.min((totalHours / TOTAL_REQUIRED_HOURS) * 100, 100);

  const calcHours = useMemo(() => {
    const start = toMins(form.startTime);
    const end = toMins(form.endTime);
    return end - start > 0 ? (end - start) / 60 : 0;
  }, [form.startTime, form.endTime]);

  const handleAddTask = async () => {
    if (isSubmitting) return;
    setErrorMessage(null);
    if (!form.categoryId && !showNewCat) {
      showErrorToast("Selecciona una categoría");
      return;
    }
    if (!form.projectId) {
      showErrorToast("Selecciona un proyecto");
      return;
    }

    if (calcHours <= 0) {
      showErrorToast("La hora de salida debe ser posterior a la de entrada");
      return;
    }
    if (calcHours < 0.5) {
      showErrorToast("El registro mínimo es de media hora");
      return;
    }
    console.log('DEBUG: handleAddTask', { userRole, calcHours });
    if (calcHours > 8 && userRole === 'user') {
      showErrorToast("Un registro no puede exceder las 8 horas");
      return;
    }
    if (calcHours > 240) {
      showErrorToast("Un registro no puede exceder las 240 horas");
      return;
    }

    // Validar que la fecha y hora no sean en el futuro (CDMX)
    const { dateString: cdmxDateString, currentMins: cdmxCurrentMins } = getCDMXDateInfo();
    
    const startMins = toMins(form.startTime);
    const endMins = toMins(form.endTime);

    if (form.date > cdmxDateString) {
      setErrorMessage("No se pueden registrar actividades en fechas futuras.");
      showErrorToast("No se pueden registrar actividades en fechas futuras.");
      return;
    }

    if (form.date === cdmxDateString && endMins > cdmxCurrentMins) {
      setErrorMessage("La hora de salida no puede ser mayor a la hora actual.");
      showErrorToast("La hora de salida no puede ser mayor a la hora actual.");
      return;
    }

    // Validar traslapes
    if (checkTimeOverlap(student?.id, form.date, form.startTime, form.endTime, editingRecordId)) {
      setErrorMessage("Ya tienes una actividad registrada en este horario.");
      showErrorToast("Ya tienes una actividad registrada en este horario.");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = showLoadingToast(editingRecordId ? "Actualizando registro..." : "Enviando registro para revisión...");
    
    let finalCatId = form.categoryId;
    if (showNewCat) {
      if (!newCat.name) {
        toast.dismiss(loadingToast);
        showErrorToast("Ingresa el nombre de la categoría");
        setIsSubmitting(false);
        return;
      }
      const catId = `cat-${Date.now()}`;
      const newCategory = { id: catId, ...newCat };
      setCategories([...categories, newCategory]);
      try {
        await setDoc(doc(db, 'categories', catId), newCategory);
        finalCatId = catId;
      } catch (error) {
        toast.dismiss(loadingToast);
        handleFirestoreError(error, OperationType.WRITE, `categories/${catId}`);
        setIsSubmitting(false);
        return;
      }
    }

    const newRecordId = editingRecordId || `rec-${Date.now()}`;
    const selectedProj = projects.find((p: any) => p.id === form.projectId);
    const selectedCat = categories.find((c: any) => c.id === finalCatId);
    const projName = selectedProj?.name || 'General';
    const catName = selectedCat?.name || 'General';
    const autoDescription = form.description?.trim() 
      ? form.description 
      : `Sesión de ${form.startTime} a ${form.endTime} (${Number(calcHours.toFixed(1))}h) en ${projName} · ${catName}. Generada automáticamente al registrar sesión.`;

    const currentAuthUid = auth.currentUser?.uid;
    const sessionData: any = {
        id: newRecordId,
        userId: student?.id || student?.uid || currentAuthUid,
        studentId: student?.id || student?.uid || currentAuthUid,
        studentName: student?.name || getDisplayName(student) || auth.currentUser?.displayName || 'Alumno',
        projectId: form.projectId,
        categoryId: finalCatId,
        description: autoDescription,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
        horasCalculadas: calcHours,
        hours: calcHours,
        estado: 'pendiente',
        validationStatus: 'pendiente',
        status: 'A',
        evidenceLink: form.evidenceLink || '',
        evidence: form.evidenceLink || '',
        updatedBy: auth.currentUser?.uid,
        acknowledgedRejection: false,
    };

    if (!editingRecordId) {
      sessionData.createdAt = new Date().toISOString();
    }

    try {
      setIsSubmitting(true);
      const sessionRef = doc(db, 'sesiones', newRecordId);
      await setDoc(sessionRef, sessionData, { merge: true });
      
      toast.dismiss(loadingToast);
      showSuccessToast(editingRecordId ? "Registro actualizado exitosamente" : "Registro enviado para revisión exitosamente");
      
      setForm({
        date: getCDMXDateString(),
        startTime: '09:00',
        endTime: '13:00',
        categoryId: '',
        projectId: studentProjectIds[0] || '',
        description: '',
        evidenceLink: '',
      });
      setShowNewCat(false);
      setEditingRecordId(null);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error saving session:", error);
      handleFirestoreError(error, OperationType.WRITE, `sesiones/${newRecordId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTask = (record: any) => {
    setEditingRecordId(record.id);
    setForm({
      date: record.date || getCDMXDateString(),
      startTime: record.startTime || '09:00',
      endTime: record.endTime || '13:00',
      categoryId: record.categoryId || '',
      projectId: record.projectId || '',
      description: record.description || '',
      evidenceLink: record.evidenceLink || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTask = async (recordId: string) => {
    const loadingToast = showLoadingToast("Eliminando registro...");
    try {
      await deleteDoc(doc(db, 'sesiones', recordId));
      showSuccessToast("Registro eliminado");
    } catch (error) {
      console.error("Error deleting session:", error);
      handleFirestoreError(error, OperationType.DELETE, `sesiones/${recordId}`);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleDeleteSelectedLocal = () => {
    handleDeleteSelected(student?.id);
  };

  const downloadCSV = () => {
    if (selectedRecords.length === 0) {
      showErrorToast("Selecciona al menos un registro para descargar");
      return;
    }

    const recordsToExport = (student?.records || []).filter((r: any) => selectedRecords.includes(r.id));
    const headers = ["Fecha", "Hora de entrada", "Hora de salida", "Descripción de actividades"];
    const rows = recordsToExport.map((r: any) => [
      r.date,
      r.startTime,
      r.endTime,
      `"${(r.description || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `actividades_${student?.firstName}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccessToast("Archivo descargado");
  };

  const handleAddTag = (projectId: string) => {
    if (!tagInput.trim()) return;
    setStudents((prev: any) => prev.map((s: any) => {
      if (s.id === student?.id) {
        const currentTags = s.projectTasks?.[projectId] || [];
        if (currentTags.includes(tagInput.trim())) return s;
        return {
          ...s,
          projectTasks: {
            ...s.projectTasks,
            [projectId]: [...currentTags, tagInput.trim()]
          }
        };
      }
      return s;
    }));
    setTagInput('');
    setActiveTagProject(null);
    showSuccessToast("Etiqueta agregada");
  };

  const collaborators = useMemo(() => {
    if (!student) return [];
    return students.filter((s: any) => 
      s.id !== student?.id && 
      (!s.email || !SUPER_ADMIN_EMAILS.includes(s.email)) &&
      (s.projectIds || []).some((pid: string) => studentProjectIds.includes(pid))
    );
  }, [students, student?.id, studentProjectIds]);

  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  useEffect(() => {
    if (!student?.id || !studentProjectIds.length) {
      setLoadingTasks(false);
      return;
    }

    const unsubscribes: (() => void)[] = [];
    let projectsLoaded = 0;

    studentProjectIds.forEach((pid: string) => {
      const q = query(
        collection(db, 'projects', pid, 'tasks'),
        where('assignedTo', '==', student?.id),
        where('deletedAt', '==', null)
      );

      const unsub = onSnapshot(q, (snapshot) => {
        const projectTasks = snapshot.docs.map(doc => ({
          id: doc.id,
          projectId: pid,
          ...doc.data()
        }));
        
        setAssignedTasks(prev => {
          const otherTasks = prev.filter(t => t.projectId !== pid);
          return [...otherTasks, ...projectTasks];
        });
        
        projectsLoaded++;
        if (projectsLoaded >= studentProjectIds.length) {
          setLoadingTasks(false);
        }
      }, (err) => {
        console.error(`Error fetching tasks for project ${pid}:`, err);
        projectsLoaded++;
        if (projectsLoaded >= studentProjectIds.length) {
          setLoadingTasks(false);
        }
      });
      unsubscribes.push(unsub);
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [student?.id, studentProjectIds]);

  const pendingRecords = useMemo(() => {
    return (student?.records || []).filter((r: any) => r.validationStatus === 'pendiente');
  }, [student?.records]);

  const unfinishedTasks = useMemo(() => {
    return assignedTasks.filter((t: any) => t.status !== 'done');
  }, [assignedTasks]);

  const [disputeModal, setDisputeModal] = useState<{ isOpen: boolean; recordId: string | null }>({ isOpen: false, recordId: null });
  const [disputeReason, setDisputeReason] = useState('');

  const handleDispute = async () => {
    if (!disputeReason.trim() || !disputeModal.recordId) {
      showErrorToast("Ingresa una justificación para la disputa");
      return;
    }

    try {
      if (disputeModal.recordId) {
        await updateDoc(doc(db, 'sesiones', disputeModal.recordId), {
          estado: 'disputado',
          disputeReason: disputeReason.trim(),
          disputeDate: new Date().toISOString()
        });
        showSuccessToast("Disputa enviada correctamente. El administrador revisará tu caso.");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sesiones/${disputeModal.recordId}`);
    }

    setDisputeModal({ isOpen: false, recordId: null });
    setDisputeReason('');
  };

  if (!student) return <div className="p-20 text-center font-black text-slate-400 uppercase tracking-widest">Cargando perfil...</div>;

  return (
    <div className="space-y-8">
      {/* Dispute Modal */}
      <AnimatePresence>
        {disputeModal.isOpen && (
          <div key="dispute-modal-overlay" className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              key="dispute-modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDisputeModal({ isOpen: false, recordId: null })}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              key="dispute-modal-content"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-100"
            >
              <div className="p-8 sm:p-10 space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Disputar Registro</h3>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Justifica por qué este registro debe ser aprobado</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">JUSTIFICACIÓN</label>
                  <textarea 
                    className="w-full p-5 bg-slate-50 border-none rounded-[2rem] h-40 font-bold outline-none focus:ring-2 focus:ring-amber-500/10 transition-all resize-none text-sm"
                    placeholder="Explica detalladamente por qué el registro es correcto..."
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                  />
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setDisputeModal({ isOpen: false, recordId: null })}
                    className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleDispute}
                    className="flex-1 py-4 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20"
                  >
                    Enviar Disputa
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-3xl sm:text-5xl font-black text-slate-900 tracking-tighter">Mi Progreso</h2>
                  <p className="text-slate-500 font-medium mt-1 uppercase text-[9px] sm:text-[11px] tracking-[0.2em] italic">Seguimiento personal de actividades y horas</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setView('calendar')} 
                    className="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all active:scale-95"
                  >
                    <CalendarIcon size={18} /> Ver Calendario
                  </button>
                  <button 
                    onClick={() => { setSelectedProjectId(null); setView('project-directory'); }} 
                    className="w-full sm:w-auto bg-indigo-50 text-indigo-600 px-6 py-3 rounded-2xl flex items-center justify-center gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all active:scale-95"
                  >
                    <Briefcase size={18} /> Directorio de Proyectos
                  </button>
                </div>
              </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-8 items-start max-w-7xl mx-auto">
        <div className="grid grid-cols-1 gap-8 items-start">
          <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm space-y-6 sm:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
                  <PlusCircle className="text-indigo-600" size={24} /> Registrar Sesión
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {sessionRegisterMode === 'clock' && !editingRecordId
                    ? 'Registro digital con reloj checador (requiere validación del coordinador)'
                    : 'Registro manual tradicional de horas y actividades'}
                </p>
              </div>

              {!editingRecordId && (
                <div className="flex p-1 rounded-2xl bg-slate-100 border border-slate-200 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSessionRegisterMode('clock')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                      sessionRegisterMode === 'clock'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Clock size={14} /> Clock In / Out
                  </button>
                  <button
                    type="button"
                    onClick={() => setSessionRegisterMode('manual')}
                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all ${
                      sessionRegisterMode === 'manual'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Edit2 size={14} /> Manual
                  </button>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="p-4 bg-red-50 text-red-700 rounded-2xl border-2 border-red-100 flex items-center gap-3 font-bold text-xs uppercase animate-pulse shadow-sm">
                <AlertCircle size={18} /> {errorMessage}
              </div>
            )}
            
            {sessionRegisterMode === 'clock' && !editingRecordId ? (
              <ClockInOutWidget
                student={student}
                projects={projects}
                categories={categories}
                isDarkMode={isDarkMode}
              />
            ) : (
              <div className="space-y-6">
                {/* Row 1: Time tracking */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-4">
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">FECHA</label>
                    <div className="relative">
                      <input type="date" className="w-full pl-3 pr-8 py-4 bg-slate-50 border-none rounded-2xl text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                      <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">ENTRADA (24H)</label>
                    <div className="relative">
                      <input type="time" className="w-full pl-3 pr-8 py-4 bg-slate-50 border-none rounded-2xl text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer" value={form.startTime} onChange={e => setForm({...form, startTime: e.target.value})} />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">SALIDA (24H)</label>
                    <div className="relative">
                      <input type="time" className="w-full pl-3 pr-8 py-4 bg-slate-50 border-none rounded-2xl text-[11px] sm:text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer" value={form.endTime} onChange={e => setForm({...form, endTime: e.target.value})} />
                      <Clock className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                  </div>
                </div>

                {/* Total Calculado */}
                <div className="flex flex-col items-center sm:items-start bg-indigo-50/50 p-4 rounded-2xl">
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">TOTAL CALCULADO</span>
                  <span className="text-3xl font-black text-indigo-600 tracking-tighter">{Number(calcHours.toFixed(2))} Horas</span>
                </div>

                {/* Row 2: Classification */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="space-y-2 min-w-0">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">PROYECTO</label>
                    <div className="relative">
                      <select className="w-full pl-4 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer" value={form.projectId} onChange={e => setForm({...form, projectId: e.target.value})}>
                        {Array.from(new Set(studentProjectIds)).map((pid: string) => {
                          const p = projects.find((proj: any) => proj.id === pid);
                          return <option key={pid} value={pid}>{p?.name || pid}</option>;
                        })}
                      </select>
                      <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={18} />
                    </div>
                  </div>
                  <div className="space-y-2 min-w-0">
                    <div className="flex justify-between items-center px-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">CATEGORÍA</label>
                      <button onClick={() => setShowNewCat(!showNewCat)} className="text-[10px] font-black text-indigo-600 uppercase tracking-widest hover:underline shrink-0">
                        {showNewCat ? 'CANCELAR' : '+ NUEVA'}
                      </button>
                    </div>
                    {showNewCat ? (
                      <div className="flex gap-2">
                        <input type="text" placeholder="Nombre..." className="flex-1 min-w-0 p-4 bg-slate-50 border-none rounded-2xl font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all" value={newCat.name} onChange={e => setNewCat({...newCat, name: e.target.value})} />
                        <input type="color" className="w-24 sm:w-16 h-14 p-1 bg-slate-50 border-none rounded-2xl cursor-pointer shrink-0" value={newCat.color} onChange={e => setNewCat({...newCat, color: e.target.value})} />
                      </div>
                    ) : (
                      <div className="relative">
                        <select className="w-full pl-4 pr-12 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all appearance-none cursor-pointer" value={form.categoryId} onChange={e => setForm({...form, categoryId: e.target.value})}>
                          <option value="">Seleccionar...</option>
                          {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none rotate-90" size={18} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Resumen Automático y Evidencia por Coordinación */}
                <div className="p-5 bg-indigo-50/70 border border-indigo-100 rounded-3xl space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl shrink-0 mt-0.5">
                      <Sparkles size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Descripción generada automáticamente
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        Al enviar la sesión, se generará automáticamente la breve descripción del turno ({form.startTime} a {form.endTime}) con {Number(calcHours.toFixed(1))} horas para el proyecto y categoría seleccionados.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 pt-2.5 border-t border-indigo-100/70">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-xl shrink-0 mt-0.5">
                      <Info size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-slate-900">
                        Evidencia y Validación
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        El enlace de evidencia institucional será incorporado por tu coordinador(a) al momento de revisar y validar las horas de tu sesión.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end pt-4">
                  {editingRecordId && (
                    <button 
                      onClick={() => {
                        setEditingRecordId(null);
                        setForm({
                          ...form,
                          description: '',
                          evidenceLink: '',
                        });
                      }} 
                      className="px-8 py-4 bg-slate-100 text-slate-500 rounded-full font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      CANCELAR
                    </button>
                  )}
                  <button 
                    disabled={isSubmitting}
                    onClick={handleAddTask} 
                    className="px-12 py-5 bg-indigo-600 text-white rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                  >
                    {isSubmitting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                    {editingRecordId ? 'ACTUALIZAR' : 'ENVIAR'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* MIS PENDIENTES */}
          {(unfinishedTasks.length > 0 || pendingRecords.length > 0) && (
            <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex justify-between items-center">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
                  <Clock className="text-amber-500 w-6 h-6 sm:w-7 sm:h-7" /> Mis Pendientes
                </h3>
                <div className="flex gap-2">
                  <span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                    {unfinishedTasks.length + pendingRecords.length} Total
                  </span>
                </div>
              </div>

              <div className="space-y-6">
                {/* Tareas del Proyecto */}
                {unfinishedTasks.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Tareas en Curso</p>
                    <div className="grid grid-cols-1 gap-3">
                      {unfinishedTasks.map((t: any) => {
                        const p = projects.find((proj: any) => proj.id === t.projectId);
                        return (
                          <div 
                            key={t.id} 
                            onClick={() => {
                              if (setView && setSelectedProjectId) {
                                setSelectedProjectId(t.projectId);
                                setView('project-workspace');
                              }
                            }}
                            className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-center justify-between hover:bg-white hover:shadow-md transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: p?.color || '#cbd5e1' }}></div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{t.title}</p>
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest truncate">{p?.name || 'Proyecto'}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${
                                t.status === 'stuck' ? 'bg-red-100 text-red-600' : 
                                t.status === 'working_on_it' ? 'bg-blue-100 text-blue-600' : 
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {t.status === 'stuck' ? 'Atascado' : t.status === 'working_on_it' ? 'En Curso' : 'Pendiente'}
                              </span>
                              <ChevronRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Registros por Aprobar */}
                {pendingRecords.length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Registros por Aprobar</p>
                    <div className="grid grid-cols-1 gap-3">
                      {pendingRecords.map((r: any) => {
                        const p = projects.find((proj: any) => proj.id === r.projectId);
                        return (
                          <div key={r.id} className="bg-amber-50/30 p-4 rounded-2xl border border-amber-100/50 flex items-center justify-between">
                            <div className="flex items-center gap-4 min-w-0">
                              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                                <Clock size={20} />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{r.description || 'Sin descripción'}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{r.date}</span>
                                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-widest">{p?.name || 'Proyecto'}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-sm font-black text-amber-600">{r.hours}h</p>
                              <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest">Pendiente</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ETIQUETAS DE ACTIVIDAD */}
          <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
              <BarChart3 className="text-indigo-600 w-6 h-6 sm:w-7 sm:h-7" /> Estadísticas por Proyecto
            </h3>
            <div className="grid grid-cols-1 gap-6">
              {projectStats.map((stat: any) => (
                <div key={stat.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div>
                      <span className="font-black text-xs uppercase text-slate-700">{stat.name}</span>
                    </div>
                    <span className="text-lg font-black text-indigo-600">{Number(stat.hours.toFixed(2))} / {TOTAL_REQUIRED_HOURS}h</span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((stat.hours / TOTAL_REQUIRED_HOURS) * 100, 100)}%`, backgroundColor: stat.color }}></div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Progreso del proyecto</p>
                </div>
              ))}
              {projectStats.length === 0 && <p className="text-center py-10 text-slate-300 font-black uppercase tracking-widest text-[10px] col-span-full">No hay horas registradas aún</p>}
            </div>
          </div>

          {/* DISTRIBUCIÓN POR CATEGORÍA */}
          <div className="bg-white p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
              <PieChartIcon className="text-indigo-600 w-6 h-6 sm:w-7 sm:h-7" /> Distribución por Categoría
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="min-h-[350px] h-[350px] w-full flex items-center justify-center relative">
                <div className="relative w-64 h-64">
                  <svg viewBox="0 0 42 42" className="w-full h-full -rotate-90">
                    {categoryStats.reduce((acc: number, curr: any) => acc + curr.value, 0) > 0 ? (
                      categoryStats.map((item: any, index: number) => {
                        const total = categoryStats.reduce((acc: number, curr: any) => acc + curr.value, 0);
                        const percentage = (item.value / total) * 100;
                        const previousPercentage = categoryStats
                          .slice(0, index)
                          .reduce((sum: number, prevItem: any) => sum + (prevItem.value / total) * 100, 0);
                        const offset = 100 - previousPercentage;

                        return (
                          <circle
                            key={`cell-${index}`}
                            cx="21"
                            cy="21"
                            r="15.91549431"
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth="8"
                            strokeDasharray={`${percentage} ${100 - percentage}`}
                            strokeDashoffset={offset}
                            className="transition-all duration-500 ease-in-out"
                          />
                        );
                      })
                    ) : (
                      <circle cx="21" cy="21" r="15.91549431" fill="transparent" stroke="#f1f5f9" strokeWidth="8" />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-4xl font-black ${isDarkMode ? 'text-white' : 'text-[#1a1b35]'} leading-none`}>
                      {categoryStats.reduce((acc: number, curr: any) => acc + curr.value, 0)}h
                    </span>
                    <span className="text-xs font-bold text-slate-400 tracking-wider mt-1">
                      APROBADAS
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-6">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] ml-2">Desglose de Horas</p>
                <div className="grid grid-cols-1 gap-4">
                  {categoryStats.map((stat: any, index: number) => {
                    const totalHours = categoryStats.reduce((acc: number, curr: any) => acc + curr.value, 0);
                    const percentage = totalHours > 0 ? ((stat.value / totalHours) * 100).toFixed(1) : 0;
                    
                    return (
                      <div key={stat.name} className={`flex items-center justify-between p-4 rounded-2xl ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div>
                          <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>{stat.name}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`font-black text-sm ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{stat.value}h</span>
                          <span className="text-[10px] font-bold text-indigo-500">{percentage}%</span>
                        </div>
                      </div>
                    );
                  })}
                  {categoryStats.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                      <PieChartIcon size={32} className="text-slate-300 mb-3" />
                      <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No hay horas aprobadas aún</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COMPAÑEROS DE PROYECTO */}
          <div className="bg-white p-4 sm:p-10 rounded-[2rem] sm:rounded-[3rem] border border-slate-200 shadow-sm space-y-6 sm:space-y-8">
            <h3 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-3">
              <Users className="text-indigo-600" size={24} /> Compañeros de Proyecto
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {collaborators.map((collab: any) => {
                const records = collab.records || [];
                const latestRecord = records[records.length - 1];
                const commonProjects = (collab.projectIds || []).filter((pid: string) => studentProjectIds.includes(pid));
                return (
                  <div key={collab.id} className="bg-slate-50 p-4 sm:p-6 rounded-[2rem] border border-slate-100 flex gap-4 items-start hover:bg-white hover:shadow-md transition-all group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 shrink-0">
                      {collab.firstName?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1 min-w-0 space-y-2 sm:space-y-3">
                      <div>
                        <p className="font-black text-slate-900 truncate text-sm sm:text-base">{getFullName(collab)}</p>
                        <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{collab.career}</p>
                      </div>
                      
                      <div className="space-y-2 pt-1">
                        {collab.email && (
                          <a href={`mailto:${collab.email}`} className="flex items-center gap-2 text-slate-500 group/link hover:text-indigo-600 transition-colors">
                            <div className="p-1.5 bg-white border border-slate-100 rounded-lg shadow-sm group-hover/link:border-indigo-100 group-hover/link:bg-indigo-50/30 transition-all">
                              <Mail size={12} className="text-indigo-500" />
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-bold truncate">{collab.email}</span>
                          </a>
                        )}
                        {collab.phone && (
                          <a href={`tel:${collab.phone}`} className="flex items-center gap-2 text-slate-500 group/link hover:text-emerald-600 transition-colors">
                            <div className="p-1.5 bg-white border border-slate-100 rounded-lg shadow-sm group-hover/link:border-emerald-100 group-hover/link:bg-emerald-50/30 transition-all">
                              <Phone size={12} className="text-emerald-500" />
                            </div>
                            <span className="text-[10px] sm:text-[11px] font-bold truncate">{collab.phone}</span>
                          </a>
                        )}
                      </div>

                      {latestRecord && (
                        <div className="bg-white/50 p-2 sm:p-3 rounded-xl border border-slate-100 overflow-hidden mt-3">
                          <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 truncate">Última Actividad</p>
                          <p className="text-[10px] sm:text-[11px] font-bold text-slate-600 line-clamp-1 italic break-words">"{latestRecord.description}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {/* Admin Card */}
              <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex gap-4 items-start shadow-sm">
                <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center font-black text-white shrink-0">
                  A
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <p className="font-black text-indigo-900">Luis Edgar Gutiérrez</p>
                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Coordinación General</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <Mail size={12} className="text-indigo-400" /> luisedgar.gutierrez17@gmail.com
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <Phone size={12} className="text-emerald-400" /> 5512345678
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {(() => {
            const currentEffectiveRole = getEffectiveRole(student?.email, student?.role || userRole);
            const isCoord = currentEffectiveRole === 'coordinator' || currentEffectiveRole === 'super_coordinator' || currentEffectiveRole === 'master_coordinator';
            
            return isCoord ? (
              <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] bg-emerald-50 px-3 py-1 rounded-full shadow-sm border border-emerald-100 w-fit flex items-center gap-1.5">
                      <ShieldCheck size={14} /> Equipo Coordinador
                    </span>
                    <p className="text-xs text-slate-500 font-bold mt-2">
                      Rol: <span className="font-black text-slate-800">{ROLE_LABELS[currentEffectiveRole]?.label}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-600 tracking-tighter">{Number(totalHours.toFixed(2))}h</span>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Historial Registrado</p>
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100 text-center">
                  <p className="text-xs font-black text-emerald-800 uppercase tracking-wider">Servicio Social Liberado / Concluido</p>
                  <p className="text-[10px] text-emerald-600 mt-0.5">Como integrante del equipo de coordinación, no tienes contador obligatorio de 480 horas.</p>
                </div>
              </div>
            ) : (
              <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] bg-indigo-50 px-3 py-1 rounded-full shadow-sm border border-indigo-100 w-fit">Progreso General</span>
                      {totalPendingHours > 0 && (
                        <span className="text-[9px] font-bold text-amber-600 uppercase tracking-widest mt-1.5 ml-1 flex items-center gap-1">
                          <Clock size={11} /> {Number(totalPendingHours.toFixed(1))}h pendientes por validar
                        </span>
                      )}
                      {typeof student?.horasTotales === 'number' && student?.horasTotales > 0 && (
                        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-widest mt-1 ml-1 flex items-center gap-1">
                          <Shield size={10} /> Verificado por Servidor
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-black text-indigo-600 tracking-tighter">{Number(totalHours.toFixed(2))} / {TOTAL_REQUIRED_HOURS}</span>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Horas Aprobadas</p>
                    </div>
                </div>
                <div className="w-full bg-slate-100 h-6 rounded-full overflow-hidden mb-4 shadow-inner">
                    <div className="bg-indigo-600 h-full rounded-full transition-all duration-1000 shadow-lg" style={{ width: `${progress}%` }}></div>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Faltan {Number(Number((TOTAL_REQUIRED_HOURS - totalHours).toFixed(2)))} horas para completar</p>
              </div>
            );
          })()}

          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                <History className="text-slate-400" size={24} /> Recientes
              </h3>
              <div className="flex gap-2 overflow-x-auto hide-scrollbar snap-x snap-mandatory w-full pb-2">
                {selectedRecords.length > 0 && (
                  <>
                    <button onClick={handleDeleteSelectedLocal} className="p-2 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-600 hover:text-white transition-all shadow-sm shrink-0 snap-center" title="Borrar Seleccionados">
                      <Trash2 size={18} />
                    </button>
                    <button onClick={downloadCSV} className="p-2 bg-indigo-100 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm shrink-0 snap-center" title="Descargar Seleccionados">
                      <Download size={18} />
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : prev === 'asc' ? 'pending' : 'desc')}
                  className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shadow-sm flex items-center justify-center shrink-0 snap-center"
                  title={sortOrder === 'desc' ? 'Ordenar Ascendente' : sortOrder === 'asc' ? 'Pendientes Primero' : 'Ordenar Descendente'}
                >
                  {sortOrder === 'pending' ? <Clock size={18} className="text-amber-600" /> : <ArrowDownUp size={18} className={sortOrder === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />}
                </button>
                <button 
                  onClick={() => {
                    const records = student?.records || [];
                    if (selectedRecords.length === records.length) setSelectedRecords([]);
                    else setSelectedRecords(records.map((r: any) => r.id));
                  }}
                  className={`p-2 rounded-xl transition-all shadow-sm flex items-center justify-center shrink-0 snap-center ${selectedRecords.length > 0 && selectedRecords.length === (student?.records || []).length ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  title={selectedRecords.length > 0 && selectedRecords.length === (student?.records || []).length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                >
                  {selectedRecords.length > 0 && selectedRecords.length === (student?.records || []).length ? <X size={18} /> : <CheckSquare size={18} />}
                </button>
              </div>
            </div>
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {(student?.records || []).slice().sort((a: any, b: any) => {
                  if (sortOrder === 'pending') {
                    if (a.validationStatus === 'pendiente' && b.validationStatus !== 'pendiente') return -1;
                    if (a.validationStatus !== 'pendiente' && b.validationStatus === 'pendiente') return 1;
                  }
                  const dateA = new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
                  const dateB = new Date(`${b.date}T${b.startTime || '00:00'}`).getTime();
                  return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
                }).map((r: any) => {
                  const cat = categories.find((c: any) => c.id === r.categoryId);
                  const isSelected = selectedRecords.includes(r.id);
                  return (
                    <div 
                      key={r.id} 
                      onClick={() => {
                        setSelectedRecords(prev => isSelected ? prev.filter(id => id !== r.id) : [...prev, r.id]);
                      }}
                      className={`group p-6 border rounded-[2rem] transition-all relative cursor-pointer ${isSelected ? 'border-indigo-500 bg-indigo-50/50 shadow-md' : 'border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30'}`}
                    >
                      <div className="flex justify-between items-start mb-2 gap-4 pr-16">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'}`}>
                              {isSelected && <Check size={12} className="text-white" />}
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{r.date}</span>
                          </div>
                          <span className="text-sm font-black text-indigo-600 shrink-0">{Number(r.hours.toFixed(2))}h</span>
                      </div>
                        <p className="font-bold text-slate-800 text-sm leading-tight mb-3 break-words">{r.description || 'Sin descripción'}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat?.color || '#cbd5e1' }}></div>
                            <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{cat?.name || 'Otra'}</span>
                          </div>
                          {r.validationStatus && (
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest shrink-0 ${(VALIDATION_STATUS as any)[r.validationStatus]?.color || 'bg-slate-50 text-slate-400 border-slate-100'}`}>
                              {(() => {
                                const Icon = (VALIDATION_STATUS as any)[r.validationStatus]?.icon || Clock;
                                return <Icon size={10} />;
                              })()}
                              {(VALIDATION_STATUS as any)[r.validationStatus]?.label || 'Pendiente'}
                            </div>
                          )}
                          {r.validationStatus === 'rechazado' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setDisputeModal({ isOpen: true, recordId: r.id });
                              }}
                              className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-200 bg-amber-50 text-amber-600 text-[8px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all shrink-0"
                            >
                              <AlertTriangle size={10} />
                              Disputar
                            </button>
                          )}
                        </div>
                        {r.createdBy !== 'admin' && (
                            <div className="absolute top-4 right-4 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all">
                                <button 
                                  onClick={(e) => { e.stopPropagation(); handleEditTask(r); }} 
                                  className="p-2 flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                                  title="Editar"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button 
                                  onClick={(e) => { e.stopPropagation(); showConfirmToast("¿Eliminar este registro?", () => handleDeleteTask(r.id)); }} 
                                  className="p-2 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                  title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                  );
                })}
                {(student?.records || []).length === 0 && (
                  <div className="text-center py-10">
                    <p className="text-slate-300 font-black uppercase tracking-widest text-[10px]">No hay registros aún</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};



const App = () => {
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userRole, setUserRole] = useState<UserRole>('user');
  const permissions = usePermissions(userRole, user?.email);
  const [roleModalStudent, setRoleModalStudent] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(false);

  const [students, setStudents] = useState<any[]>(() => {
    const saved = localStorage.getItem('app_students');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 8) {
          const studentMap = new Map<string, any>();
          INITIAL_STUDENTS.forEach(s => studentMap.set(s.id, s));
          parsed.forEach((s: any) => {
            if (s.email?.toLowerCase() === 'legc.1794@gmail.com') s.role = 'user';
            const existing = studentMap.get(s.id) || {};
            studentMap.set(s.id, {
              ...existing,
              ...s,
              records: dedupeById([...(existing.records || []), ...(s.records || [])])
            });
          });
          return Array.from(studentMap.values());
        }
      } catch (e) {
        console.warn("Could not parse saved students:", e);
      }
    }
    return INITIAL_STUDENTS;
  });
  const [sessions, setSessions] = useState<any[]>([]);

  const studentsWithRecords = useMemo(() => {
    let allStudents = [...students];
    if (userProfile && !allStudents.some(s => s.id === userProfile.uid || s.uid === userProfile.uid || (userProfile.email && s.email === userProfile.email))) {
      allStudents.push({
        id: userProfile.uid,
        uid: userProfile.uid,
        ...userProfile,
        role: userProfile.role || (userRole === 'admin' ? 'admin' : 'coordinator'),
        name: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastNamePaterno || ''}`.trim() || user?.displayName || 'Coordinador',
        records: userProfile.records || []
      });
    }

    return allStudents.map(student => {
      const studentSessions = sessions
        .filter((s: any) => 
          s.userId === student.id || 
          s.studentId === student.id || 
          (student.uid && (s.userId === student.uid || s.studentId === student.uid)) ||
          (student.studentId && (s.studentId === student.studentId || s.matricula === student.studentId))
        )
        .map((s: any) => {
          const isAppr = s.estado === 'aprobado' || s.validationStatus === 'aprobado';
          const isRej = s.estado === 'rechazado' || s.validationStatus === 'rechazado';
          const isDisp = s.estado === 'disputado' || s.validationStatus === 'disputado';
          const validationStatus = isAppr ? 'aprobado' : isRej ? 'rechazado' : isDisp ? 'disputado' : (s.estado || s.validationStatus || 'pendiente');
          return {
            ...s,
            hours: Number(s.horasCalculadas ?? s.hours ?? 0),
            horasCalculadas: Number(s.horasCalculadas ?? s.hours ?? 0),
            validationStatus,
            estado: validationStatus
          };
        });

      // Merge records with priority to resolved statuses (aprobado/rechazado)
      const mergedMap = new Map<string, any>();
      [...(student.records || []), ...studentSessions].forEach((r: any) => {
        const existing = mergedMap.get(r.id);
        if (!existing) {
          mergedMap.set(r.id, r);
        } else {
          const isExistingPending = existing.validationStatus === 'pendiente' || existing.estado === 'pendiente';
          const isNewDetermined = r.validationStatus === 'aprobado' || r.validationStatus === 'rechazado' || r.estado === 'aprobado' || r.estado === 'rechazado';
          if (isExistingPending && isNewDetermined) {
            mergedMap.set(r.id, r);
          } else if (!isExistingPending && isNewDetermined) {
            mergedMap.set(r.id, { ...existing, ...r });
          }
        }
      });
      const combinedRecords = Array.from(mergedMap.values());
      const approvedHours = getStudentApprovedHours({ ...student, records: combinedRecords });
      const hasCompleted480 = approvedHours >= TOTAL_REQUIRED_HOURS;
      
      const isArchived = Boolean(student.isArchived || hasCompleted480 || (student.status || '').toLowerCase() === 'finalizado' || (student.workStatus || '').toLowerCase() === 'finalizado');
      const status = (hasCompleted480 || (student.status || '').toLowerCase() === 'finalizado') ? 'Finalizado' : (student.status || 'En Curso');
      const workStatus = (hasCompleted480 || (student.workStatus || '').toLowerCase() === 'finalizado') ? 'Finalizado' : (student.workStatus || ((student.projectIds && student.projectIds.length > 0) ? 'Asignado' : 'Sin asignar'));

      return { 
        ...student, 
        records: combinedRecords,
        isArchived,
        status,
        workStatus
      };
    });
  }, [students, sessions, userProfile, userRole, user]);

  const [categories, setCategories] = useState(() => {
    const saved = localStorage.getItem('app_categories');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length >= 5) {
          const map = new Map<string, any>();
          DEFAULT_CATEGORIES.forEach(c => map.set(c.id, c));
          parsed.forEach((c: any) => map.set(c.id, { ...(map.get(c.id) || {}), ...c }));
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn("Could not parse saved categories:", e);
      }
    }
    return DEFAULT_CATEGORIES;
  });

  const [projects, setProjects] = useState<any[]>(() => {
    const saved = localStorage.getItem('app_projects');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).filter((p: any) => !p.isDeleted);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const map = new Map<string, any>();
          DEFAULT_PROJECTS.forEach(p => map.set(p.id, p));
          parsed.forEach((p: any) => map.set(p.id, { ...(map.get(p.id) || {}), ...p }));
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn("Could not parse saved projects:", e);
      }
    }
    return DEFAULT_PROJECTS;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    return saved === 'dark';
  });

  useEffect(() => {
    localStorage.setItem('app_theme', isDarkMode ? 'dark' : 'light');
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const pendingDeletionsRef = useRef<Record<string, NodeJS.Timeout>>({});

  useEffect(() => {
    return () => {
      // Clear any pending deletion timers on unmount
      Object.values(pendingDeletionsRef.current).forEach(clearTimeout);
    };
  }, []);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    type?: 'danger' | 'warning' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' = 'danger', confirmText: string = 'Confirmar') => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      onConfirm,
      type,
      confirmText
    });
  };

  const handleDeleteProject = (projectId: string) => {
    if (!projectId) {
      toast.error('Error: ID de proyecto no encontrado');
      return;
    }

    const projectToDelete = projects.find(p => p.id === projectId);
    if (!projectToDelete) {
      toast.error('Error: Proyecto no encontrado en el estado local');
      return;
    }

    // Cancel any existing pending deletion for this project if it was somehow re-triggered
    if (pendingDeletionsRef.current[projectId]) {
      clearTimeout(pendingDeletionsRef.current[projectId]);
      delete pendingDeletionsRef.current[projectId];
    }

    // Capture previous state for rollback if user undoes
    const previousProjects = [...projects];
    const previousStudents = [...students];
    const previousUserProfile = userProfile ? { ...userProfile } : null;

    // 1. Optimistically remove from local state and localStorage immediately for a responsive UI
    setProjects(prev => {
      const updated = prev.filter(p => p.id !== projectId);
      localStorage.setItem('app_projects', JSON.stringify(updated));
      return updated;
    });

    setStudents(prev => {
      const updatedStudents = prev.map(s => {
        if (s.projectIds && s.projectIds.includes(projectId)) {
          const newProjectIds = s.projectIds.filter((pid: string) => pid !== projectId);
          const newProjectTasks = { ...(s.projectTasks || {}) };
          delete newProjectTasks[projectId];
          return {
            ...s,
            projectIds: newProjectIds,
            projectTasks: newProjectTasks,
            workStatus: newProjectIds.length > 0 ? 'Asignado' : 'Sin asignar'
          };
        }
        return s;
      });
      localStorage.setItem('app_students', JSON.stringify(updatedStudents));
      return updatedStudents;
    });

    if (userProfile && (userProfile.projectIds || []).includes(projectId)) {
      setUserProfile((prev: any) => {
        if (!prev) return prev;
        const newPids = (prev.projectIds || []).filter((pid: string) => pid !== projectId);
        return { ...prev, projectIds: newPids };
      });
    }

    let isUndone = false;

    // 2. Schedule Firestore soft-delete after 5 seconds
    const timer = setTimeout(async () => {
      delete pendingDeletionsRef.current[projectId];
      if (isUndone) return;

      try {
        // Soft-delete the project document in Firestore
        await updateDoc(doc(db, 'projects', projectId), {
          isDeleted: true,
          deletedAt: new Date().toISOString()
        });

        // Update enrolled students in Firestore
        const enrolledStudents = studentsWithRecords.filter(s => (s.projectIds || []).includes(projectId));
        for (const st of enrolledStudents) {
          const newPids = (st.projectIds || []).filter((pid: string) => pid !== projectId);
          const stRef = doc(db, 'users', st.id);
          await updateDoc(stRef, {
            projectIds: newPids,
            workStatus: newPids.length > 0 ? 'Asignado' : 'Sin asignar'
          }).catch(() => {});
          const pubRef = doc(db, 'public_profiles', st.id);
          await updateDoc(pubRef, {
            projectIds: newPids,
            workStatus: newPids.length > 0 ? 'Asignado' : 'Sin asignar'
          }).catch(() => {});
        }

        // Notify admins
        const admins = await getProjectAdmins(projectId);
        const currentUserProfile = getStudentData(user?.uid || '') || { 
          firstName: 'Usuario', 
          lastNamePaterno: 'Desconocido', 
          uid: user?.uid || '' 
        };

        for (const admin of admins) {
          if (admin.uid !== user?.uid) {
            await notifyProjectDeleted(admin.uid, projectToDelete, currentUserProfile);
          }
        }
      } catch (error) {
        console.error('Error soft-deleting project:', error);
        handleFirestoreError(error, OperationType.DELETE, `projects/${projectId}`);
      }
    }, 5000);

    pendingDeletionsRef.current[projectId] = timer;

    // 3. Display Toast notification with countdown and UNDO button
    toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-slate-900 dark:bg-[#1e1e1e] text-white shadow-2xl rounded-2xl pointer-events-auto flex flex-col p-4 border border-slate-700/60 dark:border-white/10`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center shrink-0 border border-red-500/30">
              <Trash2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black truncate text-white">
                "{projectToDelete.name}" eliminado
              </p>
              <p className="text-[10px] font-semibold text-slate-400">
                Se confirmará en 5 segundos...
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              isUndone = true;
              clearTimeout(timer);
              delete pendingDeletionsRef.current[projectId];
              toast.dismiss(t.id);

              // Restore local state and localStorage
              setProjects(previousProjects);
              localStorage.setItem('app_projects', JSON.stringify(previousProjects));
              setStudents(previousStudents);
              localStorage.setItem('app_students', JSON.stringify(previousStudents));
              if (previousUserProfile) {
                setUserProfile(previousUserProfile);
              }
              toast.success(`Eliminación cancelada. "${projectToDelete.name}" restaurado.`);
            }}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-indigo-600/30 active:scale-95 cursor-pointer"
          >
            <Undo2 size={14} />
            Deshacer
          </button>
        </div>
        {/* Animated progress bar for 5 seconds countdown */}
        <div className="w-full bg-slate-800 rounded-full h-1 mt-3 overflow-hidden">
          <div
            className="bg-indigo-500 h-full rounded-full transition-all duration-[5000ms] ease-linear w-0"
            style={{ width: t.visible ? '100%' : '0%' }}
          />
        </div>
      </div>
    ), { duration: 5000, id: `delete-project-${projectId}` });
  };

  const [view, setView] = useState('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  
  const handleNavigate = (projectId: string, taskId?: string) => {
    setSelectedProjectId(projectId);
    if (taskId) setSelectedTaskId(taskId);
    setView('project-workspace');
    setIsNotificationCenterOpen(false);
    setIsMobileMenuOpen(false);
  };

  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications(user?.uid);
  const initialViewRef = useRef(false);

  useEffect(() => {
    if (userProfile && !initialViewRef.current) {
      setView(userProfile.role === 'user' ? 'user-dashboard' : 'dashboard');
      initialViewRef.current = true;
    }
  }, [userProfile]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null); // To identify the logged-in user
  const [calendarMode, setCalendarMode] = useState('grid');
  const [calendarFilterAll, setCalendarFilterAll] = useState(true);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedRecords, setSelectedRecords] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [studentFormErrors, setStudentFormErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterWork, setFilterWork] = useState('Todos');
  const [filterProject, setFilterProject] = useState('Todos');
  const [filterCategories, setFilterCategories] = useState<string[]>([]);
  const categoriesLoadedRef = useRef(false);
  
  useEffect(() => {
    if (categories.length > 0 && !categoriesLoadedRef.current) {
      setFilterCategories(categories.map(c => c.id));
      categoriesLoadedRef.current = true;
    }
  }, [categories]);
  const [filterCareer, setFilterCareer] = useState('Todos');
  const [filterBrigade, setFilterBrigade] = useState('Todos');
  const [sortHours, setSortHours] = useState<'none' | 'asc' | 'desc'>('none');
  const [isExporting, setIsExporting] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<'students' | 'coordinators' | 'archived'>('students');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterProject !== 'Todos') count++;
    if (filterCareer !== 'Todos') count++;
    if (filterBrigade !== 'Todos') count++;
    if (filterStatus !== 'Todos') count++;
    if (filterWork !== 'Todos') count++;
    if (sortHours !== 'none') count++;
    if (searchTerm.trim()) count++;
    return count;
  }, [filterProject, filterCareer, filterBrigade, filterStatus, filterWork, sortHours, searchTerm]);

  const handleResetFilters = () => {
    setSearchTerm('');
    setFilterStatus('Todos');
    setFilterWork('Todos');
    setFilterProject('Todos');
    setFilterCareer('Todos');
    setFilterBrigade('Todos');
    setSortHours('none');
  };

  const showArchived = dashboardTab === 'archived';
  const setShowArchived = (val: boolean) => setDashboardTab(val ? 'archived' : 'students');
  const [calendarDateFilter, setCalendarDateFilter] = useState('');
  const [calendarStudentFilter, setCalendarStudentFilter] = useState('');
  const [studentPage, setStudentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(10);
  const [sessionPage, setSessionPage] = useState(1);
  const [sessionSortOrder, setSessionSortOrder] = useState<'desc' | 'asc'>('desc');
  const sessionsPerPage = 5;

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showBulkProjectAssign, setShowBulkProjectAssign] = useState(false);
  const [selectedStudentsForBulk, setSelectedStudentsForBulk] = useState<string[]>([]);
  const [selectedProjectsForBulk, setSelectedProjectsForBulk] = useState<string[]>([]);
  const [showEditStudent, setShowEditStudent] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfileForm, setEditingProfileForm] = useState<any>(null);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rejectedNotifications, setRejectedNotifications] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;
    let isCancelled = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser) {
        setUserProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
        setLoading(false);
        return;
      }

      setLoading(true);

      const effectiveRole = getEffectiveRole(currentUser.email);
      const isCoordinatorOrAdmin = effectiveRole !== 'user';

      // 1. Optimistic recovery from localStorage
      const cachedProfileRaw = localStorage.getItem(`profile_${currentUser.uid}`) || 
                               (currentUser.email ? localStorage.getItem(`profile_${currentUser.email.toLowerCase()}`) : null);
      if (cachedProfileRaw) {
        try {
          const cachedProfile = JSON.parse(cachedProfileRaw);
          if (cachedProfile && (cachedProfile.uid === currentUser.uid || cachedProfile.email?.toLowerCase() === currentUser.email?.toLowerCase())) {
            setUserProfile(cachedProfile);
          }
        } catch (e) {
          console.warn("Could not parse cached profile:", e);
        }
      }

      // 2. Set up real-time listener for doc(db, 'users', currentUser.uid)
      const docRef = doc(db, 'users', currentUser.uid);
      unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
        if (isCancelled) return;

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (currentUser.email?.toLowerCase() === 'legc.1794@gmail.com' && data.role !== 'user') {
            data.role = 'user';
            setDoc(docRef, { role: 'user', updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
            setDoc(doc(db, 'public_profiles', currentUser.uid), { role: 'user', updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
          }
          if (currentUser.email?.toLowerCase() === MASTER_COORDINATOR_EMAIL.toLowerCase() && data.role !== 'master_coordinator') {
            data.role = 'master_coordinator';
            setDoc(docRef, { role: 'master_coordinator', updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
            setDoc(doc(db, 'public_profiles', currentUser.uid), { role: 'master_coordinator', updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
          }
          if (data.records) {
            data.records = dedupeById(data.records);
          }
          const profileData = { ...data, id: currentUser.uid, uid: currentUser.uid };
          setUserProfile(profileData);
          localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(profileData));
          if (currentUser.email) {
            localStorage.setItem(`profile_${currentUser.email.toLowerCase()}`, JSON.stringify(profileData));
          }
          
          // Sync current user profile into students list
          setStudents(prev => {
            const exists = prev.find(s => s.id === currentUser.uid);
            const name = `${data.firstName || ''} ${data.lastNamePaterno || ''} ${data.lastNameMaterno || ''}`.trim() || 'Sin nombre';
            if (exists) {
              return prev.map(s => s.id === currentUser.uid ? { ...s, ...profileData, name } : s);
            }
            return [...prev, { ...profileData, name }];
          });
          setLoading(false);
        } else {
          // Document does not exist at users/{currentUser.uid}
          try {
            let recoveredData: any = null;
            const userEmail = (currentUser.email || '').toLowerCase().trim();

            // Search 2a: Query 'users' by email
            if (userEmail) {
              try {
                const qUsers = query(collection(db, 'users'), where('email', '==', userEmail));
                const snapUsers = await getDocs(qUsers);
                if (!snapUsers.empty) {
                  recoveredData = snapUsers.docs[0].data();
                } else if (currentUser.email && currentUser.email !== userEmail) {
                  const qExact = query(collection(db, 'users'), where('email', '==', currentUser.email));
                  const snapExact = await getDocs(qExact);
                  if (!snapExact.empty) recoveredData = snapExact.docs[0].data();
                }
              } catch (errUsers) {
                console.warn("Could not query 'users' by email:", errUsers);
              }
            }

            // Search 2b: Search 'public_profiles'
            if (!recoveredData) {
              try {
                const pubSnap = await getDoc(doc(db, 'public_profiles', currentUser.uid));
                if (pubSnap.exists()) {
                  recoveredData = pubSnap.data();
                } else if (userEmail) {
                  const pubSnapEmail = await getDoc(doc(db, 'public_profiles', userEmail));
                  if (pubSnapEmail.exists()) {
                    recoveredData = pubSnapEmail.data();
                  } else {
                    const qPub = query(collection(db, 'public_profiles'), where('email', '==', userEmail));
                    const snapPub = await getDocs(qPub);
                    if (!snapPub.empty) recoveredData = snapPub.docs[0].data();
                  }
                }
              } catch (errPub) {
                console.warn("Could not query 'public_profiles':", errPub);
              }
            }

            // Search 2c: Search initial / cached students array
            if (!recoveredData && userEmail) {
              const matchedStudent = students.find(s => (s.email || '').toLowerCase().trim() === userEmail);
              if (matchedStudent) {
                recoveredData = matchedStudent;
              }
            }

            if (recoveredData) {
              const consolidatedProfile = {
                ...recoveredData,
                id: currentUser.uid,
                uid: currentUser.uid,
                email: currentUser.email || recoveredData.email,
                role: (currentUser.email?.toLowerCase() === MASTER_COORDINATOR_EMAIL.toLowerCase()) ? 'master_coordinator' : (recoveredData.role || effectiveRole),
                updatedAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'users', currentUser.uid), consolidatedProfile, { merge: true });
              await setDoc(doc(db, 'public_profiles', currentUser.uid), consolidatedProfile, { merge: true });
              setUserProfile(consolidatedProfile);
              localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(consolidatedProfile));
              if (currentUser.email) {
                localStorage.setItem(`profile_${currentUser.email.toLowerCase()}`, JSON.stringify(consolidatedProfile));
              }
              setLoading(false);
              return;
            }

            // Search 2d: If coordinator or admin, auto-provision profile
            if (isCoordinatorOrAdmin) {
              const isMaster = currentUser.email?.toLowerCase() === MASTER_COORDINATOR_EMAIL.toLowerCase();
              const nameParts = (currentUser.displayName || '').trim().split(' ').filter(Boolean);
              const firstName = nameParts[0] || (isMaster ? 'Luis Edgar' : 'Coordinador');
              const lastNamePaterno = nameParts[1] || (isMaster ? 'Gutiérrez' : '');
              const lastNameMaterno = nameParts.slice(2).join(' ') || (isMaster ? 'Cornejo' : '');
              
              const coordinatorProfile = {
                uid: currentUser.uid,
                id: currentUser.uid,
                email: currentUser.email,
                firstName,
                lastNamePaterno,
                lastNameMaterno,
                name: currentUser.displayName || `${firstName} ${lastNamePaterno} ${lastNameMaterno}`.trim(),
                phone: '5555555555',
                studentId: isMaster ? 'COORD-MAESTRO' : 'COORD-ADMIN',
                career: 'Arquitectura',
                brigadePeriod: 'General',
                brigade: 'Coordinación General',
                role: isMaster ? 'master_coordinator' : (effectiveRole || 'super_coordinator'),
                status: 'Coordinador',
                workStatus: isMaster ? 'Coordinador Maestro' : 'Supercoordinador',
                skills: ['Gestión', 'Coordinación', 'Supervisión'],
                skillRatings: [],
                projectIds: [],
                records: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              
              await setDoc(doc(db, 'users', currentUser.uid), coordinatorProfile, { merge: true });
              await setDoc(doc(db, 'public_profiles', currentUser.uid), coordinatorProfile, { merge: true });
              setUserProfile(coordinatorProfile);
              localStorage.setItem(`profile_${currentUser.uid}`, JSON.stringify(coordinatorProfile));
              if (currentUser.email) {
                localStorage.setItem(`profile_${currentUser.email.toLowerCase()}`, JSON.stringify(coordinatorProfile));
              }
              setLoading(false);
              return;
            }

            // Only regular student with genuinely no profile:
            localStorage.removeItem(`profile_${currentUser.uid}`);
            if (currentUser.email) {
              localStorage.removeItem(`profile_${currentUser.email.toLowerCase()}`);
            }
            setUserProfile(null);
            setLoading(false);
          } catch (recoveryErr) {
            console.error("Error during profile recovery:", recoveryErr);
            setLoading(false);
          }
        }
      }, (error) => {
        console.error("Error listening to user profile:", error);
        // Fallback to local storage on error
        const localProfile = localStorage.getItem(`profile_${currentUser.uid}`) || 
                             (currentUser.email ? localStorage.getItem(`profile_${currentUser.email.toLowerCase()}`) : null);
        if (localProfile) {
          try {
            const data = JSON.parse(localProfile);
            if (data.records) {
              data.records = dedupeById(data.records);
            }
            setUserProfile(data);
          } catch (e) {
            console.error("Could not parse fallback profile:", e);
          }
        }
        setLoading(false);
      });
    });

    return () => {
      isCancelled = true;
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('app_students', JSON.stringify(students));
  }, [students]);

  useEffect(() => {
    localStorage.setItem('app_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('app_projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    if (userProfile) {
      const effectiveRole = getEffectiveRole(user?.email, userProfile.role);
      setUserRole(effectiveRole);
      setCurrentUserId(userProfile.uid || null);
      
      if (userProfile.records) {
        const unacknowledged = userProfile.records.filter((r: any) => 
          r.validationStatus === 'rechazado' && r.acknowledgedRejection === false
        );
        setRejectedNotifications(dedupeById(unacknowledged));
      } else {
        setRejectedNotifications([]);
      }

      if (userProfile.role === 'user') {
        // Asegurar que el estudiante existe en la lista local
        setStudents(prev => {
          if (!prev.find(s => s.id === userProfile.uid)) {
            return [...prev, {
              id: userProfile.uid,
              firstName: userProfile.firstName,
              lastNamePaterno: userProfile.lastNamePaterno,
              lastNameMaterno: userProfile.lastNameMaterno,
              studentId: userProfile.studentId,
              name: `${userProfile.firstName} ${userProfile.lastNamePaterno} ${userProfile.lastNameMaterno}`,
              email: userProfile.email,
              phone: userProfile.phone,
              career: userProfile.career,
              brigadePeriod: userProfile.brigadePeriod || '2024-1',
              brigade: userProfile.brigade || '',
              skills: userProfile.skills || [],
              skillRatings: userProfile.skillRatings || [],
              status: 'En Curso',
              workStatus: 'Sin asignar',
              projectIds: userProfile.projectIds || [],
              records: userProfile.records || []
            }];
          }
          return prev;
        });
      }
    }
  }, [userProfile]);
  // Automatización: Finalizar y Archivar al llegar a 480 horas
  useEffect(() => {
    if (userRole === 'admin' || userRole === 'coordinator') {
      const finalizeStudents = async () => {
        let hasUpdates = false;
        const studentsToUpdateLocally: string[] = [];

        for (const student of studentsWithRecords) {
          if (student.email && SUPER_ADMIN_EMAILS.includes(student.email)) continue;

          const approvedHours = getStudentApprovedHours(student);
          const isEligibleForFinalize = (approvedHours >= TOTAL_REQUIRED_HOURS || (student.status || '').toLowerCase() === 'finalizado');

          // Trigger when >= 480 and not already finalized/archived in base students list
          if (isEligibleForFinalize && (!student.isArchived || student.status !== 'Finalizado' || student.workStatus !== 'Finalizado')) {
            hasUpdates = true;
            studentsToUpdateLocally.push(student.id);

            const updateData = {
              status: 'Finalizado',
              projectIds: [], // Desenrolar de todos los proyectos
              isArchived: true, // Archivar expediente
              finalizedAt: student.finalizedAt || new Date().toISOString(),
              workStatus: 'Finalizado'
            };

            try {
              const studentRef = doc(db, 'users', student.id);
              await setDoc(studentRef, updateData, { merge: true });
            } catch (err) {
              console.warn(`Error updating user ${student.id} in Firestore:`, err);
            }

            try {
              const publicRef = doc(db, 'public_profiles', student.id);
              await setDoc(publicRef, updateData, { merge: true });
            } catch (err) {
              console.warn(`Error updating public profile for ${student.id}:`, err);
            }
            
            toast.success(`🎉 El alumno ${getFullName(student)} ha completado sus ${TOTAL_REQUIRED_HOURS} horas. Ha sido finalizado y archivado.`, {
              duration: 6000,
              icon: '🎓'
            });
          }
        }

        if (hasUpdates && studentsToUpdateLocally.length > 0) {
          setStudents(prev => {
            const next = prev.map(s => {
              if (studentsToUpdateLocally.includes(s.id)) {
                return {
                  ...s,
                  status: 'Finalizado',
                  projectIds: [],
                  isArchived: true,
                  workStatus: 'Finalizado',
                  finalizedAt: s.finalizedAt || new Date().toISOString()
                };
              }
              return s;
            });
            localStorage.setItem('app_students', JSON.stringify(next));
            return next;
          });
        }
      };

      finalizeStudents();
    }
  }, [studentsWithRecords, userRole]);

  useEffect(() => {
    if (!user || !userRole) return;

    const sessionsQuery = userRole === 'user' 
      ? query(collection(db, 'sesiones'), where('userId', '==', user.uid))
      : collection(db, 'sesiones');

    const unsubscribe = onSnapshot(sessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setSessions(sessionsData);
      
      // Update userProfile if it's the current user's sessions
      if (user) {
        const mySessions = sessionsData
          .filter((s: any) => s.userId === user.uid)
          .map((s: any) => ({
            ...s,
            hours: s.horasCalculadas,
            validationStatus: s.estado
          }));
        setUserProfile(prev => prev ? { ...prev, records: dedupeById(mySessions) } : null);
      }
    }, (error) => {
      console.error("Error listening to sessions:", error);
      handleFirestoreError(error, OperationType.LIST, 'sesiones');
    });

    return () => unsubscribe();
  }, [user, userRole]);

  useEffect(() => {
    if (loading || !user) return;
    
    setIsLoadingConfig(true);
    
    // Listen to Projects
    const unsubProjects = onSnapshot(collection(db, 'projects'), async (snapshot) => {
      if (!snapshot.empty) {
        const projectsData = snapshot.docs
          .map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              isDeleted: data.isDeleted === true ? true : false,
            };
          })
          .filter((p: any) => p.isDeleted !== true);
        
        // Merge with DEFAULT_PROJECTS to ensure default projects are always available
        const mergedProjectsMap = new Map<string, any>();
        DEFAULT_PROJECTS.forEach(p => mergedProjectsMap.set(p.id, p));
        projectsData.forEach(p => mergedProjectsMap.set(p.id, { ...(mergedProjectsMap.get(p.id) || {}), ...p }));
        setProjects(Array.from(mergedProjectsMap.values()));
      } else {
        setProjects(DEFAULT_PROJECTS);
        if (userRole !== 'user') {
          for (const p of DEFAULT_PROJECTS) {
            setDoc(doc(db, 'projects', p.id), p, { merge: true }).catch(console.warn);
          }
        }
      }
      setIsLoadingConfig(false);
    }, (error) => {
      console.error("Error listening to projects:", error);
      setProjects(prev => prev.length > 0 ? prev : DEFAULT_PROJECTS);
      setIsLoadingConfig(false);
    });

    // Listen to Categories
    const unsubCategories = onSnapshot(collection(db, 'categories'), async (snapshot) => {
      if (!snapshot.empty) {
        const categoriesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const mergedCatMap = new Map<string, any>();
        DEFAULT_CATEGORIES.forEach(c => mergedCatMap.set(c.id, c));
        categoriesData.forEach(c => mergedCatMap.set(c.id, { ...(mergedCatMap.get(c.id) || {}), ...c }));
        setCategories(Array.from(mergedCatMap.values()));
      } else {
        setCategories(DEFAULT_CATEGORIES);
        if (userRole !== 'user') {
          for (const c of DEFAULT_CATEGORIES) {
            setDoc(doc(db, 'categories', c.id), c, { merge: true }).catch(console.warn);
          }
        }
      }
    }, (error) => {
      console.error("Error listening to categories:", error);
      setCategories(prev => prev.length > 0 ? prev : DEFAULT_CATEGORIES);
    });

    return () => {
      unsubProjects();
      unsubCategories();
    };
  }, [user, userRole, loading]);

  useEffect(() => {
    if (user && userRole) {
      if (userRole !== 'user') {
        // Real-time sync for admins/coordinators
        const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
          const studentsData = snapshot.docs.map(uDoc => {
            const data = uDoc.data();
            if (data.email?.toLowerCase() === 'legc.1794@gmail.com' && data.role !== 'user') {
              data.role = 'user';
              setDoc(doc(db, 'users', uDoc.id), { role: 'user', updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
              setDoc(doc(db, 'public_profiles', uDoc.id), { role: 'user', updatedAt: new Date().toISOString() }, { merge: true }).catch(console.warn);
            }
            const directHours = Math.max(
              Number(data.horasTotales || 0),
              Number(data.accumulatedHours || 0),
              Number(data.totalHours || 0),
              Number(data.horasAcumuladas || 0),
              Number(data.horasAprobadas || 0),
              Number(data.approvedHours || 0),
              Number(data.hours || 0)
            );
            const nameCheck = `${data.firstName || ''} ${data.lastNamePaterno || ''} ${data.lastNameMaterno || ''} ${data.lastName || ''} ${data.name || ''} ${data.displayName || ''} ${data.nickname || ''} ${data.email || ''}`.toLowerCase();
            const isKarla = (nameCheck.includes('karla') && nameCheck.includes('espinoza')) || nameCheck.includes('karla espinoza');
            const isFinalized = (data.status || '').toLowerCase() === 'finalizado' || (data.workStatus || '').toLowerCase() === 'finalizado' || directHours >= TOTAL_REQUIRED_HOURS || isKarla;
            return {
              id: uDoc.id,
              ...data,
              isArchived: Boolean(data.isArchived || isFinalized),
              status: isFinalized ? 'Finalizado' : (data.status || 'En Curso'),
              workStatus: isFinalized ? 'Finalizado' : (data.workStatus || ((data.projectIds && data.projectIds.length > 0) ? 'Asignado' : 'Sin asignar')),
              name: `${data.firstName || ''} ${data.lastNamePaterno || ''} ${data.lastNameMaterno || ''}`.trim() || data.name || 'Sin nombre'
            };
          });
          
          setStudents(prev => {
            const studentMap = new Map<string, any>();
            // 1. Base list of all initial students, coordinators, and archived profiles
            INITIAL_STUDENTS.forEach(s => studentMap.set(s.id, s));

            // 2. Overlay existing in-memory students
            prev.forEach(s => {
              const existing = studentMap.get(s.id) || {};
              studentMap.set(s.id, {
                ...existing,
                ...s,
                records: dedupeById([...(existing.records || []), ...(s.records || [])])
              });
            });

            // 3. Overlay Firestore documents matching by id, uid, or email
            studentsData.forEach((fsUser: any) => {
              let matchKey = fsUser.id;
              for (const [key, st] of Array.from(studentMap.entries()) as [string, any][]) {
                if (key === fsUser.id || st.uid === fsUser.id || (fsUser.email && st.email?.toLowerCase() === fsUser.email.toLowerCase())) {
                  matchKey = key;
                  break;
                }
              }
              const current = studentMap.get(matchKey) || {};
              studentMap.set(matchKey, {
                ...current,
                ...fsUser,
                id: fsUser.id || matchKey,
                records: dedupeById([...(current.records || []), ...(fsUser.records || [])])
              });
            });

            return Array.from(studentMap.values());
          });
          setIsLoadingStudents(false);
        }, (error) => {
            console.error("Error listening to students:", error);
            handleFirestoreError(error, OperationType.LIST, 'users');
            setIsLoadingStudents(false);
          });
        return () => unsubscribe();
      } else {
        // One-time fetch for public profiles for regular users
        const fetchStudents = async () => {
          setIsLoadingStudents(true);
          try {
            const querySnapshot = await getDocs(collection(db, 'public_profiles'));
            const studentsData = querySnapshot.docs.map(doc => {
              const data = doc.data();
              const directHours = Math.max(
                Number(data.horasTotales || 0),
                Number(data.accumulatedHours || 0),
                Number(data.totalHours || 0),
                Number(data.horasAcumuladas || 0),
                Number(data.horasAprobadas || 0),
                Number(data.approvedHours || 0),
                Number(data.hours || 0)
              );
              const nameCheck = `${data.firstName || ''} ${data.lastNamePaterno || ''} ${data.lastNameMaterno || ''} ${data.lastName || ''} ${data.name || ''} ${data.displayName || ''} ${data.nickname || ''} ${data.email || ''}`.toLowerCase();
              const isKarla = (nameCheck.includes('karla') && nameCheck.includes('espinoza')) || nameCheck.includes('karla espinoza');
              const isFinalized = (data.status || '').toLowerCase() === 'finalizado' || (data.workStatus || '').toLowerCase() === 'finalizado' || directHours >= TOTAL_REQUIRED_HOURS || isKarla;
              return {
                id: doc.id,
                ...data,
                isArchived: Boolean(data.isArchived || isFinalized),
                status: isFinalized ? 'Finalizado' : (data.status || 'En Curso'),
                workStatus: isFinalized ? 'Finalizado' : (data.workStatus || ((data.projectIds && data.projectIds.length > 0) ? 'Asignado' : 'Sin asignar')),
                name: `${data.firstName || ''} ${data.lastNamePaterno || ''} ${data.lastNameMaterno || ''}`.trim() || data.name || 'Sin nombre'
              };
            });
            
            setStudents(prev => {
              const studentMap = new Map<string, any>();
              INITIAL_STUDENTS.forEach(s => studentMap.set(s.id, s));
              prev.forEach(s => {
                const existing = studentMap.get(s.id) || {};
                studentMap.set(s.id, {
                  ...existing,
                  ...s,
                  records: dedupeById([...(existing.records || []), ...(s.records || [])])
                });
              });
              studentsData.forEach((fsUser: any) => {
                let matchKey = fsUser.id;
                for (const [key, st] of Array.from(studentMap.entries()) as [string, any][]) {
                  if (key === fsUser.id || st.uid === fsUser.id || (fsUser.email && st.email?.toLowerCase() === fsUser.email.toLowerCase())) {
                    matchKey = key;
                    break;
                  }
                }
                const current = studentMap.get(matchKey) || {};
                studentMap.set(matchKey, {
                  ...current,
                  ...fsUser,
                  id: fsUser.id || matchKey,
                  records: dedupeById([...(current.records || []), ...(fsUser.records || [])])
                });
              });
              return Array.from(studentMap.values());
            });
          } catch (error: any) {
            console.error("Error fetching students:", error);
            const isPermissionError = error?.code === 'permission-denied' || (error instanceof Error && error.message.includes('Missing or insufficient permissions'));
            if (!isPermissionError) {
              handleFirestoreError(error, OperationType.LIST, 'public_profiles');
            }
          } finally {
            setIsLoadingStudents(false);
          }
        };
        fetchStudents();
      }
    }
  }, [user, userRole]);

  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newInlineCat, setNewInlineCat] = useState({ name: '', color: '#6366f1' });
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [showManualHours, setShowManualHours] = useState(false);
  const [manualHoursStudentId, setManualHoursStudentId] = useState<string>('');
  const [manualHoursSearch, setManualHoursSearch] = useState<string>('');
  const [manualHoursForm, setManualHoursForm] = useState({ hours: 0, category: 'Otra Brigada', date: getCDMXDateString() });
  const [activityStudentSearch, setActivityStudentSearch] = useState<string>('');
  const [editingCalendarRecord, setEditingCalendarRecord] = useState<any | null>(null);
  const [calendarEditForm, setCalendarEditForm] = useState({
    date: getCDMXDateString(),
    startTime: '09:00',
    endTime: '13:00',
    hours: 4,
    isManualHours: false,
    categoryId: '',
    projectId: '',
    description: '',
    studentId: '',
    status: 'A'
  });
  const [isSavingCalendarEdit, setIsSavingCalendarEdit] = useState(false);

  // Estados para agregar más alumnos activos a una actividad
  const [targetActivityForAddingStudents, setTargetActivityForAddingStudents] = useState<any | null>(null);
  const [selectedStudentsToAdd, setSelectedStudentsToAdd] = useState<string[]>([]);
  const [searchStudentsToAdd, setSearchStudentsToAdd] = useState<string>('');
  const [isSavingStudentsToActivity, setIsSavingStudentsToActivity] = useState(false);

  // Estados para cambiar categoría y asignación a proyecto de una actividad
  const [activityToChangeCategoryProject, setActivityToChangeCategoryProject] = useState<any | null>(null);
  const [changeCategoryForm, setChangeCategoryForm] = useState({
    categoryId: '',
    projectId: ''
  });
  const [isSavingCategoryProjectChange, setIsSavingCategoryProjectChange] = useState(false);

  const [tagInputs, setTagInputs] = useState<any>({});
  const [activeSuggestionProject, setActiveSuggestionProject] = useState<string | null>(null);

  const getStudentData = (sId: string) => {
    const studentInList = studentsWithRecords.find(s => s.id === sId || s.uid === sId);
    if ((sId === user?.uid || sId === userProfile?.uid) && (userProfile || user)) {
      const coordinatorSessions = sessions
        .filter((s: any) => 
          s.userId === user?.uid || 
          s.studentId === user?.uid || 
          (userProfile?.uid && (s.userId === userProfile.uid || s.studentId === userProfile.uid)) ||
          s.userId === sId ||
          s.studentId === sId
        )
        .map((s: any) => {
          const isAppr = s.estado === 'aprobado' || s.validationStatus === 'aprobado';
          const isRej = s.estado === 'rechazado' || s.validationStatus === 'rechazado';
          const isDisp = s.estado === 'disputado' || s.validationStatus === 'disputado';
          const validationStatus = isAppr ? 'aprobado' : isRej ? 'rechazado' : isDisp ? 'disputado' : (s.estado || s.validationStatus || 'pendiente');
          return {
            ...s,
            hours: Number(s.horasCalculadas ?? s.hours ?? 0),
            horasCalculadas: Number(s.horasCalculadas ?? s.hours ?? 0),
            validationStatus,
            estado: validationStatus
          };
        });

      const mergedRecords = dedupeById([
        ...(studentInList?.records || []),
        ...(userProfile?.records || []),
        ...coordinatorSessions
      ]);

      const approvedHoursCalc = mergedRecords.reduce((acc: number, r: any) => {
        if (r.validationStatus === 'aprobado' || r.estado === 'aprobado') {
          return acc + Number(r.hours || r.horasCalculadas || 0);
        }
        return acc;
      }, 0);

      const resolvedRole = getEffectiveRole(userProfile?.email || user?.email, userProfile?.role || studentInList?.role);
      const isPureCoord = (resolvedRole === 'coordinator' || resolvedRole === 'super_coordinator' || resolvedRole === 'master_coordinator' || userProfile?.role === 'admin' || Boolean(user?.email && SUPER_ADMIN_EMAILS.includes(user.email))) && resolvedRole !== 'student_coordinator';

      return { 
        ...userProfile,
        ...studentInList,
        id: userProfile?.uid || user?.uid || sId,
        uid: userProfile?.uid || user?.uid || sId,
        name: userProfile?.name || `${userProfile?.firstName || ''} ${userProfile?.lastNamePaterno || ''}`.trim() || user?.displayName || 'Coordinador',
        records: mergedRecords,
        horasTotales: Math.max(Number(userProfile?.horasTotales || studentInList?.horasTotales || 0), approvedHoursCalc),
        status: isPureCoord ? 'Coordinador' : (userProfile?.status || studentInList?.status || 'En Curso'),
        projectIds: isPureCoord 
          ? projects.map((p: any) => p.id) 
          : ((userProfile?.projectIds && userProfile.projectIds.length > 0) 
            ? userProfile.projectIds 
            : (studentInList?.projectIds?.length ? studentInList.projectIds : (projects.length ? [projects[0].id] : [])))
      };
    }
    return studentInList;
  };

  const [studentForm, setStudentForm] = useState({
    firstName: '', lastNamePaterno: '', lastNameMaterno: '', nickname: '', phone: '', emergencyPhone: '', email: '', brigadePeriod: '',
    brigade: '', skills: [] as string[], skillRatings: [] as SkillRating[],
    studentId: '', serviceType: 'Prestador',
    career: 'Arquitectura', status: 'En Curso', workStatus: 'Sin asignar',
    projectIds: [] as string[], projectTasks: {} as any, projectTaskHistory: {} as any,
    role: 'user'
  });


  const [activityForm, setActivityForm] = useState({
    date: getCDMXDateString(),
    startTime: '09:00',
    endTime: '13:00',
    hours: 4,
    isManualHours: false,
    status: 'A',
    categoryId: '',
    projectId: '',
    description: '',
    evidenceLink: '',
    selectedStudentIds: [] as string[],
    studentStatuses: {} as any
  });

  const [currentMonth, setCurrentMonth] = useState(new Date());

  const selectedStudent = useMemo(() => getStudentData(selectedStudentId), [studentsWithRecords, selectedStudentId, userProfile, user]);

  const projectTagsBank = useMemo(() => {
    const bank: any = {};
    projects.forEach(p => bank[p.id] = new Set());
    students.forEach(student => {
      Object.entries(student.projectTasks || {}).forEach(([projectId, tasks]: any) => {
        if (!bank[projectId]) bank[projectId] = new Set();
        tasks.forEach((task: string) => bank[projectId].add(task));
      });
    });
    return Object.fromEntries(Object.entries(bank).map(([k, v]: any) => [k, Array.from(v)]));
  }, [students, projects]);

  useEffect(() => {
    if (activityForm.isManualHours) return;
    const isIndividualView = view === 'individual-activity' || view === 'student-detail';
    if (isIndividualView && activityForm.status !== 'A') {
      setActivityForm(prev => {
        if (prev.hours !== 0 || prev.evidenceLink !== '' || prev.description !== '') {
          return { ...prev, hours: 0, evidenceLink: '', description: '' };
        }
        return prev;
      });
      return;
    }
    const start = toMins(activityForm.startTime);
    const end = toMins(activityForm.endTime);
    const calcHours = end - start > 0 ? (end - start) / 60 : 0;
    setActivityForm(prev => prev.hours !== calcHours ? { ...prev, hours: calcHours } : prev);
  }, [activityForm.startTime, activityForm.endTime, activityForm.status, view, activityForm.isManualHours]);

  const uniqueCareers = useMemo(() => Array.from(new Set(students.filter(s => !s.email || !SUPER_ADMIN_EMAILS.includes(s.email)).map(s => s.career).filter(Boolean))).sort(), [students]);
  const uniqueBrigades = useMemo(() => Array.from(new Set(students.filter(s => !s.email || !SUPER_ADMIN_EMAILS.includes(s.email)).map(s => s.brigadePeriod).filter(Boolean))).sort(), [students]);

  const filteredStudents = useMemo(() => {
    let result = studentsWithRecords.filter(s => {
      const sEffectiveRole = getEffectiveRole(s.email, s.role);
      const isSuperAdminEmail = Boolean(s.email && SUPER_ADMIN_EMAILS.includes(s.email));
      const isCoordinatorOrAdmin = sEffectiveRole === 'coordinator' || sEffectiveRole === 'super_coordinator' || sEffectiveRole === 'master_coordinator' || s.role === 'admin' || isSuperAdminEmail;

      if (dashboardTab === 'coordinators') {
        if (!isCoordinatorOrAdmin) return false;
      } else {
        if (isCoordinatorOrAdmin) return false;
        
        // Filter by archived/finalized status
        const isFinishedOrArchived = Boolean(
          s.isArchived || 
          isStudentFinished(s) || 
          (s.status || '').toLowerCase() === 'finalizado' || 
          (s.status || '').toLowerCase() === 'concluido' ||
          (s.workStatus || '').toLowerCase() === 'finalizado' ||
          getStudentApprovedHours(s) >= TOTAL_REQUIRED_HOURS
        );

        if (dashboardTab === 'students' && isFinishedOrArchived) return false;
        if (dashboardTab === 'archived' && !isFinishedOrArchived) return false;
      }

      const matchStatus = dashboardTab === 'coordinators' || filterStatus === 'Todos' || s.status === filterStatus;
      const matchWork = dashboardTab === 'coordinators' || filterWork === 'Todos' || s.workStatus === filterWork;
      const matchProject = filterProject === 'Todos' || isCoordinatorOrAdmin || (s.projectIds || []).includes(filterProject);
      const matchCategory = filterCategories.length === categories.length || (s.records || []).some((r: any) => filterCategories.includes(r.categoryId));
      const matchCareer = filterCareer === 'Todos' || s.career === filterCareer;
      const matchBrigade = filterBrigade === 'Todos' || s.brigadePeriod === filterBrigade;
      const lowerSearch = searchTerm.toLowerCase();
      const hasMatchingTag = Object.values(s.projectTasks || {}).some((taskList: any) =>
        (taskList || []).some((tag: string) => (tag || '').toLowerCase().includes(lowerSearch))
      );
      const matchSearch = getFullName(s).toLowerCase().includes(lowerSearch) ||
                          (s.nickname || '').toLowerCase().includes(lowerSearch) ||
                          (s.career || '').toLowerCase().includes(lowerSearch) ||
                          (s.email || '').toLowerCase().includes(lowerSearch) ||
                          hasMatchingTag;
      return matchStatus && matchWork && matchProject && matchCategory && matchCareer && matchBrigade && matchSearch;
    });

    if (sortHours !== 'none') {
      result.sort((a, b) => {
        const aHours = getStudentApprovedHours(a);
        const bHours = getStudentApprovedHours(b);
        return sortHours === 'asc' ? aHours - bHours : bHours - aHours;
      });
    }
    return result;
  }, [studentsWithRecords, filterStatus, filterWork, filterProject, filterCareer, filterBrigade, searchTerm, sortHours, dashboardTab]);

  useEffect(() => {
    setStudentPage(1);
  }, [filterStatus, filterWork, filterProject, filterCareer, filterBrigade, searchTerm, sortHours, dashboardTab]);

  const paginatedStudents = useMemo(() => {
    const startIndex = (studentPage - 1) * studentsPerPage;
    return filteredStudents.slice(startIndex, startIndex + studentsPerPage);
  }, [filteredStudents, studentPage]);

  const totalStudentPages = Math.ceil(filteredStudents.length / studentsPerPage);

  const activeEligibleStudents = useMemo(() => {
    return studentsWithRecords.filter(s => {
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return false;
      if (s.isArchived) return false;
      const statusLower = (s.status || '').toLowerCase().trim();
      if (statusLower === 'baja' || statusLower === 'finalizado' || statusLower === 'inactivo' || statusLower === 'concluido') return false;
      const workStatusLower = (s.workStatus || '').toLowerCase().trim();
      if (workStatusLower === 'finalizado' || workStatusLower === 'baja' || workStatusLower === 'inactivo' || workStatusLower === 'concluido') return false;
      return !isStudentFinished(s);
    });
  }, [studentsWithRecords]);

  // Alumnxs activos actualmente enrolados en proyectos (para la sección de habilidades)
  const activeEnrolledStudents = useMemo(() => {
    return studentsWithRecords.filter(s => {
      // 1. Excluir coordinadores/supercoordinadores/admin - Solo alumnxs
      if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return false;
      const effectiveRole = getEffectiveRole(s.email, s.role);
      const isPureCoordinator = (effectiveRole === 'coordinator' || effectiveRole === 'super_coordinator' || effectiveRole === 'master_coordinator' || s.role === 'admin') && effectiveRole !== 'student_coordinator';
      if (isPureCoordinator) return false;

      // 2. Solo alumnos activos (no archivados, no baja, no concluido/finalizado, menos de 480 horas)
      if (s.isArchived) return false;
      if (isStudentFinished(s)) return false;
      const statusLower = (s.status || '').toLowerCase().trim();
      if (statusLower === 'baja' || statusLower === 'finalizado' || statusLower === 'inactivo' || statusLower === 'concluido' || statusLower === 'terminado') return false;
      const workStatusLower = (s.workStatus || '').toLowerCase().trim();
      if (workStatusLower === 'finalizado' || workStatusLower === 'baja' || workStatusLower === 'inactivo' || workStatusLower === 'concluido' || workStatusLower === 'terminado') return false;

      // 3. Actualmente enrolados en al menos un proyecto
      const hasProjects = Array.isArray(s.projectIds) && s.projectIds.length > 0;
      if (!hasProjects) return false;

      // Si la lista de proyectos está disponible, asegurar que al menos uno de sus proyectos no esté eliminado
      if (projects && projects.length > 0) {
        const isEnrolledInActiveProject = s.projectIds.some((pid: string) => 
          projects.some((p: any) => p.id === pid && !p.isDeleted)
        );
        if (!isEnrolledInActiveProject) return false;
      }

      return true;
    });
  }, [studentsWithRecords, projects]);

  const filteredActiveStudentsForActivity = useMemo(() => {
    if (!activityStudentSearch.trim()) return activeEligibleStudents;
    const q = activityStudentSearch.toLowerCase().trim();
    return activeEligibleStudents.filter(s => {
      const fullName = (s.name || getFullName(s) || '').toLowerCase();
      const nickname = (s.nickname || '').toLowerCase();
      const matricula = (s.studentId || '').toLowerCase();
      const career = (s.career || '').toLowerCase();
      const brigade = (s.brigadePeriod || '').toLowerCase();
      return fullName.includes(q) || nickname.includes(q) || matricula.includes(q) || career.includes(q) || brigade.includes(q);
    });
  }, [activeEligibleStudents, activityStudentSearch]);

  const filteredActiveStudentsForManualHours = useMemo(() => {
    if (!manualHoursSearch.trim()) return activeEligibleStudents;
    const q = manualHoursSearch.toLowerCase().trim();
    return activeEligibleStudents.filter(s => {
      const fullName = (s.name || getFullName(s) || '').toLowerCase();
      const nickname = (s.nickname || '').toLowerCase();
      const matricula = (s.studentId || '').toLowerCase();
      const career = (s.career || '').toLowerCase();
      return fullName.includes(q) || nickname.includes(q) || matricula.includes(q) || career.includes(q);
    });
  }, [activeEligibleStudents, manualHoursSearch]);

  const availableActiveStudentsForTargetActivity = useMemo(() => {
    if (!targetActivityForAddingStudents) return [];
    const existingIds = new Set(
      (targetActivityForAddingStudents.records || []).flatMap((r: any) => [r.studentId, r.userId]).filter(Boolean)
    );
    const existingNames = new Set(
      [
        ...(targetActivityForAddingStudents.participants || []),
        ...(targetActivityForAddingStudents.records || []).map((r: any) => r.studentName)
      ].filter(Boolean).map((p: any) => String(p).trim().toLowerCase())
    );
    return activeEligibleStudents.filter(s => {
      // Excluir si ya pertenece a la actividad
      if (existingIds.has(s.id) || (s.uid && existingIds.has(s.uid))) return false;
      const sFullName = (s.name || getFullName(s) || '').trim().toLowerCase();
      if (sFullName && existingNames.has(sFullName)) return false;
      
      // Debe estar estrictamente activo
      if (s.isArchived) return false;
      if (s.status === 'Baja' || s.status === 'Finalizado' || s.status === 'Inactivo') return false;
      if (s.workStatus === 'Finalizado' || s.workStatus === 'Baja') return false;
      if (isStudentFinished(s)) return false;
      return true;
    });
  }, [targetActivityForAddingStudents, activeEligibleStudents]);

  const filteredStudentsToAdd = useMemo(() => {
    const q = searchStudentsToAdd.toLowerCase().trim();
    if (!q) return availableActiveStudentsForTargetActivity;
    return availableActiveStudentsForTargetActivity.filter(s => {
      const fullName = (s.name || getFullName(s) || '').toLowerCase();
      const nickname = (s.nickname || '').toLowerCase();
      const matricula = (s.studentId || '').toLowerCase();
      const career = (s.career || '').toLowerCase();
      const brigade = (s.brigadePeriod || s.brigade || '').toLowerCase();
      return fullName.includes(q) || nickname.includes(q) || matricula.includes(q) || career.includes(q) || brigade.includes(q);
    });
  }, [availableActiveStudentsForTargetActivity, searchStudentsToAdd]);

  const allRecords = useMemo(() => {
    let base = studentsWithRecords.filter(s => !s.email || !SUPER_ADMIN_EMAILS.includes(s.email));
    
    // Si es un usuario normal O si el admin tiene activado el filtro personal
    const isSpecialRole = userRole === 'admin' || userRole === 'coordinator';
    if (userRole === 'user' || (isSpecialRole && !calendarFilterAll)) {
      base = base.filter(s => s.id === (user?.uid || currentUserId));
    } else if (isSpecialRole && calendarFilterAll && calendarStudentFilter) {
      // Filtro específico por alumno (solo para admins en modo general)
      base = base.filter(s => s.id === calendarStudentFilter);
    }
    
    const flat = base.flatMap(s => (s.records || []).map((r: any) => ({ ...r, studentName: s.name, studentId: s.id })));
    return dedupeById(flat);
  }, [studentsWithRecords, userRole, currentUserId, user?.uid, calendarFilterAll, calendarStudentFilter]);

  const paginatedSessions = useMemo(() => {
    if (!selectedStudent) return [];
    const startIndex = (sessionPage - 1) * sessionsPerPage;
    const sortedRecords = [...(selectedStudent.records || [])].sort((a: any, b: any) => {
      const dateA = new Date(`${a.date}T${a.startTime || '00:00'}`).getTime();
      const dateB = new Date(`${b.date}T${b.startTime || '00:00'}`).getTime();
      return sessionSortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return sortedRecords.slice(startIndex, startIndex + sessionsPerPage);
  }, [selectedStudent, sessionPage, sessionSortOrder]);

  const totalSessionPages = selectedStudent ? Math.ceil((selectedStudent.records || []).length / sessionsPerPage) : 0;

  const chartData = useMemo(() => {
    const hoursByProject: Record<string, { hours: number, color: string, studentCount: number }> = {};
    const hoursByCategory: Record<string, { hours: number, id: string }> = {};
    let totalCompletedHours = 0;

    projects.forEach(p => {
      hoursByProject[p.name] = { hours: 0, color: p.color || '#8884d8', studentCount: 0 };
    });
    hoursByProject['General'] = { hours: 0, color: '#94a3b8', studentCount: 0 };

    const validStudents = studentsWithRecords.filter(s => !s.email || !SUPER_ADMIN_EMAILS.includes(s.email));

    validStudents.forEach(s => {
      if (s.projectIds && s.projectIds.length > 0) {
        s.projectIds.forEach(pid => {
          const p = projects.find(proj => proj.id === pid);
          if (p && hoursByProject[p.name]) hoursByProject[p.name].studentCount++;
        });
      } else {
        hoursByProject['General'].studentCount++;
      }

      (s.records || []).forEach((r: any) => {
        if (r.validationStatus === 'aprobado') {
          totalCompletedHours += r.hours;
          
          if (r.projectId) {
            const proj = projects.find(p => p.id === r.projectId);
            const pName = proj?.name || 'Desconocido';
            if (hoursByProject[pName]) {
              hoursByProject[pName].hours += r.hours;
            } else {
              hoursByProject[pName] = { hours: r.hours, color: proj?.color || '#8884d8', studentCount: 0 };
            }
          } else {
            hoursByProject['General'].hours += r.hours;
          }

          if (r.categoryId) {
            const cat = categories.find(c => c.id === r.categoryId);
            const cName = cat?.name || 'Desconocida';
            if (!hoursByCategory[cName]) {
              hoursByCategory[cName] = { hours: 0, id: r.categoryId };
            }
            hoursByCategory[cName].hours += r.hours;
          }
        }
      });
    });

    const projectChartData = Object.entries(hoursByProject)
      .filter(([_, data]) => data.hours > 0 || data.studentCount > 0)
      .map(([name, data]) => ({ 
        name, 
        hours: data.hours, 
        color: data.color, 
        studentCount: data.studentCount,
        avgHours: data.studentCount > 0 ? data.hours / data.studentCount : 0
      }));
    
    const categoryChartData = Object.entries(hoursByCategory)
      .map(([name, data]) => ({ 
        name, 
        hours: filterCategories.includes(data.id) ? data.hours : 0, 
        actualHours: data.hours,
        id: data.id 
      }))
      .filter(entry => entry.actualHours > 0 || filterCategories.includes(entry.id));
    const totalRequired = validStudents.length * TOTAL_REQUIRED_HOURS;
    const progressPerc = totalRequired > 0 ? (totalCompletedHours / totalRequired) * 100 : 0;
    const avgHoursPerStudent = validStudents.length > 0 ? totalCompletedHours / validStudents.length : 0;

    return { projectChartData, categoryChartData, progressPerc, totalCompletedHours, totalRequired, avgHoursPerStudent, totalEnrolled: validStudents.length };
  }, [studentsWithRecords, projects, categories, filterCategories]);

  const [rejectingRecord, setRejectingRecord] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleRejectRecordProfile = async () => {
    if (!rejectingRecord || !selectedStudentId) return;

    const updatedStudents = students.map(s => s.id === selectedStudentId ? {
      ...s,
      records: (s.records || []).map((rec: any) => rec.id === rejectingRecord.id ? { 
        ...rec, 
        validationStatus: 'rechazado',
        rejectReason: rejectReason,
        acknowledgedRejection: false
      } : rec)
    } : s);
    setStudents(updatedStudents);

    try {
      await updateDoc(doc(db, 'sesiones', rejectingRecord.id), {
        estado: 'rechazado',
        rejectReason: rejectReason,
        acknowledgedRejection: false,
        updatedBy: auth.currentUser?.uid
      });
      
      const studentToUpdate = students.find(s => s.id === selectedStudentId);
      if (studentToUpdate && studentToUpdate.email) {
        const subject = encodeURIComponent("Registro de horas rechazado");
        const body = encodeURIComponent(`Hola ${studentToUpdate.name},\n\nTu registro de horas ha sido rechazado por el siguiente motivo:\n\n${rejectReason}\n\nPor favor revisa tu panel para más detalles.`);
        window.open(`mailto:${studentToUpdate.email}?subject=${subject}&body=${body}`, '_blank');
      }

      showSuccessToast("Sesión rechazada y notificación enviada");
      setRejectingRecord(null);
      setRejectReason('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedStudentId}`);
    }
  };

  const handleMakeCoordinator = async (studentId: string) => {
    try {
      const studentToUpdate = getStudentData(studentId);
      if (!studentToUpdate) return;

      const dataToSave = {
        ...studentToUpdate,
        uid: studentId,
        role: 'coordinator',
        createdAt: studentToUpdate.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'users', studentId), dataToSave, { merge: true });
      
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, role: 'coordinator' } : s));
      showSuccessToast("Privilegios de coordinador otorgados");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${studentId}`);
    }
  };

  const handleDemoteUser = async (studentId: string) => {
    try {
      const studentToUpdate = getStudentData(studentId);
      if (!studentToUpdate) return;

      const dataToSave = {
        ...studentToUpdate,
        uid: studentId,
        role: 'user',
        createdAt: studentToUpdate.createdAt || new Date().toISOString()
      };

      await setDoc(doc(db, 'users', studentId), dataToSave, { merge: true });
      
      setStudents(prev => prev.map(s => s.id === studentId ? { ...s, role: 'user' } : s));
      showSuccessToast("Privilegios removidos. Ahora es un usuario estándar.");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${studentId}`);
    }
  };

  const handleAcknowledgeRejection = async (recordId: string) => {
    if (!userProfile) return;
    
    setRejectedNotifications(prev => prev.filter(n => n.id !== recordId));

    try {
      await updateDoc(doc(db, 'sesiones', recordId), { acknowledgedRejection: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sesiones/${recordId}`);
    }
  };

  const checkTimeOverlap = (studentId: string, date: string, startTime: string, endTime: string, ignoreRecordId = null) => {
    if (!studentId || !startTime || !endTime) return false;
    const student = getStudentData(studentId);
    if (!student) return false;
    const newStart = toMins(startTime);
    const newEnd = toMins(endTime);
    return (student?.records || []).some((record: any) => {
      if (record.id === ignoreRecordId) return false;
      if (record.date !== date) return false;
      if (!record.startTime || !record.endTime) return false;
      const recStart = toMins(record.startTime);
      const recEnd = toMins(record.endTime);
      return (newStart < recEnd && newEnd > recStart);
    });
  };

  const handleAddStudent = () => {
    setStudentFormErrors({});
    try {
      studentSchema.parse(studentForm);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors: Record<string, string> = {};
        error.issues.forEach(issue => {
          const path = issue.path[0] as string;
          if (!errors[path]) errors[path] = issue.message;
        });
        setStudentFormErrors(errors);
        showErrorToast("Por favor corrige los errores en el formulario");
        return;
      }
    }

    const manualErrors: Record<string, string> = {};
    if (studentForm.phone && studentForm.phone.length < 8) { manualErrors.phone = "Teléfono requiere mín. 8 dígitos."; }
    if (studentForm.emergencyPhone && studentForm.emergencyPhone.length < 8) { manualErrors.emergencyPhone = "Protocolo SOS requiere mín. 8 dígitos."; }

    if (Object.keys(manualErrors).length > 0) {
      setStudentFormErrors(prev => ({ ...prev, ...manualErrors }));
      showErrorToast("Por favor corrige los errores en el formulario");
      return;
    }

    const existingStudent = getStudentData(selectedStudentId);
    const targetNewRole = studentForm.role || existingStudent?.role || 'user';
    const isBecomingCoordinator = targetNewRole === 'coordinator' || targetNewRole === 'super_coordinator' || targetNewRole === 'master_coordinator';
    const wasStudentWithHours = (existingStudent?.role || 'user') === 'user' || existingStudent?.role === 'student_coordinator';
    const derivedSkills = studentForm.skillRatings?.map((s: any) => s.name) || studentForm.skills || [];

    // Validación de certificación (horas mínimas) para alumnos regulares
    if (studentForm.status === 'Finalizado' && !isBecomingCoordinator) {
      const currentStudent = getStudentData(selectedStudentId);
      const totalHours = currentStudent ? (currentStudent.records || []).reduce((acc: number, r: any) => {
        if (r.validationStatus === 'aprobado') return acc + r.hours;
        return acc;
      }, 0) : 0;
      
      if (totalHours < TOTAL_REQUIRED_HOURS) {
        setStudentFormErrors(prev => ({ 
          ...prev, 
          status: `No se puede certificar: el alumno solo tiene ${Number(totalHours.toFixed(2))} de ${TOTAL_REQUIRED_HOURS} horas requeridas.` 
        }));
        showErrorToast(`El alumno no cumple con las ${TOTAL_REQUIRED_HOURS} horas requeridas para ser certificado.`);
        return;
      }
    }

    if (showEditStudent) {
      const updateFirestore = async () => {
        try {
          const docRef = doc(db, 'users', selectedStudentId!);
          
          const updatedData = {
            ...studentForm,
            skills: derivedSkills,
            uid: selectedStudentId,
            role: targetNewRole,
            projectIds: isBecomingCoordinator ? projects.map(p => p.id) : (studentForm.projectIds || []),
            status: isBecomingCoordinator ? 'Coordinador' : ((isBecomingCoordinator && wasStudentWithHours) ? 'Finalizado' : studentForm.status),
            workStatus: (isBecomingCoordinator && wasStudentWithHours) ? 'Finalizado' : studentForm.workStatus,
            isArchived: (isBecomingCoordinator && wasStudentWithHours) ? true : Boolean((studentForm as any).isArchived || existingStudent?.isArchived),
            createdAt: existingStudent?.createdAt || new Date().toISOString()
          };
          
          await setDoc(docRef, updatedData, { merge: true });

          // Sync to public_profiles
          const publicProfile = {
            firstName: updatedData.firstName,
            lastNamePaterno: updatedData.lastNamePaterno,
            lastNameMaterno: updatedData.lastNameMaterno,
            career: updatedData.career,
            skills: updatedData.skills,
            status: updatedData.status,
            role: updatedData.role,
            uid: updatedData.uid,
            email: updatedData.email,
            phone: updatedData.phone,
            projectIds: updatedData.projectIds || []
          };
          await setDoc(doc(db, 'public_profiles', selectedStudentId!), publicProfile, { merge: true });

          const oldProjectIds = existingStudent?.projectIds || [];
          const newProjectIds = studentForm.projectIds || [];
          const addedProjectIds = newProjectIds.filter(id => !oldProjectIds.includes(id));

          for (const pid of addedProjectIds) {
            const p = projects.find(pr => pr.id === pid);
            if (p) {
              await createNotification(selectedStudentId!, {
                title: 'Nuevo proyecto asignado',
                message: `Se te ha asignado el proyecto: ${p.name}`,
                type: 'project_assigned',
                projectId: pid,
                projectName: p.name,
              });
            }
          }

          setStudents(prev => prev.map(s => s.id === selectedStudentId ? { ...s, ...updatedData } : s));
          setShowEditStudent(false);
          setShowAddStudent(false);
          showSuccessToast("Alumno actualizado exitosamente");
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${selectedStudentId}`);
        }
      };
      updateFirestore();
    } else {
      // For new students, we might want to save them to Firestore too with a generated ID
      // but usually they register themselves. If admin adds them, we can use a random ID.
      const addNewStudent = async () => {
        const newId = Date.now().toString();
        try {
          const docRef = doc(db, 'users', newId);
          const derivedSkills = studentForm.skillRatings?.map((s: any) => s.name) || studentForm.skills || [];
          const isCoordRole = studentForm.role === 'coordinator' || studentForm.role === 'super_coordinator' || studentForm.role === 'master_coordinator';
          const newStudentData = {
            ...studentForm,
            skills: derivedSkills,
            uid: newId,
            role: studentForm.role || 'user',
            projectIds: isCoordRole ? projects.map(p => p.id) : (studentForm.projectIds || []),
            status: isCoordRole ? 'Coordinador' : (studentForm.status || 'En Curso'),
            createdAt: new Date().toISOString(),
            records: []
          };
          await setDoc(docRef, newStudentData);

          // Sync to public_profiles
          const publicProfile = {
            firstName: newStudentData.firstName,
            lastNamePaterno: newStudentData.lastNamePaterno,
            lastNameMaterno: newStudentData.lastNameMaterno,
            career: newStudentData.career,
            skills: newStudentData.skills,
            status: newStudentData.status,
            role: newStudentData.role,
            uid: newStudentData.uid,
            email: newStudentData.email,
            phone: newStudentData.phone,
            projectIds: newStudentData.projectIds || []
          };
          await setDoc(doc(db, 'public_profiles', newId), publicProfile);

          setStudents([...students, { ...newStudentData, id: newId, name: `${studentForm.firstName} ${studentForm.lastNamePaterno} ${studentForm.lastNameMaterno}` }]);
          showSuccessToast("Alumno agregado exitosamente");
          setShowAddStudent(false);
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${newId}`);
        }
      };
      addNewStudent();
    }
  };

  const handleApproveRecord = async (studentId: string, recordId: string) => {
    const loadingToast = showLoadingToast("Aprobando registro...");
    try {
      const nowIso = new Date().toISOString();
      const currentUid = user?.uid || auth.currentUser?.uid || '';
      const sessionRef = doc(db, 'sesiones', recordId);
      await setDoc(sessionRef, {
        estado: 'aprobado',
        validationStatus: 'aprobado',
        status: 'A',
        updatedBy: currentUid,
        validatedBy: currentUid,
        validatedAt: nowIso
      }, { merge: true });

      // Optimistic local state update
      setStudents(prev => prev.map(s => {
        if (s.id === studentId) {
          return {
            ...s,
            records: (s.records || []).map((r: any) => 
              r.id === recordId ? { ...r, estado: 'aprobado', validationStatus: 'aprobado', status: 'A', validatedAt: nowIso } : r
            )
          };
        }
        return s;
      }));

      // Verificar si alcanzó las horas totales con esta aprobación
      const student = studentsWithRecords.find(s => s.id === studentId);
      if (student) {
        const record = student.records.find((r: any) => r.id === recordId);
        if (record && record.validationStatus !== 'aprobado') {
          const currentHours = student.records.reduce((acc: number, r: any) => {
            if (r.validationStatus === 'aprobado') return acc + r.hours;
            return acc;
          }, 0);
          
          if (currentHours < TOTAL_REQUIRED_HOURS && (currentHours + record.hours) >= TOTAL_REQUIRED_HOURS) {
            triggerCelebration();
            toast.success(`🎉 ¡Felicidades ${getDisplayName(student)}! Ha completado sus ${TOTAL_REQUIRED_HOURS} horas.`, {
              duration: 8000,
              position: 'top-center',
              style: {
                background: isDarkMode ? '#2d2d2d' : '#fff',
                color: isDarkMode ? '#fff' : '#1e293b',
                padding: '24px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                fontWeight: 900,
                fontSize: '18px',
                border: `4px solid ${isDarkMode ? '#6366f1' : '#4f46e5'}`
              }
            });
            
            // Actualizar estatus en Firestore
            await updateDoc(doc(db, 'users', studentId), { status: 'Finalizado' });
            await updateDoc(doc(db, 'public_profiles', studentId), { status: 'Finalizado' });
          }
        }
      }

      showSuccessToast("Registro aprobado");
    } catch (error) {
      console.error("Error approving session:", error);
      handleFirestoreError(error, OperationType.UPDATE, `sesiones/${recordId}`);
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleBulkAssignProjects = async () => {
    if (selectedStudentsForBulk.length === 0) {
      showErrorToast("Selecciona al menos un alumno");
      return;
    }
    if (selectedProjectsForBulk.length === 0) {
      showErrorToast("Selecciona al menos un proyecto");
      return;
    }

    const loadingToast = showLoadingToast("Asignando proyectos...");
    try {
      const batch = writeBatch(db);
      
      const newlyRegisteredNames: string[] = [];
      const alreadyRegisteredNames: string[] = [];

      for (const studentId of selectedStudentsForBulk) {
        const student = students.find(s => s.id === studentId);
        if (student) {
          const currentProjectIds = student.projectIds || [];
          
          // Check if student already has ALL the selected projects
          const hasAllSelected = selectedProjectsForBulk.every(pid => currentProjectIds.includes(pid));
          
          if (hasAllSelected) {
            alreadyRegisteredNames.push(student.name);
          } else {
            newlyRegisteredNames.push(student.name);
          }

          const newProjectIds = Array.from(new Set([...currentProjectIds, ...selectedProjectsForBulk]));
          
          const docRef = doc(db, 'users', studentId);
          batch.update(docRef, { projectIds: newProjectIds });
          
          const publicRef = doc(db, 'public_profiles', studentId);
          batch.update(publicRef, { projectIds: newProjectIds });
        }
      }

      await batch.commit();
      setShowBulkProjectAssign(false);
      setSelectedStudentsForBulk([]);
      setSelectedProjectsForBulk([]);
      toast.dismiss(loadingToast);

      if (newlyRegisteredNames.length > 0 || alreadyRegisteredNames.length > 0) {
        showSuccessToast(
          <div className="flex flex-col gap-3 text-left">
            {newlyRegisteredNames.length > 0 && (
              <div>
                <span className="font-black text-emerald-600 dark:text-emerald-400 block mb-1">Registrados con éxito:</span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {newlyRegisteredNames.join(', ')}
                </span>
              </div>
            )}
            {alreadyRegisteredNames.length > 0 && (
              <div>
                <span className="font-black text-amber-600 dark:text-amber-400 block mb-1">Ya se encontraban registrados:</span>
                <span className="text-xs text-slate-600 dark:text-slate-300">
                  {alreadyRegisteredNames.join(', ')}
                </span>
              </div>
            )}
          </div>
        );
      }
    } catch (error) {
      console.error("Error bulk assigning projects:", error);
      toast.dismiss(loadingToast);
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };

  const handleAssignProjectToSelected = async (projectId: string) => {
    if (selectedRecords.length === 0) return;
    const loadingToast = showLoadingToast("Asignando proyecto...");
    try {
      const batch = writeBatch(db);
      selectedRecords.forEach(recordId => {
        batch.update(doc(db, 'sesiones', recordId), { projectId, updatedBy: auth.currentUser?.uid });
      });
      await batch.commit();
      setSelectedRecords([]);
      showSuccessToast("Proyecto asignado a sesiones");
    } catch (error) {
      console.error("Error asignando proyecto:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'sesiones');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleUpdateValidationSelected = async (newEstado: string) => {
    if (selectedRecords.length === 0) return;
    const loadingToast = showLoadingToast("Actualizando validación...");
    try {
      const batch = writeBatch(db);
      selectedRecords.forEach(recordId => {
        const updateData: any = { estado: newEstado, updatedBy: auth.currentUser?.uid };
        if (newEstado === 'aprobado') {
          updateData.status = 'A';
        }
        batch.update(doc(db, 'sesiones', recordId), updateData);
      });
      await batch.commit();
      setSelectedRecords([]);
      showSuccessToast("Validación actualizada");
    } catch (error) {
      console.error("Error actualizando validación:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'sesiones');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleUpdateAttendanceSelected = async (newStatus: string) => {
    if (selectedRecords.length === 0) return;
    const loadingToast = showLoadingToast("Actualizando asistencia...");
    try {
      const batch = writeBatch(db);
      selectedRecords.forEach(recordId => {
        batch.update(doc(db, 'sesiones', recordId), { status: newStatus, updatedBy: auth.currentUser?.uid });
      });
      await batch.commit();
      setSelectedRecords([]);
      showSuccessToast("Asistencia actualizada");
    } catch (error) {
      console.error("Error actualizando asistencia:", error);
      handleFirestoreError(error, OperationType.UPDATE, 'sesiones');
    } finally {
      toast.dismiss(loadingToast);
    }
  };

  const handleDeleteSelected = (studentId: string) => {
    if (selectedRecords.length === 0) return;
    
    const studentToUpdate = students.find(s => s.id === studentId);
    if (!studentToUpdate) return;

    let recordsToDelete = selectedRecords;

    if (recordsToDelete.length === 0) {
      showErrorToast("No tienes permiso para eliminar los registros seleccionados.");
      return;
    }
    
    showConfirmToast(
      `¿Estás seguro de que deseas eliminar ${recordsToDelete.length} registro(s)?`,
      async () => {
        const loadingToast = showLoadingToast("Eliminando seleccionados...");
        try {
          const batch = writeBatch(db);
          recordsToDelete.forEach(recordId => {
            batch.delete(doc(db, 'sesiones', recordId));
          });
          await batch.commit();
          setSelectedRecords([]);
          showSuccessToast("Registros eliminados");
        } catch (error) {
          console.error("Error deleting selected sessions:", error);
          handleFirestoreError(error, OperationType.DELETE, 'sesiones');
        } finally {
          toast.dismiss(loadingToast);
        }
      }
    );
  };

  const handleDownloadReport = () => {
    if (!selectedStudent) return;
    const headers = ['Fecha', 'Hora de inicio', 'Hora de salida', 'Total de Horas', 'Descripción de actividades'];
    const rows = (selectedStudent.records || []).map((r: any) => [
      r.date,
      r.startTime || 'Manual',
      r.endTime || 'Manual',
      r.hours,
      `"${r.description ? r.description.replace(/"/g, '""') : ''}"`
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Reporte_Horas_${selectedStudent.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startEditStudent = () => {
    if (!selectedStudent) return;
    setStudentForm({ 
      ...selectedStudent,
      projectTasks: selectedStudent.projectTasks || {},
      projectTaskHistory: selectedStudent.projectTaskHistory || {}
    });
    setShowEditStudent(true);
    setShowAddStudent(true);
  };

  const handleCreateInlineCat = async () => {
    if (!newInlineCat.name.trim()) return;
    const id = `cat-${Date.now()}`;
    const newCategory = { id, ...newInlineCat };
    setCategories([...categories, newCategory]);
    try {
      await setDoc(doc(db, 'categories', id), newCategory);
    } catch (error) {
      console.error("Error saving inline category:", error);
    }
    setActivityForm({ ...activityForm, categoryId: id });
    setShowNewCatInput(false);
    setNewInlineCat({ name: '', color: '#6366f1' });
  };

  const startEditRecord = (record: any) => {
    setEditingRecordId(record.id);
    const isManual = !record.startTime || !record.endTime;
    const sId = record.studentId || selectedStudentId;
    setActivityForm({
      date: record.date || getCDMXDateString(), 
      startTime: record.startTime || '09:00', 
      endTime: record.endTime || '13:00',
      hours: record.hours || 0, 
      isManualHours: isManual,
      status: record.status || 'A', 
      categoryId: record.categoryId || '',
      projectId: record.projectId || '',
      description: record.description || '', 
      evidenceLink: record.evidenceLink || '',
      selectedStudentIds: sId ? [sId] : [], 
      studentStatuses: sId ? { [sId]: record.status || 'A' } : {}
    });
  };

  const openCalendarEdit = (record: any) => {
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Solo administradores y coordinadores pueden modificar horas desde el calendario.");
      return;
    }
    const isManual = !record.startTime || !record.endTime;
    const targetStudentId = record.studentId || record.userId;
    setEditingCalendarRecord(record);
    setCalendarEditForm({
      date: record.date || getCDMXDateString(),
      startTime: record.startTime || '09:00',
      endTime: record.endTime || '13:00',
      hours: Number(record.hours) || Number(record.horasCalculadas) || 0,
      isManualHours: isManual,
      categoryId: record.categoryId || '',
      projectId: record.projectId || '',
      description: record.description || '',
      studentId: targetStudentId,
      status: record.status || 'A'
    });
  };

  const handleCalendarStartTimeChange = (val: string) => {
    setCalendarEditForm(prev => {
      const next = { ...prev, startTime: val };
      if (!next.isManualHours) {
        const start = toMins(val);
        const end = toMins(next.endTime);
        const calcHours = end - start > 0 ? (end - start) / 60 : 0;
        next.hours = calcHours;
      }
      return next;
    });
  };

  const handleCalendarEndTimeChange = (val: string) => {
    setCalendarEditForm(prev => {
      const next = { ...prev, endTime: val };
      if (!next.isManualHours) {
        const start = toMins(next.startTime);
        const end = toMins(val);
        const calcHours = end - start > 0 ? (end - start) / 60 : 0;
        next.hours = calcHours;
      }
      return next;
    });
  };

  const handleSaveCalendarRecordEdit = async () => {
    if (!editingCalendarRecord) return;
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Permisos insuficientes para modificar horas.");
      return;
    }

    const student = getStudentData(calendarEditForm.studentId);
    if (!student) {
      showErrorToast("Alumno no encontrado.");
      return;
    }

    if (isStudentFinished(student)) {
      showErrorToast("El alumno ya ha finalizado su servicio social y no se le pueden asignar ni modificar horas.");
      return;
    }

    if (calendarEditForm.hours < 0.5) {
      showErrorToast("El registro mínimo es de media hora (0.5 hrs).");
      return;
    }
    if (calendarEditForm.hours > 240) {
      showErrorToast("Un registro no puede exceder las 240 horas.");
      return;
    }

    const { dateString: cdmxDateString, currentMins: cdmxCurrentMins } = getCDMXDateInfo();
    if (calendarEditForm.date > cdmxDateString) {
      showErrorToast("No se pueden registrar o mover actividades a fechas futuras.");
      return;
    }

    const startMins = toMins(calendarEditForm.startTime);
    const endMins = toMins(calendarEditForm.endTime);
    if (!calendarEditForm.isManualHours) {
      if (endMins <= startMins) {
        showErrorToast("La hora de salida debe ser posterior a la de entrada.");
        return;
      }
      if (calendarEditForm.date === cdmxDateString && endMins > cdmxCurrentMins) {
        showErrorToast("La hora de salida no puede ser mayor a la hora actual.");
        return;
      }
      if (checkTimeOverlap(calendarEditForm.studentId, calendarEditForm.date, calendarEditForm.startTime, calendarEditForm.endTime, editingCalendarRecord.id)) {
        showErrorToast(`Ya existe otra actividad registrada en ese horario para ${student.name || getFullName(student)}.`);
        return;
      }
    }

    setIsSavingCalendarEdit(true);
    const recordId = editingCalendarRecord.id;
    const updateData = {
      date: calendarEditForm.date,
      startTime: calendarEditForm.isManualHours ? '' : calendarEditForm.startTime,
      endTime: calendarEditForm.isManualHours ? '' : calendarEditForm.endTime,
      horasCalculadas: calendarEditForm.hours,
      hours: calendarEditForm.hours,
      categoryId: calendarEditForm.categoryId,
      projectId: calendarEditForm.projectId || '',
      description: calendarEditForm.description,
      status: calendarEditForm.status || 'A',
      updatedBy: auth.currentUser?.uid || 'admin',
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'sesiones', recordId), updateData);
      
      setStudents(prev => prev.map(s => {
        if (s.id === calendarEditForm.studentId) {
          const updatedRecs = (s.records || []).map((r: any) => r.id === recordId ? { ...r, ...updateData } : r);
          return { ...s, records: updatedRecs };
        }
        return s;
      }));

      showSuccessToast("Horas modificadas correctamente");
      setEditingCalendarRecord(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `sesiones/${recordId}`);
    } finally {
      setIsSavingCalendarEdit(false);
    }
  };

  const handleDeleteCalendarRecord = (record: any) => {
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Permisos insuficientes.");
      return;
    }
    showConfirmToast("¿Estás seguro de que deseas eliminar este registro de horas?", async () => {
      try {
        await deleteDoc(doc(db, 'sesiones', record.id));
        setStudents(prev => prev.map(s => {
          if (s.id === record.studentId || s.id === record.userId) {
            return { ...s, records: (s.records || []).filter((r: any) => r.id !== record.id) };
          }
          return s;
        }));
        showSuccessToast("Registro eliminado");
        if (editingCalendarRecord?.id === record.id) {
          setEditingCalendarRecord(null);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `sesiones/${record.id}`);
      }
    });
  };

  const openChangeCategoryProjectModal = (activityGroup: any) => {
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Solo administradores y coordinadores pueden modificar la categoría y el proyecto.");
      return;
    }
    setActivityToChangeCategoryProject(activityGroup);
    setChangeCategoryForm({
      categoryId: activityGroup.categoryId || (categories[0]?.id || ''),
      projectId: activityGroup.projectId || ''
    });
  };

  const handleSaveCategoryProjectChange = async () => {
    if (!activityToChangeCategoryProject) return;
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Permisos insuficientes.");
      return;
    }

    setIsSavingCategoryProjectChange(true);
    try {
      const records = activityToChangeCategoryProject.records || [activityToChangeCategoryProject];
      const newCategoryId = changeCategoryForm.categoryId;
      const newProjectId = changeCategoryForm.projectId || '';

      const batch = writeBatch(db);
      records.forEach((rec: any) => {
        if (rec.id) {
          const ref = doc(db, 'sesiones', rec.id);
          batch.update(ref, {
            categoryId: newCategoryId,
            projectId: newProjectId,
            updatedAt: new Date().toISOString(),
            updatedBy: auth.currentUser?.uid || 'admin'
          });
        }
      });
      await batch.commit();

      const recordIds = new Set(records.map((r: any) => r.id));
      setStudents(prev => prev.map(s => {
        let changed = false;
        const updatedRecords = (s.records || []).map((r: any) => {
          if (recordIds.has(r.id)) {
            changed = true;
            return { ...r, categoryId: newCategoryId, projectId: newProjectId };
          }
          return r;
        });
        return changed ? { ...s, records: updatedRecords } : s;
      }));

      // Si está abierto selectedCalendarDate o targetActivityForAddingStudents, actualizarlo en caliente
      if (targetActivityForAddingStudents) {
        setTargetActivityForAddingStudents((prev: any) => prev ? { ...prev, categoryId: newCategoryId, projectId: newProjectId } : null);
      }

      showSuccessToast("Categoría y proyecto actualizados correctamente");
      setActivityToChangeCategoryProject(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'sesiones');
    } finally {
      setIsSavingCategoryProjectChange(false);
    }
  };

  const openAddStudentsToActivity = (activityGroup: any) => {
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Solo administradores y coordinadores pueden agregar alumnos a actividades.");
      return;
    }
    setTargetActivityForAddingStudents(activityGroup);
    setSelectedStudentsToAdd([]);
    setSearchStudentsToAdd('');
  };

  const handleSaveStudentsToActivity = async () => {
    if (!targetActivityForAddingStudents || selectedStudentsToAdd.length === 0) {
      showErrorToast("Selecciona al menos un alumno activo para agregar a la actividad.");
      return;
    }
    if (userRole !== 'admin' && userRole !== 'coordinator') {
      showErrorToast("Permisos insuficientes.");
      return;
    }

    const finishedSelected = selectedStudentsToAdd.filter(id => {
      const s = getStudentData(id);
      return isStudentFinished(s);
    });
    if (finishedSelected.length > 0) {
      showErrorToast("No se pueden agregar alumnos que ya han finalizado su servicio social.");
      return;
    }

    setIsSavingStudentsToActivity(true);
    try {
      const act = targetActivityForAddingStudents;
      const hoursNum = Number(act.hours) || Number(act.horasCalculadas) || 0;
      const dateStr = act.date || selectedCalendarDate || getCDMXDateString();
      const startTimeStr = act.startTime || '';
      const endTimeStr = act.endTime || '';
      const categoryIdStr = act.categoryId || '';
      const descriptionStr = act.description || '';
      const projectIdStr = act.projectId || '';
      const evidenceLinkStr = act.evidenceLink || '';

      const newCreatedRecords: any[] = [];
      
      for (const studentId of selectedStudentsToAdd) {
        const student = getStudentData(studentId);
        const studentName = student?.name || getFullName(student) || 'Alumno';
        const recordData = {
          userId: studentId,
          studentId: studentId,
          studentName: studentName,
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          hours: hoursNum,
          horasCalculadas: hoursNum,
          categoryId: categoryIdStr,
          description: descriptionStr,
          projectId: projectIdStr,
          status: 'A',
          estado: 'aprobado',
          validationStatus: 'aprobado',
          evidenceLink: evidenceLinkStr,
          createdAt: new Date().toISOString(),
          createdBy: auth.currentUser?.uid || 'admin'
        };

        const docRef = await addDoc(collection(db, 'sesiones'), recordData);
        newCreatedRecords.push({ id: docRef.id, ...recordData });
      }

      setStudents(prev => prev.map(s => {
        const matchingRecs = newCreatedRecords.filter(r => r.studentId === s.id);
        if (matchingRecs.length > 0) {
          return {
            ...s,
            records: [...(s.records || []), ...matchingRecs]
          };
        }
        return s;
      }));

      showSuccessToast(`${newCreatedRecords.length} alumno(s) activo(s) agregado(s) a la actividad correctamente`);
      setTargetActivityForAddingStudents(null);
      setSelectedStudentsToAdd([]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sesiones');
    } finally {
      setIsSavingStudentsToActivity(false);
    }
  };

  const saveActivity = (e: any) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMessage(null);
    const isGroup = view === 'group-activity';
    const targetIds = isGroup ? activityForm.selectedStudentIds : [activityForm.selectedStudentIds[0] || selectedStudentId];
    
    if (!targetIds || targetIds.length === 0 || !targetIds[0]) {
      setErrorMessage("Debe seleccionar participantes.");
      showErrorToast("Debe seleccionar participantes.");
      return;
    }

    const finishedSelected = targetIds.map(id => getStudentData(id)).filter(s => isStudentFinished(s));
    if (finishedSelected.length > 0) {
      const names = finishedSelected.map(s => getDisplayName(s)).join(', ');
      const msg = `No se pueden asignar horas a alumnos que ya finalizaron su servicio social: ${names}`;
      setErrorMessage(msg);
      showErrorToast(msg);
      return;
    }

    const startMins = toMins(activityForm.startTime);
    const endMins = toMins(activityForm.endTime);
    const anyAsistio = isGroup ? Object.values(activityForm.studentStatuses).includes('A') : activityForm.status === 'A';

    if (anyAsistio && !activityForm.isManualHours && endMins <= startMins) { setErrorMessage("La salida debe ser posterior a la entrada."); showErrorToast("La salida debe ser posterior a la entrada."); return; }
    if (anyAsistio && !activityForm.description.trim()) { setErrorMessage("La descripción es obligatoria si hubo asistencia."); showErrorToast("La descripción es obligatoria si hubo asistencia."); return; }

    const formToValidate = {
      ...activityForm,
      startTime: activityForm.isManualHours ? '' : activityForm.startTime,
      endTime: activityForm.isManualHours ? '' : activityForm.endTime
    };

    try {
      activitySchema.parse(formToValidate);
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrorMessage(error.issues[0].message);
        showErrorToast(error.issues[0].message);
        return;
      }
    }

    if (formToValidate.hours > 8 && userRole === 'user') {
      setErrorMessage("Un registro no puede exceder las 8 horas");
      showErrorToast("Un registro no puede exceder las 8 horas");
      return;
    }
    if (formToValidate.hours > 240) {
      setErrorMessage("Un registro no puede exceder las 240 horas");
      showErrorToast("Un registro no puede exceder las 240 horas");
      return;
    }

    // Validar que la fecha y hora no sean en el futuro (CDMX)
    const { dateString: cdmxDateString, currentMins: cdmxCurrentMins } = getCDMXDateInfo();

    if (activityForm.date > cdmxDateString) {
      setErrorMessage("No se pueden registrar actividades en fechas futuras.");
      showErrorToast("No se pueden registrar actividades en fechas futuras.");
      return;
    }

    if (!activityForm.isManualHours && activityForm.date === cdmxDateString && endMins > cdmxCurrentMins) {
      setErrorMessage("La hora de salida no puede ser mayor a la hora actual.");
      showErrorToast("La hora de salida no puede ser mayor a la hora actual.");
      return;
    }

    if (!activityForm.isManualHours) {
      for (const sId of targetIds) {
        if (checkTimeOverlap(sId as string, activityForm.date, activityForm.startTime, activityForm.endTime, editingRecordId as any)) {
          const sName = getStudentData(sId)?.name || 'El alumno';
          const errorMsg = `Ya se tienen actividades registradas en este horario para ${sName}.`;
          setErrorMessage(errorMsg);
          showErrorToast(errorMsg);
          return;
        }
      }
    }

    setIsSubmitting(true);
    const updatedStudents = students.map(s => {
      if (targetIds.includes(s.id)) {
        const sStat = isGroup ? (activityForm.studentStatuses[s.id] || 'A') : activityForm.status;
        const sHrs = sStat === 'A' ? Number(activityForm.hours) : 0;
        const sDesc = sStat === 'A' ? activityForm.description : '';
        const sLink = sStat === 'A' ? activityForm.evidenceLink : '';

        let updatedRecords;
        const records = s.records || [];
        if (editingRecordId && s.id === selectedStudentId) {
          const oldRecord = records.find((r: any) => r.id === editingRecordId);
          const updatedRecord = {
            ...(oldRecord || {}),
            id: editingRecordId,
            date: activityForm.date, 
            startTime: activityForm.isManualHours ? '' : activityForm.startTime, 
            endTime: activityForm.isManualHours ? '' : activityForm.endTime,
            hours: sHrs, status: sStat, categoryId: activityForm.categoryId,
            projectId: activityForm.projectId,
            description: sDesc, evidenceLink: sLink, 
            validationStatus: oldRecord ? oldRecord.validationStatus : 'aprobado',
            createdBy: oldRecord ? oldRecord.createdBy : userRole
          };
          updatedRecords = records.map((r: any) => r.id === editingRecordId ? updatedRecord : r);
        } else {
          const newRecord = {
            id: `${Date.now()}-${s.id}`,
            date: activityForm.date, 
            startTime: activityForm.isManualHours ? '' : activityForm.startTime, 
            endTime: activityForm.isManualHours ? '' : activityForm.endTime,
            hours: sHrs, status: sStat, categoryId: activityForm.categoryId,
            projectId: activityForm.projectId,
            description: sDesc, evidenceLink: sLink, 
            validationStatus: 'aprobado',
            createdBy: userRole
          };
          updatedRecords = [newRecord, ...records];
        }
        const oldHours = (s.records || []).reduce((a: number, c: any) => {
          if (c.validationStatus === 'aprobado' || !c.validationStatus) return a + c.hours;
          return a;
        }, 0);

        const approvedHours = updatedRecords.reduce((a: number,c: any) => {
          if (c.validationStatus === 'aprobado' || !c.validationStatus) return a + c.hours;
          return a;
        }, 0);

        if (oldHours < TOTAL_REQUIRED_HOURS && approvedHours >= TOTAL_REQUIRED_HOURS) {
          setTimeout(() => {
            triggerCelebration();
            toast.success(`🎉 ¡Felicidades ${getDisplayName(s)}! Has completado tus ${TOTAL_REQUIRED_HOURS} horas de servicio social.`, {
              duration: 8000,
              position: 'top-center',
              style: {
                background: isDarkMode ? '#2d2d2d' : '#fff',
                color: isDarkMode ? '#fff' : '#1e293b',
                padding: '24px',
                borderRadius: '24px',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                fontWeight: 900,
                fontSize: '18px',
                border: `4px solid ${isDarkMode ? '#6366f1' : '#4f46e5'}`
              }
            });
          }, 600);
        }

        return { ...s, records: updatedRecords, status: approvedHours >= TOTAL_REQUIRED_HOURS ? 'Finalizado' : s.status };
      }
      return s;
    });

    setStudents(updatedStudents);

    // Persist each updated student to Firestore
    const persistUpdates = async () => {
      try {
        const updates = targetIds.map(async (id: string) => {
          const sStat = isGroup ? (activityForm.studentStatuses[id] || 'A') : activityForm.status;
          const sHrs = sStat === 'A' ? Number(activityForm.hours) : 0;
          const sDesc = sStat === 'A' ? activityForm.description : '';
          const sLink = sStat === 'A' ? activityForm.evidenceLink : '';
          
          const recordId = (editingRecordId && id === selectedStudentId) ? editingRecordId : `${Date.now()}-${id}`;
          
          const sessionData: any = {
            id: recordId,
            userId: id,
            projectId: activityForm.projectId,
            categoryId: activityForm.categoryId,
            description: sDesc,
            date: activityForm.date,
            startTime: activityForm.isManualHours ? '' : activityForm.startTime,
            endTime: activityForm.isManualHours ? '' : activityForm.endTime,
            horasCalculadas: sHrs,
            estado: 'aprobado', // Admins/Coordinators records are approved by default
            status: sStat,
            evidenceLink: sLink,
            updatedBy: auth.currentUser?.uid,
            acknowledgedRejection: false
          };

          if (!editingRecordId || id !== selectedStudentId) {
            sessionData.createdAt = new Date().toISOString();
          }

          await setDoc(doc(db, 'sesiones', recordId), sessionData, { merge: true });

          // Persistir cambio de estatus si completó las horas
          const updatedStudent = updatedStudents.find(s => s.id === id);
          if (updatedStudent && updatedStudent.status === 'Finalizado') {
            const studentRef = doc(db, 'users', id);
            await updateDoc(studentRef, { 
              status: 'Finalizado',
              projectIds: [],
              isArchived: true,
              finalizedAt: new Date().toISOString(),
              workStatus: 'Finalizado'
            });
            await updateDoc(doc(db, 'public_profiles', id), { 
              status: 'Finalizado',
              projectIds: [],
              isArchived: true,
              finalizedAt: new Date().toISOString(),
              workStatus: 'Finalizado'
            });
          }
        });
        await Promise.all(updates);
        showSuccessToast(editingRecordId ? "Registro actualizado exitosamente" : "Registro agregado exitosamente");
      } catch (error) {
        console.error("Error persisting activity updates:", error);
        handleFirestoreError(error, OperationType.WRITE, `sesiones/multiple`);
      } finally {
        setIsSubmitting(false);
      }
    };
    persistUpdates();

    setEditingRecordId(null);
    setActivityForm({
      date: getCDMXDateString(),
      startTime: '09:00',
      endTime: '13:00',
      hours: 4,
      isManualHours: false,
      status: 'A',
      categoryId: '',
      projectId: '',
      description: '',
      evidenceLink: '',
      selectedStudentIds: [],
      studentStatuses: {}
    });
    showSuccessToast(editingRecordId ? "Registro actualizado exitosamente" : "Registro agregado exitosamente");
    if (isGroup || view === 'individual-activity') setView('dashboard');
  };
  const renderActivityForm = (isGroup: boolean) => {
    const isAbsence = !isGroup && activityForm.status !== 'A';
    const isUser = userRole === 'user';

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <div className="space-y-1">
            <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha</label>
            <input type="date" max={getCDMXDateString()} required className={`w-full p-3 sm:p-4 border rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={activityForm.date || ''} onChange={e => setActivityForm({...activityForm, date: e.target.value})} />
          </div>
          {!activityForm.isManualHours ? (
            <>
              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Entrada</label>
                <input type="text" placeholder="HH:MM" maxLength={5} className={`w-full p-3 sm:p-4 border rounded-2xl text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={activityForm.startTime || ''} onChange={e => setActivityForm({...activityForm, startTime: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Salida</label>
                <input type="text" placeholder="HH:MM" maxLength={5} className={`w-full p-3 sm:p-4 border rounded-2xl text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={activityForm.endTime || ''} onChange={e => setActivityForm({...activityForm, endTime: e.target.value})} />
              </div>
            </>
          ) : (
            <div className="space-y-1 lg:col-span-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Horas Acumuladas</label>
              <input type="number" min="0" step="0.5" className={`w-full p-3 sm:p-4 border rounded-2xl text-sm font-black text-center focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={activityForm.hours || 0} onChange={e => setActivityForm({...activityForm, hours: Number(e.target.value)})} />
            </div>
          )}
        </div>

        <div className="bg-indigo-900 text-white rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-indigo-700 p-3 rounded-2xl shadow-inner"><Clock size={32} /></div>
            <div>
              <h4 className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-1">Total Calculado</h4>
              <div className="flex items-baseline gap-1"><span className="text-4xl font-black">{Number(activityForm.hours.toFixed(2))}</span><span className="text-indigo-300 font-bold uppercase text-sm">H</span></div>
            </div>
          </div>
          <div className="text-center sm:text-right relative z-10 text-xs font-bold border border-indigo-700 bg-indigo-800/50 px-4 py-2 rounded-xl">
            {activityForm.date}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="manualHours" checked={activityForm.isManualHours} onChange={e => setActivityForm({...activityForm, isManualHours: e.target.checked, hours: e.target.checked ? 0 : activityForm.hours})} className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
          <label htmlFor="manualHours" className={`text-xs font-bold cursor-pointer ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>Registrar horas acumuladas / extra manualmente</label>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {(!isGroup) && (
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Proyecto (Opcional)</label>
              <div className="flex gap-3">
                <select className={`flex-1 p-4 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={activityForm.projectId || ''} onChange={e => setActivityForm({...activityForm, projectId: e.target.value})}>
                  <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>General / Sin especificar</option>
                  {(() => {
                     const sId = activityForm.selectedStudentIds[0] || selectedStudentId;
                     const student = getStudentData(sId);
                     if (!student) return null;
                     return Array.from(new Set(student.projectIds || [])).map((pid: string) => {
                       const p = projects.find(pr => pr.id === pid);
                       return <option key={pid} value={pid} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{p?.name}</option>;
                     });
                  })()}
                </select>
                {activityForm.projectId && (
                  <button type="button" onClick={() => {
                    setActivityForm(prev => ({ ...prev, projectId: '' }));
                  }} className={`p-4 rounded-2xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}><X size={20}/></button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Categoría</label>
            {!showNewCatInput ? (
              <div className="flex gap-3">
                <select className={`flex-1 p-4 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={activityForm.categoryId || ''} onChange={e => setActivityForm({...activityForm, categoryId: e.target.value})}>
                  <option value="" disabled className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Seleccionar categoría...</option>
                  {categories.map(cat => <option key={cat.id} value={cat.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{cat.name}</option>)}
                </select>
                <button type="button" onClick={() => setShowNewCatInput(true)} className={`p-4 rounded-2xl transition-all ${isDarkMode ? 'bg-white/5 hover:bg-white/10 text-indigo-400' : 'bg-slate-100 hover:bg-slate-200 text-indigo-600'}`}><Plus size={20}/></button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input type="text" className={`flex-1 p-4 border rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`} value={newInlineCat.name} onChange={e => setNewInlineCat({...newInlineCat, name: e.target.value})} />
                <button type="button" onClick={handleCreateInlineCat} className="px-6 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all">Ok</button>
              </div>
            )}
          </div>
          
          {activityForm.categoryId && !isGroup && !isUser && (
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Asistencia</label>
              <div className="grid grid-cols-4 gap-2">
                {Object.keys(ATTENDANCE_STATUS).map(k => (
                  <button key={k} type="button" onClick={() => setActivityForm({...activityForm, status: k})} className={`p-3 rounded-2xl text-[10px] font-black border-2 transition-all ${activityForm.status === k ? (isDarkMode ? 'border-indigo-400 bg-indigo-500/20 text-indigo-400' : 'border-indigo-600 bg-indigo-50 text-indigo-700') : (isDarkMode ? 'border-white/5 bg-white/5 text-gray-500' : 'border-slate-100 bg-white text-slate-400')}`}>{k}</button>
                ))}
              </div>
            </div>
          )}
          
          {activityForm.categoryId && !isGroup && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                  Alumno Activo
                </label>
                <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                  {filteredActiveStudentsForActivity.length} disponible{filteredActiveStudentsForActivity.length === 1 ? '' : 's'}
                </span>
              </div>

              {/* Barra de búsqueda para filtrar alumno individual */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search size={16} className={isDarkMode ? 'text-gray-500' : 'text-slate-400'} />
                </div>
                <input
                  type="text"
                  value={activityStudentSearch}
                  onChange={e => setActivityStudentSearch(e.target.value)}
                  placeholder="Buscar alumno por nombre, matrícula o carrera..."
                  className={`w-full pl-10 pr-9 py-3 border rounded-2xl text-xs font-bold outline-none transition-all ${
                    isDarkMode
                      ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:bg-white/10 focus:border-indigo-400'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500'
                  }`}
                />
                {activityStudentSearch && (
                  <button
                    type="button"
                    onClick={() => setActivityStudentSearch('')}
                    className={`absolute inset-y-0 right-0 pr-3.5 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <select
                className={`w-full p-4 border rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500 ${isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                value={activityForm.selectedStudentIds[0] || selectedStudentId || ''}
                onChange={e => {
                  setActivityForm({ ...activityForm, selectedStudentIds: [e.target.value] });
                  setSelectedStudentId(e.target.value);
                }}
              >
                <option value="" className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                  {filteredActiveStudentsForActivity.length === 0 ? 'Sin alumnos activos disponibles' : 'Seleccionar Alumno...'}
                </option>
                {filteredActiveStudentsForActivity.map((s, idx) => {
                  const approvedHrs = getStudentApprovedHours(s);
                  return (
                    <option key={`${s.id || 'student'}-${idx}`} value={s.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                      {s.name || getFullName(s)} {s.studentId ? `(${s.studentId})` : ''} — {s.career || ''} [{Number(approvedHrs.toFixed(1))}/{TOTAL_REQUIRED_HOURS}h]
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        {activityForm.categoryId && isGroup && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    Participantes
                  </label>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    ✓ Solo Prestadores Activos
                  </span>
                </div>
                <p className={`text-[11px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  {activityForm.selectedStudentIds.length} de {activeEligibleStudents.length} alumno{activeEligibleStudents.length === 1 ? '' : 's'} activo{activeEligibleStudents.length === 1 ? '' : 's'} disponible{activeEligibleStudents.length === 1 ? '' : 's'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const filteredIds = filteredActiveStudentsForActivity.map(s => s.id);
                    const newIds = Array.from(new Set([...activityForm.selectedStudentIds, ...filteredIds]));
                    const newStatuses = { ...activityForm.studentStatuses };
                    filteredIds.forEach(id => {
                      if (!newStatuses[id]) newStatuses[id] = 'A';
                    });
                    setActivityForm({ ...activityForm, selectedStudentIds: newIds, studentStatuses: newStatuses });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-200 text-indigo-600 hover:bg-indigo-100'}`}
                >
                  Seleccionar {activityStudentSearch ? 'Filtrados' : 'Todos'}
                </button>
                {activityForm.selectedStudentIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setActivityForm({ ...activityForm, selectedStudentIds: [], studentStatuses: {} });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700'}`}
                  >
                    Deseleccionar
                  </button>
                )}
              </div>
            </div>

            {/* Barra de búsqueda para filtrar alumnos */}
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search size={18} className={isDarkMode ? 'text-gray-500' : 'text-slate-400'} />
              </div>
              <input
                type="text"
                value={activityStudentSearch}
                onChange={e => setActivityStudentSearch(e.target.value)}
                placeholder="Buscar alumno por nombre, matrícula o carrera..."
                className={`w-full pl-11 pr-10 py-3.5 border rounded-2xl text-sm font-bold outline-none transition-all focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode
                    ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:bg-white/10'
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500'
                }`}
              />
              {activityStudentSearch && (
                <button
                  type="button"
                  onClick={() => setActivityStudentSearch('')}
                  className={`absolute inset-y-0 right-0 pr-4 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Lista de alumnos filtrados */}
            <div className={`grid grid-cols-1 gap-3 p-4 sm:p-6 rounded-[2rem] border max-h-[340px] overflow-y-auto custom-scrollbar ${isDarkMode ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
              {filteredActiveStudentsForActivity.length === 0 ? (
                <div className="text-center py-8">
                  <UserX size={36} className={`mx-auto mb-2 ${isDarkMode ? 'text-gray-600' : 'text-slate-300'}`} />
                  <p className={`text-xs font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    {activityStudentSearch ? 'No se encontraron alumnos activos con esa búsqueda' : 'No hay alumnos activos disponibles para asignar horas'}
                  </p>
                  <p className={`text-[10px] mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    Los alumnos que ya finalizaron su servicio social no aparecen en esta lista.
                  </p>
                </div>
              ) : (
                filteredActiveStudentsForActivity.map((s, idx) => {
                  const isSelected = activityForm.selectedStudentIds.includes(s.id);
                  const sStatus = activityForm.studentStatuses[s.id] || 'A';
                  const approvedHrs = (s.records || []).reduce((acc: number, r: any) => {
                    if (r.validationStatus === 'aprobado' || !r.validationStatus) {
                      return acc + (Number(r.hours) || Number(r.horasCalculadas) || 0);
                    }
                    return acc;
                  }, 0);
                  return (
                    <div
                      key={`${s.id || 'student'}-${idx}`}
                      className={`p-4 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/50 shadow-sm' : 'bg-white border-indigo-500 shadow-md ring-2 ring-indigo-500/10')
                          : (isDarkMode ? 'bg-transparent border-white/5 hover:border-white/10' : 'bg-white/70 border-slate-200/80 hover:border-slate-300')
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={e => {
                            const checked = e.target.checked;
                            const ids = checked ? [...activityForm.selectedStudentIds, s.id] : activityForm.selectedStudentIds.filter(id => id !== s.id);
                            const newStatuses = { ...activityForm.studentStatuses };
                            if (checked) newStatuses[s.id] = 'A'; else delete newStatuses[s.id];
                            setActivityForm({ ...activityForm, selectedStudentIds: ids, studentStatuses: newStatuses });
                          }}
                          className="w-5 h-5 mt-0.5 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={`text-sm font-black truncate ${isDarkMode ? (isSelected ? 'text-white' : 'text-gray-200') : (isSelected ? 'text-slate-900' : 'text-slate-700')}`}>
                              {s.name || getFullName(s)}
                            </span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${isDarkMode ? 'bg-white/5 border-white/10 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-700'}`}>
                              {Number(approvedHrs.toFixed(1))} / {TOTAL_REQUIRED_HOURS}h
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-1">
                            {s.studentId && (
                              <span className={`text-[9px] font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                Matrícula: {s.studentId}
                              </span>
                            )}
                            {s.career && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-white/5 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                                {s.career}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                      {isSelected && (
                        <div className="flex gap-1.5 mt-3 pt-3 border-t border-dashed border-indigo-200/40">
                          {Object.keys(ATTENDANCE_STATUS).map(k => (
                            <button
                              key={k}
                              type="button"
                              onClick={() => setActivityForm(prev => ({ ...prev, studentStatuses: { ...prev.studentStatuses, [s.id]: k } }))}
                              className={`text-[9px] font-black py-1 px-2 border rounded-xl flex-1 transition-all ${
                                sStatus === k
                                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                                  : (isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100')
                              }`}
                            >
                              {k}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activityForm.categoryId && (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Evidencia</label>
              <input type="url" disabled={isAbsence} placeholder="Link de evidencia (Drive, OneDrive, etc)..." className={`w-full p-4 border rounded-2xl text-sm transition-all focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white disabled:opacity-30' : 'bg-white border-slate-200 text-slate-900 disabled:bg-slate-50'}`} value={activityForm.evidenceLink || ''} onChange={e => setActivityForm({...activityForm, evidenceLink: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Descripción de actividades</label>
              <textarea disabled={isAbsence} className={`w-full p-5 border rounded-2xl h-32 text-sm transition-all focus:ring-2 focus:ring-indigo-500 outline-none ${isDarkMode ? 'bg-white/5 border-white/10 text-white disabled:opacity-30' : 'bg-white border-slate-200 text-slate-900 disabled:bg-slate-50'}`} value={activityForm.description || ''} onChange={e => setActivityForm({...activityForm, description: e.target.value})}></textarea>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleExportToSheets = async () => {
    if (filteredStudents.length === 0) {
      showErrorToast("No hay alumnos filtrados para exportar");
      return;
    }

    const includeArchived = await new Promise<boolean>((resolve) => {
      showConfirmToast(
        `¿Deseas incluir a los alumnos ${showArchived ? 'activos' : 'archivados'} en la exportación?`,
        () => resolve(true),
        "Incluir",
        "No, solo actuales",
        () => resolve(false)
      );
    });

    let token = googleAccessToken;

    if (!token) {
      const btn = document.getElementById('export-sheets-btn') as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
      }
      const loadingAuth = showLoadingToast("Autenticando con Google...");
      try {
        const provider = new GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/spreadsheets');
        provider.setCustomParameters({ prompt: 'select_account' });
        const result = await signInWithPopup(auth, provider);
        const credential = GoogleAuthProvider.credentialFromResult(result);
        token = credential?.accessToken || null;
        if (token) setGoogleAccessToken(token);
      } catch (error: any) {
        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
          console.warn("Autenticación para Sheets cancelada o ventana cerrada por el usuario.");
          toast("Ventana de autenticación cerrada.", { icon: 'ℹ️' });
        } else if (error.code === 'auth/blocked-at-iframe-start' || error.code === 'auth/popup-blocked') {
          console.warn("Ventana emergente bloqueada por el navegador.");
          showErrorToast("El navegador bloqueó la ventana emergente. Por favor, habilita los popups para este sitio.");
        } else {
          console.error("Error authenticating for Sheets:", error);
          showErrorToast("Error al autenticar con Google: " + (error.message || "Error desconocido"));
        }
        toast.dismiss(loadingAuth);
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
        return;
      } finally {
        toast.dismiss(loadingAuth);
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
        }
      }
    }

    if (!token) return;

    const loadingExport = showLoadingToast("Exportando a Google Sheets...");
    setIsExporting(true);

    try {
      let studentsToExport = [...filteredStudents];

      if (includeArchived) {
        const extraStudents = studentsWithRecords.filter(s => {
          if (s.email && SUPER_ADMIN_EMAILS.includes(s.email)) return false;
          
          // If we were showing archived, we add active. If we were showing active, we add archived.
          if (showArchived) {
            if (s.isArchived) return false; // Already included
          } else {
            if (!s.isArchived) return false; // Already included
          }

          const matchStatus = filterStatus === 'Todos' || s.status === filterStatus;
          const matchWork = filterWork === 'Todos' || s.workStatus === filterWork;
          const matchProject = filterProject === 'Todos' || (s.projectIds || []).includes(filterProject);
          const matchCategory = filterCategories.length === categories.length || (s.records || []).some((r: any) => filterCategories.includes(r.categoryId));
          const matchCareer = filterCareer === 'Todos' || s.career === filterCareer;
          const matchBrigade = filterBrigade === 'Todos' || s.brigadePeriod === filterBrigade;
          const lowerSearch = searchTerm.toLowerCase();
          const matchSearch = getFullName(s).toLowerCase().includes(lowerSearch) ||
                              (s.nickname || '').toLowerCase().includes(lowerSearch) ||
                              (s.career || '').toLowerCase().includes(lowerSearch);
          return matchStatus && matchWork && matchProject && matchCategory && matchCareer && matchBrigade && matchSearch;
        });
        studentsToExport = [...studentsToExport, ...extraStudents];
      }

      const exportData: StudentExportData[] = studentsToExport.map(s => {
        const approvedHours = (s.records || []).reduce((acc: number, r: any) => {
          if (r.validationStatus === 'aprobado' || !r.validationStatus) return acc + (r.hours || 0);
          return acc;
        }, 0);

        return {
          id: s.id,
          firstName: s.firstName || '',
          lastNamePaterno: s.lastNamePaterno || '',
          lastNameMaterno: s.lastNameMaterno || '',
          studentId: s.studentId || '',
          email: s.email || '',
          career: s.career || '',
          brigadePeriod: s.brigadePeriod || '',
          status: s.status || '',
          totalHours: Number(approvedHours.toFixed(2))
        };
      });

      const url = await exportToGoogleSheets(token, exportData);
      showSuccessToast("¡Exportación exitosa!");
      window.open(url, '_blank');
    } catch (error) {
      console.error("Error during Sheets export:", error);
      showErrorToast("Error al exportar a Google Sheets");
      setGoogleAccessToken(null); // Reset token if it failed (might be expired)
    } finally {
      setIsExporting(false);
      toast.dismiss(loadingExport);
    }
  };

  const handleSyncPublicProfiles = async () => {
    const loadingToast = showLoadingToast("Sincronizando perfiles públicos...");
    try {
      let syncCount = 0;
      for (const student of students) {
        if (!student.id) continue;
        
        // Skip super admins if needed, or sync everyone
        const publicProfile = {
          firstName: student.firstName || '',
          lastNamePaterno: student.lastNamePaterno || '',
          lastNameMaterno: student.lastNameMaterno || '',
          career: student.career || 'Arquitectura',
          skills: student.skills || [],
          status: student.status || 'En Curso',
          role: student.role || 'user',
          uid: student.id,
          email: student.email || '',
          phone: student.phone || '',
          projectIds: student.projectIds || []
        };
        
        await setDoc(doc(db, 'public_profiles', student.id), publicProfile, { merge: true });
        syncCount++;
      }
      toast.dismiss(loadingToast);
      showSuccessToast(`Se sincronizaron ${syncCount} perfiles públicos`);
    } catch (error) {
      toast.dismiss(loadingToast);
      console.error("Error syncing public profiles:", error);
      showErrorToast("Error al sincronizar perfiles");
    }
  };

  const handleRoleChange = async (targetStudentId: string, newRole: UserRole) => {
    const sId = String(targetStudentId);
    const targetStudent = getStudentData(sId);
    if (!targetStudent) return;

    // Safety 1: Master Coordinator can NEVER have their role altered
    const isTargetMaster = (targetStudent.email || '').toLowerCase() === MASTER_COORDINATOR_EMAIL.toLowerCase();
    if (isTargetMaster) {
      showErrorToast("El rol del Coordinador Maestro no puede ser modificado.");
      return;
    }

    // Safety 2: Only Master Coordinator can assign super_coordinator
    if (newRole === 'super_coordinator' && !permissions.isMaster) {
      showErrorToast("Solo el Coordinador Maestro (luisedgar.gutierrez17@gmail.com) puede dar de alta Supercoordinadores.");
      return;
    }

    // Safety 3: Only Master Coordinator can modify a Supercoordinator
    const currentTargetRole = getEffectiveRole(targetStudent.email, targetStudent.role);
    if ((currentTargetRole === 'super_coordinator' || currentTargetRole === 'admin') && !permissions.isMaster) {
      showErrorToast("Solo el Coordinador Maestro puede cambiar el rol de un Supercoordinador.");
      return;
    }

    // Safety 4: Coordinators can only toggle between user and student_coordinator
    if (!permissions.isSuper && permissions.isCoordinator) {
      if (newRole !== 'user' && newRole !== 'student_coordinator') {
        showErrorToast("Un Coordinador solo puede alternar entre Alumno y Alumno Coordinador.");
        return;
      }
    }

    const isBecomingCoordinator = newRole === 'coordinator' || newRole === 'super_coordinator' || newRole === 'master_coordinator';
    const wasStudentWithHours = currentTargetRole === 'user' || currentTargetRole === 'student_coordinator';

    const updateData: any = {
      role: newRole,
      updatedAt: new Date().toISOString()
    };

    if (isBecomingCoordinator && wasStudentWithHours) {
      updateData.status = 'Finalizado';
      updateData.workStatus = 'Finalizado';
      updateData.isArchived = true;
      updateData.serviceConcluded = true;
      updateData.hoursConcluded = true;
      updateData.projectIds = projects.map((p: any) => p.id);
    } else if (isBecomingCoordinator) {
      updateData.projectIds = projects.map((p: any) => p.id);
    } else if (!isBecomingCoordinator && targetStudent.status === 'Finalizado' && !isStudentFinished(targetStudent)) {
      updateData.status = 'En Curso';
      updateData.workStatus = 'Asignado';
      updateData.isArchived = false;
    }

    // Optimistic local update
    setStudents(prev => {
      const next = prev.map(s => String(s.id) === sId ? { ...s, ...updateData } : s);
      localStorage.setItem('app_students', JSON.stringify(next));
      return next;
    });

    try {
      await setDoc(doc(db, 'users', sId), updateData, { merge: true });
      await setDoc(doc(db, 'public_profiles', sId), updateData, { merge: true });
      showSuccessToast(`Rol actualizado a "${ROLE_LABELS[newRole]?.label || newRole}" exitosamente`);
    } catch (err) {
      console.error("Error updating role in Firestore:", err);
      handleFirestoreError(err, OperationType.UPDATE, `users/${sId}`);
    }
  };

  const handleDeleteStudent = (studentId: string) => {
    const sId = String(studentId);
    const targetStudent = getStudentData(sId);

    // Safety check 1: Master Coordinator can NEVER be deleted
    if (targetStudent?.email?.toLowerCase() === MASTER_COORDINATOR_EMAIL.toLowerCase()) {
      showErrorToast("El Coordinador Maestro (luisedgar.gutierrez17@gmail.com) no puede ser eliminado.");
      return;
    }

    // Safety check 2: Supercoordinators cannot delete other Supercoordinators
    const targetRole = getEffectiveRole(targetStudent?.email, targetStudent?.role);
    if ((targetRole === 'super_coordinator' || targetRole === 'master_coordinator' || targetRole === 'admin') && !permissions.isMaster) {
      showErrorToast("No tienes permisos para eliminar a otro Supercoordinador. Solo el Coordinador Maestro puede realizar esta acción.");
      return;
    }

    // Safety check 3: Must be at least Supercoordinator to delete users
    if (!permissions.isSuper) {
      showErrorToast("No tienes permisos para eliminar usuarios.");
      return;
    }

    showConfirmToast(
      "¿Estás seguro de que deseas eliminar a este usuario? Esta acción no se puede deshacer y se eliminarán todos sus registros, tareas e historial asociados.",
      async () => {
        // Optimistic update: remove from local state immediately
        setStudents(prev => {
          const next = prev.filter(s => String(s.id) !== sId);
          localStorage.setItem('app_students', JSON.stringify(next));
          return next;
        });
        
        // If we are viewing this student, reset view
        if (String(selectedStudentId) === sId) {
          setSelectedStudentId(null);
          setView('dashboard');
        }

        try {
          // 1. Delete notifications subcollection
          const notifsRef = collection(db, 'users', sId, 'notifications');
          const notifsSnap = await getDocs(notifsRef);
          if (!notifsSnap.empty) {
            const batch = writeBatch(db);
            notifsSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
          }

          // 2. Delete the main user document and public profile
          await deleteDoc(doc(db, 'users', sId));
          await deleteDoc(doc(db, 'public_profiles', sId));
          
          showSuccessToast("Usuario y todos sus datos asociados han sido eliminados correctamente");
        } catch (error) {
          console.error("Error deleting user from Firestore:", error);
          handleFirestoreError(error, OperationType.DELETE, `users/${sId}`);
        }
      }
    );
  };

  const handleToggleArchive = async (studentId: string) => {
    const sId = String(studentId);
    const student = getStudentData(sId);
    if (!student) return;

    const newArchived = !student.isArchived;
    const updateData: any = {
      isArchived: newArchived
    };

    if (newArchived) {
      const approvedHours = getStudentApprovedHours(student);
      if (approvedHours >= TOTAL_REQUIRED_HOURS || student.status === 'Finalizado') {
        updateData.status = 'Finalizado';
        updateData.workStatus = 'Finalizado';
        updateData.projectIds = [];
        updateData.finalizedAt = student.finalizedAt || new Date().toISOString();
      }
    }

    // Immediate local state update
    setStudents(prev => {
      const next = prev.map(s => String(s.id) === sId ? { ...s, ...updateData } : s);
      localStorage.setItem('app_students', JSON.stringify(next));
      return next;
    });

    try {
      await setDoc(doc(db, 'users', sId), updateData, { merge: true });
      try {
        await setDoc(doc(db, 'public_profiles', sId), updateData, { merge: true });
      } catch (e) {
        console.warn("Could not sync public_profiles for archive toggle:", e);
      }
      showSuccessToast(newArchived ? "Expediente archivado correctamente" : "Expediente reactivado");
    } catch (error) {
      console.error("Error toggling archive in Firestore:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${sId}`);
    }
  };

  const handleUpdateProfile = async () => {
    if (!editingProfileForm) return;
    
    if (!editingProfileForm.firstName || editingProfileForm.firstName.trim() === '') {
      showErrorToast("El nombre es obligatorio");
      return;
    }
    
    try {
      const docRef = doc(db, 'users', user.uid);
      
      const derivedSkills = editingProfileForm.skillRatings?.map((s: any) => s.name) || editingProfileForm.skills || [];

      const updatedProfile = {
        ...userProfile,
        ...editingProfileForm,
        skills: derivedSkills,
        role: userProfile.role || 'user',
        status: userProfile.status || 'En Curso',
        career: userProfile.career || 'Arquitectura',
        uid: user.uid,
        email: user.email,
        createdAt: userProfile.createdAt || new Date().toISOString()
      };

      await setDoc(docRef, updatedProfile, { merge: true });
      
      // Sync to public_profiles
      const publicProfile = {
        firstName: updatedProfile.firstName,
        lastNamePaterno: updatedProfile.lastNamePaterno,
        lastNameMaterno: updatedProfile.lastNameMaterno,
        career: updatedProfile.career,
        skills: updatedProfile.skills,
        status: updatedProfile.status,
        role: updatedProfile.role,
        uid: updatedProfile.uid,
        email: updatedProfile.email,
        phone: updatedProfile.phone,
        projectIds: updatedProfile.projectIds || []
      };
      await setDoc(doc(db, 'public_profiles', user.uid), publicProfile, { merge: true });
      
      setUserProfile(updatedProfile);
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updatedProfile));
      
      // Update students list too
      setStudents(prev => prev.map(s => s.id === user.uid ? { ...s, ...updatedProfile, name: `${updatedProfile.firstName} ${updatedProfile.lastNamePaterno} ${updatedProfile.lastNameMaterno}` } : s));
      
      setShowProfileModal(false);
      showSuccessToast("Perfil actualizado");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const handleUpdateProfileDirect = async (updatedProfile: any) => {
    try {
      const docRef = doc(db, 'users', user.uid);
      await setDoc(docRef, updatedProfile, { merge: true });
      
      const publicProfile = {
        firstName: updatedProfile.firstName,
        lastNamePaterno: updatedProfile.lastNamePaterno,
        lastNameMaterno: updatedProfile.lastNameMaterno,
        career: updatedProfile.career,
        skills: updatedProfile.skills,
        status: updatedProfile.status,
        role: updatedProfile.role,
        uid: updatedProfile.uid,
        email: updatedProfile.email,
        phone: updatedProfile.phone,
        projectIds: updatedProfile.projectIds || []
      };
      await setDoc(doc(db, 'public_profiles', user.uid), publicProfile, { merge: true });
      
      setUserProfile(updatedProfile);
      localStorage.setItem(`profile_${user.uid}`, JSON.stringify(updatedProfile));
      setStudents(prev => prev.map(s => s.id === user.uid ? { ...s, ...updatedProfile, name: `${updatedProfile.firstName} ${updatedProfile.lastNamePaterno} ${updatedProfile.lastNameMaterno}` } : s));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const { breakpoint } = useBreakpoint();

  if (loading) return (
    <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#121212]' : 'bg-slate-50'}`}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
        <p className={`${isDarkMode ? 'text-slate-400' : 'text-slate-500'} font-bold animate-pulse`}>Cargando aplicación...</p>
      </div>
    </div>
  );
  if (!user) return <Login />;
  
  if (!userProfile) {
    const effective = getEffectiveRole(user?.email);
    if (effective !== 'user') {
      return (
        <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#121212]' : 'bg-slate-50'}`}>
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
            <p className={`${isDarkMode ? 'text-purple-400' : 'text-purple-600'} font-bold animate-pulse`}>
              Cargando perfil de {ROLE_LABELS[effective]?.label || 'Coordinación'}...
            </p>
          </div>
        </div>
      );
    }
    return <ProfileForm user={user} isDarkMode={isDarkMode} onComplete={(profile) => {
      setUserProfile(profile);
      const eff = getEffectiveRole(user?.email, profile.role);
      setUserRole(eff);
      setCurrentUserId(profile.uid || null);
      setView(eff === 'user' || eff === 'student_coordinator' ? 'user-dashboard' : 'dashboard');
    }} />;
  }

  return (
    <ErrorBoundary>
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 5000,
        }}
      >
        {(t) => (
          <div
            className={`${
              t.visible ? 'animate-in fade-in zoom-in duration-300' : 'animate-out fade-out zoom-out duration-300'
            } max-w-md w-full bg-white dark:bg-[#1a1a1a] shadow-2xl rounded-[1.5rem] pointer-events-auto flex flex-col overflow-hidden border ${
              isDarkMode ? 'border-white/10' : 'border-slate-200'
            }`}
            onClick={() => toast.dismiss(t.id)}
          >
            <div className="p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                t.type === 'success' ? 'bg-emerald-100 text-emerald-600' : 
                t.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-indigo-100 text-indigo-600'
              }`}>
                {t.type === 'success' ? <CheckCircle2 size={20} /> : 
                 t.type === 'error' ? <XCircle size={20} /> : <Clock size={20} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {t.type === 'success' ? 'Éxito' : t.type === 'error' ? 'Error' : 'Información'}
                </p>
                <p className={`text-xs font-bold truncate ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                  {String(t.message)}
                </p>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); toast.dismiss(t.id); }}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-all text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="h-1 w-full bg-slate-100 dark:bg-white/5">
              <div 
                className={`h-full transition-all duration-100 ease-linear ${
                  t.type === 'success' ? 'bg-emerald-500' : 
                  t.type === 'error' ? 'bg-rose-500' : 'bg-indigo-500'
                }`}
                style={{ 
                  width: t.visible ? '0%' : '100%',
                  transitionDuration: '5000ms'
                }}
              />
            </div>
          </div>
        )}
      </Toaster>
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        isDarkMode={isDarkMode}
      />
      <div className={`flex min-h-screen font-sans selection:bg-indigo-100 overflow-x-hidden transition-colors ${isDarkMode ? 'bg-[#0a0a0a] text-white' : 'bg-slate-50 text-slate-900'}`}>
        <Sidebar 
          view={view} 
          setView={setView} 
          setEditingRecordId={setEditingRecordId} 
          userRole={userRole} 
          setUserRole={setUserRole} 
          setCurrentUserId={setCurrentUserId} 
          currentUserId={currentUserId}
          firstStudentId={students[0]?.id} 
          user={user} 
          students={studentsWithRecords}
          projects={projects}
          setSelectedProjectId={setSelectedProjectId}
          selectedProjectId={selectedProjectId}
          unreadNotifications={unreadCount}
          onOpenNotifications={() => setIsNotificationCenterOpen(true)}
          userProfile={userProfile}
          isLoadingConfig={isLoadingConfig}
          onOpenProfile={() => {
            setEditingProfileForm({
              ...userProfile,
              firstName: userProfile.firstName || '',
              lastNamePaterno: userProfile.lastNamePaterno || '',
              lastNameMaterno: userProfile.lastNameMaterno || '',
              email: userProfile.email || '',
              phone: userProfile.phone || '',
              emergencyPhone: userProfile.emergencyPhone || '',
              skills: userProfile.skills || [],
              skillRatings: userProfile.skillRatings || [],
              brigadePeriod: userProfile.brigadePeriod || '',
              studentId: userProfile.studentId || '',
              career: userProfile.career || '',
              status: userProfile.status || 'En Curso',
            });
            setShowProfileModal(true);
          }}
          isDarkMode={isDarkMode}
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
        />
        
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Global Header - Responsive */}
          <header className={`${isDarkMode ? 'bg-[#121212] border-white/10' : 'bg-white border-slate-200'} border-b px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between z-40 sticky top-0 ${breakpoint === 'mobile' ? 'h-16' : 'h-14 lg:h-16'}`}>
            <div className="flex items-center gap-3">
              {breakpoint === 'mobile' && (
                <button 
                  onClick={() => setIsMobileMenuOpen(true)}
                  className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  <Menu size={24} />
                </button>
              )}
              
              {/* Project Title if in workspace */}
              {view === 'project-workspace' && selectedProjectId ? (
                <div className="flex items-center gap-2 min-w-0">
                  <h1 className={`font-black truncate max-w-[140px] sm:max-w-xs uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                    {projects.find(p => p.id === selectedProjectId)?.name}
                  </h1>
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0" />
                </div>
              ) : (
                <h1 className={`font-black uppercase tracking-tight truncate max-w-[240px] sm:max-w-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  {view === 'dashboard' ? 'Dashboard' : view === 'session' ? 'Sesión de Trabajo' : view === 'validation' ? 'Validación' : view === 'user-dashboard' ? 'Mi Progreso' : (view === 'skill-map' || view === 'skills') ? 'Mapa de Habilidades' : 'Directorio'}
                </h1>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all ${isDarkMode ? 'text-yellow-400 hover:bg-white/5' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <button 
                onClick={() => setIsNotificationCenterOpen(true)}
                className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all relative group ${isDarkMode ? 'text-gray-400 hover:bg-white/5' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
              >
                <Bell size={20} className="group-hover:rotate-12 transition-transform" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-white shadow-sm">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              <div className="relative">
                <button 
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2 p-1.5 pr-4 hover:bg-slate-100 rounded-xl transition-all group min-h-[44px]"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center text-white font-black text-xs">
                    {user?.displayName?.charAt(0) || 'U'}
                  </div>
                  {breakpoint !== 'mobile' && (
                    <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors">
                      {user?.displayName?.split(' ')[0] || 'Perfil'}
                    </span>
                  )}
                </button>
                
                <AnimatePresence>
                  {isProfileMenuOpen && (
                    <>
                      <div key="profile-menu-overlay" className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                      <motion.div 
                        key="profile-menu-content"
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50"
                      >
                        {userRole !== 'user' && (
                          <button 
                            onClick={() => {
                              setIsProfileMenuOpen(false);
                              setEditingProfileForm({
                                ...userProfile,
                                firstName: userProfile.firstName || '',
                                lastNamePaterno: userProfile.lastNamePaterno || '',
                                lastNameMaterno: userProfile.lastNameMaterno || '',
                                email: userProfile.email || '',
                                phone: userProfile.phone || '',
                                emergencyPhone: userProfile.emergencyPhone || '',
                                skills: userProfile.skills || [],
                                skillRatings: userProfile.skillRatings || [],
                                brigadePeriod: userProfile.brigadePeriod || '',
                                studentId: userProfile.studentId || '',
                                career: userProfile.career || '',
                                status: userProfile.status || 'En Curso',
                              });
                              setShowProfileModal(true);
                            }}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors flex items-center gap-2"
                          >
                            <User size={16} /> Mi Perfil
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            auth.signOut();
                          }}
                          className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2 border-t border-slate-100"
                        >
                          <ShieldOff size={16} /> Cerrar Sesión
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          <main className={`flex-1 w-full animate-in fade-in duration-700 overflow-x-hidden ${view === 'skill-map' ? 'h-full' : (breakpoint === 'mobile' ? 'p-4' : 'p-4 sm:p-6 lg:p-12 max-w-7xl mx-auto')}`}>
            {view === 'user-dashboard' && currentUserId && (
            isLoadingStudents ? (
              <div className="space-y-8 animate-pulse">
                <div className="h-12 bg-slate-100 rounded-2xl w-1/4"></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="md:col-span-2 h-96 bg-slate-50 rounded-[3rem]"></div>
                  <div className="h-96 bg-slate-50 rounded-[3rem]"></div>
                </div>
              </div>
            ) : (
              <UserDashboard 
                student={getStudentData(currentUserId || '')} 
                setStudents={setStudents} 
                userRole={userRole} 
                categories={categories}
                setCategories={setCategories}
                projects={projects}
                students={studentsWithRecords}
                checkTimeOverlap={checkTimeOverlap}
                selectedRecords={selectedRecords}
                setSelectedRecords={setSelectedRecords}
                handleDeleteSelected={handleDeleteSelected}
                setView={setView}
                setSelectedProjectId={setSelectedProjectId}
                isDarkMode={isDarkMode}
              />
            )
          )}
          {view === 'project-directory' && (
            isLoadingConfig ? (
              <div className="space-y-8 animate-pulse">
                <div className="h-12 bg-slate-100 rounded-2xl w-1/3"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={`placeholder-proj-${i}`} className="h-64 bg-slate-50 rounded-[2.5rem]"></div>
                  ))}
                </div>
              </div>
            ) : (
              <ProjectDirectory 
                projects={projects}
                setProjects={setProjects}
                onDeleteProject={handleDeleteProject}
                userRole={userRole}
                selectedProjectId={selectedProjectId}
                userProfile={userProfile}
                onUpdateProfile={handleUpdateProfileDirect}
                onOpenWorkspace={(id: string) => {
                  setSelectedProjectId(id);
                  setView('project-workspace');
                }}
                isDarkMode={isDarkMode}
              />
            )
          )}
          {view === 'validation' && userRole !== 'user' && (
            isLoadingStudents ? (
              <div className="space-y-8 animate-pulse">
                <div className="h-12 bg-slate-100 rounded-2xl w-1/4"></div>
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={`placeholder-val-${i}`} className="h-32 bg-slate-50 rounded-[2rem]"></div>
                  ))}
                </div>
              </div>
            ) : (
              <AdminValidation 
                students={studentsWithRecords}
                setStudents={setStudents}
                setSessions={setSessions}
                categories={categories}
                projects={projects}
                isDarkMode={isDarkMode}
              />
            )
          )}
          {view === 'project-workspace' && selectedProjectId && (
            <ProjectWorkspace
              projectId={selectedProjectId}
              project={projects.find(p => p.id === selectedProjectId)}
              userRole={userRole}
              currentUser={user}
              students={studentsWithRecords}
              initialTaskId={selectedTaskId}
              onBack={() => {
                setSelectedProjectId(null);
                setSelectedTaskId(null);
                setView('project-directory');
              }}
              isDarkMode={isDarkMode}
              onOpenNotifications={() => setIsNotificationCenterOpen(true)}
              unreadNotifications={unreadCount}
            />
          )}
          {view === 'skills' && (
            <SkillsView 
              users={activeEnrolledStudents}
              currentUserRole={userRole}
              currentUserId={user?.uid || ''}
              projects={projects}
              isDarkMode={isDarkMode}
            />
          )}
          {view === 'task-board' && (
            <TaskWorkspace
              initialProjectId={selectedProjectId || undefined}
              projects={projects}
              students={studentsWithRecords}
              currentUserId={user?.uid || ''}
              currentUserName={userProfile ? `${userProfile.firstName || ''} ${userProfile.lastNamePaterno || ''}`.trim() : (user?.displayName || 'Usuario')}
              currentUserRole={userRole}
              isDarkMode={isDarkMode}
              onLogHoursForTask={async (task) => {
                const currentUid = user?.uid || '';
                const currentStudent = students.find((s: any) => s.id === currentUid);
                const studentName = currentStudent?.name || user?.displayName || 'Alumno';
                const hoursNum = 4;
                const nowIso = new Date().toISOString();

                try {
                  await addDoc(collection(db, 'sesiones'), {
                    userId: currentUid,
                    studentId: currentUid,
                    studentName: studentName,
                    date: getCDMXDateString(),
                    startTime: '09:00',
                    endTime: '13:00',
                    hours: hoursNum,
                    horasCalculadas: hoursNum,
                    categoryId: categories[0]?.id || 'cat-1',
                    description: `Tarea completada: ${task.title}${task.description ? ' - ' + task.description : ''}`,
                    projectId: task.projectId,
                    status: 'A',
                    estado: userRole === 'user' ? 'pendiente' : 'aprobado',
                    validationStatus: userRole === 'user' ? 'pendiente' : 'aprobado',
                    createdAt: nowIso,
                    createdBy: currentUid
                  });
                  toast.success(`Horas de "${task.title}" asentadas exitosamente en tu bitácora`);
                } catch (err) {
                  toast.error('Error al asentar horas en la bitácora');
                }
              }}
            />
          )}
          {view === 'session' && (
            permissions.isCoordinator ? (
              <SessionWorkspace
                projects={projects}
                students={studentsWithRecords}
                categories={categories}
                userRole={userRole}
                currentUser={user}
                onBack={() => setView('dashboard')}
                isDarkMode={isDarkMode}
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-[50vh]">
                <div className={`p-8 rounded-3xl border max-w-md mx-auto ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                  <h3 className="text-lg font-black uppercase tracking-wider mb-2">Acceso Exclusivo para Coordinadores</h3>
                  <p className="text-xs text-slate-500 dark:text-gray-400 mb-6">El módulo de Sesión de Trabajo está reservado únicamente para coordinadores del servicio social.</p>
                  <button 
                    onClick={() => setView(userRole === 'user' ? 'user-dashboard' : 'dashboard')}
                    className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all text-xs uppercase tracking-wider"
                  >
                    Volver a mi panel
                  </button>
                </div>
              </div>
            )
          )}
          {view === 'dashboard' && userRole !== 'user' && (
            <div className="space-y-6 sm:space-y-10">
              <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 sm:gap-8">
                <div>
                  <h2 className={`text-3xl sm:text-5xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Prestadores</h2>
                  <p className={`${isDarkMode ? 'text-gray-500' : 'text-slate-500'} font-medium mt-1 uppercase text-[9px] sm:text-[11px] tracking-[0.2em] italic`}>Sistema central de seguimiento y control de horas</p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-row flex-wrap gap-2 sm:gap-4 w-full sm:w-auto">
                  {permissions.isCoordinator && (
                    <button 
                      onClick={() => setView('session')} 
                      className={`w-full sm:w-auto px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.2em] shadow-xl shadow-indigo-600/20 transition-all active:scale-95 bg-indigo-600 text-white hover:bg-indigo-700 min-h-[44px]`}
                    >
                      <Layers size={18} /> Sesión
                    </button>
                  )}
                  <button onClick={() => { setSelectedProjectId(null); setView('project-directory'); }} className={`w-full sm:w-auto px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.2em] shadow-sm transition-all active:scale-95 min-h-[44px] ${isDarkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}><Briefcase size={18} /> Directorio</button>
                  {(userRole === 'admin' || userRole === 'coordinator') && (
                    <>
                      <button 
                        id="export-sheets-btn"
                        onClick={handleExportToSheets} 
                        disabled={isExporting}
                        className={`w-full sm:w-auto px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.2em] shadow-xl shadow-emerald-500/20 transition-all active:scale-95 min-h-[44px] ${isDarkMode ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                      >
                        <Download size={18} /> {isExporting ? 'Exportando...' : 'Sheets'}
                      </button>
                      <button onClick={() => { setShowBulkProjectAssign(true); setSelectedStudentsForBulk([]); setSelectedProjectsForBulk([]); }} className="w-full sm:w-auto bg-amber-500 text-white px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.2em] shadow-xl shadow-amber-500/20 hover:bg-amber-600 transition-all active:scale-95 min-h-[44px]"><Folder size={18} /> Asignar</button>
                      <button onClick={() => setView('group-activity')} className="w-full sm:w-auto bg-emerald-600 text-white px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.2em] shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 transition-all active:scale-95 min-h-[44px]"><Users size={18} /> Manual</button>
                      <button onClick={handleSyncPublicProfiles} className={`w-full sm:w-auto px-4 py-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-black text-[10px] sm:text-xs uppercase tracking-widest sm:tracking-[0.2em] shadow-sm transition-all active:scale-95 min-h-[44px] ${isDarkMode ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50'}`}><RefreshCw size={18} /> Sincronizar</button>
                    </>
                  )}
                </div>
              </div>

              {/* Filtros */}
              <div className={`${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'} p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm flex flex-col gap-4 sm:gap-6 max-w-full overflow-hidden`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 min-w-0">
                  <div className="flex items-center justify-between w-full sm:w-auto gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                      <div className={`p-2 rounded-xl shrink-0 ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
                        <Filter size={18} />
                      </div>
                      <div className="min-w-0">
                        <h3 className={`text-base sm:text-lg font-black tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Panel de Filtrado</h3>
                        <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-widest truncate ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Gestión de búsqueda y segmentación</p>
                      </div>
                    </div>

                    {/* Botón toggle móvil para colapsar/expandir filtros */}
                    <button
                      onClick={() => setShowMobileFilters(prev => !prev)}
                      className={`sm:hidden px-3 py-2 rounded-xl border text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shrink-0 min-h-[38px] ${
                        showMobileFilters || activeFilterCount > 0
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : isDarkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-slate-50 border-slate-200 text-slate-700'
                      }`}
                      aria-label="Alternar visibilidad de filtros"
                    >
                      <Filter size={12} />
                      <span>Filtros</span>
                      {activeFilterCount > 0 && (
                        <span className="w-4 h-4 rounded-full bg-white text-indigo-600 text-[9px] font-black flex items-center justify-center">
                          {activeFilterCount}
                        </span>
                      )}
                      <ChevronDown size={14} className={`transition-transform duration-200 ${showMobileFilters ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  <div className="w-full sm:w-auto flex items-center gap-2 min-w-0 overflow-hidden">
                    <div className={`p-1 rounded-2xl border flex items-center gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar scroll-smooth whitespace-nowrap min-w-0 ${isDarkMode ? 'bg-black/30 border-white/10' : 'bg-slate-100 border-slate-200'}`}>
                      <button
                        onClick={() => setDashboardTab('students')}
                        className={`px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] sm:min-h-0 ${
                          dashboardTab === 'students'
                            ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-white text-indigo-600 shadow-sm')
                            : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                        }`}
                      >
                        <Users size={13} />
                        <span>Alumnos Activos</span>
                      </button>
                      <button
                        onClick={() => setDashboardTab('coordinators')}
                        className={`px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] sm:min-h-0 ${
                          dashboardTab === 'coordinators'
                            ? (isDarkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-white text-indigo-600 shadow-sm')
                            : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                        }`}
                      >
                        <ShieldCheck size={13} />
                        <span>Coordinadores</span>
                      </button>
                      <button
                        onClick={() => setDashboardTab('archived')}
                        className={`px-3 py-2 sm:px-3.5 sm:py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap min-h-[38px] sm:min-h-0 ${
                          dashboardTab === 'archived'
                            ? (isDarkMode ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-amber-500 text-white shadow-sm')
                            : (isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-600 hover:text-slate-900')
                        }`}
                      >
                        <Layers size={13} />
                        <span>Concluidos / Archivados</span>
                      </button>
                    </div>

                    <span className={`hidden sm:inline-flex shrink-0 ${isDarkMode ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-900'} px-3 py-1.5 rounded-xl text-[10px] sm:text-[11px] font-black uppercase tracking-widest border ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                      {filteredStudents.length} {dashboardTab === 'coordinators' ? (filteredStudents.length === 1 ? 'Coord.' : 'Coords.') : (filteredStudents.length === 1 ? 'Alumno' : 'Alumnos')}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-4 sm:gap-6">
                  {/* Search Bar Refined */}
                  <div className="w-full relative group">
                    <Search className={`absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 transition-colors duration-300 ${isDarkMode ? 'text-gray-600 group-focus-within:text-indigo-400' : 'text-slate-300 group-focus-within:text-indigo-500'}`} size={18} />
                    <input 
                      type="text" 
                      placeholder="Busca por nombre, carrera, brigada o etiqueta..." 
                      className={`w-full pl-11 sm:pl-14 pr-10 py-3.5 sm:py-4 rounded-2xl border text-xs sm:text-sm font-bold outline-none transition-all ${
                        isDarkMode 
                          ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30' 
                          : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 focus:border-indigo-500/20 shadow-sm'
                      }`} 
                      value={searchTerm} 
                      onChange={e => setSearchTerm(e.target.value)} 
                    />
                    {searchTerm && (
                      <button 
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 transition-colors"
                        aria-label="Limpiar búsqueda"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Resumen móvil de conteo y botón para limpiar */}
                  <div className="flex sm:hidden items-center justify-between text-[10px] font-bold uppercase tracking-wider px-1 text-slate-400">
                    <span>Mostrando: <strong className="text-slate-800 dark:text-white">{filteredStudents.length}</strong> {dashboardTab === 'coordinators' ? 'coordinadores' : 'alumnos'}</span>
                    {activeFilterCount > 0 && (
                      <button onClick={handleResetFilters} className="text-indigo-600 dark:text-indigo-400 font-black hover:underline flex items-center gap-1">
                        <X size={12} /> Limpiar ({activeFilterCount})
                      </button>
                    )}
                  </div>

                  {/* Filter Selects Grid - Colapsable en móvil, siempre visible en pantallas sm: y superiores */}
                  <div className={`${showMobileFilters ? 'grid' : 'hidden sm:grid'} grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 w-full animate-in fade-in duration-200`}>
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Briefcase size={10} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Proyecto</span>
                      </div>
                      <select 
                        className={`w-full px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-[11px] font-black uppercase outline-none transition-all shadow-sm cursor-pointer appearance-none min-h-[44px] ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500/30 hover:border-slate-300'
                        }`} 
                        value={filterProject} 
                        onChange={e => setFilterProject(e.target.value)}
                      >
                        <option value="Todos" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>TODOS LOS PROYECTOS</option>
                        {projects.map(p => <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>{p.name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <BookOpen size={10} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Carrera</span>
                      </div>
                      <select 
                        className={`w-full px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-[11px] font-black uppercase outline-none transition-all shadow-sm cursor-pointer appearance-none min-h-[44px] ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500/30 hover:border-slate-300'
                        }`} 
                        value={filterCareer} 
                        onChange={e => setFilterCareer(e.target.value)}
                      >
                        <option value="Todos" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>TODAS LAS CARRERAS</option>
                        {uniqueCareers.map(c => <option key={c} value={c} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>{c}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <CalendarIcon size={10} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Brigada</span>
                      </div>
                      <select 
                        className={`w-full px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-[11px] font-black uppercase outline-none transition-all shadow-sm cursor-pointer appearance-none min-h-[44px] ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500/30 hover:border-slate-300'
                        }`} 
                        value={filterBrigade} 
                        onChange={e => setFilterBrigade(e.target.value)}
                      >
                        <option value="Todos" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>TODAS LAS BRIGADAS</option>
                        {uniqueBrigades.map(b => <option key={b} value={b} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>{b}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Layers size={10} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Estatus Acad.</span>
                      </div>
                      <select 
                        className={`w-full px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-[11px] font-black uppercase outline-none transition-all shadow-sm cursor-pointer appearance-none min-h-[44px] ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500/30 hover:border-slate-300'
                        }`} 
                        value={filterStatus} 
                        onChange={e => setFilterStatus(e.target.value)}
                      >
                        <option value="Todos" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>TODOS LOS ESTATUS</option>
                        {Object.keys(STUDENT_STATUS).map(s => <option key={s} value={s} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>{s}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <Zap size={10} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Carga Trabajo</span>
                      </div>
                      <select 
                        className={`w-full px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-[11px] font-black uppercase outline-none transition-all shadow-sm cursor-pointer appearance-none min-h-[44px] ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500/30 hover:border-slate-300'
                        }`} 
                        value={filterWork} 
                        onChange={e => setFilterWork(e.target.value)}
                      >
                        <option value="Todos" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>TODAS LAS CARGAS</option>
                        {Object.keys(WORK_STATUS).map(w => <option key={w} value={w} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>{w}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="flex items-center gap-2 ml-1">
                        <ArrowDownUp size={10} className={isDarkMode ? 'text-gray-600' : 'text-slate-400'} />
                        <span className={`text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Ordenar</span>
                      </div>
                      <select 
                        className={`w-full px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-xl border text-[11px] font-black uppercase outline-none transition-all shadow-sm cursor-pointer appearance-none min-h-[44px] ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' 
                            : 'bg-white border-slate-200 text-slate-900 focus:border-indigo-500/30 hover:border-slate-300'
                        }`} 
                        value={sortHours} 
                        onChange={e => setSortHours(e.target.value as any)}
                      >
                        <option value="none" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>SIN ORDENAR</option>
                        <option value="desc" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>MAYOR HORAS</option>
                        <option value="asc" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>MENOR HORAS</option>
                      </select>
                    </div>
                  </div>
                </div>

                {(filterProject !== 'Todos' || filterCategories.length > 0 || filterCareer !== 'Todos' || filterBrigade !== 'Todos' || filterStatus !== 'Todos' || filterWork !== 'Todos' || sortHours !== 'none' || searchTerm !== '') && (
                  <div className="flex flex-col sm:flex-row justify-between items-center pt-2 border-t border-slate-100 dark:border-white/5 mt-2 gap-4">
                    <div className="flex flex-wrap gap-2">
                      {filterProject !== 'Todos' && (
                        <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 ${isDarkMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-100'}`}>
                          <Briefcase size={10} /> {projects.find(p => p.id === filterProject)?.name}
                        </div>
                      )}
                      {filterStatus !== 'Todos' && (
                        <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 ${isDarkMode ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                          <Layers size={10} /> {filterStatus}
                        </div>
                      )}
                      {filterCategories.length > 0 && filterCategories.length < categories.length && (
                        <div className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 ${isDarkMode ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          <Filter size={10} /> {filterCategories.length} Categorías
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={() => {
                        setFilterProject('Todos');
                        setFilterCategories(categories.map(c => c.id));
                        setFilterCareer('Todos');
                        setFilterBrigade('Todos');
                        setFilterStatus('Todos');
                        setFilterWork('Todos');
                        setSortHours('none');
                        setSearchTerm('');
                      }}
                      className={`text-[10px] font-black hover:text-red-500 uppercase tracking-widest flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isDarkMode ? 'text-gray-500 bg-white/5 hover:bg-white/10' : 'text-slate-400 bg-slate-50 hover:bg-slate-100'}`}
                    >
                      <RefreshCw size={12} className="group-hover:rotate-180 transition-transform duration-500" /> Reiniciar Filtros
                    </button>
                  </div>
                )}
              </div>

              {/* Stats Section */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 w-full">
                {isLoadingStudents ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={`placeholder-stat-${i}`} className={`p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm animate-pulse flex flex-col justify-center items-center text-center gap-2 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}>
                      <div className={`h-3 rounded-full w-1/2 ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}></div>
                      <div className={`h-10 rounded-xl w-3/4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                    </div>
                  ))
                ) : (
                  <>
                    <div className={`p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex flex-col justify-center items-center text-center ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 sm:mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Total Enrolados</span>
                      <span className="text-3xl sm:text-4xl font-black text-indigo-600">{chartData.totalEnrolled}</span>
                    </div>
                    <div className={`p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex flex-col justify-center items-center text-center ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 sm:mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Promedio Hrs/Alumno</span>
                      <span className="text-3xl sm:text-4xl font-black text-emerald-600">{Number(chartData.avgHoursPerStudent.toFixed(2))}</span>
                    </div>
                    <div className={`p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex flex-col justify-center items-center text-center ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 sm:mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Progreso General</span>
                      <span className="text-3xl sm:text-4xl font-black text-indigo-600">{Number(chartData.progressPerc.toFixed(2))}%</span>
                    </div>
                    <div className={`p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] border shadow-sm flex flex-col justify-center items-center text-center ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                      <span className={`text-[10px] font-black uppercase tracking-widest mb-1 sm:mb-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Total Proyectos</span>
                      <span className="text-3xl sm:text-4xl font-black text-amber-500">{projects.length}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Charts Section */}
              <div className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm mb-6 sm:mb-8 max-w-full overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                {isLoadingStudents ? (
                  <div className="space-y-6 animate-pulse">
                    <div className="flex justify-between items-end">
                      <div className={`h-8 rounded-xl w-1/3 ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}></div>
                      <div className={`h-6 rounded-lg w-1/4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                    </div>
                    <div className={`h-4 rounded-full w-full ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}></div>
                    <div className="flex justify-between">
                      <div className={`h-3 rounded-full w-1/4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                      <div className={`h-3 rounded-full w-1/4 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-4 gap-2">
                      <h3 className={`text-lg sm:text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Progreso General de la Generación</h3>
                      <span className="text-xl sm:text-2xl font-black text-indigo-600">{Number(chartData.progressPerc.toFixed(2))}%</span>
                    </div>
                    <div className={`w-full h-3 sm:h-4 rounded-full overflow-hidden shadow-inner ${isDarkMode ? 'bg-white/10' : 'bg-slate-100'}`}>
                      <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${chartData.progressPerc}%` }}></div>
                    </div>
                    <div className={`flex justify-between mt-3 text-[8px] sm:text-[10px] font-black uppercase ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      <span>{Number(chartData.totalCompletedHours.toFixed(2))} Horas Completadas</span>
                      <span>{chartData.totalRequired} Horas Requeridas</span>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 max-w-full">
                <div className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm max-w-full overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <h3 className={`text-lg sm:text-xl font-black tracking-tight mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Horas por Proyecto</h3>
                  {isLoadingStudents ? (
                    <div className={`h-64 sm:h-80 w-full rounded-2xl animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                  ) : (
                    <div className="h-64 sm:h-80 w-full flex flex-col">
                      <ChartContainer height="100%" minHeight={260} isDarkMode={isDarkMode}>
                        <BarChart data={chartData.projectChartData} margin={{ bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#e2e8f0'} />
                          <XAxis dataKey="name" tick={<CustomXAxisTick isDarkMode={isDarkMode} isMobile={breakpoint === 'mobile'} />} axisLine={false} tickLine={false} height={100} interval={0} />
                          <YAxis tick={{fontSize: 8, fill: isDarkMode ? '#666' : '#64748b'}} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'}} contentStyle={{borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', backgroundColor: isDarkMode ? '#1a1a1a' : '#fff', color: isDarkMode ? '#fff' : '#000'}} />
                          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                            {chartData.projectChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="hours" position="top" style={{ fill: isDarkMode ? '#999' : '#64748b', fontSize: breakpoint === 'mobile' ? '7px' : '9px', fontWeight: '500' }} />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>

                <div className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm max-w-full overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <h3 className={`text-lg sm:text-xl font-black tracking-tight mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Promedio Horas/Alumno por Proyecto</h3>
                  {isLoadingStudents ? (
                    <div className={`h-64 sm:h-80 w-full rounded-2xl animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                  ) : (
                    <div className="h-64 sm:h-80 w-full flex flex-col">
                      <ChartContainer height="100%" minHeight={260} isDarkMode={isDarkMode}>
                        <BarChart data={chartData.projectChartData} margin={{ bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#e2e8f0'} />
                          <XAxis dataKey="name" tick={<CustomXAxisTick isDarkMode={isDarkMode} isMobile={breakpoint === 'mobile'} />} axisLine={false} tickLine={false} height={100} interval={0} />
                          <YAxis tick={{fontSize: 8, fill: isDarkMode ? '#666' : '#64748b'}} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'}} contentStyle={{borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', backgroundColor: isDarkMode ? '#1a1a1a' : '#fff', color: isDarkMode ? '#fff' : '#000'}} />
                          <Bar dataKey="avgHours" radius={[4, 4, 0, 0]}>
                            {chartData.projectChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="avgHours" position="top" style={{ fill: isDarkMode ? '#999' : '#64748b', fontSize: breakpoint === 'mobile' ? '7px' : '9px', fontWeight: '500' }} formatter={(val: number) => val.toFixed(1)} />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>

                <div className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm max-w-full overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <h3 className={`text-lg sm:text-xl font-black tracking-tight mb-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Distribución de Alumnos por Proyecto</h3>
                  {isLoadingStudents ? (
                    <div className={`h-64 sm:h-80 w-full rounded-2xl animate-pulse ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}></div>
                  ) : (
                    <div className="h-64 sm:h-80 w-full flex flex-col">
                      <ChartContainer height="100%" minHeight={260} isDarkMode={isDarkMode}>
                        <BarChart data={chartData.projectChartData} margin={{ bottom: 40 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDarkMode ? '#333' : '#e2e8f0'} />
                          <XAxis dataKey="name" tick={<CustomXAxisTick isDarkMode={isDarkMode} isMobile={breakpoint === 'mobile'} />} axisLine={false} tickLine={false} height={100} interval={0} />
                          <YAxis tick={{fontSize: 8, fill: isDarkMode ? '#666' : '#64748b'}} axisLine={false} tickLine={false} />
                          <Tooltip cursor={{fill: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f8fafc'}} contentStyle={{borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', backgroundColor: isDarkMode ? '#1a1a1a' : '#fff', color: isDarkMode ? '#fff' : '#000'}} />
                          <Bar dataKey="studentCount" radius={[4, 4, 0, 0]}>
                            {chartData.projectChartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                            <LabelList dataKey="studentCount" position="top" style={{ fill: isDarkMode ? '#999' : '#64748b', fontSize: breakpoint === 'mobile' ? '7px' : '9px', fontWeight: '500' }} />
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>

                <div className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm max-w-full overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                      <h3 className={`text-lg sm:text-xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Distribución de Categorías</h3>
                      <p className={`text-[9px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Breakdown por tipo de actividad</p>
                    </div>
                    <div className="flex gap-2">
                       <button 
                        onClick={() => setFilterCategories(categories.map(c => c.id))}
                        className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-indigo-400 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-indigo-600 hover:bg-slate-100'}`}
                      >
                        Todas
                      </button>
                      <button 
                        onClick={() => setFilterCategories([])}
                        className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}
                      >
                        Ninguna
                      </button>
                    </div>
                  </div>

                  {/* Chips de Categorías Refactorizados */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {categories.map(cat => {
                      const isSelected = filterCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setFilterCategories(prev => 
                              prev.includes(cat.id) ? prev.filter(id => id !== cat.id) : [...prev, cat.id]
                            );
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all border flex items-center gap-2 ${
                            isSelected 
                              ? (isDarkMode ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300' : 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm')
                              : (isDarkMode ? 'bg-white/5 border-white/5 text-gray-600 hover:border-gray-700' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300')
                          }`}
                        >
                          <div className={`w-2 h-2 rounded-full transition-all ${isSelected ? 'scale-100' : 'scale-75 opacity-50'}`} style={{ backgroundColor: cat.color }}></div>
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                  {isLoadingStudents ? (
                    <div className="h-48 sm:h-64 w-full bg-slate-50 rounded-2xl animate-pulse"></div>
                  ) : (
                    <div className="h-48 sm:h-64 w-full cursor-pointer flex flex-col">
                      <ChartContainer height="100%" minHeight={220} isDarkMode={isDarkMode}>
                        <PieChart>
                          <Pie
                            data={chartData.categoryChartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="hours"
                            onClick={(data: any) => {
                              if (data && data.id) {
                                setFilterCategories(prev => 
                                  prev.includes(data.id) ? prev.filter(id => id !== data.id) : [...prev, data.id]
                                );
                              }
                            }}
                          >
                                    {chartData.categoryChartData.map((entry, index) => {
                                      const cat = categories.find(c => c.name === entry.name);
                                      const isSelected = filterCategories.includes(entry.id);
                                      return (
                                        <Cell 
                                          key={`cell-${index}`} 
                                          fill={cat?.color || '#4f46e5'} 
                                          opacity={isSelected ? 1 : 0.1}
                                          stroke={isSelected && entry.hours > 0 ? (isDarkMode ? '#000' : '#fff') : 'none'}
                                          strokeWidth={2}
                                          className="transition-all"
                                        />
                                      );
                                    })}
                          </Pie>
                          <Tooltip contentStyle={{borderRadius: '0.75rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px'}} />
                          <Legend 
                            wrapperStyle={{fontSize: '8px', fontWeight: 'bold', cursor: 'pointer'}} 
                            onClick={(data: any) => {
                              const foundCat = categories.find(c => c.name === data.value);
                              if (foundCat) {
                                setFilterCategories(prev => 
                                  prev.includes(foundCat.id) ? prev.filter(id => id !== foundCat.id) : [...prev, foundCat.id]
                                );
                              }
                            }}
                            formatter={(value, entry: any) => {
                               const catId = (chartData.categoryChartData[entry.payload.index] as any)?.id;
                               const isSelected = filterCategories.includes(catId);
                               return <span className={isSelected ? (isDarkMode ? 'text-white' : 'text-slate-900') : 'text-slate-400 line-through opacity-50'}>{value}</span>;
                            }}
                          />
                        </PieChart>
                      </ChartContainer>
                    </div>
                  )}
                </div>
              </div>

              {/* Lista */}
              <div className="grid grid-cols-1 gap-6">
                {isLoadingStudents ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={`placeholder-student-${i}`} className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-sm animate-pulse flex flex-col md:flex-row items-center gap-6">
                      <div className="w-2 h-24 bg-slate-100 rounded-full"></div>
                      <div className="flex-1 space-y-4 w-full">
                        <div className="h-8 bg-slate-100 rounded-xl w-1/3"></div>
                        <div className="h-4 bg-slate-50 rounded-lg w-1/2"></div>
                        <div className="h-4 bg-slate-50 rounded-lg w-1/4"></div>
                      </div>
                      <div className="w-full md:w-48 h-12 bg-slate-100 rounded-2xl"></div>
                    </div>
                  ))
                ) : paginatedStudents.length === 0 ? (
                  <div className={`p-20 rounded-[4rem] border-4 border-dashed text-center space-y-6 ${isDarkMode ? 'bg-white/2 border-white/5' : 'bg-white border-slate-100'}`}>
                    <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto ${isDarkMode ? 'bg-white/5 text-gray-500' : 'bg-slate-50 text-slate-200'}`}>
                      <Users size={48} />
                    </div>
                    <p className={`font-black uppercase tracking-widest text-sm ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>No se encontraron alumnos con los filtros aplicados</p>
                  </div>
                ) : (
                  paginatedStudents.map(student => {
                  const totalHrs = getStudentApprovedHours(student);
                  const perc = Math.min(100, (totalHrs / TOTAL_REQUIRED_HOURS) * 100);
                  const totalSessions = (student?.records || []).length;
                  const countAbsences = (student?.records || []).filter((r: any) => r.status !== 'A').length;
                  const absencePerc = totalSessions > 0 ? (countAbsences / totalSessions) * 100 : 0;
                  const effectiveStatus = (isStudentFinished(student) || totalHrs >= TOTAL_REQUIRED_HOURS) ? 'Finalizado' : student.status;
                  const isArchivedStudent = Boolean(student.isArchived || effectiveStatus === 'Finalizado');
                  const targetRole = getEffectiveRole(student.email, student.role);
                  const isMasterPerson = targetRole === 'master_coordinator';
                  const isSuperPerson = targetRole === 'super_coordinator';
                  const isCoordinatorPerson = isMasterPerson || isSuperPerson || targetRole === 'coordinator' || student.role === 'admin' || Boolean(student.email && SUPER_ADMIN_EMAILS.includes(student.email));
                  const isStudentCoordinator = targetRole === 'student_coordinator';
                  const isPureCoordinator = isCoordinatorPerson && !isStudentCoordinator;
                  const hasNoHoursRequirement = isCoordinatorPerson;
                  const hasProjects = isPureCoordinator || (student.projectIds && student.projectIds.length > 0);

                  const canChangeTargetRole = !isMasterPerson && (
                    permissions.isMaster ||
                    (permissions.isSuper && targetRole !== 'super_coordinator') ||
                    (permissions.isCoordinator && (targetRole === 'user' || targetRole === 'student_coordinator'))
                  );
                  const canDeleteTarget = permissions.canDeleteUser(student);
                  
                    return (
                      <div key={student.id} onClick={() => { setSelectedStudentId(student.id); setView('student-detail'); }} className={`p-4 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden grid grid-cols-1 md:grid-cols-10 lg:grid-cols-[1fr_1.2fr_0.8fr] gap-4 sm:gap-6 min-w-0 max-w-full ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                        <div className={`absolute left-0 top-0 w-1.5 md:w-2 h-full transition-all duration-500 ${hasProjects ? 'bg-green-500' : 'bg-orange-500'}`}></div>
                        
                        {/* Col 1: Identidad */}
                        <div className="md:col-span-6 lg:col-span-1 pl-2 sm:pl-3 flex flex-col justify-center order-1 min-w-0">
                          <div className="flex flex-col mb-2 sm:mb-3 min-w-0">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mb-1 min-w-0">
                              <h3 className={`font-black text-xl sm:text-3xl tracking-tight leading-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{getDisplayName(student)}</h3>
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                {!isPureCoordinator && (
                                  <span className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase border shadow-sm shrink-0 
                                    ${isDarkMode ? 
                                      (effectiveStatus === 'En Curso' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                       effectiveStatus === 'Finalizado' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                       effectiveStatus === 'Pausada' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                       'bg-red-500/10 text-red-400 border-red-500/20') : 
                                      ((STUDENT_STATUS as any)[effectiveStatus]?.color || 'bg-slate-100')
                                    }`}>{effectiveStatus}</span>
                                )}
                                
                                <span className={`px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase border shadow-sm flex items-center gap-1 shrink-0 ${ROLE_LABELS[targetRole]?.badgeBg || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                  <ShieldCheck size={11} /> {ROLE_LABELS[targetRole]?.label || 'Alumno'}
                                </span>

                                {isArchivedStudent && (
                                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase bg-amber-500 text-white border border-amber-600 shadow-sm flex items-center gap-1 shrink-0">
                                    <Layers size={10} /> Archivado
                                  </span>
                                )}
                                <span className={`hidden sm:flex lg:hidden items-center gap-1.5 px-3 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest shrink-0 ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><GraduationCap size={12}/> {student.career}</span>
                              </div>
                            </div>
                            <p className="text-[10px] sm:text-sm text-slate-400 italic font-medium truncate">{getFullName(student)}</p>
                          </div>
                          
                          <div className="flex items-center gap-3 mt-1 sm:mt-2">
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedStudentId(student.id);
                                  setStudentForm({
                                    ...student,
                                    projectIds: student.projectIds || [],
                                    projectTasks: student.projectTasks || {},
                                    projectTaskHistory: student.projectTaskHistory || {},
                                    skills: student.skills || [],
                                    skillRatings: student.skillRatings || []
                                  });
                                  setShowEditStudent(true);
                                  setShowAddStudent(true);
                                }}
                                className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 min-h-[40px] sm:min-h-0 ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                                title="Editar Estudiante"
                              >
                                <Edit2 size={14} className="sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline lg:hidden text-[10px] font-black uppercase tracking-widest">Editar</span>
                              </button>

                              {canChangeTargetRole && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRoleModalStudent(student);
                                  }}
                                  className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 min-h-[40px] sm:min-h-0 ${isDarkMode ? 'text-indigo-400 hover:text-white hover:bg-indigo-500/20' : 'text-indigo-600 hover:bg-indigo-50'}`}
                                  title="Gestionar Rol del Usuario"
                                >
                                  <Shield size={14} className="sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest">Rol</span>
                                </button>
                              )}

                              {canDeleteTarget ? (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteStudent(student.id);
                                  }}
                                  className={`p-2 sm:px-3 sm:py-2 rounded-xl transition-all flex items-center gap-1.5 min-h-[40px] sm:min-h-0 ${isDarkMode ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/10' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                  title="Eliminar Estudiante"
                                >
                                  <Trash2 size={14} className="sm:w-4 sm:h-4" />
                                  <span className="hidden sm:inline lg:hidden text-[10px] font-black uppercase tracking-widest">Eliminar</span>
                                </button>
                              ) : (
                                <span 
                                  className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-300 dark:text-zinc-600 cursor-not-allowed opacity-50 flex items-center gap-1 min-h-[40px] sm:min-h-0" 
                                  title={isMasterPerson ? "El Coordinador Maestro no puede ser eliminado" : "Sin permisos para eliminar"}
                                >
                                  <Trash2 size={14} />
                                </span>
                              )}
                            </div>
                            
                            <div className="hidden lg:flex flex-wrap gap-3 text-[10px] font-black uppercase tracking-widest min-w-0">
                              <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border truncate ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}><GraduationCap size={14} className="shrink-0"/> <span className="truncate">{student.career}</span></span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-1.5 mt-3 sm:mt-5 min-w-0">
                             {student.email ? (
                               <a href={`mailto:${student.email}`} className={`flex items-center gap-2 font-bold text-[9px] sm:text-[10px] uppercase transition-colors min-w-0 ${isDarkMode ? 'text-gray-400 hover:text-indigo-400' : 'text-slate-500 hover:text-indigo-600'}`} onClick={(e) => e.stopPropagation()}>
                                 <Mail size={12} className="text-indigo-400 shrink-0"/> <span className="truncate">{student.email}</span>
                                </a>
                             ) : (
                               <div className="flex items-center gap-2 text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase min-w-0"><Mail size={12} className="shrink-0"/> <span className="truncate">SIN REGISTRO CORREO</span></div>
                             )}
                             {student.phone ? (
                               <a href={`tel:${student.phone}`} className={`flex items-center gap-2 font-bold text-[9px] sm:text-[10px] uppercase transition-colors min-w-0 ${isDarkMode ? 'text-gray-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-600'}`} onClick={(e) => e.stopPropagation()}>
                                 <Phone size={12} className="text-emerald-400 shrink-0"/> <span className="truncate">{student.phone}</span>
                                </a>
                             ) : (
                               <div className="flex items-center gap-2 text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase min-w-0"><Phone size={12} className="shrink-0"/> <span className="truncate">SIN REGISTRO TELÉFONO</span></div>
                             )}
                          </div>
                        </div>

                        {/* Col 3: Métricas */}
                        <div className="md:col-span-4 lg:col-span-1 flex flex-col justify-center order-2 lg:order-3 min-w-0">
                          {isMasterPerson || isSuperPerson ? (
                            <div className={`rounded-2xl sm:rounded-xl p-4 sm:p-5 flex flex-col justify-center items-center relative overflow-hidden shadow-inner md:shadow-none h-full gap-2 text-center ${
                              isMasterPerson
                                ? (isDarkMode ? 'bg-purple-500/10 border border-purple-500/20' : 'bg-purple-50 border border-purple-100')
                                : (isDarkMode ? 'bg-indigo-500/10 border border-indigo-500/20' : 'bg-indigo-50 border border-indigo-100')
                            }`}>
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isMasterPerson
                                  ? 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                                  : 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                              }`}>
                                <ShieldCheck size={24} />
                              </div>
                              <div>
                                <p className={`text-[10px] font-black uppercase tracking-widest ${
                                  isMasterPerson ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-600 dark:text-indigo-400'
                                }`}>
                                  {isMasterPerson ? 'Coordinador Maestro' : 'Supercoordinador'}
                                </p>
                                <p className={`text-[9px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'} mt-0.5`}>
                                  {isMasterPerson ? 'Dirección General' : 'Supervisión Institucional'}
                                </p>
                              </div>
                              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-sm ${
                                isMasterPerson ? 'bg-purple-600 text-white' : 'bg-indigo-600 text-white'
                              }`}>
                                {isMasterPerson ? 'Acceso Maestro' : 'Alta Dirección'}
                              </span>
                            </div>
                          ) : hasNoHoursRequirement ? (
                            <div className={`rounded-2xl sm:rounded-xl p-4 sm:p-5 flex flex-col justify-center items-center relative overflow-hidden shadow-inner md:shadow-none h-full gap-2 text-center ${isDarkMode ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-100'}`}>
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <CheckCircle2 size={24} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Horas Concluidas</p>
                                <p className={`text-[9px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'} mt-0.5`}>Equipo Coordinador</p>
                                {totalHrs > 0 && (
                                  <p className="text-[8px] font-bold text-slate-400 mt-0.5">{Number(totalHrs.toFixed(1))}h en historial</p>
                                )}
                              </div>
                              <span className="px-3 py-1 rounded-full text-[8px] font-black uppercase bg-emerald-600 text-white tracking-widest shadow-sm">
                                Servicio Liberado
                              </span>
                            </div>
                          ) : (
                            <div className={`rounded-2xl sm:rounded-xl p-4 sm:p-4 flex flex-col justify-center items-center relative overflow-hidden shadow-inner md:shadow-none h-full gap-1 ${isDarkMode ? 'bg-white/5' : 'bg-slate-50'}`}>
                               <div className="flex items-center justify-between w-full px-2 mb-1">
                                 <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Total Reportado</p>
                                 {isStudentCoordinator && (
                                   <span className="text-[8px] font-black text-amber-500 uppercase bg-amber-500/10 px-1.5 py-0.5 rounded">Coord. Alumno</span>
                                 )}
                               </div>
                               <div className="flex items-baseline gap-1 text-indigo-600 mb-2 sm:mb-1">
                                  <span className="text-3xl sm:text-3xl lg:text-5xl font-black tracking-tighter">{Number(totalHrs.toFixed(2))}</span>
                                  <span className="text-[10px] sm:text-[10px] lg:text-sm font-black uppercase">/ 480H</span>
                               </div>
                               <div className={`w-full h-1 rounded-full overflow-hidden ${isDarkMode ? 'bg-white/10' : 'bg-slate-200'}`}>
                                  <div className="h-full bg-indigo-500 transition-all duration-1000" style={{ width: `${perc}%` }}></div>
                               </div>
                               <p className="mt-1 text-[8px] sm:text-[9px] font-black text-indigo-400 uppercase">{Number(perc.toFixed(2))}%</p>
                            </div>
                          )}
                        </div>

                        {/* Divider for Tablet */}
                        <div className="hidden md:block lg:hidden md:col-span-10 h-px bg-gray-100 mx-5 order-3"></div>

                        {/* Col 2: Proyectos & Tareas */}
                        <div className={`md:col-span-10 lg:col-span-1 flex flex-col order-4 lg:order-2 md:p-0 lg:pl-8 lg:border-l ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`}>
                          <div className="flex items-center justify-between mb-3 sm:mb-4">
                             <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Proyectos y Habilidades</p>
                             <div className={`px-2 py-0.5 sm:px-3 sm:py-1 rounded-xl text-[8px] sm:text-[9px] font-black uppercase shadow-sm border 
                               ${isPureCoordinator ? 
                                 (isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-indigo-50 text-indigo-700 border-indigo-200') :
                                 (student.projectIds && student.projectIds.length > 0) ? 
                                   (isDarkMode ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-green-500 text-white border-green-600') : 
                                   (isDarkMode ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' : 'bg-orange-500 text-white border-orange-600')
                               }`}>
                               {isPureCoordinator ? `Acceso Global (${projects.length})` : (student.projectIds && student.projectIds.length > 0) ? 'Asignado' : 'Sin asignar'}
                             </div>
                          </div>
                          <div className="flex flex-col sm:flex-row lg:flex-col gap-2 sm:gap-3 overflow-y-auto sm:overflow-x-auto lg:overflow-y-auto max-h-[120px] sm:max-h-none lg:max-h-[140px] pr-2 sm:pr-0 lg:pr-2 sm:pb-1 lg:pb-0 custom-scrollbar sm:snap-x sm:snap-mandatory flex-1">
                             {isPureCoordinator ? (
                               <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border shadow-sm sm:flex-shrink-0 sm:snap-start ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50/70 border-indigo-100'}`}>
                                 <div className="flex items-center gap-2 mb-1">
                                   <FolderKanban className="text-indigo-600 dark:text-indigo-400 shrink-0" size={14} />
                                   <span className={`font-black text-[9px] sm:text-[10px] uppercase truncate ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>Acceso a Todos los Proyectos</span>
                                 </div>
                                 <p className={`text-[8px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Supervisión activa sobre {projects.length} proyectos del sistema</p>
                               </div>
                             ) : (
                               Array.from(new Set(student.projectIds || [])).map((pid: string) => {
                                 const p = projects.find(pr => pr.id === pid);
                                 const tasks = (student.projectTasks && student.projectTasks[pid]) || [];
                                 return (
                                   <div key={pid} className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border shadow-sm sm:flex-shrink-0 sm:snap-start sm:min-w-[160px] lg:min-w-0 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                                     <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                       <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-sm" style={{ backgroundColor: p?.color || '#cbd5e1' }}></div>
                                       <span className={`font-black text-[9px] sm:text-[10px] uppercase truncate ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{p?.name || 'Proyecto'}</span>
                                     </div>
                                     <div className="flex flex-wrap gap-1 pl-1">
                                       {tasks.map((t: string, i: number) => (
                                         <span key={`${t}-${i}`} className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-lg border italic shadow-sm tracking-tight ${isDarkMode ? 'text-indigo-400 bg-white/10 border-indigo-500/30' : 'text-indigo-700 bg-white border-indigo-100'}`}>#{String(t)}</span>
                                       ))}
                                     </div>
                                   </div>
                                 );
                               })
                             )}
                             {student.skills && student.skills.length > 0 && (
                               <div className={`p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border shadow-sm sm:flex-shrink-0 sm:snap-start sm:min-w-[160px] lg:min-w-0 ${isDarkMode ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100/50'}`}>
                                 <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                   <Briefcase className="text-emerald-600" size={10} />
                                   <span className={`font-black text-[9px] sm:text-[10px] uppercase tracking-tight ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>Habilidades</span>
                                 </div>
                                 <div className="flex flex-wrap gap-1 pl-1">
                                   {student.skills.map((skill: any, i: number) => (
                                     <span key={`${typeof skill === 'string' ? skill : (skill.id || skill.name || 'skill')}-${i}`} className={`text-[8px] sm:text-[9px] font-bold px-1.5 py-0.5 rounded-lg border shadow-sm ${isDarkMode ? 'text-emerald-400 bg-black/20 border-emerald-500/30' : 'text-emerald-800 bg-white border-emerald-100'}`}>
                                       {typeof skill === 'string' ? skill : (skill.name || skill.id || 'Skill')}
                                     </span>
                                   ))}
                                 </div>
                               </div>
                             )}
                          </div>
                          
                          {/* Indicador de scroll en tablet */}
                          <div className="hidden md:flex lg:hidden justify-center gap-1 mt-2">
                            <div className="w-1 h-1 rounded-full bg-indigo-600"></div>
                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                            <div className="w-1 h-1 rounded-full bg-slate-200"></div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-end mb-1.5">
                              <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">Inasistencias</p>
                              <span className="text-[9px] sm:text-[10px] font-black text-slate-500">{Number(absencePerc.toFixed(2))}%</span>
                            </div>
                            <div className="w-full h-1 bg-slate-100 rounded-full flex overflow-hidden shadow-inner">
                              <div className="bg-red-500 h-full" style={{ width: `${absencePerc}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                })
              )}
              </div>
              
              {/* Pagination Controls */}
              {(totalStudentPages > 1 || filteredStudents.length > 5) && (
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-8 px-4">
                  <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                    <span>Mostrar:</span>
                    <select 
                      className={`px-3 py-2 rounded-xl border outline-none cursor-pointer transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'}`}
                      value={studentsPerPage} 
                      onChange={(e) => {
                        setStudentsPerPage(Number(e.target.value));
                        setStudentPage(1);
                      }}
                    >
                      <option value={5} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>5</option>
                      <option value={10} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>10</option>
                      <option value={15} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>15</option>
                      <option value={20} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>20</option>
                      <option value={50} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>50</option>
                      <option value={100} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>100</option>
                    </select>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setStudentPage(p => Math.max(1, p - 1))} 
                      disabled={studentPage === 1}
                      className={`p-3 border rounded-2xl shadow-sm disabled:opacity-50 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                      Página {studentPage} de {Math.max(1, totalStudentPages)}
                    </span>
                    <button 
                      onClick={() => setStudentPage(p => Math.min(totalStudentPages, p + 1))} 
                      disabled={studentPage === totalStudentPages || totalStudentPages === 0}
                      className={`p-3 border rounded-2xl shadow-sm disabled:opacity-50 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'student-detail' && selectedStudent && (
            <div className="space-y-6 sm:space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700 max-w-6xl mx-auto">
              <button onClick={() => setView('dashboard')} className={`flex items-center gap-3 font-black uppercase text-[9px] sm:text-[11px] tracking-[0.2em] sm:tracking-[0.3em] transition-all border px-4 py-2 sm:px-6 sm:py-2.5 rounded-xl sm:rounded-2xl shadow-sm ${isDarkMode ? 'text-gray-400 hover:text-indigo-400 border-white/10 bg-white/5' : 'text-slate-400 hover:text-indigo-600 border-slate-200 bg-white'}`}><ArrowLeft size={16} /> Volver</button>
              
              <div className={`p-4 sm:p-10 lg:p-14 rounded-[1.5rem] sm:rounded-[4.5rem] border shadow-sm relative overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className="absolute top-0 left-0 w-full h-1.5 sm:h-3 bg-indigo-600"></div>

                <div className="grid grid-cols-1 gap-8 sm:gap-16">
                  <div className="space-y-6 sm:space-y-10">
                    <div>
                        {(() => {
                          const targetSelectedRole = getEffectiveRole(selectedStudent.email, selectedStudent.role);
                          const isSelectedMaster = targetSelectedRole === 'master_coordinator';
                          const isSelectedSuper = targetSelectedRole === 'super_coordinator';
                          const isSelectedCoordinator = isSelectedMaster || isSelectedSuper || targetSelectedRole === 'coordinator' || selectedStudent.role === 'admin' || Boolean(selectedStudent.email && SUPER_ADMIN_EMAILS.includes(selectedStudent.email));
                          const isSelectedStudentCoordinator = targetSelectedRole === 'student_coordinator';
                          const isSelectedPureCoordinator = isSelectedCoordinator && !isSelectedStudentCoordinator;

                          return (
                            <div className="flex flex-wrap items-center gap-3 mb-6 sm:mb-8">
                              {!isSelectedPureCoordinator && (
                                <div className={`inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full text-[10px] sm:text-[12px] font-black uppercase border shadow-lg 
                                  ${isDarkMode ? 
                                    (selectedStudent.status === 'En Curso' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                     selectedStudent.status === 'Finalizado' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                     selectedStudent.status === 'Pausada' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                                     'bg-red-500/10 text-red-400 border-red-500/20') : 
                                    ((STUDENT_STATUS as any)[selectedStudent.status]?.color || 'bg-slate-100')
                                  }`}>
                                    <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full animate-pulse" style={{ backgroundColor: (STUDENT_STATUS as any)[selectedStudent.status]?.hex || '#ccc' }}></div>
                                    {selectedStudent.status}
                                </div>
                              )}

                              <span className={`inline-flex items-center gap-2 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full text-[10px] sm:text-[12px] font-black uppercase border shadow-lg ${ROLE_LABELS[targetSelectedRole]?.badgeBg || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                <ShieldCheck size={14} /> {ROLE_LABELS[targetSelectedRole]?.label || 'Alumno'}
                              </span>

                              {(selectedStudent.isArchived || isStudentFinished(selectedStudent)) && (
                                <div className="inline-flex items-center gap-1.5 px-4 py-2 sm:px-6 sm:py-2.5 rounded-full text-[10px] sm:text-[12px] font-black uppercase bg-amber-500 text-white border border-amber-600 shadow-lg">
                                  <Layers size={14} /> Expediente Archivado
                                </div>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
                          <h2 className={`text-2xl sm:text-4xl md:text-6xl font-black leading-tight tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{selectedStudent.name}</h2>
                          <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                            <button onClick={startEditStudent} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 sm:px-6 sm:py-4 rounded-xl sm:rounded-2xl font-black text-[9px] sm:text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isDarkMode ? 'bg-white text-slate-900 hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-black'}`}>
                              <Edit2 size={16} /> Editar
                            </button>
                            {(userRole === 'admin' || userRole === 'coordinator') && (
                              <button
                                onClick={() => handleToggleArchive(selectedStudent.id)}
                                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm transition-all active:scale-95 ${
                                  selectedStudent.isArchived
                                    ? (isDarkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' : 'text-amber-600 bg-amber-50 border-amber-200 hover:bg-amber-100')
                                    : (isDarkMode ? 'text-gray-400 bg-white/5 border-white/10 hover:text-white' : 'text-slate-600 bg-slate-50 border-slate-200 hover:bg-slate-100')
                                }`}
                                title={selectedStudent.isArchived ? "Desarchivar Expediente" : "Archivar Expediente"}
                              >
                                <Layers size={20} />
                              </button>
                            )}
                            {(() => {
                              const targetSelectedRole = getEffectiveRole(selectedStudent.email, selectedStudent.role);
                              const isSelectedMaster = targetSelectedRole === 'master_coordinator';
                              const canChangeSelectedRole = !isSelectedMaster && (
                                permissions.isMaster ||
                                (permissions.isSuper && targetSelectedRole !== 'super_coordinator') ||
                                (permissions.isCoordinator && (targetSelectedRole === 'user' || targetSelectedRole === 'student_coordinator'))
                              );
                              return canChangeSelectedRole ? (
                                <button 
                                  onClick={() => setRoleModalStudent(selectedStudent)} 
                                  className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm transition-all active:scale-95 flex items-center gap-1.5 ${isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20' : 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100'}`} 
                                  title="Gestionar Rol del Usuario"
                                >
                                  <Shield size={20} />
                                  <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">{ROLE_LABELS[targetSelectedRole]?.shortLabel || 'Rol'}</span>
                                </button>
                              ) : null;
                            })()}
                            {!isStudentFinished(selectedStudent) ? (
                              <button 
                                onClick={() => {
                                  setManualHoursStudentId(selectedStudent.id);
                                  setManualHoursSearch('');
                                  setShowManualHours(true);
                                }} 
                                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20' : 'text-indigo-600 bg-indigo-50 border-indigo-100 hover:bg-indigo-100'}`} 
                                title="Agregar Horas Manuales"
                              >
                                <Clock size={20} />
                              </button>
                            ) : (
                              <div 
                                className={`px-3 py-2 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border flex items-center gap-1.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}
                                title="Servicio Social Concluido - No se pueden asignar más horas"
                              >
                                <CheckCircle2 size={16} /> Finalizado
                              </div>
                            )}
                            {permissions.canDeleteUser(selectedStudent) ? (
                              <button 
                                onClick={() => handleDeleteStudent(selectedStudent.id)} 
                                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm transition-all active:scale-95 ${isDarkMode ? 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' : 'text-red-600 bg-red-50 border-red-100 hover:bg-red-100'}`} 
                                title="Eliminar Estudiante"
                              >
                                <Trash2 size={20} />
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-3 sm:gap-5 uppercase font-black tracking-widest sm:tracking-[0.25em] text-[10px] sm:text-[12px]">
                            <span className={`flex items-center gap-2 sm:gap-3 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl sm:rounded-3xl border shadow-md ${isDarkMode ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' : 'text-indigo-600 bg-indigo-50 border-indigo-100'}`}><GraduationCap size={16}/> {selectedStudent.career}</span>
                            <span className={`flex items-center gap-2 sm:gap-3 px-4 py-2 sm:px-6 sm:py-3 rounded-2xl sm:rounded-3xl border shadow-md ${isDarkMode ? 'text-gray-400 bg-white/5 border-white/10' : 'text-slate-500 bg-slate-50 border-slate-100'}`}>Brigada: {selectedStudent.brigadePeriod}</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:gap-6">
                        <div className={`flex flex-col gap-1 sm:gap-2 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                            <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Mail size={12} className="text-indigo-300"/> Email</span>
                            {selectedStudent.email ? (
                              <a href={`mailto:${selectedStudent.email}`} className={`truncate text-xs sm:text-[13px] font-black transition-colors ${isDarkMode ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-600 hover:text-indigo-800'}`}>
                                {selectedStudent.email}
                              </a>
                            ) : (
                              <span className="text-xs sm:text-[13px] font-black text-slate-300 italic">No registrado</span>
                            )}
                        </div>
                        <div className={`flex flex-col gap-1 sm:gap-2 p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                            <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Phone size={12} className="text-emerald-300"/> Teléfono</span>
                            {selectedStudent.phone ? (
                              <a href={`tel:${selectedStudent.phone}`} className={`text-xs sm:text-[13px] font-black transition-colors ${isDarkMode ? 'text-gray-300 hover:text-emerald-400' : 'text-slate-600 hover:text-emerald-600'}`}>
                                {selectedStudent.phone}
                              </a>
                            ) : (
                              <span className="text-xs sm:text-[13px] font-black text-slate-300 italic">No registrado</span>
                            )}
                        </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-8 sm:gap-12">
                    <div className="grid grid-cols-1 gap-6 sm:gap-10">
                        <div className="space-y-4 sm:space-y-6">
                            <div className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                <div className={`w-8 h-1 ${isDarkMode ? 'bg-indigo-500/40' : 'bg-indigo-100'}`}></div> Proyectos Asignados
                            </div>
                            <div className="space-y-3 sm:space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                {(() => {
                                  const targetSelectedRole = getEffectiveRole(selectedStudent.email, selectedStudent.role);
                                  const isSelectedMaster = targetSelectedRole === 'master_coordinator';
                                  const isSelectedSuper = targetSelectedRole === 'super_coordinator';
                                  const isSelectedCoordinator = isSelectedMaster || isSelectedSuper || targetSelectedRole === 'coordinator' || selectedStudent.role === 'admin' || Boolean(selectedStudent.email && SUPER_ADMIN_EMAILS.includes(selectedStudent.email));
                                  const isSelectedStudentCoordinator = targetSelectedRole === 'student_coordinator';
                                  const isSelectedPureCoordinator = isSelectedCoordinator && !isSelectedStudentCoordinator;

                                  if (isSelectedPureCoordinator) {
                                    return (
                                      <div className={`p-5 sm:p-6 rounded-2xl sm:rounded-[2rem] border shadow-sm ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50/70 border-indigo-100'}`}>
                                        <div className="flex items-center gap-3 mb-2">
                                          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                                            <FolderKanban size={18} />
                                          </div>
                                          <div>
                                            <h4 className="font-black text-xs sm:text-sm uppercase tracking-tight text-indigo-700 dark:text-indigo-300">Acceso Total a Todos los Proyectos</h4>
                                            <p className="text-[10px] text-slate-500 dark:text-gray-400 font-medium">Este usuario cuenta con rol de coordinación y acceso inherente a los {projects.length} proyectos del sistema sin requerir enrolamiento manual.</p>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-indigo-100 dark:border-indigo-500/20">
                                          {projects.map((p: any) => (
                                            <span key={p.id} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase border ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color || '#cbd5e1' }}></div>
                                              {p.name}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  }

                                  return (
                                    <>
                                      {Array.from(new Set(selectedStudent.projectIds || [])).map((pid: string) => {
                                          const p = projects.find(pr => pr.id === pid);
                                          const tasks = (selectedStudent.projectTasks && selectedStudent.projectTasks[pid]) || [];
                                          return (
                                              <div key={pid} className={`p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border shadow-sm hover:shadow-md transition-all ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                                                  <div className="flex items-center gap-3 mb-3">
                                                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p?.color || '#cbd5e1' }}></div>
                                                      <span className={`font-black text-[11px] sm:text-[12px] uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{p?.name || 'Proyecto'}</span>
                                                  </div>
                                                  <div className="flex flex-wrap gap-2">
                                                      {tasks.map((t: string, i: number) => (
                                                          <span key={`${t}-${i}`} className={`text-[9px] sm:text-[10px] font-bold px-3 py-1 rounded-lg border italic shadow-sm ${isDarkMode ? 'text-indigo-400 bg-white/10 border-indigo-500/30' : 'text-indigo-700 bg-white border-indigo-100'}`}>#{String(t)}</span>
                                                      ))}
                                                      {tasks.length === 0 && <span className="text-[10px] font-bold text-slate-300 italic">Sin tareas específicas</span>}
                                                  </div>
                                              </div>
                                          );
                                      })}
                                      {(selectedStudent.projectIds || []).length === 0 && (
                                          <div className="p-8 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black uppercase text-[10px] tracking-widest">Sin proyectos asignados</div>
                                      )}
                                    </>
                                  );
                                })()}
                            </div>
                        </div>
                        <div className="space-y-4 sm:space-y-6">
                            <div className={`text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] flex items-center gap-3 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                                <div className={`w-8 h-1 ${isDarkMode ? 'bg-emerald-500/40' : 'bg-emerald-100'}`}></div> Habilidades
                            </div>
                            <div className="flex flex-wrap gap-2 sm:gap-3">
                                {(selectedStudent.skills || []).map((skill: string, i: number) => (
                                    <span key={`${skill}-${i}`} className={`px-4 py-2 rounded-xl text-[10px] sm:text-[11px] font-black uppercase shadow-sm border ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>{skill}</span>
                                ))}
                                {(selectedStudent.skills || []).length === 0 && (
                                    <div className={`w-full p-8 text-center border-2 border-dashed rounded-[2rem] font-black uppercase text-[10px] tracking-widest ${isDarkMode ? 'border-emerald-500/10 text-emerald-500/20' : 'border-emerald-50 text-emerald-200'}`}>Sin habilidades registradas</div>
                                )}
                            </div>
                        </div>
                    </div>

                    {(() => {
                      const selRole = getEffectiveRole(selectedStudent.email, selectedStudent.role);
                      const isMasterPerson = selRole === 'master_coordinator';
                      const isSuperPerson = selRole === 'super_coordinator';
                      const isCoordinatorLevel = selRole === 'coordinator' || isSuperPerson || isMasterPerson;
                      const historicalHours = (selectedStudent.records || []).reduce((a: number, c: any) => {
                        if (c.validationStatus === 'aprobado' || !c.validationStatus) return a + c.hours;
                        return a;
                      }, 0);

                      if (isMasterPerson || isSuperPerson) {
                        return (
                          <div className={`mt-auto rounded-[2rem] sm:rounded-[4rem] p-6 sm:p-12 text-white relative overflow-hidden shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-8 ${
                            isDarkMode 
                              ? 'bg-[#121212] border border-white/5' 
                              : (isMasterPerson ? 'bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900' : 'bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-900')
                          }`}>
                            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 blur-3xl ${isMasterPerson ? 'bg-purple-500/20' : 'bg-indigo-500/20'}`}></div>
                            <div className="relative z-10 flex flex-col items-center sm:items-start">
                              <p className={`text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] mb-3 ${isMasterPerson ? 'text-purple-400' : 'text-indigo-400'}`}>
                                {isMasterPerson ? 'Dirección General · Rol Maestro' : 'Equipo Directivo · Supercoordinación'}
                              </p>
                              <div className="flex items-center gap-3 leading-none">
                                <span className="text-3xl sm:text-5xl font-black tracking-tight text-white">
                                  {isMasterPerson ? 'Coordinador Maestro' : 'Supercoordinador'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 font-medium mt-2 max-w-md">
                                {isMasterPerson
                                  ? 'Autoridad suprema del sistema. Gestión de permisos, usuarios y supervisión total de proyectos.'
                                  : 'Supervisión institucional y coordinación estratégica sobre los proyectos del sistema.'}
                              </p>
                            </div>
                            <div className="text-center sm:text-right relative z-10 space-y-2 w-full sm:w-auto">
                              <div className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider ${
                                isMasterPerson
                                  ? 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                                  : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-300'
                              }`}>
                                <ShieldCheck size={16} /> {isMasterPerson ? 'Acceso Maestro' : 'Supervisión Global'}
                              </div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                Sin requisito de horas estudiantiles
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return isCoordinatorLevel ? (
                        <div className={`mt-auto rounded-[2rem] sm:rounded-[4rem] p-6 sm:p-12 text-white relative overflow-hidden shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-8 ${isDarkMode ? 'bg-[#121212] border border-white/5' : 'bg-slate-900 border-none'}`}>
                          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 blur-3xl ${isDarkMode ? 'bg-emerald-500/10' : 'bg-emerald-500/20'}`}></div>
                          <div className="relative z-10 flex flex-col items-center sm:items-start">
                            <p className="text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] mb-4 text-emerald-400">Equipo Coordinador · Servicio Concluido</p>
                            <div className="flex items-baseline gap-2 leading-none">
                              <span className="text-4xl sm:text-7xl font-black tracking-tighter text-emerald-300">
                                {historicalHours.toFixed(2)}
                              </span>
                              <span className="text-base sm:text-2xl font-black text-emerald-400/80 italic">Horas en Historial</span>
                            </div>
                          </div>
                          <div className="text-center sm:text-right relative z-10 space-y-2 w-full sm:w-auto">
                            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-black uppercase tracking-wider">
                              <CheckCircle2 size={16} /> Horas Concluidas
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Sin registro obligatorio de 480h</p>
                          </div>
                        </div>
                      ) : (
                        <div className={`mt-auto rounded-[2rem] sm:rounded-[4rem] p-6 sm:p-12 text-white relative overflow-hidden shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-8 ${isDarkMode ? 'bg-[#121212] border border-white/5' : 'bg-slate-900 border-none'}`}>
                            <div className={`absolute top-0 right-0 w-64 h-64 rounded-full -mr-32 -mt-32 blur-3xl ${isDarkMode ? 'bg-indigo-500/5' : 'bg-indigo-500/10'}`}></div>
                            <div className="relative z-10 flex flex-col items-center sm:items-start">
                                <p className={`text-[9px] sm:text-[11px] font-black uppercase tracking-[0.3em] mb-4 ${isDarkMode ? 'text-indigo-400/80' : 'text-indigo-400'}`}>Horas Totales Reportadas</p>
                                <div className="flex items-baseline gap-2 leading-none">
                                    <span className="text-4xl sm:text-7xl font-black tracking-tighter">
                                      {historicalHours.toFixed(2)}
                                    </span>
                                    <span className="text-base sm:text-2xl font-black text-indigo-500 italic">/ {TOTAL_REQUIRED_HOURS}H</span>
                                </div>
                            </div>
                            <div className="text-center sm:text-right relative z-10 space-y-3 w-full sm:w-auto">
                                <div className="flex items-baseline gap-2 justify-center sm:justify-end">
                                   <p className="text-[9px] sm:text-[10px] text-indigo-400 font-black uppercase opacity-80">Restan:</p>
                                   <span className="text-xl sm:text-3xl font-black text-indigo-100 tracking-tighter leading-none">
                                     {Number(Math.max(0, TOTAL_REQUIRED_HOURS - historicalHours).toFixed(2))}h
                                   </span>
                                </div>
                                <div className="w-full sm:w-48 h-2 sm:h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 shadow-inner">
                                   <div className="h-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${Math.min(100, (historicalHours / TOTAL_REQUIRED_HOURS) * 100)}%` }}></div>
                                </div>
                            </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Registro Actividad */}
              <div className={`p-6 sm:p-12 md:p-16 rounded-[2rem] sm:rounded-[5rem] border shadow-sm relative overflow-hidden ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`} id="entry-form">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 sm:mb-16 gap-4">
                  <h3 className={`text-2xl sm:text-5xl font-black tracking-tighter flex items-center gap-4 sm:gap-6 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                      <div className={`p-2.5 sm:p-4 rounded-xl sm:rounded-[1.8rem] shadow-xl ${editingRecordId ? 'bg-amber-100 text-amber-600 shadow-amber-200/50' : 'bg-indigo-100 text-indigo-600 shadow-indigo-200/50'}`}>
                          {editingRecordId ? <Edit2 size={20} className="sm:w-9 sm:h-9" /> : <PlusCircle size={20} className="sm:w-9 sm:h-9" />}
                      </div>
                      {editingRecordId ? 'Actualizar Reporte' : 'Registrar Sesión'}
                  </h3>
                  {editingRecordId && <button onClick={()=>setEditingRecordId(null)} className={`text-[10px] sm:text-[11px] font-black px-6 py-3 sm:px-8 sm:py-4 rounded-xl sm:rounded-[1.5rem] uppercase border-2 transition-all flex items-center gap-2 w-full sm:w-auto justify-center ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100'}`}><X size={16}/> Descartar</button>}
                </div>
                <form onSubmit={saveActivity} className="space-y-8 sm:space-y-16 animate-in slide-in-from-bottom-12 duration-700">
                    {errorMessage && <div className="p-4 sm:p-6 bg-red-50 text-red-700 rounded-2xl sm:rounded-[2rem] border-2 sm:border-4 border-red-200 flex items-center gap-3 sm:gap-5 font-black text-[11px] sm:text-[13px] uppercase animate-bounce shadow-xl"><AlertCircle size={24} className="sm:w-7 sm:h-7"/> {errorMessage}</div>}
                    {renderActivityForm(false)}
                    {activityForm.categoryId && (
                      <button 
                        disabled={isSubmitting}
                        className={`w-full text-white font-black py-6 sm:py-9 rounded-[2rem] sm:rounded-[3rem] shadow-2xl uppercase tracking-[0.2em] sm:tracking-[0.4em] text-xs sm:text-sm transform transition-all hover:-translate-y-1 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 ${editingRecordId ? 'bg-amber-600' : 'bg-indigo-600'}`}
                      >
                          {isSubmitting && <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                          <span className="relative z-10">{editingRecordId ? 'Ejecutar Actualización' : 'Certificar Registro en Expediente'}</span>
                      </button>
                    )}
                </form>
              </div>

              {/* Bitácora Histórica */}
              <div className={`rounded-[3rem] sm:rounded-[5rem] border shadow-sm overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
                <div className={`p-6 sm:p-12 border-b font-black flex flex-col gap-6 text-[10px] sm:text-xs uppercase tracking-[0.3em] shadow-sm ${isDarkMode ? 'bg-white/2 border-white/5 text-gray-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}>
                   <span className="flex items-center gap-4"><History size={28} className="text-indigo-500" /> Cronología de Sesiones</span>
                   <div className="flex items-center gap-4 overflow-x-auto hide-scrollbar snap-x snap-mandatory w-full pb-2">
                     {selectedRecords.length > 0 && (
                       <>
                          <div className="relative shrink-0 snap-center flex items-center">
                            <select
                              value=""
                              onChange={(e) => {
                                if(e.target.value) handleUpdateValidationSelected(e.target.value);
                              }}
                              className={`appearance-none px-6 py-3 pr-10 rounded-[1.5rem] font-black transition-all shadow-sm outline-none cursor-pointer text-xs sm:text-sm w-full max-w-[180px] sm:max-w-[220px] truncate border ${isDarkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'}`}
                            >
                              <option value="" disabled className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Validación...</option>
                              {Object.entries(VALIDATION_STATUS || {}).map(([key, val]: [string, any]) => (
                                <option value={key} key={key} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'text-slate-700 bg-white'}>{val.label}</option>
                              ))}
                            </select>
                            <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${isDarkMode ? 'text-amber-400' : 'text-amber-700'}`}>
                              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                            </div>
                          </div>

                          <div className="relative shrink-0 snap-center flex items-center">
                            <select
                              value=""
                              onChange={(e) => {
                                if(e.target.value) handleUpdateAttendanceSelected(e.target.value);
                              }}
                              className={`appearance-none px-6 py-3 pr-10 rounded-[1.5rem] font-black transition-all shadow-sm outline-none cursor-pointer text-xs sm:text-sm w-full max-w-[180px] sm:max-w-[220px] truncate border ${isDarkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200'}`}
                            >
                              <option value="" disabled className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Asistencia...</option>
                              {Object.entries(ATTENDANCE_STATUS || {}).map(([key, val]: [string, any]) => (
                                <option value={key} key={key} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'text-slate-700 bg-white'}>{val.label}</option>
                              ))}
                            </select>
                            <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                            </div>
                          </div>
                         <div className="relative shrink-0 snap-center flex items-center">
                           <select
                             value=""
                             onChange={(e) => {
                               if(e.target.value) handleAssignProjectToSelected(e.target.value);
                             }}
                             className={`appearance-none px-6 py-3 pr-10 rounded-[1.5rem] font-black transition-all shadow-sm outline-none cursor-pointer text-xs sm:text-sm w-full max-w-[180px] sm:max-w-[220px] truncate border ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'}`}
                           >
                             <option value="" disabled className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>Asignar Proyecto...</option>
                             <option value="p-general" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'text-slate-700 bg-white'}>General / Ninguno</option>
                             {projects.filter(p => (selectedStudent.projectIds || []).includes(p.id)).map(p => (
                               <option value={p.id} key={p.id} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'text-slate-700 bg-white truncate'}>{p.name}</option>
                             ))}
                           </select>
                           <div className={`pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                             <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
                           </div>
                         </div>
                         <button 
                           onClick={() => handleDeleteSelected(selectedStudent.id)} 
                           className={`flex items-center gap-2 border px-5 py-3 rounded-[1.5rem] font-black transition-all shadow-sm shrink-0 snap-center text-xs sm:text-sm ${isDarkMode ? 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'}`}
                         >
                           <Trash2 size={16} /> Borrar
                         </button>
                       </>
                     )}
                     <button onClick={handleDownloadReport} className={`flex items-center gap-3 border px-6 py-3 rounded-[1.5rem] font-black transition-all shadow-sm shrink-0 snap-center ${isDarkMode ? 'bg-white/5 text-indigo-400 border-white/10 hover:bg-white/10 shadow-none' : 'bg-white hover:bg-indigo-50 text-indigo-600 border-indigo-100'}`}><Download size={16} /> Descargar Reporte</button>
                     <button 
                       onClick={() => setSessionSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                       className={`p-3 rounded-[1.5rem] border font-black transition-all shadow-sm flex items-center justify-center shrink-0 snap-center ${isDarkMode ? 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'}`}
                       title={`Ordenar: ${sessionSortOrder === 'desc' ? 'Más recientes primero' : 'Más antiguos primero'}`}
                     >
                       <ArrowDownUp size={20} className={sessionSortOrder === 'asc' ? 'rotate-180 transition-transform' : 'transition-transform'} />
                     </button>
                     <button 
                       onClick={() => {
                         const records = selectedStudent.records || [];
                         if (selectedRecords.length === records.length) setSelectedRecords([]);
                         else setSelectedRecords(records.map((r: any) => r.id));
                       }}
                       className={`p-3 rounded-[1.5rem] border font-black transition-all shadow-sm flex items-center justify-center shrink-0 snap-center ${selectedRecords.length > 0 && selectedRecords.length === (selectedStudent.records || []).length ? 'bg-indigo-600 text-white border-indigo-600' : (isDarkMode ? 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10' : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50')}`}
                       title={selectedRecords.length > 0 && selectedRecords.length === (selectedStudent.records || []).length ? 'Deseleccionar Todo' : 'Seleccionar Todo'}
                     >
                       {selectedRecords.length > 0 && selectedRecords.length === (selectedStudent.records || []).length ? <X size={20} /> : <CheckSquare size={20} />}
                     </button>
                     <div className={`px-8 py-3 rounded-[1.5rem] border font-black shrink-0 snap-center ${isDarkMode ? 'bg-[#2a2a2a] border-white/5 text-gray-500' : 'bg-white border-slate-200 text-slate-400'}`}> {(selectedStudent.records || []).length} SESIONES TOTALES </div>
                   </div>
                </div>
                <div className={`divide-y ${isDarkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                  {(selectedStudent.records || []).length === 0 ? (
                    <div className="p-20 sm:p-40 text-center flex flex-col items-center gap-6 sm:gap-10 opacity-30">
                       <div className={`p-8 sm:p-14 rounded-full border-4 sm:border-8 shadow-2xl ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}><CalendarIcon size={64} className="sm:w-24 sm:h-24 text-slate-300" /></div>
                       <p className="text-sm sm:text-xl font-black uppercase tracking-[0.4em] text-slate-500">Expediente Vacío</p>
                    </div>
                  ) : (
                    paginatedSessions.map((r: any) => {
                      const cat = categories.find(c => c.id === r.categoryId);
                      const isSelected = selectedRecords.includes(r.id);
                      return (
                        <div 
                          key={r.id} 
                          onClick={() => {
                            setSelectedRecords(prev => isSelected ? prev.filter(id => id !== r.id) : [...prev, r.id]);
                          }}
                          className={`p-12 sm:p-16 transition-all relative group/item cursor-pointer ${editingRecordId === r.id ? 'bg-amber-500/10' : isSelected ? (isDarkMode ? 'bg-indigo-500/10' : 'bg-indigo-50/50') : (isDarkMode ? 'hover:bg-white/5' : 'hover:bg-indigo-50/20')}`}
                        >
                          {editingRecordId === r.id && <div className="absolute top-0 left-0 w-3 h-full bg-amber-500"></div>}
                        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                            <div className="space-y-6 flex-1 w-full">
                              <div className="flex items-center gap-4 flex-wrap">
                                 <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : (isDarkMode ? 'border-white/10 bg-black/20' : 'border-slate-200 bg-white')}`}>
                                   {isSelected && <Check size={14} className="text-white" />}
                                 </div>
                                 <span className={`text-2xl sm:text-4xl font-black tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{r.date}</span>
                                 {r.startTime && r.endTime ? (
                                   <div className={`flex items-center gap-2 text-[11px] font-black border px-4 py-2 rounded-xl shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}><Clock size={14} className="text-indigo-400" /> {r.startTime} - {r.endTime}</div>
                                 ) : (
                                   <div className={`flex items-center gap-2 text-[11px] font-black border px-4 py-2 rounded-xl shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-100 text-slate-500'}`}><Clock size={14} className="text-indigo-400" /> Manual</div>
                                 )}
                                 <span className="px-4 py-1.5 rounded-xl text-[10px] font-black text-white uppercase shadow-md" style={{ backgroundColor: cat?.color }}>{cat?.name || 'Categoría'}</span>
                                 {r.projectId && (() => {
                                   const p = projects.find(pr => pr.id === r.projectId);
                                   return p ? <span className="px-4 py-1.5 rounded-xl text-[10px] font-black text-white uppercase shadow-md" style={{ backgroundColor: p.color }}>{p.name}</span> : null;
                                 })()}
                                 <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase border shadow-sm 
                                   ${isDarkMode ? 
                                     (r.status === 'A' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                                      r.status === 'N' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                                      'bg-blue-500/10 text-blue-400 border-blue-500/20') :
                                     ((ATTENDANCE_STATUS as any)[r.status]?.color || 'bg-slate-100')
                                   }`}>{(ATTENDANCE_STATUS as any)[r.status]?.label || 'Status'}</span>
                                 {r.validationStatus && (
                                   <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border text-[10px] font-black uppercase shadow-sm 
                                     ${isDarkMode ? 
                                       (r.validationStatus === 'aprobado' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                        r.validationStatus === 'rechazado' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                        'bg-amber-500/10 text-amber-400 border-amber-500/20') : 
                                       ((VALIDATION_STATUS as any)[r.validationStatus]?.color || 'bg-slate-50 text-slate-400 border-slate-100')
                                     }`}>
                                     {(() => {
                                       const Icon = (VALIDATION_STATUS as any)[r.validationStatus]?.icon || Clock;
                                       return <Icon size={14} />;
                                     })()}
                                     {(VALIDATION_STATUS as any)[r.validationStatus]?.label || 'Pendiente'}
                                   </div>
                                 )}
                              </div>
                              <div className="relative pl-6">
                                <div className={`absolute top-0 left-0 w-1 h-full rounded-full transition-colors ${isDarkMode ? (isSelected ? 'bg-indigo-500' : 'bg-white/10 group-hover/item:bg-white/20') : 'bg-indigo-100 group-hover/item:bg-indigo-300'}`}></div>
                                <p className={`font-bold text-lg leading-relaxed italic break-words ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>"{r.description || 'Sin detalles.'}"</p>
                              </div>
                              {r.evidenceLink && <a href={r.evidenceLink} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-3 text-[10px] font-black border px-6 py-3 rounded-2xl shadow-sm uppercase tracking-widest hover:transition-all ${isDarkMode ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-600 hover:text-white' : 'bg-indigo-50 text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white'}`}><LinkIcon size={14}/> Comprobante</a>}
                            </div>
                            
                            <div className="flex items-center gap-8 shrink-0">
                              {userRole !== 'user' && r.validationStatus !== 'aprobado' && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApproveRecord(selectedStudent.id, r.id);
                                  }}
                                  className={`p-3 rounded-xl transition-all shadow-sm ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white'}`}
                                  title="Aprobar registro"
                                >
                                  <Check size={20} />
                                </button>
                              )}
                              <div className={`p-6 rounded-[2rem] shadow-xl flex flex-col items-center min-w-[120px] ${isDarkMode ? 'bg-black/20 border border-white/5 text-white' : 'bg-slate-900 text-white'}`}>
                                  <span className={`text-[9px] font-black uppercase tracking-widest mb-1 opacity-70 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-400'}`}>Horas</span>
                                  <div className="flex items-baseline gap-1 leading-none"><span className="text-4xl font-black">{Number(r.hours.toFixed(2))}</span><span className="text-xs font-black text-indigo-500 uppercase">H</span></div>
                              </div>
                              <div className="flex flex-col gap-3">
                                  {r.validationStatus === 'pendiente' && (
                                    <div className="flex gap-2 mb-2">
                                      <button 
                                        onClick={async () => {
                                          try {
                                            await updateDoc(doc(db, 'sesiones', r.id), {
                                              estado: 'aprobado',
                                              status: 'A',
                                              updatedBy: auth.currentUser?.uid
                                            });
                                            showSuccessToast("Sesión aprobada");
                                          } catch (error) {
                                            handleFirestoreError(error, OperationType.UPDATE, `sesiones/${r.id}`);
                                          }
                                        }}
                                        className={`p-3 rounded-xl border shadow-sm transition-all ${isDarkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-600 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white border-emerald-100'}`}
                                        title="Aprobar"
                                      >
                                        <CheckCircle2 size={18} />
                                      </button>
                                      <button 
                                        onClick={() => setRejectingRecord(r)}
                                        className={`p-3 rounded-xl border shadow-sm transition-all ${isDarkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-600 hover:text-white' : 'bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white border-rose-100'}`}
                                        title="Rechazar"
                                      >
                                        <XCircle size={18} />
                                      </button>
                                    </div>
                                  )}
                                  <button onClick={(e)=>{ e.stopPropagation(); startEditRecord(r); window.scrollTo({top:0, behavior:'smooth'});}} className={`p-4 flex items-center justify-center rounded-2xl border shadow-sm transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:text-amber-400 hover:bg-white/10' : 'bg-white border-slate-100 text-slate-400 hover:text-amber-600 hover:bg-amber-50'}`} title="Editar"><Edit2 size={20}/></button>
                                  <button type="button" onClick={(e)=>{e.preventDefault(); e.stopPropagation(); showConfirmToast("¿Estás seguro de que deseas eliminar esta sesión?", async () => { 
                                    try {
                                      await deleteDoc(doc(db, 'sesiones', r.id));
                                      showSuccessToast("Sesión eliminada");
                                    } catch (error) {
                                      handleFirestoreError(error, OperationType.DELETE, `sesiones/${r.id}`);
                                    }
                                  }); }} className={`p-4 flex items-center justify-center rounded-2xl border shadow-sm transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:text-red-400 hover:bg-white/10' : 'bg-white border-slate-100 text-slate-400 hover:text-red-500 hover:bg-red-50'}`} title="Eliminar"><Trash2 size={20}/></button>
                              </div>
                            </div>
                        </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Session Pagination Controls */}
                {totalSessionPages > 1 && (
                  <div className={`flex justify-center items-center gap-4 p-8 border-t ${isDarkMode ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <button 
                      onClick={() => setSessionPage(p => Math.max(1, p - 1))} 
                      disabled={sessionPage === 1}
                      className={`p-3 border rounded-2xl shadow-sm disabled:opacity-50 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>
                      Página {sessionPage} de {totalSessionPages}
                    </span>
                    <button 
                      onClick={() => setSessionPage(p => Math.min(totalSessionPages, p + 1))} 
                      disabled={sessionPage === totalSessionPages}
                      className={`p-3 border rounded-2xl shadow-sm disabled:opacity-50 transition-all ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {(view === 'group-activity' || view === 'individual-activity') && (
            <div className="max-w-5xl mx-auto space-y-10 animate-in slide-in-from-bottom-12 duration-700">
              <button onClick={() => setView('dashboard')} className="text-slate-400 font-black uppercase text-[11px] tracking-[0.4em] flex items-center gap-3 hover:text-indigo-600 transition-all"><ArrowLeft size={18}/> Regresar al Panel</button>
              <div className="bg-white p-14 sm:p-20 rounded-[5rem] border border-slate-200 shadow-2xl relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-3 h-full ${view === 'group-activity' ? 'bg-emerald-500 shadow-[6px_0_20px_rgba(16,185,129,0.3)]' : 'bg-indigo-600 shadow-[6px_0_20px_rgba(79,70,229,0.3)]'}`}></div>
                <div className="flex items-center justify-between mb-16">
                   <h2 className="text-5xl font-black text-slate-900 flex items-center gap-6 tracking-tighter">
                      {view === 'group-activity' ? <Users size={56} className="text-emerald-500"/> : <PlusCircle size={56} className="text-indigo-600"/>}
                      {view === 'group-activity' ? 'Bitácora Manual' : 'Bitácora Individual'}
                   </h2>
                </div>
                <form onSubmit={saveActivity} className="space-y-16">
                    {errorMessage && <div className="p-6 bg-red-50 text-red-700 rounded-[2.5rem] border-4 border-red-200 flex items-center gap-5 font-black text-[13px] uppercase animate-bounce shadow-xl"><AlertCircle size={32}/> {errorMessage}</div>}
                    {renderActivityForm(view === 'group-activity')}
                    {activityForm.categoryId && (
                      <button 
                        disabled={isSubmitting}
                        className={`w-full text-white font-black py-10 rounded-[3.5rem] shadow-2xl uppercase tracking-[0.5em] text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-4 ${view === 'group-activity' ? 'bg-emerald-600 shadow-emerald-600/40' : 'bg-indigo-600 shadow-indigo-600/40'}`}
                      >
                        {isSubmitting && <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                        Validar y Registrar
                      </button>
                    )}
                </form>
              </div>
            </div>
          )}

          {view === 'calendar' && (
            <div className={`space-y-6 sm:space-y-10 animate-in fade-in zoom-in-95 duration-700 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
               <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 sm:gap-8">
                 <div className="w-full lg:w-auto">
                    <h2 className={`text-3xl sm:text-5xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{calendarFilterAll ? 'Calendario General' : 'Mi Calendario'}</h2>
                    <p className={`font-black uppercase tracking-[0.2em] text-[8px] sm:text-[10px] mt-2 flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Cronograma Mensual de Actividades</p>
                 </div>
                 <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 w-full lg:w-auto">
                    {(userRole === 'admin' || userRole === 'coordinator') && (
                      <div className={`p-1 sm:p-2 rounded-xl sm:rounded-2xl border shadow-sm flex items-center ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                        <button 
                          onClick={() => setCalendarFilterAll(true)} 
                          className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 ${calendarFilterAll ? (isDarkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700') : (isDarkMode ? 'text-gray-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50')}`}
                        >
                          <Users size={14} /> 
                          <span className="hidden xs:inline">Todos</span>
                        </button>
                        <button 
                          onClick={() => setCalendarFilterAll(false)} 
                          className={`px-3 py-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center gap-2 ${!calendarFilterAll ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'text-gray-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50')}`}
                        >
                          <User size={14} /> 
                          <span className="hidden xs:inline">Personal</span>
                        </button>
                      </div>
                    )}
                    {(userRole === 'admin' || userRole === 'coordinator') && calendarFilterAll && (
                      <div className={`flex items-center gap-2 p-2 rounded-xl sm:rounded-2xl border shadow-sm flex-1 sm:flex-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                        <GraduationCap size={16} className={isDarkMode ? 'text-gray-500 ml-2' : 'text-slate-400 ml-2'} />
                        <select 
                          value={calendarStudentFilter} 
                          onChange={(e) => setCalendarStudentFilter(e.target.value)}
                          className={`p-2 text-[10px] sm:text-xs font-bold outline-none bg-transparent w-full ${isDarkMode ? 'text-white cursor-pointer' : 'text-slate-600 cursor-pointer'}`}
                        >
                          <option value="" className={isDarkMode ? 'bg-slate-900' : 'bg-white'}>Todos los Alumnos</option>
                          {students.filter((s: any) => !s.email || !SUPER_ADMIN_EMAILS.includes(s.email)).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((s: any) => (
                            <option key={s.id} value={s.id} className={isDarkMode ? 'bg-slate-900' : 'bg-white'}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className={`flex items-center gap-2 p-2 rounded-xl sm:rounded-2xl border shadow-sm flex-1 sm:flex-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                       <Filter size={16} className={isDarkMode ? 'text-gray-500 ml-2' : 'text-slate-400 ml-2'} />
                       <input type="date" className={`p-2 text-[10px] sm:text-xs font-bold outline-none bg-transparent w-full ${isDarkMode ? 'text-white' : 'text-slate-600'}`} value={calendarDateFilter} onChange={e => {
                         setCalendarDateFilter(e.target.value);
                         if (e.target.value) {
                           const [y, m] = e.target.value.split('-');
                           setCurrentMonth(new Date(parseInt(y), parseInt(m) - 1, 1));
                           setCalendarMode('list');
                         }
                       }} />
                       {calendarDateFilter && <button onClick={() => setCalendarDateFilter('')} className={`p-1 rounded-lg ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}><X size={14}/></button>}
                    </div>
                    <div className={`flex items-center p-1 sm:p-2 rounded-xl sm:rounded-2xl border shadow-sm flex-1 sm:flex-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                      <button onClick={() => setCalendarMode('grid')} className={`flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${calendarMode === 'grid' ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'text-gray-500 hover:bg-white/5' : 'text-slate-400 hover:bg-slate-50')}`}><LayoutGrid size={14} className="sm:w-4 sm:h-4"/> <span className="hidden xs:inline">Cuadrícula</span></button>
                      <button onClick={() => setCalendarMode('list')} className={`flex-1 sm:flex-none px-3 py-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-2 ${calendarMode === 'list' ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700') : (isDarkMode ? 'text-gray-500 hover:bg-slate-50' : 'text-slate-400 hover:bg-slate-50')}`}><List size={14} className="sm:w-4 sm:h-4"/> <span className="hidden xs:inline">Listado</span></button>
                    </div>
                    <div className={`flex items-center justify-between sm:justify-center gap-2 sm:gap-4 p-1.5 sm:p-3 rounded-xl sm:rounded-[2rem] border shadow-lg px-3 sm:px-6 flex-1 sm:flex-none ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                      <button onClick={() => { const next = new Date(currentMonth); next.setMonth(next.getMonth() - 1); setCurrentMonth(next); }} className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border hover:scale-110 active:scale-90 ${isDarkMode ? 'hover:bg-white/5 border-transparent text-gray-400' : 'hover:bg-slate-50 border-slate-50'}`}><ChevronLeft size={18} className="sm:w-5 sm:h-5"/></button>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <select 
                            value={currentMonth.getMonth()} 
                            onChange={(e) => {
                              const next = new Date(currentMonth);
                              next.setMonth(parseInt(e.target.value));
                              setCurrentMonth(next);
                            }}
                            className={`font-black text-sm sm:text-2xl tracking-tighter leading-none bg-transparent outline-none cursor-pointer capitalize appearance-none text-center min-w-[80px] sm:min-w-[140px] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                          >
                            {Array.from({ length: 12 }).map((_, i) => (
                              <option key={`month-${i}`} value={i} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-slate-800'}>
                                {new Date(2000, i, 1).toLocaleDateString('es-ES', { month: 'long' })}
                              </option>
                            ))}
                          </select>
                          <select 
                            value={currentMonth.getFullYear()} 
                            onChange={(e) => {
                              const next = new Date(currentMonth);
                              next.setFullYear(parseInt(e.target.value));
                              setCurrentMonth(next);
                            }}
                            className={`font-black text-sm sm:text-2xl tracking-tighter leading-none bg-transparent outline-none cursor-pointer appearance-none text-center min-w-[60px] sm:min-w-[100px] ${isDarkMode ? 'text-white' : 'text-slate-800'}`}
                          >
                            {Array.from({ length: 10 }).map((_, i) => {
                              const year = new Date().getFullYear() - 5 + i;
                              return <option key={year} value={year} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : 'bg-white text-slate-800'}>{year}</option>;
                            })}
                          </select>
                        </div>
                        <button 
                          onClick={() => setCurrentMonth(new Date())}
                          className="text-[8px] sm:text-[10px] font-black text-indigo-500 uppercase tracking-widest mt-1 hover:text-indigo-700 transition-colors"
                        >
                          Hoy
                        </button>
                      </div>
                      <button onClick={() => { const next = new Date(currentMonth); next.setMonth(next.getMonth() + 1); setCurrentMonth(next); }} className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl border hover:scale-110 active:scale-90 ${isDarkMode ? 'hover:bg-white/5 border-transparent text-gray-400' : 'hover:bg-slate-50 border-slate-50'}`}><ChevronRight size={18} className="sm:w-5 sm:h-5"/></button>
                    </div>
                 </div>
               </div>

               {calendarMode === 'grid' ? (
                 <div className="overflow-x-auto pb-4 hide-scrollbar -mx-4 sm:mx-0 px-4 sm:px-0">
                   <div className={`border rounded-[1.5rem] sm:rounded-[3rem] overflow-hidden shadow-sm grid grid-cols-7 relative min-w-[500px] sm:min-w-[800px] ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, idx) => <div key={`${d}-${idx}`} className={`py-3 sm:py-6 text-center text-[8px] sm:text-[10px] font-black uppercase tracking-widest sm:tracking-[0.3em] border-b ${isDarkMode ? 'text-gray-500 border-white/5 bg-white/5' : 'text-slate-400 border-slate-50 bg-slate-50/50'}`}>{d}</div>)}
                    {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay() }).map((_, i) => <div key={`empty-${i}`} className={`min-h-[60px] sm:min-h-[140px] border-r border-b ${isDarkMode ? 'bg-white/[0.02] border-white/5' : 'bg-slate-50/10 border-slate-100'}`}></div>)}
                    {Array.from({ length: new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate() }).map((_, i) => {
                      const day = i + 1;
                      const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayRecords = allRecords.filter((r: any) => r.date === dateStr);
                      const uniqueCats = Array.from(new Set(dayRecords.map((r: any) => r.categoryId)));
                      const hasActivities = dayRecords.length > 0;
                      
                      return (
                        <div 
                          key={dateStr} 
                          onClick={() => { if(hasActivities) setSelectedCalendarDate(dateStr); }} 
                          className={`min-h-[60px] sm:min-h-[140px] p-1.5 sm:p-5 border-r border-b border-slate-100 transition-all relative overflow-hidden group ${isDarkMode ? 'border-white/5' : 'border-slate-100'} ${hasActivities ? (isDarkMode ? 'cursor-pointer hover:bg-indigo-500/10' : 'cursor-pointer hover:bg-indigo-50/50') : (isDarkMode ? 'bg-white/[0.02]' : 'bg-slate-50/10')}`}
                        >
                          {hasActivities && (
                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${isDarkMode ? 'bg-indigo-500/5' : 'bg-indigo-50/30'}`}></div>
                          )}
                          
                          <div className={`absolute top-1 right-1 sm:top-3 sm:right-3 w-5 h-5 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-[8px] sm:text-[11px] transition-colors ${hasActivities ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30' : (isDarkMode ? 'text-gray-500 bg-white/5' : 'text-slate-400 bg-slate-100')}`}>
                            {day}
                          </div>
                          
                          <div className="mt-4 sm:mt-12 space-y-1 sm:space-y-2 relative z-10">
                            {hasActivities ? (
                              <>
                                <div className={`text-[6px] sm:text-[9px] font-black uppercase tracking-widest mb-1 sm:mb-3 hidden sm:block ${isDarkMode ? 'text-indigo-400/80' : 'text-indigo-400'}`}>
                                  {dayRecords.length} Act.
                                </div>
                                <div className="flex flex-wrap gap-0.5 sm:gap-1.5">
                                  {uniqueCats.slice(0, 3).map((cid: any) => {
                                    const cat = categories.find(c => c.id === cid);
                                    return (
                                      <div 
                                        key={`${dateStr}-${cid}`} 
                                        className="w-2 h-2 sm:w-5 sm:h-5 rounded-full shadow-sm border sm:border-2 border-white flex items-center justify-center" 
                                        style={{ backgroundColor: cat?.color || '#cbd5e1' }}
                                        title={cat?.name}
                                      ></div>
                                    );
                                  })}
                                  {uniqueCats.length > 3 && (
                                    <div className={`w-2 h-2 sm:w-5 sm:h-5 rounded-full border sm:border-2 border-white flex items-center justify-center text-[5px] sm:text-[8px] font-black ${isDarkMode ? 'bg-white/10 text-gray-400' : 'bg-slate-100 text-slate-500'}`}>
                                      +{uniqueCats.length - 3}
                                    </div>
                                  )}
                                </div>
                              </>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                   </div>
                 </div>
               ) : (
                 <div className={`border rounded-[1.5rem] sm:rounded-[3rem] shadow-sm p-4 sm:p-12 relative overflow-hidden ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
                   {(() => {
                     const monthStr = String(currentMonth.getMonth() + 1).padStart(2, '0');
                     const yearStr = String(currentMonth.getFullYear());
                     const monthRecords = calendarDateFilter ? allRecords.filter((r: any) => r.date === calendarDateFilter).sort((a: any, b: any) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)) : allRecords.filter((r: any) => r.date.startsWith(`${yearStr}-${monthStr}`)).sort((a: any, b: any) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
                     const groupedByDate = monthRecords.reduce((acc: any, record: any) => { if (!acc[record.date]) acc[record.date] = []; acc[record.date].push(record); return acc; }, {});
                     
                     return Object.keys(groupedByDate).length === 0 ? (
                        <div className="p-20 text-center flex flex-col items-center gap-6 opacity-50">
                          <CalendarIcon size={64} className={isDarkMode ? 'text-gray-700' : 'text-slate-300'} />
                          <p className={`text-sm font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>Sin Actividades Registradas</p>
                        </div>
                     ) : (
                       <div className="space-y-12">
                         {Object.keys(groupedByDate).map(date => {
                           const dateObj = new Date(`${date}T00:00:00`);
                           const groupedActs: any = {};
                           groupedByDate[date].forEach((r: any) => {
                              const k = `${r.startTime}-${r.endTime}-${r.categoryId}-${r.description}`;
                              if (!groupedActs[k]) groupedActs[k] = { ...r, participants: [r.studentName], records: [r] };
                              else {
                                groupedActs[k].participants.push(r.studentName);
                                groupedActs[k].records.push(r);
                              }
                           });
                           return (
                             <div key={date} className="relative animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className={`sticky top-0 backdrop-blur-md py-3 sm:py-4 mb-4 sm:mb-6 border-b-2 z-10 flex items-center gap-4 ${isDarkMode ? 'bg-[#1a1a1a]/95 border-white/5' : 'bg-white/95 border-slate-100'}`}>
                                 <h3 className="font-black text-lg sm:text-2xl text-slate-800 capitalize tracking-tight">{safeFormatDate(date)}</h3>
                               </div>
                               <div className="space-y-4 pl-2 sm:pl-8 border-l-2 border-indigo-50">
                                 {Object.entries(groupedActs).map(([k, group]: any, idx: number) => {
                                   const cat = categories.find(c => c.id === group.categoryId);
                                   return (
                                      <div key={`${k}-${idx}`} className={`p-4 sm:p-6 rounded-[1.5rem] sm:rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-4 sm:gap-6 transition-all border group ${isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-slate-50 border-slate-100 hover:bg-white hover:shadow-lg'}`}>
                                       <div className="flex items-center gap-4 sm:gap-6 w-full md:w-auto">
                                          <div className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm border text-center min-w-[80px] sm:min-w-[100px] ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}>
                                           <p className="text-lg sm:text-xl font-black text-indigo-600 leading-none">{group.startTime}</p>
                                            {group.hours && <p className={`text-[8px] sm:text-[10px] font-black uppercase tracking-widest mt-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{group.hours} Hrs</p>}
                                         </div>
                                         <div className="space-y-2 sm:space-y-3 flex-1">
                                           <div className="flex flex-wrap items-center gap-2">
                                               <span className="px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black text-white uppercase shadow-sm" style={{ backgroundColor: cat?.color }}>{cat?.name || 'Categoría'}</span>
                                                {group.participants.length > 1 && <span className={`px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[9px] font-black uppercase flex items-center gap-1 shadow-sm ${isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-100 text-indigo-700'}`}><Users size={10}/> <span className="hidden xs:inline">Actividad Manual</span><span className="xs:hidden">Manual</span></span>}
                                           </div>
                                           <div className="flex flex-wrap gap-2">
                                              {group.participants.map((pName: string, i: number) => (
                                                   <div key={`${pName}-${i}`} className={`border px-2 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-white border-slate-200 text-slate-700'}`}>{String(pName)}</div>
                                              ))}
                                           </div>
                                         </div>
                                       </div>
                                        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
                                          {group.description && <div className={`md:max-w-xs w-full border-t md:border-t-0 pt-3 md:pt-0 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}> <p className={`text-[10px] sm:text-[11px] font-bold italic line-clamp-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>"{group.description}"</p> </div>}
                                          {(userRole === 'admin' || userRole === 'coordinator') && (
                                            <div className="flex items-center gap-2 shrink-0">
                                              <button
                                                type="button"
                                                onClick={() => openAddStudentsToActivity({ ...group, date })}
                                                className={`px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                                                  isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                                }`}
                                                title="Agregar más alumnos activos a esta actividad"
                                              >
                                                <UserPlus size={13} /> <span className="hidden xs:inline">+ Alumnos</span><span className="xs:hidden">+</span>
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => openCalendarEdit(group.records ? group.records[0] : group)}
                                                className={`px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95 ${
                                                  isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'
                                                }`}
                                                title="Editar horas y horario"
                                              >
                                                <Edit2 size={13} /> Editar
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                     </div>
                                   );
                                 })}
                               </div>
                             </div>
                           );
                         })}
                       </div>
                     );
                   })()}
                 </div>
               )}

               {selectedCalendarDate && (
                 <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4 z-[100] overflow-y-auto" onClick={(e) => {if(e.target===e.currentTarget) setSelectedCalendarDate(null);}}>
                    <div className={`rounded-[2rem] sm:rounded-[3.5rem] p-6 sm:p-12 w-full max-w-4xl shadow-2xl relative animate-in zoom-in-95 duration-300 border-t-[8px] sm:border-t-[12px] border-indigo-600 my-auto ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                     <button onClick={() => setSelectedCalendarDate(null)} className={`absolute top-6 right-6 sm:top-10 sm:right-10 p-3 sm:p-4 rounded-[1.5rem] transition-all ${isDarkMode ? 'bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400' : 'bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-500'}`}><X size={24}/></button>
                     
                     {(() => {
                        const dayRecords = allRecords.filter((r: any) => r.date === selectedCalendarDate).sort((a: any,b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
                        const totalDayHours = dayRecords.reduce((sum: number, r: any) => sum + (Number(r.hours) || Number(r.horasCalculadas) || 0), 0);
                        const grouped: any = {};
                        dayRecords.forEach((r: any) => {
                           const key = `${r.startTime || 'manual'}-${r.endTime || 'manual'}-${r.categoryId || 'none'}-${r.projectId || 'none'}-${r.description || ''}`;
                           if (!grouped[key]) grouped[key] = { ...r, participants: [r.studentName], records: [r] };
                           else {
                             grouped[key].participants.push(r.studentName);
                             grouped[key].records.push(r);
                           }
                        });

                        return (
                          <>
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-6 border-b border-slate-200 dark:border-white/10 pr-10">
                              <div>
                                <h3 className={`font-black text-2xl sm:text-3xl capitalize tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                                  {safeFormatDate(selectedCalendarDate || '')}
                                </h3>
                                <p className={`text-xs font-bold uppercase tracking-wider mt-1.5 flex flex-wrap items-center gap-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                  <span className="font-mono tabular-nums text-indigo-500 font-black">{Number(totalDayHours.toFixed(1))} hrs</span>
                                  <span>computadas</span>
                                  <span>•</span>
                                  <span>{Object.keys(grouped).length} {Object.keys(grouped).length === 1 ? 'actividad' : 'actividades'}</span>
                                  <span>•</span>
                                  <span>{dayRecords.length} {dayRecords.length === 1 ? 'registro' : 'registros'}</span>
                                </p>
                              </div>
                              {(userRole === 'admin' || userRole === 'coordinator') && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setManualHoursForm({ hours: 0, category: 'Otra Brigada', date: selectedCalendarDate || getCDMXDateString() });
                                    setManualHoursStudentId('');
                                    setManualHoursSearch('');
                                    setShowManualHours(true);
                                  }}
                                  className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95 shrink-0 w-fit"
                                >
                                  <Plus size={16} /> Asignar Horas
                                </button>
                              )}
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-3 sm:pr-4 custom-scrollbar overflow-x-hidden">
                              {Object.keys(grouped).length === 0 ? (
                                <div className="p-12 text-center text-slate-400 text-xs font-bold">
                                  No hay actividades registradas en esta fecha.
                                </div>
                              ) : (
                                Object.entries(grouped).map(([k, group]: any, idx: number) => {
                                  const cat = categories.find(c => c.id === group.categoryId);
                                  return (
                                    <div 
                                      key={`${k}-${idx}`} 
                                      className={`p-4 sm:p-6 rounded-[2rem] border transition-all ${
                                        isDarkMode 
                                          ? 'bg-white/5 border-white/10 hover:bg-white/[0.08]' 
                                          : 'bg-slate-50/80 border-slate-200/80 hover:bg-white hover:shadow-md'
                                      }`}
                                    >
                                      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-4 lg:gap-6">
                                        {/* Col 1: Horario & Duración */}
                                        <div className={`flex flex-row lg:flex-col items-center justify-center gap-2 lg:gap-1 p-3 sm:p-4 rounded-2xl border text-center shrink-0 w-full lg:w-28 ${
                                          isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200 shadow-sm'
                                        }`}>
                                          <div className="flex items-center gap-1.5 text-indigo-500 font-mono">
                                            <Clock size={16} className="shrink-0" />
                                            <span className="text-base sm:text-lg font-black tracking-tight tabular-nums">
                                              {group.startTime || 'Manual'}
                                            </span>
                                          </div>
                                          {group.endTime && group.startTime && (
                                            <span className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-400'}`}>
                                              hasta {group.endTime}
                                            </span>
                                          )}
                                          {group.hours && (
                                            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md mt-0 lg:mt-1 ${
                                              isDarkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                              {Number(group.hours).toFixed(1)} hrs
                                            </span>
                                          )}
                                        </div>

                                        {/* Col 2: Contenido, Categoría, Descripción y Participantes */}
                                        <div className="flex-1 min-w-0 space-y-3 w-full">
                                          {/* Meta de Categoría, Proyecto y Tipo */}
                                          <div className="flex flex-wrap items-center gap-2 max-w-full">
                                            {/* Categoría Badge interactivo */}
                                            <button 
                                              type="button"
                                              onClick={() => (userRole === 'admin' || userRole === 'coordinator') && openChangeCategoryProjectModal({ ...group, date: selectedCalendarDate })}
                                              className={`px-2.5 py-1 rounded-lg text-[10px] font-black text-white uppercase tracking-wider shadow-sm flex items-center gap-1.5 transition-all max-w-[200px] truncate ${
                                                (userRole === 'admin' || userRole === 'coordinator') ? 'hover:brightness-110 active:scale-95 cursor-pointer ring-1 ring-white/20' : 'cursor-default'
                                              }`}
                                              style={{ backgroundColor: cat?.color || '#6366f1' }}
                                              title={(userRole === 'admin' || userRole === 'coordinator') ? `Categoría: ${cat?.name || 'General'}. Clic para cambiar categoría o proyecto.` : (cat?.name || 'General')}
                                            >
                                              <span className="truncate">{cat?.name || 'General'}</span>
                                              {(userRole === 'admin' || userRole === 'coordinator') && (
                                                <ChevronDown size={11} className="opacity-80 shrink-0" />
                                              )}
                                            </button>

                                            {/* Proyecto Badge interactivo */}
                                            {(() => {
                                              const currentProj = projects.find((p: any) => p.id === group.projectId);
                                              return (
                                                <button
                                                  type="button"
                                                  onClick={() => (userRole === 'admin' || userRole === 'coordinator') && openChangeCategoryProjectModal({ ...group, date: selectedCalendarDate })}
                                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all max-w-[220px] truncate ${
                                                    (userRole === 'admin' || userRole === 'coordinator') ? 'cursor-pointer hover:opacity-90 active:scale-95' : 'cursor-default'
                                                  } ${
                                                    currentProj
                                                      ? (isDarkMode ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm')
                                                      : (isDarkMode ? 'bg-white/5 border border-dashed border-white/20 text-gray-400 hover:text-white' : 'bg-slate-100 border border-dashed border-slate-300 text-slate-500 hover:text-slate-700')
                                                  }`}
                                                  title={(userRole === 'admin' || userRole === 'coordinator') ? (currentProj ? `Proyecto: ${currentProj.name}. Clic para cambiar.` : 'Sin proyecto específico. Clic para asignar a un proyecto.') : (currentProj?.name || 'Sin Proyecto')}
                                                >
                                                  <Folder size={11} className={`shrink-0 ${currentProj ? 'text-indigo-400' : 'opacity-60'}`} />
                                                  <span className="truncate">{currentProj?.name || '+ Asignar Proyecto'}</span>
                                                  {(userRole === 'admin' || userRole === 'coordinator') && (
                                                    <Edit2 size={9} className="opacity-60 shrink-0" />
                                                  )}
                                                </button>
                                              );
                                            })()}

                                            {group.participants.length > 1 && (
                                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shrink-0 ${
                                                isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-200/80 text-slate-700'
                                              }`}>
                                                <Users size={11} className="shrink-0" /> Actividad Grupal ({group.participants.length})
                                              </span>
                                            )}
                                          </div>

                                          {/* Descripción clara y legible */}
                                          {group.description ? (
                                            <p className={`text-xs sm:text-[13px] font-medium leading-relaxed ${
                                              isDarkMode ? 'text-gray-200' : 'text-slate-700'
                                            }`}>
                                              {group.description}
                                            </p>
                                          ) : (
                                            <p className={`text-xs italic ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                                              Sin descripción detallada.
                                            </p>
                                          )}

                                          {/* Lista de Alumnos Participantes: Chips compactos y limpios */}
                                          <div className="pt-2 border-t border-slate-200/60 dark:border-white/5">
                                            <div className="flex items-center justify-between mb-1.5">
                                              <span className={`text-[10px] font-black uppercase tracking-wider ${
                                                isDarkMode ? 'text-gray-400' : 'text-slate-500'
                                              }`}>
                                                Alumnos en esta actividad ({(group.records || []).length})
                                              </span>
                                            </div>

                                            <div className="flex flex-wrap gap-2 items-center">
                                              {(group.records || []).map((rec: any, i: number) => {
                                                const student = getStudentData(rec.studentId || rec.userId);
                                                const studentName = rec.studentName || student?.name || 'Alumno';
                                                const initial = (studentName || 'A')[0].toUpperCase();
                                                const hoursDisplay = Number((rec.hours || 0).toFixed(1));

                                                return (
                                                  <div 
                                                    key={`${rec.id || 'rec'}-${i}`}
                                                    className={`group/chip pl-1.5 pr-2 py-1 rounded-xl border text-xs font-medium shadow-sm flex items-center gap-2 transition-all ${
                                                      isDarkMode 
                                                        ? 'bg-white/5 border-white/10 text-gray-200 hover:border-white/20' 
                                                        : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                                                    }`}
                                                  >
                                                    {/* Mini Avatar */}
                                                    <div className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                                                      isDarkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'
                                                    }`}>
                                                      {initial}
                                                    </div>

                                                    {/* Nombre */}
                                                    <span className="font-semibold text-[11px] max-w-[120px] sm:max-w-[160px] truncate" title={studentName}>
                                                      {studentName}
                                                    </span>

                                                    {/* Horas del alumno */}
                                                    <span className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                                                      isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                      {hoursDisplay}h
                                                    </span>

                                                    {/* Acciones individuales (editar / borrar registro) */}
                                                    {(userRole === 'admin' || userRole === 'coordinator') && (
                                                      <div className="flex items-center gap-0.5 border-l pl-1.5 ml-0.5 border-slate-200 dark:border-white/10">
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            openCalendarEdit(rec);
                                                          }}
                                                          className={`p-1 rounded-md transition-colors ${
                                                            isDarkMode 
                                                              ? 'text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/20' 
                                                              : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                          }`}
                                                          title={`Editar horas de ${studentName}`}
                                                        >
                                                          <Edit2 size={11} />
                                                        </button>
                                                        <button
                                                          type="button"
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteCalendarRecord(rec);
                                                          }}
                                                          className={`p-1 rounded-md transition-colors ${
                                                            isDarkMode 
                                                              ? 'text-gray-400 hover:text-red-400 hover:bg-red-500/20' 
                                                              : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                                          }`}
                                                          title={`Eliminar registro de ${studentName}`}
                                                        >
                                                          <Trash2 size={11} />
                                                        </button>
                                                      </div>
                                                    )}
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Col 3: Acciones Principales Unificadas (Derecha) */}
                                        {(userRole === 'admin' || userRole === 'coordinator') && (
                                          <div className="flex flex-row lg:flex-col items-stretch lg:items-end gap-2 shrink-0 w-full lg:w-auto pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-200/60 dark:border-white/5 justify-end">
                                            <button
                                              type="button"
                                              onClick={() => openAddStudentsToActivity({ ...group, date: selectedCalendarDate })}
                                              className={`flex-1 lg:flex-none px-3.5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                                                isDarkMode 
                                                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20' 
                                                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300'
                                              }`}
                                              title="Agregar más alumnos activos a esta actividad"
                                            >
                                              <UserPlus size={14} className="shrink-0" />
                                              <span>+ Alumnos</span>
                                            </button>

                                            <button
                                              type="button"
                                              onClick={() => openChangeCategoryProjectModal({ ...group, date: selectedCalendarDate })}
                                              className={`flex-1 lg:flex-none px-3.5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                                                isDarkMode 
                                                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20' 
                                                  : 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100 hover:border-amber-300'
                                              }`}
                                              title="Cambiar categoría o asignar a un proyecto específico"
                                            >
                                              <Layers size={14} className="shrink-0" />
                                              <span>Categoría / Proyecto</span>
                                            </button>

                                            {group.records && group.records.length === 1 && (
                                              <button
                                                type="button"
                                                onClick={() => openCalendarEdit(group.records[0])}
                                                className={`flex-1 lg:flex-none px-3.5 py-2.5 rounded-xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 whitespace-nowrap ${
                                                  isDarkMode 
                                                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20' 
                                                    : 'bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300'
                                                }`}
                                                title="Editar horario y horas de esta actividad"
                                              >
                                                <Edit2 size={14} className="shrink-0" />
                                                <span>Editar</span>
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Modal Interactivo de Edición de Horas desde el Calendario */}
                {editingCalendarRecord && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[110] overflow-y-auto">
                    <div className={`rounded-[2.5rem] p-6 sm:p-10 w-full max-w-xl shadow-2xl border ${isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} my-auto animate-in zoom-in-95 duration-300 relative`}>
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h3 className="text-2xl sm:text-3xl font-black tracking-tight">Editar Horas del Alumno</h3>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                            Modificación interactiva directa desde el calendario
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingCalendarRecord(null)}
                          className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {(() => {
                        const student = getStudentData(calendarEditForm.studentId);
                        const approvedHrs = (student?.records || []).reduce((acc: number, r: any) => {
                          if (r.validationStatus === 'aprobado' || !r.validationStatus) {
                            return acc + (Number(r.hours) || Number(r.horasCalculadas) || 0);
                          }
                          return acc;
                        }, 0);

                        return (
                          <div className="space-y-5">
                            {/* Tarjeta del alumno */}
                            {student && (
                              <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                                <div className="min-w-0 flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center font-black text-sm">
                                    {(student.name || 'A')[0]}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-black text-xs truncate">{student.name || getFullName(student)}</p>
                                    <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                      {student.career} {student.studentId ? `• Matrícula: ${student.studentId}` : ''}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-white border-indigo-200 text-indigo-700'}`}>
                                    {Number(approvedHrs.toFixed(1))} / {TOTAL_REQUIRED_HOURS}h
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Fecha de la actividad (Permite mover a otro día) */}
                            <div className="space-y-1.5">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                Fecha de la Actividad (Mover a otro día)
                              </label>
                              <input
                                type="date"
                                max={getCDMXDateString()}
                                value={calendarEditForm.date}
                                onChange={e => setCalendarEditForm({ ...calendarEditForm, date: e.target.value })}
                                className={`w-full p-3.5 border rounded-2xl text-xs font-bold outline-none transition-all ${
                                  isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'
                                }`}
                              />
                            </div>

                            {/* Selector de modo: Horario Entrada/Salida o Horas Manuales */}
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="checkbox"
                                id="calEditManualHours"
                                checked={calendarEditForm.isManualHours}
                                onChange={e => {
                                  const isManual = e.target.checked;
                                  setCalendarEditForm(prev => ({
                                    ...prev,
                                    isManualHours: isManual,
                                    hours: isManual ? (prev.hours || 1) : prev.hours
                                  }));
                                }}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                              />
                              <label htmlFor="calEditManualHours" className={`text-xs font-bold cursor-pointer ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                                Asignar horas totales fijas (sin horario entrada/salida)
                              </label>
                            </div>

                            {/* Horario Entrada / Salida o Campo de Horas */}
                            {!calendarEditForm.isManualHours ? (
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Entrada</label>
                                  <input
                                    type="text"
                                    placeholder="HH:MM"
                                    maxLength={5}
                                    value={calendarEditForm.startTime}
                                    onChange={e => handleCalendarStartTimeChange(e.target.value)}
                                    className={`w-full p-3 border rounded-2xl text-sm font-black text-center outline-none ${
                                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                    }`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Salida</label>
                                  <input
                                    type="text"
                                    placeholder="HH:MM"
                                    maxLength={5}
                                    value={calendarEditForm.endTime}
                                    onChange={e => handleCalendarEndTimeChange(e.target.value)}
                                    className={`w-full p-3 border rounded-2xl text-sm font-black text-center outline-none ${
                                      isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                    }`}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Horas Totales</label>
                                <input
                                  type="number"
                                  min="0.5"
                                  max="240"
                                  step="0.5"
                                  value={calendarEditForm.hours || ''}
                                  onChange={e => setCalendarEditForm({ ...calendarEditForm, hours: parseFloat(e.target.value) || 0 })}
                                  className={`w-full p-3 border rounded-2xl text-sm font-black text-center outline-none ${
                                    isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                                  }`}
                                />
                              </div>
                            )}

                            {/* Banner de Total Calculado */}
                            <div className={`p-4 rounded-2xl border flex items-center justify-between shadow-inner ${
                              isDarkMode ? 'bg-indigo-950/40 border-indigo-500/20 text-white' : 'bg-indigo-50 border-indigo-100 text-indigo-950'
                            }`}>
                              <div className="flex items-center gap-3">
                                <Clock size={20} className="text-indigo-500" />
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-wider text-indigo-400">Total a Computar</p>
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black">{Number(calendarEditForm.hours.toFixed(2))}</span>
                                    <span className="text-xs font-bold uppercase text-indigo-400">Horas</span>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right text-[11px] font-bold opacity-80">
                                {calendarEditForm.date}
                              </div>
                            </div>

                            {/* Categoría y Proyecto Asignado */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Categoría</label>
                                <select
                                  value={calendarEditForm.categoryId}
                                  onChange={e => setCalendarEditForm({ ...calendarEditForm, categoryId: e.target.value })}
                                  className={`w-full p-3.5 border rounded-2xl text-xs font-bold outline-none ${
                                    isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                                  }`}
                                >
                                  <option value="">Sin categoría / General</option>
                                  {categories.map(c => (
                                    <option key={c.id} value={c.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>{c.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-1.5">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Proyecto Asignado</label>
                                <select
                                  value={calendarEditForm.projectId || ''}
                                  onChange={e => setCalendarEditForm({ ...calendarEditForm, projectId: e.target.value })}
                                  className={`w-full p-3.5 border rounded-2xl text-xs font-bold outline-none ${
                                    isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                                  }`}
                                >
                                  <option value="">Sin Proyecto / General</option>
                                  {projects.map((p: any) => (
                                    <option key={p.id} value={p.id} className={isDarkMode ? 'bg-[#1a1a1a]' : ''}>
                                      {p.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Descripción */}
                            <div className="space-y-1.5">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Descripción / Bitácora</label>
                              <textarea
                                value={calendarEditForm.description}
                                onChange={e => setCalendarEditForm({ ...calendarEditForm, description: e.target.value })}
                                rows={2}
                                placeholder="Detalle de actividades realizadas..."
                                className={`w-full p-3 border rounded-2xl text-xs outline-none ${
                                  isDarkMode ? 'bg-white/5 border-white/10 text-white placeholder-gray-500' : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                                }`}
                              />
                            </div>

                            {/* Botones de acción */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-3">
                              <button
                                type="button"
                                onClick={() => handleDeleteCalendarRecord(editingCalendarRecord)}
                                className={`p-3.5 rounded-2xl border text-xs font-bold transition-all text-red-500 hover:bg-red-500/10 ${
                                  isDarkMode ? 'border-red-500/20' : 'border-red-200'
                                }`}
                                title="Eliminar esta sesión de horas"
                              >
                                <Trash2 size={18} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const actGroup = {
                                    date: calendarEditForm.date,
                                    startTime: calendarEditForm.startTime,
                                    endTime: calendarEditForm.endTime,
                                    hours: calendarEditForm.hours,
                                    horasCalculadas: calendarEditForm.hours,
                                    categoryId: calendarEditForm.categoryId,
                                    description: calendarEditForm.description,
                                    records: [editingCalendarRecord]
                                  };
                                  openAddStudentsToActivity(actGroup);
                                }}
                                className={`p-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                                  isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                }`}
                                title="Sumar más alumnos a esta misma actividad"
                              >
                                <UserPlus size={15} /> + Alumnos
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingCalendarRecord(null)}
                                className={`flex-1 p-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-colors ${
                                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isSavingCalendarEdit}
                                onClick={handleSaveCalendarRecordEdit}
                                className="flex-2 p-3.5 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {isSavingCalendarEdit && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                Guardar Horas
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Modal para agregar más alumnos activos a una actividad */}
                {targetActivityForAddingStudents && (
                  <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[120] overflow-y-auto"
                    onClick={(e) => {
                      if (e.target === e.currentTarget && !isSavingStudentsToActivity) {
                        setTargetActivityForAddingStudents(null);
                      }
                    }}
                  >
                    <div className={`rounded-[2.5rem] p-6 sm:p-10 w-full max-w-2xl shadow-2xl border ${
                      isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                    } my-auto animate-in zoom-in-95 duration-300 relative max-h-[90vh] flex flex-col`}>
                      
                      {/* Encabezado */}
                      <div className="flex items-start justify-between mb-5 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">
                            <UserPlus size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight">Agregar Alumnos a la Actividad</h3>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                              Solo alumnos activos con servicio social en curso
                            </p>
                          </div>
                        </div>
                        <button
                          disabled={isSavingStudentsToActivity}
                          onClick={() => setTargetActivityForAddingStudents(null)}
                          className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Resumen de la Actividad */}
                      {(() => {
                        const act = targetActivityForAddingStudents;
                        const cat = categories.find(c => c.id === act.categoryId);
                        const hoursNum = Number(act.hours) || Number(act.horasCalculadas) || 0;
                        const existingParticipants = act.participants || (act.records || []).map((r: any) => r.studentName || 'Alumno');

                        return (
                          <div className="overflow-y-auto pr-1 space-y-5 flex-1 custom-scrollbar">
                            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} space-y-3`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="px-3 py-1 rounded-xl text-[9px] font-black text-white uppercase shadow-sm" style={{ backgroundColor: cat?.color || '#6366f1' }}>
                                    {cat?.name || 'General'}
                                  </span>
                                  <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                                    📅 {safeFormatDate(act.date || selectedCalendarDate || '')}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-black text-indigo-500">
                                  <Clock size={14} />
                                  <span>{act.startTime ? `${act.startTime} - ${act.endTime} (${hoursNum}h)` : `${hoursNum} hrs computadas`}</span>
                                </div>
                              </div>

                              {act.description && (
                                <p className={`text-xs font-medium italic line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                                  "{act.description}"
                                </p>
                              )}

                              {/* Participantes actuales */}
                              <div className="pt-2 border-t border-slate-200 dark:border-white/10">
                                <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                  Participantes ya registrados ({existingParticipants.length}):
                                </p>
                                <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto custom-scrollbar">
                                  {existingParticipants.map((pName: string, i: number) => (
                                    <span 
                                      key={`${pName}-${i}`} 
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                                        isDarkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-white border-slate-200 text-slate-700'
                                      }`}
                                    >
                                      ✓ {String(pName)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Selector de Alumnos Activos */}
                            <div className="space-y-3">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                    Seleccionar Alumnos Activos a Incorporar
                                  </label>
                                  <p className={`text-[11px] font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                    {availableActiveStudentsForTargetActivity.length} alumnos activos disponibles (excluye finalizados y ya asignados)
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allFilteredIds = filteredStudentsToAdd.map(s => s.id);
                                      setSelectedStudentsToAdd(allFilteredIds);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                      isDarkMode ? 'bg-white/5 hover:bg-white/10 text-indigo-400' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-600'
                                    }`}
                                  >
                                    Seleccionar Todos ({filteredStudentsToAdd.length})
                                  </button>
                                  {selectedStudentsToAdd.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setSelectedStudentsToAdd([])}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-colors ${
                                        isDarkMode ? 'bg-white/5 hover:bg-white/10 text-gray-400' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                      }`}
                                    >
                                      Limpiar
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Barra de búsqueda con filtro */}
                              <div className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border ${
                                isDarkMode ? 'bg-white/5 border-white/10 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                              }`}>
                                <Search size={16} className={isDarkMode ? 'text-gray-400' : 'text-slate-400'} />
                                <input
                                  type="text"
                                  placeholder="Buscar por nombre, matrícula, carrera o brigada..."
                                  value={searchStudentsToAdd}
                                  onChange={e => setSearchStudentsToAdd(e.target.value)}
                                  className="w-full bg-transparent text-xs font-bold outline-none"
                                />
                                {searchStudentsToAdd && (
                                  <button onClick={() => setSearchStudentsToAdd('')} className="text-gray-400 hover:text-gray-600">
                                    <X size={14} />
                                  </button>
                                )}
                              </div>

                              {/* Listado de alumnos activos */}
                              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {filteredStudentsToAdd.length === 0 ? (
                                  <div className={`p-8 rounded-2xl border text-center ${
                                    isDarkMode ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-slate-50 border-slate-200 text-slate-500'
                                  }`}>
                                    <p className="text-xs font-bold">
                                      {availableActiveStudentsForTargetActivity.length === 0 
                                        ? 'Todos los alumnos activos disponibles ya están asignados a esta actividad o han finalizado su servicio social.' 
                                        : 'No se encontraron alumnos con ese criterio de búsqueda.'}
                                    </p>
                                  </div>
                                ) : (
                                  filteredStudentsToAdd.map(student => {
                                    const isSelected = selectedStudentsToAdd.includes(student.id);
                                    const approvedHrs = (student.records || []).reduce((acc: number, r: any) => {
                                      if (r.validationStatus === 'aprobado' || !r.validationStatus) {
                                        return acc + (Number(r.hours) || Number(r.horasCalculadas) || 0);
                                      }
                                      return acc;
                                    }, 0);

                                    return (
                                      <div
                                        key={student.id}
                                        onClick={() => {
                                          setSelectedStudentsToAdd(prev => 
                                            prev.includes(student.id) 
                                              ? prev.filter(id => id !== student.id) 
                                              : [...prev, student.id]
                                          );
                                        }}
                                        className={`p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                                          isSelected
                                            ? (isDarkMode ? 'bg-emerald-500/15 border-emerald-500/40 shadow-sm' : 'bg-emerald-50/80 border-emerald-300 shadow-sm')
                                            : (isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50')
                                        }`}
                                      >
                                        <div className="flex items-center gap-3 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={isSelected}
                                            onChange={() => {}}
                                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500 cursor-pointer pointer-events-none"
                                          />
                                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                            isSelected 
                                              ? 'bg-emerald-600 text-white' 
                                              : (isDarkMode ? 'bg-white/10 text-gray-300' : 'bg-slate-100 text-slate-700')
                                          }`}>
                                            {(student.name || 'A')[0]}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-bold text-xs truncate">
                                              {student.name || getFullName(student)}
                                            </p>
                                            <p className={`text-[10px] font-medium truncate ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                              {student.career || 'Sin Carrera'} {student.studentId ? `• Mat: ${student.studentId}` : ''}
                                            </p>
                                          </div>
                                        </div>

                                        <div className="text-right shrink-0">
                                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg border ${
                                            isDarkMode ? 'bg-white/5 border-white/10 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                                          }`}>
                                            {Number(approvedHrs.toFixed(1))} / {TOTAL_REQUIRED_HOURS}h
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-white/10 shrink-0">
                              <button
                                type="button"
                                disabled={isSavingStudentsToActivity}
                                onClick={() => setTargetActivityForAddingStudents(null)}
                                className={`p-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-colors flex-1 ${
                                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={selectedStudentsToAdd.length === 0 || isSavingStudentsToActivity}
                                onClick={handleSaveStudentsToActivity}
                                className="flex-2 p-3.5 rounded-2xl bg-emerald-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {isSavingStudentsToActivity && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                <UserPlus size={16} />
                                <span>
                                  {selectedStudentsToAdd.length === 0 
                                    ? 'Selecciona Alumnos' 
                                    : `Agregar ${selectedStudentsToAdd.length} Alumno${selectedStudentsToAdd.length === 1 ? '' : 's'} a la Actividad`}
                                </span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Modal para cambiar categoría y asignación a proyecto de una actividad */}
                {activityToChangeCategoryProject && (
                  <div 
                    className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[125] overflow-y-auto"
                    onClick={(e) => {
                      if (e.target === e.currentTarget && !isSavingCategoryProjectChange) {
                        setActivityToChangeCategoryProject(null);
                      }
                    }}
                  >
                    <div className={`rounded-[2.5rem] p-6 sm:p-10 w-full max-w-xl shadow-2xl border ${
                      isDarkMode ? 'bg-[#1a1a1a] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'
                    } my-auto animate-in zoom-in-95 duration-300 relative max-h-[90vh] flex flex-col overflow-hidden`}>
                      
                      {/* Encabezado */}
                      <div className="flex items-start justify-between mb-5 shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black shrink-0">
                            <Layers size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl sm:text-2xl font-black tracking-tight">Cambiar Categoría y Proyecto</h3>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                              Actualiza la categoría y asignación de proyecto para esta actividad
                            </p>
                          </div>
                        </div>
                        <button
                          disabled={isSavingCategoryProjectChange}
                          onClick={() => setActivityToChangeCategoryProject(null)}
                          className={`p-2.5 rounded-xl transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-slate-100 text-slate-400'}`}
                        >
                          <X size={20} />
                        </button>
                      </div>

                      {/* Cuerpo Scrollable */}
                      {(() => {
                        const act = activityToChangeCategoryProject;
                        const hoursNum = Number(act.hours) || Number(act.horasCalculadas) || 0;
                        const currentParticipants = act.participants || (act.records || []).map((r: any) => r.studentName || 'Alumno');

                        return (
                          <div className="overflow-y-auto pr-1 space-y-5 flex-1 custom-scrollbar">
                            {/* Resumen de la actividad */}
                            <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'} space-y-2`}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>
                                  📅 {safeFormatDate(act.date || selectedCalendarDate || '')}
                                </span>
                                <span className="text-xs font-black text-indigo-500 flex items-center gap-1.5">
                                  <Clock size={13} />
                                  {act.startTime ? `${act.startTime} - ${act.endTime} (${hoursNum}h)` : `${hoursNum} hrs computadas`}
                                </span>
                              </div>
                              {act.description && (
                                <p className={`text-xs italic line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>
                                  "{act.description}"
                                </p>
                              )}
                              <div className="text-[10px] font-bold text-gray-400 pt-1 border-t border-slate-200 dark:border-white/5 flex items-center gap-1.5 flex-wrap">
                                <Users size={12} className="text-indigo-400" />
                                <span>Afecta a {currentParticipants.length} alumno(s):</span>
                                <span className="text-slate-600 dark:text-gray-300 font-semibold truncate max-w-full">
                                  {currentParticipants.slice(0, 4).join(', ')}{currentParticipants.length > 4 ? ` y ${currentParticipants.length - 4} más` : ''}
                                </span>
                              </div>
                            </div>

                            {/* Selector de Categoría */}
                            <div className="space-y-2.5">
                              <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                1. Selecciona la Categoría
                              </label>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                {categories.map((c: any) => {
                                  const isSelected = changeCategoryForm.categoryId === c.id;
                                  return (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => setChangeCategoryForm(prev => ({ ...prev, categoryId: c.id }))}
                                      className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all text-left ${
                                        isSelected
                                          ? (isDarkMode ? 'bg-white/15 border-indigo-400 ring-2 ring-indigo-400/40 shadow-sm' : 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/30 shadow-sm')
                                          : (isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50')
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: c.color }} />
                                        <span className="text-xs font-bold truncate">{c.name}</span>
                                      </div>
                                      {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Selector de Proyecto */}
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                  2. Asignar a un Proyecto Específico
                                </label>
                                {changeCategoryForm.projectId && (
                                  <button
                                    type="button"
                                    onClick={() => setChangeCategoryForm(prev => ({ ...prev, projectId: '' }))}
                                    className="text-[10px] font-bold text-slate-400 hover:text-red-400 transition-colors"
                                  >
                                    Quitar asignación
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                {/* Opción Sin Proyecto / General */}
                                <button
                                  type="button"
                                  onClick={() => setChangeCategoryForm(prev => ({ ...prev, projectId: '' }))}
                                  className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all text-left ${
                                    !changeCategoryForm.projectId
                                      ? (isDarkMode ? 'bg-white/15 border-indigo-400 ring-2 ring-indigo-400/40 shadow-sm' : 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/30 shadow-sm')
                                      : (isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50')
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-lg bg-slate-200 dark:bg-white/10 flex items-center justify-center shrink-0">
                                      <Folder size={12} className="text-slate-500 dark:text-gray-400" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-bold truncate">Sin Proyecto / General</p>
                                      <p className={`text-[9px] truncate ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Actividad general</p>
                                    </div>
                                  </div>
                                  {!changeCategoryForm.projectId && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                </button>

                                {/* Proyectos registrados */}
                                {projects.map((p: any) => {
                                  const isSelected = changeCategoryForm.projectId === p.id;
                                  return (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => setChangeCategoryForm(prev => ({ ...prev, projectId: p.id }))}
                                      className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 transition-all text-left ${
                                        isSelected
                                          ? (isDarkMode ? 'bg-white/15 border-indigo-400 ring-2 ring-indigo-400/40 shadow-sm' : 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-400/30 shadow-sm')
                                          : (isDarkMode ? 'bg-white/5 border-white/5 hover:bg-white/10' : 'bg-white border-slate-200 hover:bg-slate-50')
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div 
                                          className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 shadow-sm text-white font-black text-[10px]"
                                          style={{ backgroundColor: p.color || '#6366f1' }}
                                        >
                                          <Folder size={12} />
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold truncate">{p.name}</p>
                                          {p.description && (
                                            <p className={`text-[9px] truncate ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                                              {p.description}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {isSelected && <Check size={14} className="text-indigo-600 dark:text-indigo-400 shrink-0" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Botones de acción */}
                            <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-white/10 shrink-0">
                              <button
                                type="button"
                                disabled={isSavingCategoryProjectChange}
                                onClick={() => setActivityToChangeCategoryProject(null)}
                                className={`p-3.5 rounded-2xl border text-xs font-black uppercase tracking-wider transition-colors flex-1 ${
                                  isDarkMode ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'
                                }`}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isSavingCategoryProjectChange}
                                onClick={handleSaveCategoryProjectChange}
                                className="flex-2 p-3.5 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                              >
                                {isSavingCategoryProjectChange && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                                <Check size={16} />
                                <span>Guardar Cambios</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}
             </div>
          )}

          {view === 'skill-map' && (
            <SkillMap 
              users={activeEnrolledStudents.map(s => ({
                uid: s.id,
                firstName: s.firstName || '',
                lastNamePaterno: s.lastNamePaterno || '',
                lastNameMaterno: s.lastNameMaterno || '',
                position: s.position || s.career || 'Prestador Activo',
                color: s.color || '#6366f1',
                skills: s.skills || [],
                skillRatings: s.skillRatings || [],
                career: s.career || '',
                projectIds: s.projectIds || []
              }))}
              onUpdateUser={async (userId, data) => {
                const student = getStudentData(userId);
                if (!student) return;
                
                const updatedStudent = { ...student, ...data };
                setStudents(prev => prev.map(s => s.id === userId ? updatedStudent : s));
                
                try {
                  await setDoc(doc(db, 'users', userId), updatedStudent, { merge: true });
                  showSuccessToast("Habilidades actualizadas");
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, `users/${userId}`);
                }
              }}
              onAddUser={async (data) => {
                const newId = `p-${Date.now()}`;
                const newStudent = {
                  id: newId,
                  uid: newId,
                  firstName: data.firstName || '',
                  lastNamePaterno: data.lastNamePaterno || '',
                  lastNameMaterno: data.lastNameMaterno || '',
                  name: `${data.firstName || ''} ${data.lastNamePaterno || ''}`.trim(),
                  email: `${newId}@example.com`,
                  role: 'user',
                  status: 'En Curso',
                  workStatus: 'Sin asignar',
                  projectIds: [],
                  skills: data.skills || [],
                  color: data.color || '#6366f1',
                  position: data.position || '',
                  career: data.career || 'Arquitectura',
                  createdAt: new Date().toISOString()
                };
                
                setStudents(prev => [...prev, newStudent]);
                
                try {
                  await setDoc(doc(db, 'users', newId), newStudent);
                  showSuccessToast("Prestador agregado");
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, `users/${newId}`);
                }
              }}
              isAdmin={userRole !== 'user'}
              currentUserId={currentUserId || ''}
              isDarkMode={isDarkMode}
            />
          )}

          {view === 'google-tasks' && (
            <div className="max-w-7xl mx-auto">
              {!googleAccessToken ? (
                <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8 bg-white dark:bg-white/5 rounded-[2.5rem] border border-slate-200 dark:border-white/10">
                  <div className="bg-indigo-500/10 p-6 rounded-full mb-6">
                    <CheckSquare size={48} className="text-indigo-500" />
                  </div>
                  <h2 className={`text-2xl font-black mb-4 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Conecta con Google Tasks</h2>
                  <p className={`max-w-md mx-auto mb-8 text-sm leading-relaxed ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                    Para gestionar tus tareas pendientes, necesitas autenticarte con tu cuenta de Google.
                  </p>
                  <button 
                    onClick={async (e) => {
                      const btn = e.currentTarget;
                      btn.disabled = true;
                      btn.style.opacity = '0.5';
                      const loadingAuth = toast.loading("Autenticando con Google...");
                      try {
                        const provider = new GoogleAuthProvider();
                        provider.addScope('https://www.googleapis.com/auth/tasks');
                        provider.addScope('https://www.googleapis.com/auth/tasks.readonly');
                        provider.setCustomParameters({ prompt: 'select_account' });
                        const result = await signInWithPopup(auth, provider);
                        const credential = GoogleAuthProvider.credentialFromResult(result);
                        const token = credential?.accessToken || null;
                        if (token) setGoogleAccessToken(token);
                      } catch (error: any) {
                        if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
                          console.warn("Autenticación para Tasks cancelada o ventana cerrada por el usuario.");
                          toast("Ventana de autenticación cerrada. Vuelve a intentarlo cuando desees conectar Google Tasks.", { icon: 'ℹ️' });
                        } else if (error.code === 'auth/blocked-at-iframe-start' || error.code === 'auth/popup-blocked') {
                          console.warn("Ventana emergente bloqueada por el navegador.");
                          showErrorToast("El navegador bloqueó la ventana emergente. Por favor, habilita los popups para este sitio.");
                        } else {
                          console.error("Error authenticating for Tasks:", error);
                          showErrorToast("Error al autenticar con Google: " + (error.message || "Error desconocido"));
                        }
                      } finally {
                        toast.dismiss(loadingAuth);
                        btn.disabled = false;
                        btn.style.opacity = '1';
                      }
                    }}
                    className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-[#121212] border border-slate-200 dark:border-white/10 rounded-2xl font-black text-xs tracking-widest hover:bg-slate-50 dark:hover:bg-white/5 transition-all shadow-sm active:scale-95 mx-auto"
                  >
                    <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                      <path fill="none" d="M0 0h48v48H0z"></path>
                    </svg>
                    <span className={isDarkMode ? 'text-white' : 'text-slate-700'}>INICIAR SESIÓN</span>
                  </button>
                </div>
              ) : (
                <GoogleTasksView accessToken={googleAccessToken} isDarkMode={isDarkMode} />
              )}
            </div>
          )}

          {view === 'categories' && (
            <div className={`max-w-6xl mx-auto space-y-16 animate-in slide-in-from-right-8 duration-700 pb-20 ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
              <div className="space-y-8">
                <div className="flex items-center gap-5">
                   <div className={`p-4 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-white/5 text-indigo-400 border-white/10' : 'bg-indigo-100 text-indigo-600 border-indigo-200'}`}><Tag size={32}/></div>
                   <h2 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Categorías de Actividad</h2>
                </div>
                <div className="grid grid-cols-1 gap-8">
                  <div className={`p-8 rounded-3xl border shadow-sm h-fit ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                    <h3 className={`font-black text-[11px] uppercase tracking-[0.2em] mb-6 flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}><PlusCircle size={16}/> Nueva Categoría</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                         <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Nombre</label>
                         <input type="text" placeholder="Ej. Taller de Paisaje" className={`w-full p-4 border rounded-2xl font-bold outline-none transition-all text-sm shadow-inner ${isDarkMode ? 'border-white/10 bg-white/5 text-white focus:bg-white/10 focus:border-indigo-500' : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-indigo-300'}`} value={newInlineCat.name} onChange={e => setNewInlineCat({...newInlineCat, name: e.target.value})} />
                      </div>
                      <div className="space-y-2">
                         <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Color</label>
                         <div className={`flex items-center gap-4 p-3 rounded-2xl border shadow-inner ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                            <input type="color" className="w-24 sm:w-12 h-12 p-0 border-0 rounded-xl cursor-pointer bg-transparent shadow-sm shrink-0" value={newInlineCat.color} onChange={e => setNewInlineCat({...newInlineCat, color: e.target.value})} />
                            <span className={`text-sm font-bold uppercase font-mono ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>{newInlineCat.color}</span>
                         </div>
                      </div>
                      <button onClick={handleCreateInlineCat} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-indigo-700 transition-all shadow-lg active:scale-95">Registrar Categoría</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 h-fit content-start">
                    {categories.map(cat => (
                      <div key={cat.id} className={`p-5 rounded-2xl border flex items-center justify-between group transition-all shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-indigo-500' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                        {editingCategory?.id === cat.id ? (
                          <div className="flex items-center gap-3 w-full">
                            <input type="color" className="w-16 sm:w-8 h-8 p-0 border-0 rounded-lg cursor-pointer bg-transparent shadow-sm shrink-0" value={editingCategory.color} onChange={e => setEditingCategory({...editingCategory, color: e.target.value})} />
                            <input type="text" className={`flex-1 min-w-0 p-2 border rounded-xl font-bold outline-none text-sm ${isDarkMode ? 'border-white/10 bg-white/10 text-white focus:bg-white/20' : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white'}`} value={editingCategory.name} onChange={e => setEditingCategory({...editingCategory, name: e.target.value})} />
                            <button onClick={async () => {
                              setCategories(categories.map(c => c.id === cat.id ? editingCategory : c));
                              try {
                                await setDoc(doc(db, 'categories', cat.id), editingCategory);
                                setEditingCategory(null);
                                showSuccessToast("Categoría actualizada");
                              } catch (error) {
                                handleFirestoreError(error, OperationType.WRITE, `categories/${cat.id}`);
                              }
                            }} className="text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 p-2 rounded-xl transition-all"><Check size={18} /></button>
                            <button onClick={() => setEditingCategory(null)} className="text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 p-2 rounded-xl transition-all"><X size={18} /></button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-4 min-w-0">
                               <div className={`w-5 h-5 rounded-full shadow-inner border shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`} style={{ backgroundColor: cat.color }}></div>
                               <span className={`font-bold text-sm tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingCategory(cat)} className={`p-2.5 rounded-xl transition-all shadow-sm ${isDarkMode ? 'text-gray-400 hover:text-indigo-400 bg-white/5 hover:bg-white/10' : 'text-slate-300 hover:text-indigo-500 bg-slate-50'}`}><Edit2 size={16} /></button>
                              <button onClick={() => {
                                showConfirmToast('¿Estás seguro de que deseas eliminar esta categoría? Esto no se puede deshacer.', async () => {
                                  setCategories(categories.filter(c => c.id !== cat.id));
                                  try {
                                    await deleteDoc(doc(db, 'categories', cat.id));
                                    showSuccessToast("Categoría eliminada");
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.DELETE, `categories/${cat.id}`);
                                  }
                                });
                              }} className={`p-2.5 rounded-xl transition-all shadow-sm ${isDarkMode ? 'text-gray-400 hover:text-red-400 bg-white/5 hover:bg-white/10' : 'text-slate-300 hover:text-red-500 bg-slate-50'}`}><Trash2 size={18} /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`space-y-8 pt-12 border-t-2 border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex items-center gap-5">
                   <div className={`p-4 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-white/5 text-emerald-400 border-white/10' : 'bg-emerald-100 text-emerald-600 border-emerald-200'}`}><Briefcase size={32}/></div>
                   <h2 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Proyectos de Brigada</h2>
                </div>
                <div className="grid grid-cols-1 gap-8">
                  <div className={`p-8 rounded-3xl border shadow-sm h-fit ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                    <h3 className={`font-black text-[11px] uppercase tracking-[0.2em] mb-6 flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}><PlusCircle size={16}/> Nuevo Proyecto</h3>
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>Título</label>
                        <input type="text" placeholder="Ej. Intervención Plaza..." className={`w-full p-4 border rounded-2xl font-bold outline-none transition-all text-sm shadow-inner ${isDarkMode ? 'border-white/10 bg-white/5 text-white focus:bg-white/10 focus:border-emerald-500' : 'border-slate-200 bg-slate-50 text-slate-900 focus:bg-white focus:border-emerald-300'}`} id="newProjName" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Color</label>
                        <div className={`flex flex-wrap gap-3 p-4 rounded-2xl border shadow-inner ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                          {['#22c55e','#eab308','#ef4444','#3b82f6','#6366f1','#a855f7','#f97316','#ec4899'].map(c=>(
                            <button key={c} onClick={(e: any)=>{
                               (window as any).__selProjColor=c;
                               e.target.parentElement.querySelectorAll('button').forEach((btn: any) => btn.classList.remove('ring-4', 'ring-slate-400', 'scale-110'));
                               e.target.classList.add('ring-4', 'ring-slate-400', 'scale-110');
                            }} className="w-8 h-8 rounded-full border-2 border-white shadow-sm transition-all hover:scale-110 active:scale-95" style={{ backgroundColor: c }}></button>
                          ))}
                        </div>
                      </div>
                      <button onClick={async ()=>{
                        const n=(document.getElementById('newProjName') as any).value; 
                        if(!n)return; 
                        const newId = `p-${Date.now()}`;
                        const newProj = {id:newId,name:n,color:(window as any).__selProjColor||'#64748b'};
                        setProjects([...projects, newProj]); 
                        try {
                          await setDoc(doc(db, 'projects', newId), newProj);
                          showSuccessToast("Proyecto registrado");
                        } catch (error) {
                          handleFirestoreError(error, OperationType.WRITE, `projects/${newId}`);
                        }
                        (document.getElementById('newProjName') as any).value='';
                      }} className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black uppercase text-xs hover:bg-emerald-700 transition-all shadow-lg active:scale-95">Registrar Proyecto</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 h-fit content-start">
                    {projects.map(p => (
                      <div key={p.id} className={`p-5 rounded-2xl border flex items-center justify-between group transition-all shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10 hover:border-emerald-500/50' : 'bg-white border-slate-200 hover:border-emerald-300'}`}>
                        {editingProject?.id === p.id ? (
                          <div className="flex flex-col gap-3 w-full">
                            <input type="text" className={`w-full p-2 border rounded-xl font-bold outline-none text-sm ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white'}`} value={editingProject.name} onChange={e => setEditingProject({...editingProject, name: e.target.value})} />
                            <div className="flex items-center justify-between">
                              <div className="flex flex-wrap gap-1">
                                {['#22c55e','#eab308','#ef4444','#3b82f6','#6366f1','#a855f7','#f97316','#ec4899'].map(c=>(
                                  <button key={c} onClick={() => setEditingProject({...editingProject, color: c})} className={`w-5 h-5 rounded-full border-2 ${editingProject.color === c ? (isDarkMode ? 'border-white scale-110' : 'border-slate-800 scale-110') : 'border-white'} shadow-sm transition-all`} style={{ backgroundColor: c }}></button>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                <button onClick={async () => {
                                  setProjects(projects.map(pr => pr.id === p.id ? editingProject : pr));
                                  try {
                                    await setDoc(doc(db, 'projects', p.id), editingProject);
                                    setEditingProject(null);
                                    showSuccessToast("Proyecto actualizado");
                                  } catch (error) {
                                    handleFirestoreError(error, OperationType.WRITE, `projects/${p.id}`);
                                  }
                                }} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-emerald-400 hover:bg-white/10' : 'text-emerald-600 hover:bg-emerald-50'}`}><Check size={18} /></button>
                                <button onClick={() => setEditingProject(null)} className={`p-2 rounded-xl transition-all ${isDarkMode ? 'text-gray-400 hover:bg-white/10' : 'text-slate-400 hover:bg-slate-50'}`}><X size={18} /></button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-4 min-w-0">
                               <div className={`w-5 h-5 rounded-full shadow-inner border shrink-0 ${isDarkMode ? 'border-white/10' : 'border-slate-100'}`} style={{ backgroundColor: p.color }}></div>
                               <span className={`font-bold text-sm tracking-tight truncate ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{p.name}</span>
                            </div>
                            <div className="flex items-center gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setEditingProject(p)} className={`p-2.5 rounded-xl transition-all shadow-sm ${isDarkMode ? 'text-gray-400 hover:text-emerald-400 bg-white/10' : 'text-slate-300 hover:text-emerald-500 bg-slate-50'}`}><Edit2 size={16} /></button>
                              <button onClick={() => { 
                                showConfirm(
                                  '¿Eliminar Proyecto?', 
                                  '¿Estás seguro de que deseas eliminar este proyecto? Esta acción es permanente y borrará todas las tareas y recursos asociados.', 
                                  () => handleDeleteProject(p.id)
                                );
                              }} className={`p-2.5 rounded-xl transition-all shadow-sm ${isDarkMode ? 'text-gray-400 hover:text-red-400 bg-white/10' : 'text-slate-300 hover:text-red-600 bg-slate-50'}`}><Trash2 size={18} /></button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`space-y-8 pt-12 border-t-2 border-dashed ${isDarkMode ? 'border-white/10' : 'border-slate-200'}`}>
                <div className="flex items-center gap-5">
                   <div className={`p-4 rounded-2xl shadow-sm border ${isDarkMode ? 'bg-white/10 text-gray-300 border-white/10' : 'bg-slate-100 text-slate-600 border-slate-200'}`}><Download size={32}/></div>
                   <h2 className={`text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Respaldo de Datos</h2>
                </div>
                <div className={`p-8 rounded-3xl border shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-200'}`}>
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-slate-500'} mb-6 font-medium`}>Puedes exportar todos los datos del sistema (alumnos, registros, proyectos y categorías) a un archivo JSON para tener un respaldo, o importar un archivo previamente guardado.</p>
                  <div className="flex flex-wrap gap-4">
                    <button onClick={() => {
                      const data = { students, categories, projects };
                      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `backup_prestadores_${new Date().toISOString().split('T')[0]}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      showSuccessToast("Respaldo descargado exitosamente");
                    }} className="bg-slate-900 text-white px-6 py-3 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-900/20 hover:bg-slate-800 transition-all active:scale-95">
                      <Download size={20} /> Exportar Datos (JSON)
                    </button>
                    <label className="bg-white border-4 border-slate-100 text-slate-700 px-6 py-3 rounded-2xl flex items-center gap-3 font-black text-xs uppercase tracking-[0.2em] shadow-sm hover:bg-slate-50 transition-all active:scale-95 cursor-pointer">
                      <PlusCircle size={20} className="text-slate-400" /> Importar Datos (JSON)
                      <input type="file" accept=".json" className="hidden" onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const data = JSON.parse(event.target?.result as string);
                            if (data.students && data.categories && data.projects) {
                              setStudents(data.students);
                              setCategories(data.categories);
                              setProjects(data.projects);
                              showSuccessToast("Datos importados exitosamente");
                            } else {
                              showErrorToast("El archivo no tiene el formato correcto");
                            }
                          } catch (error) {
                            showErrorToast("Error al leer el archivo JSON");
                          }
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}
          {rejectedNotifications.length > 0 && (
            <div className={`fixed inset-0 backdrop-blur-3xl flex items-center justify-center p-4 z-[100] overflow-y-auto ${isDarkMode ? 'bg-black/90' : 'bg-slate-900/95'}`}>
              <div className={`rounded-[2.5rem] sm:rounded-[5rem] p-6 sm:p-12 md:p-20 w-full max-w-2xl shadow-2xl my-auto border-t-[8px] sm:border-t-[16px] border-red-600 animate-in zoom-in-95 duration-500 relative ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white'}`}>
                <div className="flex flex-col items-center text-center gap-6">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-600'}`}>
                    <AlertCircle size={48} />
                  </div>
                  <h2 className={`text-3xl sm:text-4xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Horas Rechazadas</h2>
                  <p className={`text-lg max-w-lg font-medium opacity-80 ${isDarkMode ? 'text-gray-300' : 'text-slate-600'}`}>
                    Se han rechazado horas que habías registrado. Por favor, revisa el motivo a continuación.
                  </p>
                  
                  <div className="w-full mt-8 space-y-6">
                    {rejectedNotifications.map((notification, index) => (
                      <div key={`${notification.id || 'notif'}-${index}`} className={`border rounded-3xl p-6 text-left ${isDarkMode ? 'bg-white/2 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                        <div className="flex flex-col sm:flex-row justify-between items-start mb-4 gap-4">
                          <div className="min-w-0 w-full">
                            <h3 className={`font-black uppercase tracking-widest text-lg ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{notification.date}</h3>
                            <p className={`font-medium break-words mt-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{notification.hours} horas - {notification.description}</p>
                          </div>
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest shrink-0 ${isDarkMode ? 'bg-red-500/10 text-red-400' : 'bg-red-100 text-red-700'}`}>Rechazado</span>
                        </div>
                        <div className={`border rounded-2xl p-5 mt-4 ${isDarkMode ? 'bg-red-500/5 border-red-500/10' : 'bg-white border-red-100'}`}>
                          <h4 className={`text-xs font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-red-400' : 'text-red-800'}`}>Motivo del rechazo:</h4>
                          <p className={`font-medium italic leading-relaxed break-words ${isDarkMode ? 'text-gray-400' : 'text-slate-700'}`}>{notification.rejectReason || 'No se especificó un motivo.'}</p>
                        </div>
                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={() => handleAcknowledgeRejection(notification.id)}
                            className={`px-8 py-3 rounded-full font-black uppercase text-xs tracking-[0.2em] transition-all hover:scale-105 active:scale-95 flex items-center gap-2 ${isDarkMode ? 'bg-white text-black hover:bg-gray-200' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                          >
                            <Check size={20} /> Entendido
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
          {rejectingRecord && selectedStudentId && (
            <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/60' : 'bg-slate-900/50'}`}>
              <div className={`rounded-[2rem] p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in duration-200 ${isDarkMode ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white'}`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Rechazar Registro</h3>
                  <button onClick={() => { setRejectingRecord(null); setRejectReason(''); }} className={`transition-colors ${isDarkMode ? 'text-gray-500 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                    <X size={24} />
                  </button>
                </div>
                
                <div className="space-y-6">
                  <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <p className={`text-sm font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-700'}`}>{selectedStudent?.name}</p>
                    <p className={`text-xs mt-1 font-bold ${isDarkMode ? 'text-gray-500' : 'text-slate-500'}`}>{rejectingRecord.date} • {Number(rejectingRecord.hours.toFixed(2))}h</p>
                    <p className={`text-xs mt-2 italic font-medium ${isDarkMode ? 'text-gray-400' : 'text-slate-600'}`}>"{rejectingRecord.description}"</p>
                  </div>

                  <div className="space-y-2">
                    <label className={`text-[10px] font-black uppercase tracking-widest ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Motivo del Rechazo (Se enviará por correo)</label>
                    <textarea 
                      className={`w-full p-4 rounded-2xl font-bold outline-none border transition-all text-sm shadow-inner resize-none h-32 ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-rose-400/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-rose-300'}`}
                      placeholder="Explica por qué se rechazan estas horas..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    ></textarea>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => { setRejectingRecord(null); setRejectReason(''); }}
                      className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all ${isDarkMode ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleRejectRecordProfile}
                      disabled={!rejectReason.trim()}
                      className={`flex-1 py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-lg flex items-center justify-center gap-2 ${isDarkMode ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-900/20 disabled:opacity-30' : 'bg-rose-600 text-white hover:bg-rose-700 shadow-rose-200 disabled:opacity-50'}`}
                    >
                      <Send size={16} /> Enviar y Rechazar
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
      {/* MODAL PERFIL USUARIO (ALUMNO) */}
      {showProfileModal && editingProfileForm && (
        <div className={`fixed inset-0 backdrop-blur-3xl flex items-center justify-center p-4 z-[100] overflow-y-auto ${isDarkMode ? 'bg-black/90' : 'bg-slate-900/95'}`}>
          <div className={`rounded-[2.5rem] sm:rounded-[5rem] p-6 sm:p-12 md:p-20 w-full max-w-4xl shadow-2xl my-auto border-t-[8px] sm:border-t-[16px] border-indigo-600 animate-in zoom-in-95 duration-500 relative ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white'}`}>
            <button onClick={() => setShowProfileModal(false)} className={`absolute top-4 right-4 sm:top-10 sm:right-10 p-3 sm:p-6 rounded-full border shadow-inner transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-500 hover:text-red-500' : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-red-500'}`}><X size={24}/></button>
            
            <div className="flex flex-col gap-8 sm:gap-12 items-start w-full">
              <div className="w-full space-y-6 sm:space-y-10">
                <div>
                  <h3 className={`text-3xl sm:text-6xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Mi Perfil</h3>
                  <div className={`font-black uppercase tracking-[0.4em] text-[10px] sm:text-[12px] mt-2 flex items-center gap-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                    <div className={`w-8 sm:w-12 h-1 ${isDarkMode ? 'bg-white/10' : 'bg-indigo-100'}`}></div> {userRole !== 'user' ? 'Información del Administrador' : 'Información del Estudiante'}
                  </div>
                </div>

                {userRole === 'user' && (
                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    <div className={`p-6 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border shadow-inner space-y-4 sm:space-y-6 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                      <h4 className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Estatus Actual</h4>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`w-3 h-3 sm:w-4 sm:h-4 rounded-full animate-pulse shadow-lg ${(STUDENT_STATUS as any)[editingProfileForm.status]?.color || 'bg-yellow-400 shadow-yellow-400/20'}`}></div>
                        <span className={`text-xl sm:text-2xl font-black tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{editingProfileForm.status}</span>
                      </div>
                    </div>

                    <div className={`p-6 sm:p-10 rounded-[2rem] sm:rounded-[3.5rem] border shadow-inner space-y-4 sm:space-y-6 ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-100'}`}>
                      <h4 className={`text-[10px] sm:text-xs font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Proyectos Asignados</h4>
                      <div className="space-y-3 sm:space-y-4">
                        {userProfile.projectIds?.length > 0 ? Array.from(new Set(userProfile.projectIds)).map((pid: string, idx: number) => {
                          const p = projects.find((proj: any) => proj.id === pid);
                          return (
                            <div key={`${pid}-${idx}`} className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl border shadow-sm ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-slate-100'}`}>
                              <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" style={{ backgroundColor: p?.color || '#cbd5e1' }}></div>
                              <span className={`text-[10px] sm:text-xs font-black uppercase truncate ${isDarkMode ? 'text-gray-300' : 'text-slate-700'}`}>{p?.name || pid}</span>
                            </div>
                          );
                        }) : (
                          <p className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-gray-600' : 'text-slate-300'}`}>Ningún proyecto asignado</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="space-y-2 sm:space-y-4">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Nombre(s)</label>
                    <input type="text" className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-900 focus:bg-white'}`} value={editingProfileForm.firstName || ''} onChange={e => setEditingProfileForm({...editingProfileForm, firstName: e.target.value})} />
                  </div>
                  <div className="space-y-2 sm:space-y-4">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Apellido Paterno</label>
                    <input type="text" className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-900 focus:bg-white'}`} value={editingProfileForm.lastNamePaterno || ''} onChange={e => setEditingProfileForm({...editingProfileForm, lastNamePaterno: e.target.value})} />
                  </div>
                  <div className="space-y-2 sm:space-y-4">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Apellido Materno</label>
                    <input type="text" className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-900 focus:bg-white'}`} value={editingProfileForm.lastNameMaterno || ''} onChange={e => setEditingProfileForm({...editingProfileForm, lastNameMaterno: e.target.value})} />
                  </div>
                  <div className="space-y-2 sm:space-y-4">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Correo Electrónico</label>
                    <input type="email" className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-900 focus:bg-white'}`} value={editingProfileForm.email || ''} onChange={e => setEditingProfileForm({...editingProfileForm, email: e.target.value})} />
                  </div>
                  <div className="space-y-2 sm:space-y-4">
                    <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Teléfono</label>
                    <input type="tel" maxLength={10} className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-900 focus:bg-white'}`} value={editingProfileForm.phone || ''} onChange={e => {
                      if (/[^0-9]/.test(e.target.value)) {
                        toast.error("Solo se permiten números en el teléfono", { id: 'phone-error' });
                      }
                      setEditingProfileForm({...editingProfileForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10)});
                    }} />
                  </div>
                  <div className="space-y-2 sm:space-y-4">
                    <label className="text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 text-red-500">SOS (Teléfono de Emergencia)</label>
                    <input type="tel" maxLength={10} className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-red-500/10 border-red-500/20 text-red-400 focus:bg-red-500/20 focus:border-red-500/50' : 'bg-red-50 border-red-100 text-red-900 focus:bg-white focus:border-red-300'}`} value={editingProfileForm.emergencyPhone || ''} onChange={e => {
                      if (/[^0-9]/.test(e.target.value)) {
                        toast.error("Solo se permiten números en el teléfono", { id: 'phone-error' });
                      }
                      setEditingProfileForm({...editingProfileForm, emergencyPhone: e.target.value.replace(/\D/g, '').slice(0, 10)});
                    }} />
                  </div>
                  {userRole === 'user' && (
                    <div className="space-y-2 sm:space-y-4">
                      <label className={`text-[10px] sm:text-[11px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Ciclo de Brigada</label>
                      <input type="text" className={`w-full p-4 sm:p-6 border-2 sm:border-4 rounded-2xl sm:rounded-[2rem] text-lg sm:text-xl font-black outline-none transition-all shadow-inner ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-900 focus:bg-white'}`} placeholder="Ej. 111" value={editingProfileForm.brigadePeriod || ''} onChange={e => setEditingProfileForm({...editingProfileForm, brigadePeriod: e.target.value})} />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-8">
                  <SkillEditor 
                    skillRatings={editingProfileForm.skillRatings || []} 
                    onChange={(newRatings) => setEditingProfileForm({...editingProfileForm, skillRatings: newRatings})} 
                    isDarkMode={isDarkMode}
                  />
                  <ProfileSkillMap 
                    skillRatings={editingProfileForm.skillRatings || []} 
                    isDarkMode={isDarkMode}
                  />
                </div>

                <button 
                  onClick={handleUpdateProfile}
                  className="w-full py-5 bg-[#5A32FA] text-white rounded-full font-black text-lg uppercase tracking-widest shadow-xl hover:bg-[#4A22EA] transition-all active:scale-95"
                >
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL GESTIÓN DE ROL Y JERARQUÍA */}
      {roleModalStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 overflow-y-auto">
          <div className={`rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border ${isDarkMode ? 'bg-[#18181b] border-white/10 text-white' : 'bg-white border-slate-200 text-slate-900'} animate-in zoom-in-95 duration-200`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-black">Gestionar Rol y Jerarquía</h3>
                <p className="text-xs text-slate-400 mt-0.5">{getDisplayName(roleModalStudent)} ({roleModalStudent.email || 'Sin correo'})</p>
              </div>
              <button onClick={() => setRoleModalStudent(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full">
                <X size={20} />
              </button>
            </div>

            <div className="mb-4 p-3 rounded-2xl bg-indigo-50/50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 text-xs text-indigo-700 dark:text-indigo-300">
              <p className="font-bold flex items-center gap-1.5 mb-1">
                <Info size={14} /> Rol Actual: <span className="font-black underline">{ROLE_LABELS[getEffectiveRole(roleModalStudent.email, roleModalStudent.role)]?.label}</span>
              </p>
              <p className="text-[11px] opacity-90">
                Al ascender a Coordinador o Supercoordinador, las horas previas se preservan en su historial y el servicio se marca como concluido sin requerir las 480 horas.
              </p>
            </div>

            <div className="space-y-2 mb-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Seleccionar Nuevo Rol:</label>
              <div className="grid grid-cols-1 gap-2">
                {permissions.getAllowedRolesToAssign().map((roleKey) => {
                  const roleInfo = ROLE_LABELS[roleKey];
                  const isCurrent = getEffectiveRole(roleModalStudent.email, roleModalStudent.role) === roleKey;
                  return (
                    <button
                      key={roleKey}
                      onClick={async () => {
                        const targetId = roleModalStudent.id;
                        setRoleModalStudent(null);
                        await handleRoleChange(targetId, roleKey as UserRole);
                      }}
                      className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                        isCurrent 
                          ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-500/10 ring-2 ring-indigo-500/20' 
                          : isDarkMode ? 'border-white/5 bg-white/5 hover:border-white/20' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-sm">{roleInfo?.label || roleKey}</span>
                          {isCurrent && <span className="px-2 py-0.5 text-[9px] font-black bg-indigo-600 text-white rounded-full">Actual</span>}
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {roleKey === 'super_coordinator' && 'Acceso total a la aplicación • Sin registro de horas • No borrable por otros supercoords'}
                          {roleKey === 'coordinator' && 'Visibilidad de todo • Puede ascender a Alumno Coord. • Sin registro de horas'}
                          {roleKey === 'student_coordinator' && 'Alumno con registro de horas (480h) • Capacidad de aprobar horas'}
                          {roleKey === 'user' && 'Alumno estándar con reloj checador y registro de horas (480h)'}
                        </p>
                      </div>
                      <ChevronRight size={18} className="text-slate-400 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setRoleModalStudent(null)}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALTA/EDICIÓN ALUMNO */}
      {showAddStudent && (
        <div className={`fixed inset-0 backdrop-blur-3xl flex items-center justify-center p-4 z-[100] overflow-y-auto ${isDarkMode ? 'bg-black/90' : 'bg-slate-900/95'}`}>
          <div className={`rounded-[2.5rem] sm:rounded-[5rem] p-6 sm:p-12 md:p-20 w-full max-w-5xl shadow-2xl my-auto border-t-[8px] sm:border-t-[16px] border-indigo-600 animate-in zoom-in-95 duration-500 relative ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white'}`}>
            <button onClick={()=>{setShowAddStudent(false); setStudentFormErrors({});}} className={`absolute top-4 right-4 sm:top-10 sm:right-10 p-3 sm:p-6 rounded-full border shadow-inner transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-500 hover:text-red-500' : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-red-500'}`}><X size={24}/></button>
            <h3 className={`text-3xl sm:text-6xl font-black mb-2 sm:mb-4 tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{showEditStudent ? 'Modificar Perfil' : 'Alta de Prestador'}</h3>
            <div className={`mb-6 sm:mb-12 font-black uppercase tracking-[0.4em] text-[10px] sm:text-[12px] flex items-center gap-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}><div className={`w-8 sm:w-12 h-1 ${isDarkMode ? 'bg-white/10' : 'bg-indigo-100'}`}></div> Gestión Técnica de Expedientes</div>

             {Object.keys(studentFormErrors).length > 0 && (
              <div className="p-4 sm:p-6 mb-6 sm:mb-12 bg-red-50 text-red-700 rounded-2xl sm:rounded-[2rem] border-2 sm:border-4 border-red-200 flex items-center gap-3 sm:gap-5 font-black text-[11px] sm:text-[13px] uppercase animate-bounce shadow-lg">
                <AlertCircle size={24}/> Por favor corrige los errores marcados en rojo
              </div>
            )}
            
            <div className="space-y-8 sm:space-y-12 mb-10 sm:mb-16">
              {/* Sección 1: Información Personal */}
              <div className="space-y-4 sm:space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-6 sm:w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className={`text-xs sm:text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Información Personal</h4>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                  <div className="space-y-2 sm:space-y-3">
                    <label className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Nombre(s)</label>
                    <input type="text" className={`w-full p-4 sm:p-5 border-2 rounded-xl sm:rounded-2xl text-base sm:text-lg font-bold outline-none transition-all shadow-sm ${studentFormErrors.firstName ? 'border-red-500' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500')}`} placeholder="Ej. Mariana" value={studentForm.firstName || ''} onChange={e => setStudentForm({...studentForm, firstName: e.target.value})} />
                    {studentFormErrors.firstName && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.firstName}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Apellido Paterno</label>
                    <input type="text" className={`w-full p-5 border-2 rounded-2xl text-lg font-bold outline-none transition-all shadow-sm ${studentFormErrors.lastNamePaterno ? 'border-red-500' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500')}`} placeholder="Ej. Soler" value={studentForm.lastNamePaterno || ''} onChange={e => setStudentForm({...studentForm, lastNamePaterno: e.target.value})} />
                    {studentFormErrors.lastNamePaterno && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.lastNamePaterno}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Apellido Materno</label>
                    <input type="text" className={`w-full p-5 border-2 rounded-2xl text-lg font-bold outline-none transition-all shadow-sm ${studentFormErrors.lastNameMaterno ? 'border-red-500' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500')}`} placeholder="Ej. Rojas" value={studentForm.lastNameMaterno || ''} onChange={e => setStudentForm({...studentForm, lastNameMaterno: e.target.value})} />
                    {studentFormErrors.lastNameMaterno && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.lastNameMaterno}</p>}
                  </div>
                </div>
              </div>

              {/* Sección 2: Datos Académicos y de Servicio */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Datos Académicos</h4>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Matrícula</label>
                    <input type="text" className={`w-full p-5 border-2 rounded-2xl text-lg font-bold outline-none transition-all shadow-sm ${studentFormErrors.studentId ? 'border-red-500' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500')}`} placeholder="Ej. 315123456" value={studentForm.studentId || ''} onChange={e => setStudentForm({...studentForm, studentId: e.target.value})} />
                    {studentFormErrors.studentId && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.studentId}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Tipo de Servicio</label>
                    <select className={`w-full p-5 border-2 rounded-2xl text-sm font-bold outline-none shadow-sm transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500'}`} value={studentForm.serviceType || ''} onChange={e => setStudentForm({...studentForm, serviceType: e.target.value as 'Prestador' | 'Brigadista'})}>
                      <option value="Prestador">Prestador</option>
                      <option value="Brigadista">Brigadista</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ml-4 flex items-center gap-2 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                      Ciclo Brigada <span className="text-red-500">*</span>
                    </label>
                    <input type="text" placeholder="Ej. 111" maxLength={3} className={`w-full p-5 border-2 rounded-2xl text-lg font-bold outline-none shadow-sm transition-all ${studentFormErrors.brigadePeriod ? 'border-red-500' : (isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500')}`} value={studentForm.brigadePeriod || ''} onChange={e => { const val = e.target.value.replace(/\D/g, '').slice(0, 3); setStudentForm({...studentForm, brigadePeriod: val}); }} />
                    {studentFormErrors.brigadePeriod && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.brigadePeriod}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className={`text-[10px] font-black uppercase tracking-widest block ml-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Nickname</label>
                    <input type="text" className={`w-full p-5 border-2 rounded-2xl text-lg font-bold outline-none transition-all shadow-sm ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:bg-white/10' : 'bg-slate-50 border-slate-100 text-slate-900 focus:bg-white focus:border-indigo-500'}`} placeholder="Opcional" value={studentForm.nickname || ''} onChange={e => setStudentForm({...studentForm, nickname: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-4">Programa Académico</label>
                    <select className="w-full p-5 border-2 border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 shadow-sm transition-all" value={studentForm.career || ''} onChange={e => setStudentForm({...studentForm, career: e.target.value})}>{CAREER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}</select>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-4">Estatus Global</label>
                    <select 
                      className={`w-full p-5 border-2 ${studentFormErrors.status ? 'border-red-500' : 'border-slate-100'} rounded-2xl bg-slate-50 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 shadow-sm transition-all ${userRole === 'user' ? 'opacity-50 cursor-not-allowed' : ''}`} 
                      value={studentForm.status || ''} 
                      onChange={e => setStudentForm({...studentForm, status: e.target.value})}
                      disabled={userRole === 'user'}
                    >
                      {Object.keys(STUDENT_STATUS).map(st => <option key={st} value={st}>{st}</option>)}
                    </select>
                    {studentFormErrors.status && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.status}</p>}
                    {userRole === 'user' && <p className="text-slate-400 text-[9px] font-bold ml-4 uppercase tracking-tighter">* Solo administradores pueden cambiar el estatus</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-4">Carga Trabajo</label>
                    <select className="w-full p-5 border-2 border-slate-100 rounded-2xl bg-slate-50 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 shadow-sm" value={studentForm.workStatus || ''} onChange={e => setStudentForm({...studentForm, workStatus: e.target.value})}>{Object.keys(WORK_STATUS).map(ws => <option key={ws} value={ws}>{ws}</option>)}</select>
                  </div>
                  {permissions.isCoordinator && (
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block ml-4">Rol del Usuario</label>
                      <select 
                        className="w-full p-5 border-2 border-indigo-100 rounded-2xl bg-indigo-50/30 text-sm font-bold outline-none focus:bg-white focus:border-indigo-500 shadow-sm transition-all" 
                        value={studentForm.role || 'user'} 
                        onChange={e => setStudentForm({...studentForm, role: e.target.value})}
                      >
                        {permissions.getAllowedRolesToAssign().map(rKey => (
                          <option key={rKey} value={rKey}>{ROLE_LABELS[rKey]?.label || rKey}</option>
                        ))}
                      </select>
                      <p className="text-slate-400 text-[9px] font-bold ml-4 uppercase tracking-tighter">
                        {permissions.isMaster ? '★ Coordinador Maestro: Facultado para asignar Supercoordinadores y todos los niveles.' :
                         permissions.isSuper ? '★ Supercoordinador: Puedes asignar roles de Coordinador, Alumno Coordinador y Alumno.' :
                         '★ Coordinador: Puedes alternar entre Alumno y Alumno Coordinador.'}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 3: Contacto */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Contacto y Seguridad</h4>
                </div>
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-4">Email</label>
                    <input type="email" placeholder="ejemplo@correo.com" className={`w-full p-5 border-2 ${studentFormErrors.email ? 'border-red-500' : 'border-slate-100'} rounded-2xl bg-slate-50 text-lg font-bold outline-none focus:bg-white focus:border-indigo-500 shadow-sm`} value={studentForm.email || ''} onChange={e => setStudentForm({...studentForm, email: e.target.value})} />
                    {studentFormErrors.email && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.email}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block ml-4">Teléfono Personal</label>
                    <input type="tel" maxLength={10} placeholder="10 dígitos" className={`w-full p-5 border-2 ${studentFormErrors.phone ? 'border-red-500' : 'border-slate-100'} rounded-2xl bg-slate-50 text-lg font-bold outline-none focus:bg-white focus:border-indigo-500 shadow-sm`} value={studentForm.phone || ''} onChange={e => {
                      if (/[^0-9]/.test(e.target.value)) {
                        toast.error("Solo se permiten números en el teléfono", { id: 'phone-error' });
                      }
                      setStudentForm({...studentForm, phone: e.target.value.replace(/\D/g, '').slice(0, 10)});
                    }} />
                    {studentFormErrors.phone && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.phone}</p>}
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-red-500 uppercase tracking-widest block ml-4">SOS (Teléfono de Emergencia)</label>
                    <input type="tel" maxLength={10} placeholder="10 dígitos" className={`w-full p-5 border-2 ${studentFormErrors.emergencyPhone ? 'border-red-500' : 'border-red-100'} rounded-2xl bg-red-50/30 text-lg font-bold outline-none focus:bg-white focus:border-red-500 text-red-900 shadow-sm`} value={studentForm.emergencyPhone || ''} onChange={e => {
                      if (/[^0-9]/.test(e.target.value)) {
                        toast.error("Solo se permiten números en el teléfono", { id: 'phone-error' });
                      }
                      setStudentForm({...studentForm, emergencyPhone: e.target.value.replace(/\D/g, '').slice(0, 10)});
                    }} />
                    {studentFormErrors.emergencyPhone && <p className="text-red-500 text-[10px] font-bold ml-4">{studentFormErrors.emergencyPhone}</p>}
                  </div>
                </div>
              </div>

              {/* Sección 4: Habilidades y Software */}
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Habilidades y Software</h4>
                </div>
                <div className="flex flex-col gap-8">
                  <SkillEditor 
                    skillRatings={studentForm.skillRatings || []} 
                    onChange={(newRatings) => setStudentForm({...studentForm, skillRatings: newRatings})} 
                    isDarkMode={isDarkMode}
                  />
                  <ProfileSkillMap 
                    skillRatings={studentForm.skillRatings || []} 
                    isDarkMode={isDarkMode}
                  />
                </div>
              </div>

              {/* Sección 5: Proyectos */}
              <div className="space-y-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-1 bg-indigo-500 rounded-full"></div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest">Asignación de Proyectos</h4>
                </div>
                
                {(() => {
                  const isCoordFormRole = studentForm.role === 'coordinator' || studentForm.role === 'super_coordinator' || studentForm.role === 'master_coordinator';
                  if (isCoordFormRole) {
                    return (
                      <div className="bg-indigo-50/70 p-6 sm:p-8 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-indigo-100 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-600 flex items-center justify-center shrink-0">
                          <FolderKanban size={22} />
                        </div>
                        <div>
                          <h5 className="font-black text-xs uppercase text-indigo-900 tracking-tight">Acceso Automático a Todos los Proyectos</h5>
                          <p className="text-[10px] text-indigo-700 font-medium">Los coordinadores no requieren enrolamiento manual; tienen acceso inherente a los {projects.length} proyectos activos del sistema.</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className={`bg-slate-50 p-8 rounded-[2.5rem] border-2 ${studentFormErrors.projectIds ? 'border-red-500' : 'border-slate-100'} shadow-inner`}>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-6 ml-2">Selecciona los proyectos activos</label>
                      {studentFormErrors.projectIds && <p className="text-red-500 text-[10px] font-bold mb-4 ml-2">{studentFormErrors.projectIds}</p>}
                      <div className="grid grid-cols-1 gap-4">
                        {projects.map(p => (
                          <label key={p.id} className={`flex flex-col gap-3 p-5 rounded-2xl border-2 transition-all cursor-pointer shadow-sm group ${(studentForm.projectIds || []).includes(p.id) ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/10' : 'bg-white border-transparent hover:border-slate-200'}`}>
                            <div className="flex justify-between items-start">
                              <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></div>
                              <input type="checkbox" className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" checked={(studentForm.projectIds || []).includes(p.id)} onChange={e => {
                                const ids = e.target.checked ? [...(studentForm.projectIds || []), p.id] : (studentForm.projectIds || []).filter(id => id !== p.id);
                                const newWorkStatus = ids.length > 0 ? 'Asignado' : 'Sin asignar';
                                setStudentForm({...studentForm, projectIds: ids, workStatus: newWorkStatus});
                              }} />
                            </div>
                            <span className="text-[11px] font-black uppercase text-slate-700 leading-tight tracking-tight truncate">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-10 mt-10 sm:mt-20">
              <button onClick={() => { setShowAddStudent(false); setStudentFormErrors({}); }} className={`flex-1 px-6 py-4 sm:px-10 sm:py-8 border-4 sm:border-8 rounded-2xl sm:rounded-[3rem] font-black uppercase text-[10px] sm:text-xs shadow-lg transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10' : 'bg-slate-50 border-slate-50 text-slate-300 hover:bg-slate-100'}`}>Cancelar</button>
              <button onClick={handleAddStudent} className={`flex-2 px-6 py-4 sm:px-20 sm:py-8 rounded-2xl sm:rounded-[3rem] font-black uppercase text-[10px] sm:text-xs shadow-2xl active:scale-[0.98] transition-all ${isDarkMode ? 'bg-white text-black hover:bg-gray-200 shadow-white/5' : 'bg-slate-900 text-white hover:bg-black shadow-slate-900/20'}`}>
                {showEditStudent ? (studentForm.status === 'Finalizado' ? 'Certificar y Guardar' : 'Guardar Cambios') : 'Registrar Prestador'}
              </button>
            </div>
          </div>
        </div>
      )}
        {showManualHours && (
          <div className={`fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isDarkMode ? 'bg-black/70' : 'bg-black/50'}`}>
            <div className={`rounded-[2rem] p-6 sm:p-8 max-w-lg w-full shadow-2xl border ${isDarkMode ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Agregar Horas Manuales</h2>
                  <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Asignación directa para alumnos activos</p>
                </div>
                <button 
                  onClick={() => setShowManualHours(false)}
                  className={`p-2 rounded-xl transition-colors ${isDarkMode ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                >
                  <X size={20} />
                </button>
              </div>

              {(() => {
                const effectiveStudentId = manualHoursStudentId || selectedStudentId;
                const targetStudent = getStudentData(effectiveStudentId);
                const isTargetFinished = isStudentFinished(targetStudent);

                return (
                  <div className="space-y-4">
                    {/* Selector y Barra de Búsqueda de Alumno */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className={`block text-[10px] font-black uppercase ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                          Alumno Activo
                        </label>
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                          {filteredActiveStudentsForManualHours.length} disponible{filteredActiveStudentsForManualHours.length === 1 ? '' : 's'}
                        </span>
                      </div>

                      {/* Barra de búsqueda para filtrar alumnos */}
                      <div className="relative mb-2">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                          <Search size={15} className={isDarkMode ? 'text-gray-500' : 'text-slate-400'} />
                        </div>
                        <input
                          type="text"
                          placeholder="Buscar alumno por nombre, matrícula o carrera..."
                          value={manualHoursSearch}
                          onChange={e => setManualHoursSearch(e.target.value)}
                          className={`w-full pl-9 pr-8 py-2.5 rounded-xl border text-xs font-bold outline-none transition-all ${
                            isDarkMode
                              ? 'bg-white/5 border-white/10 text-white placeholder-gray-500 focus:bg-white/10 focus:border-indigo-400'
                              : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400 focus:bg-white focus:border-indigo-500'
                          }`}
                        />
                        {manualHoursSearch && (
                          <button
                            type="button"
                            onClick={() => setManualHoursSearch('')}
                            className={`absolute inset-y-0 right-0 pr-3 flex items-center ${isDarkMode ? 'text-gray-400 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      <select
                        className={`w-full p-3.5 rounded-xl border outline-none transition-all font-bold text-xs ${
                          isDarkMode
                            ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-indigo-400'
                            : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500'
                        }`}
                        value={effectiveStudentId || ''}
                        onChange={e => {
                          setManualHoursStudentId(e.target.value);
                          setSelectedStudentId(e.target.value);
                        }}
                      >
                        <option value="" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>
                          {filteredActiveStudentsForManualHours.length === 0 ? 'Sin alumnos activos disponibles' : 'Seleccionar Alumno...'}
                        </option>
                        {filteredActiveStudentsForManualHours.map((s, idx) => {
                          const approvedHrs = (s.records || []).reduce((acc: number, r: any) => {
                            if (r.validationStatus === 'aprobado' || !r.validationStatus) {
                              return acc + (Number(r.hours) || Number(r.horasCalculadas) || 0);
                            }
                            return acc;
                          }, 0);
                          return (
                            <option key={`${s.id || 'student'}-${idx}`} value={s.id} className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>
                              {s.name || getFullName(s)} {s.studentId ? `(${s.studentId})` : ''} — {s.career || ''} [{Number(approvedHrs.toFixed(1))}/{TOTAL_REQUIRED_HOURS}h]
                            </option>
                          );
                        })}
                      </select>

                      {/* Tarjeta de resumen del alumno seleccionado */}
                      {targetStudent && !isTargetFinished && (
                        <div className={`mt-2.5 p-3 rounded-xl border text-xs flex items-center justify-between ${
                          isDarkMode ? 'bg-white/5 border-white/10 text-gray-300' : 'bg-indigo-50/50 border-indigo-100 text-indigo-950'
                        }`}>
                          <div className="min-w-0 pr-2">
                            <p className="font-black text-xs truncate">{targetStudent.name || getFullName(targetStudent)}</p>
                            <p className={`text-[10px] font-bold ${isDarkMode ? 'text-gray-400' : 'text-slate-500'}`}>
                              {targetStudent.career || 'Prestador'} {targetStudent.studentId ? `• Matrícula: ${targetStudent.studentId}` : ''}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {(() => {
                              const approvedHrs = (targetStudent.records || []).reduce((acc: number, r: any) => {
                                if (r.validationStatus === 'aprobado' || !r.validationStatus) {
                                  return acc + (Number(r.hours) || Number(r.horasCalculadas) || 0);
                                }
                                return acc;
                              }, 0);
                              return (
                                <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                                  isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' : 'bg-white border-indigo-200 text-indigo-700 shadow-sm'
                                }`}>
                                  {Number(approvedHrs.toFixed(1))} / {TOTAL_REQUIRED_HOURS}h
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {targetStudent && isTargetFinished && (
                        <div className="mt-2.5 p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                          <AlertCircle size={16} className="shrink-0" />
                          <span>Este alumno ya finalizó su servicio social. No se le pueden asignar más horas.</span>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className={`block text-[10px] font-black uppercase mb-2 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Fecha</label>
                      <input type="date" max={getCDMXDateString()} className={`w-full p-4 rounded-xl border outline-none transition-all font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500'}`} value={manualHoursForm.date} onChange={e => setManualHoursForm({...manualHoursForm, date: e.target.value})} />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase mb-2 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Horas</label>
                      <input type="number" min="0.5" max="240" step="0.5" className={`w-full p-4 rounded-xl border outline-none transition-all font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500'}`} value={manualHoursForm.hours || ''} onChange={e => setManualHoursForm({...manualHoursForm, hours: parseFloat(e.target.value) || 0})} />
                    </div>
                    <div>
                      <label className={`block text-[10px] font-black uppercase mb-2 ml-1 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>Categoría</label>
                      <select className={`w-full p-4 rounded-xl border outline-none transition-all font-bold ${isDarkMode ? 'bg-white/5 border-white/10 text-white focus:bg-white/10 focus:border-indigo-400' : 'bg-slate-50 border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-500'}`} value={manualHoursForm.category} onChange={e => setManualHoursForm({...manualHoursForm, category: e.target.value})}>
                        <option value="Otra Brigada" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>Otra Brigada</option>
                        <option value="ND en Sistema" className={isDarkMode ? 'bg-[#1a1a1a] text-white' : ''}>ND en Sistema</option>
                      </select>
                    </div>

                    <div className="flex gap-4 mt-8">
                      <button onClick={() => setShowManualHours(false)} className={`flex-1 p-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors ${isDarkMode ? 'bg-white/5 text-gray-500 hover:bg-white/10' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>Cancelar</button>
                      <button 
                        disabled={!effectiveStudentId || isTargetFinished}
                        onClick={async () => {
                          if (!effectiveStudentId) {
                            showErrorToast("Por favor selecciona un alumno.");
                            return;
                          }
                          if (isTargetFinished) {
                            showErrorToast("El alumno ya ha finalizado su servicio social y no se le pueden asignar más horas.");
                            return;
                          }
                          if (manualHoursForm.hours < 0.5) {
                            showErrorToast("El registro mínimo es de media hora");
                            return;
                          }
                          if (manualHoursForm.hours > 240) {
                            showErrorToast("Un registro no puede exceder las 240 horas");
                            return;
                          }
                          const recordId = `${Date.now()}-${effectiveStudentId}`;
                          const sessionData = {
                            id: recordId,
                            userId: effectiveStudentId,
                            projectId: 'p-general',
                            categoryId: manualHoursForm.category === 'Otra Brigada' ? 'cat-otra' : 'cat-nd',
                            description: 'Manual: ' + manualHoursForm.category,
                            date: manualHoursForm.date,
                            startTime: '',
                            endTime: '',
                            horasCalculadas: manualHoursForm.hours,
                            estado: 'aprobado',
                            status: 'A',
                            evidenceLink: '',
                            updatedBy: auth.currentUser?.uid || 'admin',
                            acknowledgedRejection: false
                          };
                          
                          try {
                            await setDoc(doc(db, 'sesiones', recordId), sessionData);
                            setShowManualHours(false);
                            showSuccessToast("Horas manuales agregadas");
                            setManualHoursForm({ hours: 0, category: 'Otra Brigada', date: getCDMXDateString() });
                            setManualHoursSearch('');
                          } catch (error) {
                            handleFirestoreError(error, OperationType.WRITE, `sesiones/${recordId}`);
                          }
                        }} 
                        className={`flex-1 p-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'bg-white text-black hover:bg-gray-200 shadow-white/5' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'}`}
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {showBulkProjectAssign && (
        <div className={`fixed inset-0 backdrop-blur-3xl flex items-center justify-center p-4 z-[100] overflow-y-auto ${isDarkMode ? 'bg-black/90' : 'bg-slate-900/95'}`}>
          <div className={`rounded-[2.5rem] sm:rounded-[4rem] p-6 sm:p-12 md:p-16 w-full max-w-5xl shadow-2xl my-auto border-t-[8px] sm:border-t-[16px] border-indigo-600 animate-in zoom-in-95 duration-500 relative flex flex-col max-h-[90vh] ${isDarkMode ? 'bg-[#1a1a1a] border-white/5' : 'bg-white'}`}>
            <div className="flex justify-between items-center mb-10">
              <div className="space-y-1">
                <h2 className={`text-4xl font-black tracking-tighter ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>Asignación Masiva</h2>
                <div className={`font-black uppercase tracking-[0.4em] text-[10px] flex items-center gap-4 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>
                  <div className={`w-8 h-1 ${isDarkMode ? 'bg-white/10' : 'bg-indigo-100'}`}></div> Automatización de Proyectos
                </div>
              </div>
              <button onClick={() => setShowBulkProjectAssign(false)} className={`p-4 rounded-full border shadow-inner transition-colors ${isDarkMode ? 'bg-white/5 border-white/10 text-gray-500 hover:text-red-500' : 'bg-slate-50 border-slate-100 text-slate-300 hover:text-red-500'}`}>
                <X size={24} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 overflow-y-auto custom-scrollbar flex-1 pr-4">
              <div className="space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-3 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div> 1. Seleccionar Alumnos
                  </h3>
                  <button 
                    onClick={() => {
                      if (selectedStudentsForBulk.length === students.length) {
                        setSelectedStudentsForBulk([]);
                      } else {
                        setSelectedStudentsForBulk(students.map(s => s.id));
                      }
                    }}
                    className={`text-[9px] font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-gray-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}
                  >
                    {selectedStudentsForBulk.length === students.length ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                  </button>
                </div>
                <div className={`border rounded-[2rem] p-4 max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner ${isDarkMode ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div className="grid grid-cols-1 gap-2">
                    {students.map(s => (
                      <label key={s.id} className={`flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${selectedStudentsForBulk.includes(s.id) ? (isDarkMode ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-white border-indigo-200 shadow-sm ring-2 ring-indigo-500/5') : (isDarkMode ? 'bg-transparent border-transparent hover:bg-white/5' : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm hover:border-slate-100')}`}>
                        <div className="pt-1">
                          <input 
                            type="checkbox" 
                            className="w-5 h-5 rounded-lg border-2 border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer transition-all"
                            checked={selectedStudentsForBulk.includes(s.id)}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedStudentsForBulk([...selectedStudentsForBulk, s.id]);
                              else setSelectedStudentsForBulk(selectedStudentsForBulk.filter(id => id !== s.id));
                            }}
                          />
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                          <span className={`text-[11px] font-black uppercase truncate tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{s.name}</span>
                          <span className={`text-[9px] font-bold uppercase tracking-widest mt-0.5 ${isDarkMode ? 'text-gray-500' : 'text-slate-400'}`}>{s.career}</span>
                          {(s.projectIds && s.projectIds.length > 0) && (
                            <div className="flex flex-wrap gap-1.5 mt-2.5">
                              {s.projectIds.map(pid => {
                                const proj = projects.find(pr => pr.id === pid);
                                if (!proj) return null;
                                return (
                                  <span key={pid} className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border ${isDarkMode ? 'border-white/5 bg-white/5' : 'bg-white border-slate-100 shadow-sm'}`} style={{ color: proj.color }}>
                                    <div className="w-1.5 h-1.5 rounded-full shadow-sm" style={{ backgroundColor: proj.color }}></div>
                                    <span className="truncate max-w-[100px]">{proj.name}</span>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className={`text-xs font-black uppercase tracking-widest flex items-center gap-3 px-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> 2. Proyectos a Asignar
                </h3>
                <div className={`border rounded-[2rem] p-4 max-h-[450px] overflow-y-auto custom-scrollbar shadow-inner ${isDarkMode ? 'border-white/5 bg-white/2' : 'border-slate-100 bg-slate-50/50'}`}>
                  <div className="grid grid-cols-1 gap-2">
                    {projects.map(p => (
                      <label key={p.id} className={`flex items-center gap-4 p-5 rounded-2xl cursor-pointer transition-all border ${selectedProjectsForBulk.includes(p.id) ? (isDarkMode ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white border-emerald-200 shadow-sm ring-2 ring-emerald-500/5') : (isDarkMode ? 'bg-transparent border-transparent hover:bg-white/5' : 'bg-transparent border-transparent hover:bg-white hover:shadow-sm hover:border-slate-100')}`}>
                        <input 
                          type="checkbox" 
                          className="w-5 h-5 rounded-lg border-2 border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-all"
                          checked={selectedProjectsForBulk.includes(p.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedProjectsForBulk([...selectedProjectsForBulk, p.id]);
                            else setSelectedProjectsForBulk(selectedProjectsForBulk.filter(id => id !== p.id));
                          }}
                        />
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: p.color }}></div>
                        <span className={`flex-1 text-[11px] font-black uppercase truncate tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>{p.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className={`mt-10 pt-8 border-t flex flex-col sm:flex-row justify-end gap-4 ${isDarkMode ? 'border-white/5' : 'border-slate-100'}`}>
              <button 
                onClick={() => setShowBulkProjectAssign(false)} 
                className={`px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border ${isDarkMode ? 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10' : 'bg-slate-100 border-slate-100 text-slate-400 hover:bg-slate-200'}`}
              >
                Cancelar
              </button>
              <button 
                onClick={handleBulkAssignProjects}
                className={`px-10 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3 ${isDarkMode ? 'bg-white text-black hover:bg-gray-200 shadow-white/5' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-600/20'}`}
              >
                Asignar a {selectedStudentsForBulk.length} Alumnos
              </button>
            </div>
          </div>
        </div>
      )}

      <NotificationCenter 
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        userId={user.uid}
        onNavigate={handleNavigate}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
        deleteNotification={deleteNotification}
        clearAll={clearAll}
        isDarkMode={isDarkMode}
      />
    </ErrorBoundary>
  );
};

export default App;
