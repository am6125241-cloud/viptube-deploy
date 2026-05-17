'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/store/app-store';

export interface ShortcutAction {
  key: string;
  label: string;
  description: string;
  category: string;
}

export const SHORTCUTS: ShortcutAction[] = [
  { key: '/', label: '/', description: 'Focus search bar', category: 'Navigation' },
  { key: 'k', label: 'K', description: 'Focus search bar', category: 'Navigation' },
  { key: 'Escape', label: 'Esc', description: 'Close overlay / Go back', category: 'Navigation' },
  { key: 'j', label: 'J', description: 'Navigate down in video list', category: 'Navigation' },
  { key: 'ArrowUp_j', label: '↑ / K', description: 'Navigate up in video list', category: 'Navigation' },
  { key: 'Space', label: 'Space', description: 'Toggle play / pause', category: 'Playback' },
  { key: 'm', label: 'M', description: 'Toggle mute', category: 'Playback' },
  { key: 't', label: 'T', description: 'Toggle theater mode', category: 'Playback' },
  { key: '?', label: '?', description: 'Show keyboard shortcuts', category: 'General' },
];

interface ShortcutToast {
  id: string;
  message: string;
}

let toastCounter = 0;

export function useKeyboardShortcuts({
  onTogglePlayPause,
  onToggleMute,
  onToggleTheater,
  onFocusSearch,
}: {
  onTogglePlayPause?: () => void;
  onToggleMute?: () => void;
  onToggleTheater?: () => void;
  onFocusSearch?: () => void;
}) {
  const { currentView, setCurrentView, setSidebarOpen } = useAppStore();
  const [showHelp, setShowHelp] = useState(false);
  const [toasts, setToasts] = useState<ShortcutToast[]>([]);
  const lastKeyRef = useRef<string>('');
  const suppressNextRef = useRef(false);

  const showToast = useCallback((message: string) => {
    const id = `shortcut-toast-${++toastCounter}`;
    const toast: ShortcutToast = { id, message };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 1500);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs/textareas
      const target = e.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Always handle Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        if (showHelp) {
          setShowHelp(false);
          return;
        }
        // Close sidebar on mobile
        setSidebarOpen(false);
        // Go back to home if on any detail view
        if (currentView !== 'home') {
          setCurrentView('home');
          showToast('← Back to Home');
        }
        return;
      }

      // Don't process other shortcuts when typing in inputs
      if (isInputFocused) return;

      // Prevent shortcuts from firing twice (key + keyDown)
      if (suppressNextRef.current && e.type === 'keydown') {
        suppressNextRef.current = false;
        return;
      }

      const key = e.key;

      switch (key) {
        case '?':
          e.preventDefault();
          setShowHelp((prev) => !prev);
          break;

        case '/': {
          e.preventDefault();
          onFocusSearch?.();
          showToast('🔍 Search focused');
          break;
        }

        case 'k':
        case 'K': {
          // Distinguish from J/K navigation using lastKey tracking
          e.preventDefault();
          onFocusSearch?.();
          showToast('🔍 Search focused');
          break;
        }

        case ' ':
          e.preventDefault();
          if (currentView === 'watch') {
            onTogglePlayPause?.();
            showToast('⏯ Play / Pause');
          }
          break;

        case 'm':
        case 'M':
          e.preventDefault();
          if (currentView === 'watch') {
            onToggleMute?.();
            showToast('🔇 Mute toggled');
          }
          break;

        case 't':
        case 'T':
          e.preventDefault();
          if (currentView === 'watch') {
            onToggleTheater?.();
            showToast('🖥 Theater mode toggled');
          }
          break;

        case 'j':
        case 'J':
          e.preventDefault();
          // Navigate down - scroll next video into view
          if (currentView === 'home' || currentView === 'search') {
            const focused = document.querySelector('[data-video-card-focused="true"]');
            const allCards = document.querySelectorAll('[data-video-card]');
            if (allCards.length > 0) {
              const currentIndex = focused
                ? Array.from(allCards).indexOf(focused)
                : -1;
              const nextIndex = Math.min(currentIndex + 1, allCards.length - 1);
              (allCards[nextIndex] as HTMLElement)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
              // Update focused state
              focused?.setAttribute('data-video-card-focused', 'false');
              allCards[nextIndex]?.setAttribute('data-video-card-focused', 'true');
            }
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (currentView === 'home' || currentView === 'search') {
            const focused = document.querySelector('[data-video-card-focused="true"]');
            const allCards = document.querySelectorAll('[data-video-card]');
            if (allCards.length > 0) {
              const currentIndex = focused
                ? Array.from(allCards).indexOf(focused)
                : 0;
              const prevIndex = Math.max(currentIndex - 1, 0);
              (allCards[prevIndex] as HTMLElement)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
              focused?.setAttribute('data-video-card-focused', 'false');
              allCards[prevIndex]?.setAttribute('data-video-card-focused', 'true');
            }
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (currentView === 'home' || currentView === 'search') {
            const focused = document.querySelector('[data-video-card-focused="true"]');
            const allCards = document.querySelectorAll('[data-video-card]');
            if (allCards.length > 0) {
              const currentIndex = focused
                ? Array.from(allCards).indexOf(focused)
                : -1;
              const nextIndex = Math.min(currentIndex + 1, allCards.length - 1);
              (allCards[nextIndex] as HTMLElement)?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              });
              focused?.setAttribute('data-video-card-focused', 'false');
              allCards[nextIndex]?.setAttribute('data-video-card-focused', 'true');
            }
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    currentView,
    showHelp,
    setCurrentView,
    setSidebarOpen,
    onTogglePlayPause,
    onToggleMute,
    onToggleTheater,
    onFocusSearch,
    showToast,
  ]);

  return { showHelp, setShowHelp, toasts };
}
