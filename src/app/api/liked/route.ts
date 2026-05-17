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
      sql: 'SELECT * FROM "LikedVideo" WHERE "userId" = ? ORDER BY "likedAt" DESC',
      args: [USER_ID],
    });

    const liked = result.rows.map((row) => ({
      id: row.id as string,
      videoId: row.videoId as string,
      title: row.title as string,
      thumbnail: row.thumbnail as string,
      channelId: row.channelId as string,
      channelName: row.channelName as string,
      duration: Number(row.duration),
      likedAt: row.likedAt as string,
      userId: row.userId as string,
    }));

    return NextResponse.json(liked);
  } catch (error) {
    console.error('Liked GET error:', error);
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
    const { videoId, title, thumbnail, channelId, channelName, duration, action } = body;

    if (action === 'like') {
      // Remove from disliked if exists
      await client.execute({
        sql: 'DELETE FROM "DislikedVideo" WHERE "userId" = ? AND "videoId" = ?',
        args: [USER_ID, videoId],
      });

      // Upsert liked
      await client.execute({
        sql: `INSERT OR REPLACE INTO "LikedVideo" (id, "userId", "videoId", title, thumbnail, "channelId", "channelName", duration, "likedAt")
             VALUES (
               (SELECT id FROM "LikedVideo" WHERE "userId" = ? AND "videoId" = ?),
               ?, ?, ?, ?, ?, ?, ?, ?
             )`,
        args: [USER_ID, videoId, USER_ID, videoId, title, thumbnail, channelId, channelName, duration || 0, new Date().toISOString()],
      });

      const item = await client.execute({
        sql: 'SELECT * FROM "LikedVideo" WHERE "userId" = ? AND "videoId" = ?',
        args: [USER_ID, videoId],
      });
      const row = item.rows[0];
      return NextResponse.json({
        id: row?.id,
        videoId: row?.videoId,
        title: row?.title,
        thumbnail: row?.thumbnail,
        channelId: row?.channelId,
        channelName: row?.channelName,
        duration: row ? Number(row.duration) : 0,
        likedAt: row?.likedAt,
        userId: row?.userId,
      });
    } else if (action === 'dislike') {
      // Remove from liked if exists
      await client.execute({
        sql: 'DELETE FROM "LikedVideo" WHERE "userId" = ? AND "videoId" = ?',
        args: [USER_ID, videoId],
      });

      // Upsert disliked
      await client.execute({
        sql: `INSERT OR REPLACE INTO "DislikedVideo" (id, "userId", "videoId", "dislikedAt")
             VALUES (
               (SELECT id FROM "DislikedVideo" WHERE "userId" = ? AND "videoId" = ?),
               ?, ?, ?
             )`,
        args: [USER_ID, videoId, USER_ID, videoId, new Date().toISOString()],
      });

      const item = await client.execute({
        sql: 'SELECT * FROM "DislikedVideo" WHERE "userId" = ? AND "videoId" = ?',
        args: [USER_ID, videoId],
      });
      const row = item.rows[0];
      return NextResponse.json({
        id: row?.id,
        videoId: row?.videoId,
        dislikedAt: row?.dislikedAt,
        userId: row?.userId,
      });
    } else if (action === 'remove_like') {
      await client.execute({
        sql: 'DELETE FROM "LikedVideo" WHERE "userId" = ? AND "videoId" = ?',
        args: [USER_ID, videoId],
      });
      return NextResponse.json({ success: true });
    } else if (action === 'remove_dislike') {
      await client.execute({
        sql: 'DELETE FROM "DislikedVideo" WHERE "userId" = ? AND "videoId" = ?',
        args: [USER_ID, videoId],
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Liked POST error:', error);
    return NextResponse.json(
      { error: 'Failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
