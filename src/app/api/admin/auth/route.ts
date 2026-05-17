import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = 'devil@2024';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();
    if (password === ADMIN_PASSWORD) {
      return NextResponse.json({ success: true, token: ADMIN_PASSWORD });
    }
    return NextResponse.json({ success: false, error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
