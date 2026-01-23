'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import { Chess } from 'chess.js';
import bs58 from 'bs58';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Gamepad2, Trophy, ShoppingBag, Package, Users, User, Crown, Swords, ChevronRight, Gift, Sparkles, Star, LogOut, Copy, Check, X, Flag } from 'lucide-react';
import ChessBoard from '@/components/chess/ChessBoard';
import BottomNav from '@/components/navigation/BottomNav';
import VipDialog from '@/components/dialogs/VipDialog';

const VIP_PRICE_USDC = 6.99;
const DEVELOPER_WALLET = process.env.NEXT_PUBLIC_DEVELOPER_WALLET || 'YOUR_WALLET_HERE';
const USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet'
  ? process.env.NEXT_PUBLIC_USDC_MINT_MAINNET
  : process.env.NEXT_PUBLIC_USDC_MINT_DEVNET;

export default function SolMate() {
  const { publicKey, signMessage, sendTransaction, connected, disconnect } = useWallet();
  const { connection } = useConnection();
  
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
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [friends, setFriends] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('solmate_token');
    if (token) {
      setAuthToken(token);
      fetchUser(token);
    }
  }, []);

  const fetchUser = async (token) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('solmate_token');
        setAuthToken(null);
      }
    } catch (e) { console.error('Failed to fetch user:', e); }
  };

  const handleSignIn = async () => {
    if (!publicKey || !signMessage) return;
    setIsLoading(true);
    try {
      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58() })
      });
      const { nonce, messageToSign } = await nonceRes.json();
      const encodedMessage = new TextEncoder().encode(messageToSign);
      const signature = await signMessage(encodedMessage);
      const signatureBase58 = bs58.encode(signature);
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: publicKey.toBase58(), nonce, signature: signatureBase58 })
      });
      if (verifyRes.ok) {
        const data = await verifyRes.json();
        setAuthToken(data.token);
        setUser(data.user);
        localStorage.setItem('solmate_token', data.token);
        toast.success('Signed in successfully!');
      } else {
        const error = await verifyRes.json();
        toast.error(error.error || 'Sign in failed');
      }
    } catch (e) { toast.error('Failed to sign in'); }
    finally { setIsLoading(false); }
  };

  const handleSignOut = async () => {
    try { await fetch('/api/auth/logout', { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('solmate_token');
    setAuthToken(null); setUser(null); setGameState(null); setChess(null);
    disconnect();
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
      let promotion = undefined;
      const piece = chess.get(from);
      if (piece?.type === 'p') {
        const targetRank = gameState.playerColor === 'w' ? '8' : '1';
        if (to[1] === targetRank) promotion = 'q';
      }
      const res = await fetch('/api/game/bot/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ gameId: gameState.gameId, from, to, promotion })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setChess(new Chess(data.fen)); setSelectedSquare(null); setValidMoves([]);
        if (data.isGameOver) {
          let message = data.result === 'player_wins' ? '🎉 You won!' : data.result === 'draw' ? "🤝 It's a draw!" : '😔 Bot wins';
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
    try {
      await fetch('/api/game/bot/resign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
        body: JSON.stringify({ gameId: gameState.gameId })
      });
      toast.info('You resigned');
      setGameState({ ...gameState, status: 'finished', result: 'bot_wins' });
      if (authToken) fetchUser(authToken);
    } catch (e) { toast.error('Failed to resign'); }
  };

  const payWithUsdc = async () => {
    if (!publicKey || !sendTransaction) return;
    setPaymentLoading(true);
    try {
      const developerWallet = new PublicKey(DEVELOPER_WALLET);
      const usdcMint = new PublicKey(USDC_MINT);
      const amount = Math.floor(VIP_PRICE_USDC * 1_000_000);
      const senderAta = await getAssociatedTokenAddress(usdcMint, publicKey);
      const recipientAta = await getAssociatedTokenAddress(usdcMint, developerWallet);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const transaction = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight });
      try { await getAccount(connection, recipientAta); }
      catch { transaction.add(createAssociatedTokenAccountInstruction(publicKey, recipientAta, developerWallet, usdcMint)); }
      transaction.add(createTransferInstruction(senderAta, recipientAta, publicKey, amount));
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
      const verifyRes = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ signature, paymentType: 'USDC', expectedAmount: VIP_PRICE_USDC })
      });
      if (verifyRes.ok) { toast.success('🎉 VIP Activated!'); setShowVipDialog(false); fetchUser(authToken); }
      else { const error = await verifyRes.json(); toast.error(error.error); }
    } catch (e) { toast.error('Payment failed: ' + e.message); }
    finally { setPaymentLoading(false); }
  };

  const payWithSol = async () => {
    if (!publicKey || !sendTransaction) return;
    setPaymentLoading(true);
    try {
      const quoteRes = await fetch('/api/payments/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usdAmount: VIP_PRICE_USDC }) });
      const quote = await quoteRes.json();
      const solAmount = parseFloat(quote.solAmount);
      const developerWallet = new PublicKey(DEVELOPER_WALLET);
      const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const transaction = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight })
        .add(SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: developerWallet, lamports }));
      const signature = await sendTransaction(transaction, connection);
      await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight });
      const verifyRes = await fetch('/api/payments/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ signature, paymentType: 'SOL', expectedAmount: solAmount, quoteId: quote.quoteId })
      });
      if (verifyRes.ok) { toast.success('🎉 VIP Activated!'); setShowVipDialog(false); fetchUser(authToken); }
      else { const error = await verifyRes.json(); toast.error(error.error); }
    } catch (e) { toast.error('Payment failed: ' + e.message); }
    finally { setPaymentLoading(false); }
  };

  const loadFriends = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/friends', { headers: { Authorization: `Bearer ${authToken}` } });
      if (res.ok) { const data = await res.json(); setFriends(data.friends || []); }
    } catch (e) {}
  };

  const addFriend = async () => {
    if (!friendCode || !authToken) return;
    try {
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ friendCode })
      });
      const data = await res.json();
      if (res.ok) { toast.success('Friend added!'); setFriendCode(''); loadFriends(); }
      else { toast.error(data.error); }
    } catch (e) { toast.error('Failed to add friend'); }
  };

  const loadLeaderboard = async () => {
    try {
      const res = await fetch('/api/leaderboard?period=all');
      if (res.ok) { const data = await res.json(); setLeaderboard(data.leaderboard || []); }
    } catch (e) {}
  };

  const openChest = async (type) => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/inventory/open-chest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ chestType: type, count: 1 })
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Opened chest! Got ${data.rewards.length} items`); fetchUser(authToken); }
      else { toast.error(data.error); }
    } catch (e) { toast.error('Failed to open chest'); }
  };

  const redeemGoldPoints = async () => {
    if (!authToken) return;
    try {
      const res = await fetch('/api/inventory/redeem-gold', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ count: 1 })
      });
      if (res.ok) { toast.success('Redeemed 1 Gold Chest!'); fetchUser(authToken); }
    } catch (e) { toast.error('Failed to redeem'); }
  };

  const copyFriendCode = () => {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg solana-gradient flex items-center justify-center">
              <Swords className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-lg solana-text-gradient">SolMate</span>
          </div>
          <div className="flex items-center gap-2">
            {user?.isVip && <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-black"><Crown className="w-3 h-3 mr-1" /> VIP</Badge>}
            {!connected ? <WalletMultiButton /> : !user ? <Button onClick={handleSignIn} disabled={isLoading} className="solana-gradient text-black">{isLoading ? 'Signing...' : 'Sign In'}</Button> : <Button variant="outline" size="icon" onClick={handleSignOut}><LogOut className="w-4 h-4" /></Button>}
          </div>
        </div>
      </header>

      <main className="container py-4 pb-20">
        {gameState && chess && (
          <Card className="mb-4">
            <CardHeader className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant={gameState.isVipArena ? 'default' : 'secondary'}>{gameState.isVipArena ? 'VIP Arena' : 'Free Mode'}</Badge>
                  <Badge variant="outline">{gameState.difficulty}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {gameState.status === 'active' && (
                    <><Button variant="ghost" size="sm" onClick={() => { setGameState(null); setChess(null); }}><X className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={handleResign}><Flag className="w-4 h-4 mr-1" /> Resign</Button></>
                  )}
                  {gameState.status === 'finished' && <Button size="sm" onClick={() => { setGameState(null); setChess(null); }}>New Game</Button>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChessBoard chess={chess} gameState={gameState} selectedSquare={selectedSquare} validMoves={validMoves} onSquareClick={handleSquareClick} isThinking={isThinking} />
              <div className="mt-4 text-center">
                {isThinking && <Badge variant="secondary" className="animate-pulse">Bot is thinking...</Badge>}
                {gameState.status === 'finished' && <Badge className={gameState.result === 'player_wins' ? 'bg-green-500' : gameState.result === 'draw' ? 'bg-yellow-500' : 'bg-red-500'}>{gameState.result === 'player_wins' ? '🎉 You Won!' : gameState.result === 'draw' ? "🤝 Draw" : '😔 You Lost'}</Badge>}
                {gameState.status === 'active' && !isThinking && <p className="text-sm text-muted-foreground">{chess.turn() === gameState.playerColor ? 'Your turn' : "Bot's turn"}</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {!gameState && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="play" className="space-y-4 mt-0">
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2"><Gamepad2 className="w-5 h-5 text-primary" />Free Mode</CardTitle><CardDescription>Play vs bots - no rewards, just practice!</CardDescription></CardHeader>
                <CardContent className="space-y-2">
                  {['easy', 'normal', 'hard', 'pro'].map(d => <Button key={d} variant="outline" className="w-full justify-between" onClick={() => startBotGame(d, false)}><span className="capitalize">{d} Bot</span><ChevronRight className="w-4 h-4" /></Button>)}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="vip" className="space-y-4 mt-0">
              {!user?.isVip ? (
                <Card className="border-primary/50"><CardHeader><CardTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" />VIP Arena</CardTitle><CardDescription>Earn chests and rewards! Requires VIP.</CardDescription></CardHeader>
                <CardContent><Button className="w-full solana-gradient text-black" onClick={() => setShowVipDialog(true)}>Unlock VIP - ${VIP_PRICE_USDC} USDC</Button></CardContent></Card>
              ) : (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />VIP Arena</CardTitle><CardDescription>Win to earn Bronze Chests! 5-win streak = Silver + Gold Point!</CardDescription></CardHeader>
                  <CardContent className="space-y-2">
                    {user && <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-secondary"><div className="text-center"><p className="text-2xl font-bold text-primary">{user.stats?.vipCurrentStreak || 0}</p><p className="text-xs text-muted-foreground">Streak</p></div><Separator orientation="vertical" className="h-10" /><div className="text-center"><p className="text-2xl font-bold">{user.stats?.vipWins || 0}</p><p className="text-xs text-muted-foreground">Wins</p></div><Separator orientation="vertical" className="h-10" /><div className="text-center"><p className="text-2xl font-bold text-yellow-500">{user.goldPoints || 0}</p><p className="text-xs text-muted-foreground">Gold</p></div></div>}
                    {['easy', 'normal', 'hard', 'pro'].map(d => <Button key={d} variant="outline" className="w-full justify-between border-primary/30" onClick={() => startBotGame(d, true)}><span className="capitalize flex items-center gap-2"><Swords className="w-4 h-4" />{d} Bot</span><Badge variant="secondary">Ranked</Badge></Button>)}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="shop" className="space-y-4 mt-0">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShoppingBag className="w-5 h-5 text-primary" />Shop</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!user?.isVip && <Card className="border-yellow-500/50 bg-yellow-500/10"><CardContent className="pt-4"><div className="flex items-center justify-between"><div><h3 className="font-bold flex items-center gap-2"><Crown className="w-5 h-5 text-yellow-500" />VIP Lifetime</h3><p className="text-sm text-muted-foreground">Access VIP Arena + earn rewards</p></div><Button className="solana-gradient text-black" onClick={() => setShowVipDialog(true)}>${VIP_PRICE_USDC}</Button></div></CardContent></Card>}
                  <p className="text-sm text-muted-foreground text-center">More cosmetics coming soon!</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-0">
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
                    <div><h3 className="font-semibold mb-2 flex items-center gap-2"><Star className="w-4 h-4 text-yellow-500" />Gold Points: {user.goldPoints || 0}</h3>{user.goldPoints >= 5 && <Button variant="outline" className="w-full" onClick={redeemGoldPoints}>Redeem 5 Points → 1 Gold Chest</Button>}</div>
                    <div><h3 className="font-semibold mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4 text-purple-500" />Shards: {user.shards || 0}</h3><p className="text-xs text-muted-foreground">Craft cosmetics coming soon!</p></div>
                  </>) : <p className="text-center text-muted-foreground">Sign in to view inventory</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="friends" className="space-y-4 mt-0">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-primary" />Friends</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {user ? (<>
                    <div className="p-3 rounded-lg bg-secondary"><p className="text-xs text-muted-foreground mb-1">Your Friend Code</p><div className="flex items-center gap-2"><code className="text-lg font-bold tracking-wider">{user.friendCode}</code><Button variant="ghost" size="icon" onClick={copyFriendCode}>{copiedCode ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}</Button></div></div>
                    <div className="flex gap-2"><Input placeholder="Enter friend code" value={friendCode} onChange={(e) => setFriendCode(e.target.value.toUpperCase())} maxLength={8} /><Button onClick={addFriend}>Add</Button></div>
                    <ScrollArea className="h-48">{friends.length === 0 ? <p className="text-center text-muted-foreground py-4">No friends yet</p> : <div className="space-y-2">{friends.map(f => <div key={f.wallet} className="flex items-center justify-between p-2 rounded bg-secondary"><div><p className="font-mono text-sm">{f.wallet.slice(0, 8)}...</p><p className="text-xs text-muted-foreground">{f.friendCode}</p></div>{f.canGift && <Button variant="ghost" size="sm"><Gift className="w-4 h-4" /></Button>}</div>)}</div>}</ScrollArea>
                  </>) : <p className="text-center text-muted-foreground">Sign in to manage friends</p>}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile" className="space-y-4 mt-0">
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5 text-primary" />Profile</CardTitle></CardHeader>
                <CardContent>{user ? (<div className="space-y-4"><div className="p-3 rounded-lg bg-secondary"><p className="text-xs text-muted-foreground">Wallet</p><p className="font-mono text-sm truncate">{user.wallet}</p></div><div className="grid grid-cols-2 gap-2"><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-2xl font-bold text-green-500">{user.stats?.wins || 0}</p><p className="text-xs text-muted-foreground">Wins</p></div><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-2xl font-bold text-red-500">{user.stats?.losses || 0}</p><p className="text-xs text-muted-foreground">Losses</p></div><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-2xl font-bold text-primary">{user.stats?.currentStreak || 0}</p><p className="text-xs text-muted-foreground">Streak</p></div><div className="p-3 rounded-lg bg-secondary text-center"><p className="text-2xl font-bold text-yellow-500">{user.stats?.bestStreak || 0}</p><p className="text-xs text-muted-foreground">Best</p></div></div></div>) : <p className="text-center text-muted-foreground">Sign in to view profile</p>}</CardContent>
              </Card>
              <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-yellow-500" />VIP Leaderboard</CardTitle></CardHeader>
                <CardContent><ScrollArea className="h-64">{leaderboard.length === 0 ? <p className="text-center text-muted-foreground py-4">No rankings yet</p> : <div className="space-y-2">{leaderboard.slice(0, 10).map((l, i) => <div key={l.wallet} className="flex items-center justify-between p-2 rounded bg-secondary"><div className="flex items-center gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-gray-400 text-black' : i === 2 ? 'bg-amber-600 text-black' : 'bg-muted'}`}>{l.rank}</span><div><p className="font-mono text-sm">{l.friendCode || l.wallet.slice(0, 8)}</p><p className="text-xs text-muted-foreground">{l.wins}W / {l.losses}L</p></div></div><Badge variant="outline">{l.bestStreak} 🔥</Badge></div>)}</div>}</ScrollArea></CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>

      {!gameState && <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />}
      <VipDialog open={showVipDialog} onOpenChange={setShowVipDialog} user={user} onPayUsdc={payWithUsdc} onPaySol={payWithSol} loading={paymentLoading} price={VIP_PRICE_USDC} />
    </div>
  );
}
