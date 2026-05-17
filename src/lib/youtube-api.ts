// YouTube server-side scraper and API utility
// Parses ytInitialData from YouTube pages for reliable data extraction

const YOUTUBE_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// Debug flags (prevent repeated debug logs)
let _playlistLockupDebugLogged = false;
let _shortsLockupDebugLogged = false;

export interface YouTubeVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  channelId: string;
  channelAvatar?: string;
  duration: number; // seconds
  views: number;
  uploadedDate: string;
  description?: string;
  isLive?: boolean;
  verified?: boolean;
}

export interface YouTubeChannelInfo {
  channelId: string;
  channelName: string;
  subscriberCount: string;
  avatar: string;
  banner?: string;
  description?: string;
  videoCount?: string;
}

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

// Parse duration string like "1:23:45", "3:21", "PT1H23M45S"
function parseDuration(duration: string): number {
  if (!duration) return 0;
  if (duration.startsWith('PT')) {
    let seconds = 0;
    const h = duration.match(/(\d+)H/);
    const m = duration.match(/(\d+)M/);
    const s = duration.match(/(\d+)S/);
    if (h) seconds += parseInt(h[1]) * 3600;
    if (m) seconds += parseInt(m[1]) * 60;
    if (s) seconds += parseInt(s[1]);
    return seconds;
  }
  const parts = duration.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parseInt(duration) || 0;
}

// Parse view count string "1.2M views", "345,446 views", etc to number
function parseViewCount(text: string): number {
  if (!text) return 0;
  // Remove non-numeric except K, M, B, k, m, b
  const cleaned = text.replace(/[^0-9.KMBkmb]/g, '').trim();
  if (!cleaned) return 0;
  const num = parseFloat(cleaned);
  if (cleaned.match(/[Bb]$/)) return Math.round(num * 1e9);
  if (cleaned.match(/[Mm]$/)) return Math.round(num * 1e6);
  if (cleaned.match(/[Kk]$/)) return Math.round(num * 1e3);
  // Handle comma-separated numbers
  const commas = text.replace(/[^0-9]/g, '').trim();
  return parseInt(commas) || 0;
}

// Fetch YouTube page and extract ytInitialData (with timeout)
async function fetchYouTubePage(url: string, timeoutMs = 6000): Promise<any | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const resp = await fetch(url, {
      headers: { 
        'User-Agent': YOUTUBE_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'CONSENT=YES+1; GDPR_CONSENT=1; SOCS=CAESNQgDEitib3FQZ2dvSUg6CAJiIQIBAA==',
      },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const html = await resp.text();
  
  // Check if redirected to consent page - retry with consent cookie
  if (html.includes('consent.google') || html.includes('youtube.com/pagead/')) {
    console.log(`[YouTube] Got consent redirect for ${url}, retrying with consent params...`);
    try {
      const consentController = new AbortController();
      const consentTimeout = setTimeout(() => consentController.abort(), 5000);
      const consentResp = await fetch(url, {
        headers: { 
          'User-Agent': YOUTUBE_USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': 'CONSENT=YES+1; GDPR_CONSENT=1; SOCS=CAESNQgDEitib3FQZ2dvSUg6CAJiIQIBAA==',
        },
        signal: consentController.signal,
      });
      clearTimeout(consentTimeout);
      const consentHtml = await consentResp.text();
      const consentMatch = consentHtml.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      if (consentMatch) {
        try { return JSON.parse(consentMatch[1]); } catch {}
      }
    } catch {}
  }
  
  // Extract ytInitialData JSON - try multiple patterns
  // Pattern 1: Standard format
  let match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  // Pattern 2: With extra whitespace
  if (!match) match = html.match(/var ytInitialData\s*=\s*(\{.*?\})\s*;<\/script>/s);
  // Pattern 3: Alternative assignment
  if (!match) match = html.match(/ytInitialData\s*=\s*(\{.*?\})\s*;<\/script>/s);
  
  // Pattern 4: Robust brace-counting extraction (handles very large JSON objects)
  if (!match) {
    const startIndex = html.indexOf('var ytInitialData = ');
    if (startIndex !== -1) {
      const jsonStart = html.indexOf('{', startIndex);
      if (jsonStart !== -1) {
        let depth = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < html.length; i++) {
          if (html[i] === '{') depth++;
          else if (html[i] === '}') {
            depth--;
            if (depth === 0) { jsonEnd = i + 1; break; }
          }
        }
        if (jsonEnd !== -1) {
          const jsonStr = html.substring(jsonStart, jsonEnd);
          try {
            return JSON.parse(jsonStr);
          } catch {}
        }
      }
    }
  }
  
  if (!match) return null;
  
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    console.log(`[YouTube] Failed to parse ytInitialData JSON for ${url}: ${e}`);
    return null;
  }
  } catch (err: any) {
    if (err.name === 'AbortError') {
      console.log(`[YouTube] Request timed out for ${url}`);
    } else {
      console.error(`[YouTube] Fetch error for ${url}:`, err.message);
    }
    return null;
  }
}

// Extract videoId from lockupViewModel thumbnail URL (e.g. /vi/VIDEO_ID/)
function extractVideoIdFromLockup(lockup: any): string {
  // Try thumbnail sources first
  const imgSources = lockup?.contentImage?.thumbnailViewModel?.image?.sources || [];
  if (imgSources.length > 0) {
    const thumbUrl = imgSources[0]?.url || '';
    const vidMatch = thumbUrl.match(/\/vi\/([^/]+)\//);
    if (vidMatch) return vidMatch[1];
  }
  // Try onClick navigation endpoint for videoId
  const command = lockup?.rendererContext?.commandContext?.onTap?.innertubeCommand;
  if (command?.watchEndpoint?.videoId) return command.watchEndpoint.videoId;
  // Try browse endpoint (could be a channel, not a video)
  if (command?.browseEndpoint?.browseId?.startsWith('UC')) return ''; // channels, not videos
  return '';
}

// Parse a lockupViewModel into a YouTubeVideo (YouTube 2025+ format)
function parseLockupViewModel(lockup: any): YouTubeVideo | null {
  const videoId = extractVideoIdFromLockup(lockup);
  if (!videoId) return null;

  const title = lockup?.metadata?.lockupMetadataViewModel?.title?.content || '';
  if (!title) return null;

  // Build thumbnail URL from videoId
  const thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  // Extract metadata (channel name, views, date) from metadataRows
  const metaRows = lockup?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
  let channelName = '';
  let viewsText = '';
  let uploadedDate = '';
  let durationText = '';
  let isLive = false;

  for (const row of metaRows) {
    for (const part of row?.metadataParts || []) {
      const text = part?.text?.content || '';
      if (!text) continue;

      // First non-empty text is usually channel name
      if (!channelName) {
        channelName = text;
        continue;
      }

      // Duration (e.g. "12:34", "1:23:45")
      if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(text) && !durationText) {
        durationText = text;
        continue;
      }

      // LIVE badge
      if (text.toUpperCase() === 'LIVE' || text === 'LIVE NOW') {
        isLive = true;
        continue;
      }

      // Views (contains "view", "次", "观看", etc.)
      if (/view|次|观看|fois|visualiz/i.test(text) || /^\d[\d.,]*[KMBT]?\s*(views|次|观看)?$/i.test(text)) {
        viewsText = text;
        continue;
      }

      // Date (e.g. "3 days ago", "19 小時前")
      if (/\d+\s*(hour|hr|day|week|month|year|ago|前|時|日|週|月|年|heure|jour|semaine|mois|an)/i.test(text)) {
        uploadedDate = text;
        continue;
      }

      // Pure number might be view count
      if (/^\d[\d,.]+$/.test(text) && !viewsText) {
        viewsText = text;
        continue;
      }
    }
  }

  // Extract channel avatar
  const avatarSources = lockup?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources || [];
  const channelAvatar = avatarSources[0]?.url || '';

  // Extract channel ID from navigation
  const navCommand = lockup?.rendererContext?.commandContext?.onTap?.innertubeCommand;
  const channelId = navCommand?.browseEndpoint?.browseId || navCommand?.watchEndpoint?.browseId || '';

  // Extract duration from thumbnail overlays (badge)
  const overlays = lockup?.contentImage?.thumbnailViewModel?.overlays || [];
  for (const overlay of overlays) {
    const badges = overlay?.thumbnailBottomOverlayViewModel?.badges || [];
    for (const b of badges) {
      const dur = b?.thumbnailBadgeViewModel?.text || '';
      if (dur && dur.includes(':')) {
        durationText = dur;
        break;
      }
    }
  }

  return {
    videoId,
    title,
    thumbnail,
    channelName,
    channelId,
    channelAvatar,
    duration: parseDuration(durationText),
    views: parseViewCount(viewsText),
    uploadedDate,
    verified: false,
    isLive,
  };
}

// Extract videos from ytInitialData search results
function extractVideosFromSearch(ytData: any): YouTubeVideo[] {
  const videos: YouTubeVideo[] = [];
  
  try {
    const sections = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    
    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      
      for (const item of items) {
        // Try lockupViewModel format first (YouTube 2025+)
        if (item?.lockupViewModel) {
          const video = parseLockupViewModel(item.lockupViewModel);
          if (video) {
            videos.push(video);
            continue;
          }
        }

        // Fallback: legacy videoRenderer / gridVideoRenderer format
        const renderer = item?.videoRenderer || item?.gridVideoRenderer;
        if (!renderer?.videoId) continue;
        
        const title = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || '';
        if (!title) continue;
        
        const thumbnails = renderer.thumbnail?.thumbnails || [];
        const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
        
        const channelName = renderer.longBylineText?.runs?.[0]?.text || 
                           renderer.shortBylineText?.runs?.[0]?.text || '';
        
        const channelId = renderer.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
        
        const durationText = renderer.lengthText?.simpleText || renderer.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText || '';
        const duration = parseDuration(durationText);
        
        const viewCountText = renderer.viewCountText?.simpleText || renderer.shortViewCountText?.simpleText || '';
        const views = parseViewCount(viewCountText);
        
        const uploadedDate = renderer.publishedTimeText?.simpleText || '';
        
        const channelAvatars = renderer.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails || [];
        const channelAvatar = channelAvatars[0]?.url || '';
        
        const verified = renderer.ownerBadges?.some?.((b: any) => 
          b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
          b.metadataBadgeRenderer?.tooltip === 'Verified'
        ) || false;
        
        const isLive = renderer.badges?.some?.((b: any) => 
          b.metadataBadgeRenderer?.label === 'LIVE'
        ) || false;
        
        videos.push({
          videoId: renderer.videoId,
          title,
          thumbnail,
          channelName,
          channelId,
          channelAvatar,
          duration,
          views,
          uploadedDate,
          verified,
          isLive,
        });
      }
    }
  } catch (e) {
    console.error('Error extracting videos:', e);
  }
  
  return videos;
}

// Extract channels from ytInitialData search results
function extractChannelsFromSearch(ytData: any): { channelId: string; name: string; avatar: string; subscribers: string; description: string; verified: boolean }[] {
  const channels: { channelId: string; name: string; avatar: string; subscribers: string; description: string; verified: boolean }[] = [];
  
  try {
    const sections = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    
    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      
      for (const item of items) {
        // channelRenderer
        const renderer = item?.channelRenderer;
        if (!renderer?.channelId) continue;
        
        const name = renderer.title?.simpleText || '';
        const thumbnails = renderer.thumbnail?.thumbnails || [];
        const avatar = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
        const subscribers = renderer.subscriberCountText?.simpleText || '';
        const description = renderer.descriptionSnippet?.runs?.map((r: any) => r.text).join('') || '';
        const verified = renderer.ownerBadges?.some?.((b: any) => 
          b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
          b.metadataBadgeRenderer?.tooltip === 'Verified'
        ) || false;
        
        channels.push({ channelId: renderer.channelId, name, avatar, subscribers, description, verified });
      }
    }
  } catch (e) {
    console.error('Error extracting channels:', e);
  }
  
  return channels;
}

// Extract playlists from ytInitialData search results
function extractPlaylistsFromSearch(ytData: any): { playlistId: string; title: string; thumbnail: string; videoCount: number; channelName: string; channelId: string }[] {
  const playlists: { playlistId: string; title: string; thumbnail: string; videoCount: number; channelName: string; channelId: string }[] = [];
  
  try {
    const sections = ytData?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
    
    for (const section of sections) {
      const items = section?.itemSectionRenderer?.contents || [];
      
      for (const item of items) {
        // playlistRenderer
        const renderer = item?.playlistRenderer;
        if (renderer?.playlistId) {
          const title = renderer.title?.simpleText || renderer.title?.runs?.map((r: any) => r.text).join('') || '';
          const thumbnails = renderer.thumbnails?.[0]?.thumbnails || [];
          const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
          const videoCountText = renderer.videoCount || renderer.videoCountText || '';
          const videoCount = parseInt(String(videoCountText).replace(/\D/g, ''), 10) || 0;
          const channelName = renderer.shortBylineText?.runs?.[0]?.text || '';
          const channelId = renderer.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
          playlists.push({ playlistId: renderer.playlistId, title, thumbnail, videoCount, channelName, channelId });
          continue;
        }
        
        // lockupViewModel — YouTube 2025 format, can be playlists
        const lockup = item?.lockupViewModel;
        if (lockup) {
          const playlistId = lockup?.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.playlistId || '';
          // Only consider items with PL prefix as real playlists (not RD radio/mix)
          if (playlistId && playlistId.startsWith('PL')) {
            const title = lockup?.metadata?.lockupMetadataViewModel?.title?.content || '';
            const imgSources = lockup?.contentImage?.thumbnailViewModel?.image?.sources || [];
            const thumbnail = imgSources[0]?.url || '';
            // Try to get video count and channel info from metadata
            let videoCount = 0;
            let channelName = '';
            const metaRows = lockup?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
            for (const row of metaRows) {
              for (const part of row?.metadataParts || []) {
                const text = part?.text?.content || '';
                // Look for video count pattern
                const countMatch = text.match(/(\d+)\s*(video|song|track)/i);
                if (countMatch) videoCount = parseInt(countMatch[1], 10);
              }
            }
            playlists.push({ playlistId, title, thumbnail, videoCount, channelName, channelId: '' });
          }
          continue;
        }
        
        // Also extract playlist info from videoRenderer that has a playlistId in watchEndpoint
        const videoRenderer = item?.videoRenderer;
        if (videoRenderer) {
          const playlistId = videoRenderer?.navigationEndpoint?.watchEndpoint?.playlistId || '';
          // Only RD (radio/mix) playlists from video renderers — skip these as they're auto-generated
          // But we can extract the title and thumbnail to show as playlist entries
          if (playlistId && !playlistId.startsWith('WL') && !playlists.some(p => p.playlistId === playlistId)) {
            const title = videoRenderer.title?.runs?.[0]?.text || videoRenderer.title?.simpleText || '';
            const thumbnails = videoRenderer.thumbnail?.thumbnails || [];
            const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
            const channelName = videoRenderer.longBylineText?.runs?.[0]?.text || '';
            const channelId = videoRenderer.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
            playlists.push({ playlistId, title, thumbnail, videoCount: 0, channelName, channelId });
          }
        }
      }
    }
  } catch (e) {
    console.error('Error extracting playlists:', e);
  }
  
  return playlists;
}

// Search YouTube with specific filter (channels, playlists, or all)
export async function searchYouTubeFiltered(query: string, filter: string): Promise<{
  videos: YouTubeVideo[];
  channels: { channelId: string; name: string; avatar: string; subscribers: string; description: string; verified: boolean }[];
  playlists: { playlistId: string; title: string; thumbnail: string; videoCount: number; channelName: string; channelId: string }[];
}> {
  try {
    let url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=IN&hl=en`;
    
    // Apply YouTube search params for filter
    if (filter === 'channels') {
      url += '&sp=EgIQAg%3D%3D';
    } else if (filter === 'videos') {
      url += '&sp=EgIQAQ%3D%3D';
    }
    // 'all' and 'playlists' = no extra param (default YouTube search)
    
    const ytData = await fetchYouTubePage(url, 7000);
    if (!ytData) return { videos: [], channels: [], playlists: [] };
    
    let videos = extractVideosFromSearch(ytData);
    let channels = extractChannelsFromSearch(ytData);
    let playlists = extractPlaylistsFromSearch(ytData);
    
    // For playlists filter, also search with "playlist" appended if we got too few results
    if (filter === 'playlists' && playlists.length < 5) {
      try {
        const playlistUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query + ' playlist')}&gl=IN&hl=en`;
        const playlistData = await fetchYouTubePage(playlistUrl, 5000);
        if (playlistData) {
          const morePlaylists = extractPlaylistsFromSearch(playlistData);
          // Deduplicate
          const existingIds = new Set(playlists.map(p => p.playlistId));
          for (const p of morePlaylists) {
            if (!existingIds.has(p.playlistId)) {
              playlists.push(p);
              existingIds.add(p.playlistId);
            }
          }
        }
      } catch {}
    }
    
    return {
      videos: filterAdultContent(videos),
      channels,
      playlists,
    };
  } catch (error) {
    console.error('Filtered search error:', error);
    return { videos: [], channels: [], playlists: [] };
  }
}

// Deduplicate videos by videoId
function deduplicateVideos(videos: YouTubeVideo[]): YouTubeVideo[] {
  const seen = new Set<string>();
  return videos.filter(v => {
    if (!v.videoId || seen.has(v.videoId)) return false;
    seen.add(v.videoId);
    return true;
  });
}

// Block adult/explicit content
const ADULT_KEYWORDS = [
  'nude', 'naked', 'nsfw', 'porn', 'xxx', 'sex', 'erotic', 'horny',
  'onlyfans', 'only fan', 'adult content', '18+', 'boobs', 'breast',
  'vagina', 'penis', 'dick', 'pussy', 'fuck', 'fucking', 'ass hole',
  'anal', 'orgasm', 'masturbat', 'threesome', 'blowjob', 'handjob',
  'cumshot', 'creampie', 'gangbang', 'bondage', 'fetish', 'kinky',
  'striptease', 'strip tease', 'bikini try on', 'lingerie try on',
  'hot girl', 'sexy girl', 'sexy dance', 'twerking', 'twerk',
  'bhabhi hot', 'desi mms', 'indian mms', 'leaked mms', 'leaked video',
  'webcam girl', 'cam girl', 'chaturbate', 'omegle', 'dirty talk',
  'intimate scene', 'kiss scene hot', 'bed scene', 'romance hot',
  'bold scene', 'hot scene', 'sensual', 'provocative',
  'hot bhabhi', 'bhabhi romance', 'desi hot', 'hot aunty', 'aunty hot',
  'bold web series', 'hot web series', 'ullu web series', 'hot short film',
  'desi romance', 'college girl hot', 'school girl hot', 'maid hot',
  'massage spa', 'body massage', 'hot yoga', 'gym hot',
  'mini skirt', 'tight dress', 'see through', 'wardrobe malfunction',
  'nip slip', 'side boob', 'underboob', 'cleavage',
  'hot teacher', 'student hot', 'tutor hot',
  'hot model', 'bikini model', 'swimsuit model',
  'only fans', 'premium content', 'exclusive content adult',
  'xxx video', 'xxx movie', 'blue film', 'blue movie',
  'hot couple', 'couple romance', 'couple goals hot',
  'mature content', 'age restricted', 'for adults only',
];

// Blocked channels that post adult content
const BLOCKED_CHANNELS = [
  'onlyfans', 'fansly', 'mydirtyhobby',
];

function isAdultContent(video: YouTubeVideo): boolean {
  const title = (video.title || '').toLowerCase();
  const channel = (video.channelName || '').toLowerCase();
  
  // Check title for adult keywords
  for (const kw of ADULT_KEYWORDS) {
    if (title.includes(kw)) return true;
  }
  
  // Check channel name
  for (const bc of BLOCKED_CHANNELS) {
    if (channel.includes(bc)) return true;
  }
  
  // Block emoji-heavy titles (common in adult/spam content)
  const emojiCount = (title.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount >= 5) return true;
  
  // Block very short titles with clickbait patterns
  const clickbaitPatterns = /🔥|❤️‍🔥|💦|🥵|🔞|🔞|😍|😏/;
  if (clickbaitPatterns.test(title) && title.length < 40) return true;
  
  return false;
}

function filterAdultContent(videos: YouTubeVideo[]): YouTubeVideo[] {
  return videos.filter(v => !isAdultContent(v));
}

// Search YouTube videos (single query)
export async function searchYouTube(query: string): Promise<{ videos: YouTubeVideo[] }> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&gl=IN&hl=en`;
    const ytData = await fetchYouTubePage(url, 7000);
    
    if (!ytData) return { videos: [] };
    
    const videos = extractVideosFromSearch(ytData);
    return { videos: filterAdultContent(videos) };
  } catch (error) {
    console.error('Search error:', error);
    return { videos: [] };
  }
}

// Search multiple queries in parallel batches for maximum results
export async function searchMultipleQueries(queries: string[], maxTotal = 80): Promise<{ videos: YouTubeVideo[] }> {
  try {
    if (queries.length === 0) return { videos: [] };
    if (queries.length === 1) {
      const result = await searchYouTube(queries[0]);
      return { videos: filterAdultContent(result.videos) };
    }

    let allVideos: YouTubeVideo[] = [];

    // Run ALL queries in batches of 3 (parallel within batch, sequential between batches)
    const BATCH_SIZE = 3;
    for (let i = 0; i < queries.length; i += BATCH_SIZE) {
      const batch = queries.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(q => searchYouTube(q))
      );
      for (const r of results) {
        if (r.status === 'fulfilled') {
          allVideos = allVideos.concat(r.value.videos);
        }
      }
      // Stop early if we already have enough results
      if (allVideos.length >= maxTotal) break;
    }

    allVideos = deduplicateVideos(allVideos);
    allVideos = filterAdultContent(allVideos);
    return { videos: allVideos.slice(0, maxTotal) };
  } catch (error) {
    console.error('Multi-search error:', error);
    return { videos: [] };
  }
}

// Get trending videos by searching for popular topics
// Uses sequential requests to avoid Vercel timeout
export async function getTrending(region = 'IN'): Promise<YouTubeVideo[]> {
  try {
    let allVideos: YouTubeVideo[] = [];
    
    // Run first 2 queries in parallel (not 4!)
    const [r1, r2] = await Promise.allSettled([
      searchYouTube('trending videos 2025 India Hindi'),
      searchYouTube('popular Indian videos this week'),
    ]);
    
    if (r1.status === 'fulfilled') allVideos = allVideos.concat(r1.value.videos);
    if (r2.status === 'fulfilled') allVideos = allVideos.concat(r2.value.videos);
    
    // If we need more videos, run additional queries sequentially
    if (allVideos.length < 15) {
      const r3 = await searchYouTube('viral videos India today');
      allVideos = allVideos.concat(r3.videos);
    }
    
    allVideos = deduplicateVideos(allVideos);
    allVideos = filterAdultContent(allVideos);
    
    if (allVideos.length === 0) {
      const fallback = await searchYouTube('popular videos India');
      return filterAdultContent(fallback.videos);
    }
    
    return allVideos.slice(0, 60);
  } catch (error) {
    console.error('Trending error:', error);
    return [];
  }
}

// Get category-specific videos with multiple queries for richer results
export async function getCategoryVideos(category: string, page = 1): Promise<{ videos: YouTubeVideo[]; hasMore: boolean }> {
  const categoryQueries: Record<string, string[]> = {
    'Music': [
      'trending Hindi songs 2025',
      'new Bollywood music releases',
      'popular Indian songs this week',
      'top Punjabi music hits',
    ],
    'Gaming': [
      'Indian gaming videos popular',
      'BGMI gameplay videos India',
      'popular gaming streams Hindi',
      'best Indian gaming videos',
    ],
    'News': [
      'latest India news today Hindi',
      'breaking news India 2025',
      'Aaj Tak news headlines',
      'top Indian news stories this week',
    ],
    'Live': [
      'live stream India now',
      'Indian live streaming popular',
      'live cricket match India',
      'popular Indian live streams',
    ],
    'Sports': [
      'IPL cricket highlights 2025',
      'Indian sports news today',
      'popular Indian sports clips',
      'top cricket moments India',
    ],
    'Learning': [
      'educational videos Hindi learn',
      'how to tutorials Hindi 2025',
      'science videos Hindi education',
      'best learning videos India',
    ],
    'Fashion': [
      'Indian fashion trends 2025',
      'beauty tutorials Hindi',
      'Indian fashion haul videos',
      'style guide Indian videos',
    ],
    'Podcasts': [
      'Indian podcasts popular episodes',
      'best Hindi podcast clips 2025',
      'podcast highlights India',
      'popular Indian podcast interviews',
    ],
    'Recently Uploaded': [
      'most recent Indian videos',
      'new Indian videos today',
      'latest Hindi uploads 2025',
      'recently added Indian videos',
    ],
    'Watched': [
      'most watched Indian videos viral',
      'most popular Indian videos all time',
      'billion view Indian videos',
      'most viewed Indian YouTube videos',
    ],
    'New to you': [
      'trending new videos India',
      'recommended Hindi videos 2025',
      'discover new Indian videos',
      'interesting Indian videos to watch',
    ],
  };

  const queries = categoryQueries[category];
  if (!queries || queries.length === 0) {
    return { videos: [], hasMore: false };
  }

  try {
    // On first page, search all queries; on subsequent pages, use later queries with variations
    let searchQueries: string[];
    if (page === 1) {
      searchQueries = queries;
    } else {
      // Add page-based variations for more results
      searchQueries = queries.map(q => `${q} page ${page}`);
      // Also try some fresh queries
      const extraQueries = [
        `${category.toLowerCase()} videos ${page}`,
        `${category.toLowerCase()} content part ${page}`,
      ];
      searchQueries = searchQueries.concat(extraQueries);
    }

    // Only search first 2 queries to avoid Vercel timeout
    const limitedQueries = searchQueries.slice(0, 2);
    const results = await Promise.allSettled(
      limitedQueries.map(q => searchYouTube(q))
    );

    let allVideos: YouTubeVideo[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allVideos = allVideos.concat(result.value.videos);
      }
    }

    allVideos = deduplicateVideos(allVideos);
    allVideos = filterAdultContent(allVideos);
    return { 
      videos: allVideos.slice(0, 30), 
      hasMore: allVideos.length >= 5 // If we got at least 5, assume more pages possible
    };
  } catch (error) {
    console.error('Category videos error:', error);
    return { videos: [], hasMore: false };
  }
}

// Get video details
export async function getVideoDetails(videoId: string): Promise<{
  video: YouTubeVideo;
  description?: string;
  relatedVideos: YouTubeVideo[];
  likes?: string;
  channelInfo?: {
    subscriberCount: string;
    avatar: string;
  };
} | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}&gl=IN&hl=en`;
    const ytData = await fetchYouTubePage(url, 10000);
    
    if (!ytData) return null;
    
    // Extract video info from the two-column watch next results
    const contents = ytData?.contents?.twoColumnWatchNextResults;
    
    // Get video results
    const results = contents?.results?.results?.contents || [];
    let videoInfo: any = null;
    let description = '';
    
    for (const item of results) {
      if (item?.videoPrimaryInfoRenderer) {
        videoInfo = item.videoPrimaryInfoRenderer;
        description = videoInfo?.attributedDescriptionBodyText?.content || '';
        // Remove HTML tags
        description = description.replace(/<[^>]*>/g, '');
      }
      if (item?.videoSecondaryInfoRenderer) {
        const secondaryInfo = item.videoSecondaryInfoRenderer;
        if (!description) {
          description = secondaryInfo?.attributedDescription?.content || '';
          description = description.replace(/<[^>]*>/g, '');
        }
      }
    }
    
    // Get owner/subscriber info
    const owner = contents?.results?.results?.contents?.find((c: any) => c?.videoSecondaryInfoRenderer)?.videoSecondaryInfoRenderer;
    let subscriberCount = '';
    let channelAvatar = '';
    let channelId = '';
    
    if (owner) {
      subscriberCount = owner?.owner?.videoOwnerRenderer?.subscriberCountText?.simpleText || '';
      channelAvatar = owner?.owner?.videoOwnerRenderer?.thumbnail?.thumbnails?.[0]?.url || '';
      // Extract channelId from the owner renderer's navigation endpoint
      channelId = owner?.owner?.videoOwnerRenderer?.navigationEndpoint?.browseEndpoint?.browseId || '';
    }
    
    // Get video metadata from oEmbed for title and channel info
    const oEmbed = await getOEmbed(videoId);
    
    // Fallback channelId from oEmbed authorUrl (e.g., /channel/UCxxxx or /@handle)
    if (!channelId && oEmbed.authorUrl) {
      const channelMatch = oEmbed.authorUrl.match(/\/channel\/([^/?]+)/);
      if (channelMatch) {
        channelId = channelMatch[1];
      } else {
        const handleMatch = oEmbed.authorUrl.match(/\/@([^/?]+)/);
        if (handleMatch) {
          channelId = handleMatch[1]; // Store handle for channel lookup
        }
      }
    }
    
    // Extract view count and upload date from videoPrimaryInfoRenderer
    let views = 0;
    let uploadedDate = '';
    if (videoInfo) {
      const viewText = videoInfo?.viewCount?.videoViewCountRenderer?.viewCount?.simpleText 
        || videoInfo?.viewCount?.videoViewCountRenderer?.shortViewCount?.simpleText || '';
      views = parseViewCount(viewText);
      uploadedDate = videoInfo?.dateText?.simpleText || '';
    }
    
    // Extract duration from ytInitialData microformat
    let duration = 0;
    const microformat = ytData?.microformat?.playerMicroformatRenderer;
    if (microformat?.lengthSeconds) {
      duration = parseInt(microformat.lengthSeconds, 10) || 0;
    }
    
    // Get related videos from secondary results
    const relatedContents = contents?.secondaryResults?.secondaryResults?.results || [];
    const relatedVideos: YouTubeVideo[] = [];
    
    for (const item of relatedContents) {
      // Try new lockupViewModel format first (YouTube 2025+)
      const lockups = item?.itemSectionRenderer?.contents || [];
      for (const sub of lockups) {
        const lvm = sub?.lockupViewModel;
        if (!lvm) continue;
        
        // Extract videoId from thumbnail URL (e.g. /vi/VIDEO_ID/)
        const imgSources = lvm?.contentImage?.thumbnailViewModel?.image?.sources || [];
        const thumbUrl = imgSources[0]?.url || '';
        const vidMatch = thumbUrl.match(/\/vi\/([^/]+)\//);
        if (!vidMatch) continue;
        const relVideoId = vidMatch[1];
        
        // Extract title
        const relTitle = lvm?.metadata?.lockupMetadataViewModel?.title?.content || '';
        
        // Extract channel name, views, date from metadataRows
        const metaRows = lvm?.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows || [];
        let relChannelName = '';
        let relViewsText = '';
        let relUploadedDate = '';
        for (const row of metaRows) {
          for (const part of row?.metadataParts || []) {
            const text = part?.text?.content || '';
            if (!text) continue;
            
            // Row 0: channel name
            if (!relChannelName) {
              relChannelName = text;
              continue;
            }
            
            // Row 1+: views or date
            // Views: "233K views", "收看次數：233K 次", "1.2M 次觀看", etc.
            if (text.match(/view|次|观看|fois|visualiz/i) || text.match(/^\d[\d.,]*[KMBT]?[\s]*(views|次|观看|fois)?$/i)) {
              relViewsText = text;
            }
            // Date: "19 hours ago", "19 小時前", "3 days ago", "3 天前", etc.
            else if (text.match(/\d+\s*(hour|hr|day|week|month|year|ago|前|時|日|週|月|年|heure|jour|semaine|mois|an)/i)) {
              relUploadedDate = text;
            }
            // Pure number might be views (e.g. "233,456")
            else if (text.match(/^\d[\d,.]+$/) && !relViewsText) {
              relViewsText = text;
            }
          }
        }
        
        // Extract channel avatar
        const avatarSources = lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources || [];
        const relChannelAvatar = avatarSources[0]?.url || '';
        
        // Extract channel ID
        const channelIdFromNav = lvm?.metadata?.lockupMetadataViewModel?.image?.decoratedAvatarViewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand?.browseEndpoint?.browseId || '';
        
        // Extract duration from badge overlay
        const overlays = lvm?.contentImage?.thumbnailViewModel?.overlays || [];
        let relDuration = '';
        for (const overlay of overlays) {
          const badges = overlay?.thumbnailBottomOverlayViewModel?.badges || [];
          for (const b of badges) {
            const dur = b?.thumbnailBadgeViewModel?.text || '';
            if (dur && dur.includes(':')) {
              relDuration = dur;
            }
          }
        }
        
        relatedVideos.push({
          videoId: relVideoId,
          title: relTitle,
          thumbnail: `https://i.ytimg.com/vi/${relVideoId}/hqdefault.jpg`,
          channelName: relChannelName,
          channelId: channelIdFromNav,
          channelAvatar: relChannelAvatar,
          duration: parseDuration(relDuration),
          views: parseViewCount(relViewsText),
          uploadedDate: relUploadedDate,
          verified: false,
        });
        
        if (relatedVideos.length >= 20) break;
      }
      
      // Fallback: old compactVideoRenderer format (for older YouTube responses)
      if (relatedVideos.length === 0) {
        const renderer = item?.compactVideoRenderer || item?.compactAutoplayRenderer?.contents?.[0]?.compactVideoRenderer;
        if (renderer?.videoId) {
          relatedVideos.push({
            videoId: renderer.videoId,
            title: renderer.title?.simpleText || renderer.title?.runs?.[0]?.text || '',
            thumbnail: renderer.thumbnail?.thumbnails?.[0]?.url || '',
            channelName: renderer.shortBylineText?.runs?.[0]?.text || '',
            channelId: renderer.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
            channelAvatar: renderer.channelThumbnail?.thumbnails?.[0]?.url || '',
            duration: parseDuration(renderer.lengthText?.simpleText || ''),
            views: parseViewCount(renderer.shortViewCountText?.simpleText || ''),
            uploadedDate: renderer.publishedTimeText?.simpleText || '',
            verified: renderer.ownerBadges?.some?.((b: any) => b.metadataBadgeRenderer?.tooltip === 'Verified') || false,
          });
        }
      }
      
      if (relatedVideos.length >= 20) break;
    }
    
    // Get likes count
    let likes = '';
    const engagement = ytData?.engagementPanels?.[0]?.engagementPanelSectionListRenderer?.content?.structuredDescriptionContentRenderer?.items?.[0]?.videoDescriptionHeaderRenderer;
    if (engagement) {
      // Try to extract likes from buttons
      const likeButton = engagement?.actions?.menuRenderer?.items?.find?.((i: any) => i?.toggleButtonRenderer?.defaultIcon?.iconType === 'LIKE');
      if (likeButton?.toggleButtonRenderer?.defaultText?.accessibility?.accessibilityData?.label) {
        const likeMatch = likeButton.toggleButtonRenderer.defaultText.accessibility.accessibilityData.label.match(/([\d,]+)/);
        if (likeMatch) likes = likeMatch[1];
      }
    }
    
    // Extract verified status
    let verified = false;
    if (owner?.owner?.videoOwnerRenderer?.badges) {
      verified = owner.owner.videoOwnerRenderer.badges.some?.((b: any) => 
        b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
        b.metadataBadgeRenderer?.tooltip === 'Verified'
      ) || false;
    }
    
    return {
      video: {
        videoId,
        title: oEmbed.title || 'Video',
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        channelName: oEmbed.authorName || '',
        channelId,
        channelAvatar,
        duration,
        views,
        uploadedDate,
        description,
        verified,
      },
      description,
      relatedVideos: filterAdultContent(relatedVideos),
      likes,
      channelInfo: {
        subscriberCount,
        avatar: channelAvatar,
      },
    };
  } catch (error) {
    console.error('Video details error:', error);
    return null;
  }
}

// Fetch more channel videos using continuation token via YouTube browse API
export async function getChannelVideosNextPage(channelId: string, continuationToken: string): Promise<{
  videos: YouTubeVideo[];
  nextContinuationToken?: string;
}> {
  try {
    const context: any = {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20250610.00.00',
        hl: 'en',
        gl: 'IN',
        platform: 'DESKTOP',
      },
      request: { useSsl: true },
    };

    const response = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': YOUTUBE_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
      },
      body: JSON.stringify({ context, continuation: continuationToken }),
    });

    if (!response.ok) {
      console.error(`[Channel] Browse API returned status ${response.status}`);
      return { videos: [] };
    }

    const data = await response.json();
    const videos: YouTubeVideo[] = [];
    let nextContinuationToken: string | undefined;

    // Parse from appendContinuationItemsAction
    const actions = data?.appendContinuationItemsAction?.continuationItems || [];
    for (const item of actions) {
      const renderer = item?.richItemRenderer?.content?.videoRenderer ||
                       item?.gridVideoRenderer;
      if (renderer?.videoId) {
        videos.push(parseVideoRenderer(renderer));
      }
      // Extract next continuation token
      if (item?.continuationItemRenderer) {
        nextContinuationToken =
          item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
          item.continuationItemRenderer?.continuationEndpoint?.token || '';
      }
    }

    // Also try reload continuation
    const reloadItems = data?.reloadContinuationItemsCommand?.continuationItems || [];
    for (const item of reloadItems) {
      const renderer = item?.richItemRenderer?.content?.videoRenderer;
      if (renderer?.videoId) {
        videos.push(parseVideoRenderer(renderer));
      }
    }

    console.log(`[Channel] Loaded ${videos.length} more videos (has next: ${!!nextContinuationToken})`);
    return { videos, nextContinuationToken };
  } catch (error) {
    console.error('Channel next page error:', error);
    return { videos: [] };
  }
}

// Get video metadata via oEmbed (no API key needed)
export async function getOEmbed(videoId: string): Promise<{
  title: string;
  authorName: string;
  authorUrl: string;
  thumbnail: string;
  width: number;
  height: number;
}> {
  try {
    const resp = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { headers: { 'User-Agent': YOUTUBE_USER_AGENT } }
    );
    const data = await resp.json();
    return {
      title: data.title || 'Unknown',
      authorName: data.author_name || 'Unknown',
      authorUrl: data.author_url || '',
      thumbnail: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      width: data.width || 480,
      height: data.height || 360,
    };
  } catch {
    return {
      title: 'Video',
      authorName: 'Channel',
      authorUrl: '',
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      width: 480,
      height: 360,
    };
  }
}

// Helper: call YouTube browse API and return raw parsed data
async function callYouTubeBrowseAPI(browseId: string, params?: string): Promise<any | null> {
  const context: any = {
    client: {
      clientName: 'WEB',
      clientVersion: '2.20250610.00.00',
      hl: 'en',
      gl: 'IN',
      platform: 'DESKTOP',
    },
  };

  const body: any = { context, browseId };
  if (params) body.params = params;

  try {
    const response = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': YOUTUBE_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      console.error(`[Channel] Browse API returned status ${response.status}`);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.error(`[Channel] Browse API error:`, error);
    return null;
  }
}

// Helper: fetch channel videos via YouTube browse API (Videos tab)
async function fetchChannelVideosViaBrowseAPI(browseId: string, params?: string): Promise<{
  videos: YouTubeVideo[];
  continuationToken: string;
}> {
  const data = await callYouTubeBrowseAPI(browseId, params);
  if (!data) return { videos: [], continuationToken: '' };

  const videos: YouTubeVideo[] = [];
  let continuationToken = '';

  const browseTabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  for (const tab of browseTabs) {
    const tabContent = tab?.tabRenderer?.content;
    if (!tabContent?.richGridRenderer) continue;
    if (tab?.tabRenderer?.title !== 'Videos') continue;

    const items = tabContent.richGridRenderer.contents || [];
    for (const item of items) {
      const renderer = item?.richItemRenderer?.content?.videoRenderer;
      if (renderer?.videoId) {
        videos.push(parseVideoRenderer(renderer));
      }
      if (item?.continuationItemRenderer) {
        continuationToken =
          item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
          item.continuationItemRenderer?.continuationEndpoint?.token || '';
      }
    }
    break;
  }

  return { videos, continuationToken };
}

// Helper: fetch channel shorts via YouTube browse API (Shorts tab)
async function fetchChannelShortsViaBrowseAPI(browseId: string, params?: string, channelName?: string, channelId?: string): Promise<YouTubeVideo[]> {
  const data = await callYouTubeBrowseAPI(browseId, params);
  if (!data) return [];

  const shorts: YouTubeVideo[] = [];

  const browseTabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  for (const tab of browseTabs) {
    const tabContent = tab?.tabRenderer?.content;
    const tabTitle = tab?.tabRenderer?.title;
    if (tabTitle !== 'Shorts') continue;

    // Try richGridRenderer (most common for Shorts)
    const richGrid = tabContent?.richGridRenderer;
    if (richGrid) {
      const items = richGrid?.contents || [];
      for (const item of items) {
        // New format: shortsLockupViewModel
        const lockupVM = item?.richItemRenderer?.content?.shortsLockupViewModel;
        if (lockupVM) {
          const short = parseShortsLockupViewModel(lockupVM, channelName, channelId);
          if (short) {
            shorts.push(short);
          }
          continue;
        }
        // Old format: reelItemRenderer
        const reelRenderer = item?.richItemRenderer?.content?.reelItemRenderer;
        if (reelRenderer) {
          const short = parseReelItemRenderer(reelRenderer);
          if (short) {
            short.channelName = channelName || '';
            short.channelId = channelId || '';
            shorts.push(short);
          }
        }
      }
    }

    // Try reelShelfRenderer (alternative format)
    const reelShelf = tabContent?.reelShelfRenderer;
    if (reelShelf && shorts.length === 0) {
      const items = reelShelf?.items || [];
      for (const item of items) {
        const reelRenderer = item?.reelItemRenderer;
        if (reelRenderer) {
          const short = parseReelItemRenderer(reelRenderer);
          if (short) {
            short.channelName = channelName || '';
            short.channelId = channelId || '';
            shorts.push(short);
          }
        }
      }
    }

    // Debug: log what content keys exist if no shorts found
    if (shorts.length === 0) {
      const contentKeys = tabContent ? Object.keys(tabContent) : [];
      console.log(`[Channel-Shorts] Tab found but no reels parsed. Content keys: ${contentKeys.join(', ')}`);
      if (richGrid) {
        const gridItems = richGrid.contents || [];
        console.log(`[Channel-Shorts] richGrid has ${gridItems.length} items`);
        if (gridItems.length > 0) {
          const firstKeys = Object.keys(gridItems[0] || {});
          console.log(`[Channel-Shorts] First item keys: ${firstKeys.join(', ')}`);
          // Try to find any renderer in the item
          const richItem = gridItems[0]?.richItemRenderer;
          if (richItem) {
            const contentKeys2 = Object.keys(richItem.content || {});
            console.log(`[Channel-Shorts] richItemRenderer content keys: ${contentKeys2.join(', ')}`);
          }
        }
      }
    }
    break;
  }

  if (shorts.length === 0) {
    const tabTitles = browseTabs.map((t: any) => t?.tabRenderer?.title).filter(Boolean);
    console.log(`[Channel-Shorts] Available browse tabs: ${tabTitles.join(', ')}`);
  }

  return shorts;
}

// Helper: fetch channel playlists via YouTube browse API (Playlists tab)
async function fetchChannelPlaylistsViaBrowseAPI(browseId: string, params?: string, channelName?: string, channelId?: string): Promise<YouTubePlaylist[]> {
  const data = await callYouTubeBrowseAPI(browseId, params);
  if (!data) return [];

  const playlists: YouTubePlaylist[] = [];

  const browseTabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
  for (const tab of browseTabs) {
    const tabContent = tab?.tabRenderer?.content;
    const tabTitle = tab?.tabRenderer?.title;
    if (tabTitle !== 'Playlists') continue;

    // Try gridRenderer
    const gridItems = tabContent?.gridRenderer?.items || [];
    for (const item of gridItems) {
      const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
      if (renderer) {
        const playlist = parsePlaylistRenderer(renderer);
        if (playlist) {
          if (!playlist.channelName && channelName) playlist.channelName = channelName;
          if (!playlist.channelId && channelId) playlist.channelId = channelId;
          playlists.push(playlist);
        }
      }
    }

    // Try sectionListRenderer (alternative format)
    if (playlists.length === 0 && tabContent?.sectionListRenderer) {
      const sections = tabContent.sectionListRenderer.contents || [];
      for (const section of sections) {
        const isr = section?.itemSectionRenderer;
        const isrContents = isr?.contents || [];
        for (const content of isrContents) {
          // Try: itemSectionRenderer > content > gridRenderer > items > lockupViewModel
          const gridItems = content?.gridRenderer?.items || [];
          for (const item of gridItems) {
            // New format: lockupViewModel
            const lockup = item?.lockupViewModel;
            if (lockup) {
              const playlist = parsePlaylistLockupViewModel(lockup, channelName, channelId);
              if (playlist) playlists.push(playlist);
              continue;
            }
            // Old format: gridPlaylistRenderer or playlistRenderer
            const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
            if (renderer) {
              const playlist = parsePlaylistRenderer(renderer);
              if (playlist) {
                if (!playlist.channelName && channelName) playlist.channelName = channelName;
                if (!playlist.channelId && channelId) playlist.channelId = channelId;
                playlists.push(playlist);
              }
            }
          }
          // Also try shelfRenderer wrappers
          const shelfContent = content?.shelfRenderer?.content;
          const hItems = shelfContent?.horizontalListRenderer?.items || shelfContent?.verticalListRenderer?.items || [];
          for (const item of hItems) {
            const lockup = item?.lockupViewModel;
            if (lockup) {
              const playlist = parsePlaylistLockupViewModel(lockup, channelName, channelId);
              if (playlist) playlists.push(playlist);
              continue;
            }
            const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
            if (renderer) {
              const playlist = parsePlaylistRenderer(renderer);
              if (playlist) {
                if (!playlist.channelName && channelName) playlist.channelName = channelName;
                if (!playlist.channelId && channelId) playlist.channelId = channelId;
                playlists.push(playlist);
              }
            }
          }
        }
      }
    }

    // Debug: log what content keys exist if no playlists found
    if (playlists.length === 0) {
      const contentKeys = tabContent ? Object.keys(tabContent) : '';
      console.log(`[Channel-Playlists] Tab found but no playlists parsed. Content keys: ${contentKeys}`);
      if (tabContent?.sectionListRenderer) {
        const sections = tabContent.sectionListRenderer.contents || [];
        console.log(`[Channel-Playlists] sectionListRenderer has ${sections.length} sections`);
        for (let si = 0; si < Math.min(sections.length, 3); si++) {
          const sec = sections[si];
          const isr = sec?.itemSectionRenderer;
          if (isr) {
            const isrContents = isr.contents || [];
            console.log(`[Channel-Playlists] itemSectionRenderer has ${isrContents.length} contents`);
            if (isrContents.length > 0) {
              const grid = isrContents[0]?.gridRenderer;
              if (grid) {
                const gItems = grid.items || [];
                console.log(`[Channel-Playlists] gridRenderer has ${gItems.length} items`);
                if (gItems.length > 0) {
                  // Check for lockupViewModel (new format)
                  const lockup = gItems[0]?.lockupViewModel;
                  if (lockup && !_playlistLockupDebugLogged) {
                    _playlistLockupDebugLogged = true;
                    console.log(`[Channel-Playlists] lockupViewModel keys: ${Object.keys(lockup).join(', ')}`);
                    console.log(`[Channel-Playlists] contentId: ${lockup.contentId}`);
                    console.log(`[Channel-Playlists] titleText: ${JSON.stringify(lockup.titleText)}`);
                    console.log(`[Channel-Playlists] thumbnail: ${JSON.stringify(lockup.thumbnail)}`);
                    console.log(`[Channel-Playlists] metadataText: ${JSON.stringify(lockup.metadataText)}`);
                  }
                }
              }
            }
          }
        }
      }
    }
    break;
  }

  return playlists;
}

// Get channel page data
export async function getChannelData(channelId: string): Promise<{
  channel: YouTubeChannelInfo;
  videos: YouTubeVideo[];
  shorts: YouTubeVideo[];
  playlists: YouTubePlaylist[];
  continuationToken?: string;
} | null> {
  try {
    // Determine URL format based on channelId type
    let channelUrl: string;
    if (channelId.startsWith('@')) {
      channelUrl = `https://www.youtube.com/${channelId}`;
    } else if (channelId.startsWith('UC')) {
      channelUrl = `https://www.youtube.com/channel/${channelId}`;
    } else {
      channelUrl = `https://www.youtube.com/channel/${channelId}`;
    }

    console.log(`[Channel] Fetching channel data from: ${channelUrl}`);
    let ytData = await fetchYouTubePage(channelUrl, 8000);

    // Fallback: try /@ format
    if (!ytData && !channelId.startsWith('@') && !channelId.startsWith('UC')) {
      ytData = await fetchYouTubePage(`https://www.youtube.com/@${channelId}`, 8000);
    }
    // Fallback: try /c/ format
    if (!ytData && !channelId.startsWith('@')) {
      ytData = await fetchYouTubePage(`https://www.youtube.com/c/${channelId}`, 8000);
    }

    if (!ytData) {
      console.log(`[Channel] Failed to fetch channel data for: ${channelId}`);
      return null;
    }

    // ===== Extract channel info from NEW pageHeaderRenderer format =====
    const pageHeaderVM = ytData?.header?.pageHeaderRenderer?.content?.pageHeaderViewModel;
    
    // Channel name from pageHeaderViewModel
    let channelName = pageHeaderVM?.title?.dynamicTextViewModel?.text?.content || '';
    
    // Subscriber count from metadata
    let subscriberCount = '';
    const metadataVM = pageHeaderVM?.metadata?.contentMetadataViewModel;
    if (metadataVM?.metadataRows) {
      for (const row of metadataVM.metadataRows) {
        for (const part of (row.metadataParts || [])) {
          const text = part.text?.content || '';
          if (text.includes('subscriber') || text.includes('Subscriber')) {
            subscriberCount = text;
            break;
          }
        }
        if (subscriberCount) break;
      }
    }
    
    // Avatar from pageHeaderViewModel (new format)
    let avatar = '';
    const avatarSources = pageHeaderVM?.image?.decoratedAvatarViewModel?.avatar?.avatarViewModel?.image?.sources;
    if (avatarSources && avatarSources.length > 0) {
      avatar = avatarSources[avatarSources.length - 1]?.url || '';
    }
    
    // Banner from pageHeaderViewModel (new format)
    let banner = '';
    const bannerSources = pageHeaderVM?.banner?.imageBannerViewModel?.image?.sources;
    if (bannerSources && bannerSources.length > 0) {
      banner = bannerSources[bannerSources.length - 1]?.url || '';
    }
    
    // Description from metadata
    let description = '';
    if (metadataVM?.metadataRows) {
      for (const row of metadataVM.metadataRows) {
        for (const part of (row.metadataParts || [])) {
          const text = part.text?.content || '';
          if (text.length > 50 && !text.includes('subscriber') && !text.includes('video')) {
            description = text;
            break;
          }
        }
        if (description) break;
      }
    }

    // ===== Fallback: extract from OLD c4TabbedHeaderRenderer format =====
    const c4Header = ytData?.header?.c4TabbedHeaderRenderer;
    if (!channelName) channelName = c4Header?.title || '';
    if (!subscriberCount) subscriberCount = c4Header?.subscriberCountText?.simpleText || '';
    if (!avatar) avatar = c4Header?.avatar?.thumbnails?.[0]?.url || '';
    if (!banner) banner = c4Header?.banner?.thumbnails?.[0]?.url || '';
    if (!description) description = c4Header?.description || '';

    // ===== Fallback: extract channel name from microformat =====
    if (!channelName) {
      channelName = ytData?.microformat?.microformatDataRenderer?.title || '';
    }
    
    // ===== Extract videos, shorts, and playlists =====
    const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];
    let videos: YouTubeVideo[] = [];
    let shorts: YouTubeVideo[] = [];
    let playlists: YouTubePlaylist[] = [];
    let continuationToken = '';
    let videoTabParams: string | undefined;
    let videoTabBrowseId: string | undefined;
    let shortsTabParams: string | undefined;
    let shortsTabBrowseId: string | undefined;
    let playlistsTabParams: string | undefined;
    let playlistsTabBrowseId: string | undefined;

    for (const tab of tabs) {
      const tabRenderer = tab?.tabRenderer;
      const content = tabRenderer?.content;
      const tabTitle = tabRenderer?.title;

      // Save tab params + browseId for browse API fallback
      if (tabTitle === 'Videos' && tabRenderer?.endpoint?.browseEndpoint) {
        videoTabParams = tabRenderer.endpoint.browseEndpoint.params;
        videoTabBrowseId = tabRenderer.endpoint.browseEndpoint.browseId;
      }
      if (tabTitle === 'Shorts' && tabRenderer?.endpoint?.browseEndpoint) {
        shortsTabParams = tabRenderer.endpoint.browseEndpoint.params;
        shortsTabBrowseId = tabRenderer.endpoint.browseEndpoint.browseId;
      }
      if (tabTitle === 'Playlists' && tabRenderer?.endpoint?.browseEndpoint) {
        playlistsTabParams = tabRenderer.endpoint.browseEndpoint.params;
        playlistsTabBrowseId = tabRenderer.endpoint.browseEndpoint.browseId;
      }

      if (!content) continue;

      // Rich grid renderer (Videos tab)
      const richGrid = content?.richGridRenderer;
      if (richGrid) {
        const items = richGrid?.contents || [];
        for (const item of items) {
          // Check for reel items (Shorts)
          if (tabTitle === 'Shorts') {
            const reelRenderer = item?.richItemRenderer?.content?.reelItemRenderer;
            if (reelRenderer) {
              const short = parseReelItemRenderer(reelRenderer);
              if (short) {
                short.channelName = channelName;
                short.channelId = channelId;
                shorts.push(short);
              }
              continue;
            }
          }
          const renderer = item?.richItemRenderer?.content?.videoRenderer;
          if (!renderer?.videoId) continue;
          videos.push(parseVideoRenderer(renderer));
        }
        if (tabTitle === 'Videos') {
          const contItem = items.find((it: any) => it?.continuationItemRenderer);
          if (contItem?.continuationItemRenderer) {
            continuationToken =
              contItem.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
              contItem.continuationItemRenderer?.continuationEndpoint?.token || '';
          }
        }
      }

      // Section list renderer (Home tab or some layouts)
      const sectionList = content?.sectionListRenderer;
      if (sectionList && tabTitle === 'Home' && videos.length === 0) {
        for (const section of (sectionList.contents || [])) {
          const shelfItems = section?.itemSectionRenderer?.contents ||
                            section?.shelfRenderer?.content?.horizontalListRenderer?.items || [];
          for (const item of shelfItems) {
            const renderer = item?.videoRenderer || item?.gridVideoRenderer;
            if (!renderer?.videoId) continue;
            videos.push(parseVideoRenderer(renderer));
          }
        }
      }

      // Playlists tab extraction
      if (tabTitle === 'Playlists') {
        const gridItems = content?.gridRenderer?.items || [];
        for (const item of gridItems) {
          const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
          if (renderer) {
            const playlist = parsePlaylistRenderer(renderer);
            if (playlist) {
              if (!playlist.channelName && channelName) playlist.channelName = channelName;
              if (!playlist.channelId && channelId) playlist.channelId = channelId;
              playlists.push(playlist);
            }
          }
        }
        // Also try section list renderer for playlists
        if (playlists.length === 0 && content?.sectionListRenderer) {
          const sections = content.sectionListRenderer.contents || [];
          for (const section of sections) {
            const shelfItems = section?.itemSectionRenderer?.contents ||
                              section?.shelfRenderer?.content?.horizontalListRenderer?.items || [];
            for (const item of shelfItems) {
              const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
              if (renderer) {
                const playlist = parsePlaylistRenderer(renderer);
                if (playlist) {
                  if (!playlist.channelName && channelName) playlist.channelName = channelName;
                  if (!playlist.channelId && channelId) playlist.channelId = channelId;
                  playlists.push(playlist);
                }
              }
            }
          }
        }
      }
    }

    // ===== If no videos found in HTML, use browse API =====
    if (videos.length === 0 && (videoTabParams || videoTabBrowseId)) {
      console.log(`[Channel] No videos in HTML, fetching via browse API...`);
      const browseId = videoTabBrowseId || channelId;
      const browseResult = await fetchChannelVideosViaBrowseAPI(browseId, videoTabParams);
      videos = browseResult.videos;
      continuationToken = browseResult.continuationToken;
    }

    // ===== If no shorts found in HTML, fetch from dedicated Shorts page =====
    if (shorts.length === 0) {
      console.log(`[Channel] No shorts in HTML, fetching Shorts tab page directly...`);
      shorts = await fetchChannelTabDataFromPage(channelUrl, 'Shorts', channelName, channelId);
    }
    // Fallback: use browse API if page scrape also failed
    if (shorts.length === 0 && (shortsTabParams || shortsTabBrowseId)) {
      console.log(`[Channel] Page scrape failed, trying browse API for shorts...`);
      const browseId = shortsTabBrowseId || channelId;
      shorts = await fetchChannelShortsViaBrowseAPI(browseId, shortsTabParams, channelName, channelId);
    }

    // ===== If no playlists found in HTML, fetch from dedicated Playlists page =====
    if (playlists.length === 0) {
      console.log(`[Channel] No playlists in HTML, fetching Playlists tab page directly...`);
      playlists = await fetchChannelPlaylistsFromPage(channelUrl, channelName, channelId);
    }
    // Fallback: use browse API if page scrape also failed
    if (playlists.length === 0 && (playlistsTabParams || playlistsTabBrowseId)) {
      console.log(`[Channel] Page scrape failed, trying browse API for playlists...`);
      const browseId = playlistsTabBrowseId || channelId;
      playlists = await fetchChannelPlaylistsViaBrowseAPI(browseId, playlistsTabParams, channelName, channelId);
    }

    console.log(`[Channel] Found ${videos.length} videos, ${shorts.length} shorts, ${playlists.length} playlists for channel ${channelName}${continuationToken ? ' (has more)' : ''}`);

    return {
      channel: {
        channelId,
        channelName,
        subscriberCount,
        avatar,
        banner,
        description,
      },
      videos,
      shorts,
      playlists,
      continuationToken: continuationToken || undefined,
    };
  } catch (error) {
    console.error('Channel error:', error);
    return null;
  }
}

// Fetch channel playlists by scraping the /playlists tab page directly
async function fetchChannelPlaylistsFromPage(channelBaseUrl: string, channelName?: string, channelId?: string): Promise<YouTubePlaylist[]> {
  try {
    const playlistUrl = channelBaseUrl + '/playlists';
    console.log(`[Channel-Playlists] Fetching playlists page: ${playlistUrl}`);
    const ytData = await fetchYouTubePage(playlistUrl, 8000);
    if (!ytData) {
      console.log(`[Channel-Playlists] Failed to fetch playlists page`);
      return [];
    }

    const playlists: YouTubePlaylist[] = [];
    const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];

    for (const tab of tabs) {
      const tabContent = tab?.tabRenderer?.content;
      const tabTitle = tab?.tabRenderer?.title;
      if (tabTitle !== 'Playlists') continue;

      // Try gridRenderer
      const gridItems = tabContent?.gridRenderer?.items || [];
      for (const item of gridItems) {
        // New format: lockupViewModel
        const lockup = item?.lockupViewModel;
        if (lockup) {
          const playlist = parsePlaylistLockupViewModel(lockup, channelName, channelId);
          if (playlist) playlists.push(playlist);
          continue;
        }
        // Old format: gridPlaylistRenderer
        const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
        if (renderer) {
          const playlist = parsePlaylistRenderer(renderer);
          if (playlist) {
            if (!playlist.channelName && channelName) playlist.channelName = channelName;
            if (!playlist.channelId && channelId) playlist.channelId = channelId;
            playlists.push(playlist);
          }
        }
      }

      // Try sectionListRenderer
      if (playlists.length === 0 && tabContent?.sectionListRenderer) {
        const sections = tabContent.sectionListRenderer.contents || [];
        for (const section of sections) {
          const isr = section?.itemSectionRenderer;
          const isrContents = isr?.contents || [];
          for (const content of isrContents) {
            const gItems = content?.gridRenderer?.items || [];
            for (const item of gItems) {
              const lockup = item?.lockupViewModel;
              if (lockup) {
                const playlist = parsePlaylistLockupViewModel(lockup, channelName, channelId);
                if (playlist) playlists.push(playlist);
                continue;
              }
              const renderer = item?.gridPlaylistRenderer || item?.playlistRenderer;
              if (renderer) {
                const playlist = parsePlaylistRenderer(renderer);
                if (playlist) {
                  if (!playlist.channelName && channelName) playlist.channelName = channelName;
                  if (!playlist.channelId && channelId) playlist.channelId = channelId;
                  playlists.push(playlist);
                }
              }
            }
          }
        }
      }

      // Try richGridRenderer (some channels use this for playlists)
      if (playlists.length === 0 && tabContent?.richGridRenderer) {
        const items = tabContent.richGridRenderer.contents || [];
        for (const item of items) {
          const richItem = item?.richItemRenderer;
          if (!richItem) continue;
          const content = richItem?.content;
          if (!content) continue;
          const renderer = content?.gridPlaylistRenderer || content?.playlistRenderer;
          if (renderer) {
            const playlist = parsePlaylistRenderer(renderer);
            if (playlist) {
              if (!playlist.channelName && channelName) playlist.channelName = channelName;
              if (!playlist.channelId && channelId) playlist.channelId = channelId;
              playlists.push(playlist);
            }
          }
          // Also check for lockupViewModel in richItemRenderer
          const lockup = content?.lockupViewModel;
          if (lockup) {
            const playlist = parsePlaylistLockupViewModel(lockup, channelName, channelId);
            if (playlist) playlists.push(playlist);
          }
        }
      }

      break;
    }

    console.log(`[Channel-Playlists] Found ${playlists.length} playlists from page scrape`);
    return playlists;
  } catch (error) {
    console.error(`[Channel-Playlists] Error fetching playlists from page:`, error);
    return [];
  }
}

// Fetch channel shorts or playlists by scraping a specific tab page
async function fetchChannelTabDataFromPage(channelBaseUrl: string, tabName: string, channelName?: string, channelId?: string): Promise<YouTubeVideo[]> {
  try {
    let tabPath = '/shorts';
    if (tabName === 'Playlists') tabPath = '/playlists';
    const tabUrl = channelBaseUrl + tabPath;
    console.log(`[Channel-${tabName}] Fetching ${tabName} tab page: ${tabUrl}`);
    const ytData = await fetchYouTubePage(tabUrl, 8000);
    if (!ytData) {
      console.log(`[Channel-${tabName}] Failed to fetch ${tabName} tab page`);
      return [];
    }

    const items: YouTubeVideo[] = [];
    const tabs = ytData?.contents?.twoColumnBrowseResultsRenderer?.tabs || [];

    for (const tab of tabs) {
      const tabContent = tab?.tabRenderer?.content;
      const tabTitle = tab?.tabRenderer?.title;
      if (tabTitle !== tabName) continue;

      // richGridRenderer (most common)
      const richGrid = tabContent?.richGridRenderer;
      if (richGrid) {
        const gridItems = richGrid.contents || [];
        for (const item of gridItems) {
          const richItem = item?.richItemRenderer;
          if (!richItem?.content) continue;
          const content = richItem.content;

          // shortsLockupViewModel (new shorts format)
          const lockupVM = content?.shortsLockupViewModel;
          if (lockupVM) {
            const short = parseShortsLockupViewModel(lockupVM, channelName, channelId);
            if (short) items.push(short);
            continue;
          }

          // reelItemRenderer (old shorts format)
          const reelRenderer = content?.reelItemRenderer;
          if (reelRenderer) {
            const short = parseReelItemRenderer(reelRenderer);
            if (short) {
              short.channelName = channelName || '';
              short.channelId = channelId || '';
              items.push(short);
            }
          }
        }
      }

      // reelShelfRenderer (alternative)
      const reelShelf = tabContent?.reelShelfRenderer;
      if (reelShelf && items.length === 0) {
        const shelfItems = reelShelf.items || [];
        for (const shelfItem of shelfItems) {
          const reelRenderer = shelfItem?.reelItemRenderer;
          if (reelRenderer) {
            const short = parseReelItemRenderer(reelRenderer);
            if (short) {
              short.channelName = channelName || '';
              short.channelId = channelId || '';
              items.push(short);
            }
          }
        }
      }

      break;
    }

    console.log(`[Channel-${tabName}] Found ${items.length} items from page scrape`);
    return items;
  } catch (error) {
    console.error(`[Channel-${tabName}] Error fetching tab data from page:`, error);
    return [];
  }
}

// Parse a reelItemRenderer (Shorts) into YouTubeVideo
function parseReelItemRenderer(renderer: any): YouTubeVideo | null {
  const videoId = renderer?.videoId;
  if (!videoId) return null;
  const thumbnails = renderer?.thumbnail?.thumbnails || [];
  const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
  const headline = renderer?.headline?.simpleText || renderer?.headline?.runs?.[0]?.text || '';
  const viewCountText = renderer?.viewCountText?.simpleText || renderer?.shortViewCountText?.simpleText || '';
  const views = parseViewCount(viewCountText);
  return {
    videoId,
    title: headline,
    thumbnail,
    channelName: '', // Will be filled from channel data
    channelId: '',
    duration: 0,
    views,
    uploadedDate: renderer?.publishedTimeText?.simpleText || '',
    isLive: false,
    verified: false,
  };
}

// Parse shortsLockupViewModel (NEW Shorts format) into YouTubeVideo
function parseShortsLockupViewModel(vm: any, channelName?: string, channelId?: string): YouTubeVideo | null {
  // Extract videoId from onTap.innertubeCommand
  let videoId = '';
  const command = vm?.onTap?.innertubeCommand;
  if (command?.reelWatchEndpoint?.videoId) {
    videoId = command.reelWatchEndpoint.videoId;
  } else if (command?.reelWatchEndpoint?.reelId) {
    videoId = command.reelWatchEndpoint.reelId;
  } else if (command?.commandMetadata?.webCommandMetadata?.url) {
    const url = command.commandMetadata.webCommandMetadata.url;
    const match = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (match) videoId = match[1];
  }
  if (!videoId) return null;

  // Extract thumbnail from thumbnailViewModel
  let thumbnail = '';
  const thumbVM = vm?.thumbnailViewModel;
  if (thumbVM) {
    // Debug log the thumbnailViewModel structure
    const vmKeys = Object.keys(thumbVM);
    // Log all keys and check common image paths
    const primaryKeys = thumbVM?.primary ? Object.keys(thumbVM.primary) : [];
    
    // Try all possible paths
    const allPaths = [
      thumbVM?.image?.sources,
      thumbVM?.sources,
      thumbVM?.primary?.sources,
      thumbVM?.primary?.image?.sources,
    ];
    for (const src of allPaths) {
      if (src && src.length > 0) {
        thumbnail = src[src.length - 1]?.url || src[0]?.url || '';
        if (thumbnail) break;
      }
    }
    // Fallback: try url field
    if (!thumbnail) {
      thumbnail = thumbVM?.url || thumbVM?.image?.url || thumbVM?.primary?.url || '';
    }
    // Fallback: try croppedImage
    if (!thumbnail) {
      const cropped = thumbVM?.croppedImage?.croppedImageViewModel;
      if (cropped) {
        const cSources = cropped?.sources || cropped?.image?.sources || [];
        if (cSources.length > 0) {
          thumbnail = cSources[cSources.length - 1]?.url || cSources[0]?.url || '';
        }
      }
    }
  }

  // Extract title and views from accessibilityText
  // Format: "Title, 369 thousand views - play Short"
  let title = '';
  let views = 0;
  const accessText = vm?.accessibilityText || '';
  
  const dashParts = accessText.split(/\s*[-–]\s*/);
  const mainPart = dashParts[0] || accessText;
  
  const commaParts = mainPart.split(',').map((s: string) => s.trim());
  if (commaParts.length >= 2) {
    title = commaParts.slice(0, -1).join(',').trim();
    const viewStr = commaParts[commaParts.length - 1];
    // Handle word-based numbers like "369 thousand", "1.2 million"
    views = parseViewCountWord(viewStr);
  } else {
    title = mainPart.trim();
  }

  // Fallback: use standard YouTube thumbnail
  if (!thumbnail && videoId) {
    thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }
  if (!title) {
    const overlay = vm?.overlayMetadata || {};
    title = overlay?.headline?.content || overlay?.title || '';
  }

  return {
    videoId,
    title,
    thumbnail,
    channelName: channelName || '',
    channelId: channelId || '',
    duration: 0,
    views,
    uploadedDate: '',
    isLive: false,
    verified: false,
  };
}

// Parse view count with word-based suffixes like "369 thousand", "1.2 million"
function parseViewCountWord(text: string): number {
  if (!text) return 0;
  const lower = text.toLowerCase().trim();
  const billionMatch = lower.match(/([\d.,]+)\s*billion/);
  if (billionMatch) return Math.round(parseFloat(billionMatch[1].replace(/,/g, '')) * 1e9);
  const millionMatch = lower.match(/([\d.,]+)\s*million/);
  if (millionMatch) return Math.round(parseFloat(millionMatch[1].replace(/,/g, '')) * 1e6);
  const thousandMatch = lower.match(/([\d.,]+)\s*thousand/);
  if (thousandMatch) return Math.round(parseFloat(thousandMatch[1].replace(/,/g, '')) * 1e3);
  // Fallback to regular parseViewCount
  return parseViewCount(text);
}

// Parse a playlist renderer into YouTubePlaylist
function parsePlaylistRenderer(renderer: any): YouTubePlaylist | null {
  const playlistId = renderer?.playlistId;
  if (!playlistId) return null;
  const thumbnails = renderer?.thumbnails?.[0]?.thumbnails || renderer?.thumbnailRenderer?.playlistVideoThumbnailRenderer?.thumbnail?.thumbnails || [];
  const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
  const title = renderer?.title?.simpleText || renderer?.title?.runs?.[0]?.text || '';
  const videoCountText = renderer?.videoCountText?.runs?.[0]?.text || renderer?.videoCountText?.simpleText || '';
  const videoCount = parseInt(videoCountText.replace(/[^0-9]/g, ''), 10) || 0;
  const channelName = renderer?.shortBylineText?.runs?.[0]?.text || '';
  const channelId = renderer?.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
  const updatedDate = renderer?.publishedTimeText?.simpleText || '';
  return { playlistId, title, thumbnail, videoCount, channelName, channelId, updatedDate };
}

// Parse playlistLockupViewModel (NEW Playlists format) into YouTubePlaylist
function parsePlaylistLockupViewModel(vm: any, channelName?: string, channelId?: string): YouTubePlaylist | null {
  if (!vm?.contentId) return null;
  
  const playlistId = vm.contentId;
  
  // Debug: log the full structure of first playlist (once)
  if (!_playlistLockupDebugLogged) {
    _playlistLockupDebugLogged = true;
    console.log(`[Playlist-Lockup] Full VM keys: ${Object.keys(vm).join(', ')}`);
    console.log(`[Playlist-Lockup] contentId: ${vm.contentId}`);
    console.log(`[Playlist-Lockup] metadata: ${JSON.stringify(vm.metadata)?.substring(0, 300)}`);
    console.log(`[Playlist-Lockup] contentType: ${vm.contentType}`);
  }
  
  // Extract title from metadata (NEW lockupMetadataViewModel format)
  let title = '';
  
  // Primary: lockupMetadataViewModel > title > content
  const lockupMeta = vm?.metadata?.lockupMetadataViewModel;
  if (lockupMeta?.title?.content) {
    title = lockupMeta.title.content;
  }
  
  // Secondary: metadata > contentMetadataViewModel > metadataRows > metadataParts
  if (!title) {
    const metaVM = vm?.metadata?.contentMetadataViewModel;
    if (metaVM?.metadataRows) {
      for (const row of metaVM.metadataRows) {
        for (const part of (row.metadataParts || [])) {
          const text = part?.text?.content || '';
          if (text.length > 3 && !/^\d/.test(text) && !text.toLowerCase().includes('updated') && !text.toLowerCase().includes('video')) {
            title = text;
            break;
          }
        }
        if (title) break;
      }
    }
  }
  
  // Also check metadata inside lockupMetadataViewModel for title
  if (!title && lockupMeta?.metadata?.contentMetadataViewModel?.metadataRows) {
    const metaRows = lockupMeta.metadata.contentMetadataViewModel.metadataRows;
    for (const row of metaRows) {
      for (const part of (row.metadataParts || [])) {
        const text = part?.text?.content || '';
        if (text.length > 3 && !/^\d/.test(text)) {
          title = text;
          break;
        }
      }
      if (title) break;
    }
  }
  
  // Try titleText field (old format)
  if (!title) {
    const titleText = vm?.titleText;
    if (typeof titleText === 'string') {
      title = titleText;
    } else if (titleText?.content) {
      title = titleText.content;
    } else if (Array.isArray(titleText?.runs)) {
      title = titleText.runs.map((r: any) => r.text || '').join('');
    } else if (Array.isArray(titleText?.parts)) {
      title = titleText.parts.map((p: any) => p?.text || p?.content || '').join('');
    }
  }
  
  // Extract thumbnail from contentImage (NEW format)
  let thumbnail = '';
  const contentImage = vm?.contentImage;
  if (contentImage) {
    // Try collectionThumbnailViewModel path
    const collThumb = contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources;
    if (Array.isArray(collThumb) && collThumb.length > 0) {
      thumbnail = collThumb[collThumb.length - 1]?.url || collThumb[0]?.url || '';
    }
    // Try croppedImage path
    if (!thumbnail) {
      const cropped = contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.croppedImage?.croppedImageViewModel;
      if (cropped) {
        const cSources = cropped?.sources || cropped?.image?.sources || [];
        if (cSources.length > 0) {
          thumbnail = cSources[cSources.length - 1]?.url || cSources[0]?.url || '';
        }
      }
    }
    // Try other paths
    if (!thumbnail) {
      const allSourcePaths = [
        contentImage?.image?.sources,
        contentImage?.sources,
        contentImage?.primary?.sources,
        contentImage?.primary?.image?.sources,
      ];
      for (const src of allSourcePaths) {
        if (Array.isArray(src) && src.length > 0) {
          thumbnail = src[src.length - 1]?.url || src[0]?.url || '';
          if (thumbnail) break;
        }
      }
    }
  }
  
  // Fallback: try old thumbnail field
  if (!thumbnail) {
    const thumbVM = vm?.thumbnail;
    if (thumbVM) {
      const sourcePaths = [
        thumbVM?.image?.sources,
        thumbVM?.sources,
        thumbVM?.primary?.sources,
      ];
      for (const src of sourcePaths) {
        if (Array.isArray(src) && src.length > 0) {
          thumbnail = src[src.length - 1]?.url || src[0]?.url || '';
          if (thumbnail) break;
        }
      }
    }
  }
  
  // Extract video count from metadata
  let videoCount = 0;
  
  // Check lockupMetadataViewModel > metadata > contentMetadataViewModel for video count
  if (lockupMeta?.metadata?.contentMetadataViewModel?.metadataRows) {
    for (const row of lockupMeta.metadata.contentMetadataViewModel.metadataRows) {
      for (const part of (row.metadataParts || [])) {
        const text = part?.text?.content || '';
        const countMatch = text.match(/([\d,]+)/);
        if (countMatch) {
          const num = parseInt(countMatch[1].replace(/,/g, ''), 10);
          if (num > videoCount) videoCount = num;
        }
      }
    }
  }
  
  // Also check top-level metadata > contentMetadataViewModel
  if (videoCount === 0) {
    const metaVM = vm?.metadata?.contentMetadataViewModel;
    if (metaVM?.metadataRows) {
      for (const row of metaVM.metadataRows) {
        for (const part of (row.metadataParts || [])) {
          const text = part?.text?.content || '';
          const countMatch = text.match(/([\d,]+)/);
          if (countMatch) {
            const num = parseInt(countMatch[1].replace(/,/g, ''), 10);
            if (num > videoCount) videoCount = num;
          }
        }
      }
    }
  }
  
  // Fallback: try metadataText field (old format)
  if (videoCount === 0) {
    const metadataText = vm?.metadataText;
    if (typeof metadataText === 'string') {
      const countMatch = metadataText.match(/([\d,]+)/);
      if (countMatch) videoCount = parseInt(countMatch[1].replace(/,/g, ''), 10) || 0;
    } else if (metadataText?.content) {
      const countMatch = metadataText.content.match(/([\d,]+)/);
      if (countMatch) videoCount = parseInt(countMatch[1].replace(/,/g, ''), 10) || 0;
    } else if (Array.isArray(metadataText?.runs)) {
      for (const run of metadataText.runs) {
        const countMatch = (run?.text || '').match(/([\d,]+)/);
        if (countMatch) { videoCount = parseInt(countMatch[1].replace(/,/g, ''), 10) || 0; break; }
      }
    }
  }
  
  // Also try secondaryText for video count
  if (videoCount === 0) {
    const st = vm?.secondaryText;
    if (st) {
      const stStr = typeof st === 'string' ? st : st?.content || '';
      const countMatch = stStr.match(/([\d,]+)/);
      if (countMatch) videoCount = parseInt(countMatch[1].replace(/,/g, ''), 10) || 0;
    }
  }
  
  // Fallback: generate YouTube playlist thumbnail URL
  if (!thumbnail && playlistId) {
    thumbnail = `https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg`; // Generic fallback
  }
  
  return {
    playlistId,
    title: title || 'Playlist',
    thumbnail,
    videoCount,
    channelName: channelName || '',
    channelId: channelId || '',
    updatedDate: '',
  };
}

// Parse a videoRenderer object into YouTubeVideo
function parseVideoRenderer(renderer: any): YouTubeVideo {
  const thumbnails = renderer.thumbnail?.thumbnails || [];
  const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
  
  return {
    videoId: renderer.videoId || '',
    title: renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || '',
    thumbnail,
    channelName: renderer.longBylineText?.runs?.[0]?.text || 
                 renderer.shortBylineText?.runs?.[0]?.text || '',
    channelId: renderer.longBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '',
    channelAvatar: renderer.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || '',
    duration: parseDuration(renderer.lengthText?.simpleText || ''),
    views: parseViewCount(renderer.viewCountText?.simpleText || renderer.shortViewCountText?.simpleText || ''),
    uploadedDate: renderer.publishedTimeText?.simpleText || '',
    verified: renderer.ownerBadges?.some?.((b: any) => 
      b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
      b.metadataBadgeRenderer?.tooltip === 'Verified'
    ) || false,
    isLive: renderer.badges?.some?.((b: any) => 
      b.metadataBadgeRenderer?.label === 'LIVE'
    ) || false,
  };
}

// Search suggestions
export async function getSearchSuggestions(query: string): Promise<string[]> {
  try {
    // Use client=firefox which returns clean JSON: ["q", ["sug1", "sug2", ...], ...]
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}&gl=IN&hl=en`;
    const resp = await fetch(url, {
      headers: { 'User-Agent': YOUTUBE_USER_AGENT },
    });
    
    const data = await resp.json();
    if (Array.isArray(data) && Array.isArray(data[1])) {
      // data[1] is an array of suggestion strings
      return data[1].filter((s: any) => typeof s === 'string' && s.trim().length > 0);
    }
    return [];
  } catch {
    return [];
  }
}

/* ================================================================
   YOUTUBE COMMENTS SCRAPING
   Uses YouTube's internal ytInitialData + youtubei/v1/next API
   ================================================================ */

export interface YouTubeComment {
  commentId: string;
  authorName: string;
  authorAvatar: string;
  authorChannelId: string;
  text: string;
  likeCount: string;
  publishedTime: string;
  isCreator: boolean;
  isVerified: boolean;
  replyCount: number;
  pinnedText?: string;
  replyContinuationToken?: string;
}

// Get comment count and continuation token from watch page ytInitialData
export async function getCommentContinuationToken(videoId: string): Promise<{ count: string; token: string; visitorData?: string } | null> {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}&gl=IN&hl=en`;
    const ytData = await fetchYouTubePage(url, 10000);
    if (!ytData) return null;

    const engagementPanels = ytData?.engagementPanels || [];
    let commentPanel = null;
    for (const panel of engagementPanels) {
      const panelId = panel?.engagementPanelSectionListRenderer?.panelIdentifier || '';
      if (panelId === 'engagement-panel-comments-section') {
        commentPanel = panel;
        break;
      }
    }

    if (!commentPanel) {
      console.log(`[Comments] No comments panel found for video ${videoId} - comments may be disabled`);
      return null;
    }

    const panelRenderer = commentPanel.engagementPanelSectionListRenderer;

    // Extract comment count from header
    let commentCount = '';
    const header = panelRenderer?.header?.engagementPanelTitleHeaderRenderer;
    if (header?.contextualInfo?.runs) {
      commentCount = header.contextualInfo.runs.map((r: any) => r.text).join('');
    }
    if (header?.title?.simpleText) {
      commentCount = header.title.simpleText;
    }

    // Extract continuation token from the nested structure
    let token =
      panelRenderer?.content?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.contents?.[0]
        ?.continuationItemRenderer?.continuationEndpoint
        ?.continuationCommand?.token || '';

    // Alternative path for token extraction
    if (!token) {
      token =
        panelRenderer?.content?.sectionListRenderer?.contents?.[0]
          ?.itemSectionRenderer?.contents?.[0]
          ?.continuationItemRenderer?.continuationEndpoint
          ?.token || '';
    }

    // Another alternative path - directly from the engagement panel's continuation
    if (!token) {
      const contItems = panelRenderer?.content?.sectionListRenderer?.contents?.[0]
        ?.itemSectionRenderer?.continuations || [];
      for (const cont of contItems) {
        token = cont?.nextContinuationData?.continuation || '';
        if (token) break;
      }
    }

    // Extract visitorData for API context
    const visitorData = ytData?.responseContext?.webResponseContextExtensionData?.ytConfigData?.visitorData || '';

    return token ? { count: commentCount, token, visitorData } : null;
  } catch (error) {
    console.error('Error getting comment continuation token:', error);
    return null;
  }
}

// Parse text runs into plain text
function parseRuns(runs: any[] | undefined): string {
  if (!runs) return '';
  return runs.map((r: any) => r.text || '').join('');
}

// Parse a commentRenderer (classic format) into YouTubeComment
function parseCommentRenderer(renderer: any, threadData?: any): YouTubeComment | null {
  if (!renderer?.commentId) return null;

  const authorText = renderer.authorText?.simpleText || parseRuns(renderer.authorText?.runs) || '';
  const contentText = renderer.contentText?.simpleText || parseRuns(renderer.contentText?.runs) || '';
  const publishedTime = renderer.publishedTimeText?.simpleText || parseRuns(renderer.publishedTimeText?.runs) || '';
  const voteCount = renderer.voteCount?.simpleText || '';
  const avatarUrl = renderer.authorThumbnail?.thumbnails?.[0]?.url || 
                    renderer.authorThumbnail?.thumbnails?.[renderer.authorThumbnail?.thumbnails?.length - 1]?.url || '';
  const authorChannelId = renderer.authorEndpoint?.browseEndpoint?.browseId || '';
  const isVerified = renderer.authorCommentBadge?.authorCommentBadgeRenderer?.iconTooltip === 'Verified' ||
                     renderer.ownerBadges?.some?.((b: any) => b.metadataBadgeRenderer?.tooltip === 'Verified') || false;

  // Parse reply count and continuation token
  let replyCount = 0;
  let replyContinuationToken: string | undefined;
  const replyData = threadData?.replies?.commentRepliesRenderer;
  if (threadData?.replies) {
    const replyBtnText = replyData?.viewReplies?.buttonRenderer?.text?.simpleText ||
                         parseRuns(replyData?.viewReplies?.buttonRenderer?.text?.runs) || '';
    const replyMatch = replyBtnText.match(/(\d+)/);
    replyCount = replyMatch ? parseInt(replyMatch[1], 10) : 0;
    if (replyCount === 0 && replyData?.contents) {
      replyCount = replyData.contents.length;
    }
    // Extract reply continuation token
    const replyBtn = replyData?.viewReplies?.buttonRenderer?.command?.continuationCommand
      || replyData?.viewReplies?.buttonRenderer?.command?.signalServiceEndpoint;
    if (replyBtn?.token) {
      replyContinuationToken = replyBtn.token;
    }
  }

  return {
    commentId: renderer.commentId,
    authorName: authorText,
    authorAvatar: avatarUrl,
    authorChannelId,
    text: contentText,
    likeCount: voteCount,
    publishedTime,
    isCreator: false,
    isVerified,
    replyCount,
    replyContinuationToken,
  };
}

// Parse comments from either reloadContinuationItemsCommand or appendContinuationItemsAction
function parseCommentsFromResponse(apiData: any): {
  comments: YouTubeComment[];
  nextToken?: string;
} {
  const comments: YouTubeComment[] = [];
  let nextToken: string | undefined;

  const endpoints = apiData?.onResponseReceivedEndpoints || [];

  // Collect all comment thread items from both command types
  const commentThreads: any[] = [];

  for (const ep of endpoints) {
    const cmd = ep?.reloadContinuationItemsCommand || ep?.appendContinuationItemsAction;
    if (!cmd) continue;

    const items = cmd?.continuationItems || [];
    for (const item of items) {
      if (item?.commentThreadRenderer) {
        commentThreads.push(item.commentThreadRenderer);
      }

      // Extract next continuation token
      if (item?.continuationItemRenderer) {
        const token =
          item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
          item.continuationItemRenderer?.continuationEndpoint?.token || '';
        if (token) {
          nextToken = token;
        }
      }
    }
  }

  // ===== APPROACH 1: Parse commentRenderer (classic/legacy format) =====
  let classicCommentsParsed = false;
  for (const thread of commentThreads) {
    const renderer = thread?.comment?.commentRenderer;
    if (renderer?.commentId) {
      classicCommentsParsed = true;
      const comment = parseCommentRenderer(renderer, thread);
      if (comment) {
        // Check for pinned indicator
        if (thread?.pinnedCommentBadge) {
          comment.pinnedText = 'Pinned by creator';
        }
        comments.push(comment);
      }
    }
  }

  if (classicCommentsParsed) {
    console.log(`[Comments] Parsed ${comments.length} comments using classic commentRenderer format`);
    return { comments, nextToken };
  }

  // ===== APPROACH 2: Parse from frameworkUpdates (newer view model format) =====
  const mutations = apiData?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
  const commentEntities = new Map<string, any>();

  for (const mut of mutations) {
    const cp = mut?.payload?.commentEntityPayload;
    if (!cp) continue;

    const commentId = cp?.properties?.commentId || cp?.commentId;
    if (commentId) {
      commentEntities.set(commentId, cp);
    }
  }

  // Merge thread data with entity data
  for (const thread of commentThreads) {
    const viewModel = thread?.commentViewModel?.commentViewModel;
    const commentId = viewModel?.commentId;

    // Get the entity payload for this comment
    const entity = commentId ? commentEntities.get(commentId) : null;
    const author = entity?.author;
    const props = entity?.properties;
    const toolbar = entity?.toolbar;

    if (!author || !props) continue;

    // Parse text from content
    const text = props?.content?.content || '';

    // Parse like count (remove " likes" or other suffixes)
    const likeRaw = toolbar?.likeCountA11y || '';
    const likeMatch = likeRaw.match(/^([\d.,KMGTB]+)\s*(likes|like)?$/i);
    const likeCount = likeMatch ? likeMatch[1] : likeRaw;

    // Parse reply count and continuation token
    const replyData = thread?.replies?.commentRepliesRenderer;
    const replyCount = thread?.replies
      ? (replyData?.viewReplies?.buttonRenderer?.text?.runs?.[0]?.text
        ? parseInt(replyData.viewReplies.buttonRenderer.text.runs[0].text, 10) || 0
        : replyData?.contents?.length || 0)
      : 0;

    // Extract reply continuation token
    let replyContinuationToken: string | undefined;
    if (thread?.replies) {
      const replyCmd = replyData?.viewReplies?.buttonRenderer?.command;
      const token = replyCmd?.continuationCommand?.token
        || replyCmd?.continuationCommand?.token
        || replyCmd?.signalServiceEndpoint?.token;
      if (token) replyContinuationToken = token;
    }

    comments.push({
      commentId: commentId || props?.commentId || '',
      authorName: author?.displayName || '',
      authorAvatar: author?.avatarThumbnailUrl || '',
      authorChannelId: author?.channelId || '',
      text,
      likeCount,
      publishedTime: props?.publishedTime || '',
      isCreator: author?.isCreator || false,
      isVerified: author?.isVerified || false,
      replyCount,
      replyContinuationToken,
      pinnedText: viewModel?.pinnedText || undefined,
    });
  }

  if (comments.length > 0) {
    console.log(`[Comments] Parsed ${comments.length} comments using frameworkUpdates format`);
  } else {
    console.log(`[Comments] No comments parsed from response. Thread count: ${commentThreads.length}, Mutations: ${mutations.length}`);
  }

  return { comments, nextToken };
}

// Fetch comments from YouTube's internal next API
export async function fetchCommentsFromAPI(token: string, visitorData?: string): Promise<{ comments: YouTubeComment[]; nextToken?: string }> {
  try {
    const context: any = {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20250610.00.00',
        hl: 'en',
        gl: 'IN',
        platform: 'DESKTOP',
      },
      request: {
        useSsl: true,
      },
    };

    // Add visitorData if available for better API responses
    if (visitorData) {
      context.client.visitorData = visitorData;
    }

    const response = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': YOUTUBE_USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin': 'https://www.youtube.com',
        'Referer': 'https://www.youtube.com/',
      },
      body: JSON.stringify({
        context,
        continuation: token,
      }),
    });

    if (!response.ok) {
      console.error(`[Comments] API returned status ${response.status}`);
      return { comments: [] };
    }

    const data = await response.json();
    return parseCommentsFromResponse(data);
  } catch (error) {
    console.error('Error fetching comments from API:', error);
    return { comments: [] };
  }
}

// Main function to get video comments
export async function getVideoComments(videoId: string, maxComments = 30): Promise<{
  comments: YouTubeComment[];
  commentCount: string;
  nextContinuationToken?: string;
}> {
  try {
    const tokenData = await getCommentContinuationToken(videoId);

    if (!tokenData?.token) {
      return { comments: [], commentCount: '' };
    }

    console.log(`[Comments] Found continuation token for video ${videoId}, fetching comments...`);
    const result = await fetchCommentsFromAPI(tokenData.token, tokenData.visitorData);

    // Load more pages if needed
    let comments = result.comments;
    let nextToken = result.nextToken;

    while (comments.length < maxComments && nextToken) {
      const moreResult = await fetchCommentsFromAPI(nextToken, tokenData.visitorData);
      comments = comments.concat(moreResult.comments);
      nextToken = moreResult.nextToken;
      if (comments.length >= maxComments) break;
    }

    console.log(`[Comments] Loaded ${comments.length} comments for video ${videoId}`);
    return {
      comments: comments.slice(0, maxComments),
      commentCount: tokenData.count,
      nextContinuationToken: nextToken,
    };
  } catch (error) {
    console.error('Error getting video comments:', error);
    return { comments: [], commentCount: '' };
  }
}

/* ================================================================
   YOUTUBE PLAYLIST SCRAPING
   Scrapes YouTube playlist pages for video listing
   ================================================================ */

export interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  duration: number;
  views: number;
  uploaded: number;
}

// Get playlist videos by scraping YouTube's playlist page
export async function getPlaylistVideosFromYouTube(playlistId: string): Promise<{
  name: string;
  thumbnailUrl: string;
  uploaderName: string;
  uploaderUrl: string;
  uploaderAvatar: string;
  videos: PlaylistVideo[];
} | null> {
  try {
    const url = `https://www.youtube.com/playlist?list=${playlistId}&gl=IN&hl=en`;
    console.log(`[Playlist] Fetching playlist from YouTube: ${url}`);
    const ytData = await fetchYouTubePage(url, 10000);
    if (!ytData) {
      console.log(`[Playlist] Failed to fetch playlist page for ${playlistId}`);
      return null;
    }

    // Extract playlist name and uploader from microformat
    const microformat = ytData?.microformat?.microformatDataRenderer;
    const name = microformat?.title || '';
    const thumbnailUrl = microformat?.thumbnail?.thumbnails?.[0]?.url || '';
    const uploaderName = microformat?.ownerChannelName || '';
    const uploaderUrl = microformat?.ownerChannelUrl || '';
    const uploaderAvatar = microformat?.ownerAvatar?.thumbnails?.[0]?.url || '';

    // Extract videos from sidebar.playlistVideoListRenderer or contents
    const videos: PlaylistVideo[] = [];
    
    // Try playlistVideoListRenderer (most common)
    const sidebar = ytData?.sidebar?.playlistSidebarRenderer;
    const items = sidebar?.items || [];
    
    // Debug: check content structure
    const contents = ytData?.contents;
    const twoColBrowse = contents?.twoColumnBrowseResultsRenderer;
    const tabs = twoColBrowse?.tabs || [];
    console.log(`[Playlist] twoColumnBrowseResultsRenderer tabs: ${tabs.length}`);
    
    // Look for playlist video list in the main content area (not sidebar)
    for (const tab of tabs) {
      const tabContent = tab?.tabRenderer?.content;
      if (!tabContent) continue;
      
      // Try sectionListRenderer (playlist video list)
      const sectionList = tabContent?.sectionListRenderer;
      if (sectionList) {
        const sectionContents = sectionList?.contents || [];
        console.log(`[Playlist] sectionListRenderer contents: ${sectionContents.length}`);
        for (const section of sectionContents) {
          // Try itemSectionRenderer > playlistVideoListRenderer
          const pvlr = section?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer;
          if (pvlr) {
            const pvlrContents = pvlr.contents || [];
            console.log(`[Playlist] Found playlistVideoListRenderer with ${pvlrContents.length} items`);
            for (const item of pvlrContents) {
              const renderer = item?.playlistVideoRenderer;
              if (!renderer?.videoId) continue;
              
              const thumbnails = renderer?.thumbnail?.thumbnails || [];
              const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
              const title = renderer?.title?.runs?.[0]?.text || renderer?.title?.simpleText || '';
              const uploader = renderer?.shortBylineText?.runs?.[0]?.text || '';
              const uploaderLink = renderer?.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
              const durationText = renderer?.lengthText?.simpleText || '';
              
              videos.push({
                videoId: renderer.videoId,
                title,
                thumbnail,
                uploaderName: uploader || uploaderName,
                uploaderUrl: uploaderLink || uploaderUrl,
                uploaderAvatar: uploaderAvatar,
                duration: parseDuration(durationText),
                views: 0,
                uploaded: 0,
              });
              
              if (videos.length >= 50) break;
            }
            if (videos.length > 0) break;
          }
          
          // Also try direct playlistVideoRenderer in itemSectionRenderer contents
          const isrContents = section?.itemSectionRenderer?.contents || [];
          for (const content of isrContents) {
            const renderer = content?.playlistVideoRenderer;
            if (!renderer?.videoId) continue;
            
            const thumbnails = renderer?.thumbnail?.thumbnails || [];
            const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
            const title = renderer?.title?.runs?.[0]?.text || renderer?.title?.simpleText || '';
            const durationText = renderer?.lengthText?.simpleText || '';
            
            videos.push({
              videoId: renderer.videoId,
              title,
              thumbnail,
              uploaderName: uploaderName,
              uploaderUrl: uploaderUrl,
              uploaderAvatar: uploaderAvatar,
              duration: parseDuration(durationText),
              views: 0,
              uploaded: 0,
            });
            
            if (videos.length >= 50) break;
          }
          if (videos.length > 0) break;
        }
        if (videos.length > 0) break;
      }
      
      // Try richGridRenderer (some playlists use this format)
      const richGrid = tabContent?.richGridRenderer;
      if (richGrid && videos.length === 0) {
        const gridContents = richGrid?.contents || [];
        console.log(`[Playlist] richGridRenderer contents: ${gridContents.length}`);
        for (const item of gridContents) {
          const richItem = item?.richItemRenderer;
          if (!richItem?.content) continue;
          
          const renderer = richItem.content?.videoRenderer || richItem.content?.playlistVideoRenderer;
          if (!renderer?.videoId) continue;
          
          const thumbnails = renderer?.thumbnail?.thumbnails || [];
          const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
          const title = renderer?.title?.runs?.[0]?.text || renderer?.title?.simpleText || '';
          const durationText = renderer?.lengthText?.simpleText || '';
          
          videos.push({
            videoId: renderer.videoId,
            title,
            thumbnail,
            uploaderName: uploaderName,
            uploaderUrl: uploaderUrl,
            uploaderAvatar: uploaderAvatar,
            duration: parseDuration(durationText),
            views: 0,
            uploaded: 0,
          });
          
          if (videos.length >= 50) break;
        }
      }
    }
    
    // Fallback: try sidebar items for playlist videos
    for (const item of items) {
      const renderer = item?.playlistVideoRenderer;
      if (!renderer?.videoId) continue;

      const thumbnails = renderer?.thumbnail?.thumbnails || [];
      const thumbnail = thumbnails[thumbnails.length - 1]?.url || thumbnails[0]?.url || '';
      const title = renderer?.title?.runs?.[0]?.text || renderer?.title?.simpleText || '';
      const uploader = renderer?.shortBylineText?.runs?.[0]?.text || '';
      const uploaderLink = renderer?.shortBylineText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId || '';
      const durationText = renderer?.lengthText?.simpleText || '';
      const duration = parseDuration(durationText);

      // Extract views
      const videoInfo = renderer?.videoInfo?.runs;
      let views = 0;
      if (videoInfo) {
        for (const run of videoInfo) {
          const viewMatch = run?.text?.match(/([\d,.]+[KMB]?)\s*views?/i);
          if (viewMatch) {
            views = parseViewCount(viewMatch[1]);
            break;
          }
        }
      }

      videos.push({
        videoId: renderer.videoId,
        title,
        thumbnail,
        uploaderName: uploader || uploaderName,
        uploaderUrl: uploaderLink || uploaderUrl,
        uploaderAvatar: uploaderAvatar,
        duration,
        views,
        uploaded: 0,
      });

      // Limit to 50 videos
      if (videos.length >= 50) break;
    }

    console.log(`[Playlist] Found ${videos.length} videos for playlist "${name}"`);
    return { name, thumbnailUrl, uploaderName, uploaderUrl, uploaderAvatar, videos };
  } catch (error) {
    console.error('[Playlist] Error fetching playlist from YouTube:', error);
    return null;
  }
}
