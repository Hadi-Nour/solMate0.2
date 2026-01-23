'use client';

import { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gamepad2, Trophy, Package, Users, User, Crown, Swords, ChevronRight, Sparkles, Star, Copy, Check, X, Flag, Wallet } from 'lucide-react';

const PIECE_UNICODE = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟'
};

export default function SolMate() {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
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
  const [walletAddress, setWalletAddress] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('solmate_token');
    if (token) { setAuthToken(token); fetchUser(token); }
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setUser((await res.json()).user); }
      else { localStorage.removeItem('solmate_token'); setAuthToken(null); }
    } catch (e) { console.error('Failed to fetch user:', e); }
  };

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
        toast.success(`Game started! You're ${data.playerColor === 'w' ? 'White' : 'Black'}`);
      } else { toast.error(data.error); }
    } catch (e) { toast.error('Failed to start game'); }
  };

  const handleSquareClick = async (square) => {
    if (!chess || !gameState || gameState.status === 'finished' || isThinking) return;
    if (chess.turn() !== gameState.playerColor) return;
    const piece = chess.get(square);
    if (selectedSquare) {
      if (validMoves.includes(square)) { await makeMove(selectedSquare, square); }
      else if (piece && piece.color === chess.turn()) { setSelectedSquare(square); setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to)); }
      else { setSelectedSquare(null); setValidMoves([]); }
    } else if (piece && piece.color === chess.turn()) { setSelectedSquare(square); setValidMoves(chess.moves({ square, verbose: true }).map(m => m.to)); }
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
        setChess(new Chess(data.fen)); setSelectedSquare(null); setValidMoves([]);
        if (data.isGameOver) {
          const msg = data.result === 'player_wins' ? '🎉 You won!' + (data.rewards?.bronzeChest ? ` +${data.rewards.bronzeChest} Chest` : '') : data.result === 'draw' ? "🤝 Draw!" : '😔 Bot wins';
          toast.success(msg);
          setGameState({ ...gameState, status: 'finished', result: data.result });
          if (authToken) fetchUser(authToken);
        }
      } else { toast.error(data.error || 'Invalid move'); }
    } catch (e) { toast.error('Failed to make move'); }
    finally { setIsThinking(false); }
  };

  const resign = async () => {
    if (!gameState || gameState.status === 'finished') return;
    await fetch('/api/game/bot/resign', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) }, body: JSON.stringify({ gameId: gameState.gameId }) });
    toast.info('You resigned');
    setGameState({ ...gameState, status: 'finished', result: 'bot_wins' });
    if (authToken) fetchUser(authToken);
  };

  const loadFriends = async () => { if (authToken) { const r = await fetch('/api/friends', { headers: { Authorization: `Bearer ${authToken}` } }); if (r.ok) setFriends((await r.json()).friends || []); } };
  const addFriend = async () => { if (!friendCode || !authToken) return; const r = await fetch('/api/friends/add', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ friendCode }) }); if (r.ok) { toast.success('Friend added!'); setFriendCode(''); loadFriends(); } else toast.error((await r.json()).error); };
  const loadLeaderboard = async () => { const r = await fetch('/api/leaderboard?period=all'); if (r.ok) setLeaderboard((await r.json()).leaderboard || []); };
  const openChest = async (t) => { if (!authToken) return; const r = await fetch('/api/inventory/open-chest', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ chestType: t, count: 1 }) }); if (r.ok) { toast.success('Opened chest!'); fetchUser(authToken); } else toast.error((await r.json()).error); };
  const redeemGold = async () => { if (!authToken) return; const r = await fetch('/api/inventory/redeem-gold', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ count: 1 }) }); if (r.ok) { toast.success('Redeemed!'); fetchUser(authToken); } };
  const copyCode = () => { if (user?.friendCode) { navigator.clipboard.writeText(user.friendCode); setCopiedCode(true); setTimeout(() => setCopiedCode(false), 2000); } };

  useEffect(() => { if (activeTab === 'friends') loadFriends(); if (activeTab === 'profile') loadLeaderboard(); }, [activeTab, authToken]);

  const renderBoard = () => {
    if (!chess) return null;
    const board = chess.board();
    const flip = gameState?.playerColor === 'b';
    const files = flip ? ['h','g','f','e','d','c','b','a'] : ['a','b','c','d','e','f','g','h'];
    const ranks = flip ? ['1','2','3','4','5','6','7','8'] : ['8','7','6','5','4','3','2','1'];
    return (
      <div className="aspect-square w-full max-w-[360px] mx-auto">
        <div className="grid grid-cols-8 h-full w-full rounded-lg overflow-hidden shadow-xl border-2 border-primary/30">
          {ranks.map((rank, ri) => files.map((file, fi) => {
            const sq = `${file}${rank}`;
            const row = flip ? 7 - ri : ri, col = flip ? 7 - fi : fi;
            const p = board[row][col];
            const light = (row + col) % 2 === 0;
            const sel = selectedSquare === sq, valid = validMoves.includes(sq), has = p !== null;
            return (
              <button key={sq} onClick={() => handleSquareClick(sq)} disabled={isThinking || gameState?.status === 'finished'}
                className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl transition-all ${light ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'} ${sel ? 'ring-4 ring-primary ring-inset bg-primary/40' : ''} ${valid && !has ? 'relative' : ''} ${valid && has ? 'ring-4 ring-primary/60 ring-inset' : ''} hover:brightness-110`}>
                {valid && !has && <div className="absolute w-1/3 h-1/3 rounded-full bg-primary/50" />}
                {p && <span className={p.color === 'w' ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-gray-900'}>{PIECE_UNICODE[p.color === 'w' ? p.type.toUpperCase() : p.type]}</span>}
              </button>
            );
          }))}
        </div>
      </div>
    );
  };

  const tabs = [{ id: 'play', icon: Gamepad2, label: 'Play' }, { id: 'vip', icon: Crown, label: 'VIP' }, { id: 'inventory', icon: Package, label: 'Items' }, { id: 'friends', icon: Users, label: 'Friends' }, { id: 'profile', icon: User, label: 'Profile' }];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg solana-gradient flex items-center justify-center"><Swords className="w-5 h-5 text-black" /></div><span className="font-bold text-lg solana-text-gradient">SolMate</span></div>
          <div className="flex items-center gap-2">
            {user?.isVip && <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black"><Crown className="w-3 h-3 mr-1" />VIP</Badge>}
            {!walletAddress ? <Button onClick={connectWallet} className="solana-gradient text-black"><Wallet className="w-4 h-4 mr-2" />Connect</Button>
              : !user ? <Button onClick={signIn} className="solana-gradient text-black">Sign In</Button>
              : <Button variant="outline" size="sm" onClick={signOut}>{walletAddress.slice(0,4)}...{walletAddress.slice(-4)}</Button>}
          </div>
        </div>
      </header>

      <main className="container py-4 pb-20">
        {gameState && chess && (
          <Card className="mb-4">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2"><Badge variant={gameState.isVipArena ? 'default' : 'secondary'}>{gameState.isVipArena ? 'VIP' : 'Free'}</Badge><Badge variant="outline">{gameState.difficulty}</Badge></div>
                <div className="flex items-center gap-2">
                  {gameState.status === 'active' && (<><Button variant="ghost" size="sm" onClick={() => { setGameState(null); setChess(null); }}><X className="w-4 h-4" /></Button><Button variant="destructive" size="sm" onClick={resign}><Flag className="w-4 h-4" /></Button></>)}
                  {gameState.status === 'finished' && <Button size="sm" onClick={() => { setGameState(null); setChess(null); }}>New Game</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {renderBoard()}
              <div className="mt-4 text-center">
                {isThinking && <Badge variant="secondary" className="animate-pulse">Bot thinking...</Badge>}
                {gameState.status === 'finished' && <Badge className={gameState.result === 'player_wins' ? 'bg-green-500' : gameState.result === 'draw' ? 'bg-yellow-500' : 'bg-red-500'}>{gameState.result === 'player_wins' ? '🎉 Won!' : gameState.result === 'draw' ? "🤝 Draw" : '😔 Lost'}</Badge>}
                {gameState.status === 'active' && !isThinking && <p className="text-sm text-muted-foreground">{chess.turn() === gameState.playerColor ? 'Your turn' : "Bot's turn"}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {!gameState && (
          <div className="space-y-4">
            {activeTab === 'play' && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Gamepad2 className="w-5 h-5 text-primary" />Free Mode</CardTitle><CardDescription>Play vs bots</CardDescription></CardHeader><CardContent className="space-y-2">{['easy','normal','hard','pro'].map(d => <Button key={d} variant="outline" className="w-full justify-between" onClick={() => startBotGame(d,false)}><span className="capitalize">{d}</span><ChevronRight className="w-4 h-4" /></Button>)}</CardContent></Card>}

            {activeTab === 'vip' && (!user?.isVip ? <Card className="border-primary/50"><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" />VIP Arena</CardTitle><CardDescription>Earn rewards!</CardDescription></CardHeader><CardContent><Button className="w-full solana-gradient text-black" onClick={() => setShowVipDialog(true)}>Unlock VIP - $6.99</Button></CardContent></Card>
              : <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />VIP Arena</CardTitle><CardDescription>Win = Chest! 5-streak = Bonus!</CardDescription></CardHeader>
              <CardContent className="space-y-2">{user && <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-secondary"><div className="text-center"><p className="text-2xl font-bold text-primary">{user.stats?.vipCurrentStreak||0}</p><p className="text-xs text-muted-foreground">Streak</p></div><Separator orientation="vertical" className="h-10" /><div className="text-center"><p className="text-2xl font-bold">{user.stats?.vipWins||0}</p><p className="text-xs text-muted-foreground">Wins</p></div><Separator orientation="vertical" className="h-10" /><div className="text-center"><p className="text-2xl font-bold text-yellow-500">{user.goldPoints||0}</p><p className="text-xs text-muted-foreground">Gold</p></div></div>}
              {['easy','normal','hard','pro'].map(d => <Button key={d} variant="outline" className="w-full justify-between border-primary/30" onClick={() => startBotGame(d,true)}><span className="capitalize flex items-center gap-2"><Swords className="w-4 h-4" />{d}</span><Badge variant="secondary">Ranked</Badge></Button>)}</CardContent></Card>)}

            {activeTab === 'inventory' && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" />Inventory</CardTitle></CardHeader><CardContent className="space-y-4">{user ? (<><div><h3 className="font-semibold mb-2">Chests</h3><div className="grid grid-cols-3 gap-2"><Card className="p-3 text-center"><div className="text-2xl">🟤</div><p className="text-sm font-bold">{user.chests?.bronze||0}</p>{user.chests?.bronze>0 && <Button size="sm" className="mt-2 w-full" onClick={() => openChest('bronze')}>Open</Button>}</Card><Card className="p-3 text-center"><div className="text-2xl">⚪</div><p className="text-sm font-bold">{user.chests?.silver||0}</p>{user.chests?.silver>0 && <Button size="sm" className="mt-2 w-full" onClick={() => openChest('silver')}>Open</Button>}</Card><Card className="p-3 text-center"><div className="text-2xl">🟡</div><p className="text-sm font-bold">{user.chests?.gold||0}</p>{user.chests?.gold>0 && <Button size="sm" className="mt-2 w-full" onClick={() => openChest('gold')}>Open</Button>}</Card></div></div><div><h3 className="font-semibold mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Gold: {user.goldPoints||0}</h3>{user.goldPoints>=5 && <Button variant="outline" className="w-full" onClick={redeemGold}>Redeem 5 → Gold Chest</Button>}</div><div><h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" />Shards: {user.shards||0}</h3></div></>) : <p className="text-center text-muted-foreground">Sign in to view</p>}</CardContent></Card>}

            {activeTab === 'friends' && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Friends</CardTitle></CardHeader><CardContent className="space-y-4">{user ? (<><div className="p-3 rounded-lg bg-secondary"><p className="text-xs text-muted-foreground mb-1">Your Code</p><div className="flex items-center gap-2"><code className="text-lg font-bold">{user.friendCode}</code><Button variant="ghost" size="icon" onClick={copyCode}>{copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</Button></div></div><div className="flex gap-2"><Input placeholder="Friend code" value={friendCode} onChange={(e) => setFriendCode(e.target.value.toUpperCase())} maxLength={8} /><Button onClick={addFriend}>Add</Button></div><ScrollArea className="h-40">{friends.length===0 ? <p className="text-center text-muted-foreground py-4">No friends</p> : <div className="space-y-2">{friends.map(f => <div key={f.wallet} className="flex items-center justify-between p-2 rounded bg-secondary"><p className="font-mono text-sm">{f.friendCode}</p></div>)}</div>}</ScrollArea></>) : <p className="text-center text-muted-foreground">Sign in</p>}</CardContent></Card>}

            {activeTab === 'profile' && (<><Card><CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />Profile</CardTitle></CardHeader><CardContent>{user ? (<div className="space-y-4"><div className="p-3 rounded-lg bg-secondary"><p className="font-mono text-xs truncate">{user.wallet}</p></div><div className="grid grid-cols-2 gap-2"><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-xl font-bold text-green-500">{user.stats?.wins||0}</p><p className="text-xs text-muted-foreground">Wins</p></div><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-xl font-bold text-red-500">{user.stats?.losses||0}</p><p className="text-xs text-muted-foreground">Losses</p></div></div></div>) : <p className="text-center text-muted-foreground">Sign in</p>}</CardContent></Card>
            <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />Leaderboard</CardTitle></CardHeader><CardContent><ScrollArea className="h-48">{leaderboard.length===0 ? <p className="text-center text-muted-foreground py-4">No rankings</p> : <div className="space-y-2">{leaderboard.slice(0,10).map((l,i) => <div key={l.wallet} className="flex items-center justify-between p-2 rounded bg-secondary"><div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i<3?'bg-yellow-500 text-black':'bg-muted'}`}>{l.rank}</span><span className="font-mono text-sm">{l.friendCode}</span></div><Badge variant="outline">{l.wins}W</Badge></div>)}</div>}</ScrollArea></CardContent></Card></>)}
          </div>
        )}
      </main>

      {!gameState && <nav className="fixed bottom-0 left-0 right-0 border-t border-border bg-background/95 backdrop-blur"><div className="container flex justify-around py-2">{tabs.map(t => <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg ${activeTab===t.id?'text-primary':'text-muted-foreground'}`}><t.icon className="w-5 h-5" /><span className="text-xs">{t.label}</span></button>)}</div></nav>}

      <Dialog open={showVipDialog} onOpenChange={setShowVipDialog}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" />Unlock VIP</DialogTitle><DialogDescription>Lifetime access!</DialogDescription></DialogHeader><div className="space-y-4"><div className="p-4 rounded-lg bg-secondary"><h3 className="font-bold mb-2">Benefits</h3><ul className="text-sm space-y-1 text-muted-foreground"><li>✓ VIP Arena</li><li>✓ Chests on wins</li><li>✓ 5-streak bonus</li><li>✓ Leaderboards</li></ul></div><div className="text-center"><p className="text-3xl font-bold solana-text-gradient">$6.99</p></div><p className="text-center text-sm text-muted-foreground">Connect Phantom wallet and pay with USDC/SOL</p></div></DialogContent></Dialog>
    </div>
  );
}
