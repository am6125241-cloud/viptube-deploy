'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  TrendingUp,
  Flame,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/store/app-store';
import VideoCard from './VideoCard';
import { toVideoItem, type YouTubeVideoData } from '@/lib/video-utils';

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

export default function TrendingPage() {
  const [showScrollTop, setShowScrollTop] = useState(false);

  const { data: trendingVideos, isLoading, isError, error, refetch, isFetching } = useQuery<YouTubeVideoData[], Error>({
    queryKey: ['trending', 'IN'],
    queryFn: async () => {
      const res = await fetch('/api/piped/trending?region=IN');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const videos = (trendingVideos || []).map(toVideoItem);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 800);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-red-500/10">
            <TrendingUp className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              Trending
              <Flame className="h-5 w-5 text-orange-500" />
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              What&apos;s popular in India right now
            </p>
          </div>
        </motion.div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 pb-6 flex-1">
        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
            {Array.from({ length: 16 }).map((_, i) => (
              <VideoCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold">Something went wrong</p>
              <p className="text-sm text-muted-foreground mt-1">{error?.message || 'Failed to load trending videos'}</p>
            </div>
            <Button variant="outline" onClick={() => refetch()} className="gap-2 mt-2">
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Try again
            </Button>
          </motion.div>
        )}

        {/* Video Grid */}
        {!isLoading && !isError && videos.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8"
          >
            {videos.map((video, index) => (
              <motion.div
                key={video.videoId || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.5) }}
              >
                <VideoCard video={video} />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Empty */}
        {!isLoading && !isError && videos.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-4"
          >
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground">No trending videos available</p>
          </motion.div>
        )}
      </div>

      {/* Scroll to top */}
      {showScrollTop && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={scrollToTop}
          className="fixed bottom-24 right-6 z-50 h-11 w-11 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
          aria-label="Scroll to top"
        >
          <ChevronUp className="h-5 w-5" />
        </motion.button>
      )}
    </div>
  );
}
