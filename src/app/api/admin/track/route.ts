import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { visitorId, userName, device, browser, os, screenRes, language, referrer, page } = body;

    if (!visitorId) {
      return NextResponse.json({ error: 'Missing visitorId' }, { status: 400 });
    }

    const client = getClient();
    const now = new Date().toISOString();

    // Check for existing online visit for this visitor
    const existing = await client.execute({
      sql: 'SELECT id, page, device, browser, os, "screenRes" FROM "SiteVisit" WHERE "visitorId" = ? AND "isOnline" = 1 ORDER BY "createdAt" DESC LIMIT 1',
      args: [visitorId],
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // Update existing visit (heartbeat)
      await client.execute({
        sql: `UPDATE "SiteVisit" SET "lastSeenAt" = ?, "isOnline" = 1, page = ?, device = ?, browser = ?, os = ?, "screenRes" = ?, "userName" = ? WHERE id = ?`,
        args: [
          now,
          page || (row.page as string),
          device || (row.device as string),
          browser || (row.browser as string),
          os || (row.os as string),
          screenRes || (row.screenRes as string),
          userName || '',
          row.id as string,
        ],
      });
    } else {
      // Create new visit record
      await client.execute({
        sql: `INSERT INTO "SiteVisit" (id, "visitorId", "userName", device, browser, os, "screenRes", language, referrer, page, "isOnline", "lastSeenAt", "createdAt") VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
        args: [
          visitorId,
          userName || '',
          device || 'Unknown',
          browser || 'Unknown',
          os || 'Unknown',
          screenRes || 'Unknown',
          language || 'Unknown',
          referrer || '',
          page || 'home',
          now,
          now,
        ],
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Track visit error:', error);
    return NextResponse.json(
      { error: 'Failed to track visit', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
