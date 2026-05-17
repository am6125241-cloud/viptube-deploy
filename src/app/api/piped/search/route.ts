import { NextRequest, NextResponse } from 'next/server';
import { pipedFetch } from '@/lib/piped-api';
import { YouTubeVideoData } from '@/lib/video-utils';
import { searchYouTube, getCategoryVideos, searchMultipleQueries, searchYouTubeFiltered, getSearchSuggestions } from '@/lib/youtube-api';

// ============================================================
// PIPED SEARCH — Primary (fast, reliable)
// ============================================================

interface PipedStream {
  url?: string;
  type: 'stream';
  title?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploaderUrl?: string;
  uploaderAvatar?: string;
  uploadedDate?: string;
  duration?: number;
  views?: number;
  uploaded?: number;
  isShort?: boolean;
  shortDescription?: string;
}

interface PipedChannel {
  url?: string;
  type: 'channel';
  name?: string;
  thumbnail?: string;
  subscribers?: number;
  description?: string;
  uploaderAvatar?: string;
  verified?: boolean;
}

interface PipedPlaylist {
  url?: string;
  type: 'playlist';
  name?: string;
  thumbnail?: string;
  uploaderName?: string;
  uploaderUrl?: string;
  videos?: number;
  uploaderAvatar?: string;
}

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

  // Map our filter to Piped filter
  let pipedFilter = 'videos';
  if (filter === 'channels') pipedFilter = 'channels';
  else if (filter === 'playlists') pipedFilter = 'playlists';
  else if (filter === 'shorts') pipedFilter = 'shorts';
  else if (filter === 'all') pipedFilter = 'all';
  else pipedFilter = 'videos';

  try {
    const res = await pipedFetch(`/search?q=${encodeURIComponent(query)}&filter=${pipedFilter}`, 10000);
    if (!res.ok) return { videos, channels, playlists };
    const items = await res.json();

    if (!Array.isArray(items)) return { videos, channels, playlists };

    for (const item of items) {
      if (item.type === 'stream') {
        const stream = item as PipedStream;
        const videoId = extractVideoIdFromUrl(stream.url || '');
        if (!videoId || !stream.title) continue;

        // For shorts filter, only include shorts (< 60s)
        if (filter === 'shorts' && stream.duration && stream.duration >= 60) continue;
        // For videos filter, exclude shorts
        if (filter === 'videos' && stream.duration && stream.duration < 60 && stream.isShort) continue;

        videos.push({
          videoId,
          title: stream.title || '',
          thumbnail: stream.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          channelName: stream.uploaderName || '',
          channelId: extractChannelIdFromUrl(stream.uploaderUrl || ''),
          channelAvatar: stream.uploaderAvatar || '',
          duration: stream.duration || 0,
          views: stream.views || 0,
          uploadedDate: stream.uploadedDate || '',
          isShort: stream.isShort || (stream.duration > 0 && stream.duration < 60) || false,
        });
      } else if (item.type === 'channel') {
        const ch = item as PipedChannel;
        const channelId = extractChannelIdFromUrl(ch.url || '');
        if (!channelId || !ch.name) continue;

        channels.push({
          channelId,
          name: ch.name || '',
          avatar: ch.thumbnail || ch.uploaderAvatar || '',
          subscribers: ch.subscribers ? `${ch.subscribers} subscribers` : '',
          description: ch.description || '',
          verified: ch.verified || false,
        });
      } else if (item.type === 'playlist') {
        const pl = item as PipedPlaylist;
        const playlistId = extractPlaylistIdFromUrl(pl.url || '');
        if (!playlistId || !pl.name) continue;

        playlists.push({
          playlistId,
          title: pl.name || '',
          thumbnail: pl.thumbnail || '',
          videoCount: pl.videos || 0,
          channelName: pl.uploaderName || '',
          channelId: extractChannelIdFromUrl(pl.uploaderUrl || ''),
        });
      }
    }
  } catch (e) {
    console.error('[Search] Piped search error:', e);
  }

  return { videos, channels, playlists };
}

// Search Piped with multiple queries in parallel for more results
async function searchPipedMultiple(queries: string[], filter: string, maxTotal = 80): Promise<YouTubeVideoData[]> {
  const BATCH_SIZE = 3;
  let allVideos: YouTubeVideoData[] = [];
  const seenIds = new Set<string>();

  for (let i = 0; i < queries.length; i += BATCH_SIZE) {
    const batch = queries.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(q => searchPiped(q, filter))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        for (const v of r.value.videos) {
          if (!seenIds.has(v.videoId)) {
            seenIds.add(v.videoId);
            allVideos.push(v);
          }
        }
      }
    }
    if (allVideos.length >= maxTotal) break;
  }

  return allVideos.slice(0, maxTotal);
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

    // Category-based fetch — keep using YouTube scraper with category queries
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
    // PIPED FIRST — for all search filters
    // ============================================================

    // 'videos' filter — Piped multi-query for max results
    if (filter === 'videos') {
      // Try Piped first with multiple queries
      const pipedQueries = [q, `${q} latest`, `${q} 2025`, `${q} Hindi`, `${q} India`, `${q} popular`, `${q} best`, `${q} top`, `${q} new`];
      const pipedVideos = await searchPipedMultiple(pipedQueries, 'videos', 100);

      // If Piped returned good results, use them
      if (pipedVideos.length >= 5) {
        return NextResponse.json({ videos: pipedVideos, channels: [], playlists: [] });
      }

      // Fallback to YouTube scraping
      console.log('[Search] Piped returned few results, falling back to YouTube scraper');
      const ytQueries = [q, `${q} latest`, `${q} popular`, `${q} 2025`, `${q} Hindi`, `${q} India`];
      const ytResult = await searchMultipleQueries(ytQueries, 100);
      const combined = [...pipedVideos];
      const seenIds = new Set(pipedVideos.map(v => v.videoId));
      for (const v of ytResult.videos) {
        if (!seenIds.has(v.videoId)) {
          seenIds.add(v.videoId);
          combined.push(v);
        }
      }
      return NextResponse.json({ videos: combined.slice(0, 100), channels: [], playlists: [] });
    }

    // 'shorts' filter — Piped shorts search
    if (filter === 'shorts') {
      const shortsQueries = [q, `${q} shorts`, `${q} short video`, `${q} shorts Hindi`, `${q} shorts India`, `${q} trending shorts`];
      const pipedShorts = await searchPipedMultiple(shortsQueries, 'shorts', 80);

      if (pipedShorts.length >= 3) {
        return NextResponse.json({ videos: [], channels: [], playlists: [], shorts: pipedShorts });
      }

      // Fallback to YouTube scraper
      console.log('[Search] Piped shorts returned few results, falling back to YouTube');
      const [shortsResult] = await Promise.allSettled([
        searchMultipleQueries([`${q} shorts`, `${q} short video`, `${q} #shorts`, `${q} shorts Hindi`], 40),
      ]);
      const ytShorts = shortsResult.status === 'fulfilled' ? shortsResult.value.videos : [];
      const combined = [...pipedShorts];
      const seenIds = new Set(pipedShorts.map(v => v.videoId));
      for (const v of ytShorts) {
        if (!seenIds.has(v.videoId)) {
          seenIds.add(v.videoId);
          combined.push(v);
        }
      }
      return NextResponse.json({ videos: [], channels: [], playlists: [], shorts: combined });
    }

    // 'channels' filter — Piped channels search
    if (filter === 'channels') {
      const pipedResult = await searchPiped(q, 'channels');
      if (pipedResult.channels.length >= 1) {
        return NextResponse.json({ videos: [], channels: pipedResult.channels, playlists: [] });
      }
      // Fallback
      const ytResult = await searchYouTubeFiltered(q, 'channels');
      return NextResponse.json({ videos: ytResult.videos, channels: ytResult.channels, playlists: ytResult.playlists });
    }

    // 'playlists' filter — Piped playlists search
    if (filter === 'playlists') {
      const pipedResult = await searchPiped(q, 'playlists');
      if (pipedResult.playlists.length >= 1) {
        return NextResponse.json({ videos: [], channels: [], playlists: pipedResult.playlists });
      }
      // Fallback
      const ytResult = await searchYouTubeFiltered(q, 'playlists');
      return NextResponse.json({ videos: ytResult.videos, channels: ytResult.channels, playlists: ytResult.playlists });
    }

    // 'all' filter — Piped all search + dedicated shorts
    if (filter === 'all') {
      const [videoResult, shortsResult] = await Promise.allSettled([
        searchPipedMultiple([q, `${q} latest`, `${q} popular`, `${q} 2025`, `${q} Hindi`], 'videos', 60),
        searchPipedMultiple([`${q} shorts`, `${q} short video`, `${q} #shorts`], 'shorts', 30),
      ]);

      const pipedVideos = videoResult.status === 'fulfilled' ? videoResult.value : [];
      const pipedShorts = shortsResult.status === 'fulfilled' ? shortsResult.value : [];

      // Also get channels and playlists from Piped
      const { channels, playlists } = await searchPiped(q, 'all');

      // If Piped gave good results, return them
      if (pipedVideos.length >= 5 || channels.length >= 1 || playlists.length >= 1) {
        return NextResponse.json({ videos: pipedVideos, channels, playlists, shorts: pipedShorts });
      }

      // Fallback to YouTube
      console.log('[Search] Piped "all" returned few results, falling back to YouTube');
      const [ytVideoResult, ytMixedResult, ytShortsResult] = await Promise.allSettled([
        searchMultipleQueries([q, `${q} latest`, `${q} popular`], 60),
        searchYouTubeFiltered(q, 'all'),
        searchMultipleQueries([`${q} shorts`, `${q} short video`], 30),
      ]);
      const ytVideos = ytVideoResult.status === 'fulfilled' ? ytVideoResult.value.videos : [];
      const ytChannels = ytMixedResult.status === 'fulfilled' ? (ytMixedResult.value.channels || []) : [];
      const ytPlaylists = ytMixedResult.status === 'fulfilled' ? (ytMixedResult.value.playlists || []) : [];
      const ytShorts = ytShortsResult.status === 'fulfilled' ? ytShortsResult.value.videos : [];

      // Merge Piped + YouTube results
      const seenIds = new Set(pipedVideos.map(v => v.videoId));
      const combinedVideos = [...pipedVideos];
      for (const v of ytVideos) {
        if (!seenIds.has(v.videoId)) { seenIds.add(v.videoId); combinedVideos.push(v); }
      }
      const seenShortIds = new Set(pipedShorts.map(v => v.videoId));
      const combinedShorts = [...pipedShorts];
      for (const v of ytShorts) {
        if (!seenShortIds.has(v.videoId)) { seenShortIds.add(v.videoId); combinedShorts.push(v); }
      }

      return NextResponse.json({
        videos: combinedVideos.slice(0, 60),
        channels: channels.length > 0 ? channels : ytChannels,
        playlists: playlists.length > 0 ? playlists : ytPlaylists,
        shorts: combinedShorts.slice(0, 30),
      });
    }

    // Default fallback
    return NextResponse.json({ videos: [], channels: [], playlists: [] });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { error: 'Failed to search', code: 'FETCH_ERROR' },
      { status: 502 }
    );
  }
}
