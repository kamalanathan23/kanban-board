import { RoleModel } from '../models/Role';
import { UserModel } from '../models/User';
import { PERMISSIONS, PERMISSION_WILDCARD } from '../constants/permissions';

const DEFAULT_ROLES: Array<{
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}> = [
  {
    key: 'super_admin',
    name: 'Super Admin',
    description: 'Full access including role management.',
    permissions: [PERMISSION_WILDCARD],
    isSystem: true,
  },
  {
    key: 'admin',
    name: 'Admin',
    description: 'Manage users and most settings; full board access.',
    permissions: [
      PERMISSIONS.view_board,
      PERMISSIONS.create_task,
      PERMISSIONS.edit_task,
      PERMISSIONS.edit_own_task,
      PERMISSIONS.delete_task,
      PERMISSIONS.move_task,
      PERMISSIONS.manage_columns,
      PERMISSIONS.manage_users,
      PERMISSIONS.manage_roles,
      PERMISSIONS.view_admin_panel,
      PERMISSIONS.manage_settings,
    ],
    isSystem: true,
  },
  {
    key: 'manager',
    name: 'Manager',
    description: 'Team lead: full board and columns; admin panel without full user management.',
    permissions: [
      PERMISSIONS.view_board,
      PERMISSIONS.create_task,
      PERMISSIONS.edit_task,
      PERMISSIONS.edit_own_task,
      PERMISSIONS.delete_task,
      PERMISSIONS.move_task,
      PERMISSIONS.manage_columns,
      PERMISSIONS.view_admin_panel,
    ],
    isSystem: true,
  },
  {
    key: 'member',
    name: 'Member',
    description: 'Standard contributor: create and manage own tasks.',
    permissions: [
      PERMISSIONS.view_board,
      PERMISSIONS.create_task,
      PERMISSIONS.edit_own_task,
      PERMISSIONS.move_task,
      PERMISSIONS.delete_task,
    ],
    isSystem: true,
  },
  {
    key: 'viewer',
    name: 'Viewer',
    description: 'Read-only board access.',
    permissions: [PERMISSIONS.view_board],
    isSystem: true,
  },
];

/**
 * Insert default roles only when missing (by key). Does not overwrite custom permission edits.
 */
export async function seedDefaultRoles(): Promise<void> {
  for (const r of DEFAULT_ROLES) {
    const exists = await RoleModel.findOne({ key: r.key }).lean();
    if (exists) continue;
    await RoleModel.create({
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions,
      isActive: true,
      isSystem: r.isSystem,
    });
  }

  await RoleModel.updateOne(
    { key: 'super_admin', permissions: { $ne: PERMISSION_WILDCARD } },
    { $set: { permissions: [PERMISSION_WILDCARD] } },
  ).catch(() => undefined);
}

/**
 * Migrate legacy `role` enum to roleKey for existing users.
 */
export async function migrateUserRoleKeys(): Promise<void> {
  /** Legacy admin flag with schema default roleKey=member (e.g. old seedAdmin). */
  await UserModel.updateMany({ role: 'admin', roleKey: 'member' }, { $set: { roleKey: 'admin' } });

  const users = await UserModel.find({
    $or: [{ roleKey: { $exists: false } }, { roleKey: null }, { roleKey: '' }],
  })
    .select({ role: 1 })
    .lean();

  for (const u of users) {
    const rk = (u as { role?: string }).role === 'admin' ? 'admin' : 'member';
    await UserModel.updateOne({ _id: (u as { _id: unknown })._id }, { $set: { roleKey: rk } });
  }
}
