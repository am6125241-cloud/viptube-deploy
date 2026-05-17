'use client';

import { motion } from 'framer-motion';
import {
  TrendingUp,
  Flame,
  Music,
  Gamepad2,
  Newspaper,
  Sparkles,
  Trophy,
  Mic2,
  ArrowRight,
} from 'lucide-react';
import { useAppStore } from '@/store/app-store';

const TRENDING_TOPICS = [
  { icon: <Flame className="h-4 w-4" />, label: 'Trending Now', query: 'trending videos 2025', color: '#ef4444' },
  { icon: <Music className="h-4 w-4" />, label: 'Top Music', query: 'trending music hits 2025', color: '#f97316' },
  { icon: <Gamepad2 className="h-4 w-4" />, label: 'Gaming', query: 'gaming highlights popular', color: '#22c55e' },
  { icon: <Newspaper className="h-4 w-4" />, label: 'News', query: 'latest news today', color: '#eab308' },
  { icon: <Trophy className="h-4 w-4" />, label: 'Sports', query: 'sports highlights cricket football', color: '#14b8a6' },
  { icon: <Mic2 className="h-4 w-4" />, label: 'Podcasts', query: 'popular podcasts episodes', color: '#a855f7' },
  { icon: <Sparkles className="h-4 w-4" />, label: 'Viral', query: 'viral videos this week', color: '#ec4899' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'Bollywood', query: 'bollywood trending songs movies', color: '#ef4444' },
];

interface TrendingTopicsProps {
  onSelectTopic: (query: string) => void;
}

export default function TrendingTopics({ onSelectTopic }: TrendingTopicsProps) {
  const { setCategoryFilter } = useAppStore();

  const handleTopicClick = (query: string) => {
    onSelectTopic(query);
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-5">
        <TrendingUp className="h-5 w-5 text-red-500" />
        <h2 className="text-lg font-bold">Trending Topics</h2>
        <div className="flex-1 h-px bg-gradient-to-r from-red-500/20 to-transparent ml-2" />
      </div>

      {/* Topics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {TRENDING_TOPICS.map((topic, index) => (
          <motion.button
            key={topic.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: index * 0.04 }}
            whileHover={{ y: -2, scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleTopicClick(topic.query)}
            className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border/50 hover:border-foreground/20 bg-card/50 hover:bg-card transition-all cursor-pointer group text-left"
          >
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-110"
              style={{ background: `${topic.color}12`, color: topic.color }}
            >
              {topic.icon}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium group-hover:text-foreground transition-colors">
                {topic.label}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-1 transition-all shrink-0" />
          </motion.button>
        ))}
      </div>

      {/* Bottom hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-xs text-muted-foreground/50 mt-6"
      >
        Explore trending content — updated in real-time
      </motion.p>
    </div>
  );
}
