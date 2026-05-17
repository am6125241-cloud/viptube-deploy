'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame, Heart } from 'lucide-react';
import Header from '@/components/youtube/Header';
import Sidebar from '@/components/youtube/Sidebar';
import HomeFeed from '@/components/youtube/HomeFeed';
import TrendingPage from '@/components/youtube/TrendingPage';
import LibraryHubPage from '@/components/youtube/LibraryHubPage';
import VideoPlayer from '@/components/youtube/VideoPlayer';
import SearchResults from '@/components/youtube/SearchResults';
import ChannelPage from '@/components/youtube/ChannelPage';
import LibraryPage from '@/components/youtube/LibraryPage';
import MiniPlayer from '@/components/youtube/MiniPlayer';
import LandingPage from '@/components/youtube/LandingPage';
import SignupPage from '@/components/youtube/SignupPage';
import SplashScreen from '@/components/youtube/SplashScreen';
import SettingsView from '@/components/youtube/SettingsView';
import AdminPanel from '@/components/youtube/AdminPanel';
import NotificationPanel from '@/components/youtube/NotificationPanel';
import { KeyboardShortcutsHelp, ShortcutToastContainer } from '@/components/youtube/KeyboardShortcutsHelp';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useAppStore } from '@/store/app-store';

/* ================================================================
   MOBILE BACK-BUTTON HANDLER
   Tracks an in-app navigation stack so the browser back button
   navigates between VIP Tube views instead of closing the app.
   ================================================================ */
function useBackButtonHandler(showApp: boolean, currentView: string, setCurrentView: (v: any) => void) {
  const navStackRef = useRef<string[]>([]);
  const programmaticRef = useRef(false);

  // When the main app mounts, seed the base history entry
  useEffect(() => {
    if (!showApp) return;
    navStackRef.current = [currentView];
    window.history.replaceState({ __vt: 'base' }, '');
  }, [showApp]);

  // Push a browser history entry whenever the view changes (not from popstate)
  useEffect(() => {
    if (!showApp) return;

    // If this navigation was triggered by popstate, don't push again
    if (programmaticRef.current) {
      programmaticRef.current = false;
      return;
    }

    const stack = navStackRef.current;
    const last = stack[stack.length - 1];
    if (currentView !== last) {
      stack.push(currentView);
      window.history.pushState({ __vt: currentView }, '');
    }
  }, [currentView, showApp]);

  // Listen for back button (popstate)
  useEffect(() => {
    if (!showApp) return;

    const onPopState = () => {
      // Fullscreen video exit
      if ((window as any).__vtFs) {
        try { (window as any).__vtFsExit?.(); } catch {}
        try { window.history.pushState({ __vt: 'watch' }, ''); } catch {}
        return;
      }

      const stack = navStackRef.current;
      if (stack.length > 1) {
        // Go back to previous view inside the app
        stack.pop();
        const prevView = stack[stack.length - 1];
        programmaticRef.current = true;
        setCurrentView(prevView);
      }
      // stack.length === 1 (home) → let the browser close the app naturally
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [showApp, setCurrentView]);
}

/* ================================================================
   STICKY FOOTER - "Created by Devil { App Developer }"
   ================================================================ */
function AppFooter() {
  return (
    <footer className="border-t bg-background/90 backdrop-blur-xl relative overflow-hidden">
      {/* Subtle mesh gradient background */}
      <div className="absolute inset-0 mesh-gradient pointer-events-none" />
      {/* Creative rainbow divider at top */}
      <div className="absolute top-0 left-0 right-0 divider-creative" />
      <div className="px-4 sm:px-6 py-5 relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left - brand */}
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Flame className="h-5 w-5 text-red-500" />
            </motion.div>
            <span className="text-sm text-muted-foreground display-font">
              V.I.P Tube <span className="sunset-text font-bold">&mdash;</span> Premium Video Streaming
            </span>
          </div>

          {/* Center - Devil branding */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-muted-foreground">Created by</span>
            <span
              className="fire-text font-extrabold text-lg tracking-tight display-font drop-shadow-sm select-none cursor-pointer"
              onClick={() => (window as any).__viptubeAdminTap?.()}
            >
              Devil
            </span>
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              {'{'}App Developer{'}'}
            </span>
          </div>

          {/* Right - love */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Made with</span>
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
            </motion.div>
          </div>
        </div>

        {/* Subtle divider line */}
        <div className="mt-4 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />

        {/* Bottom copyright */}
        <div className="mt-3 text-center">
          <p className="text-[11px] text-muted-foreground/60 tracking-wide">
            &copy; {new Date().getFullYear()} V.I.P Tube. All rights reserved.
            Powered by Devil { '{App Developer}' }
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ================================================================
   MAIN APP CONTENT
   ================================================================ */
function getInitialLandingState() {
  try {
    return sessionStorage.getItem('viptube-visited') ? false : true;
  } catch {
    return true;
  }
}

/* ================================================================
   VISITOR TRACKING - Tracks every user who opens the app
   ================================================================ */
function getOrCreateVisitorId(): string {
  try {
    let id = localStorage.getItem('viptube-vid');
    if (!id) {
      id = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('viptube-vid', id);
    }
    return id;
  } catch {
    return 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
}

function detectDevice(): string {
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
  if (/Tablet|iPad/i.test(ua)) return 'Tablet';
  return 'Desktop';
}

function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome') && !ua.includes('Edg/')) return 'Chrome';
  if (ua.includes('Safari') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR/')) return 'Opera';
  return 'Unknown';
}

function detectOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS')) return 'macOS';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Linux')) return 'Linux';
  return 'Unknown';
}

function useVisitorTracker(isActive: boolean, currentPage: string) {
  const visitorIdRef = useRef(getOrCreateVisitorId());

  useEffect(() => {
    if (!isActive) return;

    const trackVisit = () => {
      try {
        // Get logged-in user name from localStorage
        let userName = '';
        try {
          const saved = localStorage.getItem('viptube-user');
          if (saved) {
            const u = JSON.parse(saved);
            userName = u.name || '';
          }
        } catch {}

        fetch('/api/admin/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorId: visitorIdRef.current,
            userName,
            device: detectDevice(),
            browser: detectBrowser(),
            os: detectOS(),
            screenRes: `${screen.width}x${screen.height}`,
            language: navigator.language || '',
            referrer: document.referrer || '',
            page: currentPage,
          }),
        }).catch(() => {});
      } catch {}
    };

    // Initial track
    trackVisit();

    // Heartbeat every 15 seconds
    const interval = setInterval(trackVisit, 15000);

    // Track page visibility changes
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        trackVisit();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isActive, currentPage]);
}

/* ================================================================
   ADMIN TRIGGER - Reliable tap-based approach
   ================================================================ */
function useAdminTrigger() {
  const setCurrentView = useAppStore((s) => s.setCurrentView);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    (window as any).__viptubeAdminTap = () => {
      tapCountRef.current += 1;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);

      if (tapCountRef.current >= 5) {
        tapCountRef.current = 0;
        setCurrentView('admin');
        return;
      }

      tapTimerRef.current = setTimeout(() => {
        tapCountRef.current = 0;
      }, 3000);
    };

    return () => {
      delete (window as any).__viptubeAdminTap;
      if (tapTimerRef.current) clearTimeout(tapTimerRef.current);
    };
  }, [setCurrentView]);
}

function AppContent() {
  const { currentView, sidebarOpen, currentVideoId, currentChannelId, setCurrentView } = useAppStore();
  const [isDesktop, setIsDesktop] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; email: string; createdAt: string } | null>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('viptube-user') : null;
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  // Keyboard shortcuts
  const { showHelp, setShowHelp, toasts } = useKeyboardShortcuts({
    onFocusSearch: () => {
      const input = document.querySelector('input[placeholder="Search"]') as HTMLInputElement;
      input?.focus();
    },
  });
  const [showSplash, setShowSplash] = useState(true);
  const [showSignup, setShowSignup] = useState(false);
  const [showLanding, setShowLanding] = useState(false);
  const [showApp, setShowApp] = useState(false);
  const initialShouldLand = useRef(getInitialLandingState());

  // Mobile back-button handler — MUST be after showApp is defined
  useBackButtonHandler(showApp, currentView, setCurrentView);

  // Visitor tracking - tracks when app is open
  useVisitorTracker(showApp || false, currentView);

  // Admin trigger - listen for secret 5-tap on "Devil" in footer
  useAdminTrigger();

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
    // If already logged in, skip signup
    if (currentUser) {
      if (initialShouldLand.current) {
        setTimeout(() => setShowLanding(true), 50);
      } else {
        setTimeout(() => setShowApp(true), 50);
      }
      return;
    }
    // Show signup
    setTimeout(() => setShowSignup(true), 50);
  }, [currentUser]);

  const handleSignup = useCallback((user: { id: string; name: string; email: string; createdAt: string }) => {
    setCurrentUser(user);
    setTimeout(() => setShowLanding(true), 50);
  }, []);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleExplore = () => {
    try {
      sessionStorage.setItem('viptube-visited', 'true');
    } catch {
      // ignore
    }
    setShowLanding(false);
    setTimeout(() => setShowApp(true), 100);
  };

  const sidebarWidth = sidebarOpen ? 240 : 72;

  const renderContent = () => {
    switch (currentView) {
      case 'home':
        return <HomeFeed />;
      case 'trending':
        return <TrendingPage />;
      case 'library':
        return <LibraryHubPage />;
      case 'watch':
        return currentVideoId ? <VideoPlayer /> : (
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-muted-foreground">Select a video to watch</p>
          </div>
        );
      case 'search':
        return <SearchResults />;
      case 'channel':
        return currentChannelId ? <ChannelPage /> : (
          <div className="flex items-center justify-center h-[60vh]">
            <p className="text-muted-foreground">Select a channel to view</p>
          </div>
        );
      case 'history':
        return <LibraryPage type="history" />;
      case 'watchlater':
        return <LibraryPage type="watchlater" />;
      case 'liked':
        return <LibraryPage type="liked" />;
      case 'subscriptions':
        return <LibraryPage type="subscriptions" />;
      case 'settings':
        return <SettingsView />;
      case 'admin':
        return <AdminPanel />;
      default:
        return <HomeFeed />;
    }
  };

  return (
    <>
      {/* ===== SPLASH SCREEN ===== */}
      <AnimatePresence>
        {showSplash && (
          <SplashScreen onComplete={handleSplashComplete} />
        )}
      </AnimatePresence>

      {/* ===== SIGNUP PAGE ===== */}
      <AnimatePresence>
        {showSignup && <SignupPage onSignup={handleSignup} />}
      </AnimatePresence>

      {/* ===== LANDING PAGE ===== */}
      <AnimatePresence>
        {showLanding && <LandingPage onExplore={handleExplore} />}
      </AnimatePresence>

      {/* ===== MAIN APP ===== */}
      <AnimatePresence>
        {showApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="min-h-screen flex flex-col bg-background relative noise-bg app-glow"
          >
            <Header />
            <Sidebar />

            {/* Main content area */}
            <main
              className="flex-1 pt-14 transition-all duration-300"
              style={isDesktop ? { marginLeft: `${sidebarWidth}px` } : undefined}
            >
              <div className="max-w-[1800px] mx-auto">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentView}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                  >
                    {renderContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </main>

            {/* Sticky Footer */}
            <AppFooter />

            {/* Overlays */}
            <MiniPlayer />
            <KeyboardShortcutsHelp open={showHelp} onOpenChange={setShowHelp} />
            <ShortcutToastContainer toasts={toasts} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function VIPTubeHome() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
      >
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
