import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Hexagon,
  Lock,
  Pencil,
  Settings,
  X,
} from 'lucide-react';
import { Sheet, SheetClose, SheetContent } from './ui/sheet';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { PERMISSION_GROUPS, PERMISSION_WILDCARD } from '../constants/permissions';
import { API_BASE_URL } from '../config/api';
import type { AdminUser } from './AdminUsersTable';

type CatalogGroup = { id: string; label: string; keys: string[] };

type RoleAccess = {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
};

type PermLevel = 'none' | 'view' | 'edit' | 'manage' | 'owner';

const PERM_LEVELS: PermLevel[] = ['none', 'view', 'edit', 'manage', 'owner'];

const initialsFor = (nameOrEmail: string) => {
  const raw = nameOrEmail.trim();
  if (!raw) return 'U';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
};

const permissionTierForRole = (roleKey: string) => {
  if (roleKey === 'super_admin' || roleKey === 'admin') {
    return { label: 'SUPER USER', className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
  if (roleKey === 'viewer') {
    return { label: 'RESTRICTED', className: 'bg-gray-50 text-gray-600 border-gray-200' };
  }
  return { label: 'STANDARD', className: 'bg-blue-50 text-blue-700 border-blue-100' };
};

const humanizePermissionKey = (key: string) =>
  key
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

function hasPermission(perms: string[], key: string) {
  return perms.includes(PERMISSION_WILDCARD) || perms.includes(key);
}

function getLevelForKey(perms: string[], key: string, levelMap: Record<string, PermLevel>): PermLevel {
  if (!hasPermission(perms, key)) return 'none';
  return levelMap[key] ?? 'view';
}

function applyLevel(
  perms: string[],
  key: string,
  level: PermLevel,
  levelMap: Record<string, PermLevel>,
): { permissions: string[]; levelMap: Record<string, PermLevel> } {
  const nextMap = { ...levelMap, [key]: level };
  let next = perms.filter((p) => p !== PERMISSION_WILDCARD && p !== key);
  if (level !== 'none') {
    next = [...next, key];
  }
  return { permissions: next, levelMap: nextMap };
}

function PermissionLevelButtons({
  value,
  disabled,
  onChange,
}: {
  value: PermLevel;
  disabled: boolean;
  onChange: (level: PermLevel) => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-1">
      {PERM_LEVELS.map((level) => {
        const active = value === level;
        return (
          <button
            key={level}
            type="button"
            disabled={disabled}
            onClick={() => onChange(level)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
              active
                ? 'border-primary bg-emerald-50 text-primary'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}

export function UserPermissionsSheet({
  open,
  user,
  authToken,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: AdminUser | null;
  authToken: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [role, setRole] = useState<RoleAccess | null>(null);
  const [catalog, setCatalog] = useState<CatalogGroup[]>([]);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [levelMap, setLevelMap] = useState<Record<string, PermLevel>>({});
  const [openModules, setOpenModules] = useState<Record<string, boolean>>({});

  const applyAccessPayload = useCallback((loadedRole: RoleAccess | null, groups: CatalogGroup[]) => {
    setRole(loadedRole);
    setCatalog(groups);
    const perms = loadedRole?.permissions ?? [];
    setDraftPermissions([...perms]);
    const initialLevels: Record<string, PermLevel> = {};
    for (const g of groups) {
      for (const k of g.keys) {
        initialLevels[k] = hasPermission(perms, k) ? 'view' : 'none';
      }
    }
    setLevelMap(initialLevels);
    setOpenModules(
      groups.reduce<Record<string, boolean>>((acc, g, i) => {
        acc[g.id] = i === 0;
        return acc;
      }, {}),
    );
  }, []);

  const loadAccess = useCallback(async () => {
    if (!user?.id || !authToken) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/admin/users/${encodeURIComponent(user.id)}/access`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const body = (await res.json()) as {
          role?: RoleAccess | null;
          catalog?: { groups?: CatalogGroup[] };
        };
        const loadedRole = body.role ?? null;
        const groups = Array.isArray(body.catalog?.groups) ? body.catalog!.groups! : PERMISSION_GROUPS;
        applyAccessPayload(loadedRole, groups);
        return;
      }

      if (res.status === 404) {
        const rolesRes = await fetch(`${API_BASE_URL}/admin/roles`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const groups = PERMISSION_GROUPS;
        if (rolesRes.ok) {
          const rolesBody = (await rolesRes.json()) as { roles?: RoleAccess[] };
          const match = (rolesBody.roles ?? []).find((r) => r.key === user.roleKey) ?? null;
          applyAccessPayload(match, groups);
          return;
        }
        applyAccessPayload(null, groups);
        return;
      }

      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `Failed to load access (${res.status})`);
    } catch (err) {
      toast.error('Failed to load permissions', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setLoading(false);
    }
  }, [applyAccessPayload, authToken, user?.id, user?.roleKey]);

  useEffect(() => {
    if (!open || !user) {
      setEditing(false);
      return;
    }
    void loadAccess();
  }, [open, user, loadAccess]);

  const tier = useMemo(
    () => (user ? permissionTierForRole(user.roleKey) : null),
    [user],
  );

  const hasWildcard = draftPermissions.includes(PERMISSION_WILDCARD);

  const startEditing = () => {
    setEditing(true);
  };

  const cancelEditing = () => {
    const perms = role?.permissions ?? [];
    setDraftPermissions([...perms]);
    const resetLevels: Record<string, PermLevel> = {};
    for (const g of catalog) {
      for (const k of g.keys) {
        resetLevels[k] = hasPermission(perms, k) ? 'view' : 'none';
      }
    }
    setLevelMap(resetLevels);
    setEditing(false);
  };

  const applyChanges = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/admin/users/${encodeURIComponent(user.id)}/role-permissions`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ permissions: draftPermissions }),
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(body.message ?? `Failed to save (${res.status})`);
      }
      const body = (await res.json()) as { role?: RoleAccess };
      if (body.role) {
        setRole(body.role);
        setDraftPermissions([...body.role.permissions]);
      }
      setEditing(false);
      toast.success('Permissions updated');
      onSaved?.();
    } catch (err) {
      toast.error('Save failed', {
        description: String((err as Error | undefined)?.message ?? err),
      });
    } finally {
      setSaving(false);
    }
  };

  const setLevel = (key: string, level: PermLevel) => {
    const result = applyLevel(draftPermissions, key, level, levelMap);
    setDraftPermissions(result.permissions);
    setLevelMap(result.levelMap);
  };

  if (!user) return null;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="right"
        showClose={false}
        className="flex h-full w-full flex-col gap-0 border-l border-gray-200 p-0 sm:max-w-[min(48rem,92vw)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 px-6 py-5">
          <div className="flex gap-4 min-w-0">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-2xl font-semibold text-primary">
              {initialsFor(user.name || user.email)}
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="text-xl font-bold text-gray-900 truncate">{user.name}</h2>
              <p className="flex items-center gap-1.5 text-sm text-gray-500">
                <Hexagon className="h-3.5 w-3.5 shrink-0" />
                Role: {user.roleKey}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Badge
                  variant="outline"
                  className={
                    user.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100 uppercase text-[10px]'
                      : 'uppercase text-[10px]'
                  }
                >
                  {user.status}
                </Badge>
                {tier && (
                  <Badge variant="outline" className={`uppercase text-[10px] ${tier.className}`}>
                    {tier.label}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {editing ? (
              <>
                <Button type="button" variant="outline" onClick={cancelEditing} disabled={saving}>
                  Cancel
                </Button>
                <Button type="button" onClick={() => void applyChanges()} disabled={saving}>
                  <Check className="h-4 w-4 mr-1" />
                  {saving ? 'Saving...' : 'Apply Changes'}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" onClick={startEditing} disabled={loading || !role}>
                <Pencil className="h-4 w-4 mr-1" />
                Edit Permissions
              </Button>
            )}
            <SheetClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-gray-500 hover:text-gray-900"
                aria-label="Close panel"
              >
                <X className="h-5 w-5" />
              </Button>
            </SheetClose>
          </div>
        </div>

        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Module level access
          </p>
          <button type="button" className="text-xs text-primary hover:underline">
            Manage feature-level permissions
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {loading ? (
            <p className="text-sm text-gray-500 py-8 text-center">Loading permissions...</p>
          ) : hasWildcard ? (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-emerald-800">
              This role has full access (wildcard). Individual feature toggles are disabled.
            </div>
          ) : (
            catalog.map((group) => {
              const isOpen = openModules[group.id] ?? false;
              return (
                <Collapsible
                  key={group.id}
                  open={isOpen}
                  onOpenChange={(next) =>
                    setOpenModules((prev) => ({ ...prev, [group.id]: next }))
                  }
                >
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Settings className="h-4 w-4 text-gray-400 shrink-0" />
                          <span className="font-semibold text-gray-900">{group.label}</span>
                          <span className="text-xs text-gray-400 uppercase tracking-wide">
                            {group.keys.length} features
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
                      <div className="border-t border-gray-100 divide-y divide-gray-100">
                        {group.keys.map((key) => (
                          <div
                            key={key}
                            className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <span className="text-sm text-gray-700">{humanizePermissionKey(key)}</span>
                            {editing ? (
                              <PermissionLevelButtons
                                value={getLevelForKey(draftPermissions, key, levelMap)}
                                disabled={false}
                                onChange={(level) => setLevel(key, level)}
                              />
                            ) : (
                              <span className="inline-flex rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold uppercase text-gray-500">
                                {getLevelForKey(draftPermissions, key, levelMap)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50/80 px-6 py-3 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5" />
            Permissions apply to all users with role &quot;{role?.name ?? user.roleKey}&quot;
          </span>
          <span>Last sync: {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
