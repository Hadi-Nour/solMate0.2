'use client';

import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { clusterApiUrl, Connection } from '@solana/web3.js';

// Detect if running on Solana Seeker (mobile with Seed Vault)
export function isSolanaSeeker() {
  if (typeof window === 'undefined') return false;
  
  // Check user agent for Seeker browser
  const ua = navigator.userAgent.toLowerCase();
  const isSeeker = ua.includes('seeker') || ua.includes('solanamobile');
  
  // Also check for mobile wallet adapter availability
  const hasMWA = typeof window !== 'undefined' && 
    (window.solana?.isSeedVault || 
     window.solana?.isSolanaMobile ||
     'solana' in window && window.solana?.isSeeker);
  
  return isSeeker || hasMWA;
}

// Detect mobile device
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Lazy load wallet adapters to avoid memory issues
const getWalletAdapters = async () => {
  const adapters = [];
  
  try {
    // Mobile Wallet Adapter for Seeker/Seed Vault (priority on mobile)
    if (isMobileDevice()) {
      const { SolanaMobileWalletAdapter } = await import('@solana-mobile/wallet-adapter-mobile');
      adapters.push(new SolanaMobileWalletAdapter({
        appIdentity: {
          name: 'SolMate',
          uri: typeof window !== 'undefined' ? window.location.origin : '',
          icon: '/icon-192.svg',
        },
        authorizationResultCache: {
          get: async () => {
            if (typeof localStorage !== 'undefined') {
              const cached = localStorage.getItem('solmate_mwa_auth');
              return cached ? JSON.parse(cached) : null;
            }
            return null;
          },
          set: async (result) => {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem('solmate_mwa_auth', JSON.stringify(result));
            }
          },
          clear: async () => {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('solmate_mwa_auth');
            }
          }
        },
        cluster: process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet-beta' 
          ? 'mainnet-beta' 
          : 'devnet',
        addressSelector: {
          select: async (addresses) => addresses[0],
        },
      }));
    }
    
    // Standard wallet adapters
    const { PhantomWalletAdapter } = await import('@solana/wallet-adapter-wallets');
    const { SolflareWalletAdapter } = await import('@solana/wallet-adapter-wallets');
    const { BackpackWalletAdapter } = await import('@solana/wallet-adapter-wallets');
    const { CoinbaseWalletAdapter } = await import('@solana/wallet-adapter-wallets');
    
    adapters.push(
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
      new CoinbaseWalletAdapter(),
    );
  } catch (error) {
    console.error('Failed to load wallet adapters:', error);
  }
  
  return adapters;
};

// Context for wallet connection state
const SolanaWalletContext = React.createContext(null);

export function useSolanaWallet() {
  const context = React.useContext(SolanaWalletContext);
  if (!context) {
    throw new Error('useSolanaWallet must be used within SolanaWalletProvider');
  }
  return context;
}

function WalletContextProvider({ children }) {
  const wallet = useWallet();
  const [isSeeker, setIsSeeker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsSeeker(isSolanaSeeker());
    setIsMobile(isMobileDevice());
  }, []);
  
  const value = useMemo(() => ({
    ...wallet,
    isSeeker,
    isMobile,
  }), [wallet, isSeeker, isMobile]);
  
  return (
    <SolanaWalletContext.Provider value={value}>
      {children}
    </SolanaWalletContext.Provider>
  );
}

export function SolanaWalletProvider({ children }) {
  const [wallets, setWallets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
  
  // Lazy load wallets
  useEffect(() => {
    let mounted = true;
    
    const loadWallets = async () => {
      try {
        const adapters = await getWalletAdapters();
        if (mounted) {
          setWallets(adapters);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Failed to load wallets:', error);
        if (mounted) {
          setIsLoading(false);
        }
      }
    };
    
    loadWallets();
    
    return () => {
      mounted = false;
    };
  }, []);
  
  // Auto-connect configuration
  const onError = useCallback((error) => {
    console.error('Wallet error:', error);
  }, []);
  
  if (isLoading) {
    return <>{children}</>;
  }
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider 
        wallets={wallets} 
        autoConnect={true}
        onError={onError}
      >
        <WalletContextProvider>
          {children}
        </WalletContextProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export default SolanaWalletProvider;
