'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Share2,
  Link2,
  Check,
  Twitter,
  MessageCircle,
  Facebook,
  Mail,
  Copy,
  QrCode,
  ExternalLink,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoTitle: string;
  videoId: string;
}

const SOCIAL_PLATFORMS = [
  {
    name: 'WhatsApp',
    icon: <MessageCircle className="h-5 w-5" />,
    color: '#25D366',
    getUrl: (url: string, title: string) =>
      `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`,
  },
  {
    name: 'Twitter / X',
    icon: <Twitter className="h-5 w-5" />,
    color: '#000000',
    getUrl: (url: string, title: string) =>
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  },
  {
    name: 'Facebook',
    icon: <Facebook className="h-5 w-5" />,
    color: '#1877F2',
    getUrl: (url: string) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    name: 'Email',
    icon: <Mail className="h-5 w-5" />,
    color: '#EA4335',
    getUrl: (url: string, title: string) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
  },
];

export function ShareDialog({ open, onOpenChange, videoTitle, videoId }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(youtubeUrl);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleEmbedCopy = async () => {
    const embedCode = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="${videoTitle}" frameborder="0" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
      toast.success('Embed code copied!');
    } catch {
      toast.error('Failed to copy embed code');
    }
  };

  const handleSocialShare = (platform: typeof SOCIAL_PLATFORMS[0]) => {
    const url = platform.getUrl(youtubeUrl, videoTitle);
    window.open(url, '_blank', 'width=600,height=400');
    onOpenChange(false);
  };

  const handleOpenYouTube = () => {
    window.open(youtubeUrl, '_blank');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 overflow-hidden">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-red-600 via-red-500 to-orange-500 px-6 py-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white text-lg">
              <Share2 className="h-5 w-5" />
              Share this video
            </DialogTitle>
            <DialogDescription className="text-red-100 text-sm line-clamp-1">
              {videoTitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-5">
          {/* Copy Link Section */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Video Link
            </p>
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5 min-w-0">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-muted-foreground truncate">{youtubeUrl}</span>
              </div>
              <Button
                onClick={handleCopyLink}
                className={`shrink-0 gap-2 rounded-xl ${
                  copied
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-foreground text-background hover:opacity-90'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Social Share */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              Share on social media
            </p>
            <div className="grid grid-cols-4 gap-3">
              {SOCIAL_PLATFORMS.map((platform, index) => (
                <motion.button
                  key={platform.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  whileHover={{ y: -3, scale: 1.03 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleSocialShare(platform)}
                  className="flex flex-col items-center gap-2 py-3 rounded-xl border hover:border-foreground/20 transition-colors cursor-pointer group"
                >
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                    style={{ background: `${platform.color}15`, color: platform.color }}
                  >
                    {platform.icon}
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {platform.name}
                  </span>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Embed & Open */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
              More options
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2 rounded-xl h-10"
                onClick={handleEmbedCopy}
              >
                <QrCode className="h-4 w-4" />
                Copy embed code
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2 rounded-xl h-10"
                onClick={handleOpenYouTube}
              >
                <ExternalLink className="h-4 w-4" />
                Open on Web
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t bg-muted/20">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Sharing helps creators reach more viewers ❤️
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
