import { NextRequest, NextResponse } from 'next/server';
import { getVideoComments } from '@/lib/youtube-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const maxComments = request.nextUrl.searchParams.get('max') 
      ? parseInt(request.nextUrl.searchParams.get('max')!, 10) 
      : 30;
    
    const result = await getVideoComments(id, maxComments);
    
    return NextResponse.json({
      comments: result.comments,
      commentCount: result.commentCount,
      continuationToken: result.nextContinuationToken,
    });
  } catch (error) {
    console.error('Comments API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
