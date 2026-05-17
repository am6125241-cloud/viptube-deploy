'use client';

import { useState, useRef, useEffect } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { RefreshCw, AlertCircle, SearchX, BadgeCheck, ArrowLeft, Video, PlaySquare, ListVideo, Loader2, ChevronDown, Play, Film, ListMusic } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { useAppStore, type VideoItem, type QueueItem } from '@/store/app-store';
import VideoCard from './VideoCard';
import { toVideoItem, formatViews, type ChannelDataResponse, type YouTubePlaylist } from '@/lib/video-utils';

const tabItems = [
  { key: 'Videos', icon: Video },
  { key: 'Shorts', icon: PlaySquare },
  { key: 'Playlists', icon: ListVideo },
];

/* ===== Shorts Card Component ===== */
function ShortsCard({ video, onClick }: { video: any; onClick: (videoId: string) => void }) {
  return (
    <motion.div
      className="group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(video.videoId)}
    >
      <div className="relative rounded-xl overflow-hidden bg-muted aspect-[9/16]">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Film className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Play button overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>
        {/* Bottom gradient with info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-10 pb-2 px-2.5">
          <p className="text-white text-xs font-medium line-clamp-2 leading-tight">
            {video.title}
          </p>
          {video.views > 0 && (
            <p className="text-white/70 text-[10px] mt-0.5">
              {formatViews(video.views, 'views')}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/* ===== Playlist Card Component ===== */
function PlaylistCard({ playlist, onClick }: { playlist: YouTubePlaylist; onClick: (playlistId: string) => void }) {
  return (
    <motion.div
      className="group cursor-pointer"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      onClick={() => onClick(playlist.playlistId)}
    >
      <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
        {playlist.thumbnail ? (
          <img
            src={playlist.thumbnail}
            alt={playlist.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <ListMusic className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <Play className="h-6 w-6 text-white fill-white ml-0.5" />
          </div>
        </div>
        {/* Video count badge */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-[11px] font-medium px-1.5 py-0.5 rounded-md backdrop-blur-sm">
          {playlist.videoCount > 0 ? `${playlist.videoCount} videos` : 'Playlist'}
        </div>
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="text-sm font-medium line-clamp-2 leading-tight group-hover:text-foreground transition-colors">
          {playlist.title}
        </h3>
        {playlist.channelName && (
          <p className="text-xs text-muted-foreground mt-1 truncate">
            {playlist.channelName}
          </p>
        )}
        {playlist.updatedDate && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Updated {playlist.updatedDate}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/* ===== Empty State Component ===== */
function TabEmptyState({ tab }: { tab: string }) {
  const messages: Record<string, { title: string; subtitle: string }> = {
    Videos: { title: 'No videos found', subtitle: 'This channel may not have any public videos.' },
    Shorts: { title: 'No shorts found', subtitle: 'This channel may not have any shorts yet.' },
    Playlists: { title: 'No playlists found', subtitle: 'This channel may not have any public playlists.' },
  };
  const msg = messages[tab] || messages.Videos;
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
        <SearchX className="h-8 w-8 text-muted-foreground/50" />
      </div>
      <p className="text-muted-foreground">{msg.title}</p>
      <p className="text-xs text-muted-foreground">
        {msg.subtitle}
      </p>
    </div>
  );
}

/* ===== Main Channel Page Component ===== */
export default function ChannelPage() {
  const { currentChannelId, setCurrentChannelId, setCurrentView, setCurrentVideoId, setCurrentPlaylist } = useAppStore();
  const [activeTab, setActiveTab] = useState('Videos');
  const [continuationToken, setContinuationToken] = useState<string | undefined>(undefined);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Fetch initial channel data
  const { data, isLoading, isError, error, refetch } = useQuery<ChannelDataResponse, Error>({
    queryKey: ['channel', currentChannelId],
    queryFn: async () => {
      if (!currentChannelId) throw new Error('No channel ID');
      const res = await fetch(`/api/piped/channel/${currentChannelId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      const jsonData = await res.json();
      console.log('[ChannelPage] Channel data received:', jsonData?.channel?.channelName, 'Videos:', jsonData?.videos?.length, 'Shorts:', jsonData?.shorts?.length, 'Playlists:', jsonData?.playlists?.length, 'Has continuation:', !!jsonData?.continuationToken);
      // Store continuation token for load more
      if (jsonData?.continuationToken) {
        setContinuationToken(jsonData.continuationToken);
      }
      return jsonData;
    },
    enabled: !!currentChannelId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  // Infinite query for loading more channel videos
  const channelVideosQuery = useInfiniteQuery<{
    videos: any[];
    nextContinuationToken?: string;
  }, Error>({
    queryKey: ['channelVideos', currentChannelId],
    queryFn: async ({ pageParam }) => {
      if (!currentChannelId || !pageParam) throw new Error('Missing params');
      const res = await fetch(`/api/piped/channel/${currentChannelId}/next`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ continuationToken: pageParam }),
      });
      if (!res.ok) {
        throw new Error('Failed to load more videos');
      }
      return res.json();
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextContinuationToken,
    enabled: !!continuationToken && !!currentChannelId,
  });

  // Compute active continuation token (initial + from infinite query)
  const pages = channelVideosQuery.data?.pages;
  const latestContinuationToken = pages && pages.length > 0
    ? pages[pages.length - 1]?.nextContinuationToken
    : undefined;
  const activeContinuation = latestContinuationToken || continuationToken;

  // Intersection observer for auto-loading more videos
  useEffect(() => {
    if (!continuationToken || !currentChannelId || activeTab !== 'Videos') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !channelVideosQuery.isFetchingNextPage && continuationToken) {
          channelVideosQuery.fetchNextPage();
        }
      },
      { rootMargin: '600px' }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [continuationToken, currentChannelId, activeTab, channelVideosQuery.isFetchingNextPage, channelVideosQuery.fetchNextPage]);

  const handleBack = () => {
    setCurrentChannelId(null);
    setContinuationToken(undefined);
    setCurrentView('home');
  };

  const handleVideoClick = (videoId: string) => {
    setCurrentVideoId(videoId);
    setCurrentView('watch');
  };

  const [loadingPlaylist, setLoadingPlaylist] = useState<string | null>(null);

  const handlePlaylistClick = async (playlistId: string) => {
    try {
      const playlist = data?.playlists?.find((p: YouTubePlaylist) => p.playlistId === playlistId);
      setLoadingPlaylist(playlistId);
      const res = await fetch(`/api/piped/playlist/${playlistId}`);
      if (!res.ok) {
        toast.error('Failed to load playlist');
        return;
      }
      const playlistData = await res.json();
      const videos: QueueItem[] = (playlistData.videos || []).map((v: any) => {
        const vid = v.videoId || (v.url ? (v.url.match(/[?&]v=([^&]+)/)?.[1] || v.url.replace(/^\/watch\?v=/, '')) : '');
        return {
          videoId: vid,
          title: v.title || 'Untitled',
          thumbnail: vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '',
          channelId: v.uploaderUrl?.replace('/channel/', '')?.replace('/@', '') || v.channelId || '',
          channelName: v.uploaderName || playlist?.channelName || '',
          duration: v.duration || 0,
        };
      }).filter((v: QueueItem) => v.videoId && v.videoId.length > 5);

      if (videos.length > 0) {
        setCurrentPlaylist({
          id: playlistId,
          name: playlistData.name || playlist?.title || 'Playlist',
          thumbnail: `https://i.ytimg.com/vi/${videos[0].videoId}/hqdefault.jpg`,
          channelName: playlistData.uploaderName || playlist?.channelName || '',
          videos,
          currentIndex: 0,
        });
        setCurrentVideoId(videos[0].videoId);
        setCurrentView('watch');
      } else {
        toast.error('This playlist has no playable videos');
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
      toast.error('Failed to load playlist');
    } finally {
      setLoadingPlaylist(null);
    }
  };

  // Combine initial + infinite query videos
  const initialVideos = (data?.videos || []).map(toVideoItem);
  const moreVideos = channelVideosQuery.data?.pages?.flatMap(page => (page.videos || []).map(toVideoItem)) || [];
  const allVideos = [...initialVideos, ...moreVideos];
  const hasMore = !!activeContinuation;
  const isLoadingMore = channelVideosQuery.isFetchingNextPage;

  // Shorts and playlists data
  const shorts = data?.shorts || [];
  const playlists = data?.playlists || [];

  if (!currentChannelId) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground">Select a channel to view</p>
      </div>
    );
  }

  if (isLoading) {
    return <ChannelPageSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-lg font-medium">Failed to load channel</p>
        <p className="text-sm text-muted-foreground max-w-md text-center">{error?.message}</p>
        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={handleBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </Button>
          <Button variant="default" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const channelData = data!;

  return (
    <div className="flex flex-col">
      {/* Back button */}
      <div className="px-4 sm:px-6 pt-2 pb-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Banner */}
      <div className="w-full h-32 sm:h-48 md:h-56 rounded-b-xl overflow-hidden">
        {channelData.channel.banner ? (
          <img
            src={channelData.channel.banner}
            alt="Channel banner"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-red-600/20 via-orange-500/10 to-red-600/20" />
        )}
      </div>

      {/* Channel info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 sm:px-6 py-4">
        <Avatar className="h-24 w-24 sm:h-28 sm:w-28 border-4 border-background -mt-12 sm:-mt-14 shadow-lg">
          {channelData.channel.avatar ? (
            <AvatarImage src={channelData.channel.avatar} alt={channelData.channel.channelName} className="object-cover" />
          ) : null}
          <AvatarFallback className="text-2xl">
            {channelData.channel.channelName?.[0]?.toUpperCase() || 'C'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold">
              {channelData.channel.channelName || 'Channel'}
            </h1>
            {channelData.channel.channelName && (
              <BadgeCheck className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          {channelData.channel.subscriberCount && (
            <div className="text-sm text-muted-foreground mt-1">
              {channelData.channel.subscriberCount} subscribers
            </div>
          )}
          {channelData.channel.description && (
            <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
              {channelData.channel.description}
            </p>
          )}
        </div>

        <Button
          variant="default"
          className="rounded-full bg-white text-black hover:bg-gray-200 font-medium dark:bg-white dark:text-black dark:hover:bg-gray-200 shrink-0"
          size="lg"
        >
          Subscribe
        </Button>
      </div>

      {/* Tab bar */}
      <Separator />
      <div className="flex gap-0 px-4 sm:px-6 border-b">
        {tabItems.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.key
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.key}
              {activeTab === tab.key && (
                <motion.div
                  layoutId="channel-tab"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-foreground rounded-t-full"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="px-4 sm:px-6 py-4">
        {activeTab === 'Videos' && (
          <>
            {/* Videos count */}
            {allVideos.length > 0 && (
              <div className="pb-3">
                <p className="text-sm text-muted-foreground">
                  Showing {allVideos.length} videos
                  {hasMore && ' · Scroll down to load more'}
                </p>
              </div>
            )}

            {allVideos.length === 0 ? (
              <TabEmptyState tab="Videos" />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                  {allVideos.map((video: VideoItem, index: number) => (
                    <motion.div
                      key={video.videoId || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.5) }}
                    >
                      <VideoCard video={video} />
                    </motion.div>
                  ))}
                </div>

                {/* Load more trigger for intersection observer */}
                {hasMore && (
                  <div ref={loadMoreRef} className="flex justify-center py-8">
                    {isLoadingMore && (
                      <div className="flex items-center gap-3 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">Loading more videos...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Load more button (fallback) */}
                {hasMore && !isLoadingMore && (
                  <div className="flex justify-center py-6">
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => channelVideosQuery.fetchNextPage()}
                        className="gap-2 px-8"
                      >
                        <ChevronDown className="h-4 w-4" />
                        Load more videos
                      </Button>
                    </motion.div>
                  </div>
                )}

                {/* End of videos */}
                {!hasMore && allVideos.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center py-8 text-sm text-muted-foreground"
                  >
                    You&apos;ve seen all available videos from this channel
                  </motion.div>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'Shorts' && (
          <>
            {/* Shorts count */}
            {shorts.length > 0 && (
              <div className="pb-3">
                <p className="text-sm text-muted-foreground">
                  Showing {shorts.length} shorts
                </p>
              </div>
            )}

            {shorts.length === 0 ? (
              <TabEmptyState tab="Shorts" />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {shorts.map((short: any, index: number) => (
                  <motion.div
                    key={short.videoId || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.5) }}
                  >
                    <ShortsCard video={short} onClick={handleVideoClick} />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'Playlists' && (
          <>
            {/* Playlists count */}
            {playlists.length > 0 && (
              <div className="pb-3">
                <p className="text-sm text-muted-foreground">
                  Showing {playlists.length} playlists
                </p>
              </div>
            )}

            {playlists.length === 0 ? (
              <TabEmptyState tab="Playlists" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-x-4 gap-y-8">
                {playlists.map((playlist: YouTubePlaylist, index: number) => (
                  <motion.div
                    key={playlist.playlistId || index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.5) }}
                  >
                    <PlaylistCard playlist={playlist} onClick={handlePlaylistClick} />
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ChannelPageSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="px-6 py-1">
        <Skeleton className="h-8 w-20 rounded" />
      </div>
      <Skeleton className="w-full h-48" />
      <div className="flex items-start gap-4 px-6 py-4">
        <Skeleton className="h-28 w-28 rounded-full -mt-14 border-4 border-background" />
        <div className="flex-1 space-y-2 mt-6">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-28 rounded-full mt-6" />
      </div>
      <Separator />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8 px-6 py-6">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="w-full aspect-video rounded-xl" />
            <div className="flex gap-3">
              <Skeleton className="h-9 w-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
