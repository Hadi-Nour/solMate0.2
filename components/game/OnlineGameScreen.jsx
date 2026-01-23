'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Wifi, WifiOff, Clock, Flag, Handshake, Home, X, User, AlertTriangle, Infinity } from 'lucide-react';
import ChessBoard3D from '@/components/chess/ChessBoard3D';
import GameResultModal from '@/components/game/GameResultModal';
import QuickChat from '@/components/game/QuickChat';
import { getSocket, makeMove as socketMakeMove, resign as socketResign, offerDraw, acceptDraw, declineDraw } from '@/lib/socket/client';

export default function OnlineGameScreen({ 
  matchData, 
  yourColor, 
  onExit,
  settings,
  authToken,
  onGameEnd
}) {
  const [chess, setChess] = useState(() => new Chess(matchData.fen));
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [lastMove, setLastMove] = useState(null);
  const [timeLeft, setTimeLeft] = useState(matchData.timeLeft);
  const [currentTurn, setCurrentTurn] = useState(matchData.currentTurn);
  const [isConnected, setIsConnected] = useState(true);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameRewards, setGameRewards] = useState(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showDrawOffer, setShowDrawOffer] = useState(false);
  const [drawOfferedBy, setDrawOfferedBy] = useState(null);
  const [moveHistory, setMoveHistory] = useState(matchData.moves?.map(m => m.san) || []);
  
  const matchId = matchData.id;
  const opponent = yourColor === 'white' ? matchData.players.black : matchData.players.white;
  const isMyTurn = currentTurn === yourColor;
  
  const socketRef = useRef(null);

  // Define playSound with useCallback before the effect that uses it
  const playSound = useCallback((type) => {
    if (!settings?.soundEnabled) return;
    if (settings?.hapticEnabled && navigator.vibrate) {
      switch(type) {
        case 'move': navigator.vibrate(10); break;
        case 'capture': navigator.vibrate([20, 10, 20]); break;
        case 'check': navigator.vibrate([50, 30, 50]); break;
        case 'win': navigator.vibrate([100, 50, 100, 50, 100]); break;
        default: break;
      }
    }
  }, [settings?.soundEnabled, settings?.hapticEnabled]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socketRef.current = socket;

    // Socket event handlers
    const handleMoved = ({ move, fen, timeLeft: newTime, currentTurn: turn, isCheck }) => {
      setChess(new Chess(fen));
      setTimeLeft(newTime);
      setCurrentTurn(turn);
      setLastMove({ from: move.from, to: move.to });
      setSelectedSquare(null);
      setValidMoves([]);
      setMoveHistory(prev => [...prev, move.san]);
      
      if (isCheck) {
        playSound('check');
      } else if (move.captured) {
        playSound('capture');
      } else {
        playSound('move');
      }
    };

    const handleTimeUpdate = ({ timeLeft: newTime, currentTurn: turn }) => {
      setTimeLeft(newTime);
      setCurrentTurn(turn);
    };

    const handleEnded = ({ result, reason, winner, youWon, rewards, finalState }) => {
      setChess(new Chess(finalState.fen));
      setGameResult(youWon ? 'player_wins' : result === 'draw' ? 'draw' : 'opponent_wins');
      setGameRewards(rewards);
      setShowResultModal(true);
      
      if (youWon) playSound('win');
      else if (result !== 'draw') playSound('lose');
      
      onGameEnd?.(result, rewards);
    };

    const handleOpponentDisconnected = () => {
      setOpponentDisconnected(true);
      toast.warning('Opponent disconnected. Waiting for reconnection...');
    };

    const handleOpponentReconnected = () => {
      setOpponentDisconnected(false);
      toast.success('Opponent reconnected!');
    };

    const handleDrawOffered = ({ from }) => {
      setDrawOfferedBy(from);
      setShowDrawOffer(true);
    };

    const handleDrawDeclined = () => {
      toast.info('Draw offer declined');
    };

    const handleError = ({ message }) => {
      toast.error(message);
    };

    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socket.on('match:moved', handleMoved);
    socket.on('match:time_update', handleTimeUpdate);
    socket.on('match:ended', handleEnded);
    socket.on('opponent:disconnected', handleOpponentDisconnected);
    socket.on('opponent:reconnected', handleOpponentReconnected);
    socket.on('match:draw_offered', handleDrawOffered);
    socket.on('match:draw_declined', handleDrawDeclined);
    socket.on('error', handleError);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('match:moved', handleMoved);
      socket.off('match:time_update', handleTimeUpdate);
      socket.off('match:ended', handleEnded);
      socket.off('opponent:disconnected', handleOpponentDisconnected);
      socket.off('opponent:reconnected', handleOpponentReconnected);
      socket.off('match:draw_offered', handleDrawOffered);
      socket.off('match:draw_declined', handleDrawDeclined);
      socket.off('error', handleError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
    };
  }, [playSound, onGameEnd]);

  const handleSquareClick = (square) => {
    if (!isMyTurn || showResultModal) return;
    
    const piece = chess.get(square);
    const myColorChar = yourColor === 'white' ? 'w' : 'b';
    
    if (selectedSquare) {
      if (validMoves.includes(square)) {
        // Make the move
        let promotion;
        const movingPiece = chess.get(selectedSquare);
        if (movingPiece?.type === 'p') {
          const targetRank = yourColor === 'white' ? '8' : '1';
          if (square[1] === targetRank) promotion = 'q';
        }
        
        socketMakeMove(matchId, selectedSquare, square, promotion);
        setSelectedSquare(null);
        setValidMoves([]);
      } else if (piece && piece.color === myColorChar) {
        setSelectedSquare(square);
        setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to));
        playSound('select');
      } else {
        setSelectedSquare(null);
        setValidMoves([]);
      }
    } else if (piece && piece.color === myColorChar) {
      setSelectedSquare(square);
      setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to));
      playSound('select');
    }
  };

  const handleResign = () => {
    socketResign(matchId);
  };

  const handleOfferDraw = () => {
    offerDraw(matchId);
    toast.info('Draw offer sent');
  };

  const handleAcceptDraw = () => {
    acceptDraw(matchId);
    setShowDrawOffer(false);
  };

  const handleDeclineDraw = () => {
    declineDraw(matchId);
    setShowDrawOffer(false);
  };

  const handleExit = () => {
    if (!showResultModal) {
      setShowExitConfirm(true);
    } else {
      onExit();
    }
  };

  const confirmExit = () => {
    // Resign if game is still active
    if (!showResultModal) {
      socketResign(matchId);
    }
    onExit();
  };

  const formatTime = (ms) => {
    if (ms <= 0) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeClass = (ms) => {
    if (ms <= 10000) return 'text-red-500 animate-pulse';
    if (ms <= 30000) return 'text-orange-500';
    return 'text-foreground';
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-card/80 backdrop-blur-lg border-b border-border">
        <Button variant="ghost" size="icon" onClick={handleExit}>
          <X className="h-5 w-5" />
        </Button>
        
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="h-4 w-4 text-green-500" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-500 animate-pulse" />
          )}
          <span className="font-medium text-sm">
            vs {opponent.wallet.slice(0, 6)}...
          </span>
          {matchData.isVipArena && (
            <Badge className="bg-yellow-500/20 text-yellow-500 text-[10px]">VIP</Badge>
          )}
        </div>
        
        <div className="w-9" /> {/* Spacer for alignment */}
      </div>

      {/* Opponent Timer */}
      <div className={`flex justify-center py-2 ${currentTurn !== yourColor ? 'bg-primary/10' : 'bg-muted/50'}`}>
        <div className={`flex items-center gap-2 px-4 py-1 rounded-full ${currentTurn !== yourColor ? 'bg-primary/20' : 'bg-muted'}`}>
          <User className="h-4 w-4" />
          <span className="text-sm font-mono">
            Opponent
          </span>
          <span className={`font-mono font-bold ${getTimeClass(timeLeft[yourColor === 'white' ? 'black' : 'white'])}`}>
            {formatTime(timeLeft[yourColor === 'white' ? 'black' : 'white'])}
          </span>
        </div>
      </div>

      {/* Opponent disconnected banner */}
      {opponentDisconnected && (
        <motion.div 
          className="bg-orange-500/20 text-orange-500 text-center py-2 text-sm"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="inline h-4 w-4 mr-2" />
          Opponent disconnected. Waiting 20s for reconnection...
        </motion.div>
      )}

      {/* Board */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <ChessBoard3D
          chess={chess}
          gameState={{ playerColor: yourColor === 'white' ? 'w' : 'b', status: showResultModal ? 'finished' : 'active' }}
          selectedSquare={selectedSquare}
          validMoves={validMoves}
          onSquareClick={handleSquareClick}
          isThinking={false}
          lastMove={lastMove}
          boardTheme={settings?.boardTheme || 'classic'}
          showLegalMoves={settings?.showLegalMoves !== false}
        />
        
        {/* Move history */}
        <div className="w-full max-w-[400px] mt-4">
          <div className="h-12 rounded-lg bg-secondary/50 p-2 overflow-x-auto">
            <div className="flex gap-1 text-xs font-mono whitespace-nowrap">
              {moveHistory.map((move, i) => (
                <span key={i} className={i % 2 === 0 ? 'text-foreground' : 'text-muted-foreground'}>
                  {i % 2 === 0 && <span className="text-primary mr-1">{Math.floor(i/2) + 1}.</span>}
                  {move}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Your Timer */}
      <div className={`flex justify-center py-2 ${isMyTurn ? 'bg-primary/10' : 'bg-muted/50'}`}>
        <div className={`flex items-center gap-2 px-4 py-1 rounded-full ${isMyTurn ? 'bg-primary/20' : 'bg-muted'}`}>
          <span className="text-sm font-medium">
            {isMyTurn ? '✨ Your turn' : 'Waiting...'}
          </span>
          <span className={`font-mono font-bold text-lg ${getTimeClass(timeLeft[yourColor])}`}>
            {formatTime(timeLeft[yourColor])}
          </span>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-card/80 backdrop-blur-lg border-t border-border">
        <Button variant="outline" size="sm" onClick={handleExit}>
          <Home className="h-4 w-4 mr-1" /> Exit
        </Button>
        <Button variant="outline" size="sm" onClick={handleOfferDraw}>
          <Handshake className="h-4 w-4 mr-1" /> Draw
        </Button>
        <Button variant="destructive" size="sm" onClick={handleResign}>
          <Flag className="h-4 w-4 mr-1" /> Resign
        </Button>
      </div>

      {/* Draw Offer Modal */}
      <Dialog open={showDrawOffer} onOpenChange={setShowDrawOffer}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Draw Offered
            </DialogTitle>
            <DialogDescription>
              Your opponent is offering a draw. Do you accept?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={handleDeclineDraw} className="flex-1">
              Decline
            </Button>
            <Button onClick={handleAcceptDraw} className="flex-1">
              Accept
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Exit Confirm Modal */}
      <Dialog open={showExitConfirm} onOpenChange={setShowExitConfirm}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Leave Match?
            </DialogTitle>
            <DialogDescription>
              Leaving will count as a resignation. You will lose this game.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowExitConfirm(false)} className="flex-1">
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmExit} className="flex-1">
              Leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Modal */}
      <GameResultModal
        open={showResultModal}
        onOpenChange={setShowResultModal}
        result={gameResult}
        rewards={gameRewards}
        isVipArena={matchData.isVipArena}
        onNewGame={() => { setShowResultModal(false); onExit(); }}
        onGoHome={() => { setShowResultModal(false); onExit(); }}
      />
    </div>
  );
}
