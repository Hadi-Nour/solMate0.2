'use client';

import { Button } from '@/components/ui/button';
import { Flag, Handshake, RotateCcw, Undo2, Home, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function GameBottomBar({ 
  onResign, 
  onOfferDraw, 
  onRestart, 
  onUndo, 
  onHome,
  onChat,
  isOnline = false,
  isBotGame = true,
  canUndo = false,
  gameStatus = 'active',
  showChat = false
}) {
  const isGameOver = gameStatus === 'finished';
  
  const actions = [
    { id: 'home', icon: Home, label: 'Home', onClick: onHome, show: true },
    { id: 'resign', icon: Flag, label: 'Resign', onClick: onResign, show: !isGameOver, variant: 'destructive' },
    { id: 'draw', icon: Handshake, label: 'Offer Draw', onClick: onOfferDraw, show: isOnline && !isGameOver },
    { id: 'restart', icon: RotateCcw, label: 'Restart', onClick: onRestart, show: isBotGame },
    { id: 'undo', icon: Undo2, label: 'Undo', onClick: onUndo, show: isBotGame && canUndo && !isGameOver },
    { id: 'chat', icon: MessageCircle, label: 'Chat', onClick: onChat, show: isOnline && showChat },
  ].filter(a => a.show);

  return (
    <TooltipProvider>
      <motion.div 
        className="flex items-center justify-center gap-2 px-4 py-3 bg-card/80 backdrop-blur-lg border-t border-border"
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {actions.map((action) => (
          <Tooltip key={action.id}>
            <TooltipTrigger asChild>
              <Button
                variant={action.variant || 'outline'}
                size="icon"
                onClick={action.onClick}
                className="h-11 w-11 rounded-xl"
              >
                <action.icon className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{action.label}</p>
            </TooltipContent>
          </Tooltip>
        ))}
      </motion.div>
    </TooltipProvider>
  );
}
