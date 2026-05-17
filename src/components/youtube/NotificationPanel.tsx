'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  X,
  Clock,
  Zap,
  Shield,
  Sparkles,
  Bug,
  Star,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

/* ================================================================
   APP UPDATE LOG — what's new in each version
   ================================================================ */

interface AppUpdate {
  version: string;
  date: string;
  title: string;
  changes: string[];
  icon: React.ReactNode;
  color: string;
  highlight?: boolean;
}

const APP_UPDATES: AppUpdate[] = [
  {
    version: 'v2.6',
    date: 'Today',
    title: 'Search, Shorts & Controls Fix',
    icon: <Zap className="h-4 w-4" />,
    color: '#ef4444',
    highlight: true,
    changes: [
      'Fixed video player buttons not responding — all controls now work',
      'Added Shorts section in search results — scroll to discover short clips',
      'More related videos now shown after every search',
      'Improved fullscreen support for all devices',
      'New update notifications in the bell icon',
    ],
  },
  {
    version: 'v2.5',
    date: 'Recently',
    title: 'Full Screen & Performance Update',
    icon: <Sparkles className="h-4 w-4" />,
    color: '#f97316',
    changes: [
      'Added custom full screen button for mobile — works on all devices',
      'Fixed video player controls blocking issue on mobile',
      'Improved back button navigation — app no longer closes accidentally',
      'Better touch handling on video player',
    ],
  },
  {
    version: 'v2.3',
    date: 'Earlier',
    title: 'Bug Fixes & Stability',
    icon: <Bug className="h-4 w-4" />,
    color: '#22c55e',
    changes: [
      'Fixed video playback errors',
      'Fixed search results not loading sometimes',
      'Fixed channel page navigation issues',
      'Improved app loading speed',
    ],
  },
  {
    version: 'v2.2',
    date: 'Earlier',
    title: 'Library & History Features',
    icon: <Star className="h-4 w-4" />,
    color: '#eab308',
    changes: [
      'Added Watch History with local storage',
      'Added Watch Later playlist',
      'Added Liked Videos section',
      'Subscription management',
    ],
  },
  {
    version: 'v2.0',
    date: 'Earlier',
    title: 'Major Redesign — V.I.P Tube',
    icon: <Shield className="h-4 w-4" />,
    color: '#8b5cf6',
    changes: [
      'Complete UI redesign with dark mode support',
      'Added Indian content by default',
      'Adult content filter enabled',
      'New splash screen & landing page',
      'Keyboard shortcuts support',
    ],
  },
];

/* ================================================================
   NOTIFICATION PANEL COMPONENT
   ================================================================ */

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [readVersions, setReadVersions] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const saved = sessionStorage.getItem('vt-read-versions');
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });
  const panelRef = useRef<HTMLDivElement>(null);

  // Save read versions to sessionStorage
  const markRead = useCallback((version: string) => {
    setReadVersions(prev => {
      const next = new Set(prev);
      next.add(version);
      try { sessionStorage.setItem('vt-read-versions', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const handleMarkAllRead = useCallback(() => {
    const all = new Set(APP_UPDATES.map(u => u.version));
    setReadVersions(all);
    try { sessionStorage.setItem('vt-read-versions', JSON.stringify([...all])); } catch {}
  }, []);

  const unreadCount = APP_UPDATES.filter(u => !readVersions.has(u.version)).length;

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={panelRef}>
      {/* Trigger Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 relative"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-0.5 -right-0.5 h-4 w-4 bg-red-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-sm"
          >
            {unreadCount}
          </motion.span>
        )}
      </Button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 top-full mt-2 w-80 sm:w-[400px] bg-popover text-popover-foreground rounded-2xl border shadow-2xl shadow-black/10 dark:shadow-black/40 overflow-hidden z-[60]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b bg-gradient-to-r from-red-500/5 to-orange-500/5">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-semibold">What&apos;s New</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                    {unreadCount} update{unreadCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleMarkAllRead}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Read all
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Updates List */}
            <ScrollArea className="max-h-[420px]">
              <div className="py-1">
                {APP_UPDATES.map((update, index) => {
                  const isRead = readVersions.has(update.version);
                  return (
                    <motion.div
                      key={update.version}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.15, delay: index * 0.03 }}
                      className="px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50"
                      onClick={() => markRead(update.version)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Version icon */}
                        <div
                          className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                          style={{
                            background: `${update.color}12`,
                            color: update.color,
                          }}
                        >
                          {update.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {/* Unread dot */}
                            {!isRead && (
                              <div className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse" />
                            )}
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground">
                              {update.version}
                            </span>
                            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {update.date}
                            </span>
                          </div>
                          <p className={`text-sm font-medium mt-1 ${update.highlight && !isRead ? 'text-red-500' : ''}`}>
                            {update.title}
                          </p>
                          {/* Changes list */}
                          <ul className="mt-1.5 space-y-0.5">
                            {update.changes.map((change, i) => (
                              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                                <ChevronDown className="h-3 w-3 shrink-0 mt-0.5 text-muted-foreground/40" />
                                <span>{change}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      {/* Separator between updates */}
                      {index < APP_UPDATES.length - 1 && (
                        <Separator className="mt-3" />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t px-4 py-2.5 bg-muted/30">
              <p className="text-[10px] text-muted-foreground/50 text-center">
                V.I.P Tube by Devil {'{App Developer}'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
