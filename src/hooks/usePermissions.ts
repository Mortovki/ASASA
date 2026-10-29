import { useMemo } from 'react';

export type UserRole = 'master_coordinator' | 'super_coordinator' | 'coordinator' | 'student_coordinator' | 'user' | 'admin';

export const MASTER_COORDINATOR_EMAIL = "luisedgar.gutierrez17@gmail.com";
export const SUPER_ADMIN_EMAILS = [
  "luisedgar.gutierrez17@gmail.com",
  "luisedgar.gutierrez1@gmail.com",
  "mortovki@gmail.com",
  "apoyo.comunitario.ss@fa.unam.mx"
];

export const getEffectiveRole = (email?: string | null, rawRole?: string | null): UserRole => {
  if (email && email.toLowerCase() === MASTER_COORDINATOR_EMAIL.toLowerCase()) {
    return 'master_coordinator';
  }
  const normalized = (rawRole || 'user').toLowerCase().trim();
  if (normalized === 'master_coordinator') return 'master_coordinator';
  if (normalized === 'super_coordinator' || normalized === 'admin' || (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase()))) {
    return 'super_coordinator';
  }
  if (normalized === 'coordinator' || normalized === 'coordinador') return 'coordinator';
  if (normalized === 'student_coordinator' || normalized === 'alumno_coordinador') return 'student_coordinator';
  return 'user';
};

export const ROLE_LABELS: Record<string, { label: string, shortLabel: string, color: string, badgeBg: string }> = {
  'master_coordinator': {
    label: 'Coordinador Maestro',
    shortLabel: 'Maestro',
    color: '#7c3aed',
    badgeBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  },
  'super_coordinator': {
    label: 'Supercoordinador',
    shortLabel: 'Supercoord.',
    color: '#2563eb',
    badgeBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  },
  'coordinator': {
    label: 'Coordinador',
    shortLabel: 'Coord.',
    color: '#059669',
    badgeBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  },
  'student_coordinator': {
    label: 'Alumno Coordinador',
    shortLabel: 'Alum. Coord.',
    color: '#d97706',
    badgeBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
  },
  'user': {
    label: 'Alumno',
    shortLabel: 'Alumno',
    color: '#6366f1',
    badgeBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20'
  }
};

export const usePermissions = (role: UserRole | string | undefined, userEmail?: string | null) => {
  const effectiveRole = getEffectiveRole(userEmail, role);
  
  const isMaster = effectiveRole === 'master_coordinator';
  const isSuper = isMaster || effectiveRole === 'super_coordinator';
  const isCoordinator = isSuper || effectiveRole === 'coordinator';
  const isStudentCoordinator = effectiveRole === 'student_coordinator';
  const isAdmin = isCoordinator; // Legacy flag for admin-level access in components

  return useMemo(() => ({
    effectiveRole,
    isMaster,
    isSuper,
    isCoordinator,
    isStudentCoordinator,
    isAdmin,
    
    // Core capabilities
    canValidateHours: isCoordinator || isStudentCoordinator,
    canManageProjects: isCoordinator,
    canManageTasks: isCoordinator,
    canCreateTasksForOthers: isCoordinator || isStudentCoordinator,
    hasHoursTracker: !isCoordinator, // Only 'user' and 'student_coordinator' have mandatory hours tracker
    
    // Role assignment hierarchy
    canPromoteToStudentCoordinator: isCoordinator, // Coordinators and above can promote to Student Coordinator
    canPromoteToCoordinator: isSuper, // Supercoordinators and Master can promote to Coordinator
    canPromoteToSuperCoordinator: isMaster, // Only Master Coordinator can create/promote Supercoordinators
    
    // Allowed roles that this actor can assign to a user
    getAllowedRolesToAssign: () => {
      if (isMaster) {
        return ['user', 'student_coordinator', 'coordinator', 'super_coordinator'];
      }
      if (isSuper) {
        return ['user', 'student_coordinator', 'coordinator'];
      }
      if (isCoordinator) {
        return ['user', 'student_coordinator'];
      }
      return [];
    },

    // Deletion permissions
    canDeleteUser: (targetUser: { email?: string, role?: string } | null | undefined): boolean => {
      if (!targetUser) return false;
      const targetEmail = (targetUser.email || '').toLowerCase().trim();
      // Master Coordinator CANNOT be deleted by ANYONE
      if (targetEmail === MASTER_COORDINATOR_EMAIL.toLowerCase()) return false;
      
      const targetRole = getEffectiveRole(targetUser.email, targetUser.role);
      // Supercoordinators CANNOT delete other Supercoordinators (only Master can)
      if (targetRole === 'super_coordinator' && !isMaster) return false;
      if (targetRole === 'master_coordinator') return false;
      
      return isSuper;
    },

    // Task and project permissions
    canCreateTask: true,
    canCreateForOthers: isCoordinator || isStudentCoordinator,
    canApproveTask: isCoordinator || isStudentCoordinator,
    canRejectTask: isCoordinator || isStudentCoordinator,
    canDeleteTask: isCoordinator,
    canRestoreTask: isCoordinator,
    canPermanentDelete: isSuper,
    canEditTask: isCoordinator || isStudentCoordinator,
    canEditTaskMeta: isCoordinator,
    canChangeStatus: true,
    canAddNote: true,
    canEditOwnNote: true,
    canDeleteOwnNote: true,
    canViewDeleted: isCoordinator,
    canManageUsers: isCoordinator,
    canEditProject: isCoordinator,
    canDeleteProject: isSuper,
  }), [effectiveRole, isMaster, isSuper, isCoordinator, isStudentCoordinator, isAdmin]);
};
