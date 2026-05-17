'use client';

import { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RefreshCw,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  TrendingUp,
  Music,
  Gamepad2,
  Newspaper,
  Radio,
  Trophy,
  GraduationCap,
  Shirt,
  Mic2,
  Clock,
  Eye,
  Sparkles,
  Flame,
  Play,
  Sparkle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAppStore } from '@/store/app-store';
import VideoCard from './VideoCard';
import { toVideoItem, type YouTubeVideoData } from '@/lib/video-utils';

/* ================================================================
   CATEGORY CONFIG WITH ICONS
   ================================================================ */
const categories = [
  { name: 'All', icon: Flame },
  { name: 'Music', icon: Music },
  { name: 'Gaming', icon: Gamepad2 },
  { name: 'News', icon: Newspaper },
  { name: 'Live', icon: Radio },
  { name: 'Sports', icon: Trophy },
  { name: 'Learning', icon: GraduationCap },
  { name: 'Fashion', icon: Shirt },
  { name: 'Podcasts', icon: Mic2 },
  { name: 'Recently Uploaded', icon: Clock },
  { name: 'Watched', icon: Eye },
  { name: 'New to you', icon: Sparkles },
];

/* ================================================================
   NEW BADGE (for trending videos)
   ================================================================ */
function NewBadge() {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold uppercase tracking-wider shadow-sm shadow-red-500/30"
    >
      <Sparkle className="h-2.5 w-2.5" />
      New
    </motion.span>
  );
}

/* ================================================================
   HERO BANNER SECTION
   ================================================================ */
function HeroBanner() {
  const { setCategoryFilter, setCurrentView } = useAppStore();

  const quickActions = [
    { label: 'Trending', icon: TrendingUp, onClick: () => setCategoryFilter('All') },
    { label: 'Music', icon: Music, onClick: () => setCategoryFilter('Music') },
    { label: 'Gaming', icon: Gamepad2, onClick: () => setCategoryFilter('Gaming') },
    { label: 'News', icon: Newspaper, onClick: () => setCategoryFilter('News') },
  ];

  return (
    <div className="hero-gradient relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-4 left-8 opacity-[0.04] dark:opacity-[0.06]">
        <Play className="h-32 w-32 animate-spin-slow" />
      </div>
      <div className="absolute bottom-2 right-12 opacity-[0.03] dark:opacity-[0.05]">
        <TrendingUp className="h-24 w-24 animate-float" />
      </div>
      <div className="absolute top-1/2 right-1/4 opacity-[0.02] dark:opacity-[0.04]">
        <Sparkles className="h-20 w-20 animate-float" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative px-4 sm:px-6 py-8 sm:py-10">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame className="h-5 w-5 text-red-500" />
            </motion.div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Discover
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">
            Welcome to{' '}
            <span className="fire-text">V.I.P Tube</span>
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-xl mb-6 leading-relaxed font-medium">
            Watch trending videos, explore categories, and enjoy ad-free streaming.
            Your personalized video experience starts here.
          </p>

          {/* Quick action pills */}
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, i) => (
              <motion.button
                key={action.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.2 + i * 0.1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={action.onClick}
                className="glass flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all hover:shadow-md cursor-pointer"
              >
                <action.icon className="h-4 w-4" />
                {action.label}
              </motion.button>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Gradient border at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
      <div className="absolute bottom-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
    </div>
  );
}

/* ================================================================
   SKELETON
   ================================================================ */
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

/* ================================================================
   MAIN HOME FEED
   ================================================================ */
export default function HomeFeed() {
  const { categoryFilter, setCategoryFilter } = useAppStore();
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const isAllCategory = categoryFilter === 'All';

  // Trending / All category — fresh random videos every time app opens
  const trendingQuery = useQuery<YouTubeVideoData[], Error>({
    queryKey: ['trending', 'IN', Date.now().toString().slice(0, -5)],
    queryFn: async () => {
      const res = await fetch('/api/piped/trending?region=IN');
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      const json = await res.json();
      return Array.isArray(json) ? json : [];
    },
    enabled: isAllCategory,
    staleTime: 0,
    gcTime: 0,
    retry: 2,
  });

  // Category-based infinite query
  const categoryQuery = useInfiniteQuery<{
    videos: YouTubeVideoData[];
    hasMore: boolean;
  }, Error>({
    queryKey: ['category', categoryFilter],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await fetch(
        `/api/piped/search?category=${encodeURIComponent(categoryFilter)}&page=${pageParam}`
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errData.error || `Failed with status ${res.status}`);
      }
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (lastPage.hasMore && Array.isArray(lastPage.videos) && lastPage.videos.length > 0) {
        return lastPageParam + 1;
      }
      return undefined;
    },
    enabled: !isAllCategory,
    staleTime: 0,
    gcTime: 0,
    retry: 2,
  });

  // Flatten videos
  const categoryVideos = categoryQuery.data
    ? categoryQuery.data.pages.flatMap(page => page.videos || [])
    : [];

  const rawVideos = isAllCategory
    ? (trendingQuery.data || [])
    : categoryVideos;

  // Shuffle videos randomly on every render so user sees different order each time
  const videos = useMemo(() => {
    const mapped = rawVideos.map(toVideoItem);
    for (let i = mapped.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [mapped[i], mapped[j]] = [mapped[j], mapped[i]];
    }
    return mapped;
  }, [rawVideos]);

  // Split trending videos into featured + grid
  const { featuredVideos, gridVideos } = useMemo(() => {
    if (!isAllCategory) return { featuredVideos: [], gridVideos: videos };
    const feat = videos.slice(0, 4);
    const grid = videos.slice(4);
    return { featuredVideos: feat, gridVideos: grid };
  }, [isAllCategory, videos]);

  const isLoading = isAllCategory ? trendingQuery.isLoading : categoryQuery.isLoading;
  const isError = isAllCategory ? trendingQuery.isError : categoryQuery.isError;
  const error = isAllCategory ? trendingQuery.error : categoryQuery.error;
  const isFetching = isAllCategory ? trendingQuery.isFetching : categoryQuery.isFetching;
  const isFetchingNextPage = categoryQuery.isFetchingNextPage;
  const hasNextPage = categoryQuery.hasNextPage;
  const refetch = isAllCategory ? trendingQuery.refetch : categoryQuery.refetch;
  const fetchNextPage = categoryQuery.fetchNextPage;

  const handleCategoryClick = useCallback(
    (cat: string) => {
      setCategoryFilter(cat);
    },
    [setCategoryFilter]
  );

  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Infinite scroll
  useEffect(() => {
    if (isAllCategory || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '400px' }
    );
    const el = loadMoreRef.current;
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, [isAllCategory, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll to top button
  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 800);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Hero Banner - only on All category */}
      {isAllCategory && <HeroBanner />}

      {/* Category chips */}
      <div className="sticky top-14 z-20 bg-background/90 backdrop-blur-xl border-b border-border/40">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 px-4 py-3">
            {categories.map((cat, i) => {
              const CatIcon = cat.icon;
              const isActive = categoryFilter === cat.name;
              return (
                <motion.button
                  key={cat.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.03 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-foreground text-background shadow-md animate-chip-bounce'
                      : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground hover:shadow-sm'
                  }`}
                >
                  <CatIcon className="h-3.5 w-3.5" />
                  {cat.name}
                </motion.button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
      </div>

      {/* Category label for non-All */}
      {!isAllCategory && !isLoading && !isError && videos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="px-4 sm:px-6 pt-5 pb-1"
        >
          <div className="flex items-center gap-2">
            {(() => {
              const cat = categories.find(c => c.name === categoryFilter);
              const CatIcon = cat?.icon || Flame;
              return <CatIcon className="h-5 w-5 text-red-500" />;
            })()}
            <h2 className="text-xl font-extrabold tracking-tight">{categoryFilter}</h2>
            <span className="text-sm text-muted-foreground font-normal">
              {videos.length} videos
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Explore the best {categoryFilter.toLowerCase()} content curated for you
          </p>
        </motion.div>
      )}

      {/* Content */}
      <div className="px-4 sm:px-6 py-4 flex-1">
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
              <p className="text-sm text-muted-foreground mt-1">
                {error?.message || 'Failed to load videos'}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="gap-2 mt-2"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Try again
            </Button>
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
              <Sparkles className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-muted-foreground">No videos found</p>
            {categoryFilter !== 'All' && (
              <Button
                variant="outline"
                onClick={() => setCategoryFilter('All')}
                className="gap-2 mt-2"
              >
                Browse all videos
              </Button>
            )}
          </motion.div>
        )}

        {/* ===== ALL CATEGORY: Featured + Grid layout ===== */}
        {!isLoading && !isError && isAllCategory && videos.length > 0 && (
          <>
            {/* Featured Videos - horizontal scroll */}
            {featuredVideos.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="h-5 w-5 text-red-500" />
                  <h2 className="text-lg font-extrabold tracking-tight">Trending Now</h2>
                  <NewBadge />
                  <div className="flex-1 h-px bg-gradient-to-r from-red-500/20 to-transparent ml-2" />
                </div>
                <ScrollArea className="w-full">
                  <div className="flex gap-4 pb-4">
                    {featuredVideos.map((video, index) => (
                      <motion.div
                        key={video.videoId || index}
                        initial={{ opacity: 0, x: 30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: index * 0.08 }}
                        className="shrink-0 w-[280px] sm:w-[320px] relative"
                      >
                        {index < 3 && (
                          <div className="absolute -top-2 -left-2 z-10">
                            <NewBadge />
                          </div>
                        )}
                        <VideoCard video={video} />
                      </motion.div>
                    ))}
                  </div>
                  <ScrollBar orientation="horizontal" className="h-1.5" />
                </ScrollArea>
              </div>
            )}

            {/* Main video grid */}
            {gridVideos.length > 0 && (
              <>
                <div className="flex items-center gap-2 mb-5">
                  <Sparkles className="h-5 w-5 text-orange-500" />
                  <h2 className="text-lg font-extrabold tracking-tight">Recommended For You</h2>
                  <div className="flex-1 h-px bg-gradient-to-r from-orange-500/20 to-transparent ml-2" />
                </div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8"
                >
                  {gridVideos.map((video, index) => (
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
              </>
            )}
          </>
        )}

        {/* ===== CATEGORY-SPECIFIC: Simple grid ===== */}
        {!isLoading && !isError && !isAllCategory && videos.length > 0 && (
          <>
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
                  transition={{ duration: 0.3, delay: Math.min(index * 0.02, 0.4) }}
                >
                  <VideoCard video={video} />
                </motion.div>
              ))}
            </motion.div>

            {/* Load more trigger */}
            {!isAllCategory && hasNextPage && (
              <div ref={loadMoreRef} className="flex justify-center py-8">
                {isFetchingNextPage && (
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Loading more videos...</span>
                  </div>
                )}
              </div>
            )}

            {/* Load More button */}
            {!isAllCategory && hasNextPage && !isFetchingNextPage && (
              <div className="flex justify-center py-6">
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLoadMore}
                    className="gap-2 px-8"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Load more videos
                  </Button>
                </motion.div>
              </div>
            )}

            {/* End */}
            {!isAllCategory && !hasNextPage && videos.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-8 text-sm text-muted-foreground"
              >
                You&apos;ve seen all available videos in this category
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Scroll to top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={scrollToTop}
            className="fixed bottom-24 right-6 z-50 h-11 w-11 rounded-full bg-foreground text-background shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity cursor-pointer"
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-5 w-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
