'use client';

import { motion } from 'framer-motion';
import { Flame } from 'lucide-react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
      onAnimationComplete={onComplete}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background"
    >
      {/* Background subtle radial glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-red-500/[0.04] blur-3xl" />
      </div>

      {/* Logo area */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="relative flex flex-col items-center"
      >
        {/* Pulsing flame icon */}
        <motion.div
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.7, 1, 0.7],
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="mb-6"
        >
          <div className="relative">
            <Flame className="h-16 w-16 text-red-500" />
            {/* Glow ring */}
            <motion.div
              animate={{
                scale: [1, 1.4, 1],
                opacity: [0.3, 0, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute inset-0 rounded-full border-2 border-red-500/30"
            />
          </div>
        </motion.div>

        {/* V.I.P Tube text */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2 display-font"
        >
          <span className="text-foreground">V.I.P</span>
          <span className="fire-text">Tube</span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-sm text-muted-foreground tracking-widest uppercase"
        >
          Ad-Free Video Streaming
        </motion.p>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.8 }}
        className="mt-12 w-48 sm:w-64"
      >
        {/* Track */}
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          {/* Fill */}
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{
              duration: 2.2,
              delay: 0.5,
              ease: [0.4, 0, 0.2, 1],
            }}
            className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-500 to-red-600"
          />
        </div>

        {/* Loading text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: 1,
          }}
          className="text-[11px] text-muted-foreground/50 text-center mt-3 tracking-wide"
        >
          Loading your experience...
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
