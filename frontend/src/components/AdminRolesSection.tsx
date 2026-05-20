import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Search,
  Settings,
  Shield,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { Checkbox } from './ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { PERMISSION_GROUPS, PERMISSION_WILDCARD } from '../constants/permissions';
import { API_BASE_URL } from '../config/api';

type CatalogGroup = { id: string; label: string; keys: string[] };

type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: string[];
  isActive: boolean;
  isSystem: boolean;
};

function togglePerm(list: string[], key: string, checked: boolean): string[] {
  if (key === PERMISSION_WILDCARD) {
    return checked ? [PERMISSION_WILDCARD] : [];
  }
  const without = list.filter((p) => p !== PERMISSION_WILDCARD && p !== key);
  if (checked) return [...without, key];
  return without;
}

const humanizePermissionKey = (key: string) =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

const roleInitials = (name: string, key: string) => {
  const fromName = name.trim();
  if (fromName.length >= 2) return fromName.slice(0, 2).toUpperCase();
  return key.slice(0, 2).toUpperCase();
};

function permissionModuleSummary(
  permissions: string[],
  groups: CatalogGroup[],
): { label: string; granted: number; total: number }[] {
  if (permissions.includes(PERMISSION_WILDCARD)) return [];
  return groups
    .map((g) => ({
      label: g.label,
      granted: g.keys.filter((k) => permissions.includes(k)).length,
      total: g.keys.length,
    }))
    .filter((g) => g.granted > 0);
}

export function AdminRolesSection({ token }: { token: string }) {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [catalog, setCatalog] = useState<{ groups: CatalogGroup[]; keys: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<RoleRow | null>(null);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<{
    id?: string;
    key: string;
    name: string;
    description: string;
    permissions: string[];
    isActive: boolean;
    isSystem?: boolean;
  }>({ key: '', name: '', description: '', permissions: [], isActive: true });

  const groups = catalog?.groups ?? PERMISSION_GROUPS;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API_BASE_URL}/admin/roles`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_BASE_URL}/admin/permission-catalog`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!r1.ok) {
        const b = (await r1.json().catch(() => ({}))) as { message?: string };
        throw new Error(b.message ?? `Failed to load roles (${r1.status})`);
      }
      if (!r2.ok) {
        const b = (await r2.json().catch(() => ({}))) as { message?: string };
        throw new Error(b.message ?? `Failed to load catalog (${r2.status})`);
      }
      const body1 = (await r1.json()) as { roles?: RoleRow[] };
      const body2 = (await r2.json()) as { groups?: CatalogGroup[]; keys?: string[] };
      setRoles(Array.isArray(body1.roles) ? body1.roles : []);
      setCatalog({
        groups: Array.isArray(body2.groups) ? body2.groups : [],
        keys: Array.isArray(body2.keys) ? body2.keys : [],
      });
    } catch (err) {
      toast.error('Failed to load roles', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRoles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q),
    );
  }, [roles, search]);

  const hasWildcard = useMemo(() => draft.permissions.includes(PERMISSION_WILDCARD), [draft.permissions]);

  const resetOpenModules = useCallback(() => {
    setOpenModules(
      groups.reduce<Record<string, boolean>>((acc, g, i) => {
        acc[g.id] = i === 0;
        return acc;
      }, {}),
    );
  }, [groups]);

  const openCreate = () => {
    setDraft({ key: '', name: '', description: '', permissions: [], isActive: true });
    resetOpenModules();
    setCreateOpen(true);
  };

  const openEdit = (role: RoleRow) => {
    setDraft({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
      isActive: role.isActive,
      isSystem: role.isSystem,
    });
    resetOpenModules();
    setEditOpen(true);
  };

  const saveCreate = async () => {
    const key = draft.key.trim();
    const name = draft.name.trim();
    if (!key || !name) {
      toast.error('Key and name are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          name,
          description: draft.description.trim(),
          permissions: draft.permissions,
          isActive: draft.isActive,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(b.message ?? `Create failed (${res.status})`);
      }
      toast.success('Role created');
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error('Create role failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!draft.id) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/roles/${encodeURIComponent(draft.id)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: draft.name.trim(),
          description: draft.description.trim(),
          permissions: draft.permissions,
          isActive: draft.isActive,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(b.message ?? `Update failed (${res.status})`);
      }
      toast.success('Role saved');
      setEditOpen(false);
      await load();
    } catch (err) {
      toast.error('Save failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteRole = async () => {
    const role = roleToDelete;
    if (!role) return;
    if (role.isSystem) {
      toast.error('System roles cannot be deleted.');
      setRoleToDelete(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/admin/roles/${encodeURIComponent(role.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(b.message ?? `Delete failed (${res.status})`);
      }
      toast.success('Role deleted');
      setRoleToDelete(null);
      await load();
    } catch (err) {
      toast.error('Delete failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    }
  };

  const renderPermissionEditor = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-4 py-3">
        <Checkbox
          id="perm-wildcard"
          checked={hasWildcard}
          onCheckedChange={(c) => {
            const checked = c === true;
            setDraft((d) => ({
              ...d,
              permissions: checked ? [PERMISSION_WILDCARD] : [],
            }));
          }}
        />
        <label htmlFor="perm-wildcard" className="text-sm font-medium text-gray-900 cursor-pointer">
          Full access — grant all permissions
        </label>
      </div>

      {!hasWildcard && (
        <div className="space-y-2">
          {groups.map((g) => {
            const granted = g.keys.filter((k) => draft.permissions.includes(k)).length;
            const isOpen = openModules[g.id] ?? false;
            return (
              <Collapsible
                key={g.id}
                open={isOpen}
                onOpenChange={(next) => setOpenModules((prev) => ({ ...prev, [g.id]: next }))}
              >
                <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Settings className="h-4 w-4 text-gray-400 shrink-0" />
                        <span className="font-semibold text-gray-900">{g.label}</span>
                        <span className="text-xs text-gray-400 uppercase tracking-wide">
                          {granted}/{g.keys.length} enabled
                        </span>
                      </div>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="border-t border-gray-100 divide-y divide-gray-100 px-4 py-2">
                      {g.keys.map((key) => (
                        <div key={key} className="flex items-center gap-3 py-2.5">
                          <Checkbox
                            id={`perm-${g.id}-${key}`}
                            checked={draft.permissions.includes(key)}
                            onCheckedChange={(c) =>
                              setDraft((d) => ({
                                ...d,
                                permissions: togglePerm(d.permissions, key, c === true),
                              }))
                            }
                          />
                          <label
                            htmlFor={`perm-${g.id}-${key}`}
                            className="text-sm text-gray-700 cursor-pointer flex-1"
                          >
                            {humanizePermissionKey(key)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );

  const roleDialogOpen = createOpen || editOpen;
  const closeRoleDialog = () => {
    setCreateOpen(false);
    setEditOpen(false);
  };

  return (
    <div className="max-w-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search by role name or key..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus className="w-4 h-4 mr-2" />
            Create Role
          </Button>
        </div>

        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 hover:bg-transparent">
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Role
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Description
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Permissions
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </TableHead>
                <TableHead className="w-12 px-4 py-4" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Loading roles...
                  </TableCell>
                </TableRow>
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No roles found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((r) => {
                  const modules = permissionModuleSummary(r.permissions, groups);
                  const isFullAccess = r.permissions.includes(PERMISSION_WILDCARD);
                  return (
                    <TableRow
                      key={r.id}
                      className="border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                      onClick={() => openEdit(r)}
                    >
                      <TableCell className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                            {roleInitials(r.name, r.key)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                            <p className="text-xs text-gray-500 font-mono truncate">{r.key}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5 text-sm text-gray-600 max-w-xs">
                        <p className="line-clamp-2">
                          {r.description?.trim() || '—'}
                        </p>
                      </TableCell>
                      <TableCell className="px-6 py-5 max-w-md">
                        {isFullAccess ? (
                          <Badge
                            variant="outline"
                            className="bg-emerald-50 text-emerald-700 border-emerald-100 uppercase text-[10px] font-semibold"
                          >
                            Full access
                          </Badge>
                        ) : modules.length === 0 ? (
                          <span className="text-sm text-gray-400">No permissions</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {modules.map((m) => (
                              <Badge
                                key={m.label}
                                variant="secondary"
                                className="text-xs font-normal bg-gray-50 text-gray-700 border border-gray-200"
                              >
                                {m.label}{' '}
                                <span className="text-gray-400">
                                  {m.granted}/{m.total}
                                </span>
                              </Badge>
                            ))}
                            {r.permissions.length > 0 && (
                              <Badge variant="outline" className="text-xs text-gray-500">
                                {r.permissions.length} total
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              r.isActive
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100 uppercase text-[10px]'
                                : 'uppercase text-[10px] text-gray-500'
                            }
                          >
                            {r.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          {r.isSystem && (
                            <Badge
                              variant="outline"
                              className="bg-blue-50 text-blue-700 border-blue-100 uppercase text-[10px]"
                            >
                              System
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-5">
                        {!r.isSystem ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-gray-400 hover:text-red-600"
                            aria-label={`Delete ${r.name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRoleToDelete(r);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="lg:hidden divide-y divide-gray-100">
          {loading ? (
            <div className="p-6 text-sm text-gray-500 text-center">Loading roles...</div>
          ) : filteredRoles.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">No roles found.</div>
          ) : (
            filteredRoles.map((r) => {
              const modules = permissionModuleSummary(r.permissions, groups);
              const isFullAccess = r.permissions.includes(PERMISSION_WILDCARD);
              return (
                <div
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  className="p-4 space-y-3 cursor-pointer hover:bg-gray-50/80"
                  onClick={() => openEdit(r)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openEdit(r);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                        {roleInitials(r.name, r.key)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{r.name}</p>
                        <p className="text-xs text-gray-500 font-mono">{r.key}</p>
                      </div>
                    </div>
                    {!r.isSystem && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label={`Delete ${r.name}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setRoleToDelete(r);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">{r.description?.trim() || 'No description'}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {isFullAccess ? (
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 text-xs">
                        Full access
                      </Badge>
                    ) : (
                      modules.map((m) => (
                        <Badge key={m.label} variant="secondary" className="text-xs">
                          {m.label} {m.granted}/{m.total}
                        </Badge>
                      ))
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-gray-200 px-6 py-4">
          <p className="text-sm text-gray-500">
            {filteredRoles.length === 0
              ? 'Showing 0 roles'
              : `Showing ${filteredRoles.length} of ${roles.length} roles`}
          </p>
        </div>
      </div>

      <Dialog open={roleDialogOpen} onOpenChange={(open) => !open && closeRoleDialog()}>
        <DialogContent className="flex flex-col gap-0 w-[min(56rem,95vw)] max-w-[56rem] h-[min(88vh,920px)] max-h-[88vh] p-0 overflow-hidden sm:max-w-[56rem]">
          <DialogHeader className="shrink-0 border-b border-gray-100 px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              {createOpen ? 'Create role' : 'Edit role'}
            </DialogTitle>
            <DialogDescription>
              {createOpen
                ? 'Define a unique key and assign module permissions.'
                : `Role key: ${draft.key}${draft.isSystem ? ' · System role' : ''}`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            {createOpen && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Key</label>
                  <Input
                    value={draft.key}
                    onChange={(e) => setDraft((d) => ({ ...d, key: e.target.value }))}
                    placeholder="e.g. custom_role"
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Display name</label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    placeholder="Role name"
                  />
                </div>
              </div>
            )}
            {!createOpen && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Display name</label>
                <Input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Description</label>
              <Input
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Optional description"
              />
            </div>
            {!createOpen && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="role-active"
                  checked={draft.isActive}
                  onCheckedChange={(c) => setDraft((d) => ({ ...d, isActive: c === true }))}
                />
                <label htmlFor="role-active" className="text-sm text-gray-700 cursor-pointer">
                  Role is active
                </label>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Module permissions
              </p>
              {renderPermissionEditor()}
            </div>
          </div>
          <DialogFooter className="shrink-0 gap-3 border-t border-gray-100 px-6 py-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={closeRoleDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void (createOpen ? saveCreate() : saveEdit())}
              disabled={saving}
            >
              {saving ? 'Saving...' : createOpen ? 'Create role' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!roleToDelete} onOpenChange={(open) => !open && setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role?</AlertDialogTitle>
            <AlertDialogDescription>
              {roleToDelete
                ? `This will permanently delete the role "${roleToDelete.name}" (${roleToDelete.key}). Users assigned to this role may lose access.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => void confirmDeleteRole()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
