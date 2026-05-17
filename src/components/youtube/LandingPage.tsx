'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import {
  Play,
  Shield,
  Zap,
  Tv,
  Search,
  Flame,
  Music,
  Gamepad2,
  Newspaper,
  Trophy,
  Heart,
  ChevronDown,
  Sparkles,
  Globe,
  Clock,
  ThumbsUp,
  Star,
  ArrowRight,
  MonitorPlay,
  Wifi,
  Users,
  Headphones,
  Volume2,
  Lock,
} from 'lucide-react';

/* ================================================================
   DATA TYPES
   ================================================================ */
interface TrendingVideoData {
  videoId: string;
  title: string;
  thumbnail: string;
  channelName: string;
  channelAvatar?: string;
  duration: number;
  views: number;
  uploadedDate: string;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1_000_000_000) return `${(views / 1_000_000_000).toFixed(1)}B`;
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M`;
  if (views >= 1_000) return `${(views / 1_000).toFixed(1)}K`;
  return views.toString();
}

/* ================================================================
   ANIMATED COUNTER
   ================================================================ */
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const inc = target / (2000 / 16);
    const timer = setInterval(() => {
      start += inc;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return <span>{count.toLocaleString()}{suffix}</span>;
}

/* ================================================================
   VIDEO CARD WITH REAL THUMBNAIL
   ================================================================ */
function VideoCard({ video, delay }: { video: TrendingVideoData; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -6 }}
      className="group cursor-pointer"
    >
      <div className="relative aspect-video rounded-2xl overflow-hidden shadow-lg shadow-black/20">
        {video.thumbnail ? (
          <img
            src={video.thumbnail}
            alt={video.title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-red-600 to-orange-500" />
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
          <div className="h-14 w-14 rounded-full bg-white/95 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-300 shadow-2xl">
            <Play className="h-6 w-6 text-black fill-black ml-0.5" />
          </div>
        </div>

        {video.duration > 0 && (
          <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 text-white text-[11px] font-medium">
            {formatDuration(video.duration)}
          </div>
        )}
      </div>

      <div className="mt-3 flex gap-3">
        {video.channelAvatar ? (
          <img src={video.channelAvatar} alt="" className="h-9 w-9 rounded-full shrink-0 mt-0.5 object-cover" loading="lazy" />
        ) : (
          <div className="h-9 w-9 rounded-full bg-red-600/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold text-red-500">{video.channelName[0]}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold leading-snug line-clamp-2 group-hover:text-red-500 transition-colors">{video.title}</h4>
          <p className="text-xs text-muted-foreground mt-1">{video.channelName}</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{formatViews(video.views)} views{video.uploadedDate ? ` · ${video.uploadedDate}` : ''}</p>
        </div>
      </div>
    </motion.div>
  );
}

/* ================================================================
   FEATURE CARD (clean glass style)
   ================================================================ */
function FeatureCard({ icon: Icon, title, description, delay }: {
  icon: React.ElementType; title: string; description: string; delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -4 }}
      className="relative group"
    >
      <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-sm p-6 h-full transition-all duration-300 hover:border-red-500/30 hover:shadow-lg hover:shadow-red-500/5">
        <div className="h-11 w-11 rounded-xl bg-red-600/10 flex items-center justify-center mb-4 transition-colors group-hover:bg-red-600/15">
          <Icon className="h-5 w-5 text-red-500" />
        </div>
        <h3 className="font-bold mb-1.5">{title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}

/* ================================================================
   FAQ ACCORDION
   ================================================================ */
function FAQItem({ question, answer, isOpen, onToggle }: {
  question: string; answer: string; isOpen: boolean; onToggle: () => void;
}) {
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden transition-all hover:border-red-500/20">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-5 text-left cursor-pointer">
        <span className="font-semibold text-sm pr-4">{question}</span>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.3 }} className="shrink-0">
          <ChevronDown className="h-4 w-4 text-red-500" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{answer}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================
   MAIN LANDING PAGE
   ================================================================ */
export default function LandingPage({ onExplore }: { onExplore: () => void }) {
  const [isVisible, setIsVisible] = useState(true);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [trendingVideos, setTrendingVideos] = useState<TrendingVideoData[]>([]);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -100]);

  useEffect(() => {
    fetch('/api/piped/landing-trending')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d) && d.length > 0) setTrendingVideos(d); })
      .catch(() => {});
  }, []);

  const handleExplore = useCallback(() => {
    setIsVisible(false);
    setTimeout(() => onExplore(), 500);
  }, [onExplore]);

  const toggleFaq = (i: number) => setFaqOpen((p) => (p === i ? null : i));

  const displayVideos = trendingVideos.length > 0 ? trendingVideos.slice(0, 3) : [];

  const faqs = [
    { q: 'Is V.I.P Tube really free?', a: 'Yes! 100% free. No subscriptions, no hidden fees, no premium tiers. Just open and watch.' },
    { q: 'How does it work without ads?', a: 'V.I.P Tube delivers content directly without any ad injections. Pure premium video experience.' },
    { q: 'Can I search for videos?', a: 'Absolutely! Our search engine finds any video from our massive library instantly.' },
    { q: 'Do I need an account?', a: 'No account needed! Just visit and start watching. But signing up lets you save videos and manage playlists.' },
    { q: 'What categories are available?', a: 'Trending, Music, Gaming, News, Sports, Live, Learning, Fashion, and many more — updated every minute!' },
  ];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] overflow-y-auto landing-no-scrollbar"
          ref={containerRef}
        >
          <div className="min-h-screen bg-background">

            {/* ========== HERO ========== */}
            <section className="relative min-h-screen flex items-center overflow-hidden">
              {/* Background image */}
              <div className="absolute inset-0">
                <img
                  src="/hero-bg.png"
                  alt=""
                  onLoad={() => setHeroLoaded(true)}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${heroLoaded ? 'opacity-100' : 'opacity-0'}`}
                />
                {/* Dark overlays for readability */}
                <div className="absolute inset-0 bg-black/60" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-background" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-black/50" />
              </div>

              {/* Subtle red accent glow */}
              <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/15 rounded-full blur-[120px] pointer-events-none" />
              <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

              <motion.div
                style={{ y: heroY }}
                className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 pt-20 pb-32 text-center"
              >
                {/* Badge */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full mb-8"
                >
                  <div className="relative">
                    <Sparkles className="h-4 w-4 text-yellow-400" />
                    <div className="absolute inset-0 animate-ping">
                      <Sparkles className="h-4 w-4 text-yellow-400/50" />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-white/80">
                    The Future of Video Streaming
                  </span>
                </motion.div>

                {/* Heading */}
                <motion.h1
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.15 }}
                  className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.92] mb-6"
                >
                  <span className="block text-white">Welcome to</span>
                  <span className="fire-text block mt-1 text-6xl sm:text-7xl md:text-8xl lg:text-9xl">V.I.P Tube</span>
                </motion.h1>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.35 }}
                  className="text-base sm:text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed"
                >
                  Watch unlimited real videos — trending, music, gaming, news.
                  <br className="hidden sm:block" />
                  <span className="font-semibold text-white/90"> Zero ads. Zero interruptions. 100% free.</span>
                </motion.p>

                {/* CTA Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.55 }}
                  className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-14"
                >
                  <motion.button
                    whileHover={{ scale: 1.04, boxShadow: '0 0 40px rgba(239, 68, 68, 0.4)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleExplore}
                    className="group relative px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-full text-base font-bold transition-all cursor-pointer flex items-center gap-2.5 shadow-xl shadow-red-600/30"
                  >
                    <Play className="h-5 w-5 fill-white" />
                    Start Watching
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleExplore}
                    className="px-8 py-4 rounded-full text-base font-bold flex items-center gap-2.5 cursor-pointer border border-white/20 text-white/90 hover:bg-white/10 transition-all backdrop-blur-sm"
                  >
                    <Search className="h-5 w-5" />
                    Explore Videos
                  </motion.button>
                </motion.div>

                {/* Quick stats pills */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.75 }}
                  className="flex flex-wrap items-center justify-center gap-3"
                >
                  {[
                    { icon: Users, text: '10K+ Videos' },
                    { icon: Lock, text: 'No Ads' },
                    { icon: Zap, text: 'Ultra Fast' },
                    { icon: Headphones, text: 'HD Quality' },
                  ].map((item) => (
                    <div key={item.text} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-medium">
                      <item.icon className="h-3.5 w-3.5" />
                      {item.text}
                    </div>
                  ))}
                </motion.div>
              </motion.div>

              {/* Scroll indicator */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
              >
                <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 2, repeat: Infinity }} className="flex flex-col items-center gap-1.5">
                  <span className="text-[11px] text-white/30 tracking-widest uppercase">Scroll</span>
                  <div className="w-5 h-8 rounded-full border-2 border-white/20 flex justify-center pt-1.5">
                    <motion.div animate={{ y: [0, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1 h-1.5 rounded-full bg-white/40" />
                  </div>
                </motion.div>
              </motion.div>
            </section>

            {/* ========== TRENDING VIDEOS ========== */}
            {displayVideos.length > 0 && (
              <section className="py-20 sm:py-28 px-4 sm:px-6">
                <div className="max-w-6xl mx-auto">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="flex items-center gap-3 mb-10"
                  >
                    <div className="h-8 w-1 rounded-full bg-red-600" />
                    <div>
                      <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">Trending Now</span>
                      <h2 className="text-2xl sm:text-3xl font-bold mt-0.5">What People Are Watching</h2>
                    </div>
                  </motion.div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
                    {displayVideos.map((v, i) => (
                      <VideoCard key={v.videoId} video={v} delay={0.1 + i * 0.12} />
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* ========== FEATURES ========== */}
            <section className="py-20 sm:py-28 px-4 sm:px-6 bg-muted/30">
              <div className="max-w-6xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center mb-14"
                >
                  <span className="text-sm font-semibold text-red-500 uppercase tracking-widest">Why V.I.P Tube?</span>
                  <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-3">
                    Everything You Need, <span className="fire-text">Nothing You Don&apos;t</span>
                  </h2>
                  <p className="text-muted-foreground max-w-lg mx-auto text-sm sm:text-base">
                    Built for video lovers who want the best experience without the noise.
                  </p>
                </motion.div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                  <FeatureCard icon={Shield} title="Zero Ads, Ever" description="No pre-rolls, mid-rolls, or banners. Pure uninterrupted streaming." delay={0.05} />
                  <FeatureCard icon={Zap} title="Lightning Fast" description="Optimized loading with smart caching. Videos start in milliseconds." delay={0.1} />
                  <FeatureCard icon={MonitorPlay} title="Real Videos" description="Watch actual trending videos — real content, real creators." delay={0.15} />
                  <FeatureCard icon={Flame} title="Trending & Fresh" description="Stay updated with latest trending videos across all categories." delay={0.2} />
                  <FeatureCard icon={Search} title="Smart Search" description="Find any video with powerful search and instant suggestions." delay={0.25} />
                  <FeatureCard icon={Heart} title="Save & Organize" description="Like videos, save to Watch Later, build your personal library." delay={0.3} />
                </div>
              </div>
            </section>

            {/* ========== CATEGORIES ========== */}
            <section className="py-20 sm:py-28 px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center mb-12"
                >
                  <span className="text-sm font-semibold text-orange-500 uppercase tracking-widest">Categories</span>
                  <h2 className="text-2xl sm:text-3xl font-bold mt-2 mb-3">Explore Your <span className="fire-text">Interests</span></h2>
                </motion.div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
                  {[
                    { icon: Flame, name: 'Trending', color: '#ef4444' },
                    { icon: Music, name: 'Music', color: '#f97316' },
                    { icon: Gamepad2, name: 'Gaming', color: '#22c55e' },
                    { icon: Newspaper, name: 'News', color: '#3b82f6' },
                    { icon: Globe, name: 'Live', color: '#ef4444' },
                    { icon: Trophy, name: 'Sports', color: '#eab308' },
                    { icon: Sparkles, name: 'Learning', color: '#8b5cf6' },
                    { icon: Star, name: 'Fashion', color: '#ec4899' },
                  ].map((cat, i) => (
                    <motion.button
                      key={cat.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: i * 0.05 }}
                      whileHover={{ scale: 1.1, y: -4 }}
                      onClick={handleExplore}
                      className="flex flex-col items-center gap-2 group cursor-pointer"
                    >
                      <div
                        className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:shadow-lg border border-transparent group-hover:border-current/20"
                        style={{
                          background: `linear-gradient(135deg, ${cat.color}15, ${cat.color}08)`,
                          color: cat.color,
                        }}
                      >
                        <cat.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <span className="text-[11px] sm:text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{cat.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </section>

            {/* ========== STATS ========== */}
            <section className="py-20 sm:py-28 px-4 sm:px-6 bg-muted/30">
              <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 sm:gap-8">
                  {[
                    { icon: Tv, value: 10000, suffix: '+', label: 'Videos Available' },
                    { icon: Globe, value: 50, suffix: '+', label: 'Categories' },
                    { icon: ThumbsUp, value: 100, suffix: '%', label: 'Ad-Free' },
                    { icon: Clock, value: 24, suffix: '/7', label: 'Streaming' },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.08 }}
                      className="text-center"
                    >
                      <stat.icon className="h-5 w-5 text-red-500 mx-auto mb-2" />
                      <div className="text-2xl sm:text-3xl font-bold fire-text">
                        <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{stat.label}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </section>

            {/* ========== FAQ ========== */}
            <section className="py-20 sm:py-28 px-4 sm:px-6">
              <div className="max-w-2xl mx-auto">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  className="text-center mb-12"
                >
                  <span className="text-sm font-semibold text-purple-500 uppercase tracking-widest">FAQ</span>
                  <h2 className="text-2xl sm:text-3xl font-bold mt-2">Got <span className="fire-text">Questions?</span></h2>
                </motion.div>

                <div className="space-y-3">
                  {faqs.map((faq, i) => (
                    <FAQItem key={i} question={faq.q} answer={faq.a} isOpen={faqOpen === i} onToggle={() => toggleFaq(i)} />
                  ))}
                </div>
              </div>
            </section>

            {/* ========== FINAL CTA ========== */}
            <section className="py-24 sm:py-32 px-4 sm:px-6 relative overflow-hidden">
              {/* Background */}
              <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 via-background to-orange-500/5" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-600/5 rounded-full blur-[120px] pointer-events-none" />

              <div className="relative max-w-3xl mx-auto text-center">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6 }}
                >
                  {/* Play button */}
                  <motion.button
                    onClick={handleExplore}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.95 }}
                    className="mx-auto mb-8 h-20 w-20 rounded-full bg-red-600 flex items-center justify-center cursor-pointer shadow-xl shadow-red-600/30 animate-pulse-glow"
                  >
                    <Play className="h-8 w-8 text-white fill-white ml-1" />
                  </motion.button>

                  <h2 className="text-3xl sm:text-5xl font-extrabold mb-4">
                    Ready to <span className="fire-text">Dive In</span>?
                  </h2>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Start watching trending videos right now. No sign-up, no ads, no waiting.
                  </p>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleExplore}
                    className="inline-flex items-center gap-2.5 px-10 py-4 bg-foreground text-background rounded-full text-base font-bold hover:opacity-90 transition-opacity cursor-pointer"
                  >
                    Explore V.I.P Tube Now
                    <ArrowRight className="h-5 w-5" />
                  </motion.button>
                </motion.div>
              </div>
            </section>

            {/* ========== FOOTER ========== */}
            <footer className="border-t py-8 px-4 sm:px-6">
              <div className="max-w-4xl mx-auto">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Flame className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-bold">V.I.P<span className="text-red-500">Tube</span></span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Created by</span>
                    <span className="fire-text font-bold text-lg">Devil</span>
                    <span className="text-sm text-muted-foreground">{'{'}App Developer{'}'}</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span>Made with</span>
                    <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                  </div>
                </div>

                <div className="mt-5 h-px bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />

                <p className="mt-4 text-center text-[11px] text-muted-foreground/40">
                  &copy; {new Date().getFullYear()} V.I.P Tube. All rights reserved. Powered by Devil {'{App Developer}'}
                </p>
              </div>
            </footer>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
