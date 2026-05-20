/**
 * Mirrors backend `constants/permissions.ts` — use for UI gating only; API still enforces.
 */
export const PERMISSIONS = {
  view_board: 'view_board',
  create_task: 'create_task',
  edit_task: 'edit_task',
  edit_own_task: 'edit_own_task',
  delete_task: 'delete_task',
  move_task: 'move_task',
  manage_columns: 'manage_columns',
  manage_users: 'manage_users',
  manage_roles: 'manage_roles',
  view_admin_panel: 'view_admin_panel',
  manage_settings: 'manage_settings',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_WILDCARD = '*';

export const PERMISSION_GROUPS: {
  id: string;
  label: string;
  keys: PermissionKey[];
}[] = [
  { id: 'board', label: 'Board', keys: [PERMISSIONS.view_board] },
  {
    id: 'tasks',
    label: 'Tasks',
    keys: [
      PERMISSIONS.create_task,
      PERMISSIONS.edit_task,
      PERMISSIONS.edit_own_task,
      PERMISSIONS.delete_task,
      PERMISSIONS.move_task,
    ],
  },
  { id: 'columns', label: 'Columns', keys: [PERMISSIONS.manage_columns] },
  {
    id: 'users',
    label: 'Users',
    keys: [PERMISSIONS.manage_users, PERMISSIONS.view_admin_panel],
  },
  { id: 'roles', label: 'Roles', keys: [PERMISSIONS.manage_roles] },
  { id: 'settings', label: 'Settings', keys: [PERMISSIONS.manage_settings] },
];
