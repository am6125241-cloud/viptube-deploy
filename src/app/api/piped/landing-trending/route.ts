import { NextResponse } from 'next/server';
import { pipedFetch } from '@/lib/piped-api';

// Lightweight endpoint: returns just 3 trending videos for landing page preview
export async function GET() {
  try {
    const res = await pipedFetch('/trending?region=IN');

    if (!res.ok) {
      console.error('[Landing Trending] Piped API returned status', res.status);
      return NextResponse.json([], { status: 200 });
    }

    const data = await res.json();
    const streams: Array<{
      url?: string;
      title?: string;
      thumbnail?: string;
      uploaderName?: string;
      uploaderUrl?: string;
      uploaderAvatar?: string;
      uploadedDate?: string;
      duration?: number;
      views?: number;
      isShort?: boolean;
      type?: string;
    }> = Array.isArray(data) ? data : [];

    // Return first 3 non-short videos with minimal fields for landing page preview
    const preview = streams
      .filter(s => !s.isShort && s.type !== 'channel' && s.url)
      .slice(0, 3)
      .map((s) => {
        let videoId = '';
        const watchMatch = s.url?.match(/[?&]v=([^&]+)/);
        if (watchMatch) videoId = watchMatch[1];

        let channelId = '';
        if (s.uploaderUrl) {
          const channelMatch = s.uploaderUrl.match(/\/(channel|c)\/([^/?]+)/);
          if (channelMatch) channelId = channelMatch[2];
          else {
            const handleMatch = s.uploaderUrl.match(/\/@([^/?]+)/);
            if (handleMatch) channelId = handleMatch[1];
          }
        }

        return {
          videoId,
          title: s.title,
          thumbnail: s.thumbnail,
          channelName: s.uploaderName,
          channelId,
          channelAvatar: s.uploaderAvatar,
          duration: s.duration || 0,
          views: s.views || 0,
          uploadedDate: s.uploadedDate,
        };
      });

    return NextResponse.json(preview);
  } catch (error) {
    console.error('Landing trending API error:', error);
    return NextResponse.json([], { status: 200 }); // Return empty on error, landing page still works
  }
}
