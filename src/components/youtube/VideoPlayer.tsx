'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  Share2,
  BookmarkPlus,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  BadgeCheck,
  Loader2,
  Link,
  Check,
  X,
  Play,
  SkipForward,
  SkipBack,
  Volume2,
  Maximize2,
  Minimize2,
  ListMusic,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAppStore, type VideoItem, type QueueItem } from '@/store/app-store';
import { formatViews, formatDuration, formatSubscribers, type VideoDetailsResponse, type YouTubeVideoData, extractVideoId } from '@/lib/video-utils';

/* ================================================================
   YOUTUBE IFRAME API HOOK
   ================================================================ */

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function useYouTubePlayer(containerRef: React.RefObject<HTMLDivElement | null>, videoId: string | null, onEnded?: () => void) {
  const playerRef = useRef<any>(null);
  const [isReady, setIsReady] = useState(() => !!window.YT?.Player);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const apiLoadedRef = useRef(false);
  const onEndedRef = useRef(onEnded);

  // Keep onEndedRef in sync
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (apiLoadedRef.current || window.YT?.Player) {
      apiLoadedRef.current = true;
      return;
    }

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    window.onYouTubeIframeAPIReady = () => {
      apiLoadedRef.current = true;
      setIsReady(true);
    };
  }, []);

  // Create/update player when videoId changes
  useEffect(() => {
    if (!isReady || !containerRef.current || !videoId) return;

    // Destroy previous player
    if (playerRef.current) {
      try {
        playerRef.current.destroy();
      } catch {
        // Ignore
      }
      playerRef.current = null;
    }

    // Helper: force fullscreen permissions on an iframe (preserves YouTube's existing permissions)
    const forceFullscreenAttrs = (el: HTMLIFrameElement) => {
      el.setAttribute('allowfullscreen', 'true');
      el.setAttribute('webkitallowfullscreen', 'true');
      el.setAttribute('mozallowfullscreen', 'true');
      // Append fullscreen to existing allow list instead of replacing it
      const allow = el.getAttribute('allow') || '';
      const features = allow.split(';').map(s => s.trim()).filter(Boolean);
      if (!features.includes('fullscreen')) features.push('fullscreen');
      el.setAttribute('allow', features.join('; '));
    };

    // Create new player
    playerRef.current = new window.YT.Player(containerRef.current, {
      videoId: videoId,
      playerVars: {
        autoplay: 1,
        rel: 0,
        modestbranding: 1,
        iv_load_policy: 3,
        fs: 1,
        playsinline: 1,
        origin: window.location.origin,
        enablejsapi: 1,
        controls: 1,
        disablekb: 0,
      },
      events: {
        onReady: () => {
          setIsPlaying(true);
          const iframe = playerRef.current?.getIframe?.() as HTMLIFrameElement | null;
          if (iframe) {
            forceFullscreenAttrs(iframe);
            setTimeout(() => forceFullscreenAttrs(iframe), 500);
            setTimeout(() => forceFullscreenAttrs(iframe), 2000);
          }
        },
        onStateChange: (event: any) => {
          const isPlayingState = event.data === window.YT.PlayerState.PLAYING;
          const isEndedState = event.data === window.YT.PlayerState.ENDED;
          setIsPlaying(isPlayingState);
          setIsEnded(isEndedState);
          if (isEndedState) {
            // Immediately seek to 0 and pause to prevent YouTube's end screen
            try {
              const player = playerRef.current;
              if (player) {
                player.seekTo(0, true);
                player.pauseVideo();
              }
            } catch {}
            onEndedRef.current?.();
          }
        },
      },
    });

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // Ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId, isReady, containerRef]);

  return { isReady, isPlaying, isEnded, playerRef };
}

/* ================================================================
   VIDEO PLAYER COMPONENT
   ================================================================ */

export default function VideoPlayer() {
  const { currentVideoId, setCurrentVideoId, setCurrentView, setCurrentChannelId, currentPlaylist, setCurrentPlaylist, clearCurrentPlaylist, playNextInPlaylist, playPrevInPlaylist } = useAppStore();
  const queryClient = useQueryClient();

  // Fetch video data
  const { data, isLoading, isError, error } = useQuery<VideoDetailsResponse, Error>({
    queryKey: ['video', currentVideoId],
    queryFn: async () => {
      if (!currentVideoId) throw new Error('No video ID');
      const res = await fetch(`/api/piped/video/${currentVideoId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      return res.json();
    },
    enabled: !!currentVideoId,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });

  // Add to watch history
  const historyMutation = useMutation({
    mutationFn: async (videoData: VideoDetailsResponse) => {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideoId,
          title: videoData.video.title,
          thumbnail: videoData.video.thumbnail,
          channelId: videoData.video.channelId,
          channelName: videoData.video.channelName,
          duration: videoData.video.duration || 0,
        }),
      });
    },
  });

  // Like/Dislike mutations
  const likeMutation = useMutation({
    mutationFn: async ({ action, video }: { action: string; video: VideoDetailsResponse }) => {
      await fetch('/api/liked', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideoId,
          title: video.video.title,
          thumbnail: video.video.thumbnail,
          channelId: video.video.channelId,
          channelName: video.video.channelName,
          duration: video.video.duration || 0,
          action,
        }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['liked'] });
      if (variables.action === 'like') {
        toast('Added to liked videos', {
          description: variables.video.video.title,
          icon: '👍',
        });
      } else if (variables.action === 'remove_like') {
        toast('Removed from liked videos', { icon: '💔' });
      } else if (variables.action === 'dislike') {
        toast('Feedback recorded', { icon: '👎' });
      }
    },
  });

  // Watch later mutation
  const watchLaterMutation = useMutation({
    mutationFn: async (video: VideoDetailsResponse) => {
      await fetch('/api/watch-later', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: currentVideoId,
          title: video.video.title,
          thumbnail: video.video.thumbnail,
          channelId: video.video.channelId,
          channelName: video.video.channelName,
          duration: video.video.duration || 0,
        }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['watchlater'] });
      toast.success('Saved to Watch Later', {
        description: variables?.video?.video?.title || '',
        icon: '🕐',
      });
    },
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async (video: VideoDetailsResponse) => {
      await fetch('/api/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: video.video.channelId,
          channelName: video.video.channelName,
          channelAvatar: video.video.channelAvatar,
        }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      toast.success(`Subscribed to ${variables?.video?.video?.channelName || 'channel'}`, {
        icon: '🔔',
      });
    },
  });

  // Check liked status
  const { data: likedVideos } = useQuery({
    queryKey: ['liked'],
    queryFn: async () => {
      const res = await fetch('/api/liked');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  // Check subscription status
  const { data: subscriptions } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => {
      const res = await fetch('/api/subscription');
      return res.json();
    },
    staleTime: 30 * 1000,
  });

  const isLiked = likedVideos?.some?.((v: { videoId: string }) => v.videoId === currentVideoId) || false;
  const isSubscribed = subscriptions?.some?.((s: { channelId: string }) => s.channelId === data?.video.channelId) || false;

  // Save to history when video data is loaded
  const savedVideoIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (data && currentVideoId && savedVideoIdRef.current !== currentVideoId) {
      savedVideoIdRef.current = currentVideoId;
      historyMutation.mutate(data);
    }
  }, [currentVideoId, data]);

  // Handle video end - auto-play next in playlist
  const handleVideoEnd = useCallback(() => {
    if (currentPlaylist) {
      const nextItem = playNextInPlaylist();
      if (nextItem) {
        setCurrentVideoId(nextItem.videoId);
      } else {
        clearCurrentPlaylist();
        toast('Playlist finished!', { icon: '🎉' });
      }
    }
  }, [currentPlaylist, playNextInPlaylist, clearCurrentPlaylist, setCurrentVideoId]);

  if (!currentVideoId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Select a video to watch</p>
      </div>
    );
  }

  // Playlist panel is always shown when a playlist is active (even during loading/error)
  const playlistPanel = currentPlaylist ? <PlaylistPanel /> : null;

  if (isLoading) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <VideoPlayerSkeleton />
        </div>
        {playlistPanel && (
          <div className="hidden lg:block w-[402px] shrink-0">
            {playlistPanel}
          </div>
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
            <p className="text-lg font-medium">Failed to load video</p>
            <p className="text-sm text-muted-foreground">{error?.message}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
          {/* Show playlist panel on mobile even on error */}
          <div className="lg:hidden mt-4">{playlistPanel}</div>
        </div>
        {playlistPanel && (
          <div className="hidden lg:block w-[402px] shrink-0">
            {playlistPanel}
          </div>
        )}
      </div>
    );
  }

  const videoData = data!;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Video Player */}
        <YouTubeEmbedPlayer videoId={currentVideoId} title={videoData.video.title} isLive={videoData.video.isLive} onEnded={handleVideoEnd} />

        {/* Playlist Panel - Mobile (RIGHT AFTER video player, prominent position) */}
        <div className="lg:hidden mt-4">
          {playlistPanel}
        </div>

        {/* Video Info */}
        <VideoInfo
          videoData={videoData}
          videoId={currentVideoId}
          isLiked={isLiked}
          isSubscribed={isSubscribed}
          onLike={() => likeMutation.mutate({ action: isLiked ? 'remove_like' : 'like', video: videoData })}
          onDislike={() => likeMutation.mutate({ action: 'dislike', video: videoData })}
          onSaveWatchLater={() => watchLaterMutation.mutate(videoData)}
          onSubscribe={() => subscribeMutation.mutate(videoData)}
          onChannelClick={() => {
            if (videoData.video.channelId) {
              setCurrentChannelId(videoData.video.channelId);
              setCurrentView('channel');
            }
          }}
        />

        {/* Comments section - hidden by default, shown on click */}
        <CommentsSection videoId={currentVideoId} />

        {/* Related Videos section */}
        <RelatedVideos videos={videoData.relatedVideos || []} currentVideoId={currentVideoId} />
      </div>

      {/* Playlist Panel - Desktop (shown only when playlist is active) */}
      <div className="hidden lg:block w-[402px] shrink-0">
        {playlistPanel}
      </div>
    </div>
  );
}

/* ================================================================
   RELATED VIDEOS SECTION
   ================================================================ */

interface RelatedVideosProps {
  videos: YouTubeVideoData[];
  currentVideoId: string;
}

function RelatedVideos({ videos, currentVideoId }: RelatedVideosProps) {
  const { setCurrentVideoId } = useAppStore();

  // Filter out shorts (duration < 60s heuristic) and the current video, limit to 20
  const filteredVideos = videos
    .filter(v => v.videoId && v.videoId !== currentVideoId && v.duration >= 60)
    .slice(0, 20);

  if (filteredVideos.length === 0) return null;

  const handleVideoClick = (video: YouTubeVideoData) => {
    if (video.videoId) {
      setCurrentVideoId(video.videoId);
    }
  };

  return (
    <div className="mt-8 pb-6">
      <div className="flex items-center gap-2 mb-4">
        <ListMusic className="h-5 w-5 text-foreground" />
        <h3 className="text-base font-semibold">Related Videos</h3>
        <div className="flex-1 h-px bg-border ml-2" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-5">
        {filteredVideos.map((video, index) => (
          <RelatedVideoCard
            key={video.videoId || index}
            video={video}
            onClick={() => handleVideoClick(video)}
          />
        ))}
      </div>
    </div>
  );
}

interface RelatedVideoCardProps {
  video: YouTubeVideoData;
  onClick: () => void;
}

function RelatedVideoCard({ video, onClick }: RelatedVideoCardProps) {
  const { setCurrentChannelId, setCurrentView } = useAppStore();

  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (video.channelId) {
      setCurrentChannelId(video.channelId);
      setCurrentView('channel');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className="flex gap-3 cursor-pointer group rounded-lg"
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Play ${video.title}`}
    >
      {/* Thumbnail */}
      <div className="relative w-40 sm:w-44 shrink-0 aspect-video rounded-lg overflow-hidden bg-muted">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        {/* Duration badge */}
        {video.duration > 0 && (
          <div className="absolute bottom-1.5 right-1.5 bg-black/85 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="text-[13px] font-semibold leading-[1.4] line-clamp-2 text-foreground group-hover:text-foreground">
          {video.title}
        </h4>
        <button
          onClick={handleChannelClick}
          className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors truncate block mt-1 max-w-full"
        >
          {video.channelName}
          {video.verified && (
            <BadgeCheck className="h-3 w-3 text-foreground inline ml-1" />
          )}
        </button>
        <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-medium">
          {video.views > 0 && formatViews(video.views)}
          {video.views > 0 && video.uploadedDate && ' · '}
          {video.uploadedDate}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   YOUTUBE EMBED PLAYER
   ================================================================ */

function YouTubeEmbedPlayer({ videoId, title, isLive, onEnded }: { videoId: string; title: string; isLive?: boolean; onEnded?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { isReady, isEnded, playerRef } = useYouTubePlayer(containerRef, videoId, onEnded);
  const [isFs, setIsFs] = useState(false);

  // For live streams, open directly in YouTube
  if (isLive) {
    return (
      <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center">
        <img
          src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover opacity-60"
          onError={(e) => {
            (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="relative z-10 flex flex-col items-center gap-3 group"
        >
          <div className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors shadow-2xl">
            <svg className="w-10 h-10 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <span className="text-white text-sm font-medium bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
            Watch Live
          </span>
        </a>
      </div>
    );
  }

  // Native Fullscreen API toggle — target the YouTube iframe directly
  const toggleFs = useCallback(() => {
    // Try the YouTube iframe first for best results
    const iframe = wrapperRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
    const target = iframe || wrapperRef.current;
    if (!target) return;

    if (!document.fullscreenElement) {
      (target.requestFullscreen?.() || (target as any).webkitRequestFullscreen?.() || (target as any).mozRequestFullScreen?.()).catch?.(() => {});
    } else {
      (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.() || (document as any).mozCancelFullScreen?.()).catch?.(() => {});
    }
  }, []);

  // Exit fullscreen — works regardless of how fullscreen was entered
  const exitFs = useCallback(() => {
    if (document.fullscreenElement) {
      (document.exitFullscreen?.() || (document as any).webkitExitFullscreen?.() || (document as any).mozCancelFullScreen?.()).catch?.(() => {});
    }
    // Also try to exit from YouTube iframe
    const iframe = wrapperRef.current?.querySelector('iframe') as HTMLIFrameElement | null;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'exitFullscreen', args: [] }), '*');
    }
  }, []);

  // Listen for fullscreen change events + resize to detect YouTube's internal fullscreen
  useEffect(() => {
    const fsHandler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fsHandler);
    document.addEventListener('webkitfullscreenchange', fsHandler);

    // Also detect fullscreen via window size (catches YouTube's internal fullscreen)
    const resizeHandler = () => {
      const isFullScreen = (
        window.innerWidth === screen.width &&
        window.innerHeight === screen.height
      ) || !!document.fullscreenElement;
      setIsFs(isFullScreen);
    };
    window.addEventListener('resize', resizeHandler);

    return () => {
      document.removeEventListener('fullscreenchange', fsHandler);
      document.removeEventListener('webkitfullscreenchange', fsHandler);
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);

  // Replay video
  const handleReplay = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.seekTo(0, true);
      playerRef.current.playVideo();
    }
  }, [playerRef]);

  // Exit fullscreen when pressing back button on mobile
  useEffect(() => {
    if (!isFs) {
      delete (window as any).__vtFs;
      return;
    }
    (window as any).__vtFs = true;
    (window as any).__vtFsExit = () => {
      document.exitFullscreen?.();
    };
    try { window.history.pushState({ __vtFs: true }, ''); } catch {}
    return () => { delete (window as any).__vtFs; };
  }, [isFs]);

  return (
    <div>
      {/* Video player area */}
      <div
        ref={wrapperRef}
        className="relative w-full bg-black aspect-video"
        style={
          isFs
            ? { width: '100vw', height: '100vh' }
            : undefined
        }
      >
        {/* YouTube iframe container - disable pointer events when ended to block YouTube's end screen */}
        <div ref={containerRef} className={`w-full h-full ${isEnded ? 'pointer-events-none opacity-0' : ''}`} id="yt-player-container" />

        {/* Loading spinner */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="h-12 w-12 text-white animate-spin" />
          </div>
        )}

        {/* End-screen overlay — fully covers YouTube's related videos + shows replay button */}
        {isEnded && (
          <div className="absolute inset-0 z-10 bg-black flex flex-col items-center justify-center gap-4 cursor-pointer" onClick={handleReplay}>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, stiffness: 200, delay: 0.1 }}
              className="w-16 h-16 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center hover:bg-white/20 hover:scale-110 active:scale-95 transition-all shadow-2xl"
            >
              <svg className="w-8 h-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" />
              </svg>
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-white text-sm font-medium"
            >
              Tap to Replay
            </motion.p>
          </div>
        )}

        {/* V.I.P Tube branding label — positioned at bottom-right, does not block YouTube controls */}
        {!isFs && (
          <div
            className="absolute bottom-1 right-1 flex items-center gap-1 px-2 py-1 pointer-events-none select-none"
            style={{ background: 'rgba(0,0,0,0.5)', zIndex: 5, borderRadius: '4px' }}
          >
            <span className="text-white text-[10px] font-bold tracking-wide">V.I.P Tube</span>
          </div>
        )}

        {/* Exit fullscreen button — always visible in fullscreen, top-right */}
        {isFs && (
          <button
            onClick={exitFs}
            className="absolute top-3 right-3 z-[100] flex items-center gap-1.5 px-3 py-2 rounded-lg bg-black/70 hover:bg-black/90 text-white transition-colors backdrop-blur-sm"
            aria-label="Exit fullscreen"
          >
            <Minimize2 className="w-4 h-4" />
            <span className="text-xs font-medium">Exit</span>
          </button>
        )}
      </div>

      {/* Fullscreen button — BELOW the video player, not on top */}
      {!isFs && (
        <div className="flex justify-end mt-1.5">
          <button
            onClick={toggleFs}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="text-xs">Full screen</span>
          </button>
        </div>
      )}
    </div>
  );
}

/* ================================================================
   VIDEO INFO SECTION
   ================================================================ */

interface VideoInfoProps {
  videoData: VideoDetailsResponse;
  videoId: string;
  isLiked: boolean;
  isSubscribed: boolean;
  onLike: () => void;
  onDislike: () => void;
  onSaveWatchLater: () => void;
  onSubscribe: () => void;
  onChannelClick: () => void;
}

function VideoInfo({
  videoData,
  videoId,
  isLiked,
  isSubscribed,
  onLike,
  onDislike,
  onSaveWatchLater,
  onSubscribe,
  onChannelClick,
}: VideoInfoProps) {
  const [descExpanded, setDescExpanded] = useState(false);

  const handleShare = async () => {
    const url = `https://viptube-deploy-cv6p.vercel.app/watch?v=${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!', {
        description: video.title,
        action: {
          label: 'Watch on V.I.P Tube',
          onClick: () => window.open(url, '_blank'),
        },
      });
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const { video, likes, channelInfo } = videoData;

  return (
    <div className="mt-3 space-y-4">
      {/* Title - premium gradient hover */}
      <h1 className="text-xl font-extrabold leading-7 tracking-tight group/video hover:text-red-600 dark:hover:text-red-400 transition-colors duration-300">{video.title}</h1>

      {/* Channel info + actions */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-0 sm:justify-between">
        {/* Channel - avatar with hover ring */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-transparent hover:ring-red-500/30 transition-all duration-300 hover:scale-110" onClick={onChannelClick}>
            {channelInfo?.avatar || video.channelAvatar ? (
              <AvatarImage src={channelInfo?.avatar || video.channelAvatar || ''} alt={video.channelName} />
            ) : null}
            <AvatarFallback className="text-sm">
              {video.channelName?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="mr-3">
            <button
              className="flex items-center gap-1 text-[13px] font-semibold hover:text-foreground transition-colors"
              onClick={onChannelClick}
            >
              {video.channelName}
              {video.verified && (
                <BadgeCheck className="h-3.5 w-3.5 text-foreground" />
              )}
            </button>
            {channelInfo?.subscriberCount && (
              <p className="text-xs text-muted-foreground">
                {channelInfo.subscriberCount}
              </p>
            )}
          </div>
          <Button
            variant={isSubscribed ? 'secondary' : 'default'}
            className={`rounded-full font-bold transition-all duration-300 ${
              isSubscribed
                ? 'bg-muted text-foreground hover:bg-muted/80'
                : 'bg-gradient-to-r from-red-500 to-orange-500 text-white hover:from-red-600 hover:to-orange-600 shadow-md shadow-red-500/20'
            }`}
            size="sm"
            onClick={onSubscribe}
          >
            {isSubscribed ? 'Subscribed' : 'Subscribe'}
          </Button>
        </div>

        {/* Action buttons - premium glass style */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-full bg-muted/80 backdrop-blur-sm overflow-hidden shadow-sm">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`rounded-full gap-1.5 px-4 h-9 transition-all duration-200 ${
                      isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={onLike}
                  >
                    <ThumbsUp className={`h-4 w-4 ${isLiked ? 'fill-red-500' : ''}`} />
                    {likes && <span className="text-sm">{likes}</span>}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isLiked ? 'Remove like' : 'Like'}</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Separator orientation="vertical" className="h-6" />

            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full h-9 px-3 text-muted-foreground"
                    onClick={onDislike}
                  >
                    <ThumbsDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Dislike</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full gap-1.5 h-9 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all duration-200"
                  onClick={handleShare}
                >
                  <Share2 className="h-4 w-4" />
                  Share
                </Button>
              </TooltipTrigger>
              <TooltipContent>Share</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full gap-1.5 h-9"
                  onClick={onSaveWatchLater}
                >
                  <BookmarkPlus className="h-4 w-4" />
                  Save
                </Button>
              </TooltipTrigger>
              <TooltipContent>Save to Watch later</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" size="icon" className="rounded-full h-9 w-9">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Report</DropdownMenuItem>
              <DropdownMenuItem>Transcript</DropdownMenuItem>
              <DropdownMenuItem>Save to playlist</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Description */}
      <div className="bg-muted rounded-xl overflow-hidden">
        {/* Clickable header - always visible */}
        <button
          className="w-full flex items-center justify-between p-3 hover:bg-muted/80 transition-colors cursor-pointer"
          onClick={() => setDescExpanded(!descExpanded)}
        >
          <div className="flex items-center gap-2 text-sm font-medium">
            {video.views > 0 && formatViews(video.views)}
            {video.views > 0 && video.uploadedDate && ' · '}
            {video.uploadedDate}
          </div>
          <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
            {descExpanded ? 'Show less' : 'Description'}
            {descExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>
        {/* Expandable content - only shown when clicked */}
        {descExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="px-3 pb-3"
          >
            <div className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
              {videoData.description || 'No description available.'}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   COMMENTS SECTION - Real YouTube Comments
   ================================================================ */

interface YouTubeComment {
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

function CommentsSection({ videoId }: { videoId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<'top' | 'newest'>('top');
  const [allComments, setAllComments] = useState<YouTubeComment[]>([]);
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const { data, isLoading, isError } = useQuery<{
    comments: YouTubeComment[];
    commentCount: string;
    continuationToken?: string;
  }, Error>({
    queryKey: ['comments', videoId, sortBy],
    queryFn: async () => {
      const res = await fetch(`/api/piped/comments/${videoId}?max=30`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      return res.json();
    },
    enabled: !!videoId && isExpanded,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // Reset comments when video changes
  useEffect(() => {
    setAllComments([]);
    setContinuationToken(undefined);
    setIsExpanded(false);
  }, [videoId]);

  // Sync initial comments and continuation token
  useEffect(() => {
    if (data?.comments) {
      setAllComments(data.comments);
    }
    if (data?.continuationToken) {
      setContinuationToken(data.continuationToken);
    }
  }, [data]);

  const comments = allComments;
  const commentCount = data?.commentCount || '';

  // Handle toggle
  const handleToggle = () => {
    setIsExpanded(prev => !prev);
  };

  // Load more comments
  const handleLoadMoreComments = useCallback(async () => {
    if (!continuationToken || !videoId || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/piped/comments/${videoId}/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ continuationToken }),
      });
      if (res.ok) {
        const result = await res.json();
        if (result.comments?.length > 0) {
          setAllComments(prev => [...prev, ...result.comments]);
        }
        if (result.nextContinuationToken) {
          setContinuationToken(result.nextContinuationToken);
        } else {
          setContinuationToken(undefined);
        }
      }
    } catch (err) {
      console.error('Failed to load more comments:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [continuationToken, videoId, isLoadingMore]);

  return (
    <div className="mt-6">
      {/* Collapsible Header - Click to toggle comments */}
      <button
        className="flex items-center gap-3 group w-full text-left mb-1"
        onClick={handleToggle}
      >
        <h3 className="text-base font-semibold group-hover:text-foreground">
          {isExpanded && commentCount ? `${commentCount} Comments` : 'Comments'}
        </h3>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
      </button>

      {/* Collapsed state - show a compact preview */}
      {!isExpanded && (
        <div className="flex gap-3 mt-4 cursor-pointer group" onClick={handleToggle}>
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">U</AvatarFallback>
          </Avatar>
          <div className="flex-1 border-b border-muted-foreground/30 pb-1">
            <input
              type="text"
              placeholder="Add a comment..."
              className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none cursor-pointer"
              readOnly
            />
          </div>
        </div>
      )}

      {/* Expanded state - show full comments */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Comment input */}
            <div className="flex gap-3 mb-6">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">U</AvatarFallback>
              </Avatar>
              <div className="flex-1 border-b border-muted-foreground/30 pb-1">
                <input
                  type="text"
                  placeholder="Add a comment..."
                  className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
                />
              </div>
            </div>

            {/* Sort buttons */}
            <div className="flex gap-2 mb-4">
              <Button
                variant="ghost"
                size="sm"
                className={`text-sm rounded-full ${sortBy === 'top' ? 'font-medium' : 'text-muted-foreground'}`}
                onClick={() => setSortBy('top')}
              >
                Top comments
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={`text-sm rounded-full ${sortBy === 'newest' ? 'font-medium' : 'text-muted-foreground'}`}
                onClick={() => setSortBy('newest')}
              >
                Newest first
              </Button>
            </div>

            <Separator className="mb-4" />

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Error state */}
            {isError && (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="text-muted-foreground/40 text-3xl">💬</div>
                <p className="text-sm text-muted-foreground">
                  Comments could not be loaded.
                </p>
                <p className="text-xs text-muted-foreground">
                  This video may have comments disabled.
                </p>
              </div>
            )}

            {/* Comments list */}
            {!isLoading && !isError && comments.length === 0 && (
              <div className="flex flex-col items-center py-10 gap-3">
                <div className="text-muted-foreground/40 text-3xl">💬</div>
                <p className="text-sm text-muted-foreground">
                  No comments available.
                </p>
                <p className="text-xs text-muted-foreground">
                  Comments may be turned off for this video.
                </p>
              </div>
            )}

            {!isLoading && !isError && comments.length > 0 && (
              <div className="space-y-5">
                {comments.map((comment) => (
                  <CommentItem key={comment.commentId} comment={comment} videoId={videoId} />
                ))}

                {/* Load more comments */}
                {continuationToken && (
                  <div className="flex justify-center pt-4">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={handleLoadMoreComments}
                      disabled={isLoadingMore}
                      className="gap-2 px-8 rounded-full"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading more comments...
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-4 w-4" />
                          Load more comments
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* End of comments */}
                {!continuationToken && comments.length > 0 && (
                  <p className="text-center text-sm text-muted-foreground pt-4">
                    No more comments to show
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CommentItem({ comment, videoId }: { comment: YouTubeComment; videoId: string }) {
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<YouTubeComment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const handleLike = () => {
    if (liked) {
      setLiked(false);
    } else {
      setLiked(true);
      setDisliked(false);
    }
  };

  const handleDislike = () => {
    if (disliked) {
      setDisliked(false);
    } else {
      setDisliked(true);
      setLiked(false);
    }
  };

  const handleLoadReplies = async () => {
    if (showReplies) {
      setShowReplies(false);
      return;
    }
    if (replies.length > 0) {
      setShowReplies(true);
      return;
    }
    setLoadingReplies(true);
    try {
      const params = new URLSearchParams({
        commentId: comment.commentId,
        videoId: videoId,
      });
      if (comment.replyContinuationToken) {
        params.set('token', comment.replyContinuationToken);
      }
      const res = await fetch(`/api/piped/comments/replies?${params}`);
      if (res.ok) {
        const result = await res.json();
        if (result.comments?.length > 0) {
          setReplies(result.comments);
        }
      }
    } catch {
      // Replies not available
    } finally {
      setLoadingReplies(false);
      setShowReplies(true);
    }
  };

  return (
    <div className="flex gap-3">
      <Avatar className="h-10 w-10 shrink-0">
        {comment.authorAvatar ? (
          <AvatarImage src={comment.authorAvatar} alt={comment.authorName} />
        ) : null}
        <AvatarFallback className="text-xs">
          {comment.authorName?.[0]?.toUpperCase() || 'U'}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        {/* Author info */}
        <div className="flex items-center gap-1.5">
          <span className={`text-[13px] font-medium ${comment.isCreator ? 'text-foreground' : ''}`}>
            {comment.authorName}
            {comment.isCreator && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded text-foreground">
                Creator
              </span>
            )}
          </span>
          {comment.isVerified && (
            <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className="text-xs text-muted-foreground">
            {comment.publishedTime}
          </span>
        </div>

        {/* Comment text */}
        <p className="text-sm mt-1 whitespace-pre-line leading-relaxed">
          {comment.text}
        </p>

        {/* Action buttons */}
        <div className="flex items-center gap-1 mt-2">
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 rounded-full ${liked ? 'text-foreground' : 'text-muted-foreground'}`}
            onClick={handleLike}
          >
            <ThumbsUp className={`h-3.5 w-3.5 ${liked ? 'fill-current' : ''}`} />
          </Button>
          {comment.likeCount && (
            <span className={`text-xs -ml-1 ${liked ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              {liked && comment.likeCount !== '0'
                ? String(Number(comment.likeCount) + 1)
                : comment.likeCount}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={`h-8 w-8 p-0 rounded-full ${disliked ? 'text-foreground' : 'text-muted-foreground'}`}
            onClick={handleDislike}
          >
            <ThumbsDown className={`h-3.5 w-3.5 ${disliked ? 'fill-current' : ''}`} />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3 rounded-full text-xs text-muted-foreground">
            Reply
          </Button>
        </div>

        {/* Pinned indicator */}
        {comment.pinnedText && (
          <div className="flex items-center gap-1.5 mt-1">
            <svg className="h-3.5 w-3.5 text-muted-foreground" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
            </svg>
            <span className="text-xs text-muted-foreground font-medium">{comment.pinnedText}</span>
          </div>
        )}

        {/* Reply count indicator */}
        {comment.replyCount > 0 && (
          <div className="mt-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-500 font-medium text-sm -ml-2 rounded-full hover:bg-blue-500/10"
              onClick={handleLoadReplies}
              disabled={loadingReplies}
            >
              {loadingReplies ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <ChevronDown className={`h-4 w-4 mr-1 transition-transform ${showReplies ? 'rotate-180' : ''}`} />
              )}
              {showReplies ? 'Hide' : ''}
              {comment.replyCount} {comment.replyCount === 1 ? 'reply' : 'replies'}
            </Button>
          </div>
        )}

        {/* Replies section */}
        {showReplies && replies.length > 0 && (
          <div className="mt-3 ml-2 space-y-4 border-l-2 border-muted pl-4">
            {replies.map((reply) => (
              <div key={reply.commentId} className="flex gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  {reply.authorAvatar ? (
                    <AvatarImage src={reply.authorAvatar} alt={reply.authorName} />
                  ) : null}
                  <AvatarFallback className="text-[10px]">
                    {reply.authorName?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[13px] font-medium ${reply.isCreator ? 'text-foreground' : ''}`}>
                      {reply.authorName}
                      {reply.isCreator && (
                        <span className="ml-1 px-1.5 py-0.5 text-[10px] font-medium bg-muted rounded text-foreground">
                          Creator
                        </span>
                      )}
                    </span>
                    {reply.isVerified && (
                      <BadgeCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {reply.publishedTime}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-line leading-relaxed">
                    {reply.text}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full text-muted-foreground">
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    {reply.likeCount && (
                      <span className="text-xs text-muted-foreground -ml-1">{reply.likeCount}</span>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full text-muted-foreground">
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No replies available message */}
        {showReplies && replies.length === 0 && !loadingReplies && (
          <p className="text-xs text-muted-foreground mt-2 ml-1">Replies are not available for this comment.</p>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   PLAYLIST PANEL
   ================================================================ */

function PlaylistPanel() {
  const {
    currentPlaylist,
    setCurrentPlaylist,
    clearCurrentPlaylist,
    setCurrentVideoId,
    playNextInPlaylist,
    playPrevInPlaylist,
    currentVideoId,
  } = useAppStore();

  if (!currentPlaylist) return null;

  const { videos, currentIndex, name, channelName, thumbnail } = currentPlaylist;
  const currentIndexActual = currentPlaylist.videos.findIndex(
    (v) => v.videoId === currentVideoId
  );
  const activeIndex = currentIndexActual >= 0 ? currentIndexActual : currentIndex;

  const handleVideoClick = (index: number) => {
    const video = videos[index];
    if (!video) return;
    setCurrentPlaylist({
      ...currentPlaylist,
      currentIndex: index,
    });
    setCurrentVideoId(video.videoId);
  };

  const handlePrev = () => {
    const prev = playPrevInPlaylist();
    if (prev) setCurrentVideoId(prev.videoId);
  };

  const handleNext = () => {
    const next = playNextInPlaylist();
    if (next) setCurrentVideoId(next.videoId);
  };

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            {currentPlaylist.videos.length > 0 ? (
              <img
                src={`https://i.ytimg.com/vi/${currentPlaylist.videos[0].videoId}/hqdefault.jpg`}
                alt={name}
                className="w-24 h-[54px] rounded-lg object-cover shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-24 h-[54px] rounded-lg bg-muted flex items-center justify-center shrink-0">
                <ListMusic className="h-6 w-6 text-muted-foreground/50" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-medium leading-tight line-clamp-2">{name}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {channelName}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentIndexActual >= 0 ? currentIndexActual + 1 : currentIndex + 1} / {videos.length} videos
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={clearCurrentPlaylist}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handlePrev}
                    disabled={activeIndex <= 0}
                  >
                    <SkipBack className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Previous</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleNext}
                    disabled={activeIndex >= videos.length - 1}
                  >
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Next</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          {activeIndex < videos.length - 1 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              onClick={handleNext}
            >
              <span className="font-medium">Up next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <Separator className="mb-2" />

      {/* Video list */}
      <div className="max-h-[calc(100vh-360px)] overflow-y-auto -mx-1 px-1 custom-scrollbar">
        <div className="space-y-0.5">
          {videos.map((video, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={`${video.videoId}-${index}`}
                className={`w-full flex gap-2.5 p-2 rounded-lg text-left transition-colors group ${
                  isActive
                    ? 'bg-muted'
                    : 'hover:bg-muted/60'
                }`}
                onClick={() => handleVideoClick(index)}
              >
                {/* Thumbnail */}
                <div className="relative w-[120px] aspect-video rounded-md overflow-hidden bg-muted shrink-0">
                  <img
                    src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = `https://i.ytimg.com/vi/${video.videoId}/mqdefault.jpg`;
                    }}
                  />
                  {isActive && (
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <div className="flex items-center gap-1">
                        <Volume2 className="h-3 w-3 text-white animate-pulse" />
                      </div>
                    </div>
                  )}
                  {video.duration > 0 && (
                    <div className={`absolute bottom-1 right-1 text-[10px] font-medium px-1 py-0.5 rounded ${
                      isActive ? 'bg-foreground text-background' : 'bg-black/80 text-white'
                    }`}>
                      {formatDuration(video.duration)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 py-0.5">
                  {isActive && (
                    <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
                      Now Playing
                    </span>
                  )}
                  <p className={`text-xs font-medium leading-tight mt-0.5 line-clamp-2 ${
                    isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
                  }`}>
                    {video.title}
                  </p>
                  {video.channelName && (
                    <p className="text-[11px] text-muted-foreground mt-1 truncate">
                      {video.channelName}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* End of playlist */}
        {activeIndex >= videos.length - 1 && (
          <div className="text-center py-4">
            <p className="text-xs text-muted-foreground">
              You&apos;ve reached the end of the playlist
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================
   SKELETON
   ================================================================ */

function VideoPlayerSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0 space-y-3">
        <Skeleton className="w-full aspect-video rounded-xl" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <div className="flex gap-2 mt-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 rounded-full" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl mt-3" />
      </div>
      <div className="hidden lg:block w-[402px] shrink-0 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-2">
            <Skeleton className="w-40 aspect-video rounded-lg shrink-0" />
            <div className="flex-1 space-y-2 py-0.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
