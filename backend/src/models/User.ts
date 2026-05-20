import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    /** RBAC role key — references Role.key (e.g. admin, member). */
    roleKey: { type: String, required: true, default: 'member', index: true },
    /** @deprecated Use roleKey; kept for migration reads only. */
    role: { type: String, enum: ['user', 'admin'] },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    phone: { type: String, default: '' },
    lastLoginAt: { type: String },
  },
  {
    timestamps: true,
  },
);

export const UserModel = model('User', userSchema);
