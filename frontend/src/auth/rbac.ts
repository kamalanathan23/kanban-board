import { PERMISSIONS, PERMISSION_WILDCARD, type PermissionKey } from '../constants/permissions';

export function hasPermission(permissions: string[] | undefined, key: PermissionKey | string): boolean {
  const list = permissions ?? [];
  if (list.includes(PERMISSION_WILDCARD)) return true;
  return list.includes(key);
}

export function hasAnyPermission(
  permissions: string[] | undefined,
  keys: readonly (PermissionKey | string)[],
): boolean {
  return keys.some((k) => hasPermission(permissions, k));
}

/** Any admin-area capability that should show the admin entry / route. */
export function canAccessAdminArea(permissions: string[] | undefined): boolean {
  return hasAnyPermission(permissions, [
    PERMISSIONS.view_admin_panel,
    PERMISSIONS.manage_users,
    PERMISSIONS.manage_roles,
    PERMISSIONS.manage_settings,
  ]);
}

/** User may persist board changes (matches backend “can write” gate). */
export function canPersistBoard(permissions: string[] | undefined): boolean {
  return hasAnyPermission(permissions, [
    PERMISSIONS.create_task,
    PERMISSIONS.edit_task,
    PERMISSIONS.edit_own_task,
    PERMISSIONS.delete_task,
    PERMISSIONS.move_task,
    PERMISSIONS.manage_columns,
  ]);
}

export function ownsTask(
  userId: string | undefined,
  name: string,
  email: string,
  task: { assignee?: string; createdBy?: string },
): boolean {
  const uid = (task.createdBy || '').trim();
  if (uid && userId && uid === userId) return true;
  const a = (task.assignee || '').trim().toLowerCase();
  if (!a || a === 'unassigned') return false;
  return a === name.trim().toLowerCase() || a === email.trim().toLowerCase();
}

export function canEditTaskBody(
  permissions: string[] | undefined,
  userId: string | undefined,
  name: string,
  email: string,
  task: { assignee?: string; createdBy?: string },
): boolean {
  if (hasPermission(permissions, PERMISSIONS.edit_task)) return true;
  if (hasPermission(permissions, PERMISSIONS.edit_own_task) && ownsTask(userId, name, email, task)) {
    return true;
  }
  return false;
}

export function canMoveTaskOnBoard(permissions: string[] | undefined): boolean {
  return (
    hasPermission(permissions, PERMISSIONS.move_task) ||
    hasPermission(permissions, PERMISSIONS.edit_task)
  );
}

export function canDeleteTaskOnBoard(
  permissions: string[] | undefined,
  userId: string | undefined,
  name: string,
  email: string,
  task: { assignee?: string; createdBy?: string },
): boolean {
  if (!hasPermission(permissions, PERMISSIONS.delete_task)) return false;
  if (hasPermission(permissions, PERMISSIONS.edit_task)) return true;
  return ownsTask(userId, name, email, task);
}

/**
 * Which tasks appear in the board list (search/filter still apply).
 * - Full editors see everything.
 * - edit_own_task (without full edit) sees only own tasks.
 * - View-only users see all tasks (read-only).
 */
export function taskVisibleForUser(
  task: { assignee?: string; createdBy?: string },
  authUser: { id?: string; name: string; email: string } | null | undefined,
  permissions: string[] | undefined,
): boolean {
  if (hasPermission(permissions, PERMISSION_WILDCARD) || hasPermission(permissions, PERMISSIONS.edit_task)) {
    return true;
  }
  if (hasPermission(permissions, PERMISSIONS.edit_own_task)) {
    if (!authUser) return true;
    return ownsTask(authUser.id, authUser.name, authUser.email, task);
  }
  return true;
}
