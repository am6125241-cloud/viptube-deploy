'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { SHORTCUTS, type ShortcutAction } from '@/hooks/use-keyboard-shortcuts';
import { Keyboard, Search, Play, Volume2, MonitorPlay, Navigation, HelpCircle, ArrowDown } from 'lucide-react';

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Navigation: <Navigation className="h-4 w-4" />,
  Playback: <Play className="h-4 w-4" />,
  General: <HelpCircle className="h-4 w-4" />,
};

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  // Deduplicate shortcuts for display
  const displayShortcuts = SHORTCUTS.filter(
    (s, i, arr) =>
      arr.findIndex((x) => x.description === s.description && x.category === s.category) === i
  );

  // Group by category
  const grouped = displayShortcuts.reduce<Record<string, ShortcutAction[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-600 to-red-500 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Keyboard className="h-5 w-5" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="text-red-100 text-sm">
              Navigate V.I.P Tube faster with keyboard shortcuts
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Shortcuts list */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {Object.entries(grouped).map(([category, shortcuts]) => (
            <div key={category} className="mb-5 last:mb-0">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-muted-foreground">{CATEGORY_ICONS[category]}</span>
                <h3 className="text-sm font-semibold text-foreground">{category}</h3>
              </div>
              <div className="space-y-1">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <kbd className="inline-flex items-center gap-1 rounded-md border bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground shadow-sm">
                      {shortcut.label}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer hint */}
        <div className="px-6 py-3 border-t bg-muted/30">
          <p className="text-xs text-muted-foreground text-center">
            Press <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono font-medium">?</kbd> anytime to open this dialog
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* Floating toast for shortcut activation */
export function ShortcutToastContainer({ toasts }: { toasts: { id: string; message: string }[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.9 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium shadow-lg shadow-black/20 whitespace-nowrap"
          >
            {toast.message}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
