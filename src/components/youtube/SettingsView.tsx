'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings as SettingsIcon,
  Maximize,
  PictureInPicture2,
  Moon,
  Sun,
  Monitor,
  Smartphone,
  Info,
  Flame,
  Trash2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAppStore } from '@/store/app-store';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';

export default function SettingsView() {
  const { resolvedTheme, setTheme } = useTheme();
  const {
    autoFullscreen,
    setAutoFullscreen,
    miniPlayerEnabled,
    setMiniPlayerEnabled,
    theaterMode,
  } = useAppStore();

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const clearSearchHistory = () => {
    try { localStorage.removeItem('viptube-search-history'); } catch {}
    setShowClearConfirm(false);
  };

  const clearAllData = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
    setShowClearConfirm(false);
    window.location.reload();
  };

  const settingsSections = [
    {
      title: 'Video',
      items: [
        {
          icon: <Maximize className="h-5 w-5" />,
          label: 'Auto Fullscreen',
          description: 'Videos automatically go fullscreen when opened on mobile',
          value: autoFullscreen,
          onToggle: () => setAutoFullscreen(!autoFullscreen),
        },
        {
          icon: <PictureInPicture2 className="h-5 w-5" />,
          label: 'Mini Player',
          description: 'Show mini player when navigating away from a video',
          value: miniPlayerEnabled,
          onToggle: () => setMiniPlayerEnabled(!miniPlayerEnabled),
        },
      ],
    },
    {
      title: 'Appearance',
      items: [
        {
          icon: resolvedTheme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />,
          label: 'Dark Mode',
          description: resolvedTheme === 'dark' ? 'Currently using dark theme' : 'Currently using light theme',
          value: resolvedTheme === 'dark',
          onToggle: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'),
        },
      ],
    },
    {
      title: 'Device Info',
      items: [
        {
          icon: <Smartphone className="h-5 w-5 text-muted-foreground" />,
          label: 'Theater Mode',
          description: 'Wider video player layout (currently ' + (theaterMode ? 'on' : 'off') + ')',
          infoOnly: true,
        },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-6"
      >
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center">
          <SettingsIcon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Customize your V.I.P Tube experience</p>
        </div>
      </motion.div>

      {/* Settings sections */}
      {settingsSections.map((section, si) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: si * 0.08 }}
          className="mb-6"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            {section.title}
          </h2>
          <div className="bg-muted/30 rounded-2xl border overflow-hidden">
            {section.items.map((item, ii) => (
              <div key={item.label}>
                {ii > 0 && <Separator />}
                <div className="flex items-center gap-4 px-4 py-3.5">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                    'onToggle' in item && item.value
                      ? 'bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  {'onToggle' in item && (
                    <Switch
                      checked={item.value}
                      onCheckedChange={item.onToggle}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}

      {/* Data section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: settingsSections.length * 0.08 }}
        className="mb-6"
      >
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          Data & Storage
        </h2>
        <div className="bg-muted/30 rounded-2xl border overflow-hidden space-y-0.5">
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-9 w-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Clear Search History</p>
              <p className="text-xs text-muted-foreground mt-0.5">Remove all saved search terms</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg text-xs"
              onClick={clearSearchHistory}
            >
              Clear
            </Button>
          </div>
          <Separator />
          <div className="flex items-center gap-4 px-4 py-3.5">
            <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Clear All App Data</p>
              <p className="text-xs text-muted-foreground mt-0.5">Reset everything and reload</p>
            </div>
            {!showClearConfirm ? (
              <Button
                variant="destructive"
                size="sm"
                className="rounded-lg text-xs"
                onClick={() => setShowClearConfirm(true)}
              >
                Reset
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-lg text-xs"
                  onClick={() => setShowClearConfirm(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-lg text-xs"
                  onClick={clearAllData}
                >
                  Confirm
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* About */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: (settingsSections.length + 1) * 0.08 }}
        className="mb-8"
      >
        <div className="bg-gradient-to-br from-red-500/5 to-orange-500/5 dark:from-red-500/10 dark:to-orange-500/10 rounded-2xl border border-red-500/10 p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-red-600 flex items-center justify-center">
              <Flame className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-base">V.I.P Tube</p>
              <p className="text-xs text-muted-foreground">Version 1.0.0</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Premium video streaming experience built with ❤️. Features include ad-free browsing, 
            smart search, playlists, and personalized content.
          </p>
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            <span>Created by Devil {'{App Developer}'}</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
