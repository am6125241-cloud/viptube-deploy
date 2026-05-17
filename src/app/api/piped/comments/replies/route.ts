import { NextRequest, NextResponse } from 'next/server';
import { fetchCommentsFromAPI } from '@/lib/youtube-api';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    const commentId = request.nextUrl.searchParams.get('commentId');
    const videoId = request.nextUrl.searchParams.get('videoId');

    if (!token) {
      return NextResponse.json(
        { error: 'No continuation token provided', comments: [] },
        { status: 400 }
      );
    }

    console.log(`[Replies] Fetching replies for comment ${commentId} (video: ${videoId})`);

    const result = await fetchCommentsFromAPI(token);

    // Filter out the parent comment if it appears in results
    const replies = result.comments.filter(
      (c: any) => c.commentId !== commentId
    );

    console.log(`[Replies] Found ${replies.length} replies`);

    return NextResponse.json({
      comments: replies,
      nextToken: result.nextToken,
    });
  } catch (error) {
    console.error('Replies API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch replies', comments: [] },
      { status: 502 }
    );
  }
}
