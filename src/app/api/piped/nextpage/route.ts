import { NextRequest, NextResponse } from 'next/server';
import { pipedFetch } from '@/lib/piped-api';

export async function GET(request: NextRequest) {
  try {
    const videoId = request.nextUrl.searchParams.get('videoId') || '';
    const nextpage = request.nextUrl.searchParams.get('nextpage') || '';
    
    if (!videoId && !nextpage) {
      return NextResponse.json({ relatedStreams: [] });
    }

    const path = nextpage
      ? `/nextpage/${videoId}?nextpage=${encodeURIComponent(nextpage)}`
      : `/nextpage/${videoId}`;
    
    const res = await pipedFetch(path);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Nextpage API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch next page', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
