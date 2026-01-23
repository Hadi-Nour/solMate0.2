'use client';

import React, { useMemo, useCallback } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import { Toaster } from '@/components/ui/sonner';

// Import wallet adapter styles
import '@solana/wallet-adapter-react-ui/styles.css';

export function Providers({ children }) {
  // Get network from env
  const network = useMemo(() => {
    const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || 'devnet';
    switch (cluster) {
      case 'mainnet':
        return WalletAdapterNetwork.Mainnet;
      case 'testnet':
        return WalletAdapterNetwork.Testnet;
      default:
        return WalletAdapterNetwork.Devnet;
    }
  }, []);

  // Use custom RPC or fallback
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_RPC_URL;
    if (customRpc && customRpc.startsWith('http')) {
      return customRpc;
    }
    return clusterApiUrl(network);
  }, [network]);

  // Initialize wallets
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  const onError = useCallback((error) => {
    console.error('Wallet error:', error);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          {children}
          <Toaster position="bottom-center" />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
