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
      {/* Header - Creative Aurora Section */}
      <div className="relative overflow-hidden">
        {/* Animated aurora background */}
        <div className="absolute inset-0 opacity-25">
          <div className="absolute inset-0 animate-aurora opacity-50" />
        </div>
        {/* Floating particles */}
        <div className="absolute top-3 left-[15%] w-2 h-2 rounded-full bg-red-500/25 animate-float" style={{ animationDelay: '0.2s' }} />
        <div className="absolute top-8 right-[20%] w-1.5 h-1.5 rounded-full bg-orange-500/30 animate-float" style={{ animationDelay: '0.8s' }} />
        <div className="absolute bottom-3 left-[60%] w-2 h-2 rounded-full bg-yellow-500/20 animate-float" style={{ animationDelay: '1.4s' }} />
        {/* Decorative icons */}
        <div className="absolute top-2 right-8 opacity-[0.04] dark:opacity-[0.07]">
          <Flame className="h-28 w-28 animate-float" />
        </div>
        <div className="absolute bottom-1 left-6 opacity-[0.03] dark:opacity-[0.06]">
          <TrendingUp className="h-20 w-20 animate-spin-slow" />
        </div>

        <div className="relative px-4 sm:px-6 pt-6 pb-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            {/* Animated icon box with glow */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-lg shadow-red-500/25"
            >
              <TrendingUp className="h-6 w-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-2">
                <span className="fire-text">Trending</span>
                <motion.div
                  animate={{ scale: [1, 1.3, 1], rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <Flame className="h-6 w-6 text-orange-500" />
                </motion.div>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                What&apos;s popular in India right now
              </p>
            </div>
          </motion.div>
        </div>
        {/* Creative divider */}
        <div className="absolute bottom-0 left-0 right-0 divider-creative" />
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
