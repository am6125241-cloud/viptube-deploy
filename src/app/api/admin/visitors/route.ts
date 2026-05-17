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

    // Mark stale visitors as offline
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    await client.execute({
      sql: 'UPDATE "SiteVisit" SET "isOnline" = 0 WHERE "isOnline" = 1 AND "lastSeenAt" < ?',
      args: [thirtySecondsAgo],
    });

    const onlineResult = await client.execute({
      sql: 'SELECT * FROM "SiteVisit" WHERE "isOnline" = 1 ORDER BY "lastSeenAt" DESC',
      args: [],
    });

    return NextResponse.json({
      onlineCount: onlineResult.rows.length,
      visitors: onlineResult.rows.map((v) => ({
        visitorId: v.visitorId,
        device: v.device,
        browser: v.browser,
        os: v.os,
        screenRes: v.screenRes,
        page: v.page,
        lastSeenAt: v.lastSeenAt,
        createdAt: v.createdAt,
      })),
    });
  } catch (error) {
    console.error('Visitors error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
