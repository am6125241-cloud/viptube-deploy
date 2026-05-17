'use client';

import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  RefreshCw,
  AlertCircle,
  Loader2,
  WifiOff,
  Flame,
  Music,
  Gamepad2,
  Newspaper,
  Trophy,
  GraduationCap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const MAX_RETRIES = 5;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000];

const altCategoryConfig = [
  { name: 'Music', icon: Music },
  { name: 'Gaming', icon: Gamepad2 },
  { name: 'News', icon: Newspaper },
  { name: 'Sports', icon: Trophy },
  { name: 'Learning', icon: GraduationCap },
];

export default function EnhancedErrorState({
  error,
  onRetry,
  isFetching,
  categoryFilter,
  onCategorySwitch,
}: {
  error: Error | null;
  onRetry: () => void;
  isFetching: boolean;
  categoryFilter: string;
  onCategorySwitch: (cat: string) => void;
}) {
  const [retryCount, setRetryCount] = useState(0);
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const autoRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAutoRetrying = retryCount < MAX_RETRIES && isOnline;

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-retry with exponential backoff on first error
  useEffect(() => {
    if (retryCount === 0 && !isOnline) return;
    if (retryCount >= MAX_RETRIES) return;
    if (!isOnline) return;

    const delay = RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)];
    autoRetryTimerRef.current = setTimeout(() => {
      setRetryCount(prev => prev + 1);
      onRetry();
    }, delay);

    return () => {
      if (autoRetryTimerRef.current) clearTimeout(autoRetryTimerRef.current);
    };
  }, [retryCount, isOnline, onRetry]);

  const handleManualRetry = () => {
    if (retryCount >= MAX_RETRIES) {
      setRetryCount(0);
    }
    setRetryCount(prev => Math.min(prev + 1, MAX_RETRIES));
    onRetry();
  };

  const altCategories = altCategoryConfig.filter(c => c.name !== categoryFilter);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-16 sm:py-20 gap-6"
    >
      {/* Error illustration */}
      <div className="relative">
        <motion.div
          animate={isAutoRetrying ? { rotate: 360 } : { rotate: 0 }}
          transition={isAutoRetrying ? { duration: 2, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
          className="h-24 w-24 rounded-full bg-gradient-to-br from-red-500/10 to-orange-500/10 dark:from-red-500/20 dark:to-orange-500/20 flex items-center justify-center border-2 border-dashed border-red-500/20 dark:border-red-500/30"
        >
          {isAutoRetrying ? (
            <Loader2 className="h-10 w-10 text-red-500 animate-spin" />
          ) : (
            <AlertCircle className="h-10 w-10 text-red-500" />
          )}
        </motion.div>
      </div>

      {/* Offline state */}
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20"
        >
          <WifiOff className="h-5 w-5 text-orange-500" />
          <span className="text-sm font-semibold text-orange-600 dark:text-orange-400">
            You&apos;re offline
          </span>
        </motion.div>
      )}

      {/* Error message */}
      <div className="text-center max-w-md">
        <h3 className="text-lg font-bold">
          {isOnline ? 'Something went wrong' : 'No internet connection'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          {isOnline
            ? (error?.message || 'Failed to load videos. This might be a temporary issue.')
            : 'Please check your internet connection and try again.'}
        </p>
      </div>

      {/* Retry counter progress */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_RETRIES }).map((_, i) => (
              <motion.div
                key={i}
                animate={{
                  scale: i < retryCount ? [1, 1.3, 1] : 1,
                }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                  i < retryCount
                    ? (i === retryCount - 1 && isFetching)
                      ? 'bg-orange-500 animate-pulse'
                      : 'bg-red-500'
                    : 'bg-muted-foreground/20'
                }`}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground font-medium">
            Attempt {Math.min(retryCount + 1, MAX_RETRIES)}/{MAX_RETRIES}
            {isAutoRetrying && retryCount < MAX_RETRIES && (
              <span className="ml-1.5 text-orange-500">
                (retrying in {RETRY_DELAYS[Math.min(retryCount, RETRY_DELAYS.length - 1)] / 1000}s...)
              </span>
            )}
          </span>
        </div>

        <div className="w-48 h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-red-500 to-orange-500 rounded-full"
            animate={{ width: `${(retryCount / MAX_RETRIES) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Button
          variant="default"
          onClick={handleManualRetry}
          disabled={isFetching}
          className="gap-2 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white shadow-lg shadow-red-500/20 rounded-full px-6"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {retryCount >= MAX_RETRIES ? 'Try Again' : 'Retry Now'}
        </Button>
        {retryCount >= MAX_RETRIES && (
          <span className="text-xs text-muted-foreground">
            All retries exhausted. Try manually or switch categories.
          </span>
        )}
      </div>

      {/* Category switch suggestion */}
      {retryCount >= 3 && isOnline && categoryFilter !== 'All' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-center"
        >
          <p className="text-xs text-muted-foreground mb-2">Still having trouble? Try a different category</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCategorySwitch('All')}
              className="gap-1.5 rounded-full text-xs"
            >
              <Flame className="h-3 w-3" />
              All
            </Button>
            {altCategories.slice(0, 3).map((cat) => (
              <Button
                key={cat.name}
                variant="outline"
                size="sm"
                onClick={() => onCategorySwitch(cat.name)}
                className="gap-1.5 rounded-full text-xs"
              >
                <cat.icon className="h-3 w-3" />
                {cat.name}
              </Button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
