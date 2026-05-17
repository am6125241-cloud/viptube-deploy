'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Shield,
  Users,
  Eye,
  Globe,
  Monitor,
  Smartphone,
  Tablet,
  Clock,
  TrendingUp,
  RefreshCw,
  Trash2,
  LogOut,
  Lock,
  Activity,
  Wifi,
  WifiOff,
  BarChart3,
  AlertTriangle,
  MonitorSmartphone,
  Languages,
  UserCircle,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

/* ================================================================
   ADMIN LOGIN DIALOG
   ================================================================ */
function AdminLoginDialog({ open, onSuccess, onClose }: { open: boolean; onSuccess: (token: string) => void; onClose: () => void }) {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Admin access granted!', { icon: '🔐' });
        onSuccess(data.token);
      } else {
        setError('Wrong password! Try again.');
      }
    } catch {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-red-500" />
            Admin Authentication
          </DialogTitle>
          <DialogDescription>
            Enter the admin password to access the dashboard. Only the admin has permission.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="password"
              placeholder="Enter admin password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              className="pl-10"
            />
          </div>
          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !password.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Shield className="h-4 w-4 mr-2" />
              )}
              Unlock
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================
   DEVICE ICON HELPER
   ================================================================ */
function DeviceIcon({ device }: { device: string }) {
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('android') || d.includes('iphone')) {
    return <Smartphone className="h-4 w-4 text-blue-500" />;
  }
  if (d.includes('tablet') || d.includes('ipad')) {
    return <Tablet className="h-4 w-4 text-purple-500" />;
  }
  return <Monitor className="h-4 w-4 text-green-500" />;
}

/* ================================================================
   ADMIN PANEL DASHBOARD
   ================================================================ */
export default function AdminPanel() {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('viptube-admin-token');
  });
  const [showLogin, setShowLogin] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const queryClient = useQueryClient();

  // Fetch stats
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-stats', adminToken],
    queryFn: async () => {
      const res = await fetch(`/api/admin/stats?token=${adminToken}`);
      if (res.status === 401) {
        setAdminToken(null);
        sessionStorage.removeItem('viptube-admin-token');
        return null;
      }
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    enabled: !!adminToken,
    refetchInterval: 5000, // Auto refresh every 5 seconds
  });

  // Auto-refetch
  const handleRefresh = useCallback(() => {
    refetch();
    toast('Dashboard refreshed', { icon: '🔄' });
  }, [refetch]);

  // Clear data
  const handleClear = async () => {
    try {
      const res = await fetch('/api/admin/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: adminToken }),
      });
      if (res.ok) {
        toast.success('All visitor data cleared!', { icon: '🗑️' });
        refetch();
        setShowClearConfirm(false);
      }
    } catch {
      toast.error('Failed to clear data');
    }
  };

  // Logout
  const handleLogout = () => {
    setAdminToken(null);
    sessionStorage.removeItem('viptube-admin-token');
    toast('Logged out of admin panel', { icon: '🔓' });
  };

  // Login success
  const handleLoginSuccess = (token: string) => {
    setAdminToken(token);
    sessionStorage.setItem('viptube-admin-token', token);
    setShowLogin(false);
  };

  // No token - show login
  if (!adminToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-6">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="relative"
        >
          <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 flex items-center justify-center border border-red-500/20">
            <Shield className="h-12 w-12 text-red-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <Lock className="h-3 w-3 text-white" />
          </div>
        </motion.div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-bold">Admin Dashboard</h2>
          <p className="text-sm text-muted-foreground max-w-sm">
            This panel is restricted to admin only. Enter the password to access real-time visitor analytics.
          </p>
        </div>

        <Button
          onClick={() => setShowLogin(true)}
          className="gap-2 bg-red-600 hover:bg-red-700 text-white px-8 rounded-xl h-11 text-base font-medium"
        >
          <Lock className="h-4 w-4" />
          Unlock Admin Panel
        </Button>

        <AdminLoginDialog
          open={showLogin}
          onSuccess={handleLoginSuccess}
          onClose={() => setShowLogin(false)}
        />
      </div>
    );
  }

  // Authenticated - show dashboard
  const maxDailyVisits = data?.dailyStats ? Math.max(...data.dailyStats.map((d: { visits: number }) => d.visits), 1) : 1;

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Admin Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-xs text-muted-foreground">Real-time visitor analytics & monitoring</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-1.5 rounded-lg">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(true)} className="gap-1.5 rounded-lg text-destructive hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
            Clear Data
          </Button>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5 rounded-lg">
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </Button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 w-fit">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
        </span>
        <span className="text-sm font-medium text-green-700 dark:text-green-400">Live Monitoring</span>
        <span className="text-xs text-muted-foreground ml-1">Auto-refreshes every 5s</span>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : isError || !data ? (
        <Card className="border-destructive/50">
          <CardContent className="py-8 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Failed to load admin data. Session may have expired.</p>
            <Button variant="outline" size="sm" onClick={handleLogout} className="mt-3">Re-login</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-green-500/5 -translate-y-1/2 translate-x-1/2" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <Wifi className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Online Now</span>
                  </div>
                  <p className="text-2xl font-bold">{data.onlineNow}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Active visitors</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-blue-500/5 -translate-y-1/2 translate-x-1/2" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                      <Eye className="h-4 w-4 text-blue-500" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Today</span>
                  </div>
                  <p className="text-2xl font-bold">{data.todayVisits}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{data.todayUniqueVisitors} unique visitors</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-purple-500/5 -translate-y-1/2 translate-x-1/2" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Total Unique</span>
                  </div>
                  <p className="text-2xl font-bold">{data.uniqueVisitors}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">All-time visitors</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
              <Card className="relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 rounded-full bg-orange-500/5 -translate-y-1/2 translate-x-1/2" />
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                      <TrendingUp className="h-4 w-4 text-orange-500" />
                    </div>
                    <span className="text-xs text-muted-foreground font-medium">Total Visits</span>
                  </div>
                  <p className="text-2xl font-bold">{data.totalVisits}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">All-time sessions</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Daily Activity Chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Weekly Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-3 h-40">
                  {data.dailyStats?.map((day: { date: string; visits: number; unique: number }, i: number) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground">{day.visits}</span>
                      <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '100px' }}>
                        <div className="w-full flex gap-0.5" style={{ height: '100px', alignItems: 'flex-end' }}>
                          <div
                            className="flex-1 bg-gradient-to-t from-red-500 to-red-400 rounded-t-md transition-all duration-500"
                            style={{ height: `${(day.visits / maxDailyVisits) * 100}%`, minHeight: day.visits > 0 ? '4px' : '0px' }}
                          />
                        </div>
                      </div>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{day.date}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Device / Browser / OS Stats */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <MonitorSmartphone className="h-4 w-4" />
                    Devices
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {Object.entries(data.deviceStats || {}).sort(([, a]: [string, number], [, b]: [string, number]) => b - a).slice(0, 4).map(([device, count]) => (
                    <div key={device} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DeviceIcon device={device} />
                        <span className="text-sm">{device}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs font-medium">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Browsers
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {Object.entries(data.browserStats || {}).sort(([, a]: [string, number], [, b]: [string, number]) => b - a).slice(0, 4).map(([browser, count]) => (
                    <div key={browser} className="flex items-center justify-between">
                      <span className="text-sm">{browser}</span>
                      <Badge variant="secondary" className="text-xs font-medium">{count}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Registered Users - Name & Email */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <UserCircle className="h-4 w-4 text-blue-500" />
                  Registered Users
                </CardTitle>
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
                  {data.totalRegisteredUsers || 0} users
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {(!data.registeredUsers || data.registeredUsers.length === 0) ? (
                <div className="text-center py-8">
                  <Users className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No registered users yet</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[400px]">
                  <div className="space-y-2">
                    {data.registeredUsers.map((user: { id: string; name: string; email: string; createdAt: string }) => (
                      <motion.div
                        key={user.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                          {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{user.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="text-[11px] text-muted-foreground">{formatTime(user.createdAt)}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Live Online Visitors */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-green-500" />
                  Live Online Visitors
                </CardTitle>
                <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                  {data.onlineNow} online
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {data.onlineVisitors.length === 0 ? (
                <div className="text-center py-8">
                  <WifiOff className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No visitors currently online</p>
                </div>
              ) : (
                <ScrollArea className="max-h-[300px]">
                  <div className="space-y-2">
                    {data.onlineVisitors.map((visitor: {
                      visitorId: string; userName: string; device: string; browser: string; os: string;
                      screenRes: string; language: string; page: string; lastSeenAt: string;
                    }) => {
                      const timeSince = Math.floor((Date.now() - new Date(visitor.lastSeenAt).getTime()) / 1000);
                      const timeText = timeSince < 60 ? `${timeSeconds(timeSince)}s ago` : `${Math.floor(timeSince / 60)}m ago`;
                      const displayName = visitor.userName || 'Anonymous';
                      const isKnownUser = !!visitor.userName;
                      return (
                        <motion.div
                          key={visitor.visitorId}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
                        >
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-bold ${isKnownUser ? 'bg-gradient-to-br from-blue-500 to-purple-500' : 'bg-muted'}`}>
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium truncate">{displayName}</span>
                              {isKnownUser && (
                                <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 text-[9px] px-1.5 py-0">
                                  User
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {visitor.page}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground">{visitor.device}</span>
                              <span className="text-[11px] text-muted-foreground">{visitor.browser}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                            </span>
                            <span className="text-xs text-muted-foreground">{timeText}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>

          {/* Recent Visits */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent Visit History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[350px]">
                <div className="space-y-1.5">
                  {data.recentVisits?.map((visit: {
                    id: string; visitorId: string; userName: string; device: string; browser: string; os: string;
                    page: string; isOnline: boolean; createdAt: string; lastSeenAt: string;
                  }) => {
                    const visitName = visit.userName || 'Anonymous';
                    const isKnown = !!visit.userName;
                    return (
                      <div
                        key={visit.id}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors"
                      >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-bold ${isKnown ? 'bg-gradient-to-br from-blue-500 to-purple-500' : 'bg-muted'}`}>
                        {visitName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{visitName}</span>
                          <span className="text-[10px] text-muted-foreground">· {visit.device}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{visit.page}</span>
                          <span>·</span>
                          <span>{formatTime(visit.createdAt)}</span>
                        </div>
                      </div>
                      {visit.isOnline ? (
                        <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20 text-[10px] gap-1">
                          <Wifi className="h-2.5 w-2.5" /> Online
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <WifiOff className="h-2.5 w-2.5" /> Offline
                        </Badge>
                      )}
                    </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}

      {/* Clear Data Confirmation */}
      <AdminLoginDialog
        open={showLogin}
        onSuccess={handleLoginSuccess}
        onClose={() => setShowLogin(false)}
      />

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Clear All Visitor Data?
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all visitor tracking data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowClearConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleClear} className="flex-1 gap-2">
              <Trash2 className="h-4 w-4" />
              Yes, Clear All
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ================================================================
   HELPERS
   ================================================================ */
function timeSeconds(s: number): string {
  return s.toString();
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}
