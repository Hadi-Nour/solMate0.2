'use client';

import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';

// Detect if running on Solana Seeker (mobile with Seed Vault)
export function isSolanaSeeker() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  // Check for Seeker device or Solana Mobile wallet adapter
  return ua.includes('seeker') || ua.includes('solanamobile') || 
         // Check if the Seed Vault / SolanaMobileWalletAdapter is available
         !!(window.SolanaMobileWalletAdapter || window.solana?.isSeedVault);
}

// Detect mobile device
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Check if Seed Vault is available (built-in Seeker wallet)
export function hasSeedVault() {
  if (typeof window === 'undefined') return false;
  // Multiple ways Seed Vault can be detected:
  // 1. Direct Seed Vault flag
  // 2. Solana Mobile Wallet Adapter
  // 3. Standard wallet with isSeedVault property
  return !!(
    window.SolanaMobileWalletAdapter ||
    window.solana?.isSeedVault ||
    (window.solana && isSolanaSeeker())
  );
}

// Lightweight wallet context
const WalletContext = createContext(null);

export function useSolanaWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useSolanaWallet must be used within SolanaWalletProvider');
  }
  return context;
}

// Re-export useWallet as alias
export function useWallet() {
  return useSolanaWallet();
}

export function SolanaWalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletName, setWalletName] = useState(null);
  const [isReady, setIsReady] = useState(false);
  
  // Determine network from environment
  const network = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  }, []);
  
  // Get RPC endpoint
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    if (customRpc) return customRpc;
    
    const endpoints = {
      'mainnet-beta': 'https://api.mainnet-beta.solana.com',
      'testnet': 'https://api.testnet.solana.com',
      'devnet': 'https://api.devnet.solana.com',
    };
    return endpoints[network] || endpoints['devnet'];
  }, [network]);

  // Check for existing wallet connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined') {
        setIsReady(true);
        return;
      }
      
      // Check window.solana (Phantom or Seed Vault)
      if (window.solana) {
        try {
          const resp = await window.solana.connect({ onlyIfTrusted: true });
          if (resp.publicKey) {
            setPublicKey(resp.publicKey);
            setConnected(true);
            setWallet(window.solana);
            // Detect which wallet it actually is
            if (window.solana.isSeedVault || isSolanaSeeker()) {
              setWalletName('Seed Vault');
            } else if (window.solana.isPhantom) {
              setWalletName('Phantom');
            } else {
              setWalletName('Wallet');
            }
          }
        } catch (e) {
          // Not already connected
        }
      }
      
      setIsReady(true);
    };
    
    // Small delay to let wallet inject
    setTimeout(checkConnection, 100);
  }, []);
  
  // Connect to a specific wallet
  const connect = useCallback(async (walletType = 'phantom') => {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect on server');
    }
    
    setConnecting(true);
    
    try {
      let provider = null;
      let name = '';
      
      switch (walletType.toLowerCase()) {
        case 'seeker':
        case 'seedvault':
        case 'seed_vault':
          // Seed Vault / Solana Mobile built-in wallet
          // On Seeker devices, window.solana is the Seed Vault
          if (window.solana) {
            provider = window.solana;
            name = 'Seed Vault';
          } else if (window.SolanaMobileWalletAdapter) {
            // Fallback to Solana Mobile Wallet Adapter if available
            provider = window.SolanaMobileWalletAdapter;
            name = 'Seed Vault';
          } else {
            throw new Error('Seed Vault not available. Make sure you are using a Solana Seeker device.');
          }
          break;
          
        case 'phantom':
          if (window.solana?.isPhantom) {
            provider = window.solana;
            name = 'Phantom';
          } else if (window.phantom?.solana?.isPhantom) {
            provider = window.phantom.solana;
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
  
  // Sign and send transaction (for wallets that support it)
  const signAndSendTransaction = useCallback(async (transaction, options = {}) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    // Some wallets have signAndSendTransaction directly
    if (wallet.signAndSendTransaction) {
      return wallet.signAndSendTransaction(transaction, options);
    }
    
    // Fallback: sign then send manually
    const signed = await wallet.signTransaction(transaction);
    // Return the signed transaction for manual sending
    return signed;
  }, [wallet, connected]);
  
  // Get available wallets
  const getAvailableWallets = useCallback(() => {
    const available = [];
    
    if (typeof window === 'undefined') return available;
    
    const isSeeker = isSolanaSeeker();
    const isMobile = isMobileDevice();
    const seedVaultAvailable = hasSeedVault();
    
    // On Seeker or mobile with Seed Vault, show Seed Vault FIRST
    if (isSeeker || seedVaultAvailable) {
      available.push({
        name: 'Seed Vault',
        id: 'seedvault',
        icon: '🌱',
        installed: true,
        recommended: true,
        description: 'Solana Seeker built-in wallet',
      });
    } else if (isMobile && window.solana) {
      // On mobile with any Solana wallet, it might be Seed Vault
      available.push({
        name: 'Seed Vault',
        id: 'seedvault',
        icon: '🌱',
        installed: true,
        recommended: true,
        description: 'Solana Mobile Wallet',
      });
    }
    
    // Phantom
    const phantomInstalled = !!(window.solana?.isPhantom || window.phantom?.solana?.isPhantom);
    if (phantomInstalled) {
      available.push({
        name: 'Phantom',
        id: 'phantom',
        icon: '👻',
        installed: true,
        recommended: !isSeeker && !seedVaultAvailable,
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
    hasSeedVault: hasSeedVault(),
    isReady,
  }), [
    publicKey, connected, connecting, wallet, walletName,
    network, endpoint, connect, disconnect, signMessage,
    signTransaction, signAndSendTransaction, getAvailableWallets, isReady
  ]);
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export default SolanaWalletProvider;
