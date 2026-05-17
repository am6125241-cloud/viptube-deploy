import { NextRequest, NextResponse } from 'next/server';
import { pipedFetch } from '@/lib/piped-api';
import { YouTubeVideoData } from '@/lib/video-utils';
import { searchYouTube, getCategoryVideos, searchMultipleQueries, searchYouTubeFiltered, getSearchSuggestions } from '@/lib/youtube-api';

// ============================================================
// PIPED SEARCH — Primary (fast, reliable)
// ============================================================

function extractVideoIdFromUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/[?&]v=([^&]+)/);
  if (match) return match[1];
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function extractChannelIdFromUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/\/channel\/([^/?]+)/);
  if (match) return match[1];
  const handleMatch = url.match(/\/@([^/?]+)/);
  if (handleMatch) return handleMatch[1];
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

function extractPlaylistIdFromUrl(url: string): string {
  if (!url) return '';
  const match = url.match(/[?&]list=([^&]+)/);
  if (match) return match[1];
  return '';
}

async function searchPiped(query: string, filter: string): Promise<{
  videos: YouTubeVideoData[];
  channels: { channelId: string; name: string; avatar: string; subscribers: string; description: string; verified: boolean }[];
  playlists: { playlistId: string; title: string; thumbnail: string; videoCount: number; channelName: string; channelId: string }[];
}> {
  const videos: YouTubeVideoData[] = [];
  const channels: any[] = [];
  const playlists: any[] = [];

  let pipedFilter = 'videos';
  if (filter === 'channels') pipedFilter = 'channels';
  else if (filter === 'playlists') pipedFilter = 'playlists';
  else if (filter === 'shorts') pipedFilter = 'shorts';
  else if (filter === 'all') pipedFilter = 'all';

  try {
    const res = await pipedFetch(`/search?q=${encodeURIComponent(query)}&filter=${pipedFilter}`, 12000);
    if (!res.ok) return { videos, channels, playlists };
    const items = await res.json();
    if (!Array.isArray(items)) return { videos, channels, playlists };

    for (const item of items) {
      if (item.type === 'stream') {
        const videoId = extractVideoIdFromUrl(item.url || '');
        if (!videoId || !item.title) continue;

        // For shorts filter, only include shorts (< 60s)
        if (filter === 'shorts' && item.duration && item.duration >= 60) continue;
        // For videos filter, exclude shorts
        if (filter === 'videos' && item.duration && item.duration < 60 && item.isShort) continue;

        videos.push({
          videoId,
          title: item.title || '',
          thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          channelName: item.uploaderName || '',
          channelId: extractChannelIdFromUrl(item.uploaderUrl || ''),
          channelAvatar: item.uploaderAvatar || '',
          duration: item.duration || 0,
          views: item.views || 0,
          uploadedDate: item.uploadedDate || '',
          isShort: item.isShort || (item.duration > 0 && item.duration < 60) || false,
        });
      } else if (item.type === 'channel') {
        const channelId = extractChannelIdFromUrl(item.url || '');
        if (!channelId || !item.name) continue;
        channels.push({
          channelId,
          name: item.name || '',
          avatar: item.thumbnail || item.uploaderAvatar || '',
          subscribers: item.subscribers ? `${item.subscribers} subscribers` : '',
          description: item.description || '',
          verified: item.verified || false,
        });
      } else if (item.type === 'playlist') {
        const playlistId = extractPlaylistIdFromUrl(item.url || '');
        if (!playlistId || !item.name) continue;
        playlists.push({
          playlistId,
          title: item.name || '',
          thumbnail: item.thumbnail || '',
          videoCount: item.videos || 0,
          channelName: item.uploaderName || '',
          channelId: extractChannelIdFromUrl(item.uploaderUrl || ''),
        });
      }
    }
  } catch (e) {
    console.error('[Search] Piped search error:', e);
  }

  return { videos, channels, playlists };
}

// Merge videos deduplicating by videoId
function mergeVideos(...arrays: YouTubeVideoData[][]): YouTubeVideoData[] {
  const seen = new Set<string>();
  const merged: YouTubeVideoData[] = [];
  for (const arr of arrays) {
    for (const v of arr) {
      if (v.videoId && !seen.has(v.videoId)) {
        seen.add(v.videoId);
        merged.push(v);
      }
    }
  }
  return merged;
}

// ============================================================
// MAIN SEARCH ROUTE
// ============================================================

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
    // Suggestions — always use YouTube suggestions API
    if (suggestions) {
      const results = await getSearchSuggestions(q);
      return NextResponse.json({ suggestions: results });
    }

    // Category-based fetch
    if (category) {
      let videos: YouTubeVideoData[] = [];
      try {
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
        console.error('[Search] Category fetch failed:', e);
      }
      return NextResponse.json({ videos: videos.slice(0, 30), hasMore: false });
    }

    // ============================================================
    // 'videos' filter — Piped single query + variant as fallback
    // ============================================================
    if (filter === 'videos') {
      // Try Piped with the exact query first
      const piped1 = await searchPiped(q, 'videos');
      // Also try a variant query in parallel
      const piped2 = await searchPiped(`${q} 2025`, 'videos');
      const pipedVideos = mergeVideos(piped1.videos, piped2.videos);

      if (pipedVideos.length >= 8) {
        return NextResponse.json({ videos: pipedVideos.slice(0, 100), channels: [], playlists: [] });
      }

      // Piped returned few results — add YouTube scraper as supplement
      console.log(`[Search] Piped returned ${pipedVideos.length} videos, supplementing with YouTube scraper`);
      const ytResult = await searchMultipleQueries([q, `${q} latest`, `${q} popular`], 80);
      const combined = mergeVideos(pipedVideos, ytResult.videos);
      return NextResponse.json({ videos: combined.slice(0, 100), channels: [], playlists: [] });
    }

    // ============================================================
    // 'shorts' filter
    // ============================================================
    if (filter === 'shorts') {
      const [piped1, piped2] = await Promise.allSettled([
        searchPiped(`${q} shorts`, 'shorts'),
        searchPiped(q, 'shorts'),
      ]);
      const p1 = piped1.status === 'fulfilled' ? piped1.value.videos : [];
      const p2 = piped2.status === 'fulfilled' ? piped2.value.videos : [];
      const pipedShorts = mergeVideos(p1, p2);

      if (pipedShorts.length >= 3) {
        return NextResponse.json({ videos: [], channels: [], playlists: [], shorts: pipedShorts });
      }

      // YouTube fallback for shorts
      console.log('[Search] Piped shorts low, falling back to YouTube');
      const ytResult = await searchMultipleQueries([`${q} shorts`, `${q} short video`, `${q} #shorts`], 40);
      const combined = mergeVideos(pipedShorts, ytResult.videos);
      return NextResponse.json({ videos: [], channels: [], playlists: [], shorts: combined });
    }

    // ============================================================
    // 'channels' filter
    // ============================================================
    if (filter === 'channels') {
      const pipedResult = await searchPiped(q, 'channels');
      if (pipedResult.channels.length >= 1) {
        return NextResponse.json({ videos: [], channels: pipedResult.channels, playlists: [] });
      }
      const ytResult = await searchYouTubeFiltered(q, 'channels');
      return NextResponse.json({ videos: ytResult.videos, channels: ytResult.channels, playlists: ytResult.playlists });
    }

    // ============================================================
    // 'playlists' filter
    // ============================================================
    if (filter === 'playlists') {
      const pipedResult = await searchPiped(q, 'playlists');
      if (pipedResult.playlists.length >= 1) {
        return NextResponse.json({ videos: [], channels: [], playlists: pipedResult.playlists });
      }
      const ytResult = await searchYouTubeFiltered(q, 'playlists');
      return NextResponse.json({ videos: ytResult.videos, channels: ytResult.channels, playlists: ytResult.playlists });
    }

    // ============================================================
    // 'all' filter — Piped + dedicated shorts
    // ============================================================
    if (filter === 'all') {
      // Get videos, channels, playlists from Piped 'all' filter
      const pipedAll = await searchPiped(q, 'all');
      // Get dedicated shorts
      const pipedShorts = await searchPiped(`${q} shorts`, 'shorts');

      // If we got decent results from Piped, return them
      if (pipedAll.videos.length >= 5 || pipedAll.channels.length >= 1 || pipedAll.playlists.length >= 1) {
        return NextResponse.json({
          videos: pipedAll.videos.slice(0, 60),
          channels: pipedAll.channels,
          playlists: pipedAll.playlists,
          shorts: pipedShorts.videos.slice(0, 30),
        });
      }

      // Piped low results — supplement with YouTube scraper
      console.log('[Search] Piped "all" low, supplementing with YouTube');
      const [ytVideoResult, ytMixedResult, ytShortsResult] = await Promise.allSettled([
        searchMultipleQueries([q, `${q} latest`, `${q} popular`], 60),
        searchYouTubeFiltered(q, 'all'),
        searchMultipleQueries([`${q} shorts`, `${q} short video`], 30),
      ]);
      const ytVideos = ytVideoResult.status === 'fulfilled' ? ytVideoResult.value.videos : [];
      const ytChannels = ytMixedResult.status === 'fulfilled' ? (ytMixedResult.value.channels || []) : [];
      const ytPlaylists = ytMixedResult.status === 'fulfilled' ? (ytMixedResult.value.playlists || []) : [];
      const ytShorts = ytShortsResult.status === 'fulfilled' ? ytShortsResult.value.videos : [];

      return NextResponse.json({
        videos: mergeVideos(pipedAll.videos, ytVideos).slice(0, 60),
        channels: pipedAll.channels.length > 0 ? pipedAll.channels : ytChannels,
        playlists: pipedAll.playlists.length > 0 ? pipedAll.playlists : ytPlaylists,
        shorts: mergeVideos(pipedShorts.videos, ytShorts).slice(0, 30),
      });
    }

    return NextResponse.json({ videos: [], channels: [], playlists: [] });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
