'use client';

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, SearchX, Users, ListVideo, Video, ChevronRight, Play, Flame, Clapperboard, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAppStore, type VideoItem } from '@/store/app-store';
import VideoCard from './VideoCard';
import { toVideoItem, formatDuration, type YouTubeVideoData } from '@/lib/video-utils';

const filterTabs = [
  { label: 'All', value: 'all' },
  { label: 'Videos', value: 'videos' },
  { label: 'Shorts', value: 'shorts' },
  { label: 'Channels', value: 'channels' },
  { label: 'Playlists', value: 'playlists' },
];

function VideoCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="w-full aspect-video rounded-xl" />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-9 rounded-full shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  );
}

function ChannelCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="h-12 w-12 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  );
}

function PlaylistCardSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3">
      <Skeleton className="w-40 sm:w-48 aspect-video rounded-lg shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export default function SearchResults() {
  const { searchQuery, setCurrentChannelId, setCurrentView, setCurrentVideoId } = useAppStore();
  const [activeFilter, setActiveFilter] = useState('all');

  const handleChannelClick = (channelId: string) => {
    setCurrentChannelId(channelId);
    setCurrentView('channel');
  };

  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null);

  const handlePlaylistClick = useCallback(async (playlist: any) => {
    if (!playlist.playlistId) return;
    try {
      setLoadingPlaylist(playlist.playlistId);
      const res = await fetch(`/api/piped/playlist/${encodeURIComponent(playlist.playlistId)}`);
      if (!res.ok) {
        // Try YouTube direct fallback if Piped fails
        const ytRes = await fetch(`/api/piped/playlist/${encodeURIComponent(playlist.playlistId)}?fallback=yt`);
        if (!ytRes.ok) return;
        const ytData = await ytRes.json();
        const ytVideos = (ytData.videos || []).filter((v: any) => v.videoId);
        if (ytVideos.length === 0) return;
        const { setCurrentPlaylist } = useAppStore.getState();
        setCurrentPlaylist({
          id: playlist.playlistId,
          name: ytData.name || playlist.title || 'Playlist',
          thumbnail: ytData.thumbnailUrl || playlist.thumbnail || '',
          channelName: ytData.uploaderName || playlist.channelName || '',
          videos: ytVideos.map((v: any) => ({
            videoId: v.videoId,
            title: v.title || 'Untitled',
            thumbnail: v.thumbnail || '',
            channelId: v.channelId || '',
            channelName: v.channelName || '',
            duration: v.duration || 0,
          })),
          currentIndex: 0,
        });
        setCurrentVideoId(ytVideos[0].videoId);
        setCurrentView('watch');
        return;
      }
      const data = await res.json();
      const playlistVideos = (data.videos || []).filter((v: any) => v.videoId);
      if (playlistVideos.length === 0) return;
      const { setCurrentPlaylist } = useAppStore.getState();
      setCurrentPlaylist({
        id: playlist.playlistId,
        name: data.name || playlist.title || 'Playlist',
        thumbnail: data.thumbnailUrl || playlist.thumbnail || '',
        channelName: data.uploaderName || playlist.channelName || '',
        videos: playlistVideos.map((v: any) => ({
          videoId: v.videoId,
          title: v.title || 'Untitled',
          thumbnail: v.thumbnail || '',
          channelId: v.channelId || '',
          channelName: v.channelName || '',
          duration: v.duration || 0,
        })),
        currentIndex: 0,
      });
      setCurrentVideoId(playlistVideos[0].videoId);
      setCurrentView('watch');
    } catch (err) {
      console.error('Playlist load error:', err);
    } finally {
      setLoadingPlaylist(null);
    }
  }, [setCurrentVideoId, setCurrentView]);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    videos: YouTubeVideoData[];
    channels?: any[];
    playlists?: any[];
    shorts?: YouTubeVideoData[];
  }, Error>({
    queryKey: ['search', searchQuery, activeFilter],
    queryFn: async () => {
      if (!searchQuery.trim()) return { videos: [], channels: [], playlists: [] };
      const res = await fetch(
        `/api/piped/search?q=${encodeURIComponent(searchQuery)}&filter=${activeFilter}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      return res.json();
    },
    enabled: !!searchQuery.trim(),
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });

  // Separate shorts (duration < 60s) from regular videos
  const allVideos = useMemo(() => (data?.videos || []).map(toVideoItem), [data?.videos]);
  const regularVideos = useMemo(() => allVideos.filter(v => !v.isShort && v.duration >= 60), [allVideos]);
  // Use dedicated shorts from API + any shorts found in regular results
  const apiShorts = useMemo(() => (data?.shorts || []).map(toVideoItem), [data?.shorts]);
  const resultShorts = useMemo(() => allVideos.filter(v => v.isShort || v.duration < 60), [allVideos]);
  const shortsVideos = useMemo(() => {
    const seen = new Set<string>();
    const merged: VideoItem[] = [];
    // Prioritize dedicated shorts results
    for (const v of apiShorts) {
      if (v.videoId && !seen.has(v.videoId)) {
        seen.add(v.videoId);
        merged.push(v);
      }
    }
    // Add any shorts found in regular results
    for (const v of resultShorts) {
      if (v.videoId && !seen.has(v.videoId)) {
        seen.add(v.videoId);
        merged.push(v);
      }
    }
    return merged;
  }, [apiShorts, resultShorts]);
  const channels = data?.channels || [];
  const playlists = data?.playlists || [];

  // Display based on active filter tab
  const displayVideos = (activeFilter === 'all' || activeFilter === 'videos') ? regularVideos : [];
  const displayChannels = (activeFilter === 'all' || activeFilter === 'channels') ? channels : [];
  const displayPlaylists = activeFilter === 'playlists' ? playlists : [];
  const displayShorts = activeFilter === 'shorts' ? shortsVideos : [];

  const totalResults = allVideos.length + channels.length + playlists.length + shortsVideos.length;
  const hasResults = displayVideos.length > 0 || displayChannels.length > 0 || displayPlaylists.length > 0 || displayShorts.length > 0;

  if (!searchQuery.trim()) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <SearchX className="h-16 w-16 text-muted-foreground/50" />
        <div className="text-center">
          <p className="text-lg font-medium text-muted-foreground">Search for videos</p>
          <p className="text-sm text-muted-foreground mt-1">
            Type something in the search bar to get started
          </p>
        </div>
      </div>
    );
  }

  // Loading skeletons vary by filter
  const renderLoading = () => {
    if (activeFilter === 'channels') {
      return (
        <div className="space-y-1">
          {Array.from({ length: 10 }).map((_, i) => (
            <ChannelCardSkeleton key={i} />
          ))}
        </div>
      );
    }
    if (activeFilter === 'playlists') {
      return (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <PlaylistCardSkeleton key={i} />
          ))}
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
        {Array.from({ length: 16 }).map((_, i) => (
          <VideoCardSkeleton key={i} />
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      {/* Filter tabs */}
      <div className="sticky top-14 z-20 bg-background border-b">
        <div className="flex gap-2 px-4 py-3 overflow-x-auto scrollbar-hide">
          {filterTabs.map((tab) => (
            <motion.button
              key={tab.label}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveFilter(tab.value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFilter === tab.value
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-foreground hover:bg-muted/80'
              }`}
            >
              {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {/* Result count */}
        {!isLoading && !isError && totalResults > 0 && (
          <p className="text-sm text-muted-foreground mb-4">
            About {totalResults} result{totalResults !== 1 ? 's' : ''}
            {activeFilter !== 'all' && (
              <span> for &quot;{activeFilter}&quot;</span>
            )}
          </p>
        )}

        {/* Loading */}
        {isLoading && renderLoading()}

        {/* Error */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <AlertCircle className="h-12 w-12 text-muted-foreground" />
            <div className="text-center">
              <p className="text-lg font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground mt-1">
                {error?.message || 'Failed to load search results'}
              </p>
            </div>
            <Button variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Try again
            </Button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !isError && !hasResults && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <SearchX className="h-16 w-16 text-muted-foreground/50" />
            <div className="text-center">
              <p className="text-lg font-medium text-muted-foreground">No results found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try different keywords or check your spelling
              </p>
            </div>
          </div>
        )}

        {/* Channel results */}
        {!isLoading && displayChannels.length > 0 && (
          <div className="mb-6">
            {activeFilter === 'all' && <h3 className="text-base font-bold mb-3">Channels</h3>}
            <div className="space-y-2">
              {displayChannels.map((channel: any, index: number) => (
                <motion.button
                  key={channel.channelId || index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleChannelClick(channel.channelId)}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer text-left"
                >
                  <div className="h-12 w-12 rounded-full overflow-hidden bg-muted shrink-0">
                    {channel.avatar ? (
                      <img src={channel.avatar} alt={channel.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-lg font-semibold text-muted-foreground">
                        {(channel.name || 'C')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{channel.name || channel.channelName}</p>
                      {channel.verified && (
                        <svg className="h-3.5 w-3.5 text-muted-foreground shrink-0" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                      )}
                    </div>
                    {channel.subscribers && (
                      <p className="text-xs text-muted-foreground">{channel.subscribers}</p>
                    )}
                    {channel.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{channel.description}</p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full text-xs h-8 shrink-0">
                    Visit
                  </Button>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Playlist results */}
        {!isLoading && displayPlaylists.length > 0 && (
          <div className="mb-6">
            {activeFilter === 'all' && <h3 className="text-base font-bold mb-3">Playlists</h3>}
            <div className="space-y-2">
              {displayPlaylists.map((playlist: any, index: number) => (
                <motion.button
                  key={playlist.playlistId || index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handlePlaylistClick(playlist)}
                  disabled={loadingPlaylist === playlist.playlistId}
                  className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer text-left disabled:opacity-60"
                >
                  <div className="relative w-40 sm:w-48 aspect-video rounded-lg overflow-hidden bg-muted shrink-0">
                    {playlist.thumbnail ? (
                      <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ListVideo className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                    <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-medium px-1.5 py-0.5 rounded">
                      {playlist.videoCount > 0 ? `${playlist.videoCount} videos` : <Play className="h-3 w-3" />}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{playlist.title}</p>
                    {playlist.channelName && (
                      <p className="text-xs text-muted-foreground mt-1">{playlist.channelName}</p>
                    )}
                  </div>
                  {loadingPlaylist === playlist.playlistId ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Video results */}
        {!isLoading && !isError && displayVideos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            {/* Section header for mixed view */}
            {(activeFilter === 'all' && channels.length > 0) && (
              <h3 className="text-base font-bold mb-3 mt-2">Videos</h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
              {displayVideos.map((video: VideoItem, index: number) => (
                <motion.div
                  key={video.videoId || index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
                >
                  <VideoCard video={video} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Shorts section — vertical snap scroll like YouTube Shorts */}
        {!isLoading && !isError && displayShorts.length > 0 && activeFilter === 'shorts' && (
          <div className="fixed inset-0 top-[104px] z-30 bg-black">
            <div
              className="h-full overflow-y-auto snap-y snap-mandatory"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {displayShorts.map((video: VideoItem, index: number) => (
                <div
                  key={video.videoId || `short-${index}`}
                  className="h-full w-full snap-start snap-always flex items-center justify-center relative bg-black"
                >
                  {/* Thumbnail */}
                  <img
                    src={video.thumbnail}
                    alt={video.title}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  {/* Gradient overlays */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent" />

                  {/* Play button center */}
                  <button
                    className="absolute inset-0 flex items-center justify-center z-10"
                    onClick={() => {
                      if (video.videoId) {
                        useAppStore.getState().setCurrentVideoId(video.videoId);
                        useAppStore.getState().setCurrentView('watch');
                      }
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors active:scale-90">
                      <Play className="h-8 w-8 text-white fill-white ml-1" />
                    </div>
                  </button>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 p-4 pb-8">
                    <p className="text-white text-sm font-semibold line-clamp-2 drop-shadow-lg mb-1">
                      {video.title}
                    </p>
                    <p className="text-white/70 text-xs drop-shadow">
                      {video.uploaderName}
                    </p>
                    {video.duration > 0 && (
                      <div className="absolute bottom-4 right-4 bg-black/70 text-white text-[11px] font-medium px-2 py-0.5 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                  </div>

                  {/* Shorts badge top-left */}
                  <div className="absolute top-4 left-4 z-10 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider flex items-center gap-1">
                    <Clapperboard className="h-3 w-3" />
                    Shorts
                  </div>

                  {/* Swipe hint on first short */}
                  {index === 0 && displayShorts.length > 1 && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1 animate-bounce">
                      <div className="w-6 h-10 border-2 border-white/50 rounded-full flex items-start justify-center p-1">
                        <div className="w-1.5 h-2.5 bg-white/70 rounded-full animate-pulse" />
                      </div>
                      <p className="text-white/50 text-[10px]">Swipe up</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {/* Close button */}
            <button
              onClick={() => setActiveFilter('all')}
              className="absolute top-3 right-3 z-40 w-8 h-8 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {/* Counter */}
            <div className="absolute top-4 left-14 z-40 bg-black/50 backdrop-blur-sm text-white text-[11px] font-medium px-2.5 py-1 rounded-full">
              {displayShorts.length} shorts
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
