'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Gamepad2, Trophy, Package, Users, User, Crown, Swords, ChevronRight, 
  Sparkles, Star, Copy, Check, Flag, Wallet, Wifi, Bot, Clock, Eye, 
  Gift, Home, RotateCcw, Settings, Palette, Volume2, ArrowLeft, Globe
} from 'lucide-react';
import ChessBoard3D from '@/components/chess/ChessBoard3D';
import GameTopBar from '@/components/game/GameTopBar';
import GameBottomBar from '@/components/game/GameBottomBar';
import GameResultModal from '@/components/game/GameResultModal';
import ExitConfirmModal from '@/components/game/ExitConfirmModal';
import SettingsModal from '@/components/game/SettingsModal';

// Dynamic imports for online components
const MatchmakingScreen = dynamic(() => import('@/components/game/MatchmakingScreen'), { ssr: false });
const OnlineGameScreen = dynamic(() => import('@/components/game/OnlineGameScreen'), { ssr: false });

const DIFFICULTIES = [
  { id: 'easy', name: 'Easy', desc: 'Perfect for beginners', color: 'bg-green-500', icon: '🌱' },
  { id: 'normal', name: 'Normal', desc: 'Balanced challenge', color: 'bg-blue-500', icon: '⚔️' },
  { id: 'hard', name: 'Hard', desc: 'For experienced players', color: 'bg-orange-500', icon: '🔥' },
  { id: 'pro', name: 'Pro', desc: 'Maximum difficulty', color: 'bg-red-500', icon: '💀' },
];

const TIME_CONTROLS = [
  { id: 3, name: '3 min', desc: 'Bullet' },
  { id: 5, name: '5 min', desc: 'Blitz' },
  { id: 10, name: '10 min', desc: 'Rapid' },
];

export default function SolMate() {
  // Auth state
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [walletAddress, setWalletAddress] = useState('');
  
  // Game state
  const [activeTab, setActiveTab] = useState('play');
  const [gameState, setGameState] = useState(null);
  const [chess, setChess] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [lastMove, setLastMove] = useState(null);
  const [moveHistory, setMoveHistory] = useState([]);
  
  // Online game state
  const [showMatchmaking, setShowMatchmaking] = useState(false);
  const [onlineMatch, setOnlineMatch] = useState(null);
  
  // UI state
  const [showVipDialog, setShowVipDialog] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameRewards, setGameRewards] = useState(null);
  
  // Settings
  const [settings, setSettings] = useState({
    soundEnabled: true,
    hapticEnabled: true,
    showLegalMoves: true,
    boardTheme: 'classic'
  });
  
  // Social state
  const [friendCode, setFriendCode] = useState('');
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('solmate_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    const token = localStorage.getItem('solmate_token');
    if (token) { setAuthToken(token); fetchUser(token); }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('solmate_settings', JSON.stringify(settings));
  }, [settings]);

  const fetchUser = async (token) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setUser((await res.json()).user); }
      else { localStorage.removeItem('solmate_token'); setAuthToken(null); }
    } catch (e) { console.error('Failed to fetch user:', e); }
  };

  // Wallet functions
  const connectWallet = async () => {
    try {
      if (typeof window !== 'undefined' && window.solana?.isPhantom) {
        const response = await window.solana.connect();
        setWalletAddress(response.publicKey.toString());
        toast.success('Wallet connected!');
      } else {
        window.open('https://phantom.app/', '_blank');
        toast.info('Please install Phantom wallet');
      }
    } catch (e) { toast.error('Failed to connect wallet'); }
  };

  const signIn = async () => {
    if (!walletAddress) { toast.error('Connect wallet first'); return; }
    try {
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress })
      });
      const { nonce, messageToSign } = await nonceRes.json();
      const encodedMessage = new TextEncoder().encode(messageToSign);
      const signedMessage = await window.solana.signMessage(encodedMessage, 'utf8');
      const signature = btoa(String.fromCharCode(...signedMessage.signature));
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, nonce, signature })
      });
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        setAuthToken(data.token); setUser(data.user);
        localStorage.setItem('solmate_token', data.token);
        toast.success('Signed in!');
      } else { toast.error((await verifyRes.json()).error || 'Sign in failed'); }
    } catch (e) { toast.error('Sign in failed: ' + e.message); }
  };

  const signOut = () => {
    localStorage.removeItem('solmate_token');
    setAuthToken(null); setUser(null); setGameState(null); setChess(null); setWalletAddress('');
    if (window.solana) window.solana.disconnect();
    toast.success('Signed out');
  };

  // Game functions
  const startBotGame = async (difficulty, isVipArena = false) => {
    if (isVipArena && !user?.isVip) { setShowVipDialog(true); return; }
    try {
      const res = await fetch('/api/game/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ difficulty, isVipArena })
      });
      const data = await res.json();
      if (res.ok) {
        setGameState(data); 
        setChess(new Chess(data.fen));
        setSelectedSquare(null); 
        setValidMoves([]);
        setLastMove(null);
        setMoveHistory([]);
        setGameResult(null);
        setGameRewards(null);
        playSound('start');
        toast.success(`You're playing as ${data.playerColor === 'w' ? 'White' : 'Black'}`);
      } else { toast.error(data.error); }
    } catch (e) { toast.error('Failed to start game'); }
  };

  const handleSquareClick = async (square) => {
    if (!chess || !gameState || gameState.status === 'finished' || isThinking) return;
    if (chess.turn() !== gameState.playerColor) return;
    
    const piece = chess.get(square);
    
    if (selectedSquare) {
      if (validMoves.includes(square)) { 
        await makeMove(selectedSquare, square); 
      }
      else if (piece && piece.color === chess.turn()) { 
        setSelectedSquare(square); 
        setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to)); 
        playSound('select');
      }
      else { 
        setSelectedSquare(null); 
        setValidMoves([]); 
      }
    } else if (piece && piece.color === chess.turn()) { 
      setSelectedSquare(square); 
      setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to)); 
      playSound('select');
    }
  };

  const makeMove = async (from, to) => {
    setIsThinking(true);
    try {
      const piece = chess.get(from);
      const promotion = piece?.type === 'p' && to[1] === (gameState.playerColor === 'w' ? '8' : '1') ? 'q' : undefined;
      
      const res = await fetch('/api/game/bot/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ gameId: gameState.gameId, from, to, promotion })
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        const newChess = new Chess(data.fen);
        setChess(newChess);
        setSelectedSquare(null);
        setValidMoves([]);
        
        // Update last move for highlighting
        if (data.botMove) {
          setLastMove({ from: data.botMove.from, to: data.botMove.to });
        } else {
          setLastMove({ from, to });
        }
        
        // Add to move history
        setMoveHistory(prev => [...prev, data.playerMove?.san, data.botMove?.san].filter(Boolean));
        
        // Play appropriate sound
        if (data.playerMove?.captured) playSound('capture');
        else playSound('move');
        
        if (newChess.isCheck()) playSound('check');
        
        if (data.isGameOver) {
          setGameResult(data.result);
          setGameRewards(data.rewards);
          setGameState({ ...gameState, status: 'finished', result: data.result });
          setShowResultModal(true);
          
          if (data.result === 'player_wins') playSound('win');
          else if (data.result === 'bot_wins') playSound('lose');
          
          if (authToken) fetchUser(authToken);
        }
      } else { 
        toast.error(data.error || 'Invalid move'); 
        playSound('error');
      }
    } catch (e) { toast.error('Failed to make move'); }
    finally { setIsThinking(false); }
  };

  const handleResign = async () => {
    if (!gameState || gameState.status === 'finished') return;
    await fetch('/api/game/bot/resign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
      body: JSON.stringify({ gameId: gameState.gameId })
    });
    setGameResult('bot_wins');
    setGameState({ ...gameState, status: 'finished', result: 'bot_wins' });
    setShowResultModal(true);
    playSound('lose');
    if (authToken) fetchUser(authToken);
  };

  const handleRestart = () => {
    if (gameState) {
      startBotGame(gameState.difficulty, gameState.isVipArena);
    }
  };

  const handleExitGame = () => {
    setShowExitConfirm(true);
  };

  const confirmExit = () => {
    setGameState(null);
    setChess(null);
    setSelectedSquare(null);
    setValidMoves([]);
    setLastMove(null);
    setShowExitConfirm(false);
    setShowResultModal(false);
  };

  // Sound functions
  const playSound = (type) => {
    if (!settings.soundEnabled) return;
    // In a real app, you'd play actual sounds here
    if (settings.hapticEnabled && navigator.vibrate) {
      switch(type) {
        case 'move': navigator.vibrate(10); break;
        case 'capture': navigator.vibrate([20, 10, 20]); break;
        case 'check': navigator.vibrate([50, 30, 50]); break;
        case 'win': navigator.vibrate([100, 50, 100, 50, 100]); break;
        default: break;
      }
    }
  };

  // Social functions
  const loadFriends = async () => { 
    if (authToken) { 
      const r = await fetch('/api/friends', { headers: { Authorization: `Bearer ${authToken}` } }); 
      if (r.ok) setFriends((await r.json()).friends || []); 
    } 
  };
  
  const addFriend = async () => { 
    if (!friendCode || !authToken) return; 
    const r = await fetch('/api/friends/add', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, 
      body: JSON.stringify({ friendCode }) 
    }); 
    if (r.ok) { toast.success('Friend added!'); setFriendCode(''); loadFriends(); } 
    else toast.error((await r.json()).error); 
  };
  
  const loadLeaderboard = async () => { 
    const r = await fetch('/api/leaderboard?period=all'); 
    if (r.ok) setLeaderboard((await r.json()).leaderboard || []); 
  };
  
  const openChest = async (type) => { 
    if (!authToken) return; 
    const r = await fetch('/api/inventory/open-chest', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, 
      body: JSON.stringify({ chestType: type, count: 1 }) 
    }); 
    if (r.ok) { 
      const data = await r.json();
      toast.success(`Got ${data.rewards.length} item(s)!`); 
      fetchUser(authToken); 
    } 
    else toast.error((await r.json()).error); 
  };
  
  const redeemGold = async () => { 
    if (!authToken || user?.goldPoints < 5) return; 
    const r = await fetch('/api/inventory/redeem-gold', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, 
      body: JSON.stringify({ count: 1 }) 
    }); 
    if (r.ok) { toast.success('Got 1 Gold Chest!'); fetchUser(authToken); } 
  };
  
  const copyCode = () => { 
    if (user?.friendCode) { 
      navigator.clipboard.writeText(user.friendCode); 
      setCopiedCode(true); 
      setTimeout(() => setCopiedCode(false), 2000); 
    } 
  };

  useEffect(() => { 
    if (activeTab === 'friends') loadFriends(); 
    if (activeTab === 'profile') loadLeaderboard(); 
  }, [activeTab, authToken]);

  // Navigation tabs
  const tabs = [
    { id: 'play', icon: Gamepad2, label: 'Play' },
    { id: 'vip', icon: Crown, label: 'VIP' },
    { id: 'inventory', icon: Package, label: 'Items' },
    { id: 'friends', icon: Users, label: 'Friends' },
    { id: 'profile', icon: User, label: 'Profile' }
  ];

  // Render game screen
  if (gameState && chess) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <GameTopBar 
          onBack={handleExitGame}
          gameMode={gameState.isVipArena ? 'vip' : 'free'}
          difficulty={gameState.difficulty}
          isVipArena={gameState.isVipArena}
          isOnline={false}
          isMyTurn={chess.turn() === gameState.playerColor}
          onSettings={() => setShowSettings(true)}
        />
        
        <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
          {/* Turn indicator */}
          <motion.div 
            className={`px-4 py-2 rounded-full text-sm font-medium ${
              chess.turn() === gameState.playerColor 
                ? 'bg-primary/20 text-primary' 
                : 'bg-muted text-muted-foreground'
            }`}
            animate={{ scale: chess.turn() === gameState.playerColor ? [1, 1.05, 1] : 1 }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {isThinking ? '🤔 Bot thinking...' : chess.turn() === gameState.playerColor ? '✨ Your turn' : "⏳ Bot's turn"}
          </motion.div>
          
          {/* Chess Board */}
          <ChessBoard3D 
            chess={chess}
            gameState={gameState}
            selectedSquare={selectedSquare}
            validMoves={validMoves}
            onSquareClick={handleSquareClick}
            isThinking={isThinking}
            lastMove={lastMove}
            boardTheme={settings.boardTheme}
            showLegalMoves={settings.showLegalMoves}
          />
          
          {/* Move history */}
          <div className="w-full max-w-[400px]">
            <ScrollArea className="h-16 rounded-lg bg-secondary/50 p-2">
              <div className="flex flex-wrap gap-1 text-xs font-mono">
                {moveHistory.map((move, i) => (
                  <span key={i} className={i % 2 === 0 ? 'text-foreground' : 'text-muted-foreground'}>
                    {i % 2 === 0 && <span className="text-primary mr-1">{Math.floor(i/2) + 1}.</span>}
                    {move}
                  </span>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
        
        <GameBottomBar 
          onResign={handleResign}
          onRestart={handleRestart}
          onHome={handleExitGame}
          isBotGame={true}
          canUndo={false}
          gameStatus={gameState.status}
        />
        
        {/* Modals */}
        <ExitConfirmModal 
          open={showExitConfirm}
          onOpenChange={setShowExitConfirm}
          isOnline={false}
          onConfirm={confirmExit}
          onCancel={() => setShowExitConfirm(false)}
        />
        
        <SettingsModal 
          open={showSettings}
          onOpenChange={setShowSettings}
          settings={settings}
          onSettingsChange={setSettings}
        />
        
        <GameResultModal 
          open={showResultModal}
          onOpenChange={setShowResultModal}
          result={gameResult}
          rewards={gameRewards}
          isVipArena={gameState.isVipArena}
          onNewGame={handleRestart}
          onGoHome={confirmExit}
        />
      </div>
    );
  }

  // Render main menu
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <motion.div 
              className="w-9 h-9 rounded-xl solana-gradient flex items-center justify-center shadow-lg"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Swords className="w-5 h-5 text-black" />
            </motion.div>
            <span className="font-bold text-xl solana-text-gradient">SolMate</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.isVip && (
              <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg">
                <Crown className="w-3 h-3 mr-1" />VIP
              </Badge>
            )}
            {!walletAddress ? (
              <Button onClick={connectWallet} className="solana-gradient text-black shadow-lg">
                <Wallet className="w-4 h-4 mr-2" />Connect
              </Button>
            ) : !user ? (
              <Button onClick={signIn} className="solana-gradient text-black shadow-lg">Sign In</Button>
            ) : (
              <Button variant="outline" size="sm" onClick={signOut} className="font-mono">
                {walletAddress.slice(0,4)}...{walletAddress.slice(-4)}
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-4 pb-24">
        <AnimatePresence mode="wait">
          {/* Play Tab */}
          {activeTab === 'play' && (
            <motion.div 
              key="play"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {/* Free Mode */}
              <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-card to-card/50">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5 text-primary" />
                    Play vs Bot
                  </CardTitle>
                  <CardDescription>Practice without rewards</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {DIFFICULTIES.map((diff) => (
                    <motion.div key={diff.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between h-14 group hover:border-primary/50"
                        onClick={() => startBotGame(diff.id, false)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{diff.icon}</span>
                          <div className="text-left">
                            <p className="font-semibold">{diff.name}</p>
                            <p className="text-xs text-muted-foreground">{diff.desc}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </Button>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
              
              {/* Free Online Mode */}
              <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-blue-500/10 to-blue-600/5">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-500" />
                    Play Online
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
                          className="w-full h-16 flex-col gap-0 hover:border-blue-500/50 hover:bg-blue-500/10"
                          onClick={() => toast.info('Online matchmaking coming soon!')}
                        >
                          <Clock className="w-4 h-4 mb-1" />
                          <span className="font-bold">{tc.name}</span>
                          <span className="text-[10px] text-muted-foreground">{tc.desc}</span>
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* VIP Tab */}
          {activeTab === 'vip' && (
            <motion.div
              key="vip"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              {!user?.isVip ? (
                <Card className="overflow-hidden border-2 border-yellow-500/30 shadow-xl bg-gradient-to-br from-yellow-500/10 to-amber-600/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="w-6 h-6 text-yellow-500" />
                      VIP Arena
                    </CardTitle>
                    <CardDescription>Unlock rewards and exclusive features!</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {['Win chests', '5-streak bonus', 'Gold points', 'Leaderboards'].map((feature) => (
                        <div key={feature} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-yellow-500" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className="w-full h-12 solana-gradient text-black font-bold text-lg shadow-lg"
                      onClick={() => setShowVipDialog(true)}
                    >
                      <Crown className="w-5 h-5 mr-2" />
                      Unlock VIP - $6.99
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-yellow-500/10 to-amber-600/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      VIP Arena
                    </CardTitle>
                    <CardDescription>Win = Bronze Chest! 5-streak = Silver + Gold!</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/50">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{user.stats?.vipCurrentStreak || 0}</p>
                        <p className="text-xs text-muted-foreground">Streak 🔥</p>
                      </div>
                      <div className="text-center border-x border-border">
                        <p className="text-2xl font-bold">{user.stats?.vipWins || 0}</p>
                        <p className="text-xs text-muted-foreground">Wins</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-500">{user.goldPoints || 0}</p>
                        <p className="text-xs text-muted-foreground">Gold ⭐</p>
                      </div>
                    </div>
                    
                    {/* Difficulties */}
                    {DIFFICULTIES.map((diff) => (
                      <motion.div key={diff.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between h-14 border-yellow-500/30 hover:border-yellow-500/60 hover:bg-yellow-500/10"
                          onClick={() => startBotGame(diff.id, true)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{diff.icon}</span>
                            <span className="font-semibold">{diff.name}</span>
                          </div>
                          <Badge className="bg-yellow-500/20 text-yellow-500">Ranked</Badge>
                        </Button>
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Inventory Tab */}
          {activeTab === 'inventory' && (
            <motion.div
              key="inventory"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="overflow-hidden border-0 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    Inventory
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {user ? (
                    <>
                      {/* Chests */}
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Gift className="w-4 h-4" /> Chests
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { type: 'bronze', emoji: '🟤', count: user.chests?.bronze || 0, color: 'from-amber-700 to-amber-900' },
                            { type: 'silver', emoji: '⚪', count: user.chests?.silver || 0, color: 'from-gray-400 to-gray-600' },
                            { type: 'gold', emoji: '🟡', count: user.chests?.gold || 0, color: 'from-yellow-400 to-yellow-600' },
                          ].map((chest) => (
                            <motion.div 
                              key={chest.type}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Card className={`p-3 text-center cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br ${chest.color}/10`}>
                                <div className="text-3xl mb-1">{chest.emoji}</div>
                                <p className="text-lg font-bold">{chest.count}</p>
                                <p className="text-xs text-muted-foreground capitalize">{chest.type}</p>
                                {chest.count > 0 && (
                                  <Button 
                                    size="sm" 
                                    className="mt-2 w-full text-xs h-7"
                                    onClick={() => openChest(chest.type)}
                                  >
                                    Open
                                  </Button>
                                )}
                              </Card>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                      
                      <Separator />
                      
                      {/* Gold Points */}
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-500" /> 
                          Gold Points: {user.goldPoints || 0}
                        </h3>
                        {user.goldPoints >= 5 ? (
                          <Button variant="outline" className="w-full" onClick={redeemGold}>
                            Redeem 5 Points → 1 Gold Chest
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Earn {5 - (user.goldPoints || 0)} more to redeem a Gold Chest
                          </p>
                        )}
                      </div>
                      
                      <Separator />
                      
                      {/* Shards */}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          Shards: {user.shards || 0}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">Crafting coming soon!</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Sign in to view inventory</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <motion.div
              key="friends"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="overflow-hidden border-0 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    Friends
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user ? (
                    <>
                      {/* Your Code */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                        <p className="text-xs text-muted-foreground mb-1">Your Friend Code</p>
                        <div className="flex items-center gap-2">
                          <code className="text-2xl font-bold tracking-widest">{user.friendCode}</code>
                          <Button variant="ghost" size="icon" onClick={copyCode}>
                            {copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      {/* Add Friend */}
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Enter friend code" 
                          value={friendCode} 
                          onChange={(e) => setFriendCode(e.target.value.toUpperCase())} 
                          maxLength={8}
                          className="font-mono tracking-wider"
                        />
                        <Button onClick={addFriend}>Add</Button>
                      </div>
                      
                      {/* Friends List */}
                      <ScrollArea className="h-48">
                        {friends.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            No friends yet. Share your code!
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {friends.map((f) => (
                              <div key={f.wallet} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                                <div>
                                  <p className="font-mono font-medium">{f.friendCode}</p>
                                  <p className="text-xs text-muted-foreground">{f.wallet.slice(0,8)}...</p>
                                </div>
                                {f.canGift && (
                                  <Button variant="ghost" size="sm">
                                    <Gift className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </ScrollArea>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Sign in to manage friends</p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <Card className="overflow-hidden border-0 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Profile
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {user ? (
                    <div className="space-y-4">
                      <div className="p-3 rounded-xl bg-secondary/50">
                        <p className="text-xs text-muted-foreground">Wallet</p>
                        <p className="font-mono text-sm truncate">{user.wallet}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-3 text-center bg-green-500/10">
                          <p className="text-2xl font-bold text-green-500">{user.stats?.wins || 0}</p>
                          <p className="text-xs text-muted-foreground">Wins</p>
                        </Card>
                        <Card className="p-3 text-center bg-red-500/10">
                          <p className="text-2xl font-bold text-red-500">{user.stats?.losses || 0}</p>
                          <p className="text-xs text-muted-foreground">Losses</p>
                        </Card>
                        <Card className="p-3 text-center bg-primary/10">
                          <p className="text-2xl font-bold text-primary">{user.stats?.currentStreak || 0}</p>
                          <p className="text-xs text-muted-foreground">Current 🔥</p>
                        </Card>
                        <Card className="p-3 text-center bg-yellow-500/10">
                          <p className="text-2xl font-bold text-yellow-500">{user.stats?.bestStreak || 0}</p>
                          <p className="text-xs text-muted-foreground">Best 🏆</p>
                        </Card>
                      </div>
                    </div>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">Sign in to view profile</p>
                  )}
                </CardContent>
              </Card>
              
              {/* Leaderboard */}
              <Card className="overflow-hidden border-0 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    VIP Leaderboard
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {leaderboard.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">No rankings yet</p>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.slice(0, 10).map((l, i) => (
                          <motion.div 
                            key={l.wallet} 
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.05 }}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                                i === 0 ? 'bg-yellow-500 text-black' : 
                                i === 1 ? 'bg-gray-400 text-black' : 
                                i === 2 ? 'bg-amber-600 text-black' : 'bg-muted'
                              }`}>
                                {l.rank}
                              </span>
                              <div>
                                <p className="font-mono font-medium">{l.friendCode}</p>
                                <p className="text-xs text-muted-foreground">{l.wins}W / {l.losses}L</p>
                              </div>
                            </div>
                            <Badge variant="outline" className="font-mono">{l.bestStreak}🔥</Badge>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-area-bottom">
        <div className="container flex justify-around py-2">
          {tabs.map((t) => (
            <motion.button 
              key={t.id} 
              onClick={() => setActiveTab(t.id)} 
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
                activeTab === t.id ? 'text-primary bg-primary/10' : 'text-muted-foreground'
              }`}
              whileTap={{ scale: 0.9 }}
            >
              <t.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{t.label}</span>
            </motion.button>
          ))}
        </div>
      </nav>

      {/* VIP Dialog */}
      <Dialog open={showVipDialog} onOpenChange={setShowVipDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              Unlock VIP
            </DialogTitle>
            <DialogDescription>Lifetime access to VIP Arena!</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5">
              <h3 className="font-bold mb-3">VIP Benefits</h3>
              <ul className="text-sm space-y-2">
                {['✓ VIP Arena ranked matches', '✓ Bronze Chest on every win', '✓ 5-streak = Silver Chest + Gold Point', '✓ 5 Gold Points = Gold Chest', '✓ Compete on leaderboards'].map((b) => (
                  <li key={b} className="text-muted-foreground">{b}</li>
                ))}
              </ul>
            </div>
            <div className="text-center">
              <p className="text-4xl font-bold solana-text-gradient">$6.99</p>
              <p className="text-sm text-muted-foreground">Lifetime Access</p>
            </div>
            {!user ? (
              <p className="text-center text-sm text-muted-foreground">Connect wallet and sign in first</p>
            ) : (
              <Button className="w-full h-12 solana-gradient text-black font-bold" onClick={() => toast.info('Payment integration ready - provide developer wallet')}>
                <Wallet className="w-5 h-5 mr-2" />
                Pay with USDC/SOL
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
