import { NextRequest, NextResponse } from 'next/server';
import { userOperations } from '@/lib/db';
import {
  hashPassword,
  createSession,
  validatePhoneNumber,
  normalizePhoneNumber,
  generateId,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phoneNumber, password, name } = body;

    // Validate required fields
    if (!phoneNumber || !password) {
      return NextResponse.json(
        { error: 'Phone number and password are required' },
        { status: 400 }
      );
    }

    // Validate phone number format
    if (!validatePhoneNumber(phoneNumber)) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Check if user already exists
    const existingUser = userOperations.findByPhone(normalizedPhone);
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this phone number already exists' },
        { status: 409 }
      );
    }

    // Create user
    const userId = generateId();
    const hashedPassword = await hashPassword(password);

    userOperations.create(userId, normalizedPhone, hashedPassword, name || null);

    // Create session
    await createSession(userId);

    // Get user without password
    const user = userOperations.findById(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'Failed to create user' },
        { status: 500 }
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _, ...userWithoutPassword } = user;

    return NextResponse.json(
      { message: 'Registration successful', user: userWithoutPassword },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
