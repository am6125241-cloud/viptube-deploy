'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Play, BadgeCheck, ListPlus, ListPlusIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore, type VideoItem } from '@/store/app-store';
import { formatDuration, formatViews, extractVideoId, extractChannelId } from '@/lib/video-utils';

/* ================================================================
   WATCH PROGRESS HOOK
   ================================================================ */
function getWatchProgressFromStorage(videoId: string | undefined): number | null {
  if (!videoId) return null;
  try {
    const stored = localStorage.getItem('viptube-watch-progress');
    if (stored) {
      const map: Record<string, number> = JSON.parse(stored);
      return map[videoId] ?? null;
    }
  } catch {
    // ignore
  }
  return null;
}

function useWatchProgress(videoId: string | undefined) {
  const [progress, setProgress] = useState<number | null>(() => getWatchProgressFromStorage(videoId));
  return progress;
}

export function setWatchProgress(videoId: string, percentage: number) {
  try {
    const stored = localStorage.getItem('viptube-watch-progress');
    const map: Record<string, number> = stored ? JSON.parse(stored) : {};
    if (percentage >= 95) {
      delete map[videoId]; // Remove progress for fully watched videos
    } else {
      map[videoId] = percentage;
    }
    localStorage.setItem('viptube-watch-progress', JSON.stringify(map));
  } catch {
    // ignore
  }
}

interface VideoCardProps {
  video: VideoItem;
}

export default function VideoCard({ video }: VideoCardProps) {
  const { setCurrentView, setCurrentVideoId, setCurrentChannelId, addToQueue } = useAppStore();
  const [imageLoaded, setImageLoaded] = useState(false);

  const videoId = video.videoId || extractVideoId(video.url || '');
  const channelId = video.channelId || extractChannelId(video.uploaderUrl || '');
  const progress = useWatchProgress(videoId);

  const handleClick = () => {
    if (videoId) {
      setCurrentVideoId(videoId);
      setCurrentView('watch');
    }
  };

  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (channelId) {
      setCurrentChannelId(channelId);
      setCurrentView('channel');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoId) {
      addToQueue({
        videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        channelId: video.channelId || '',
        channelName: video.uploaderName,
        duration: video.duration,
      });
    }
  };

  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 rounded-2xl premium-hover-lift"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Play ${video.title}`}
      data-video-card
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-muted shadow-md group-hover:shadow-2xl group-hover:shadow-red-500/10 dark:group-hover:shadow-red-500/5 transition-all duration-500 card-gradient-border">
        {!imageLoaded && (
          <div className="absolute inset-0 bg-muted animate-pulse" />
        )}
        <img
          src={video.thumbnail}
          alt={video.title}
          className={`w-full h-full object-cover transition-all duration-500 group-hover:scale-110 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
            setImageLoaded(true);
          }}
        />

        {/* Hover overlay with shimmer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
        {/* Shimmer sweep on hover */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
          <div className="absolute inset-0 shimmer-bg" />
        </div>

        {/* Play button on hover - premium glow */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            initial={false}
            whileHover={{ scale: 1.15 }}
            className="w-16 h-16 rounded-full bg-red-600/90 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 scale-50 group-hover:scale-100 transition-all duration-400 shadow-[0_0_30px_rgba(239,68,68,0.5),0_8px_25px_rgba(0,0,0,0.3)]"
          >
            <Play className="h-8 w-8 text-white fill-white ml-1 drop-shadow-lg" />
          </motion.div>
        </div>

        {/* Duration badge - glassmorphism */}
        {video.duration > 0 && (
          <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md text-white text-[11px] font-bold px-2 py-0.5 rounded-lg tracking-wide shadow-sm">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Shorts badge - animated gradient */}
        {video.isShort && (
          <div className="absolute top-2.5 left-2.5 bg-gradient-to-r from-red-600 to-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-md shadow-red-500/30 animate-pulse-glow">
            Shorts
          </div>
        )}

        {/* Add to queue button on hover */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-black/70 hover:bg-black/90 text-white shadow-sm border-0"
                  onClick={handleAddToQueue}
                >
                  <ListPlus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Add to queue</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Watch progress bar */}
        {progress !== null && progress > 0 && progress < 95 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <motion.div
              className="h-full bg-red-500 rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        )}

        {/* Preview progress bar at bottom on hover (only if no real progress) */}
        {progress === null && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="h-full bg-red-500 w-1/3 rounded-r-full" />
          </div>
        )}
      </div>

      {/* Video info */}
      <div className="flex gap-3 mt-3 px-1">
        {/* Channel avatar - animated ring on hover */}
        <div className="shrink-0" onClick={handleChannelClick}>
          <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent group-hover:ring-red-500/40 transition-all duration-500 group-hover:scale-110">
            {video.uploaderAvatar ? (
              <AvatarImage src={video.uploaderAvatar} alt={video.uploaderName} />
            ) : null}
            <AvatarFallback className="text-xs bg-gradient-to-br from-muted to-muted/50">
              {(video.uploaderName || 'U')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <h3 className="text-[13px] font-bold leading-[1.4] line-clamp-2 text-foreground group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors duration-300">
            {video.title}
          </h3>
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={handleChannelClick}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors truncate max-w-full font-medium"
            >
              {video.uploaderName}
            </button>
            {video.uploaderVerified && (
              <BadgeCheck className="h-3.5 w-3.5 text-foreground shrink-0" />
            )}
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-medium">
            {video.views > 0 && formatViews(video.views)}
            {video.views > 0 && video.uploadedDate && ' · '}
            {video.uploadedDate}
            {progress !== null && progress > 0 && progress < 95 && (
              <>
                {' · '}
                <span className="text-red-500 font-bold animate-pulse">Resume</span>
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* Compact variant for related videos sidebar */
interface CompactVideoCardProps {
  video: VideoItem;
}

export function CompactVideoCard({ video }: CompactVideoCardProps) {
  const { setCurrentView, setCurrentVideoId, setCurrentChannelId, addToQueue } = useAppStore();

  const videoId = video.videoId || extractVideoId(video.url || '');
  const channelId = video.channelId || extractChannelId(video.uploaderUrl || '');
  const progress = useWatchProgress(videoId);

  const handleClick = () => {
    if (videoId) {
      setCurrentVideoId(videoId);
      setCurrentView('watch');
    }
  };

  const handleChannelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (channelId) {
      setCurrentChannelId(channelId);
      setCurrentView('channel');
    }
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoId) {
      addToQueue({
        videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        channelId: video.channelId || '',
        channelName: video.uploaderName,
        duration: video.duration,
      });
    }
  };

  return (
    <div
      className="flex gap-2 cursor-pointer group rounded-xl hover:bg-muted/50 p-1.5 -m-1.5 transition-all duration-300 hover:shadow-md hover:shadow-red-500/5"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      data-video-card
    >
      {/* Thumbnail */}
      <div className="relative w-40 shrink-0 aspect-video rounded-xl overflow-hidden bg-muted shadow-sm group-hover:shadow-lg transition-all duration-300">
        <img
          src={video.thumbnail}
          alt={video.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          loading="lazy"
        />
        {video.duration > 0 && (
          <div className="absolute bottom-1 right-1 bg-black/85 text-white text-[10px] font-medium px-1 py-0.5 rounded">
            {formatDuration(video.duration)}
          </div>
        )}

        {/* Add to queue button on hover */}
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6 rounded-full bg-black/70 hover:bg-black/90 text-white shadow-sm border-0"
                  onClick={handleAddToQueue}
                >
                  <ListPlus className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Add to queue</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Watch progress bar */}
        {progress !== null && progress > 0 && progress < 95 && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/20">
            <div className="h-full bg-red-500 rounded-r-full" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5">
        <h4 className="text-[13px] font-bold leading-[1.4] line-clamp-2 text-foreground group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors duration-300">
          {video.title}
        </h4>
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={handleChannelClick}
            className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors truncate"
          >
            {video.uploaderName}
          </button>
          {video.uploaderVerified && (
            <BadgeCheck className="h-3 w-3 text-foreground shrink-0" />
          )}
        </div>
        <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-medium">
          {video.views > 0 && formatViews(video.views)}
          {video.views > 0 && video.uploadedDate && ' · '}
          {video.uploadedDate}
          {progress !== null && progress > 0 && progress < 95 && (
            <>
              {' · '}
              <span className="text-red-500 font-medium">Resume</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
