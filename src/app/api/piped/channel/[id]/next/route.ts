import { NextRequest, NextResponse } from 'next/server';
import { getChannelVideosNextPage } from '@/lib/youtube-api';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { continuationToken } = body;

    if (!continuationToken) {
      return NextResponse.json(
        { error: 'Missing continuation token', code: 'BAD_REQUEST' },
        { status: 400 }
      );
    }

    const result = await getChannelVideosNextPage(id, continuationToken);

    return NextResponse.json({
      videos: result.videos,
      nextContinuationToken: result.nextContinuationToken,
    });
  } catch (error) {
    console.error('Channel next page API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch channel videos', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
