'use client';

import { useState, useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider, useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl, SystemProgram, Transaction, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountInstruction, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import '@solana/wallet-adapter-react-ui/styles.css';

const VIP_PRICE_USDC = 6.99;
const DEVELOPER_WALLET = process.env.NEXT_PUBLIC_DEVELOPER_WALLET || 'YOUR_WALLET_HERE';
const USDC_MINT = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === 'mainnet'
  ? (process.env.NEXT_PUBLIC_USDC_MINT_MAINNET || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  : (process.env.NEXT_PUBLIC_USDC_MINT_DEVNET || '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

function WalletContent({ onAuthSuccess, authToken, user, showPayment, onPaymentSuccess }) {
  const { publicKey, signMessage, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const handleSignIn = async () => {
    if (!publicKey || !signMessage) return;
    setLoading(true);
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
        onAuthSuccess?.(data.token, data.user);
      } else {
        const error = await verifyRes.json();
        toast.error(error.error || 'Sign in failed');
      }
    } catch (e) { toast.error('Failed to sign in: ' + e.message); }
    finally { setLoading(false); }
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
      if (verifyRes.ok) { toast.success('🎉 VIP Activated!'); onPaymentSuccess?.(); }
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
      if (verifyRes.ok) { toast.success('🎉 VIP Activated!'); onPaymentSuccess?.(); }
      else { const error = await verifyRes.json(); toast.error(error.error); }
    } catch (e) { toast.error('Payment failed: ' + e.message); }
    finally { setPaymentLoading(false); }
  };

  if (showPayment) {
    return (
      <div className="space-y-2">
        <Button className="w-full" onClick={payWithUsdc} disabled={paymentLoading}>
          {paymentLoading ? 'Processing...' : `Pay ${VIP_PRICE_USDC} USDC`}
        </Button>
        <Button variant="outline" className="w-full" onClick={payWithSol} disabled={paymentLoading}>
          {paymentLoading ? 'Processing...' : 'Pay with SOL'}
        </Button>
        <p className="text-xs text-center text-muted-foreground">SOL price locked 30s</p>
      </div>
    );
  }

  if (!connected) {
    return <WalletMultiButton />;
  }

  if (!user) {
    return (
      <Button onClick={handleSignIn} disabled={loading} className="solana-gradient text-black">
        {loading ? 'Signing...' : 'Sign In'}
      </Button>
    );
  }

  return null;
}

export default function WalletComponents({ onAuthSuccess, authToken, user, showPayment, onPaymentSuccess }) {
  const network = useMemo(() => {
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
    return cluster === 'mainnet' ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet;
  }, []);

  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_RPC_URL;
    if (customRpc && customRpc.startsWith('http')) return customRpc;
    return clusterApiUrl(network);
  }, [network]);

  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], []);

  const onError = useCallback((error) => console.error('Wallet error:', error), []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          <WalletContent onAuthSuccess={onAuthSuccess} authToken={authToken} user={user} showPayment={showPayment} onPaymentSuccess={onPaymentSuccess} />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
