import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

const ADMIN_PASSWORD = 'devil@2024';

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (token !== ADMIN_PASSWORD) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = getClient();
    await client.execute({
      sql: 'DELETE FROM "SiteVisit"',
      args: [],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Clear visits error:', error);
    return NextResponse.json(
      { error: 'Failed to clear', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
