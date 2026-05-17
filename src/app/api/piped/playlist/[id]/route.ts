import { NextRequest, NextResponse } from 'next/server';
import { pipedFetch } from '@/lib/piped-api';
import { getPlaylistVideosFromYouTube } from '@/lib/youtube-api';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Playlist ID is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const nextpage = searchParams.get('nextpage');

    // Build the Piped API path
    let pipedPath = `/playlist/${id}`;
    if (nextpage) {
      pipedPath += `?nextpage=${encodeURIComponent(nextpage)}`;
    }

    // Try Piped API first (with longer timeout)
    try {
      const res = await pipedFetch(pipedPath, 10000);
      if (res.ok) {
        const data = await res.json();

        // Format videos — accept any item with a valid url or videoId
        const videos = (data.videos || [])
          .filter((v: any) => {
            if (v.type === 'stream' && v.url) return true;
            if (v.videoId) return true;
            return false;
          })
          .map((v: any) => ({
            videoId: v.url ? v.url.replace('/watch?v=', '') : (v.videoId || ''),
            title: v.title || v.name || 'Untitled',
            thumbnail: v.thumbnail || '',
            channelId: v.uploaderUrl?.replace('/channel/', '') || v.channelId || '',
            channelName: v.uploaderName || v.channelName || '',
            duration: v.duration || 0,
            views: v.views || 0,
            uploaded: v.uploaded || v.uploadedDate || 0,
          }))
          .filter((v: any) => v.videoId && v.videoId.length > 5);

        if (videos.length > 0) {
          return NextResponse.json({
            name: data.name || '',
            thumbnailUrl: data.thumbnailUrl || '',
            uploaderName: data.uploaderName || '',
            uploaderUrl: data.uploaderUrl || '',
            uploaderAvatar: data.uploaderAvatar || '',
            videos,
            nextpage: data.nextpage || null,
          });
        }
      }
      console.log(`[Playlist API] Piped returned no data, falling back to YouTube scrape...`);
    } catch {
      console.log(`[Playlist API] Piped failed, falling back to YouTube scrape...`);
    }

    // Fallback: Scrape YouTube directly for playlist videos
    const ytResult = await getPlaylistVideosFromYouTube(id);
    if (ytResult && ytResult.videos.length > 0) {
      return NextResponse.json({
        name: ytResult.name,
        thumbnailUrl: ytResult.thumbnailUrl,
        uploaderName: ytResult.uploaderName,
        uploaderUrl: ytResult.uploaderUrl,
        uploaderAvatar: ytResult.uploaderAvatar,
        videos: ytResult.videos.map(v => ({
          videoId: v.videoId,
          title: v.title,
          thumbnail: v.thumbnail,
          channelId: v.uploaderUrl?.replace('/channel/', '') || '',
          channelName: v.uploaderName,
          duration: v.duration,
          views: v.views,
          uploaded: v.uploaded,
        })),
        nextpage: null,
      });
    }

    return NextResponse.json(
      { error: 'Failed to fetch playlist from all sources' },
      { status: 404 }
    );
  } catch (err) {
    console.error('[Playlist API] Error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch playlist' },
      { status: 500 }
    );
  }
}
