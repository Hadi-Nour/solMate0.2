'use client';

import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet as useWalletAdapter, useConnection } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';

// Detect if running on Solana Seeker (mobile with Seed Vault)
export function isSolanaSeeker() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('seeker') || ua.includes('solanamobile');
}

// Detect mobile device
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Context for additional wallet state
const WalletExtContext = createContext(null);

export function useSolanaWallet() {
  return useContext(WalletExtContext);
}

export function useWallet() {
  return useWalletAdapter();
}

export { useConnection };

function WalletExtProvider({ children }) {
  const wallet = useWalletAdapter();
  const { connection } = useConnection();
  const [isSeeker, setIsSeeker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsSeeker(isSolanaSeeker());
    setIsMobile(isMobileDevice());
  }, []);
  
  const value = useMemo(() => ({
    ...wallet,
    connection,
    isSeeker,
    isMobile,
  }), [wallet, connection, isSeeker, isMobile]);
  
  return (
    <WalletExtContext.Provider value={value}>
      {children}
    </WalletExtContext.Provider>
  );
}

export function SolanaWalletProvider({ children }) {
  // Determine network from environment
  const network = useMemo(() => {
    const env = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    if (env === 'mainnet-beta') return WalletAdapterNetwork.Mainnet;
    if (env === 'testnet') return WalletAdapterNetwork.Testnet;
    return WalletAdapterNetwork.Devnet;
  }, []);
  
  // Get RPC endpoint
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) return customRpc;
    return clusterApiUrl(network);
  }, [network]);
  
  // Initialize wallets - keep this minimal to avoid memory issues
  const wallets = useMemo(() => {
    // Start with basic adapters that don't require heavy dependencies
    const adapters = [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ];
    return adapters;
  }, []);
  
  // Auto-connect configuration
  const onError = useCallback((error) => {
    console.error('Wallet error:', error);
  }, []);
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={onError}
      >
        <WalletExtProvider>
          {children}
        </WalletExtProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default SolanaWalletProvider;
