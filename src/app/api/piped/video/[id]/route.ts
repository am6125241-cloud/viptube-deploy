import { NextRequest, NextResponse } from 'next/server';
import { getVideoDetails } from '@/lib/youtube-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getVideoDetails(id);
    
    if (!data) {
      return NextResponse.json(
        { error: 'Video not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Video API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch video', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
