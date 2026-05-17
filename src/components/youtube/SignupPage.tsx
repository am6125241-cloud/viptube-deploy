'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flame,
  Mail,
  User,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface UserData {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function SignupPage({ onSignup }: { onSignup: (user: UserData) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => nameInputRef.current?.focus(), 800);
    return () => clearTimeout(timer);
  }, []);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = email.trim().length > 0 && emailRegex.test(email.trim());
  const isNameValid = name.trim().length >= 2;
  const canSubmit = isNameValid && isEmailValid && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (data.success) {
        // Save user to localStorage
        localStorage.setItem('viptube-user', JSON.stringify(data.user));
        setIsVisible(false);
        setTimeout(() => onSignup(data.user), 500);
      } else {
        setError(data.error || 'Something went wrong');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto"
        >
          {/* Background */}
          <div className="fixed inset-0 bg-background">
            <div className="absolute inset-0 bg-gradient-to-br from-red-600/5 via-transparent to-orange-500/5" />
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-orange-500/5 rounded-full blur-[100px] pointer-events-none" />
          </div>

          <div className="relative z-10 w-full max-w-md mx-4 py-8 px-4">
            {/* Logo & Header */}
            <motion.div
              initial={{ opacity: 0, y: -30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-center mb-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.1 }}
                className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 shadow-xl shadow-red-600/30 mb-5"
              >
                <Flame className="h-10 w-10 text-white" />
              </motion.div>

              <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">
                <span className="fire-text">V.I.P Tube</span>
              </h1>
              <p className="text-muted-foreground text-sm">
                Enter your details to start watching unlimited videos
              </p>
            </motion.div>

            {/* Form Card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-lg shadow-black/5"
            >
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <h2 className="text-lg font-bold">Create Account</h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    Your Name
                  </label>
                  <div className="relative">
                    <input
                      ref={nameInputRef}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full h-11 px-4 rounded-xl bg-muted/50 border border-border/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 outline-none transition-all text-sm placeholder:text-muted-foreground/50"
                      autoComplete="name"
                    />
                    {isNameValid && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      </motion.div>
                    )}
                  </div>
                </div>

                {/* Email Input */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email Address
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'email'}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Enter your email"
                      className="w-full h-11 px-4 pr-10 rounded-xl bg-muted/50 border border-border/50 focus:border-red-500/50 focus:ring-2 focus:ring-red-500/10 outline-none transition-all text-sm placeholder:text-muted-foreground/50"
                      autoComplete="email"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20"
                    >
                      <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      <span className="text-xs text-red-500 font-medium">{error}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={!canSubmit}
                  whileHover={canSubmit ? { scale: 1.02, boxShadow: '0 0 30px rgba(239, 68, 68, 0.3)' } : {}}
                  whileTap={canSubmit ? { scale: 0.98 } : {}}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none shadow-lg shadow-red-600/25 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Get Started
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>

              {/* Divider */}
              <div className="mt-6 flex items-center gap-3">
                <div className="flex-1 h-px bg-border/50" />
                <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider">Free Forever</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {/* Benefits */}
              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { label: 'No Ads' },
                  { label: 'HD Videos' },
                  { label: 'Unlimited' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="text-center py-2 rounded-lg bg-muted/30 border border-border/30"
                  >
                    <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Footer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-6 text-center text-[11px] text-muted-foreground/50"
            >
              By continuing, you agree to V.I.P Tube&apos;s Terms of Service
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
