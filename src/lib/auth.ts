import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { userOperations, sessionOperations, User } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

export function generateId(): string {
  return crypto.randomUUID();
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

export async function createSession(userId: string): Promise<string> {
  const token = generateToken(userId);
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + SESSION_DURATION).toISOString();

  sessionOperations.create(sessionId, userId, token, expiresAt);

  // Set cookie
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION / 1000,
    path: '/',
  });

  return token;
}

export async function getCurrentUser(): Promise<Omit<User, 'password'> | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (!token) {
    return null;
  }

  const session = sessionOperations.findByToken(token);
  if (!session) {
    return null;
  }

  const user = userOperations.findById(session.user_id);
  if (!user) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token')?.value;

  if (token) {
    sessionOperations.deleteByToken(token);
  }

  cookieStore.delete('auth_token');
}

export function validatePhoneNumber(phone: string): boolean {
  // Basic phone number validation - allows various formats
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;
  return phoneRegex.test(phone.replace(/[\s\-()]/g, ''));
}

export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except leading +
  return phone.replace(/(?!^\+)\D/g, '');
}
