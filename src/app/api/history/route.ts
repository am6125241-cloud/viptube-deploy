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

// GET watch history for a user
export async function GET() {
  try {
    await ensureUser();
    const client = getClient();

    const result = await client.execute({
      sql: 'SELECT * FROM "WatchHistory" WHERE "userId" = ? ORDER BY "watchedAt" DESC LIMIT 50',
      args: [USER_ID],
    });

    const history = result.rows.map((row) => ({
      id: row.id as string,
      videoId: row.videoId as string,
      title: row.title as string,
      thumbnail: row.thumbnail as string,
      channelId: row.channelId as string,
      channelName: row.channelName as string,
      duration: Number(row.duration),
      watchedAt: row.watchedAt as string,
      userId: row.userId as string,
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error('History GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// POST add to watch history (upsert by userId + videoId)
export async function POST(request: NextRequest) {
  try {
    await ensureUser();
    const client = getClient();
    const body = await request.json();
    const { videoId, title, thumbnail, channelId, channelName, duration } = body;

    if (!videoId) {
      return NextResponse.json({ error: 'videoId is required' }, { status: 400 });
    }

    // Check for existing entry
    const existing = await client.execute({
      sql: 'SELECT id, title, thumbnail, "channelName", duration FROM "WatchHistory" WHERE "userId" = ? AND "videoId" = ? LIMIT 1',
      args: [USER_ID, videoId],
    });

    if (existing.rows.length > 0) {
      const row = existing.rows[0];
      // Update the watchedAt timestamp
      await client.execute({
        sql: `UPDATE "WatchHistory" SET "watchedAt" = ?, title = ?, thumbnail = ?, "channelName" = ?, duration = ? WHERE id = ?`,
        args: [
          new Date().toISOString(),
          title || (row.title as string),
          thumbnail || (row.thumbnail as string),
          channelName || (row.channelName as string),
          duration || Number(row.duration),
          row.id as string,
        ],
      });

      const updated = await client.execute({
        sql: 'SELECT * FROM "WatchHistory" WHERE id = ?',
        args: [row.id as string],
      });
      const u = updated.rows[0];
      return NextResponse.json({
        id: u.id,
        videoId: u.videoId,
        title: u.title,
        thumbnail: u.thumbnail,
        channelId: u.channelId,
        channelName: u.channelName,
        duration: Number(u.duration),
        watchedAt: u.watchedAt,
        userId: u.userId,
      });
    }

    // Create new entry
    const now = new Date().toISOString();
    await client.execute({
      sql: `INSERT INTO "WatchHistory" (id, "userId", "videoId", title, thumbnail, "channelId", "channelName", duration, "watchedAt") VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        USER_ID,
        videoId,
        title || 'Unknown Video',
        thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelId || '',
        channelName || 'Unknown Channel',
        duration || 0,
        now,
      ],
    });

    return NextResponse.json({
      videoId,
      title: title || 'Unknown Video',
      thumbnail: thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      channelId: channelId || '',
      channelName: channelName || 'Unknown Channel',
      duration: duration || 0,
      watchedAt: now,
      userId: USER_ID,
    });
  } catch (error) {
    console.error('History POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add to history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// DELETE from watch history
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json({ error: 'videoId required' }, { status: 400 });
    }

    const client = getClient();
    await client.execute({
      sql: 'DELETE FROM "WatchHistory" WHERE "userId" = ? AND "videoId" = ?',
      args: [USER_ID, videoId],
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('History DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete from history', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
