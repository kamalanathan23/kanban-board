import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserModel } from './models/User';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is required. Copy .env.example to .env and update values.');
}

const ADMIN_EMAIL = 'admin@gmail.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Admin';

async function main() {
  await mongoose.connect(MONGODB_URI!);

  const normalizedEmail = ADMIN_EMAIL.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const existing = await UserModel.findOne({ email: normalizedEmail });
  if (existing) {
    existing.name = ADMIN_NAME;
    existing.passwordHash = passwordHash;
    (existing as any).role = 'admin';
    (existing as any).roleKey = 'admin';
    (existing as any).status = 'active';
    await existing.save();
    // eslint-disable-next-line no-console
    console.log(`Updated admin user: ${normalizedEmail}`);
  } else {
    await UserModel.create({
      name: ADMIN_NAME,
      email: normalizedEmail,
      passwordHash,
      roleKey: 'admin',
      role: 'admin',
      status: 'active',
    });
    // eslint-disable-next-line no-console
    console.log(`Created admin user: ${normalizedEmail}`);
  }
}

main()
  .then(async () => {
    await mongoose.disconnect();
  })
  .catch(async (err) => {
    // eslint-disable-next-line no-console
    console.error('Admin seed failed', err);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });

