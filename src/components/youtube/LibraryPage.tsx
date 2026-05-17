'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2,
  AlertCircle,
  RefreshCw,
  History,
  Clock,
  ThumbsUp,
  Users,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore, type VideoItem } from '@/store/app-store';
import { formatDuration } from '@/lib/video-utils';

interface LibraryPageProps {
  type: 'history' | 'watchlater' | 'liked' | 'subscriptions';
}

interface HistoryItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  duration: number;
  watchedAt: string;
}

interface WatchLaterItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  duration: number;
  addedAt: string;
}

interface LikedItem {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  duration: number;
  likedAt: string;
}

interface SubscriptionItem {
  id: string;
  channelId: string;
  channelName: string;
  channelAvatar: string | null;
  subscriberCount: number | null;
  subscribedAt: string;
}

const pageConfig: Record<string, {
  title: string;
  description: string;
  icon: React.ReactNode;
  fetchUrl: string;
  deleteUrl: string;
  deleteParam: string;
  dateField: string;
  emptyMessage: string;
}> = {
  history: {
    title: 'Watch History',
    description: 'Videos you have watched',
    icon: <History className="h-8 w-8" />,
    fetchUrl: '/api/history',
    deleteUrl: '/api/history',
    deleteParam: 'videoId',
    dateField: 'watchedAt',
    emptyMessage: 'Your watch history is empty. Start watching videos to see them here.',
  },
  watchlater: {
    title: 'Watch Later',
    description: 'Videos you saved to watch later',
    icon: <Clock className="h-8 w-8" />,
    fetchUrl: '/api/watch-later',
    deleteUrl: '/api/watch-later',
    deleteParam: 'videoId',
    dateField: 'addedAt',
    emptyMessage: 'Your Watch Later list is empty. Save videos to watch them later.',
  },
  liked: {
    title: 'Liked Videos',
    description: 'Videos you have liked',
    icon: <ThumbsUp className="h-8 w-8" />,
    fetchUrl: '/api/liked',
    deleteUrl: '/api/liked',
    deleteParam: 'videoId',
    dateField: 'likedAt',
    emptyMessage: "You haven't liked any videos yet.",
  },
  subscriptions: {
    title: 'Subscriptions',
    description: 'Channels you subscribe to',
    icon: <Users className="h-8 w-8" />,
    fetchUrl: '/api/subscription',
    deleteUrl: '/api/subscription',
    deleteParam: 'channelId',
    dateField: 'subscribedAt',
    emptyMessage: "You haven't subscribed to any channels yet.",
  },
};

export default function LibraryPage({ type }: LibraryPageProps) {
  const config = pageConfig[type];
  const { setCurrentView, setCurrentVideoId, setCurrentChannelId } = useAppStore();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [type],
    queryFn: async () => {
      const res = await fetch(config.fetchUrl);
      if (!res.ok) throw new Error('Failed to fetch data');
      return res.json();
    },
    staleTime: 30 * 1000,
    retry: 2,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`${config.deleteUrl}?${config.deleteParam}=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [type] });
    },
  });

  const handleWatchVideo = useCallback(
    (videoId: string) => {
      setCurrentVideoId(videoId);
      setCurrentView('watch');
    },
    [setCurrentVideoId, setCurrentView]
  );

  const handleChannelClick = useCallback(
    (channelId: string) => {
      setCurrentChannelId(channelId);
      setCurrentView('channel');
    },
    [setCurrentChannelId, setCurrentView]
  );

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{config.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">{config.description}</p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3 rounded-xl">
              <Skeleton className="w-40 sm:w-64 aspect-video rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <AlertCircle className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">Failed to load data</p>
          <p className="text-sm text-muted-foreground">{error?.message}</p>
          <Button variant="outline" onClick={() => refetch()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && data?.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 gap-4"
        >
          <div className="text-muted-foreground/50">{config.icon}</div>
          <p className="text-muted-foreground text-center max-w-md">{config.emptyMessage}</p>
          <Button
            variant="outline"
            onClick={() => setCurrentView('home')}
            className="mt-2"
          >
            Browse videos
          </Button>
        </motion.div>
      )}

      {/* Content */}
      {!isLoading && !isError && data?.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-1"
        >
          {type === 'subscriptions' ? (
            // Subscriptions view - channel cards
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {(data as SubscriptionItem[]).map((sub: SubscriptionItem) => (
                <motion.div
                  key={sub.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center gap-3 p-4 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleChannelClick(sub.channelId)}
                >
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full overflow-hidden bg-muted">
                      {sub.channelAvatar ? (
                        <img
                          src={sub.channelAvatar}
                          alt={sub.channelName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-muted-foreground">
                          {(sub.channelName || 'C')[0].toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium line-clamp-1">{sub.channelName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sub.subscriberCount
                        ? `${sub.subscriberCount.toLocaleString()} subscribers`
                        : 'Channel'}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 rounded-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteMutation.mutate(sub.channelId);
                    }}
                  >
                    Subscribed
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : (
            // Video list view
            <AnimatePresence>
              {(data as Array<HistoryItem | WatchLaterItem | LikedItem>).map(
                (item: HistoryItem | WatchLaterItem | LikedItem) => {
                  const dateField = config.dateField as 'watchedAt' | 'addedAt' | 'likedAt';
                  const dateValue = item[dateField];
                  
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10, height: 0, overflow: 'hidden' }}
                      className="flex gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
                    >
                      {/* Thumbnail */}
                      <div
                        className="relative w-40 sm:w-64 aspect-video rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer"
                        onClick={() => handleWatchVideo(item.videoId)}
                      >
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                        {item.duration > 0 && (
                          <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-xs font-medium px-1.5 py-0.5 rounded">
                            {formatDuration(item.duration)}
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-10 h-10 rounded-full bg-black/70 flex items-center justify-center">
                            <PlayCircle className="h-6 w-6 text-white fill-white" />
                          </div>
                        </div>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
                        <div>
                          <h3
                            className="text-sm font-medium line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleWatchVideo(item.videoId)}
                          >
                            {item.title}
                          </h3>
                          <p
                            className="text-xs text-muted-foreground mt-1 cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => handleChannelClick(item.channelId)}
                          >
                            {item.channelName}
                          </p>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          {dateValue && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(dateValue).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </p>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => deleteMutation.mutate(item.videoId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
              )}
            </AnimatePresence>
          )}
        </motion.div>
      )}
    </div>
  );
}
