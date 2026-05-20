import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import archiver from 'archiver';
import { buildDemoBoardColumns, DEMO_SEED_VERSION } from './demoBoard';
import { ALL_PERMISSION_KEYS, PERMISSION_GROUPS, PERMISSIONS } from './constants/permissions';
import { requireAuth, requirePermission, requireAnyPermission } from './middleware/rbac';
import type { AuthContext } from './middleware/rbac';
import { BoardModel } from './models/Board';
import { RoleModel } from './models/Role';
import { UserModel } from './models/User';
import { seedDefaultRoles, migrateUserRoleKeys } from './services/seedDefaultRoles';
import type { BoardColumn, BoardTask } from './utils/boardPermissions';
import { assertBoardSaveAllowed, assertTaskAttachmentAllowed } from './utils/boardPermissions';

/** Old bundled demo assignees from the frontend — replace with per-user demo on fetch. */
const LEGACY_DEMO_ASSIGNEES = new Set([
  'john doe',
  'jane smith',
  'mike johnson',
  'sarah wilson',
  'alex brown',
]);

function boardLooksLikeLegacyDemo(
  board: { columns?: Array<{ tasks?: Array<{ assignee?: string }> }> } | null,
): boolean {
  if (!board?.columns?.length) return false;
  const assignees: string[] = [];
  for (const col of board.columns) {
    if (!Array.isArray(col.tasks)) continue;
    for (const t of col.tasks) {
      assignees.push(String(t.assignee ?? '').trim().toLowerCase());
    }
  }
  if (assignees.length === 0) return false;
  return assignees.every((a) => LEGACY_DEMO_ASSIGNEES.has(a));
}

function boardIsOnlyAutoDemo(
  board: { columns?: Array<{ tasks?: Array<{ id?: string }> }> } | null,
  userId: string,
): boolean {
  if (!board?.columns?.length) return true;
  const prefix = `demo-${userId}-`;
  for (const col of board.columns) {
    if (!Array.isArray(col.tasks)) continue;
    for (const t of col.tasks) {
      const id = String(t.id ?? '');
      if (!id.startsWith(prefix)) return false;
    }
  }
  return true;
}

dotenv.config();

const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGODB_URI || !JWT_SECRET) {
  throw new Error('MONGODB_URI and JWT_SECRET are required. Copy .env.example to .env and update values.');
}

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
  },
});
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);
app.use(express.json({ limit: '1mb' }));

const UPLOADS_ROOT = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(UPLOADS_ROOT));

const createToken = (userId: string) =>
  jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: '7d' });

async function buildUserResponse(userId: string) {
  const user = await UserModel.findById(userId).lean();
  if (!user) return null;
  let roleKey = (user as { roleKey?: string }).roleKey;
  if (!roleKey) {
    const legacy = (user as { role?: string }).role;
    roleKey = legacy === 'admin' ? 'admin' : 'member';
  }
  const role = await RoleModel.findOne({ key: roleKey, isActive: true }).lean();
  const permissions = Array.isArray((role as { permissions?: string[] } | null)?.permissions)
    ? ((role as { permissions: string[] }).permissions as string[])
    : [];
  return {
    id: (user as { _id: { toString: () => string } })._id.toString(),
    name: (user as { name: string }).name,
    email: (user as { email: string }).email,
    roleKey,
    role: roleKey,
    permissions,
    status: (user as { status?: string }).status ?? 'active',
    phone: (user as { phone?: string }).phone ?? '',
    lastLoginAt: (user as { lastLoginAt?: string | null }).lastLoginAt ?? null,
  };
}

async function assertValidRoleKey(roleKey: string): Promise<boolean> {
  const r = await RoleModel.findOne({ key: roleKey, isActive: true }).lean();
  return !!r;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body as {
    name?: string;
    email?: string;
    password?: string;
  };

  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ message: 'name, email, and password(min 6) are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    roleKey: 'member',
  });

  const uid = user._id.toString();
  const token = createToken(uid);
  const payload = await buildUserResponse(uid);
  return res.status(201).json({
    token,
    user: payload,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email?.trim() || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await UserModel.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if ((user as any).status === 'inactive') {
    return res.status(403).json({ message: 'Account inactive' });
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  (user as any).lastLoginAt = new Date().toISOString();
  await user.save();

  const uid = user._id.toString();
  const token = createToken(uid);
  const payload = await buildUserResponse(uid);
  if (!payload) {
    return res.status(500).json({ message: 'Login failed' });
  }
  return res.json({
    token,
    user: payload,
  });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  const userId = (req as express.Request & { auth: AuthContext }).auth.userId;
  const payload = await buildUserResponse(userId);
  if (!payload) {
    return res.status(404).json({ message: 'User not found' });
  }

  return res.json({ user: payload });
});

/** List users for assignee pickers (any authenticated user). */
app.get('/api/users/assignees', requireAuth, requirePermission(PERMISSIONS.view_board), async (_req, res) => {
  try {
    const users = await UserModel.find({ status: { $ne: 'inactive' } })
      .select({ name: 1, email: 1 })
      .sort({ name: 1 })
      .lean();

    return res.json({
      users: users.map((u: any) => ({
        id: u._id.toString(),
        name: u.name,
        email: u.email,
      })),
    });
  } catch (err) {
    console.error('GET /api/users/assignees', err);
    return res.status(500).json({ message: 'Failed to load users' });
  }
});

app.get('/api/admin/users', requireAuth, requirePermission(PERMISSIONS.manage_users), async (_req, res) => {
  const users = await UserModel.find({})
    .select({ name: 1, email: 1, roleKey: 1, role: 1, status: 1, phone: 1, lastLoginAt: 1 })
    .lean();

  return res.json({
    users: users.map((u: any) => {
      const rk = u.roleKey || (u.role === 'admin' ? 'admin' : 'member');
      return {
        id: u._id.toString(),
        name: u.name,
        email: u.email,
        roleKey: rk,
        role: rk,
        status: u.status ?? 'active',
        phone: u.phone ?? '',
        lastLoginAt: u.lastLoginAt ?? null,
      };
    }),
  });
});

/** Role keys for user management forms (users with manage_users may lack manage_roles). */
app.get('/api/admin/role-keys', requireAuth, requirePermission(PERMISSIONS.manage_users), async (_req, res) => {
  const roles = await RoleModel.find({ isActive: true }).sort({ key: 1 }).select({ key: 1, name: 1 }).lean();
  return res.json({
    roles: roles.map((r: { key: string; name: string }) => ({ key: r.key, name: r.name })),
  });
});

app.post('/api/admin/users', requireAuth, requirePermission(PERMISSIONS.manage_users), async (req, res) => {
  const { name, email, password, roleKey, status, phone } = req.body as {
    name?: string;
    email?: string;
    password?: string;
    roleKey?: string;
    status?: string;
    phone?: string;
  };

  if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
  if (!email?.trim()) return res.status(400).json({ message: 'email is required' });
  if (!password || password.length < 6) {
    return res.status(400).json({ message: 'password (min 6) is required' });
  }
  const rk = (roleKey ?? 'member').trim();
  if (!(await assertValidRoleKey(rk))) {
    return res.status(400).json({ message: 'Invalid roleKey' });
  }
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ message: 'status must be active or inactive' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await UserModel.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    roleKey: rk,
    status,
    phone: String(phone ?? '').trim(),
  });

  const payload = await buildUserResponse(user._id.toString());
  return res.status(201).json({ user: payload });
});

app.put('/api/admin/users/:id/role', requireAuth, requirePermission(PERMISSIONS.manage_users), async (req, res) => {
  const userId = String(req.params.id || '').trim();
  const { roleKey } = req.body as { roleKey?: string };
  if (!userId) return res.status(400).json({ message: 'User id is required' });
  const rk = (roleKey ?? '').trim();
  if (!rk || !(await assertValidRoleKey(rk))) {
    return res.status(400).json({ message: 'roleKey is required and must be valid' });
  }

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { roleKey: rk },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return res.status(404).json({ message: 'User not found' });
  return res.json({ ok: true });
});

app.put('/api/admin/users/:id/status', requireAuth, requirePermission(PERMISSIONS.manage_users), async (req, res) => {
  const userId = String(req.params.id || '').trim();
  const { status } = req.body as { status?: string };
  if (!userId) return res.status(400).json({ message: 'User id is required' });
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ message: 'status must be active or inactive' });
  }

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    { status },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return res.status(404).json({ message: 'User not found' });
  return res.json({ ok: true });
});

app.put('/api/admin/users/:id', requireAuth, requirePermission(PERMISSIONS.manage_users), async (req, res) => {
  const userId = String(req.params.id || '').trim();
  const { name, email, roleKey, status, phone } = req.body as {
    name?: string;
    email?: string;
    roleKey?: string;
    status?: string;
    phone?: string;
  };

  if (!userId) return res.status(400).json({ message: 'User id is required' });
  if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
  if (!email?.trim()) return res.status(400).json({ message: 'email is required' });
  const rk = (roleKey ?? '').trim();
  if (!rk || !(await assertValidRoleKey(rk))) {
    return res.status(400).json({ message: 'roleKey is required and must be valid' });
  }
  if (status !== 'active' && status !== 'inactive') {
    return res.status(400).json({ message: 'status must be active or inactive' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existingEmailUser = await UserModel.findOne({
    email: normalizedEmail,
    _id: { $ne: userId },
  }).lean();
  if (existingEmailUser) {
    return res.status(409).json({ message: 'Email already exists' });
  }

  const updated = await UserModel.findByIdAndUpdate(
    userId,
    {
      name: name.trim(),
      email: normalizedEmail,
      roleKey: rk,
      status,
      phone: String(phone ?? '').trim(),
    },
    { returnDocument: 'after' },
  ).lean();

  if (!updated) return res.status(404).json({ message: 'User not found' });
  const payload = await buildUserResponse(updated._id.toString());
  return res.json({
    ok: true,
    user: payload,
  });
});

app.delete('/api/admin/users/:id', requireAuth, requirePermission(PERMISSIONS.manage_users), async (req, res) => {
  const userId = String(req.params.id || '').trim();
  if (!userId) return res.status(400).json({ message: 'User id is required' });

  const deleted = await UserModel.findByIdAndDelete(userId).lean();
  if (!deleted) return res.status(404).json({ message: 'User not found' });
  return res.json({ ok: true });
});

app.get(
  '/api/admin/users/:id/access',
  requireAuth,
  requirePermission(PERMISSIONS.manage_users),
  async (req, res) => {
    const userId = String(req.params.id || '').trim();
    if (!userId) return res.status(400).json({ message: 'User id is required' });

    const user = await UserModel.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const roleKey =
      (user as { roleKey?: string }).roleKey ||
      ((user as { role?: string }).role === 'admin' ? 'admin' : 'member');
    const role = await RoleModel.findOne({ key: roleKey }).lean();

    return res.json({
      user: {
        id: (user as { _id: { toString: () => string } })._id.toString(),
        name: (user as { name: string }).name,
        email: (user as { email: string }).email,
        roleKey,
        status: (user as { status?: string }).status ?? 'active',
        lastLoginAt: (user as { lastLoginAt?: string | null }).lastLoginAt ?? null,
      },
      role: role
        ? {
            id: (role as { _id: { toString: () => string } })._id.toString(),
            key: (role as { key: string }).key,
            name: (role as { name: string }).name,
            permissions: Array.isArray((role as { permissions?: string[] }).permissions)
              ? (role as { permissions: string[] }).permissions
              : [],
            isSystem: !!(role as { isSystem?: boolean }).isSystem,
          }
        : null,
      catalog: { groups: PERMISSION_GROUPS, keys: ALL_PERMISSION_KEYS },
    });
  },
);

app.put(
  '/api/admin/users/:id/role-permissions',
  requireAuth,
  requirePermission(PERMISSIONS.manage_users),
  async (req, res) => {
    const userId = String(req.params.id || '').trim();
    if (!userId) return res.status(400).json({ message: 'User id is required' });

    const { permissions, roleKey } = req.body as {
      permissions?: string[];
      roleKey?: string;
    };

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (roleKey !== undefined) {
      const rk = String(roleKey).trim();
      if (!(await assertValidRoleKey(rk))) {
        return res.status(400).json({ message: 'Invalid roleKey' });
      }
      user.roleKey = rk;
      await user.save();
    }

    const effectiveRoleKey = user.roleKey;
    const role = await RoleModel.findOne({ key: effectiveRoleKey });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    if (permissions !== undefined) {
      role.permissions = Array.isArray(permissions) ? permissions : [];
      await role.save();
    }

    const payload = await buildUserResponse(userId);
    return res.json({
      ok: true,
      user: payload,
      role: {
        id: role._id.toString(),
        key: role.key,
        name: role.name,
        permissions: role.permissions,
        isSystem: role.isSystem,
      },
    });
  },
);

app.get(
  '/api/admin/permission-catalog',
  requireAuth,
  requirePermission(PERMISSIONS.manage_roles),
  (_req, res) => {
    res.json({ groups: PERMISSION_GROUPS, keys: ALL_PERMISSION_KEYS });
  },
);

app.get('/api/admin/roles', requireAuth, requirePermission(PERMISSIONS.manage_roles), async (_req, res) => {
  const roles = await RoleModel.find({}).sort({ key: 1 }).lean();
  return res.json({
    roles: roles.map((r: any) => ({
      id: r._id.toString(),
      key: r.key,
      name: r.name,
      description: r.description ?? '',
      permissions: Array.isArray(r.permissions) ? r.permissions : [],
      isActive: r.isActive !== false,
      isSystem: !!r.isSystem,
    })),
  });
});

app.post('/api/admin/roles', requireAuth, requirePermission(PERMISSIONS.manage_roles), async (req, res) => {
  const { key, name, description, permissions, isActive } = req.body as {
    key?: string;
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  };
  const k = String(key ?? '').trim();
  if (!k) return res.status(400).json({ message: 'key is required' });
  if (!name?.trim()) return res.status(400).json({ message: 'name is required' });
  const exists = await RoleModel.findOne({ key: k }).lean();
  if (exists) return res.status(409).json({ message: 'Role key already exists' });
  const role = await RoleModel.create({
    key: k,
    name: name.trim(),
    description: String(description ?? '').trim(),
    permissions: Array.isArray(permissions) ? permissions : [],
    isActive: isActive !== false,
    isSystem: false,
  });
  return res.status(201).json({
    role: {
      id: role._id.toString(),
      key: role.key,
      name: role.name,
      description: role.description,
      permissions: role.permissions,
      isActive: role.isActive,
      isSystem: role.isSystem,
    },
  });
});

app.put('/api/admin/roles/:id', requireAuth, requirePermission(PERMISSIONS.manage_roles), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const { name, description, permissions, isActive } = req.body as {
    name?: string;
    description?: string;
    permissions?: string[];
    isActive?: boolean;
  };
  if (!id) return res.status(400).json({ message: 'id is required' });
  const existing = await RoleModel.findById(id);
  if (!existing) return res.status(404).json({ message: 'Role not found' });
  if (name !== undefined) existing.name = String(name).trim();
  if (description !== undefined) existing.description = String(description).trim();
  if (permissions !== undefined) existing.permissions = Array.isArray(permissions) ? permissions : [];
  if (isActive !== undefined) existing.isActive = !!isActive;
  await existing.save();
  return res.json({
    role: {
      id: existing._id.toString(),
      key: existing.key,
      name: existing.name,
      description: existing.description,
      permissions: existing.permissions,
      isActive: existing.isActive,
      isSystem: existing.isSystem,
    },
  });
});

app.delete('/api/admin/roles/:id', requireAuth, requirePermission(PERMISSIONS.manage_roles), async (req, res) => {
  const id = String(req.params.id || '').trim();
  const existing = await RoleModel.findById(id);
  if (!existing) return res.status(404).json({ message: 'Role not found' });
  if (existing.isSystem) {
    return res.status(400).json({ message: 'System roles cannot be deleted' });
  }
  const inUse = await UserModel.countDocuments({ roleKey: existing.key });
  if (inUse > 0) {
    return res.status(400).json({ message: 'Role is assigned to users; reassign them first' });
  }
  await RoleModel.deleteOne({ _id: id });
  return res.json({ ok: true });
});

app.get('/api/board', requireAuth, requirePermission(PERMISSIONS.view_board), async (req, res) => {
  try {
    const userId = (req as express.Request & { auth: AuthContext }).auth.userId;
    const boardKey = `user:${userId}:board`;
    const userDoc = await UserModel.findById(userId).lean();
    const assigneeName = (
      (userDoc as { name?: string; email?: string } | null)?.name?.trim() ||
      (userDoc as { name?: string; email?: string } | null)?.email?.split('@')[0] ||
      'You'
    ).trim();

    let board = await BoardModel.findOne({ key: boardKey }).lean();

    const totalTasks =
      board?.columns?.reduce(
        (n, c: { tasks?: unknown[] }) => n + (Array.isArray(c.tasks) ? c.tasks.length : 0),
        0,
      ) ?? 0;

    const seedVersion = (board as { demoSeedVersion?: number } | null)?.demoSeedVersion ?? 0;
    const needsVersionUpgrade =
      seedVersion < DEMO_SEED_VERSION && boardIsOnlyAutoDemo(board, userId);

    const needsDemo =
      !board ||
      !Array.isArray(board.columns) ||
      board.columns.length === 0 ||
      totalTasks === 0 ||
      boardLooksLikeLegacyDemo(board) ||
      needsVersionUpgrade;

    if (needsDemo) {
      const columns = buildDemoBoardColumns(assigneeName, userId);
      const prevActivity = Array.isArray((board as { activity?: unknown[] })?.activity)
        ? ((board as { activity: unknown[] }).activity as Array<Record<string, unknown>>)
        : [];
      const activity = [
        {
          id: `welcome-${userId}-${Date.now()}`,
          type: 'task_updated',
          message: needsVersionUpgrade && totalTasks > 0
            ? 'Demo sample tasks were refreshed (more tasks per column, still assigned to you).'
            : 'Demo tasks were added to each column (assigned to you).',
          timestamp: new Date().toISOString(),
        },
        ...prevActivity,
      ].slice(0, 50);
      await BoardModel.findOneAndUpdate(
        { key: boardKey },
        { key: boardKey, columns, activity, demoSeedVersion: DEMO_SEED_VERSION },
        { upsert: true },
      );
      board = await BoardModel.findOne({ key: boardKey }).lean();
    }

    return res.json({ columns: board?.columns ?? [], activity: board?.activity ?? [] });
  } catch (err) {
    console.error('GET /api/board', err);
    return res.status(500).json({ message: 'Failed to load board' });
  }
});

const ensureDir = async (dirPath: string) => {
  await fs.promises.mkdir(dirPath, { recursive: true });
};

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, _file, cb) => {
      try {
        const userId = (req as express.Request & { auth: AuthContext }).auth.userId;
        const taskId = String(req.params.taskId || '').trim();
        if (!taskId) {
          cb(new Error('taskId is required'), '');
          return;
        }
        const dest = path.join(UPLOADS_ROOT, 'users', userId, 'tasks', taskId);
        await ensureDir(dest);
        cb(null, dest);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const safeOriginal = (file.originalname || 'file').replace(/[^\w.\-() ]+/g, '_');
      const uniquePrefix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      cb(null, `${uniquePrefix}-${safeOriginal}`);
    },
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
});

app.post(
  '/api/tasks/:taskId/attachments',
  requireAuth,
  upload.array('files', 10),
  async (req, res) => {
    const userId = (req as express.Request & { auth: AuthContext }).auth.userId;
    const taskId = String(req.params.taskId || '').trim();
    if (!taskId) {
      return res.status(400).json({ message: 'taskId is required' });
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const auth = (req as express.Request & { auth: AuthContext }).auth;
    const boardKey = `user:${userId}:board`;
    const board = await BoardModel.findOne({ key: boardKey });
    if (!board) {
      return res.status(404).json({ message: 'Board not found' });
    }

    let targetTask: BoardTask | undefined;
    for (const column of board.columns) {
      const task = column.tasks.find((t: { id: string }) => t.id === taskId);
      if (task) {
        targetTask = task as BoardTask;
        break;
      }
    }
    try {
      assertTaskAttachmentAllowed(auth, targetTask);
    } catch (e: unknown) {
      const err = e as { status?: number; message?: string };
      return res.status(err.status ?? 403).json({ message: err.message ?? 'Forbidden' });
    }

    const attachments = files.map((file) => {
      let size = file.size;
      if ((!size || size < 0) && file.path) {
        try {
          size = fs.statSync(file.path).size;
        } catch {
          size = size ?? 0;
        }
      }
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.originalname,
        url: `/uploads/users/${userId}/tasks/${taskId}/${encodeURIComponent(file.filename)}`,
        size,
        mimeType: file.mimetype,
        uploadedAt: new Date().toISOString(),
      };
    });

    let updated = false;
    for (const column of board.columns) {
      const task = column.tasks.find((t: { id: string }) => t.id === taskId);
      if (!task) continue;
      const existing = Array.isArray((task as any).attachments) ? (task as any).attachments : [];
      (task as any).attachments = [...existing, ...attachments];
      updated = true;
      break;
    }

    if (!updated) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await board.save();
    io.to(`user:${userId}`).emit('board:updated', { at: new Date().toISOString() });

    let savedAttachments: unknown[] = attachments;
    for (const column of board.columns) {
      const savedTask = column.tasks.find((t: { id: string }) => t.id === taskId);
      if (savedTask) {
        savedAttachments = Array.isArray((savedTask as { attachments?: unknown[] }).attachments)
          ? ((savedTask as { attachments?: unknown[] }).attachments as unknown[])
          : attachments;
        break;
      }
    }

    return res.status(201).json({ attachments: savedAttachments });
  },
);

app.delete('/api/tasks/:taskId/attachments/:attachmentId', requireAuth, async (req, res) => {
  const auth = (req as express.Request & { auth: AuthContext }).auth;
  const userId = auth.userId;
  const taskId = String(req.params.taskId || '').trim();
  const attachmentId = String(req.params.attachmentId || '').trim();
  if (!taskId) return res.status(400).json({ message: 'taskId is required' });
  if (!attachmentId) return res.status(400).json({ message: 'attachmentId is required' });

  const boardKey = `user:${userId}:board`;
  const board = await BoardModel.findOne({ key: boardKey });
  if (!board) return res.status(404).json({ message: 'Board not found' });

  let targetTask: BoardTask | undefined;
  for (const column of board.columns) {
    const task = column.tasks.find((t: { id: string }) => t.id === taskId);
    if (task) {
      targetTask = task as BoardTask;
      break;
    }
  }

  try {
    assertTaskAttachmentAllowed(auth, targetTask);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return res.status(err.status ?? 403).json({ message: err.message ?? 'Forbidden' });
  }

  if (!targetTask) return res.status(404).json({ message: 'Task not found' });

  const current = Array.isArray((targetTask as any).attachments) ? ((targetTask as any).attachments as any[]) : [];
  const idx = current.findIndex((a) => String(a?.id) === attachmentId);
  if (idx < 0) return res.status(404).json({ message: 'Attachment not found' });

  const att = current[idx] as { id?: string; url?: string };
  const url = String(att?.url ?? '');
  // Delete file best-effort if it belongs to this user's task folder.
  if (url.startsWith(`/uploads/users/${userId}/tasks/${taskId}/`)) {
    const encodedName = url.slice(`/uploads/users/${userId}/tasks/${taskId}/`.length);
    const filename = (() => {
      try {
        return decodeURIComponent(encodedName);
      } catch {
        return encodedName;
      }
    })();
    const absPath = path.join(UPLOADS_ROOT, 'users', userId, 'tasks', taskId, filename);
    await fs.promises.unlink(absPath).catch(() => undefined);
  }

  current.splice(idx, 1);
  (targetTask as any).attachments = current;
  await board.save();

  io.to(`user:${userId}`).emit('board:updated', { at: new Date().toISOString() });
  return res.json({ ok: true, attachments: current });
});

app.get('/api/tasks/:taskId/attachments/download', requireAuth, async (req, res) => {
  const auth = (req as express.Request & { auth: AuthContext }).auth;
  const userId = auth.userId;
  const taskId = String(req.params.taskId || '').trim();
  if (!taskId) return res.status(400).json({ message: 'taskId is required' });

  const boardKey = `user:${userId}:board`;
  const board = await BoardModel.findOne({ key: boardKey }).lean();
  if (!board) return res.status(404).json({ message: 'Board not found' });

  let targetTask: BoardTask | undefined;
  for (const column of (board as any).columns ?? []) {
    const task = (column?.tasks ?? []).find((t: { id: string }) => t.id === taskId);
    if (task) {
      targetTask = task as BoardTask;
      break;
    }
  }

  try {
    assertTaskAttachmentAllowed(auth, targetTask);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return res.status(err.status ?? 403).json({ message: err.message ?? 'Forbidden' });
  }

  if (!targetTask) return res.status(404).json({ message: 'Task not found' });
  const attachments = Array.isArray((targetTask as any).attachments)
    ? (((targetTask as any).attachments as any[]).filter(Boolean) as Array<{ id?: string; name?: string; url?: string }>)
    : [];
  if (attachments.length === 0) {
    return res.status(404).json({ message: 'No attachments' });
  }

  res.setHeader('Content-Type', 'application/zip');
  const rawTitle = String((targetTask as any).title ?? '').trim() || 'task';
  const safeTitle = rawTitle
    .replace(/[^\w.\-() ]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'task';
  res.setHeader('Content-Disposition', `attachment; filename=\"${safeTitle}-attachments.zip\"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('zip error', err);
    if (!res.headersSent) res.status(500);
    res.end();
  });
  archive.pipe(res);

  const basePrefix = `/uploads/users/${userId}/tasks/${taskId}/`;
  const usedNames = new Map<string, number>();

  for (const att of attachments) {
    const url = String(att.url ?? '');
    if (!url.startsWith(basePrefix)) continue;
    const encodedName = url.slice(basePrefix.length);
    const filename = (() => {
      try {
        return decodeURIComponent(encodedName);
      } catch {
        return encodedName;
      }
    })();
    const absPath = path.join(UPLOADS_ROOT, 'users', userId, 'tasks', taskId, filename);
    if (!fs.existsSync(absPath)) continue;

    const originalName = String(att.name ?? filename).trim() || filename;
    const count = usedNames.get(originalName) ?? 0;
    usedNames.set(originalName, count + 1);
    const outName = count === 0 ? originalName : `${count + 1}-${originalName}`;

    archive.file(absPath, { name: outName });
  }

  await archive.finalize();
});

app.put('/api/board', requireAuth, async (req, res) => {
  const auth = (req as express.Request & { auth: AuthContext }).auth;
  const userId = auth.userId;
  const boardKey = `user:${userId}:board`;
  const { columns, activity } = req.body as { columns?: unknown; activity?: unknown };
  if (!Array.isArray(columns)) {
    return res.status(400).json({ message: 'columns must be an array' });
  }
  if (activity !== undefined && !Array.isArray(activity)) {
    return res.status(400).json({ message: 'activity must be an array' });
  }

  const prevBoard = await BoardModel.findOne({ key: boardKey }).lean();
  try {
    assertBoardSaveAllowed(
      auth,
      prevBoard as { columns?: BoardColumn[] } | null,
      columns as BoardColumn[],
    );
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string };
    return res.status(err.status ?? 403).json({ message: err.message ?? 'Forbidden' });
  }

  const board = await BoardModel.findOneAndUpdate(
    { key: boardKey },
    { key: boardKey, columns, activity: Array.isArray(activity) ? activity : [] },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  ).lean();

  io.to(`user:${userId}`).emit('board:updated', { at: new Date().toISOString() });

  return res.json({ columns: board?.columns ?? [], activity: board?.activity ?? [] });
});

const start = async () => {
  await mongoose.connect(MONGODB_URI);
  await seedDefaultRoles();
  await migrateUserRoleKeys();
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as { sub?: string; userId?: string };
      const uid = payload.sub || payload.userId;
      if (!uid) {
        next(new Error('Unauthorized'));
        return;
      }
      socket.data.userId = uid;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);
  });

  httpServer.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Kanban API running on http://localhost:${PORT}`);
  });
};

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server', error);
  process.exit(1);
});
