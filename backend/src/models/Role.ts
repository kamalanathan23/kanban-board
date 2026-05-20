import { Schema, model } from 'mongoose';
import type { PermissionKey } from '../constants/permissions';

const roleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    /** System roles cannot be deleted (only edited in controlled ways). */
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type RoleDocument = {
  _id: unknown;
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[] | string[];
  isActive: boolean;
  isSystem: boolean;
};

export const RoleModel = model('Role', roleSchema);
