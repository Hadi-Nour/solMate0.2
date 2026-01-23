'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Globe, Crown, Clock, Users, X, Wifi, Loader2 } from 'lucide-react';
import { connectSocket, getSocket, joinQueue, leaveQueue } from '@/lib/socket/client';
import { toast } from 'sonner';

const TIME_CONTROLS = [
  { id: 3, name: '3 min', desc: 'Bullet', icon: '⚡' },
  { id: 5, name: '5 min', desc: 'Blitz', icon: '🔥' },
  { id: 10, name: '10 min', desc: 'Rapid', icon: '⏱️' },
];

export default function MatchmakingScreen({ 
  authToken, 
  isVip, 
  onMatchFound, 
  onCancel 
}) {
  const [selectedTime, setSelectedTime] = useState(null);
  const [isVipArena, setIsVipArena] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTime, setSearchTime] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Connect socket
    const socket = connectSocket(authToken);
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      console.log('Socket connected for matchmaking');
    };

    const handleDisconnect = () => {
      setIsConnected(false);
      setIsSearching(false);
    };

    const handleQueueJoined = ({ timeControl, isVipArena: vip, position }) => {
      setIsSearching(true);
      toast.success(`Searching for ${vip ? 'VIP Arena' : 'casual'} match...`);
    };

    const handleQueueLeft = () => {
      setIsSearching(false);
      setSearchTime(0);
    };

    const handleMatchFound = ({ matchId, yourColor, opponent, match }) => {
      setIsSearching(false);
      setSearchTime(0);
      toast.success('Match found!');
      onMatchFound({ matchId, yourColor, opponent, match });
    };

    const handleError = ({ message }) => {
      toast.error(message);
      setIsSearching(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('queue:joined', handleQueueJoined);
    socket.on('queue:left', handleQueueLeft);
    socket.on('match:found', handleMatchFound);
    socket.on('error', handleError);

    // Check if already connected - use initialization instead of setState in effect body
    const checkInitialConnection = () => {
      if (socket.connected) {
        handleConnect();
      }
    };
    // Defer to avoid setState during render
    const timeoutId = setTimeout(checkInitialConnection, 0);

    return () => {
      clearTimeout(timeoutId);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('queue:joined', handleQueueJoined);
      socket.off('queue:left', handleQueueLeft);
      socket.off('match:found', handleMatchFound);
      socket.off('error', handleError);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [authToken, onMatchFound]);

  useEffect(() => {
    if (isSearching) {
      timerRef.current = setInterval(() => {
        setSearchTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isSearching]);

  const handleStartSearch = (timeControl, vip) => {
    if (!isConnected) {
      toast.error('Not connected to server');
      return;
    }
    if (vip && !isVip) {
      toast.error('VIP membership required');
      return;
    }
    
    setSelectedTime(timeControl);
    setIsVipArena(vip);
    joinQueue(timeControl, vip);
  };

  const handleCancelSearch = () => {
    leaveQueue();
    setIsSearching(false);
    setSearchTime(0);
  };

  const formatSearchTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Searching view
  if (isSearching) {
    return (
      <motion.div 
        className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-4">
              <motion.div
                className="w-20 h-20 rounded-full border-4 border-primary border-t-transparent mx-auto"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
            <CardTitle className="flex items-center justify-center gap-2">
              <Globe className="h-5 w-5" />
              Finding Opponent...
            </CardTitle>
            <CardDescription>
              {isVipArena ? 'VIP Arena' : 'Casual'} • {selectedTime} min
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-mono font-bold text-primary">
              {formatSearchTime(searchTime)}
            </div>
            
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Wifi className="h-4 w-4 text-green-500" />
              <span>Connected to server</span>
            </div>
            
            <Button variant="outline" className="w-full" onClick={handleCancelSearch}>
              <X className="h-4 w-4 mr-2" />
              Cancel Search
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  // Selection view
  return (
    <motion.div 
      className="min-h-screen bg-background p-4 pb-24"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Play Online</h1>
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
        </div>
      </div>

      {/* Free Casual */}
      <Card className="mb-4 overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-blue-500" />
            Casual Match
            <Badge variant="secondary" className="text-[10px]">Free</Badge>
          </CardTitle>
          <CardDescription>Play against real players - no rewards</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {TIME_CONTROLS.map((tc) => (
              <motion.div key={tc.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="outline"
                  className="w-full h-20 flex-col gap-1 hover:border-blue-500/50 hover:bg-blue-500/10"
                  onClick={() => handleStartSearch(tc.id, false)}
                  disabled={!isConnected}
                >
                  <span className="text-xl">{tc.icon}</span>
                  <span className="font-bold">{tc.name}</span>
                  <span className="text-[10px] text-muted-foreground">{tc.desc}</span>
                </Button>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* VIP Arena */}
      <Card className={`overflow-hidden border-0 shadow-xl bg-gradient-to-br from-yellow-500/10 to-amber-600/5 ${
        !isVip ? 'opacity-60' : ''
      }`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            VIP Arena
            <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px]">Ranked</Badge>
          </CardTitle>
          <CardDescription>
            {isVip ? 'Compete for rewards and climb the leaderboard!' : 'VIP membership required'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isVip ? (
            <div className="grid grid-cols-3 gap-2">
              {TIME_CONTROLS.map((tc) => (
                <motion.div key={tc.id} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button
                    variant="outline"
                    className="w-full h-20 flex-col gap-1 border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/10"
                    onClick={() => handleStartSearch(tc.id, true)}
                    disabled={!isConnected}
                  >
                    <span className="text-xl">{tc.icon}</span>
                    <span className="font-bold">{tc.name}</span>
                    <span className="text-[10px] text-muted-foreground">{tc.desc}</span>
                  </Button>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <Crown className="h-12 w-12 text-yellow-500/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Unlock VIP for ranked matches with rewards</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info */}
      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p className="mb-1">🏆 VIP wins earn Bronze Chests</p>
        <p>🔥 5-win streak = Silver Chest + Gold Point</p>
      </div>
    </motion.div>
  );
}
