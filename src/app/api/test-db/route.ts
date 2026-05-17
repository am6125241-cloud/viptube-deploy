import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  const results: Record<string, string> = {};
  
  // Check env vars
  results.tursoUrl = process.env.TURSO_DATABASE_URL ? 'SET' : 'NOT SET';
  results.dbUrl = process.env.DATABASE_URL || 'NOT SET';
  results.authToken = process.env.DATABASE_AUTH_TOKEN ? 'SET' : 'NOT SET';

  // Try Turso connection
  try {
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL || '',
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
    const res = await client.execute('SELECT 1 as test');
    results.tursoConnection = 'SUCCESS — ' + JSON.stringify(res.rows[0]);
    
    // Check tables
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
    results.tables = tables.rows.map((r: any) => r.name).join(', ');
  } catch (err: unknown) {
    results.tursoConnection = 'FAILED — ' + (err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json(results);
}
