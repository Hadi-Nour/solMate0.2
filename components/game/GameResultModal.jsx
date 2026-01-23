'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Frown, Handshake, Package, Star, Crown, Home, RotateCcw, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n/provider';

export default function GameResultModal({ 
  open, 
  onOpenChange, 
  result, 
  rewards,
  isVipArena,
  onNewGame,
  onGoHome,
  onViewRewards
}) {
  const { t, direction } = useI18n();
  
  const isWin = result === 'player_wins';
  const isDraw = result === 'draw';
  const isLoss = result === 'bot_wins' || result === 'opponent_wins';

  useEffect(() => {
    if (open && isWin) {
      // Trigger confetti on win
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#14F195', '#9945FF', '#FFD700']
      });
    }
  }, [open, isWin]);

  const getResultIcon = () => {
    if (isWin) return <Trophy className="h-16 w-16 text-yellow-500" />;
    if (isDraw) return <Handshake className="h-16 w-16 text-blue-500" />;
    return <Frown className="h-16 w-16 text-red-500" />;
  };

  const getResultText = () => {
    if (isWin) return t('result.victory');
    if (isDraw) return t('result.draw');
    return t('result.defeat');
  };

  const getResultSubtext = () => {
    if (isWin) return t('result.congratulations');
    if (isDraw) return t('result.drawMessage');
    return t('result.betterLuck');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir={direction}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="flex flex-col items-center text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
            className={`p-4 rounded-full mb-4 ${
              isWin ? 'bg-yellow-500/20' : isDraw ? 'bg-blue-500/20' : 'bg-red-500/20'
            }`}
          >
            {getResultIcon()}
          </motion.div>
          
          <DialogHeader>
            <DialogTitle className={`text-3xl font-bold ${
              isWin ? 'text-yellow-500' : isDraw ? 'text-blue-500' : 'text-red-500'
            }`}>
              {getResultText()}
            </DialogTitle>
            <DialogDescription className="text-base">
              {getResultSubtext()}
            </DialogDescription>
          </DialogHeader>

          {/* Rewards Section */}
          {isVipArena && rewards && (isWin || rewards.bronzeChest > 0 || rewards.silverChest > 0 || rewards.goldPoints > 0) && (
            <motion.div 
              className="w-full mt-4 p-4 rounded-xl bg-secondary/50 space-y-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <h3 className="font-semibold text-sm flex items-center justify-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                {t('rewards.title')}
              </h3>
              <div className="flex justify-center gap-4">
                {rewards.bronzeChest > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl">🟤</span>
                    <span className="text-xs text-muted-foreground">+{rewards.bronzeChest}</span>
                  </div>
                )}
                {rewards.silverChest > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="text-2xl">⚪</span>
                    <span className="text-xs text-muted-foreground">+{rewards.silverChest}</span>
                  </div>
                )}
                {rewards.goldPoints > 0 && (
                  <div className="flex flex-col items-center">
                    <Star className="h-6 w-6 text-yellow-500" />
                    <span className="text-xs text-muted-foreground">+{rewards.goldPoints}</span>
                  </div>
                )}
              </div>
              
              {/* Streak info */}
              {rewards.newStreak !== undefined && (
                <div className="text-xs text-center text-muted-foreground">
                  {rewards.streakReset ? (
                    <span className="text-red-400">{t('rewards.streakReset')}</span>
                  ) : (
                    <span className="text-primary">{t('rewards.currentStreak', { count: rewards.newStreak })} 🔥</span>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-6 w-full">
            <Button variant="outline" className="flex-1" onClick={onGoHome}>
              <Home className="h-4 w-4 me-2" />
              {t('gameActions.home')}
            </Button>
            <Button className="flex-1 solana-gradient text-black" onClick={onNewGame}>
              <RotateCcw className="h-4 w-4 me-2" />
              {t('gameActions.playAgain')}
            </Button>
          </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
