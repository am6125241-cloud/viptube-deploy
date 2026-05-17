import { NextRequest, NextResponse } from 'next/server';
import { searchYouTube, getCategoryVideos, searchMultipleQueries, searchYouTubeFiltered, getSearchSuggestions } from '@/lib/youtube-api';
import { YouTubeVideoData } from '@/lib/video-utils';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') || '';
  const suggestions = request.nextUrl.searchParams.get('suggestions') === 'true';
  const category = request.nextUrl.searchParams.get('category') || '';
  const page = parseInt(request.nextUrl.searchParams.get('page') || '1', 10);
  const filter = request.nextUrl.searchParams.get('filter') || 'videos';

  if (!q.trim() && !category) {
    return NextResponse.json({ videos: [], channels: [], playlists: [] });
  }

  try {
    if (suggestions) {
      const results = await getSearchSuggestions(q);
      return NextResponse.json({ suggestions: results });
    }

    // Category-based fetch — use YouTube scraper directly (Piped unreliable)
    if (category) {
      let videos: YouTubeVideoData[] = [];
      
      try {
        console.log(`[Search] Using YouTube scraper for category: ${category}`);
        const catResult = await getCategoryVideos(category, page);
        videos = catResult.videos.map(v => ({
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
        }));
      } catch (e) {
        console.error('[Search] YouTube scraper failed for category:', category, e);
      }

      return NextResponse.json({
        videos: videos.slice(0, 30),
        hasMore: false,
      });
    }

    // Channel or Playlist filter — use filtered YouTube search
    if (filter === 'channels' || filter === 'playlists') {
      const result = await searchYouTubeFiltered(q, filter);
      return NextResponse.json({
        videos: result.videos,
        channels: result.channels,
        playlists: result.playlists,
      });
    }

    // 'shorts' filter — dedicated shorts search for topic + India results
    if (filter === 'shorts') {
      const [shortsResult, shortsResult2] = await Promise.allSettled([
        searchMultipleQueries([`${q} shorts`, `${q} short video`, `${q} #shorts`, `${q} shorts Hindi`], 40),
        searchMultipleQueries([`${q} shorts India`, `${q} shorts 2025`, `${q} viral shorts India`, `${q} trending shorts Hindi`], 40),
      ]);
      const shorts1 = shortsResult.status === 'fulfilled' ? shortsResult.value.videos : [];
      const shorts2 = shortsResult2.status === 'fulfilled' ? shortsResult2.value.videos : [];
      // Deduplicate by videoId
      const seen = new Set<string>();
      const shorts = [...shorts1, ...shorts2].filter(v => {
        if (seen.has(v.videoId)) return false;
        seen.add(v.videoId);
        return true;
      });
      return NextResponse.json({ videos: [], channels: [], playlists: [], shorts });
    }

    // 'all' filter — multi-query search for mixed results + shorts
    if (filter === 'all') {
      const [videoResult, mixedResult, shortsResult] = await Promise.allSettled([
        searchMultipleQueries([q, `${q} latest`, `${q} popular`, `${q} 2025`, `${q} Hindi`], 60),
        searchYouTubeFiltered(q, 'all'),
        // Dedicated shorts search for the Shorts section
        searchMultipleQueries([`${q} shorts`, `${q} short video`, `${q} #shorts`], 30),
      ]);

      const videos = videoResult.status === 'fulfilled' ? videoResult.value.videos : [];
      const channels = mixedResult.status === 'fulfilled' ? (mixedResult.value.channels || []) : [];
      const playlists = mixedResult.status === 'fulfilled' ? (mixedResult.value.playlists || []) : [];
      const shorts = shortsResult.status === 'fulfilled' ? shortsResult.value.videos : [];

      return NextResponse.json({
        videos,
        channels,
        playlists,
        shorts,
      });
    }

    // 'videos' filter — multi-query search for more video results
    const queries = [q, `${q} latest`, `${q} popular`, `${q} 2025`, `${q} Hindi`, `${q} India`, `${q} video`, `${q} best`, `${q} top`];
    const result = await searchMultipleQueries(queries, 100);

    return NextResponse.json({
      videos: result.videos,
      channels: [],
      playlists: [],
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
