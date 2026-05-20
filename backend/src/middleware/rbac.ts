import type express from 'express';
import jwt from 'jsonwebtoken';
import { UserModel } from '../models/User';
import { RoleModel } from '../models/Role';
import { PERMISSION_WILDCARD } from '../constants/permissions';

export type AuthContext = {
  userId: string;
  name: string;
  email: string;
  roleKey: string;
  roleName: string;
  permissions: string[];
};

export function hasPermission(permissions: string[], key: string): boolean {
  if (permissions.includes(PERMISSION_WILDCARD)) return true;
  return permissions.includes(key);
}

export function hasAnyPermission(permissions: string[], keys: string[]): boolean {
  return keys.some((k) => hasPermission(permissions, k));
}

/**
 * Verify JWT (`sub` = user id), load user + role permissions.
 */
export const requireAuth: express.RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  let userId: string;
  try {
    // IMPORTANT: `dotenv.config()` is called in `index.ts` after this module is imported.
    // Read the secret lazily to ensure env is populated.
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      res.status(500).json({ message: 'Server misconfigured (JWT_SECRET missing)' });
      return;
    }

    const payload = jwt.verify(token, jwtSecret) as { sub?: string; userId?: string };
    userId = (payload.sub || payload.userId) as string;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
  } catch {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  const user = await UserModel.findById(userId).lean();
  if (!user) {
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if ((user as { status?: string }).status === 'inactive') {
    res.status(403).json({ message: 'Account inactive' });
    return;
  }

  let roleKey = (user as { roleKey?: string }).roleKey;
  if (!roleKey) {
    const legacy = (user as { role?: string }).role;
    roleKey = legacy === 'admin' ? 'admin' : 'member';
  }

  const role = await RoleModel.findOne({ key: roleKey, isActive: true }).lean();
  if (!role) {
    res.status(403).json({ message: 'Invalid or inactive role assignment' });
    return;
  }

  const permissions = Array.isArray((role as { permissions?: string[] }).permissions)
    ? ((role as { permissions: string[] }).permissions as string[])
    : [];

  const ctx: AuthContext = {
    userId,
    name: (user as { name: string }).name,
    email: (user as { email: string }).email,
    roleKey,
    roleName: (role as { name: string }).name,
    permissions,
  };

  (req as express.Request & { auth: AuthContext }).auth = ctx;
  next();
};

export function requirePermission(...required: string[]): express.RequestHandler {
  return (req, res, next) => {
    const auth = (req as express.Request & { auth?: AuthContext }).auth;
    if (!auth) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    for (const p of required) {
      if (!hasPermission(auth.permissions, p)) {
        res.status(403).json({ message: 'Forbidden', requiredPermission: p });
        return;
      }
    }
    next();
  };
}

export function requireAnyPermission(...keys: string[]): express.RequestHandler {
  return (req, res, next) => {
    const auth = (req as express.Request & { auth?: AuthContext }).auth;
    if (!auth) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (hasAnyPermission(auth.permissions, keys)) {
      next();
      return;
    }
    res.status(403).json({ message: 'Forbidden', requiredAnyOf: keys });
  };
}
