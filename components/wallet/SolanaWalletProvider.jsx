'use client';

import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';
import { Connection, Transaction, VersionedTransaction } from '@solana/web3.js';

// Mobile Wallet Adapter imports
let createDefaultAuthorizationResultCache;
let SolanaMobileWalletAdapter;
let transact;

// Dynamically import MWA to avoid SSR issues
if (typeof window !== 'undefined') {
  import('@solana-mobile/wallet-adapter-mobile').then((module) => {
    createDefaultAuthorizationResultCache = module.createDefaultAuthorizationResultCache;
    SolanaMobileWalletAdapter = module.SolanaMobileWalletAdapter;
    transact = module.transact;
  });
}

// Detect if running on mobile
export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Detect if running as installed PWA
export function isInstalledPWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Detect Solana Seeker device
export function isSolanaSeeker() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('seeker') || ua.includes('solanamobile');
}

// Check if we should use Mobile Wallet Adapter
export function shouldUseMWA() {
  return isMobileDevice() || isInstalledPWA();
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

export function useWallet() {
  return useSolanaWallet();
}

// App identity for MWA
const APP_IDENTITY = {
  name: 'SolMate',
  uri: typeof window !== 'undefined' ? window.location.origin : 'https://solmate.app',
  icon: typeof window !== 'undefined' ? `${window.location.origin}/icon-192.svg` : '/icon-192.svg',
};

export function SolanaWalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletName, setWalletName] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [authToken, setAuthToken] = useState(null); // MWA auth token
  
  // Network configuration
  const network = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  }, []);
  
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

  const cluster = useMemo(() => {
    if (network === 'mainnet-beta') return 'mainnet-beta';
    if (network === 'testnet') return 'testnet';
    return 'devnet';
  }, [network]);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined') {
        setIsReady(true);
        return;
      }
      
      // Check for saved MWA session
      const savedSession = localStorage.getItem('solmate_wallet_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.publicKey && session.walletName) {
            // Session exists, but we need to verify it's still valid
            // For now, just restore the session state
            setPublicKey({ toString: () => session.publicKey, toBase58: () => session.publicKey });
            setWalletName(session.walletName);
            setAuthToken(session.authToken);
            // Note: We don't set connected=true until user interacts
          }
        } catch (e) {
          localStorage.removeItem('solmate_wallet_session');
        }
      }
      
      // Check injected wallets (for desktop/in-app browsers)
      if (!shouldUseMWA() && window.solana) {
        try {
          const resp = await window.solana.connect({ onlyIfTrusted: true });
          if (resp.publicKey) {
            setPublicKey(resp.publicKey);
            setConnected(true);
            setWallet(window.solana);
            setWalletName(window.solana.isPhantom ? 'Phantom' : 'Wallet');
          }
        } catch (e) {
          // Not already connected
        }
      }
      
      setIsReady(true);
    };
    
    setTimeout(checkConnection, 100);
  }, []);

  // Connect via Mobile Wallet Adapter
  const connectMWA = useCallback(async (walletId = 'mwa') => {
    if (!transact) {
      // MWA not loaded yet, try dynamic import
      const module = await import('@solana-mobile/wallet-adapter-mobile');
      transact = module.transact;
    }

    setConnecting(true);
    
    try {
      const result = await transact(async (mobileWallet) => {
        // Authorize with the wallet
        const authResult = await mobileWallet.authorize({
          chain: cluster,
          identity: APP_IDENTITY,
        });
        
        return {
          publicKey: authResult.accounts[0].address,
          authToken: authResult.auth_token,
          walletName: authResult.wallet_uri_base ? 
            new URL(authResult.wallet_uri_base).hostname.split('.')[0] : 
            'Mobile Wallet',
        };
      });
      
      const pubKey = {
        toString: () => result.publicKey,
        toBase58: () => result.publicKey,
      };
      
      setPublicKey(pubKey);
      setConnected(true);
      setWalletName(result.walletName);
      setAuthToken(result.authToken);
      setWallet({ type: 'mwa', authToken: result.authToken });
      
      // Save session
      localStorage.setItem('solmate_wallet_session', JSON.stringify({
        publicKey: result.publicKey,
        walletName: result.walletName,
        authToken: result.authToken,
        type: 'mwa',
      }));
      
      return result.publicKey;
    } catch (error) {
      console.error('MWA Connect error:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster]);

  // Connect via injected wallet (desktop/in-app browser)
  const connectInjected = useCallback(async (walletType = 'phantom') => {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect on server');
    }
    
    setConnecting(true);
    
    try {
      let provider = null;
      let name = '';
      
      switch (walletType.toLowerCase()) {
        case 'phantom':
          provider = window.phantom?.solana || window.solana;
          if (!provider?.isPhantom) {
            window.open('https://phantom.app/', '_blank');
            throw new Error('Phantom not installed');
          }
          name = 'Phantom';
          break;
          
        case 'solflare':
          provider = window.solflare;
          if (!provider?.isSolflare) {
            window.open('https://solflare.com/', '_blank');
            throw new Error('Solflare not installed');
          }
          name = 'Solflare';
          break;
          
        case 'backpack':
          provider = window.backpack;
          if (!provider) {
            window.open('https://backpack.app/', '_blank');
            throw new Error('Backpack not installed');
          }
          name = 'Backpack';
          break;
          
        case 'trust':
          provider = window.trustwallet?.solana || window.solana;
          if (!provider) {
            window.open('https://trustwallet.com/', '_blank');
            throw new Error('Trust Wallet not installed');
          }
          name = 'Trust';
          break;
          
        default:
          provider = window.solana;
          if (!provider) {
            throw new Error('No wallet found');
          }
          name = 'Wallet';
      }
      
      const resp = await provider.connect();
      setPublicKey(resp.publicKey);
      setConnected(true);
      setWallet(provider);
      setWalletName(name);
      
      // Save session
      localStorage.setItem('solmate_wallet_session', JSON.stringify({
        publicKey: resp.publicKey.toString(),
        walletName: name,
        type: 'injected',
      }));
      
      return resp.publicKey.toString();
    } catch (error) {
      console.error('Injected wallet connect error:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Main connect function
  const connect = useCallback(async (walletType = 'mwa') => {
    // Use MWA for mobile/PWA
    if (walletType === 'mwa' || (shouldUseMWA() && walletType === 'auto')) {
      return connectMWA(walletType);
    }
    
    // Use injected wallet for desktop or specific wallet requests
    return connectInjected(walletType);
  }, [connectMWA, connectInjected]);

  // Disconnect
  const disconnect = useCallback(async () => {
    try {
      if (wallet && typeof wallet.disconnect === 'function') {
        await wallet.disconnect();
      }
    } catch (e) {
      console.error('Disconnect error:', e);
    }
    
    setPublicKey(null);
    setConnected(false);
    setWallet(null);
    setWalletName(null);
    setAuthToken(null);
    localStorage.removeItem('solmate_wallet_session');
  }, [wallet]);

  // Sign message via MWA
  const signMessageMWA = useCallback(async (message) => {
    if (!transact) {
      const module = await import('@solana-mobile/wallet-adapter-mobile');
      transact = module.transact;
    }

    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;

    const result = await transact(async (mobileWallet) => {
      // Re-authorize if needed
      const authResult = await mobileWallet.authorize({
        chain: cluster,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      // Sign the message
      const signedMessages = await mobileWallet.signMessages({
        addresses: [authResult.accounts[0].address],
        payloads: [messageBytes],
      });

      return signedMessages[0];
    });

    return result;
  }, [cluster, authToken]);

  // Sign message via injected wallet
  const signMessageInjected = useCallback(async (message) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    const encodedMessage = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;
      
    const signedMessage = await wallet.signMessage(encodedMessage, 'utf8');
    return signedMessage.signature;
  }, [wallet, connected]);

  // Main sign message function
  const signMessage = useCallback(async (message) => {
    if (wallet?.type === 'mwa' || shouldUseMWA()) {
      return signMessageMWA(message);
    }
    return signMessageInjected(message);
  }, [wallet, signMessageMWA, signMessageInjected]);

  // Sign transaction via MWA
  const signTransactionMWA = useCallback(async (transaction) => {
    if (!transact) {
      const module = await import('@solana-mobile/wallet-adapter-mobile');
      transact = module.transact;
    }

    const connection = new Connection(endpoint, 'confirmed');
    
    // Serialize the transaction
    let serializedTx;
    if (transaction instanceof VersionedTransaction) {
      serializedTx = transaction.serialize();
    } else {
      // Legacy transaction - need to set recent blockhash if not set
      if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }
      serializedTx = transaction.serialize({ requireAllSignatures: false });
    }

    const result = await transact(async (mobileWallet) => {
      // Re-authorize
      const authResult = await mobileWallet.authorize({
        chain: cluster,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      // Sign the transaction
      const signedTxs = await mobileWallet.signTransactions({
        payloads: [serializedTx],
      });

      return signedTxs[0];
    });

    // Deserialize back to transaction
    if (transaction instanceof VersionedTransaction) {
      return VersionedTransaction.deserialize(result);
    }
    return Transaction.from(result);
  }, [cluster, endpoint, authToken]);

  // Sign transaction via injected wallet
  const signTransactionInjected = useCallback(async (transaction) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    return wallet.signTransaction(transaction);
  }, [wallet, connected]);

  // Main sign transaction function
  const signTransaction = useCallback(async (transaction) => {
    if (wallet?.type === 'mwa' || shouldUseMWA()) {
      return signTransactionMWA(transaction);
    }
    return signTransactionInjected(transaction);
  }, [wallet, signTransactionMWA, signTransactionInjected]);

  // Sign and send transaction via MWA
  const signAndSendTransactionMWA = useCallback(async (transaction, options = {}) => {
    if (!transact) {
      const module = await import('@solana-mobile/wallet-adapter-mobile');
      transact = module.transact;
    }

    const connection = new Connection(endpoint, 'confirmed');
    
    // Serialize the transaction
    let serializedTx;
    if (transaction instanceof VersionedTransaction) {
      serializedTx = transaction.serialize();
    } else {
      if (!transaction.recentBlockhash) {
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }
      serializedTx = transaction.serialize({ requireAllSignatures: false });
    }

    const result = await transact(async (mobileWallet) => {
      // Re-authorize
      const authResult = await mobileWallet.authorize({
        chain: cluster,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      // Sign and send
      const signatures = await mobileWallet.signAndSendTransactions({
        payloads: [serializedTx],
        options: {
          minContextSlot: options.minContextSlot,
          skipPreflight: options.skipPreflight,
          preflightCommitment: options.preflightCommitment,
        },
      });

      return signatures[0];
    });

    return result; // Returns the signature
  }, [cluster, endpoint, authToken]);

  // Sign and send via injected wallet
  const signAndSendTransactionInjected = useCallback(async (transaction, options = {}) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    const connection = new Connection(endpoint, 'confirmed');
    
    // Sign
    const signed = await wallet.signTransaction(transaction);
    
    // Send
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: options.skipPreflight || false,
      preflightCommitment: options.preflightCommitment || 'confirmed',
    });
    
    return signature;
  }, [wallet, connected, endpoint]);

  // Main sign and send function
  const signAndSendTransaction = useCallback(async (transaction, options = {}) => {
    if (wallet?.type === 'mwa' || shouldUseMWA()) {
      return signAndSendTransactionMWA(transaction, options);
    }
    return signAndSendTransactionInjected(transaction, options);
  }, [wallet, signAndSendTransactionMWA, signAndSendTransactionInjected]);

  // Get available wallets for the connect modal
  const getAvailableWallets = useCallback(() => {
    const available = [];
    
    if (typeof window === 'undefined') return available;
    
    const isMobile = isMobileDevice();
    const isPWA = isInstalledPWA();
    const isSeeker = isSolanaSeeker();
    const useMWA = shouldUseMWA();
    
    // On mobile/PWA, always show Mobile Wallet Adapter FIRST
    if (useMWA) {
      available.push({
        id: 'mwa',
        name: 'Mobile Wallet Adapter',
        subtitle: isSeeker ? 'Connect to Seed Vault' : 'Tap to connect',
        icon: '/wallets/seeker.svg',
        installed: true,
        recommended: true,
        isMWA: true,
      });
    }
    
    // Add individual wallets
    const wallets = [
      {
        id: 'phantom',
        name: 'Phantom',
        subtitle: 'Popular Solana wallet',
        icon: '/wallets/phantom.svg',
        downloadUrl: 'https://phantom.app/',
        checkInstalled: () => !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom),
      },
      {
        id: 'solflare',
        name: 'Solflare',
        subtitle: 'Non-custodial wallet',
        icon: '/wallets/solflare.svg',
        downloadUrl: 'https://solflare.com/',
        checkInstalled: () => !!window.solflare?.isSolflare,
      },
      {
        id: 'backpack',
        name: 'Backpack',
        subtitle: 'xNFT enabled wallet',
        icon: '/wallets/backpack.svg',
        downloadUrl: 'https://backpack.app/',
        checkInstalled: () => !!window.backpack,
      },
      {
        id: 'trust',
        name: 'Trust Wallet',
        subtitle: 'Multi-chain wallet',
        icon: '/wallets/trust.svg',
        downloadUrl: 'https://trustwallet.com/',
        checkInstalled: () => !!window.trustwallet?.solana,
      },
    ];
    
    for (const w of wallets) {
      const installed = w.checkInstalled();
      
      // On mobile with MWA, show all as "Tap to connect" since MWA can connect to any
      if (useMWA) {
        available.push({
          id: w.id,
          name: w.name,
          subtitle: 'Tap to connect',
          icon: w.icon,
          installed: true, // MWA can connect to any wallet
          recommended: false,
          usesMWA: true, // Will use MWA for connection
        });
      } else {
        // Desktop - check if actually installed
        available.push({
          id: w.id,
          name: w.name,
          subtitle: installed ? 'Tap to connect' : w.subtitle,
          icon: w.icon,
          installed,
          downloadUrl: installed ? null : w.downloadUrl,
          recommended: w.id === 'phantom' && installed,
        });
      }
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
    cluster,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    signAndSendTransaction,
    getAvailableWallets,
    isSeeker: isSolanaSeeker(),
    isMobile: isMobileDevice(),
    isPWA: isInstalledPWA(),
    shouldUseMWA: shouldUseMWA(),
    isReady,
  }), [
    publicKey, connected, connecting, wallet, walletName,
    network, endpoint, cluster, connect, disconnect, signMessage,
    signTransaction, signAndSendTransaction, getAvailableWallets, isReady
  ]);
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export default SolanaWalletProvider;
