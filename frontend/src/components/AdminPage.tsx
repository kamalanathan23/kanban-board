import { useEffect, useState } from 'react';
import { useAppSelector } from '../store/hooks';
import { selectAuthToken } from '../store/authSlice';
import { PERMISSIONS } from '../constants/permissions';
import { hasPermission } from '../auth/rbac';
import { AdminRolesSection } from './AdminRolesSection';
import { AdminUsersTable, type AdminUser } from './AdminUsersTable';
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Shield,
  Settings as SettingsIcon,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from './ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Sheet, SheetContent } from './ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { API_BASE_URL } from '../config/api';

type AdminUserCreate = {
  name: string;
  email: string;
  password: string;
  roleKey: string;
  status: AdminUser['status'];
};

type AdminSection = 'users' | 'roles';

export function AdminPage({
  token,
  onBackToBoard,
  onLogout,
}: {
  token: string;
  onBackToBoard: () => void;
  onLogout: () => void;
}) {
  const storeToken = useAppSelector(selectAuthToken);
  const authTokenForApi = storeToken ?? token;
  const authUser = useAppSelector((s) => s.auth.user);
  const canManageUsers = hasPermission(authUser?.permissions, PERMISSIONS.manage_users);
  const canManageRoles = hasPermission(authUser?.permissions, PERMISSIONS.manage_roles);
  const [activeSection, setActiveSection] = useState<AdminSection>('users');
  const [roleOptions, setRoleOptions] = useState<{ key: string; name: string }[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<AdminUserCreate>({
    name: '',
    email: '',
    password: '',
    roleKey: 'member',
    status: 'active',
  });
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editDraft, setEditDraft] = useState<AdminUser | null>(null);

  const editUser = (user: AdminUser) => {
    const rk = user.roleKey ?? user.role;
    setEditDraft({ ...user, roleKey: rk, role: rk, phone: user.phone ?? '' });
    setEditModalOpen(true);
  };

  const fetchUsers = async () => {
    if (!authTokenForApi?.trim()) {
      toast.error('Failed to load users', { description: 'No session token. Please sign in again.' });
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        headers: { Authorization: `Bearer ${authTokenForApi}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        if (res.status === 401) {
          throw new Error(body.message ?? 'Session invalid or expired. Please sign in again.');
        }
        if (res.status === 403) {
          throw new Error(
            body.message ??
              'Missing manage_users permission. Re-login after your role is updated, or ask an administrator.',
          );
        }
        throw new Error(body.message ?? `Failed to fetch users (${res.status})`);
      }
      const body = (await res.json()) as { users?: AdminUser[] };
      setUsers(Array.isArray(body.users) ? body.users : []);
    } catch (err) {
      toast.error('Failed to load users', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canManageUsers && canManageRoles) {
      setActiveSection('roles');
    }
  }, [canManageUsers, canManageRoles]);

  useEffect(() => {
    if (!canManageUsers) return;
    void (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/role-keys`, {
          headers: { Authorization: `Bearer ${authTokenForApi}` },
        });
        if (!res.ok) return;
        const body = (await res.json()) as { roles?: { key: string; name: string }[] };
        setRoleOptions(Array.isArray(body.roles) ? body.roles : []);
      } catch {
        /* non-fatal */
      }
    })();
  }, [canManageUsers, authTokenForApi]);

  useEffect(() => {
    if (activeSection !== 'users' || !canManageUsers) return;
    void fetchUsers();
  }, [activeSection, canManageUsers, authTokenForApi]);

  const deleteUser = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authTokenForApi}` },
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Failed to delete user (${res.status})`);
      }
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast.success('User deleted');
    } catch (err) {
      toast.error('Delete failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    }
  };

  const openCreateUser = () => {
    setCreateDraft({ name: '', email: '', password: '', roleKey: 'member', status: 'active' });
    setCreateModalOpen(true);
  };

  const createUser = async () => {
    const payload = {
      name: createDraft.name.trim(),
      email: createDraft.email.trim(),
      password: createDraft.password,
      roleKey: createDraft.roleKey,
      status: createDraft.status,
    };

    if (!payload.name || !payload.email || payload.password.length < 6) {
      toast.error('Please fill all fields (password min 6).');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenForApi}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Failed to create user (${res.status})`);
      }

      const body = (await res.json().catch(() => ({}))) as { user?: AdminUser };
      if (body.user) {
        setUsers((prev) => [body.user as AdminUser, ...prev]);
      } else {
        await fetchUsers();
      }
      toast.success('User created');
      setCreateModalOpen(false);
    } catch (err) {
      toast.error('Create user failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setCreating(false);
    }
  };

  const saveEditedUser = async () => {
    if (!editDraft) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(editDraft.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authTokenForApi}`,
        },
        body: JSON.stringify({
          name: editDraft.name,
          email: editDraft.email,
          roleKey: editDraft.roleKey,
          status: editDraft.status,
          phone: editDraft.phone ?? '',
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Failed to update user (${res.status})`);
      }
      const body = (await res.json().catch(() => ({}))) as { user?: AdminUser };
      const updatedUser = body.user ?? editDraft;
      setUsers((prev) => prev.map((u) => (u.id === editDraft.id ? { ...u, ...updatedUser } : u)));
      toast.success('User updated');
      setEditModalOpen(false);
      setEditDraft(null);
    } catch (err) {
      toast.error('User update failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar — sticky so it stays visible while main content scrolls */}
      <aside className="hidden lg:flex w-64 shrink-0 sticky top-0 h-screen self-start z-10 bg-white border-r border-gray-200 flex-col">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="font-medium">Admin Panel</span>
          </div>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2 text-sm">
            {canManageUsers && (
              <li>
                <button
                  type="button"
                  className={`flex w-full items-center space-x-3 px-3 py-2 rounded-md text-left ${
                    activeSection === 'users'
                      ? 'bg-emerald-50 border border-emerald-100 text-primary'
                      : 'hover:bg-gray-50 border border-transparent text-gray-700'
                  }`}
                  onClick={() => setActiveSection('users')}
                >
                  <UserIcon className="w-5 h-5 text-gray-500" />
                  <span className={activeSection === 'users' ? 'font-medium' : ''}>Users</span>
                </button>
              </li>
            )}
            {canManageRoles && (
              <li>
                <button
                  type="button"
                  className={`flex w-full items-center space-x-3 px-3 py-2 rounded-md text-left ${
                    activeSection === 'roles'
                      ? 'bg-emerald-50 border border-emerald-100 text-primary'
                      : 'hover:bg-gray-50 border border-transparent text-gray-700'
                  }`}
                  onClick={() => setActiveSection('roles')}
                >
                  <SettingsIcon className="w-5 h-5 text-gray-500" />
                  <span className={activeSection === 'roles' ? 'font-medium' : ''}>
                    Roles &amp; Permissions
                  </span>
                </button>
              </li>
            )}
          </ul>
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <Button variant="outline" className="w-full justify-start" onClick={onBackToBoard}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Board
          </Button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="h-full flex flex-col bg-white">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <span className="font-medium">Admin Panel</span>
              </div>
            </div>

            <nav className="flex-1 p-4">
              <ul className="space-y-2 text-sm">
                {canManageUsers && (
                  <li>
                    <button
                      type="button"
                      className={`flex w-full items-center space-x-3 px-3 py-2 rounded-md text-left ${
                        activeSection === 'users'
                          ? 'bg-emerald-50 border border-emerald-100 text-primary'
                          : 'hover:bg-gray-50 border border-transparent text-gray-700'
                      }`}
                      onClick={() => {
                        setActiveSection('users');
                        setMobileMenuOpen(false);
                      }}
                    >
                      <UserIcon className="w-5 h-5 text-gray-500" />
                      <span className={activeSection === 'users' ? 'font-medium' : ''}>Users</span>
                    </button>
                  </li>
                )}
                {canManageRoles && (
                  <li>
                    <button
                      type="button"
                      className={`flex w-full items-center space-x-3 px-3 py-2 rounded-md text-left ${
                        activeSection === 'roles'
                          ? 'bg-emerald-50 border border-emerald-100 text-primary'
                          : 'hover:bg-gray-50 border border-transparent text-gray-700'
                      }`}
                      onClick={() => {
                        setActiveSection('roles');
                        setMobileMenuOpen(false);
                      }}
                    >
                      <SettingsIcon className="w-5 h-5 text-gray-500" />
                      <span className={activeSection === 'roles' ? 'font-medium' : ''}>
                        Roles &amp; Permissions
                      </span>
                    </button>
                  </li>
                )}
              </ul>
            </nav>

            <div className="p-4 border-t border-gray-200 space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={onBackToBoard}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Board
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Navigation Bar */}
        <header className="sticky top-0 z-20 shrink-0 bg-white border-b border-gray-200 px-4 lg:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 min-w-0">
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden shrink-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold text-heading truncate">
                {activeSection === 'users'
                  ? 'User Management'
                  : activeSection === 'roles'
                    ? 'Roles & Permissions'
                    : 'Admin Panel'}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <Bell className="w-6 h-6 text-gray-500 cursor-pointer" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <div className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 rounded-md p-1">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback>AD</AvatarFallback>
                    </Avatar>
                    <span className="text-sm hidden sm:block">Admin</span>
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  </div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem>
                    <UserIcon className="w-4 h-4 mr-2" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <SettingsIcon className="w-4 h-4 mr-2" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={onLogout}>
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 lg:p-6">
          {!canManageUsers && !canManageRoles && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
              No admin sections are available for your account.
            </div>
          )}

          {activeSection === 'roles' && canManageRoles && (
            <div className="max-w-full">
              <AdminRolesSection token={authTokenForApi} />
            </div>
          )}

          {activeSection === 'users' && canManageUsers && (
            <AdminUsersTable
              users={users}
              loading={loading}
              roleOptions={roleOptions}
              authToken={authTokenForApi}
              onAddUser={openCreateUser}
              onUsersUpdated={() => void fetchUsers()}
            />
          )}
        </main>
      </div>

      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details, role, and status.</DialogDescription>
          </DialogHeader>
          {editDraft && (
            <div className="space-y-4">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Name</div>
                <Input
                  value={editDraft.name}
                  onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Email</div>
                <Input
                  type="email"
                  value={editDraft.email}
                  onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                />
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Phone</div>
                <Input
                  value={editDraft.phone ?? ''}
                  onChange={(e) => setEditDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="text-sm text-gray-600">Role</div>
                  <Select
                    value={editDraft.roleKey}
                    onValueChange={(v) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, roleKey: v, role: v } : prev,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptions.map((r) => (
                        <SelectItem key={r.key} value={r.key}>
                          {r.name} ({r.key})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-gray-600">Status</div>
                  <Select
                    value={editDraft.status}
                    onValueChange={(v) =>
                      setEditDraft((prev) => (prev ? { ...prev, status: v as AdminUser['status'] } : prev))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">active</SelectItem>
                      <SelectItem value="inactive">inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditModalOpen(false);
                setEditDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void saveEditedUser()} disabled={savingEdit || !editDraft}>
              {savingEdit ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Create a new user account.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Name</div>
              <Input
                value={createDraft.name}
                onChange={(e) => setCreateDraft((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Email</div>
              <Input
                type="email"
                value={createDraft.email}
                onChange={(e) => setCreateDraft((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <div className="text-sm text-gray-600">Password</div>
              <Input
                type="password"
                value={createDraft.password}
                onChange={(e) => setCreateDraft((p) => ({ ...p, password: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Role</div>
                <Select
                  value={createDraft.roleKey}
                  onValueChange={(v) => setCreateDraft((p) => ({ ...p, roleKey: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((r) => (
                      <SelectItem key={r.key} value={r.key}>
                        {r.name} ({r.key})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-gray-600">Status</div>
                <Select
                  value={createDraft.status}
                  onValueChange={(v) => setCreateDraft((p) => ({ ...p, status: v as AdminUser['status'] }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">active</SelectItem>
                    <SelectItem value="inactive">inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createUser()} disabled={creating}>
              {creating ? 'Creating...' : 'Create user'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

