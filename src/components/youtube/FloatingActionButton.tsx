'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass,
  TrendingUp,
  Search,
  Clock,
  ThumbsUp,
  Music,
  Gamepad2,
  Newspaper,
  X,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppStore } from '@/store/app-store';

interface FABAction {
  icon: React.ReactNode;
  label: string;
  color: string;
  action: () => void;
}

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { setCurrentView, setCategoryFilter, setSearchQuery } = useAppStore();

  const toggleOpen = useCallback(() => {
    setIsOpen(prev => !prev);
  }, []);

  const actions: FABAction[] = [
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: 'Trending',
      color: '#f97316',
      action: () => { setCurrentView('home'); setCategoryFilter('All'); },
    },
    {
      icon: <Search className="h-4 w-4" />,
      label: 'Search',
      color: '#22c55e',
      action: () => { setCurrentView('search'); setSearchQuery(''); },
    },
    {
      icon: <Music className="h-4 w-4" />,
      label: 'Music',
      color: '#a855f7',
      action: () => { setCurrentView('home'); setCategoryFilter('Music'); },
    },
    {
      icon: <Gamepad2 className="h-4 w-4" />,
      label: 'Gaming',
      color: '#14b8a6',
      action: () => { setCurrentView('home'); setCategoryFilter('Gaming'); },
    },
    {
      icon: <Newspaper className="h-4 w-4" />,
      label: 'News',
      color: '#eab308',
      action: () => { setCurrentView('home'); setCategoryFilter('News'); },
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Watch Later',
      color: '#3b82f6',
      action: () => setCurrentView('watchlater'),
    },
    {
      icon: <ThumbsUp className="h-4 w-4" />,
      label: 'Liked',
      color: '#ec4899',
      action: () => setCurrentView('liked'),
    },
  ];

  const handleAction = useCallback((action: FABAction['action']) => {
    action();
    setIsOpen(false);
  }, []);

  return (
    <div className="fixed bottom-24 right-6 z-50 flex flex-col items-center gap-3">
      {/* Action Buttons */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="flex flex-col gap-2 items-end mb-2"
          >
            {actions.map((action, index) => (
              <motion.div
                key={action.label}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.15, delay: index * 0.03 }}
              >
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 rounded-full h-10 pl-3 pr-4 shadow-md hover:shadow-lg transition-all border-border/60 bg-background/95 backdrop-blur-sm"
                        onClick={() => handleAction(action.action)}
                      >
                        <div
                          className="h-7 w-7 rounded-full flex items-center justify-center"
                          style={{ background: `${action.color}15`, color: action.color }}
                        >
                          {action.icon}
                        </div>
                        <span className="text-xs font-medium">{action.label}</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="text-xs">
                      Go to {action.label}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main FAB Button */}
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleOpen}
              className="h-14 w-14 rounded-full bg-gradient-to-br from-red-500 to-red-600 text-white shadow-xl shadow-red-500/30 flex items-center justify-center hover:shadow-2xl hover:shadow-red-500/40 transition-all cursor-pointer"
              aria-label="Quick Actions"
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="h-6 w-6" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="open"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Compass className="h-6 w-6" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </TooltipTrigger>
          <TooltipContent side="left">Quick Actions</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
