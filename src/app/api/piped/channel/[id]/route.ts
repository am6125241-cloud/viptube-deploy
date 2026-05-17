import { NextRequest, NextResponse } from 'next/server';
import { getChannelData } from '@/lib/youtube-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data = await getChannelData(id);
    
    if (!data) {
      return NextResponse.json(
        { error: 'Channel not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      channel: data.channel,
      videos: data.videos,
      shorts: data.shorts || [],
      playlists: data.playlists || [],
      continuationToken: data.continuationToken,
    });
  } catch (error) {
    console.error('Channel API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
