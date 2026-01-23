'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Settings, Clock, Wifi, WifiOff, Bot, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n/provider';

export default function GameTopBar({ 
  onBack, 
  gameMode, 
  difficulty, 
  isVipArena, 
  isOnline,
  opponentName,
  timeLeft,
  isMyTurn,
  onSettings 
}) {
  const { t, direction } = useI18n();

  const formatTime = (seconds) => {
    if (!seconds && seconds !== 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get translated difficulty name
  const getDifficultyName = (diff) => {
    const key = `difficulty.${diff}`;
    return t(key);
  };

  return (
    <motion.div 
      className="flex items-center justify-between px-3 py-2 bg-card/80 backdrop-blur-lg border-b border-border"
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      dir={direction}
    >
      {/* Left: Back button */}
      <Button 
        variant="ghost" 
        size="icon" 
        onClick={onBack}
        className="h-9 w-9"
      >
        <ArrowLeft className="h-5 w-5" />
      </Button>
      
      {/* Center: Match info */}
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4 text-green-500" />
            <span className="font-medium text-sm">{opponentName || t('game.opponent')}</span>
          </>
        ) : (
          <>
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{getDifficultyName(difficulty)} {t('game.bot')}</span>
          </>
        )}
        
        {isVipArena && (
          <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[10px] px-1.5 py-0">
            {t('common.vip')}
          </Badge>
        )}
      </div>
      
      {/* Right: Timer & Settings */}
      <div className="flex items-center gap-1">
        {timeLeft !== undefined && (
          <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-sm font-mono ${
            isMyTurn ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
          }`}>
            <Clock className="h-3.5 w-3.5" />
            <span>{formatTime(timeLeft)}</span>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={onSettings}
          className="h-9 w-9"
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </motion.div>
  );
}
