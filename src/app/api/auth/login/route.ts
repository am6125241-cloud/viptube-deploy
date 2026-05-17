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
    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const client = getTursoClient();

    const result = await client.execute({
      sql: 'SELECT * FROM "User" WHERE email = ?',
      args: [trimmedEmail],
    });

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = result.rows[0];
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to login', details: msg }, { status: 500 });
  }
}
