import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function getClient() {
  return createClient({
    url: process.env.TURSO_DATABASE_URL || '',
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

const USER_ID = 'demo-user';

async function ensureUser() {
  const client = getClient();
  await client.execute({
    sql: `INSERT OR IGNORE INTO "User" (id, email, name, "createdAt", "updatedAt") VALUES ('demo-user', 'demo@viptube.app', 'Demo User', datetime('now'), datetime('now'))`,
    args: [],
  });
}

export async function GET() {
  try {
    await ensureUser();
    const client = getClient();

    const result = await client.execute({
      sql: 'SELECT * FROM "Subscription" WHERE "userId" = ? ORDER BY "subscribedAt" DESC',
      args: [USER_ID],
    });

    const subs = result.rows.map((row) => ({
      id: row.id as string,
      channelId: row.channelId as string,
      channelName: row.channelName as string,
      channelAvatar: row.channelAvatar as string,
      subscriberCount: row.subscriberCount ? Number(row.subscriberCount) : null,
      subscribedAt: row.subscribedAt as string,
      userId: row.userId as string,
    }));

    return NextResponse.json(subs);
  } catch (error) {
    console.error('Sub GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscriptions', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUser();
    const client = getClient();
    const body = await request.json();
    const { channelId, channelName, channelAvatar, subscriberCount } = body;

    // Upsert subscription
    await client.execute({
      sql: `INSERT OR REPLACE INTO "Subscription" (id, "userId", "channelId", "channelName", "channelAvatar", "subscriberCount", "subscribedAt")
             VALUES (
               (SELECT id FROM "Subscription" WHERE "userId" = ? AND "channelId" = ?),
               ?, ?, ?, ?, ?, ?
             )`,
      args: [USER_ID, channelId, USER_ID, channelId, channelName, channelAvatar || null, subscriberCount || null, new Date().toISOString()],
    });

    const result = await client.execute({
      sql: 'SELECT * FROM "Subscription" WHERE "userId" = ? AND "channelId" = ?',
      args: [USER_ID, channelId],
    });
    const row = result.rows[0];
    return NextResponse.json({
      id: row?.id,
      channelId: row?.channelId,
      channelName: row?.channelName,
      channelAvatar: row?.channelAvatar,
      subscriberCount: row?.subscriberCount ? Number(row.subscriberCount) : null,
      subscribedAt: row?.subscribedAt,
      userId: row?.userId,
    });
  } catch (error) {
    console.error('Sub POST error:', error);
    return NextResponse.json(
      { error: 'Failed to subscribe', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ error: 'channelId required' }, { status: 400 });
    }

    const client = getClient();
    await client.execute({
      sql: 'DELETE FROM "Subscription" WHERE "userId" = ? AND "channelId" = ?',
      args: [USER_ID, channelId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Sub DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to unsubscribe', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
