'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gamepad2, Trophy, ShoppingBag, Package, Users, User, Crown, Swords, ChevronRight, Gift, Sparkles, Star, LogOut, Copy, Check, X, Flag, Wallet } from 'lucide-react';

const PIECE_UNICODE = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};
const VIP_PRICE_USDC = 6.99;

// Dynamic import wallet components
const WalletComponents = dynamic(() => import('@/components/wallet/WalletComponents'), { ssr: false, loading: () => <Button disabled><Wallet className="w-4 h-4 mr-2" />Loading...</Button> });

export default function SolMate() {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('play');
  const [gameState, setGameState] = useState(null);
  const [chess, setChess] = useState(null);
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [validMoves, setValidMoves] = useState([]);
  const [isThinking, setIsThinking] = useState(false);
  const [showVipDialog, setShowVipDialog] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('solmate_token');
    if (token) { setAuthToken(token); fetchUser(token); }
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { const data = await res.json(); setUser(data.user); }
      else { localStorage.removeItem('solmate_token'); setAuthToken(null); }
    } catch (e) { console.error('Failed to fetch user:', e); }
  };

  const handleAuthSuccess = (token, userData) => {
    setAuthToken(token);
    setUser(userData);
    localStorage.setItem('solmate_token', token);
    toast.success('Signed in successfully!');
  };

  const handleSignOut = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('solmate_token');
    setAuthToken(null); setUser(null); setGameState(null); setChess(null);
    toast.success('Signed out');
  };

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
        setGameState(data); setChess(new Chess(data.fen));
        setSelectedSquare(null); setValidMoves([]);
        toast.success(`Game started! You play as ${data.playerColor === 'w' ? 'White' : 'Black'}`);
      } else { toast.error(data.error); }
    } catch (e) { toast.error('Failed to start game'); }
  };

  const handleSquareClick = async (square) => {
    if (!chess || !gameState || gameState.status === 'finished' || isThinking) return;
    const turn = chess.turn();
    if (turn !== gameState.playerColor) return;
    const piece = chess.get(square);
    if (selectedSquare) {
      if (validMoves.includes(square)) { await makeMove(selectedSquare, square); }
      else if (piece && piece.color === turn) { setSelectedSquare(square); setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to)); }
      else { setSelectedSquare(null); setValidMoves([]); }
    } else {
      if (piece && piece.color === turn) { setSelectedSquare(square); setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to)); }
    }
  };

  const makeMove = async (from, to) => {
    setIsThinking(true);
    try {
      let promotion;
      const piece = chess.get(from);
      if (piece?.type === 'p' && to[1] === (gameState.playerColor === 'w' ? '8' : '1')) promotion = 'q';
      const res = await fetch('/api/game/bot/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ gameId: gameState.gameId, from, to, promotion })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChess(new Chess(data.fen)); setSelectedSquare(null); setValidMoves([]);
        if (data.isGameOver) {
          let message = data.result === 'player_wins' ? '🎉 You won!' : data.result === 'draw' ? "🤝 Draw!" : '😔 Bot wins';
          if (data.rewards?.bronzeChest) message += ` +${data.rewards.bronzeChest} Bronze Chest`;
          toast.success(message);
          setGameState({ ...gameState, status: 'finished', result: data.result });
          if (authToken) fetchUser(authToken);
        }
      } else { toast.error(data.error || 'Invalid move'); }
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
    toast.info('You resigned');
    setGameState({ ...gameState, status: 'finished', result: 'bot_wins' });
    if (authToken) fetchUser(authToken);
  };

  const handleVipPurchase = () => { fetchUser(authToken); setShowVipDialog(false); };

  const loadFriends = async () => {
    if (!authToken) return;
    const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${authToken}` } });
    if (res.ok) { const data = await res.json(); setFriends(data.friends || []); }
  };

  const addFriend = async () => {
    if (!friendCode || !authToken) return;
    const res = await fetch('/api/friends/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ friendCode })
    });
    const data = await res.json();
    if (res.ok) { toast.success('Friend added!'); setFriendCode(''); loadFriends(); }
    else { toast.error(data.error); }
  };

  const loadLeaderboard = async () => {
    const res = await fetch('/api/leaderboard?period=all');
    if (res.ok) { const data = await res.json(); setLeaderboard(data.leaderboard || []); }
  };

  const openChest = async (type) => {
    if (!authToken) return;
    const res = await fetch('/api/inventory/open-chest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ chestType: type, count: 1 })
    });
    const data = await res.json();
    if (res.ok) { toast.success(`Opened chest! Got ${data.rewards.length} items`); fetchUser(authToken); }
    else { toast.error(data.error); }
  };

  const redeemGoldPoints = async () => {
    if (!authToken) return;
    const res = await fetch('/api/inventory/redeem-gold', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
      body: JSON.stringify({ count: 1 })
    });
    if (res.ok) { toast.success('Redeemed 1 Gold Chest!'); fetchUser(authToken); }
  };

  const copyFriendCode = () => {
    if (user?.friendCode) { navigator.clipboard.writeText(user.friendCode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); }
  };

  useEffect(() => {
    if (activeTab === 'friends') loadFriends();
    if (activeTab === 'profile') loadLeaderboard();
  }, [activeTab, authToken]);

  // Chess Board Render
  const renderBoard = () => {
    if (!chess) return null;
    const board = chess.board();
    const isFlipped = gameState?.playerColor === 'b';
    const files = isFlipped ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
    const ranks = isFlipped ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
    return (
      <div className="aspect-square w-full max-w-[360px] mx-auto">
        <div className="grid grid-cols-8 h-full w-full rounded-lg overflow-hidden shadow-xl border-2 border-primary/30">
          {ranks.map((rank, ri) => files.map((file, fi) => {
            const square = `${file}${rank}`;
            const actualRow = isFlipped ? 7 - ri : ri;
            const actualCol = isFlipped ? 7 - fi : fi;
            const piece = board[actualRow][actualCol];
            const isLight = (actualRow + actualCol) % 2 === 0;
            const isSelected = selectedSquare === square;
            const isValidMove = validMoves.includes(square);
            const hasPiece = piece !== null;
            return (
              <button key={square} onClick={() => handleSquareClick(square)} disabled={isThinking || gameState?.status === 'finished'}
                className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl transition-all ${isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'} ${isSelected ? 'ring-4 ring-primary ring-inset bg-primary/40' : ''} ${isValidMove && !hasPiece ? 'relative' : ''} ${isValidMove && hasPiece ? 'ring-4 ring-primary/60 ring-inset' : ''} hover:brightness-110`}>
                {isValidMove && !hasPiece && <div className="absolute w-1/3 h-1/3 rounded-full bg-primary/50" />}
                {piece && <span className={piece.color === 'w' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'}>{PIECE_UNICODE[piece.color === 'w' ? piece.type.toUpperCase() : piece.type]}</span>}
              </button>
            );
          }))}
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'play', icon: Gamepad2, label: 'Play' },
    { id: 'vip', icon: Crown, label: 'VIP' },
    { id: 'inventory', icon: Package, label: 'Items' },
    { id: 'friends', icon: Users, label: 'Friends' },
    { id: 'profile', icon: User, label: 'Profile' }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg solana-gradient flex items-center justify-center"><Swords className="w-5 h-5 text-black" /></div>
            <span className="font-bold text-lg solana-text-gradient">SolMate</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.isVip && <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black"><Crown className="w-3 h-3 mr-1" /> VIP</Badge>}
            {user ? <Button variant="outline" size="icon" onClick={handleSignOut}><LogOut className="w-4 h-4" /></Button>
              : <WalletComponents onAuthSuccess={handleAuthSuccess} authToken={authToken} user={user} />}
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container py-4 pb-20">
        {/* Active Game */}
        {gameState && chess && (
          <Card className="mb-4">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={gameState.isVipArena ? 'default' : 'secondary'}>{gameState.isVipArena ? 'VIP Arena' : 'Free'}</Badge>
                  <Badge variant="outline">{gameState.difficulty}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {gameState.status === 'active' && (<><Button variant="ghost" size="sm" onClick={() => { setGameState(null); setChess(null); }}><X className="w-4 h-4" /></Button><Button variant="destructive" size="sm" onClick={handleResign}><Flag className="w-4 h-4" /></Button></>)}
                  {gameState.status === 'finished' && <Button size="sm" onClick={() => { setGameState(null); setChess(null); }}>New Game</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderBoard()}
              <div className="mt-4 text-center">
                {isThinking && <Badge variant="secondary" className="animate-pulse">Bot thinking...</Badge>}
                {gameState.status === 'finished' && <Badge className={gameState.result === 'player_wins' ? 'bg-green-500' : gameState.result === 'draw' ? 'bg-yellow-500' : 'bg-red-500'}>{gameState.result === 'player_wins' ? '🎉 You Won!' : gameState.result === 'draw' ? "🤝 Draw" : '😔 Lost'}</Badge>}
                {gameState.status === 'active' && !isThinking && <p className="text-sm text-muted-foreground">{chess.turn() === gameState.playerColor ? 'Your turn' : "Bot's turn"}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs Content */}
        {!gameState && (
          <div className="space-y-4">
            {activeTab === 'play' && (
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Gamepad2 className="w-5 h-5 text-primary" />Free Mode</CardTitle><CardDescription>Play vs bots - no rewards</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {['easy', 'normal', 'hard', 'pro'].map(d => <Button key={d} variant="outline" className="w-full justify-between" onClick={() => startBotGame(d, false)}><span className="capitalize">{d} Bot</span><ChevronRight className="w-4 h-4" /></Button>)}
                </CardContent>
              </Card>
            )}

            {activeTab === 'vip' && (
              !user?.isVip ? (
                <Card className="border-primary/50"><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" />VIP Arena</CardTitle><CardDescription>Earn chests and rewards!</CardDescription></CardHeader>
                <CardContent><Button className="w-full solana-gradient text-black" onClick={() => setShowVipDialog(true)}>Unlock VIP - ${VIP_PRICE_USDC}</Button></CardContent></Card>
              ) : (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />VIP Arena</CardTitle><CardDescription>Win = Bronze Chest! 5-streak = Silver + Gold Point!</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {user && <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-secondary"><div className="text-center"><p className="text-2xl font-bold text-primary">{user.stats?.vipCurrentStreak || 0}</p><p className="text-xs text-muted-foreground">Streak</p></div><Separator orientation="vertical" className="h-10" /><div className="text-center"><p className="text-2xl font-bold">{user.stats?.vipWins || 0}</p><p className="text-xs text-muted-foreground">Wins</p></div><Separator orientation="vertical" className="h-10" /><div className="text-center"><p className="text-2xl font-bold text-yellow-500">{user.goldPoints || 0}</p><p className="text-xs text-muted-foreground">Gold</p></div></div>}
                    {['easy', 'normal', 'hard', 'pro'].map(d => <Button key={d} variant="outline" className="w-full justify-between border-primary/30" onClick={() => startBotGame(d, true)}><span className="capitalize flex items-center gap-2"><Swords className="w-4 h-4" />{d}</span><Badge variant="secondary">Ranked</Badge></Button>)}
                  </CardContent>
                </Card>
              )
            )}

            {activeTab === 'inventory' && (
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" />Inventory</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {user ? (<>
                    <div><h3 className="font-semibold mb-2">Chests</h3>
                      <div className="grid grid-cols-3 gap-2">
                        <Card className="p-3 text-center"><div className="text-2xl">🟤</div><p className="text-sm font-bold">{user.chests?.bronze || 0}</p><p className="text-xs text-muted-foreground">Bronze</p>{user.chests?.bronze > 0 && <Button size="sm" className="mt-2 w-full" onClick={() => openChest('bronze')}>Open</Button>}</Card>
                        <Card className="p-3 text-center"><div className="text-2xl">⚪</div><p className="text-sm font-bold">{user.chests?.silver || 0}</p><p className="text-xs text-muted-foreground">Silver</p>{user.chests?.silver > 0 && <Button size="sm" className="mt-2 w-full" onClick={() => openChest('silver')}>Open</Button>}</Card>
                        <Card className="p-3 text-center"><div className="text-2xl">🟡</div><p className="text-sm font-bold">{user.chests?.gold || 0}</p><p className="text-xs text-muted-foreground">Gold</p>{user.chests?.gold > 0 && <Button size="sm" className="mt-2 w-full" onClick={() => openChest('gold')}>Open</Button>}</Card>
                      </div>
                    </div>
                    <div><h3 className="font-semibold mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Gold Points: {user.goldPoints || 0}</h3>{user.goldPoints >= 5 && <Button variant="outline" className="w-full" onClick={redeemGoldPoints}>Redeem 5 → Gold Chest</Button>}</div>
                    <div><h3 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" />Shards: {user.shards || 0}</h3></div>
                  </>) : <p className="text-center text-muted-foreground">Sign in to view</p>}
                </CardContent>
              </Card>
            )}

            {activeTab === 'friends' && (
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Friends</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {user ? (<>
                    <div className="p-3 rounded-lg bg-secondary"><p className="text-xs text-muted-foreground mb-1">Your Code</p><div className="flex items-center gap-2"><code className="text-lg font-bold">{user.friendCode}</code><Button variant="ghost" size="icon" onClick={copyFriendCode}>{copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</Button></div></div>
                    <div className="flex gap-2"><Input placeholder="Friend code" value={friendCode} onChange={(e) => setFriendCode(e.target.value.toUpperCase())} maxLength={8} /><Button onClick={addFriend}>Add</Button></div>
                    <ScrollArea className="h-40">{friends.length === 0 ? <p className="text-center text-muted-foreground py-4">No friends</p> : <div className="space-y-2">{friends.map(f => <div key={f.wallet} className="flex items-center justify-between p-2 rounded bg-secondary"><p className="font-mono text-sm">{f.friendCode}</p>{f.canGift && <Button variant="ghost" size="sm"><Gift className="w-4 h-4" /></Button>}</div>)}</div>}</ScrollArea>
                  </>) : <p className="text-center text-muted-foreground">Sign in</p>}
                </CardContent>
              </Card>
            )}

            {activeTab === 'profile' && (
              <><Card><CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />Profile</CardTitle></CardHeader>
                <CardContent>{user ? (<div className="space-y-4"><div className="p-3 rounded-lg bg-secondary"><p className="font-mono text-xs truncate">{user.wallet}</p></div><div className="grid grid-cols-2 gap-2"><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-xl font-bold text-green-500">{user.stats?.wins || 0}</p><p className="text-xs text-muted-foreground">Wins</p></div><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-xl font-bold text-red-500">{user.stats?.losses || 0}</p><p className="text-xs text-muted-foreground">Losses</p></div></div></div>) : <p className="text-center text-muted-foreground">Sign in</p>}</CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />Leaderboard</CardTitle></CardHeader>
                <CardContent><ScrollArea className="h-48">{leaderboard.length === 0 ? <p className="text-center text-muted-foreground py-4">No rankings</p> : <div className="space-y-2">{leaderboard.slice(0, 10).map((l, i) => <div key={l.wallet} className="flex items-center justify-between p-2 rounded bg-secondary"><div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-500 text-black' : 'bg-muted'}`}>{l.rank}</span><span className="font-mono text-sm">{l.friendCode}</span></div><Badge variant="outline">{l.wins}W</Badge></div>)}</div>}</ScrollArea></CardContent>
              </Card></>
            )}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      {!gameState && (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="container flex justify-around py-2">
            {tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${activeTab === t.id ? 'text-primary' : 'text-muted-foreground'}`}><t.icon className="w-5 h-5" /><span className="text-xs">{t.label}</span></button>)}
          </div>
        </nav>
      )}

      {/* VIP Dialog */}
      <Dialog open={showVipDialog} onOpenChange={setShowVipDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" />Unlock VIP</DialogTitle><DialogDescription>Lifetime access to VIP Arena!</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-secondary"><h3 className="font-bold mb-2">Benefits</h3><ul className="text-sm space-y-1 text-muted-foreground"><li>✓ VIP Arena ranked matches</li><li>✓ Bronze Chest on wins</li><li>✓ 5-streak = Silver + Gold Point</li><li>✓ Leaderboards</li></ul></div>
            <div className="text-center"><p className="text-3xl font-bold solana-text-gradient">${VIP_PRICE_USDC}</p></div>
            {!user ? <p className="text-center text-sm text-muted-foreground">Sign in first</p> : <WalletComponents authToken={authToken} user={user} showPayment onPaymentSuccess={handleVipPurchase} />}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
