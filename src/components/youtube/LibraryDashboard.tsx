'use client';

import { useCallback, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  ThumbsUp,
  PlayCircle,
  Trash2,
  RefreshCw,
  AlertCircle,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useAppStore } from '@/store/app-store';
import { formatDuration } from '@/lib/video-utils';

interface VideoItemData {
  id: string;
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  duration: number;
  addedAt?: string;
  likedAt?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.04, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 350, damping: 25 },
  },
};

function VideoRow({ item, onDelete }: { item: VideoItemData; onDelete: (id: string, title: string) => void }) {
  const { setCurrentVideoId, setCurrentView } = useAppStore();
  const dateField = (item as any).addedAt ? 'addedAt' : 'likedAt';
  const dateValue = (item as any)[dateField];

  return (
    <motion.div
      variants={itemVariants}
      layout
      className="flex gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors group"
    >
      <div
        className="relative w-40 sm:w-56 aspect-video rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer"
        onClick={() => { setCurrentVideoId(item.videoId); setCurrentView('watch'); }}
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
          <div className="w-10 h-10 rounded-full bg-black/70 flex items-center justify-center backdrop-blur-sm">
            <PlayCircle className="h-6 w-6 text-white fill-white" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-0 py-0.5 flex flex-col justify-between">
        <div>
          <h3
            className="text-sm font-medium line-clamp-2 cursor-pointer hover:text-foreground transition-colors"
            onClick={() => { setCurrentVideoId(item.videoId); setCurrentView('watch'); }}
          >
            {item.title}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">{item.channelName}</p>
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
            onClick={() => onDelete(item.videoId, item.title)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export default function LibraryDashboard() {
  const { setCurrentView, setCurrentVideoId } = useAppStore();
  const [activeTab, setActiveTab] = useState<'watchlater' | 'liked'>('watchlater');

  const { data: watchLaterData, isLoading: wlLoading, isError: wlError, refetch: wlRefetch } = useQuery({
    queryKey: ['library-dashboard-watchlater'],
    queryFn: () => fetch('/api/watch-later').then(r => r.json()),
    staleTime: 30_000,
  });

  const { data: likedData, isLoading: likedLoading, isError: likedError, refetch: likedRefetch } = useQuery({
    queryKey: ['library-dashboard-liked'],
    queryFn: () => fetch('/api/liked').then(r => r.json()),
    staleTime: 30_000,
  });

  const handleDelete = useCallback((videoId: string, title: string, type: 'watchlater' | 'liked') => {
    const url = type === 'watchlater' ? '/api/watch-later' : '/api/liked';
    fetch(`${url}?videoId=${encodeURIComponent(videoId)}`, { method: 'DELETE' })
      .then(() => {
        toast.success('Removed', { description: `"${title}" has been removed.` });
        wlRefetch();
        likedRefetch();
      })
      .catch(() => toast.error('Failed to remove'));
  }, [wlRefetch, likedRefetch]);

  const wlCount = Array.isArray(watchLaterData) ? watchLaterData.length : 0;
  const likedCount = Array.isArray(likedData) ? likedData.length : 0;
  const totalCount = wlCount + likedCount;
  const currentData = activeTab === 'watchlater' ? watchLaterData : likedData;
  const isLoading = activeTab === 'watchlater' ? wlLoading : likedLoading;
  const isError = activeTab === 'watchlater' ? wlError : likedError;

  return (
    <div className="px-4 sm:px-6 py-6 max-w-5xl">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-950/50 flex items-center justify-center text-purple-600 shrink-0 premium-shadow">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">Library</h1>
              {totalCount > 0 && (
                <Badge variant="secondary" className="font-semibold tabular-nums">{totalCount}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">Your saved videos and collections</p>
          </div>
        </div>
      </motion.div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setActiveTab('watchlater')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeTab === 'watchlater'
              ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 shadow-sm'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <Clock className="h-4 w-4" />
          Watch Later
          {wlCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              {wlCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('liked')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
            activeTab === 'liked'
              ? 'bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-400 shadow-sm'
              : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
          }`}
        >
          <ThumbsUp className="h-4 w-4" />
          Liked Videos
          {likedCount > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-500/10 text-pink-600 dark:bg-pink-500/15 dark:text-pink-400">
              {likedCount}
            </span>
          )}
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-4 p-3 rounded-xl">
              <Skeleton className="w-40 sm:w-56 aspect-video rounded-lg shrink-0" />
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
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-lg font-medium">Failed to load</p>
          <Button
            variant="outline"
            onClick={() => activeTab === 'watchlater' ? wlRefetch() : likedRefetch()}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !isError && Array.isArray(currentData) && currentData.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center justify-center py-16 gap-5"
        >
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            activeTab === 'watchlater'
              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-600'
              : 'bg-pink-100 dark:bg-pink-950/50 text-pink-600'
          }`}>
            {activeTab === 'watchlater' ? <Clock className="h-7 w-7" /> : <ThumbsUp className="h-7 w-7" />}
          </div>
          <div className="text-center max-w-sm">
            <h2 className="text-lg font-semibold mb-1.5">
              {activeTab === 'watchlater' ? 'No videos saved yet' : 'No liked videos yet'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {activeTab === 'watchlater'
                ? 'Save videos to watch them later anytime.'
                : 'Like videos to save them here for quick access.'}
            </p>
          </div>
          <Button
            onClick={() => setCurrentView('home')}
            className="mt-1 gap-2 bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400"
          >
            <Search className="h-4 w-4" /> Browse videos
          </Button>
        </motion.div>
      )}

      {/* Content */}
      {!isLoading && !isError && Array.isArray(currentData) && currentData.length > 0 && (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="space-y-1"
        >
          {(currentData as VideoItemData[]).map((item) => (
            <VideoRow
              key={item.id}
              item={item}
              onDelete={(id, title) => handleDelete(id, title, activeTab)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}
