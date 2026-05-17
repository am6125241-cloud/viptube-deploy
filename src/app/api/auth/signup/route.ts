import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getTursoClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { name, email } = await req.json();

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const client = getTursoClient();
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36);

    // Check if user already exists
    const existing = await client.execute({
      sql: 'SELECT * FROM "User" WHERE email = ?',
      args: [trimmedEmail],
    });

    if (existing.rows.length > 0) {
      const user = existing.rows[0];
      return NextResponse.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
        },
      });
    }

    // Create new user
    const now = new Date().toISOString();
    await client.execute({
      sql: 'INSERT INTO "User" (id, name, email, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, trimmedName, trimmedEmail, now, now],
    });

    return NextResponse.json({
      success: true,
      user: {
        id,
        name: trimmedName,
        email: trimmedEmail,
        createdAt: now,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to sign up', details: msg }, { status: 500 });
  }
}
