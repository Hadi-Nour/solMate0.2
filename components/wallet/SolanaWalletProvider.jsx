'use client';

import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';
import { ConnectionProvider } from '@solana/wallet-adapter-react';
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

// Lightweight wallet context that doesn't use heavy wallet-adapter
const WalletContext = createContext(null);

export function useSolanaWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useSolanaWallet must be used within SolanaWalletProvider');
  }
  return context;
}

// Re-export useWallet as alias for compatibility
export function useWallet() {
  return useSolanaWallet();
}

export function SolanaWalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletName, setWalletName] = useState(null);
  
  // Determine network from environment
  const network = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  }, []);
  
  // Get RPC endpoint
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) return customRpc;
    const networkMap = {
      'mainnet-beta': 'mainnet-beta',
      'testnet': 'testnet',
      'devnet': 'devnet',
    };
    return clusterApiUrl(networkMap[network] || 'devnet');
  }, [network]);

  // Check for existing wallet connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      // Check window.solana (Phantom)
      if (typeof window !== 'undefined' && window.solana?.isPhantom) {
        try {
          // Try to connect silently if already authorized
          const resp = await window.solana.connect({ onlyIfTrusted: true });
          if (resp.publicKey) {
            setPublicKey(resp.publicKey);
            setConnected(true);
            setWallet(window.solana);
            setWalletName('Phantom');
          }
        } catch (e) {
          // Not already connected, that's fine
        }
      }
      
      // Check window.solflare
      if (!connected && typeof window !== 'undefined' && window.solflare?.isSolflare) {
        try {
          if (window.solflare.isConnected && window.solflare.publicKey) {
            setPublicKey(window.solflare.publicKey);
            setConnected(true);
            setWallet(window.solflare);
            setWalletName('Solflare');
          }
        } catch (e) {
          // Not already connected
        }
      }
    };
    
    checkConnection();
  }, [connected]);
  
  // Connect to a specific wallet
  const connect = useCallback(async (walletType = 'phantom') => {
    setConnecting(true);
    
    try {
      let provider = null;
      let name = '';
      
      switch (walletType.toLowerCase()) {
        case 'phantom':
          if (window.solana?.isPhantom) {
            provider = window.solana;
            name = 'Phantom';
          } else {
            window.open('https://phantom.app/', '_blank');
            throw new Error('Phantom wallet not installed');
          }
          break;
          
        case 'solflare':
          if (window.solflare?.isSolflare) {
            provider = window.solflare;
            name = 'Solflare';
          } else {
            window.open('https://solflare.com/', '_blank');
            throw new Error('Solflare wallet not installed');
          }
          break;
          
        case 'backpack':
          if (window.backpack) {
            provider = window.backpack;
            name = 'Backpack';
          } else {
            window.open('https://backpack.app/', '_blank');
            throw new Error('Backpack wallet not installed');
          }
          break;
          
        case 'seeker':
        case 'seedvault':
          // On Seeker, try Phantom first as it's the default
          if (window.solana) {
            provider = window.solana;
            name = 'Seeker Wallet';
          } else {
            throw new Error('Seeker wallet not available');
          }
          break;
          
        default:
          throw new Error(`Unknown wallet: ${walletType}`);
      }
      
      if (!provider) {
        throw new Error(`${name} wallet not found`);
      }
      
      const resp = await provider.connect();
      setPublicKey(resp.publicKey);
      setConnected(true);
      setWallet(provider);
      setWalletName(name);
      
      return resp.publicKey.toString();
    } catch (error) {
      console.error('Connect error:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);
  
  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      if (wallet?.disconnect) {
        await wallet.disconnect();
      }
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    
    setPublicKey(null);
    setConnected(false);
    setWallet(null);
    setWalletName(null);
  }, [wallet]);
  
  // Sign message
  const signMessage = useCallback(async (message) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    const encodedMessage = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;
      
    const signedMessage = await wallet.signMessage(encodedMessage, 'utf8');
    return signedMessage.signature;
  }, [wallet, connected]);
  
  // Sign transaction
  const signTransaction = useCallback(async (transaction) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    return wallet.signTransaction(transaction);
  }, [wallet, connected]);
  
  // Sign and send transaction
  const signAndSendTransaction = useCallback(async (transaction, connection) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    // Sign the transaction
    const signed = await wallet.signTransaction(transaction);
    
    // Send it
    const signature = await connection.sendRawTransaction(signed.serialize());
    
    return signature;
  }, [wallet, connected]);
  
  // Get available wallets
  const getAvailableWallets = useCallback(() => {
    const available = [];
    
    if (typeof window === 'undefined') return available;
    
    // Seeker detection
    const isSeeker = isSolanaSeeker();
    const isMobile = isMobileDevice();
    
    // On Seeker, show Seeker wallet first
    if (isSeeker || isMobile) {
      if (window.solana) {
        available.push({
          name: 'Seeker Wallet',
          id: 'seeker',
          icon: '🌱',
          installed: true,
          recommended: isSeeker,
        });
      }
    }
    
    // Phantom
    if (window.solana?.isPhantom) {
      available.push({
        name: 'Phantom',
        id: 'phantom',
        icon: '👻',
        installed: true,
        recommended: !isSeeker,
      });
    } else {
      available.push({
        name: 'Phantom',
        id: 'phantom',
        icon: '👻',
        installed: false,
        downloadUrl: 'https://phantom.app/',
      });
    }
    
    // Solflare
    if (window.solflare?.isSolflare) {
      available.push({
        name: 'Solflare',
        id: 'solflare',
        icon: '🔥',
        installed: true,
      });
    } else {
      available.push({
        name: 'Solflare',
        id: 'solflare',
        icon: '🔥',
        installed: false,
        downloadUrl: 'https://solflare.com/',
      });
    }
    
    // Backpack
    if (window.backpack) {
      available.push({
        name: 'Backpack',
        id: 'backpack',
        icon: '🎒',
        installed: true,
      });
    } else {
      available.push({
        name: 'Backpack',
        id: 'backpack',
        icon: '🎒',
        installed: false,
        downloadUrl: 'https://backpack.app/',
      });
    }
    
    return available;
  }, []);
  
  const value = useMemo(() => ({
    publicKey,
    connected,
    connecting,
    wallet,
    walletName,
    network,
    endpoint,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAndSendTransaction,
    getAvailableWallets,
    isSeeker: isSolanaSeeker(),
    isMobile: isMobileDevice(),
  }), [
    publicKey, connected, connecting, wallet, walletName,
    network, endpoint, connect, disconnect, signMessage,
    signTransaction, signAndSendTransaction, getAvailableWallets
  ]);
  
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletContext.Provider value={value}>
        {children}
      </WalletContext.Provider>
    </ConnectionProvider>
  );
}

export default SolanaWalletProvider;
