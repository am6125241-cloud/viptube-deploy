import { NextRequest, NextResponse } from 'next/server';
import { pipedFetch } from '@/lib/piped-api';
import { getPlaylistVideosFromYouTube } from '@/lib/youtube-api';

// Always use ytimg.com — Piped proxy URLs are often broken/inaccessible
function ytThumb(videoId: string, quality = 'hqdefault'): string {
  return `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`;
}

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
      const res = await pipedFetch(pipedPath, 12000);
      if (res.ok) {
        const data = await res.json();

        // Format videos — accept any item with a valid url or videoId
        const videos = (data.videos || [])
          .filter((v: any) => {
            if (v.type === 'stream' && v.url) return true;
            if (v.videoId) return true;
            return false;
          })
          .map((v: any) => {
            // Extract videoId robustly — handle both /watch?v=ID and https://youtube.com/watch?v=ID
            let videoId = v.videoId || '';
            if (!videoId && v.url) {
              const m = v.url.match(/[?&]v=([^&]+)/);
              videoId = m ? m[1] : v.url.replace(/^\/watch\?v=/, '');
            }
            return {
              videoId,
              title: v.title || v.name || 'Untitled',
              // ALWAYS use ytimg — Piped proxy thumbnails are unreliable
              thumbnail: videoId ? ytThumb(videoId) : '',
              channelId: v.uploaderUrl?.replace('/channel/', '')?.replace('/@', '') || v.channelId || '',
              channelName: v.uploaderName || v.channelName || '',
              duration: v.duration || 0,
              views: v.views || 0,
              uploaded: v.uploaded || v.uploadedDate || 0,
            };
          })
          .filter((v: any) => v.videoId && v.videoId.length > 5);

        if (videos.length > 0) {
          // Playlist thumbnail — use first video's ytimg thumbnail
          const playlistThumb = videos[0].videoId ? ytThumb(videos[0].videoId) : '';

          return NextResponse.json({
            name: data.name || '',
            thumbnailUrl: playlistThumb,
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
        thumbnailUrl: ytResult.videos[0]?.videoId ? ytThumb(ytResult.videos[0].videoId) : (ytResult.thumbnailUrl || ''),
        uploaderName: ytResult.uploaderName,
        uploaderUrl: ytResult.uploaderUrl,
        uploaderAvatar: ytResult.uploaderAvatar,
        videos: ytResult.videos.map((v: any) => {
          const videoId = v.videoId || v.url?.replace('/watch?v=', '') || '';
          return {
            videoId,
            title: v.title || 'Untitled',
            // ALWAYS use ytimg — YouTube scraper thumbnails may also have issues
            thumbnail: videoId ? ytThumb(videoId) : '',
            channelId: v.uploaderUrl?.replace('/channel/', '')?.replace('/@', '') || '',
            channelName: v.uploaderName || '',
            duration: v.duration || 0,
            views: v.views || 0,
            uploaded: v.uploaded || 0,
          };
        }),
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
