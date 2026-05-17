import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppView = 'home' | 'trending' | 'library' | 'watch' | 'search' | 'channel' | 'history' | 'watchlater' | 'liked' | 'subscriptions' | 'settings' | 'admin';

export interface VideoItem {
  url?: string;
  title: string;
  thumbnail: string;
  uploaderName: string;
  uploaderUrl?: string;
  uploaderAvatar?: string;
  uploadedDate?: string;
  duration: number;
  views: number;
  uploaderVerified?: boolean;
  isShort?: boolean;
  type?: string;
  videoId?: string;
  channelId?: string;
}

export interface QueueItem {
  videoId: string;
  title: string;
  thumbnail: string;
  channelId: string;
  channelName: string;
  duration: number;
}

export interface AppState {
  // Navigation
  currentView: AppView;
  setCurrentView: (view: AppView) => void;
  
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  sidebarMini: boolean;
  setSidebarMini: (mini: boolean) => void;
  
  // Search
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  
  // Watch
  currentVideoId: string | null;
  setCurrentVideoId: (id: string | null) => void;
  
  // Channel
  currentChannelId: string | null;
  setCurrentChannelId: (id: string | null) => void;
  
  // Category filter
  categoryFilter: string;
  setCategoryFilter: (cat: string) => void;
  
  // Theater mode
  theaterMode: boolean;
  setTheaterMode: (theater: boolean) => void;
  
  // Settings
  autoFullscreen: boolean;
  setAutoFullscreen: (v: boolean) => void;
  miniPlayerEnabled: boolean;
  setMiniPlayerEnabled: (v: boolean) => void;
  
  // Mini player
  miniPlayer: {
    open: boolean;
    videoId: string;
    title: string;
    thumbnail: string;
    channelId: string;
    channelName: string;
  };
  setMiniPlayer: (data: Partial<AppState['miniPlayer']> & { open?: boolean }) => void;
  
  // Video Queue
  queue: QueueItem[];
  addToQueue: (item: QueueItem) => void;
  removeFromQueue: (videoId: string) => void;
  clearQueue: () => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  playNextInQueue: () => QueueItem | null;

  // Current Playlist
  currentPlaylist: {
    id: string;
    name: string;
    thumbnail: string;
    channelName: string;
    videos: QueueItem[];
    currentIndex: number;
  } | null;
  setCurrentPlaylist: (playlist: AppState['currentPlaylist']) => void;
  clearCurrentPlaylist: () => void;
  playNextInPlaylist: () => QueueItem | null;
  playPrevInPlaylist: () => QueueItem | null;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Navigation
      currentView: 'home',
      setCurrentView: (view) => set({ currentView: view }),
      
      // Sidebar
      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      sidebarMini: false,
      setSidebarMini: (mini) => set({ sidebarMini: mini }),
      
      // Search
      searchQuery: '',
      setSearchQuery: (q) => set({ searchQuery: q }),
      
      // Watch
      currentVideoId: null,
      setCurrentVideoId: (id) => set({ currentVideoId: id }),
      
      // Channel
      currentChannelId: null,
      setCurrentChannelId: (id) => set({ currentChannelId: id }),
      
      // Category
      categoryFilter: 'All',
      setCategoryFilter: (cat) => set({ categoryFilter: cat }),
      
      // Theater mode
      theaterMode: false,
      setTheaterMode: (theater) => set({ theaterMode: theater }),
      
      // Settings
      autoFullscreen: false,
      setAutoFullscreen: (v) => set({ autoFullscreen: v }),
      miniPlayerEnabled: true,
      setMiniPlayerEnabled: (v) => set({ miniPlayerEnabled: v }),
      
      // Mini player
      miniPlayer: {
        open: false,
        videoId: '',
        title: '',
        thumbnail: '',
        channelId: '',
        channelName: '',
      },
      setMiniPlayer: (data) =>
        set((state) => ({
          miniPlayer: { ...state.miniPlayer, ...data },
        })),
      
      // Video Queue
      queue: [],
      addToQueue: (item) =>
        set((state) => {
          // Don't add duplicates
          if (state.queue.some((q) => q.videoId === item.videoId)) {
            return state;
          }
          return { queue: [...state.queue, item] };
        }),
      removeFromQueue: (videoId) =>
        set((state) => ({
          queue: state.queue.filter((q) => q.videoId !== videoId),
        })),
      clearQueue: () => set({ queue: [] }),
      reorderQueue: (fromIndex, toIndex) =>
        set((state) => {
          const newQueue = [...state.queue];
          const [moved] = newQueue.splice(fromIndex, 1);
          newQueue.splice(toIndex, 0, moved);
          return { queue: newQueue };
        }),
      playNextInQueue: () => {
        const { queue } = get();
        if (queue.length === 0) return null;
        const next = queue[0];
        set((state) => ({ queue: state.queue.slice(1) }));
        return next;
      },

      // Current Playlist
      currentPlaylist: null,
      setCurrentPlaylist: (playlist) => set({ currentPlaylist: playlist }),
      clearCurrentPlaylist: () => set({ currentPlaylist: null }),
      playNextInPlaylist: () => {
        const { currentPlaylist } = get();
        if (!currentPlaylist) return null;
        const nextIndex = currentPlaylist.currentIndex + 1;
        if (nextIndex >= currentPlaylist.videos.length) return null;
        set((state) => ({
          currentPlaylist: state.currentPlaylist
            ? { ...state.currentPlaylist, currentIndex: nextIndex }
            : null,
        }));
        return currentPlaylist.videos[nextIndex];
      },
      playPrevInPlaylist: () => {
        const { currentPlaylist } = get();
        if (!currentPlaylist) return null;
        const prevIndex = currentPlaylist.currentIndex - 1;
        if (prevIndex < 0) return null;
        set((state) => ({
          currentPlaylist: state.currentPlaylist
            ? { ...state.currentPlaylist, currentIndex: prevIndex }
            : null,
        }));
        return currentPlaylist.videos[prevIndex];
      },
    }),
    {
      name: 'viptube-storage',
      partialize: (state) => ({
        sidebarMini: state.sidebarMini,
        categoryFilter: state.categoryFilter,
        theaterMode: state.theaterMode,
        autoFullscreen: state.autoFullscreen,
        miniPlayerEnabled: state.miniPlayerEnabled,
      }),
    }
  )
);
