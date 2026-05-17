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

    // Mark stale visitors as offline (no heartbeat for 30 seconds)
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
    await client.execute({
      sql: 'UPDATE "SiteVisit" SET "isOnline" = 0 WHERE "isOnline" = 1 AND "lastSeenAt" < ?',
      args: [thirtySecondsAgo],
    });

    // Get all visits (last 500)
    const allVisitsResult = await client.execute({
      sql: 'SELECT * FROM "SiteVisit" ORDER BY "createdAt" DESC LIMIT 500',
      args: [],
    });
    const allVisits = allVisitsResult.rows;

    // Online visitors (currently active)
    const onlineResult = await client.execute({
      sql: 'SELECT * FROM "SiteVisit" WHERE "isOnline" = 1 ORDER BY "lastSeenAt" DESC',
      args: [],
    });
    const onlineVisitors = onlineResult.rows;

    // Total unique visitors
    const uniqueVisitorIds = [...new Set(allVisits.map((v) => v.visitorId as string))];

    // Today's visits
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartISO = todayStart.toISOString();
    const todayVisits = allVisits.filter((v) => {
      const createdAt = v.createdAt as string;
      return createdAt >= todayStartISO;
    });
    const todayUniqueIds = [...new Set(todayVisits.map((v) => v.visitorId as string))];

    // Visits per day for last 7 days
    const dailyStats: { date: string; visits: number; unique: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);
      const dayVisits = allVisits.filter((v) => {
        const createdAt = v.createdAt as string;
        return createdAt >= dayStart.toISOString() && createdAt < dayEnd.toISOString();
      });
      const dayUnique = [...new Set(dayVisits.map((v) => v.visitorId as string))];
      dailyStats.push({
        date: dayStart.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }),
        visits: dayVisits.length,
        unique: dayUnique.length,
      });
    }

    // Device stats
    const deviceStats: Record<string, number> = {};
    const browserStats: Record<string, number> = {};
    const osStats: Record<string, number> = {};
    allVisits.forEach((v) => {
      const device = v.device as string;
      const browser = v.browser as string;
      const os = v.os as string;
      deviceStats[device] = (deviceStats[device] || 0) + 1;
      browserStats[browser] = (browserStats[browser] || 0) + 1;
      osStats[os] = (osStats[os] || 0) + 1;
    });

    // Page stats
    const pageStats: Record<string, number> = {};
    onlineVisitors.forEach((v) => {
      const page = v.page as string;
      pageStats[page] = (pageStats[page] || 0) + 1;
    });

    // Registered users
    const usersResult = await client.execute({
      sql: 'SELECT id, name, email, "createdAt" FROM "User" ORDER BY "createdAt" DESC',
      args: [],
    });
    const registeredUsers = usersResult.rows.map((u) => ({
      id: u.id as string,
      name: u.name as string,
      email: u.email as string,
      createdAt: u.createdAt as string,
    }));

    return NextResponse.json({
      totalVisits: allVisits.length,
      uniqueVisitors: uniqueVisitorIds.length,
      todayVisits: todayVisits.length,
      todayUniqueVisitors: todayUniqueIds.length,
      onlineNow: onlineVisitors.length,
      totalRegisteredUsers: registeredUsers.length,
      dailyStats,
      deviceStats,
      browserStats,
      osStats,
      pageStats,
      onlineVisitors: onlineVisitors.map((v) => ({
        id: v.id,
        visitorId: v.visitorId,
        userName: v.userName,
        device: v.device,
        browser: v.browser,
        os: v.os,
        screenRes: v.screenRes,
        language: v.language,
        page: v.page,
        lastSeenAt: v.lastSeenAt,
        createdAt: v.createdAt,
      })),
      recentVisits: allVisits.slice(0, 50).map((v) => ({
        id: v.id,
        visitorId: v.visitorId,
        userName: v.userName,
        device: v.device,
        browser: v.browser,
        os: v.os,
        page: v.page,
        isOnline: Boolean(v.isOnline),
        createdAt: v.createdAt,
        lastSeenAt: v.lastSeenAt,
      })),
      registeredUsers,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to get stats', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
