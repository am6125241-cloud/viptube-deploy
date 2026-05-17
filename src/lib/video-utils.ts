/**
 * Utility functions for video formatting and data normalization
 */

/**
 * Format seconds into "12:34" or "1:23:45"
 */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Format view count: 1.2M views, 345K views, etc.
 */
export function formatViews(views: number, suffix = 'views'): string {
  if (!views || views <= 0) return `0 ${suffix}`;
  if (views >= 1_000_000_000) {
    return `${(views / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B ${suffix}`;
  }
  if (views >= 1_000_000) {
    return `${(views / 1_000_000).toFixed(1).replace(/\.0$/, '')}M ${suffix}`;
  }
  if (views >= 1_000) {
    return `${(views / 1_000).toFixed(1).replace(/\.0$/, '')}K ${suffix}`;
  }
  return `${views} ${suffix}`;
}

/**
 * Format a date string to "X time ago" format
 */
export function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  if (diffWeek < 4) return `${diffWeek} week${diffWeek > 1 ? 's' : ''} ago`;
  if (diffMonth < 12) return `${diffMonth} month${diffMonth > 1 ? 's' : ''} ago`;
  return `${diffYear} year${diffYear > 1 ? 's' : ''} ago`;
}

/**
 * Compact format for subscriber count
 */
export function formatSubscribers(count: number | string): string {
  const num = typeof count === 'string' ? parseInt(count.replace(/[^0-9]/g, ''), 10) || 0 : count;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B subscribers`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1).replace(/\.0$/, '')}M subscribers`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1).replace(/\.0$/, '')}K subscribers`;
  return `${num} subscribers`;
}

/**
 * Extract video ID from URL
 */
export function extractVideoId(url: string): string {
  if (!url) return '';
  const watchMatch = url.match(/[?&]v=([^&]+)/);
  if (watchMatch) return watchMatch[1];
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  if (url.startsWith('/watch')) {
    const match = url.match(/v=([^&]+)/);
    if (match) return match[1];
  }
  const parts = url.split('/');
  return parts[parts.length - 1] || '';
}

/**
 * Extract channel ID from URL
 */
export function extractChannelId(url: string): string {
  if (!url) return '';
  const channelMatch = url.match(/\/channel\/([^/?]+)/);
  if (channelMatch) return channelMatch[1];
  const cMatch = url.match(/\/c\/([^/?]+)/);
  if (cMatch) return cMatch[1];
  const handleMatch = url.match(/\/@([^/?]+)/);
  if (handleMatch) return handleMatch[1];
  if (url.startsWith('UC')) return url;
  const parts = url.split('/').filter(Boolean);
  return parts[parts.length - 1] || '';
}

/**
 * YouTube video data from our scraper
 */
export interface YouTubeVideoData {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  channelId: string;
  channelAvatar?: string;
  duration: number;
  views: number;
  uploadedDate: string;
  description?: string;
  isLive?: boolean;
  verified?: boolean;
}

/**
 * Video details response from our API
 */
export interface VideoDetailsResponse {
  video: YouTubeVideoData;
  description?: string;
  relatedVideos: YouTubeVideoData[];
  likes?: string;
  channelInfo?: {
    subscriberCount: string;
    avatar: string;
  };
}

/**
 * YouTube playlist data
 */
export interface YouTubePlaylist {
  playlistId: string;
  title: string;
  thumbnail: string;
  videoCount: number;
  channelName: string;
  channelId: string;
  channelAvatar?: string;
  updatedDate?: string;
}

/**
 * Channel data response from our API
 */
export interface ChannelDataResponse {
  channel: {
    channelId: string;
    channelName: string;
    subscriberCount: string;
    avatar: string;
    banner?: string;
    description?: string;
  };
  videos: YouTubeVideoData[];
  shorts: YouTubeVideoData[];
  playlists: YouTubePlaylist[];
  continuationToken?: string;
}

/**
 * Convert YouTubeVideoData to VideoItem format
 */
export function toVideoItem(v: YouTubeVideoData): import('@/store/app-store').VideoItem {
  return {
    title: v.title,
    thumbnail: v.thumbnail,
    uploaderName: v.channelName,
    uploaderAvatar: v.channelAvatar,
    uploadedDate: v.uploadedDate,
    duration: v.duration,
    views: v.views,
    uploaderVerified: v.verified,
    isShort: (v.duration > 0 && v.duration < 60) || v.isShort || false,
    type: 'video',
    videoId: v.videoId,
    channelId: v.channelId,
  };
}
