import { useMemo } from 'react';

export type UserRole = 'admin' | 'coordinator' | 'user';

export const usePermissions = (role: UserRole | undefined) => {
  const isAdmin = role === 'admin' || role === 'coordinator';

  return useMemo(() => ({
    isAdmin,
    canCreateTask: true, // Everyone can propose tasks
    canCreateForOthers: isAdmin,
    canApproveTask: isAdmin,
    canRejectTask: isAdmin,
    canDeleteTask: isAdmin,
    canRestoreTask: isAdmin,
    canPermanentDelete: isAdmin,
    canEditTask: isAdmin,
    canEditTaskMeta: isAdmin,
    canChangeStatus: true, // Everyone can change status
    canAddNote: true,
    canEditOwnNote: true,
    canDeleteOwnNote: true,
    canViewDeleted: isAdmin,
    canManageUsers: isAdmin,
    canEditProject: isAdmin,
    canDeleteProject: isAdmin,
  }), [isAdmin]);
};
