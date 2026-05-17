'use client';

import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  History,
  Clock,
  ThumbsUp,
  Users,
  PlayCircle,
  ChevronRight,
  Library,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { formatDuration } from '@/lib/video-utils';

interface LibraryCard {
  title: string;
  view: 'history' | 'watchlater' | 'liked' | 'subscriptions';
  icon: React.ReactNode;
  description: string;
  queryKey: string;
  fetchUrl: string;
  color: string;
}

const libraryCards: LibraryCard[] = [
  {
    title: 'Watch History',
    view: 'history',
    icon: <History className="h-7 w-7" />,
    description: 'Videos you have watched recently',
    queryKey: 'history',
    fetchUrl: '/api/history',
    color: 'from-blue-500/20 to-blue-600/5 dark:from-blue-500/10 dark:to-blue-600/5',
  },
  {
    title: 'Watch Later',
    view: 'watchlater',
    icon: <Clock className="h-7 w-7" />,
    description: 'Videos you saved for later',
    queryKey: 'watchlater',
    fetchUrl: '/api/watch-later',
    color: 'from-amber-500/20 to-amber-600/5 dark:from-amber-500/10 dark:to-amber-600/5',
  },
  {
    title: 'Liked Videos',
    view: 'liked',
    icon: <ThumbsUp className="h-7 w-7" />,
    description: 'Videos you have liked',
    queryKey: 'liked',
    fetchUrl: '/api/liked',
    color: 'from-pink-500/20 to-pink-600/5 dark:from-pink-500/10 dark:to-pink-600/5',
  },
  {
    title: 'Subscriptions',
    view: 'subscriptions',
    icon: <Users className="h-7 w-7" />,
    description: 'Channels you subscribe to',
    queryKey: 'subscriptions',
    fetchUrl: '/api/subscription',
    color: 'from-green-500/20 to-green-600/5 dark:from-green-500/10 dark:to-green-600/5',
  },
];

function LibraryCardItem({ card }: { card: LibraryCard }) {
  const { setCurrentView } = useAppStore();

  const { data, isLoading } = useQuery({
    queryKey: [card.queryKey],
    queryFn: async () => {
      const res = await fetch(card.fetchUrl);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 30 * 1000,
    retry: 1,
  });

  const count = Array.isArray(data) ? data.length : 0;

  const handleClick = () => {
    setCurrentView(card.view);
  };

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleClick}
      className="relative overflow-hidden rounded-2xl border border-border/50 bg-card hover:shadow-xl hover:shadow-purple-500/5 transition-all duration-300 text-left cursor-pointer group w-full card-neon-glow"
    >
      {/* Gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-60 group-hover:opacity-100 transition-opacity`} />

      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-background/80 backdrop-blur-sm shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
              {card.icon}
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">{card.title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{card.description}</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors mt-2" />
        </div>

        {/* Count badge */}
        <div className="mt-4 flex items-center gap-2">
          <div className="px-3 py-1 rounded-full bg-background/80 backdrop-blur-sm text-sm font-semibold">
            {isLoading ? '...' : count} {count === 1 ? 'item' : 'items'}
          </div>
        </div>

        {/* Preview thumbnails (show up to 3) */}
        {!isLoading && Array.isArray(data) && data.length > 0 && (
          <div className="mt-3 flex gap-2">
            {data.slice(0, 3).map((item: any, i: number) => (
              <div
                key={item.id || i}
                className="relative w-20 h-12 rounded-lg overflow-hidden bg-muted/50 shrink-0"
              >
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : item.channelAvatar ? (
                  <img
                    src={item.channelAvatar}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <PlayCircle className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.button>
  );
}

export default function LibraryPage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)]">
      {/* Header - Creative Aurora Section */}
      <div className="relative overflow-hidden">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute inset-0 animate-aurora opacity-40" />
        </div>
        {/* Floating particles */}
        <div className="absolute top-4 left-[20%] w-2 h-2 rounded-full bg-purple-500/25 animate-float" style={{ animationDelay: '0.3s' }} />
        <div className="absolute top-8 right-[25%] w-1.5 h-1.5 rounded-full bg-blue-500/30 animate-float" style={{ animationDelay: '0.9s' }} />
        <div className="absolute bottom-4 left-[50%] w-2 h-2 rounded-full bg-pink-500/20 animate-float" style={{ animationDelay: '1.5s' }} />
        {/* Decorative icon */}
        <div className="absolute top-2 right-10 opacity-[0.04] dark:opacity-[0.07]">
          <Library className="h-24 w-24 animate-float" />
        </div>

        <div className="relative px-4 sm:px-6 pt-6 pb-5">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            {/* Animated icon box with gradient + glow */}
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25"
            >
              <Library className="h-6 w-6 text-white" />
            </motion.div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                <span className="aurora-text">Library</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-1 font-medium">
                Your saved videos and subscriptions
              </p>
            </div>
          </motion.div>
        </div>
        {/* Creative divider */}
        <div className="absolute bottom-0 left-0 right-0 divider-creative" />
      </div>

      {/* Cards */}
      <div className="px-4 sm:px-6 pb-6 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
          {libraryCards.map((card, index) => (
            <motion.div
              key={card.view}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
            >
              <LibraryCardItem card={card} />
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
