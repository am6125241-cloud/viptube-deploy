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
      sql: 'SELECT * FROM "WatchLater" WHERE "userId" = ? ORDER BY "addedAt" DESC',
      args: [USER_ID],
    });

    const items = result.rows.map((row) => ({
      id: row.id as string,
      videoId: row.videoId as string,
      title: row.title as string,
      thumbnail: row.thumbnail as string,
      channelId: row.channelId as string,
      channelName: row.channelName as string,
      duration: Number(row.duration),
      addedAt: row.addedAt as string,
      userId: row.userId as string,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('WatchLater GET error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await ensureUser();
    const client = getClient();
    const body = await request.json();
    const { videoId, title, thumbnail, channelId, channelName, duration } = body;

    // Upsert watch later
    await client.execute({
      sql: `INSERT OR REPLACE INTO "WatchLater" (id, "userId", "videoId", title, thumbnail, "channelId", "channelName", duration, "addedAt")
             VALUES (
               (SELECT id FROM "WatchLater" WHERE "userId" = ? AND "videoId" = ?),
               ?, ?, ?, ?, ?, ?, ?, ?
             )`,
      args: [USER_ID, videoId, USER_ID, videoId, title, thumbnail, channelId, channelName, duration || 0, new Date().toISOString()],
    });

    const result = await client.execute({
      sql: 'SELECT * FROM "WatchLater" WHERE "userId" = ? AND "videoId" = ?',
      args: [USER_ID, videoId],
    });
    const row = result.rows[0];
    return NextResponse.json({
      id: row?.id,
      videoId: row?.videoId,
      title: row?.title,
      thumbnail: row?.thumbnail,
      channelId: row?.channelId,
      channelName: row?.channelName,
      duration: row ? Number(row.duration) : 0,
      addedAt: row?.addedAt,
      userId: row?.userId,
    });
  } catch (error) {
    console.error('WatchLater POST error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId required' }, { status: 400 });
    }

    const client = getClient();
    await client.execute({
      sql: 'DELETE FROM "WatchLater" WHERE "userId" = ? AND "videoId" = ?',
      args: [USER_ID, videoId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('WatchLater DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
