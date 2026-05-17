'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Youtube,
  Menu,
  Search,
  Bell,
  Sun,
  Moon,
  X,
  User,
  TrendingUp,
  Clock,
  ArrowRight,
  Trash2,
  Flame,
} from 'lucide-react';
import NotificationPanel from '@/components/youtube/NotificationPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { useAppStore } from '@/store/app-store';

/* ================================================================
   SEARCH HISTORY - localStorage based
   ================================================================ */
const SEARCH_HISTORY_KEY = 'viptube-search-history';
const MAX_HISTORY_ITEMS = 15;

function getSearchHistory(): string[] {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveSearchHistory(history: string[]) {
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history));
  } catch {
    // ignore
  }
}

function addToSearchHistory(query: string) {
  const q = query.trim();
  if (!q) return;
  const history = getSearchHistory();
  // Remove if already exists (move to top)
  const filtered = history.filter(h => h.toLowerCase() !== q.toLowerCase());
  // Add to beginning
  filtered.unshift(q);
  // Limit
  saveSearchHistory(filtered.slice(0, MAX_HISTORY_ITEMS));
}

function removeFromSearchHistory(query: string) {
  const history = getSearchHistory();
  saveSearchHistory(history.filter(h => h.toLowerCase() !== query.toLowerCase()));
}

function clearSearchHistory() {
  saveSearchHistory([]);
}

/* ================================================================
   THEME TOGGLE
   ================================================================ */
function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            suppressHydrationWarning
          >
            <Sun className="h-5 w-5 dark:hidden text-foreground" />
            <Moon className="h-5 w-5 hidden dark:block text-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/* ================================================================
   HEADER COMPONENT
   ================================================================ */
export default function Header() {
  const {
    setSidebarOpen,
    setCurrentView,
    setSearchQuery,
    searchQuery,
  } = useAppStore();

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => getSearchHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync search input with store
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  // Fetch suggestions with debounce
  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    setSuggestionsLoading(true);
    try {
      const res = await fetch(`/api/piped/search?q=${encodeURIComponent(query)}&suggestions=true`);
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setSuggestions([]);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Debounced suggestion fetch
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (searchInput.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(searchInput);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput, fetchSuggestions]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback((query?: string) => {
    const q = (query || searchInput).trim();
    if (q) {
      setSearchQuery(q);
      setCurrentView('search');
      setMobileSearchOpen(false);
      setShowSuggestions(false);
      inputRef.current?.blur();
      // Save to search history
      addToSearchHistory(q);
      setSearchHistory(getSearchHistory());
    }
  }, [searchInput, setSearchQuery, setCurrentView]);

  const handleRemoveHistoryItem = useCallback((e: React.MouseEvent, query: string) => {
    e.stopPropagation();
    e.preventDefault();
    removeFromSearchHistory(query);
    setSearchHistory(getSearchHistory());
  }, []);

  const handleClearHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    clearSearchHistory();
    setSearchHistory([]);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // When showing history, selectedSuggestionIndex applies to history items
        const isTyping = searchInput.trim().length >= 2;
        if (selectedSuggestionIndex >= 0) {
          if (isTyping && suggestions[selectedSuggestionIndex]) {
            handleSearch(suggestions[selectedSuggestionIndex]);
          } else if (!isTyping && searchHistory[selectedSuggestionIndex]) {
            handleSearch(searchHistory[selectedSuggestionIndex]);
          } else {
            handleSearch();
          }
        } else {
          handleSearch();
        }
        setSelectedSuggestionIndex(-1);
      }
      if (e.key === 'Escape') {
        setMobileSearchOpen(false);
        setShowSuggestions(false);
        inputRef.current?.blur();
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const maxIndex = searchInput.trim().length >= 2 ? suggestions.length : searchHistory.length;
        setSelectedSuggestionIndex(prev => Math.min(prev + 1, maxIndex - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1));
      }
    },
    [handleSearch, suggestions, searchHistory, searchInput]
  );

  // Focus input when mobile search opens
  useEffect(() => {
    if (mobileSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [mobileSearchOpen]);

  // Whether to show search history or suggestions
  const isTyping = searchInput.trim().length >= 2;
  const showHistoryDropdown = showSuggestions && !isTyping && searchHistory.length > 0;
  const showSuggestionsDropdown = showSuggestions && isTyping;

  // Total items for keyboard navigation
  const totalDropdownItems = isTyping ? suggestions.length : searchHistory.length;

  // Suggestions / History dropdown component
  const SuggestionsDropdown = () => {
    if (!showSuggestions) return null;

    return (
      <motion.div
        ref={suggestionsRef}
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute top-full left-0 right-0 mt-1 bg-popover text-popover-foreground rounded-xl border shadow-xl overflow-hidden z-50"
      >
        {/* ===== SEARCH HISTORY (when input is empty) ===== */}
        {showHistoryDropdown && (
          <div className="py-1 max-h-80 overflow-y-auto">
            {/* Header row */}
            <div className="flex items-center justify-between px-4 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" />
                Search History
              </div>
              <button
                onClick={handleClearHistory}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="h-3 w-3" />
                Clear all
              </button>
            </div>

            <Separator className="mx-2" />

            {/* History items */}
            {searchHistory.map((query, index) => (
              <div
                key={`history-${query}-${index}`}
                className={`group flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                  index === selectedSuggestionIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => handleSearch(query)}
                onMouseEnter={() => setSelectedSuggestionIndex(index)}
              >
                <div className="h-4 w-4 flex items-center justify-center text-muted-foreground shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <span className="truncate flex-1">{query}</span>
                {/* Remove button */}
                <button
                  onClick={(e) => handleRemoveHistoryItem(e, query)}
                  className="h-6 w-6 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              </div>
            ))}

            {/* Trending suggestions at bottom */}
            <Separator className="mx-2" />
            <div className="px-4 py-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                <Flame className="h-3.5 w-3.5 text-orange-500" />
                Trending
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['Trending Music', 'Gaming', 'Latest News', 'Cricket', 'Bollywood'].map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleSearch(topic)}
                    className="text-xs px-2.5 py-1 rounded-full bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== SEARCH SUGGESTIONS (when typing) ===== */}
        {showSuggestionsDropdown && (
          <div className="py-1 max-h-80 overflow-y-auto">
            {suggestionsLoading ? (
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-muted-foreground/30 border-t-foreground rounded-full animate-spin" />
                  Searching...
                </div>
              </div>
            ) : suggestions.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No suggestions found
              </div>
            ) : (
              suggestions.map((suggestion, index) => {
                // Adjust keyboard index: history items come first
                const keyboardIndex = searchHistory.length + index;

                return (
                  <button
                    key={`suggestion-${suggestion}`}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                      keyboardIndex === selectedSuggestionIndex
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleSearch(suggestion)}
                    onMouseEnter={() => setSelectedSuggestionIndex(keyboardIndex)}
                  >
                    {index === 0 ? (
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <div className="h-4 w-4 flex items-center justify-center text-muted-foreground shrink-0 text-xs">
                        {index}
                      </div>
                    )}
                    <span className="truncate flex-1">{suggestion}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 opacity-0 group-hover:opacity-100" />
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* ===== EMPTY STATE (input focused but no history & not typing) ===== */}
        {!showHistoryDropdown && !showSuggestionsDropdown && !suggestionsLoading && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <Search className="h-6 w-6 mx-auto mb-2 opacity-30" />
            <p>Start typing to search</p>
          </div>
        )}
      </motion.div>
    );
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/85 backdrop-blur-2xl border-b border-border/40 h-14 flex items-center px-4 gap-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      {/* Left section */}
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 hidden md:flex"
          onClick={() => setSidebarOpen((prev: boolean) => !prev)}
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo - Animated */}
        <motion.button
          className="flex items-center gap-1.5 shrink-0"
          onClick={() => { setCurrentView('home'); setSearchQuery(''); }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
        >
          {/* Animated logo box */}
          <div className="relative h-9 w-9 rounded-xl overflow-hidden">
            {/* Animated gradient background */}
            <div
              className="absolute inset-0 animate-gradient"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626, #b91c1c, #ef4444)',
                backgroundSize: '300% 300%',
                animation: 'gradientShift 3s ease infinite',
              }}
            />
            {/* Glowing ring */}
            <div className="absolute inset-0 rounded-xl shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse" />
            {/* Play icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="h-5 w-5 text-white drop-shadow-sm" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
          {/* Animated text */}
          <div className="flex items-baseline">
            <motion.span
              className="text-lg font-extrabold tracking-tight display-font"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              V.I.P
            </motion.span>
            <motion.span
              className="text-lg font-extrabold tracking-tight display-font"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Tube
            </motion.span>
            {/* Sparkle dot */}
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 ml-0.5"
              animate={{
                scale: [1, 1.5, 1],
                opacity: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          </div>
        </motion.button>
      </div>

      {/* Center - Desktop search */}
      <div className="hidden md:flex flex-1 max-w-2xl mx-auto">
        <div className="flex w-full relative">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => { setShowSuggestions(true); }}
              className="rounded-l-xl rounded-r-none border-r-0 h-10 focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-1 focus-visible:z-10 bg-muted/30 border-border/60 placeholder:text-muted-foreground/50 transition-all focus-visible:bg-background"
            />
            {searchInput && (
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-10 w-10"
                onClick={() => { setSearchInput(''); setSuggestions([]); setShowSuggestions(false); }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            <SuggestionsDropdown />
          </div>
          <Button
            variant="secondary"
            className="rounded-r-xl rounded-l-none h-10 px-5 bg-muted/50 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-all border-l border-border/50"
            onClick={() => handleSearch()}
          >
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1 shrink-0 ml-auto">
        {/* Mobile search icon */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 md:hidden"
          onClick={() => setMobileSearchOpen(true)}
        >
          <Search className="h-5 w-5" />
        </Button>

        <ThemeToggle />

        {/* Notification Panel — "What's New" updates */}
        <NotificationPanel />

        {/* User Avatar - shows logged-in user's name */}
        {(() => {
          try {
            const saved = localStorage.getItem('viptube-user');
            if (saved) {
              const u = JSON.parse(saved);
              return (
                <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-red-500/30 transition-all" title={u.name}>
                  <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs font-bold">
                    {(u.name || 'U')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              );
            }
          } catch {}
          return (
            <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-transparent hover:ring-red-500/30 transition-all">
              <AvatarFallback className="bg-gradient-to-br from-red-500 to-red-700 text-white text-xs font-bold">
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          );
        })()}
      </div>

      {/* Mobile search overlay */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 left-0 right-0 bg-background border-b p-2 flex-col gap-0 md:hidden z-60"
          >
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => { setMobileSearchOpen(false); setShowSuggestions(false); }}
              >
                <X className="h-5 w-5" />
              </Button>
              <div className="flex flex-1 relative">
                <Input
                  ref={inputRef}
                  type="text"
                  placeholder="Search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onFocus={() => { setShowSuggestions(true); }}
                  className="rounded-r-none border-r-0 h-10 focus-visible:ring-0"
                  autoFocus
                />
                {searchInput && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => { setSearchInput(''); setSuggestions([]); setShowSuggestions(false); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button
                variant="secondary"
                className="rounded-l-none h-10 px-4"
                onClick={() => handleSearch()}
              >
                <Search className="h-5 w-5" />
              </Button>
            </div>
            <div className="relative">
              <SuggestionsDropdown />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
