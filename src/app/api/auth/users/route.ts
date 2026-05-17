import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

const ADMIN_PASSWORD = 'devil@2024';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (token !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = getClient();
    const result = await client.execute({
      sql: 'SELECT id, name, email, "createdAt" FROM "User" ORDER BY "createdAt" DESC LIMIT 500',
      args: [],
    });

    const users = result.rows.map((u) => ({
      id: u.id as string,
      name: u.name as string,
      email: u.email as string,
      createdAt: u.createdAt as string,
    }));

    return NextResponse.json({
      totalUsers: users.length,
      users,
    });
  } catch (error) {
    console.error('Fetch users error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
