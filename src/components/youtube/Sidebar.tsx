'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  TrendingUp,
  Users,
  Library,
  History,
  Clock,
  ThumbsUp,
  Youtube,
  Settings,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useAppStore, type AppView } from '@/store/app-store';

interface SidebarItem {
  icon: React.ReactNode;
  label: string;
  view: AppView;
}

const mainItems: SidebarItem[] = [
  { icon: <Flame className="h-5 w-5" />, label: 'Home', view: 'home' },
  { icon: <TrendingUp className="h-5 w-5" />, label: 'Trending', view: 'trending' },
  { icon: <Users className="h-5 w-5" />, label: 'Subscriptions', view: 'subscriptions' },
];

const libraryItems: SidebarItem[] = [
  { icon: <Library className="h-5 w-5" />, label: 'Library', view: 'library' },
  { icon: <History className="h-5 w-5" />, label: 'History', view: 'history' },
  { icon: <Clock className="h-5 w-5" />, label: 'Watch Later', view: 'watchlater' },
  { icon: <ThumbsUp className="h-5 w-5" />, label: 'Liked Videos', view: 'liked' },
];

const bottomItems: SidebarItem[] = [
  { icon: <Settings className="h-5 w-5" />, label: 'Settings', view: 'settings' },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { currentView, setCurrentView, setSidebarOpen } = useAppStore();

  const handleNav = (view: AppView) => {
    setCurrentView(view);
    setSidebarOpen(false);
    onNavigate?.();
  };

  const renderItem = (item: SidebarItem, mini: boolean) => {
    const isActive =
      item.view === 'home' && currentView === 'home'
        ? true
        : currentView === item.view;

    if (mini) {
      return (
        <TooltipProvider delayDuration={300} key={item.label}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleNav(item.view)}
                className={`flex flex-col items-center justify-center w-full py-3 px-1 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-b from-red-50 to-red-100/50 text-red-600 dark:from-red-500/15 dark:to-red-500/5 dark:text-red-400 font-semibold'
                    : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1.5 leading-tight">{item.label}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{item.label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <button
        key={item.label}
        onClick={() => handleNav(item.view)}
        className={`flex items-center gap-5 px-3 py-2.5 rounded-xl transition-all duration-200 w-full text-[13px] font-medium ${
          isActive
            ? 'bg-gradient-to-r from-red-50 to-orange-50/50 text-red-700 dark:from-red-500/15 dark:to-orange-500/5 dark:text-red-400 font-semibold shadow-sm'
            : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
        }`}
      >
        {item.icon}
        <span>{item.label}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full py-2">
      {/* Main section */}
      <div className="px-2">
        {mainItems.map((item) => renderItem(item, false))}
      </div>

      <Separator className="my-2 mx-3" />

      {/* Library section header */}
      <div className="px-5 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Library</span>
      </div>

      <div className="px-2">
        {libraryItems.map((item) => renderItem(item, false))}
      </div>

      <Separator className="my-2 mx-3" />

      {/* Subscriptions placeholder */}
      <div className="px-5 py-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Subscriptions</span>
      </div>

      <div className="px-5 py-2">
        <p className="text-xs text-muted-foreground">
          Channels you subscribe to will show up here.
        </p>
      </div>

      <div className="mt-auto" />
      <Separator className="mx-3" />
      <div className="px-2 py-1">
        {bottomItems.map((item) => renderItem(item, false))}
      </div>
    </div>
  );
}

function MiniSidebarContent() {
  const { currentView, setCurrentView } = useAppStore();

  const handleNav = (view: AppView) => {
    setCurrentView(view);
  };

  const miniItems: SidebarItem[] = [
    ...mainItems,
    ...libraryItems,
    ...bottomItems,
  ];

  return (
    <div className="flex flex-col h-full py-1">
      {miniItems.map((item) => {
        const isActive =
          item.view === 'home' && currentView === 'home'
            ? true
            : currentView === item.view;

        return (
          <TooltipProvider delayDuration={300} key={item.label}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => handleNav(item.view)}
                  className={`flex flex-col items-center justify-center w-full py-3 px-1 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-b from-red-50 to-red-100/50 text-red-600 dark:from-red-500/15 dark:to-red-500/5 dark:text-red-400 font-semibold'
                      : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                  }`}
                >
                  {item.icon}
                  <span className="text-[10px] mt-1.5 leading-tight">{item.label}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      })}
    </div>
  );
}

export default function Sidebar() {
  const { sidebarOpen, setSidebarOpen } = useAppStore();

  return (
    <>
      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />

            {/* Sidebar panel */}
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed top-14 left-0 bottom-0 w-60 bg-background z-40 md:hidden shadow-xl"
            >
              <ScrollArea className="h-full">
                <SidebarContent onNavigate={() => setSidebarOpen(false)} />
              </ScrollArea>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar - full */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="hidden md:block fixed top-14 left-0 bottom-0 bg-background/95 backdrop-blur-sm z-30 border-r border-border/50 overflow-hidden"
          >
            <div className="w-60">
              <ScrollArea className="h-full">
                <SidebarContent />
              </ScrollArea>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Desktop mini sidebar - always visible when full sidebar is closed */}
      {!sidebarOpen && (
        <aside className="hidden md:flex fixed top-14 left-0 bottom-0 w-[72px] bg-background/80 backdrop-blur-sm z-30 flex-col pt-1 overflow-y-auto border-r border-border/30">
          <MiniSidebarContent />
        </aside>
      )}
    </>
  );
}
