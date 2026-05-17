import { NextRequest, NextResponse } from 'next/server';
import { getTrending, searchYouTube } from '@/lib/youtube-api';
import { YouTubeVideoData } from '@/lib/video-utils';

export async function GET(request: NextRequest) {
  try {
    const region = request.nextUrl.searchParams.get('region') || 'IN';

    // Primary: Use YouTube scraper for trending (Piped API instances are unreliable)
    let videos: YouTubeVideoData[] = [];

    // 1) Try YouTube scraper first (most reliable)
    try {
      console.log('[Trending] Using YouTube scraper for trending');
      const ytVideos = await getTrending(region);
      videos = ytVideos.map(v => ({
        videoId: v.videoId,
        title: v.title,
        thumbnail: v.thumbnail,
        channelName: v.channelName,
        channelId: v.channelId,
        channelAvatar: v.channelAvatar || '',
        duration: v.duration,
        views: v.views,
        uploadedDate: v.uploadedDate,
        verified: v.verified,
        isLive: v.isLive,
      }));
    } catch (e) {
      console.error('[Trending] YouTube scraper failed:', e);
    }

    // 2) If scraper returned no results, try search-based fallback
    if (videos.length === 0) {
      console.log('[Trending] Using search-based fallback');
      try {
        const fallbackQueries = ['trending videos India 2025', 'popular videos Hindi'];
        const results = await Promise.allSettled(
          fallbackQueries.map(q => searchYouTube(q))
        );
        for (const result of results) {
          if (result.status === 'fulfilled') {
            videos.push(...result.value.videos.map(v => ({
              videoId: v.videoId,
              title: v.title,
              thumbnail: v.thumbnail,
              channelName: v.channelName,
              channelId: v.channelId,
              channelAvatar: v.channelAvatar || '',
              duration: v.duration,
              views: v.views,
              uploadedDate: v.uploadedDate,
              verified: v.verified,
            })));
          }
        }
        // Deduplicate
        const seen = new Set<string>();
        videos = videos.filter(v => {
          if (seen.has(v.videoId)) return false;
          seen.add(v.videoId);
          return true;
        });
      } catch (e) {
        console.error('[Trending] Search fallback also failed:', e);
      }
    }

    return NextResponse.json(videos);
  } catch (error) {
    console.error('Trending API error:', error);
    return NextResponse.json([], { status: 200 });
  }
}
