'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, ListPlus, Trash2, GripVertical, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app-store';
import { formatDuration } from '@/lib/video-utils';

export default function MiniPlayer() {
  const { miniPlayer, setMiniPlayer, setCurrentView, setCurrentVideoId, queue, removeFromQueue, clearQueue, playNextInQueue } = useAppStore();
  const [showQueue, setShowQueue] = useState(false);

  if (!miniPlayer.open || !miniPlayer.videoId) return null;

  const handleClose = () => {
    setMiniPlayer({ open: false });
  };

  const handleOpen = () => {
    setCurrentVideoId(miniPlayer.videoId);
    setCurrentView('watch');
  };

  const handlePlayNext = (videoId: string) => {
    setCurrentVideoId(videoId);
    setCurrentView('watch');
    // Remove from queue and update mini player
    const item = queue.find((q) => q.videoId === videoId);
    if (item) {
      setMiniPlayer({
        videoId: item.videoId,
        title: item.title,
        thumbnail: item.thumbnail,
        channelId: item.channelId,
        channelName: item.channelName,
      });
      removeFromQueue(videoId);
    }
  };

  const handlePlayNextInQueue = () => {
    const next = playNextInQueue();
    if (next) {
      setCurrentVideoId(next.videoId);
      setCurrentView('watch');
      setMiniPlayer({
        videoId: next.videoId,
        title: next.title,
        thumbnail: next.thumbnail,
        channelId: next.channelId,
        channelName: next.channelName,
      });
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.8 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-4 right-4 z-50 w-80 bg-card border shadow-xl rounded-xl overflow-hidden"
      >
        {/* Now Playing */}
        <div className="flex gap-3 p-2">
          {/* Thumbnail */}
          <div
            className="relative w-28 aspect-video rounded-lg overflow-hidden bg-muted shrink-0 cursor-pointer"
            onClick={handleOpen}
          >
            {miniPlayer.thumbnail ? (
              <img
                src={miniPlayer.thumbnail}
                alt={miniPlayer.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Play className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/0 hover:bg-black/30 transition-colors flex items-center justify-center">
              <div className="w-7 h-7 rounded-full bg-black/60 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <Play className="h-3.5 w-3.5 text-white fill-white ml-0.5" />
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
            <div>
              <h4 className="text-sm font-medium line-clamp-2 leading-tight">
                {miniPlayer.title || 'Untitled'}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {miniPlayer.channelName}
              </p>
            </div>
            {/* Queue toggle + close */}
            <div className="flex items-center gap-1 mt-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 text-xs gap-1 ${showQueue ? 'bg-muted text-foreground' : 'text-muted-foreground'}`}
                onClick={() => setShowQueue(!showQueue)}
              >
                <ListPlus className="h-3 w-3" />
                Queue {queue.length > 0 && `(${queue.length})`}
              </Button>
            </div>
          </div>

          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 self-start"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Queue Section */}
        <AnimatePresence>
          {showQueue && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="border-t max-h-64 overflow-y-auto">
                {queue.length === 0 ? (
                  <div className="p-4 text-center">
                    <ListPlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Queue is empty</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Add videos from any video card
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Queue header */}
                    <div className="flex items-center justify-between px-3 py-2 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
                      <span className="text-xs font-medium text-muted-foreground">
                        Up Next ({queue.length})
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                          onClick={handlePlayNextInQueue}
                        >
                          <Play className="h-3 w-3 mr-0.5 fill-foreground" />
                          Play
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={clearQueue}
                        >
                          <Trash2 className="h-3 w-3 mr-0.5" />
                          Clear
                        </Button>
                      </div>
                    </div>

                    {/* Queue items */}
                    <div className="pb-2">
                      {queue.slice(0, 10).map((item, index) => (
                        <div
                          key={item.videoId}
                          className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors group cursor-pointer"
                          onClick={() => handlePlayNext(item.videoId)}
                        >
                          <span className="text-[10px] text-muted-foreground/50 w-4 text-center shrink-0 font-mono">
                            {index + 1}
                          </span>
                          <div className="relative w-16 aspect-video rounded overflow-hidden bg-muted shrink-0">
                            <img
                              src={item.thumbnail}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                            {item.duration > 0 && (
                              <div className="absolute bottom-0 right-0 bg-black/80 text-white text-[8px] px-1 py-px rounded-tl">
                                {formatDuration(item.duration)}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium line-clamp-1">{item.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{item.channelName}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromQueue(item.videoId);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      {queue.length > 10 && (
                        <div className="text-center py-2">
                          <span className="text-[10px] text-muted-foreground">
                            +{queue.length - 10} more in queue
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
