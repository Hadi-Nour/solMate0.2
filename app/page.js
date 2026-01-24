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
  Gift, Home, RotateCcw, Settings, Palette, Volume2, ArrowLeft, Globe, Edit, LogOut,
  Loader2, CheckCircle2, XCircle, ExternalLink
} from 'lucide-react';
import ChessBoard3D from '@/components/chess/ChessBoard3D';
import GameTopBar from '@/components/game/GameTopBar';
import GameBottomBar from '@/components/game/GameBottomBar';
import GameResultModal from '@/components/game/GameResultModal';
import ExitConfirmModal from '@/components/game/ExitConfirmModal';
import SettingsModal from '@/components/game/SettingsModal';
import EditProfileModal from '@/components/profile/EditProfileModal';
import UserAvatar, { getAvatarEmoji } from '@/components/profile/UserAvatar';
import WalletConnectModal from '@/components/wallet/WalletConnectModal';
import { useSolanaWallet } from '@/components/wallet/SolanaWalletProvider';
import { useI18n } from '@/lib/i18n/provider';
import { useVipPayment, PAYMENT_STATES } from '@/hooks/useVipPayment';

// Dynamic imports for online components
const MatchmakingScreen = dynamic(() => import('@/components/game/MatchmakingScreen'), { ssr: false });
const OnlineGameScreen = dynamic(() => import('@/components/game/OnlineGameScreen'), { ssr: false });

export default function SolMate() {
  const { t, locale, direction, isRtl, syncLocaleToServer, isLoaded } = useI18n();
  
  // Wallet hooks - using our lightweight provider
  const { 
    publicKey, 
    connected, 
    connecting, 
    disconnect, 
    signMessage,
    signTransaction,
    signAndSendTransaction,
    walletName 
  } = useSolanaWallet();

  // Auth state
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [showWalletModal, setShowWalletModal] = useState(false);
  
  // Derived wallet address
  const walletAddress = publicKey?.toString() || '';

  // VIP Payment hook
  const handleVipSuccess = useCallback(({ signature, amount, message }) => {
    toast.success(message || 'VIP Lifetime activated!');
    setShowVipDialog(false);
    // Refresh user data to update VIP status
    if (authToken) {
      fetchUser(authToken);
    }
  }, [authToken]);

  const handleVipError = useCallback((error) => {
    toast.error(error.message || 'VIP purchase failed');
  }, []);

  const {
    paymentState,
    errorMessage: paymentError,
    txSignature,
    purchaseVip,
    resetPayment,
    isProcessing: isPaymentProcessing,
    config: paymentConfig
  } = useVipPayment({
    wallet: publicKey,
    signTransaction,
    signAndSendTransaction,
    authToken,
    onSuccess: handleVipSuccess,
    onError: handleVipError
  });
  
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
  const [showVipMatchmaking, setShowVipMatchmaking] = useState(false);
  const [onlineMatch, setOnlineMatch] = useState(null);
  const [onlineMatchColor, setOnlineMatchColor] = useState(null);
  
  // Private match state
  const [showPrivateMatchDialog, setShowPrivateMatchDialog] = useState(false);
  const [privateMatchMode, setPrivateMatchMode] = useState('create'); // 'create' or 'join'
  const [privateMatchCode, setPrivateMatchCode] = useState('');
  const [privateMatchWaiting, setPrivateMatchWaiting] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  
  // UI state
  const [showVipDialog, setShowVipDialog] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [gameRewards, setGameRewards] = useState(null);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
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

  // Difficulties with translations - memoized to avoid recreation on each render
  const getDifficulties = useCallback(() => [
    { id: 'easy', name: t('difficulty.easy'), desc: t('difficulty.easyDesc'), color: 'bg-green-500', icon: '🌱' },
    { id: 'normal', name: t('difficulty.normal'), desc: t('difficulty.normalDesc'), color: 'bg-blue-500', icon: '⚔️' },
    { id: 'hard', name: t('difficulty.hard'), desc: t('difficulty.hardDesc'), color: 'bg-orange-500', icon: '🔥' },
    { id: 'pro', name: t('difficulty.pro'), desc: t('difficulty.proDesc'), color: 'bg-red-500', icon: '💀' },
  ], [t]);

  // Helper to get display name with wallet fallback
  const getDisplayName = useCallback((userData, shortened = true) => {
    if (userData?.displayName) return userData.displayName;
    if (userData?.wallet) {
      return shortened 
        ? `${userData.wallet.slice(0, 4)}...${userData.wallet.slice(-4)}`
        : userData.wallet;
    }
    return 'Anonymous';
  }, []);

  // Handle profile update
  const handleProfileUpdated = useCallback((profile) => {
    setUser(prev => ({
      ...prev,
      displayName: profile.displayName,
      equipped: { ...prev?.equipped, avatar: profile.avatarId }
    }));
    toast.success(t('profile.profileUpdated'));
  }, [t]);

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem('solmate_settings');
    if (savedSettings) setSettings(JSON.parse(savedSettings));
    const token = localStorage.getItem('solmate_token');
    if (token) { 
      setAuthToken(token); 
      fetchUser(token).finally(() => setIsCheckingAuth(false));
    } else {
      setIsCheckingAuth(false);
    }
  }, []);

  // Save settings
  useEffect(() => {
    localStorage.setItem('solmate_settings', JSON.stringify(settings));
  }, [settings]);

  // Sync language to server when user is logged in
  useEffect(() => {
    if (authToken && isLoaded) {
      syncLocaleToServer(authToken);
    }
  }, [authToken, locale, syncLocaleToServer, isLoaded]);

  const fetchUser = async (token) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setUser((await res.json()).user); }
      else { localStorage.removeItem('solmate_token'); setAuthToken(null); }
    } catch (e) { console.error('Failed to fetch user:', e); }
  };

  // Wallet connection handler (opens modal)
  const connectWallet = () => {
    setShowWalletModal(true);
  };
  
  // Handle successful wallet connection from modal
  const handleWalletConnected = useCallback((address) => {
    toast.success(t('wallet.connected'));
  }, [t]);

  // Sign in with connected wallet using wallet adapter
  const signIn = async () => {
    if (!connected || !publicKey) { 
      toast.error(t('wallet.connectFirst')); 
      setShowWalletModal(true);
      return; 
    }
    
    try {
      // Use dedicated wallet auth endpoints (not NextAuth)
      const nonceRes = await fetch('/api/auth/wallet-nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress })
      });
      
      if (!nonceRes.ok) {
        const errorData = await nonceRes.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errorData.error || 'Failed to get nonce');
      }
      
      const { nonce, messageToSign } = await nonceRes.json();
      
      // Use our wallet provider's signMessage
      const signatureResult = await signMessage(messageToSign);
      
      // Handle different signature formats
      let signature;
      if (signatureResult instanceof Uint8Array) {
        signature = btoa(String.fromCharCode.apply(null, signatureResult));
      } else if (typeof signatureResult === 'string') {
        signature = signatureResult;
      } else if (signatureResult?.signature) {
        const sigBytes = signatureResult.signature;
        signature = btoa(String.fromCharCode.apply(null, sigBytes instanceof Uint8Array ? sigBytes : new Uint8Array(sigBytes)));
      } else {
        throw new Error('Invalid signature format');
      }
      
      const verifyRes = await fetch('/api/auth/wallet-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, nonce, signature })
      });
      
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        setAuthToken(data.token); 
        setUser(data.user);
        localStorage.setItem('solmate_token', data.token);
        toast.success(t('wallet.signedIn'));
      } else { 
        const errorData = await verifyRes.json().catch(() => ({ error: 'Verification failed' }));
        toast.error(errorData.error || 'Sign in failed'); 
      }
    } catch (e) { 
      console.error('Wallet sign in error:', e);
      toast.error('Sign in failed: ' + e.message); 
    }
  };

  // Sign out and disconnect wallet
  const signOut = useCallback(async () => {
    localStorage.removeItem('solmate_token');
    setAuthToken(null); 
    setUser(null); 
    setGameState(null); 
    setChess(null);
    
    // Disconnect wallet adapter
    try {
      await disconnect();
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    
    toast.success(t('wallet.signedOut'));
  }, [disconnect, t]);

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
        const colorName = data.playerColor === 'w' ? t('game.white') : t('game.black');
        toast.success(t('game.playingAs', { color: colorName }));
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
  // Social functions - wrapped in useCallback for stable references
  const loadFriends = useCallback(async () => { 
    if (authToken) { 
      const r = await fetch('/api/friends', { headers: { Authorization: `Bearer ${authToken}` } }); 
      if (r.ok) setFriends((await r.json()).friends || []); 
    } 
  }, [authToken]);
  
  const loadLeaderboard = useCallback(async () => { 
    const r = await fetch('/api/leaderboard?period=all'); 
    if (r.ok) setLeaderboard((await r.json()).leaderboard || []); 
  }, []);
  
  const addFriend = async () => { 
    if (!friendCode || !authToken) return; 
    const r = await fetch('/api/friends/add', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, 
      body: JSON.stringify({ friendCode }) 
    }); 
    if (r.ok) { toast.success(t('friends.friendAdded')); setFriendCode(''); loadFriends(); } 
    else toast.error((await r.json()).error); 
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
      toast.success(t('inventory.gotItems', { count: data.rewards.length })); 
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
    if (r.ok) { toast.success(t('inventory.gotChest')); fetchUser(authToken); } 
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
  }, [activeTab, loadFriends, loadLeaderboard]);

  // Navigation tabs with translations
  const tabs = [
    { id: 'play', icon: Gamepad2, label: t('nav.play') },
    { id: 'vip', icon: Crown, label: t('nav.vip') },
    { id: 'inventory', icon: Package, label: t('nav.items') },
    { id: 'friends', icon: Users, label: t('nav.friends') },
    { id: 'profile', icon: User, label: t('nav.profile') }
  ];

  // Online match handlers
  const handleMatchFound = useCallback(({ matchId, yourColor, opponent, match }) => {
    setOnlineMatch(match);
    setOnlineMatchColor(yourColor);
    setShowMatchmaking(false);
    setShowVipMatchmaking(false);
  }, []);

  const handleOnlineGameEnd = useCallback((result, rewards) => {
    // Refresh user data to get updated stats
    if (authToken) {
      fetchUser(authToken);
    }
  }, [authToken]);

  const handleExitOnlineGame = useCallback(() => {
    setOnlineMatch(null);
    setOnlineMatchColor(null);
    // Refresh user data
    if (authToken) {
      fetchUser(authToken);
    }
  }, [authToken]);

  // Don't render until locale is loaded to prevent flicker
  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Render matchmaking screen (Free Online)
  if (showMatchmaking) {
    return (
      <MatchmakingScreen
        authToken={authToken}
        isVip={user?.isVip}
        onMatchFound={handleMatchFound}
        onCancel={() => setShowMatchmaking(false)}
      />
    );
  }

  // Render VIP Arena matchmaking screen
  if (showVipMatchmaking) {
    return (
      <MatchmakingScreen
        authToken={authToken}
        isVip={user?.isVip}
        onMatchFound={handleMatchFound}
        onCancel={() => setShowVipMatchmaking(false)}
      />
    );
  }

  // Render online game screen
  if (onlineMatch && onlineMatchColor) {
    return (
      <OnlineGameScreen
        matchData={onlineMatch}
        yourColor={onlineMatchColor}
        onExit={handleExitOnlineGame}
        settings={settings}
        authToken={authToken}
        onGameEnd={handleOnlineGameEnd}
      />
    );
  }

  // Render bot game screen
  if (gameState && chess) {
    return (
      <div className="min-h-screen bg-background flex flex-col" dir={direction}>
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
            {isThinking ? `🤔 ${t('game.botThinking')}` : chess.turn() === gameState.playerColor ? `✨ ${t('game.yourTurn')}` : `⏳ ${t('game.botsTurn')}`}
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
                    {i % 2 === 0 && <span className="text-primary me-1">{Math.floor(i/2) + 1}.</span>}
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
    <div className="min-h-screen bg-background" dir={direction}>
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
                <Crown className="w-3 h-3 me-1" />{t('common.vip')}
              </Badge>
            )}
            {!connected ? (
              <Button onClick={connectWallet} className="solana-gradient text-black shadow-lg">
                <Wallet className="w-4 h-4 me-2" />{t('header.connect')}
              </Button>
            ) : !user ? (
              <div className="flex items-center gap-2">
                <Button onClick={signIn} className="solana-gradient text-black shadow-lg">
                  {t('header.signIn')}
                </Button>
                <Button variant="ghost" size="icon" onClick={signOut} title="Disconnect">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
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
                    {t('play.vsBot')}
                  </CardTitle>
                  <CardDescription>{t('play.vsBotDesc')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {getDifficulties().map((diff) => (
                    <motion.div key={diff.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                      <Button 
                        variant="outline" 
                        className="w-full justify-between h-14 group hover:border-primary/50"
                        onClick={() => startBotGame(diff.id, false)}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{diff.icon}</span>
                          <div className="text-start">
                            <p className="font-semibold">{diff.name}</p>
                            <p className="text-xs text-muted-foreground">{diff.desc}</p>
                          </div>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors ${isRtl ? 'rotate-180' : ''}`} />
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
                    {t('play.playOnline')}
                    <Badge variant="secondary" className="text-[10px]">{t('common.free')}</Badge>
                  </CardTitle>
                  <CardDescription>{t('play.playOnlineDesc')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full h-14 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30"
                    variant="outline"
                    onClick={() => {
                      if (!authToken) {
                        toast.error(t('play.signInRequired'));
                        return;
                      }
                      setShowMatchmaking(true);
                    }}
                  >
                    <Globe className="w-5 h-5 me-2" />
                    {t('play.findMatch')}
                  </Button>
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
                      {t('vip.title')}
                    </CardTitle>
                    <CardDescription>{t('vip.desc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {[t('vip.winChests'), t('vip.streakBonus'), t('vip.goldPoints'), t('vip.leaderboards')].map((feature) => (
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
                      <Crown className="w-5 h-5 me-2" />
                      {t('vip.unlockTitle')} - {t('vip.price')}
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <Card className="overflow-hidden border-0 shadow-xl bg-gradient-to-br from-yellow-500/10 to-amber-600/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5 text-yellow-500" />
                      {t('vip.title')}
                    </CardTitle>
                    <CardDescription>{t('vip.rewardDesc')}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-secondary/50">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-primary">{user.stats?.vipCurrentStreak || 0}</p>
                        <p className="text-xs text-muted-foreground">{t('rewards.streak')} 🔥</p>
                      </div>
                      <div className="text-center border-x border-border">
                        <p className="text-2xl font-bold">{user.stats?.vipWins || 0}</p>
                        <p className="text-xs text-muted-foreground">{t('rewards.wins')}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-yellow-500">{user.goldPoints || 0}</p>
                        <p className="text-xs text-muted-foreground">{t('rewards.gold')} ⭐</p>
                      </div>
                    </div>
                    
                    {/* VIP Arena Online Match Button */}
                    <Button 
                      className="w-full h-14 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold hover:from-yellow-400 hover:to-amber-400"
                      onClick={() => setShowVipMatchmaking(true)}
                    >
                      <Wifi className="w-5 h-5 me-2" />
                      Play VIP Arena Online
                    </Button>
                    
                    <div className="relative flex items-center justify-center">
                      <div className="flex-1 border-t border-border"></div>
                      <span className="px-3 text-xs text-muted-foreground">or play vs bot</span>
                      <div className="flex-1 border-t border-border"></div>
                    </div>
                    
                    {/* Difficulties */}
                    {getDifficulties().map((diff) => (
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
                          <Badge className="bg-yellow-500/20 text-yellow-500">{t('game.ranked')}</Badge>
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
                    {t('inventory.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {user ? (
                    <>
                      {/* Chests */}
                      <div>
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                          <Gift className="w-4 h-4" /> {t('inventory.chests')}
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { type: 'bronze', emoji: '🟤', count: user.chests?.bronze || 0, color: 'from-amber-700 to-amber-900', label: t('inventory.bronze') },
                            { type: 'silver', emoji: '⚪', count: user.chests?.silver || 0, color: 'from-gray-400 to-gray-600', label: t('inventory.silver') },
                            { type: 'gold', emoji: '🟡', count: user.chests?.gold || 0, color: 'from-yellow-400 to-yellow-600', label: t('inventory.gold') },
                          ].map((chest) => (
                            <motion.div 
                              key={chest.type}
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Card className={`p-3 text-center cursor-pointer hover:shadow-lg transition-shadow bg-gradient-to-br ${chest.color}/10`}>
                                <div className="text-3xl mb-1">{chest.emoji}</div>
                                <p className="text-lg font-bold">{chest.count}</p>
                                <p className="text-xs text-muted-foreground">{chest.label}</p>
                                {chest.count > 0 && (
                                  <Button 
                                    size="sm" 
                                    className="mt-2 w-full text-xs h-7"
                                    onClick={() => openChest(chest.type)}
                                  >
                                    {t('inventory.open')}
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
                          {t('inventory.goldPoints')}: {user.goldPoints || 0}
                        </h3>
                        {user.goldPoints >= 5 ? (
                          <Button variant="outline" className="w-full" onClick={redeemGold}>
                            {t('inventory.redeem')}
                          </Button>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {t('inventory.earnMore', { count: 5 - (user.goldPoints || 0) })}
                          </p>
                        )}
                      </div>
                      
                      <Separator />
                      
                      {/* Shards */}
                      <div>
                        <h3 className="font-semibold flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-purple-500" />
                          {t('inventory.shards')}: {user.shards || 0}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1">{t('inventory.craftingSoon')}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-center text-muted-foreground py-8">{t('inventory.signInRequired')}</p>
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
                    {t('friends.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {user ? (
                    <>
                      {/* Your Code */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5">
                        <p className="text-xs text-muted-foreground mb-1">{t('friends.yourCode')}</p>
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
                          placeholder={t('friends.enterCode')}
                          value={friendCode} 
                          onChange={(e) => setFriendCode(e.target.value.toUpperCase())} 
                          maxLength={8}
                          className="font-mono tracking-wider"
                        />
                        <Button onClick={addFriend}>{t('friends.add')}</Button>
                      </div>
                      
                      {/* Friends List */}
                      <ScrollArea className="h-48">
                        {friends.length === 0 ? (
                          <p className="text-center text-muted-foreground py-8">
                            {t('friends.noFriends')}
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {friends.map((f) => (
                              <div key={f.wallet} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                                <div className="flex items-center gap-3">
                                  <UserAvatar avatarId={f.avatarId || 'default'} size="md" />
                                  <div>
                                    <p className="font-medium">{f.displayName || f.friendCode}</p>
                                    <p className="text-xs text-muted-foreground">{f.wallet.slice(0,8)}...</p>
                                  </div>
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
                    <p className="text-center text-muted-foreground py-8">{t('friends.signInRequired')}</p>
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
                    {t('profile.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {user ? (
                    <div className="space-y-4">
                      {/* Profile Card with Avatar and Name */}
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                        <div className="flex items-center gap-4">
                          <UserAvatar 
                            avatarId={user.equipped?.avatar || 'default'} 
                            size="xl" 
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xl font-bold truncate">
                              {getDisplayName(user)}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              {user.friendCode}
                            </p>
                            {user.isVip && (
                              <Badge className="mt-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs">
                                <Crown className="w-3 h-3 me-1" />{t('common.vip')}
                              </Badge>
                            )}
                          </div>
                          <Button 
                            variant="outline" 
                            size="icon"
                            onClick={() => setShowEditProfile(true)}
                            className="shrink-0"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {/* Wallet info */}
                      <div className="p-3 rounded-xl bg-secondary/50">
                        <p className="text-xs text-muted-foreground">{t('profile.wallet')}</p>
                        <p className="font-mono text-sm truncate">{user.wallet}</p>
                      </div>
                      
                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <Card className="p-3 text-center bg-green-500/10">
                          <p className="text-2xl font-bold text-green-500">{user.stats?.wins || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('profile.wins')}</p>
                        </Card>
                        <Card className="p-3 text-center bg-red-500/10">
                          <p className="text-2xl font-bold text-red-500">{user.stats?.losses || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('profile.losses')}</p>
                        </Card>
                        <Card className="p-3 text-center bg-primary/10">
                          <p className="text-2xl font-bold text-primary">{user.stats?.currentStreak || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('profile.currentStreak')} 🔥</p>
                        </Card>
                        <Card className="p-3 text-center bg-yellow-500/10">
                          <p className="text-2xl font-bold text-yellow-500">{user.stats?.bestStreak || 0}</p>
                          <p className="text-xs text-muted-foreground">{t('profile.bestStreak')} 🏆</p>
                        </Card>
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          onClick={() => setShowEditProfile(true)}
                        >
                          <Edit className="w-4 h-4 me-2" />
                          {t('profile.editProfile')}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowSettings(true)}
                        >
                          <Settings className="w-4 h-4 me-2" />
                          {t('settings.title')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <p className="text-center text-muted-foreground py-4">{t('profile.signInRequired')}</p>
                      
                      {/* Settings Button - always visible */}
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => setShowSettings(true)}
                      >
                        <Settings className="w-4 h-4 me-2" />
                        {t('settings.title')}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Leaderboard */}
              <Card className="overflow-hidden border-0 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    {t('leaderboard.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {leaderboard.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8">{t('leaderboard.noRankings')}</p>
                    ) : (
                      <div className="space-y-2">
                        {leaderboard.slice(0, 10).map((l, i) => (
                          <motion.div 
                            key={l.wallet} 
                            className="flex items-center justify-between p-3 rounded-lg bg-secondary/50"
                            initial={{ opacity: 0, x: isRtl ? 20 : -20 }}
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
                              <UserAvatar avatarId={l.avatarId || 'default'} size="sm" />
                              <div>
                                <p className="font-medium">{l.displayName || l.friendCode}</p>
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
      <Dialog open={showVipDialog} onOpenChange={(open) => {
        if (!isPaymentProcessing) {
          setShowVipDialog(open);
          if (!open) resetPayment();
        }
      }}>
        <DialogContent className="max-w-sm" dir={direction}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="w-6 h-6 text-yellow-500" />
              {t('vip.unlockTitle')}
            </DialogTitle>
            <DialogDescription>{t('vip.lifetime')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Payment States UI */}
            {paymentState !== PAYMENT_STATES.IDLE && paymentState !== PAYMENT_STATES.ERROR && (
              <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                <div className="flex flex-col items-center gap-3 text-center">
                  {paymentState === PAYMENT_STATES.PREPARING && (
                    <>
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="font-medium">Preparing transaction...</p>
                      <p className="text-xs text-muted-foreground">Building USDC transfer</p>
                    </>
                  )}
                  {paymentState === PAYMENT_STATES.AWAITING_SIGNATURE && (
                    <>
                      <Wallet className="w-8 h-8 text-yellow-500 animate-pulse" />
                      <p className="font-medium">Confirm in wallet</p>
                      <p className="text-xs text-muted-foreground">Please approve the transaction in your wallet</p>
                    </>
                  )}
                  {paymentState === PAYMENT_STATES.SENDING && (
                    <>
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      <p className="font-medium">Sending transaction...</p>
                      <p className="text-xs text-muted-foreground">Broadcasting to Solana network</p>
                    </>
                  )}
                  {paymentState === PAYMENT_STATES.VERIFYING && (
                    <>
                      <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                      <p className="font-medium">Verifying payment...</p>
                      <p className="text-xs text-muted-foreground">Confirming on-chain and activating VIP</p>
                      {txSignature && (
                        <a 
                          href={`https://explorer.solana.com/tx/${txSignature}?cluster=${paymentConfig.cluster}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          View transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  )}
                  {paymentState === PAYMENT_STATES.SUCCESS && (
                    <>
                      <CheckCircle2 className="w-12 h-12 text-green-500" />
                      <p className="font-medium text-green-500">VIP Activated!</p>
                      <p className="text-xs text-muted-foreground">Welcome to the VIP Arena</p>
                      {txSignature && (
                        <a 
                          href={`https://explorer.solana.com/tx/${txSignature}?cluster=${paymentConfig.cluster}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary flex items-center gap-1 hover:underline"
                        >
                          View transaction <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Error State */}
            {paymentState === PAYMENT_STATES.ERROR && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                <div className="flex flex-col items-center gap-3 text-center">
                  <XCircle className="w-12 h-12 text-red-500" />
                  <p className="font-medium text-red-500">Payment Failed</p>
                  <p className="text-xs text-muted-foreground">{paymentError}</p>
                  <Button variant="outline" size="sm" onClick={resetPayment}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {/* Normal Dialog Content (shown when idle) */}
            {paymentState === PAYMENT_STATES.IDLE && (
              <>
                <div className="p-4 rounded-xl bg-gradient-to-br from-yellow-500/10 to-amber-500/5">
                  <h3 className="font-bold mb-3">{t('vip.title')}</h3>
                  <ul className="text-sm space-y-2">
                    {[
                      `✓ ${t('vip.benefits.ranked')}`,
                      `✓ ${t('vip.benefits.bronze')}`,
                      `✓ ${t('vip.benefits.streak')}`,
                      `✓ ${t('vip.benefits.gold')}`,
                      `✓ ${t('vip.benefits.leaderboard')}`
                    ].map((b) => (
                      <li key={b} className="text-muted-foreground">{b}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-center">
                  <p className="text-4xl font-bold solana-text-gradient">{t('vip.price')}</p>
                  <p className="text-sm text-muted-foreground">{t('vip.lifetime')}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Payment on {paymentConfig.cluster === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
                  </p>
                </div>
                {!user ? (
                  <p className="text-center text-sm text-muted-foreground">{t('vip.connectFirst')}</p>
                ) : user.isVip ? (
                  <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="font-medium text-green-500">You already have VIP!</p>
                  </div>
                ) : (
                  <Button 
                    className="w-full h-12 solana-gradient text-black font-bold" 
                    onClick={purchaseVip}
                    disabled={isPaymentProcessing}
                  >
                    {isPaymentProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 me-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Wallet className="w-5 h-5 me-2" />
                        {t('vip.payWith')}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Settings Modal */}
      <SettingsModal 
        open={showSettings}
        onOpenChange={setShowSettings}
        settings={settings}
        onSettingsChange={setSettings}
      />
      
      {/* Edit Profile Modal */}
      <EditProfileModal
        open={showEditProfile}
        onOpenChange={setShowEditProfile}
        user={user}
        authToken={authToken}
        onProfileUpdated={handleProfileUpdated}
      />
      
      {/* Wallet Connect Modal */}
      <WalletConnectModal
        open={showWalletModal}
        onOpenChange={setShowWalletModal}
        onConnected={handleWalletConnected}
      />
    </div>
  );
}
