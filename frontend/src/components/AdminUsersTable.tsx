import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Filter as FilterIcon,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { UserPermissionsSheet } from './UserPermissionsSheet';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  roleKey: string;
  role: string;
  status: 'active' | 'inactive';
  lastLoginAt?: string | null;
};

const USERS_PAGE_SIZE = 20;

const initialsFor = (nameOrEmail: string) => {
  const raw = nameOrEmail.trim();
  if (!raw) return 'U';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`.toUpperCase();
  return raw.slice(0, 2).toUpperCase();
};

const departmentForRole = (roleKey: string) => {
  const map: Record<string, string> = {
    super_admin: 'Executive Operations',
    admin: 'IT Administration',
    manager: 'Revenue Growth',
    member: 'Product Engineering',
    viewer: 'Finance & Legal',
  };
  return map[roleKey] ?? 'General';
};

const permissionTierForRole = (roleKey: string) => {
  if (roleKey === 'super_admin' || roleKey === 'admin') {
    return { label: 'Super User', className: 'bg-gray-50 text-gray-700 border-gray-200' };
  }
  if (roleKey === 'viewer') {
    return { label: 'Restricted', className: 'bg-gray-50 text-gray-600 border-gray-200' };
  }
  return { label: 'Standard', className: 'bg-gray-50 text-gray-700 border-gray-200' };
};

const roleDisplayName = (roleKey: string, roleOptions: { key: string; name: string }[]) => {
  const found = roleOptions.find((r) => r.key === roleKey);
  if (found) return found.name;
  return roleKey.charAt(0).toUpperCase() + roleKey.slice(1).replace(/_/g, ' ');
};

const formatLastSync = (lastLoginAt?: string | null) => {
  if (!lastLoginAt) return 'Never';
  const date = new Date(lastLoginAt);
  if (Number.isNaN(date.getTime())) return 'Never';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
};

export function AdminUsersTable({
  users,
  loading,
  roleOptions,
  authToken,
  onAddUser,
  onUsersUpdated,
}: {
  users: AdminUser[];
  loading: boolean;
  roleOptions: { key: string; name: string }[];
  authToken: string;
  onAddUser: () => void;
  onUsersUpdated?: () => void;
}) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [usersPage, setUsersPage] = useState(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase();
      const roleName = roleDisplayName(u.roleKey, roleOptions).toLowerCase();
      const matchesSearch =
        q === '' ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.phone ?? '').toLowerCase().includes(q) ||
        u.roleKey.toLowerCase().includes(q) ||
        roleName.includes(q);
      const matchesRole = roleFilter === 'all' || u.roleKey === roleFilter;
      const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter, roleOptions]);

  const totalFilteredUsers = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredUsers / USERS_PAGE_SIZE));

  const paginatedUsers = useMemo(() => {
    const start = (usersPage - 1) * USERS_PAGE_SIZE;
    return filteredUsers.slice(start, start + USERS_PAGE_SIZE);
  }, [filteredUsers, usersPage]);

  const paginationStart = totalFilteredUsers === 0 ? 0 : (usersPage - 1) * USERS_PAGE_SIZE + 1;
  const paginationEnd = Math.min(usersPage * USERS_PAGE_SIZE, totalFilteredUsers);

  const hasActiveFilters = roleFilter !== 'all' || statusFilter !== 'all';

  useEffect(() => {
    setUsersPage(1);
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    if (usersPage > totalPages) setUsersPage(totalPages);
  }, [usersPage, totalPages]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = new Set<number>([1, totalPages, usersPage]);
    if (usersPage > 1) pages.add(usersPage - 1);
    if (usersPage < totalPages) pages.add(usersPage + 1);
    if (usersPage > 2) pages.add(usersPage - 2);
    if (usersPage < totalPages - 1) pages.add(usersPage + 2);
    return Array.from(pages).sort((a, b) => a - b);
  }, [totalPages, usersPage]);

  const openUserSheet = (user: AdminUser) => {
    setSelectedUser(user);
  };

  return (
    <div className="max-w-full">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search by name or role.."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className={hasActiveFilters ? 'border-primary text-primary' : ''}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <FilterIcon className="w-4 h-4 mr-2" />
              Filter List
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-white">
                  !
                </span>
              )}
            </Button>
            <Button type="button" onClick={onAddUser}>
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        {filterOpen && (
          <div className="flex flex-col gap-4 border-b border-gray-200 bg-gray-50/80 px-4 py-4 sm:flex-row sm:items-end sm:px-6">
            <div className="space-y-2 flex-1 sm:max-w-xs">
              <p className="text-sm font-medium text-gray-900">System role</p>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  <SelectItem value="all">All roles</SelectItem>
                  {roleOptions.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1 sm:max-w-xs">
              <p className="text-sm font-medium text-gray-900">Status</p>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All status" />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200]">
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              className="sm:mb-0.5"
              onClick={() => {
                setRoleFilter('all');
                setStatusFilter('all');
              }}
            >
              Clear filters
            </Button>
          </div>
        )}

        <div className="hidden lg:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-gray-200 hover:bg-transparent">
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Employee Identity
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  System Role
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Department
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Permission Tier
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Status
                </TableHead>
                <TableHead className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Last Sync
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Loading users...
                  </TableCell>
                </TableRow>
              ) : paginatedUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No users found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((u) => {
                  const tier = permissionTierForRole(u.roleKey);
                  return (
                    <TableRow
                      key={u.id}
                      className="border-b border-gray-100 hover:bg-gray-50/80 cursor-pointer"
                      onClick={() => openUserSheet(u)}
                    >
                      <TableCell className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                            {initialsFor(u.name || u.email)}
                          </div>
                          <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5 font-semibold text-gray-900">
                        {roleDisplayName(u.roleKey, roleOptions)}
                      </TableCell>
                      <TableCell className="px-6 py-5 text-gray-700">
                        {departmentForRole(u.roleKey)}
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <span
                          className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-medium ${tier.className}`}
                        >
                          {tier.label}
                        </span>
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              u.status === 'active' ? 'bg-primary' : 'bg-gray-400'
                            }`}
                          />
                          <span className="capitalize text-gray-700">{u.status}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5 text-gray-500">
                        {formatLastSync(u.lastLoginAt)}
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
            <div className="p-6 text-sm text-gray-500 text-center">Loading users...</div>
          ) : paginatedUsers.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">No users found.</div>
          ) : (
            paginatedUsers.map((u) => {
              const tier = permissionTierForRole(u.roleKey);
              return (
                <div
                  key={u.id}
                  role="button"
                  tabIndex={0}
                  className="p-4 space-y-3 cursor-pointer hover:bg-gray-50/80 transition-colors"
                  onClick={() => openUserSheet(u)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openUserSheet(u);
                    }
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-white">
                      {initialsFor(u.name || u.email)}
                    </div>
                    <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Role</p>
                      <p className="font-medium">{roleDisplayName(u.roleKey, roleOptions)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Department</p>
                      <p>{departmentForRole(u.roleKey)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Tier</p>
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs ${tier.className}`}>
                        {tier.label}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase">Last sync</p>
                      <p className="text-gray-500">{formatLastSync(u.lastLoginAt)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <UserPermissionsSheet
          open={!!selectedUser}
          user={selectedUser}
          authToken={authToken}
          onClose={() => setSelectedUser(null)}
          onSaved={() => {
            onUsersUpdated?.();
          }}
        />

        <div className="flex flex-col gap-3 border-t border-gray-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-gray-500">
            {totalFilteredUsers === 0
              ? 'Showing 0 users'
              : `Showing ${paginationStart} to ${paginationEnd} of ${totalFilteredUsers} users`}
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={usersPage <= 1}
              onClick={() => setUsersPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {pageNumbers.map((page, idx) => {
              const prev = pageNumbers[idx - 1];
              const showEllipsis = prev !== undefined && page - prev > 1;
              return (
                <Fragment key={page}>
                  {showEllipsis && <span className="px-2 text-sm text-gray-400">...</span>}
                  <Button
                    type="button"
                    variant={usersPage === page ? 'default' : 'outline'}
                    size="icon"
                    className="h-9 w-9 min-w-9"
                    onClick={() => setUsersPage(page)}
                  >
                    {page}
                  </Button>
                </Fragment>
              );
            })}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={usersPage >= totalPages}
              onClick={() => setUsersPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
