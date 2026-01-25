'use client';

import React, { useMemo, useCallback, useEffect, useState, createContext, useContext } from 'react';
import { Connection, Transaction, PublicKey } from '@solana/web3.js';

// ============================================
// DETECTION UTILITIES
// ============================================

export function isMobileDevice() {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isAndroid() {
  if (typeof window === 'undefined') return false;
  return /Android/i.test(navigator.userAgent);
}

export function isIOS() {
  if (typeof window === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isInstalledPWA() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

export function isSolanaSeeker() {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('seeker') || ua.includes('solanamobile');
}

// MWA is supported on Android only
export function isMWASupported() {
  return isAndroid();
}

export function shouldUseMWA() {
  const mobile = isMobileDevice();
  const android = isAndroid();
  const hasInjectedWallet = typeof window !== 'undefined' && !!(window.solana || window.phantom);
  
  console.log('[MWA] Detection:', { mobile, android, hasInjectedWallet });
  return mobile && android && !hasInjectedWallet;
}

// ============================================
// DEEP LINK UTILITIES
// ============================================

function getWalletDeepLink(walletId, appUrl) {
  const encodedUrl = encodeURIComponent(appUrl);
  
  switch (walletId) {
    case 'phantom':
      // Phantom deep link to open URL in Phantom browser
      return `https://phantom.app/ul/browse/${encodedUrl}?ref=${encodedUrl}`;
    case 'solflare':
      return `https://solflare.com/ul/v1/browse/${encodedUrl}?ref=${encodedUrl}`;
    case 'backpack':
      return `https://backpack.app/ul/browse/${encodedUrl}`;
    default:
      return null;
  }
}

// ============================================
// WALLET CONTEXT
// ============================================

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
  name: 'PlaySolMates',
  uri: typeof window !== 'undefined' 
    ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin) 
    : (process.env.NEXT_PUBLIC_APP_URL || 'https://playsolmates.app'),
  icon: '/icon-192.png',
};

export function SolanaWalletProvider({ children }) {
  const [publicKey, setPublicKey] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletName, setWalletName] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [authToken, setAuthToken] = useState(null);
  const [mwaSupported, setMwaSupported] = useState(false);
  const [mwaModule, setMwaModule] = useState(null);
  
  // Network configuration
  const network = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  }, []);
  
  const endpoint = useMemo(() => {
    const customRpc = process.env.NEXT_PUBLIC_RPC_URL;
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

  // Load MWA module on mount (Android only)
  useEffect(() => {
    const initMWA = async () => {
      if (typeof window === 'undefined') return;
      
      const supported = isMWASupported();
      console.log('[MWA] Supported:', supported);
      setMwaSupported(supported);
      
      if (supported) {
        try {
          const mwa = await import('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
          console.log('[MWA] Module loaded:', Object.keys(mwa));
          setMwaModule(mwa);
        } catch (e) {
          console.error('[MWA] Failed to load module:', e);
        }
      }
    };
    
    initMWA();
  }, []);

  // Check for existing connection on mount
  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window === 'undefined') {
        setIsReady(true);
        return;
      }
      
      // Check for saved session
      const savedSession = localStorage.getItem('solmate_wallet_session');
      if (savedSession) {
        try {
          const session = JSON.parse(savedSession);
          if (session.publicKey && session.walletName) {
            const pubKey = createPublicKey(session.publicKey);
            setPublicKey(pubKey);
            setWalletName(session.walletName);
            if (session.authToken) {
              setAuthToken(session.authToken);
            }
            if (session.type === 'mwa') {
              setWallet({ type: 'mwa' });
            }
          }
        } catch (e) {
          localStorage.removeItem('solmate_wallet_session');
        }
      }
      
      // Check injected wallets
      if (!shouldUseMWA()) {
        const provider = window.phantom?.solana || window.solana;
        if (provider) {
          try {
            const resp = await provider.connect({ onlyIfTrusted: true });
            if (resp.publicKey) {
              setPublicKey(resp.publicKey);
              setConnected(true);
              setWallet(provider);
              setWalletName(provider.isPhantom ? 'Phantom' : 'Wallet');
            }
          } catch (e) {
            // Not already connected
          }
        }
      }
      
      setIsReady(true);
    };
    
    setTimeout(checkConnection, 200);
  }, []);

  // Helper to create PublicKey-like object
  const createPublicKey = (address) => {
    return {
      toString: () => address,
      toBase58: () => address,
      toBytes: () => {
        try {
          return new PublicKey(address).toBytes();
        } catch {
          return new Uint8Array(32);
        }
      },
    };
  };

  // Connect via Mobile Wallet Adapter
  const connectMWA = useCallback(async () => {
    console.log('[MWA] Connect called');
    
    if (!mwaModule?.transact) {
      console.error('[MWA] Module not loaded');
      throw new Error('Mobile Wallet Adapter is not available. Please install a Solana wallet app (Phantom, Solflare, etc.)');
    }
    
    setConnecting(true);
    
    try {
      console.log('[MWA] Starting transact...');
      
      const result = await mwaModule.transact(async (mobileWallet) => {
        console.log('[MWA] Inside transact, authorizing...');
        
        const authResult = await mobileWallet.authorize({
          cluster,
          identity: APP_IDENTITY,
        });
        
        console.log('[MWA] Auth result:', authResult);
        
        // Safely get the address
        const accounts = authResult?.accounts || [];
        if (!accounts.length) {
          throw new Error('No accounts returned from wallet');
        }
        
        return {
          accounts,
          authToken: authResult?.auth_token,
          walletUriBase: authResult?.wallet_uri_base,
        };
      });
      
      console.log('[MWA] Transact completed:', result);
      
      const address = result.accounts[0]?.address;
      if (!address) {
        throw new Error('No wallet address returned');
      }
      
      const walletDisplayName = result.walletUriBase 
        ? new URL(result.walletUriBase).hostname.replace('www.', '').split('.')[0]
        : 'Wallet';
      
      const pubKey = createPublicKey(address);
      
      setPublicKey(pubKey);
      setConnected(true);
      setWalletName(walletDisplayName);
      setAuthToken(result.authToken);
      setWallet({ type: 'mwa', authToken: result.authToken });
      
      localStorage.setItem('solmate_wallet_session', JSON.stringify({
        publicKey: address,
        walletName: walletDisplayName,
        authToken: result.authToken,
        type: 'mwa',
      }));
      
      return address;
    } catch (error) {
      console.error('[MWA] Connect error:', error);
      
      // Provide user-friendly error messages
      if (error.message?.includes('cancelled') || error.message?.includes('rejected')) {
        throw new Error('Connection cancelled by user');
      }
      
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster, mwaModule]);

  // Connect via injected wallet
  const connectInjected = useCallback(async (walletType = 'phantom') => {
    if (typeof window === 'undefined') {
      throw new Error('Cannot connect on server');
    }
    
    setConnecting(true);
    
    try {
      let provider = null;
      let name = '';
      
      // Check for injected wallet first
      const hasPhantom = !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
      const hasSolflare = !!window.solflare?.isSolflare;
      const hasBackpack = !!window.backpack;
      
      switch (walletType.toLowerCase()) {
        case 'phantom':
          if (hasPhantom) {
            provider = window.phantom?.solana || window.solana;
            name = 'Phantom';
          } else if (isMobileDevice()) {
            // On mobile, open in Phantom's in-app browser
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            const deepLink = getWalletDeepLink('phantom', appUrl);
            if (deepLink) {
              window.location.href = deepLink;
              throw new Error('Opening Phantom app...');
            }
          } else {
            window.open('https://phantom.app/', '_blank');
            throw new Error('Please install Phantom wallet');
          }
          break;
          
        case 'solflare':
          if (hasSolflare) {
            provider = window.solflare;
            name = 'Solflare';
          } else if (isMobileDevice()) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            const deepLink = getWalletDeepLink('solflare', appUrl);
            if (deepLink) {
              window.location.href = deepLink;
              throw new Error('Opening Solflare app...');
            }
          } else {
            window.open('https://solflare.com/', '_blank');
            throw new Error('Please install Solflare wallet');
          }
          break;
          
        case 'backpack':
          if (hasBackpack) {
            provider = window.backpack;
            name = 'Backpack';
          } else if (isMobileDevice()) {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
            const deepLink = getWalletDeepLink('backpack', appUrl);
            if (deepLink) {
              window.location.href = deepLink;
              throw new Error('Opening Backpack app...');
            }
          } else {
            window.open('https://backpack.app/', '_blank');
            throw new Error('Please install Backpack wallet');
          }
          break;
          
        default:
          provider = window.phantom?.solana || window.solana;
          if (!provider) {
            throw new Error('No wallet found. Please install a Solana wallet.');
          }
          name = provider.isPhantom ? 'Phantom' : 'Wallet';
      }
      
      if (!provider) {
        throw new Error(`${name || walletType} wallet not available`);
      }
      
      const resp = await provider.connect();
      setPublicKey(resp.publicKey);
      setConnected(true);
      setWallet(provider);
      setWalletName(name);
      
      localStorage.setItem('solmate_wallet_session', JSON.stringify({
        publicKey: resp.publicKey.toString(),
        walletName: name,
        type: 'injected',
      }));
      
      return resp.publicKey.toString();
    } catch (error) {
      console.error('[Injected] Connect error:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, []);

  // Main connect function
  const connect = useCallback(async (walletType = 'auto') => {
    console.log('[Connect] Type:', walletType, 'shouldUseMWA:', shouldUseMWA());
    
    if (walletType === 'mwa' || (walletType === 'auto' && shouldUseMWA())) {
      return connectMWA();
    }
    
    return connectInjected(walletType === 'auto' ? 'phantom' : walletType);
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
    if (!mwaModule?.transact) {
      throw new Error('MWA not available');
    }

    const messageBytes = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;

    try {
      const result = await mwaModule.transact(async (mobileWallet) => {
        const authResult = await mobileWallet.authorize({
          cluster,
          identity: APP_IDENTITY,
          auth_token: authToken,
        });
        
        const accounts = authResult?.accounts || [];
        if (!accounts.length) {
          throw new Error('No accounts available');
        }
        
        const address = accounts[0].address;

        const signedMessages = await mobileWallet.signMessages({
          addresses: [address],
          payloads: [messageBytes],
        });

        // MWA returns array of signed messages
        const signature = signedMessages?.[0];
        if (!signature) {
          throw new Error('No signature returned');
        }

        return {
          signature,
          authToken: authResult?.auth_token,
        };
      });

      if (result.authToken) {
        setAuthToken(result.authToken);
      }

      // Return as Uint8Array - handle both Uint8Array and base64 string
      if (result.signature instanceof Uint8Array) {
        return result.signature;
      }
      
      // If it's a base64 string, decode it
      if (typeof result.signature === 'string') {
        return Uint8Array.from(atob(result.signature), c => c.charCodeAt(0));
      }
      
      // If it's an object with signature property
      if (result.signature?.signature) {
        return result.signature.signature;
      }
      
      throw new Error('Invalid signature format');
    } catch (error) {
      console.error('[MWA] SignMessage error:', error);
      
      if (error.message?.includes('cancelled') || error.message?.includes('rejected')) {
        throw new Error('Signing cancelled by user');
      }
      
      throw error;
    }
  }, [cluster, authToken, mwaModule]);

  // Sign message via injected wallet
  const signMessageInjected = useCallback(async (message) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    const encodedMessage = typeof message === 'string' 
      ? new TextEncoder().encode(message)
      : message;
    
    try {
      const signedMessage = await wallet.signMessage(encodedMessage, 'utf8');
      
      // Handle different wallet response formats
      if (signedMessage?.signature) {
        return signedMessage.signature;
      }
      if (signedMessage instanceof Uint8Array) {
        return signedMessage;
      }
      
      throw new Error('Invalid signature format from wallet');
    } catch (error) {
      console.error('[Injected] SignMessage error:', error);
      
      if (error.message?.includes('rejected') || error.message?.includes('cancelled')) {
        throw new Error('Signing cancelled by user');
      }
      
      throw error;
    }
  }, [wallet, connected]);

  // Main sign message
  const signMessage = useCallback(async (message) => {
    if (wallet?.type === 'mwa') {
      return signMessageMWA(message);
    }
    return signMessageInjected(message);
  }, [wallet, signMessageMWA, signMessageInjected]);

  // Sign transaction via MWA
  const signTransactionMWA = useCallback(async (transaction) => {
    if (!mwaModule?.transact) {
      throw new Error('MWA not available');
    }

    const connection = new Connection(endpoint, 'confirmed');
    
    if (!transaction.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
    }
    
    if (!transaction.feePayer && publicKey) {
      transaction.feePayer = new PublicKey(publicKey.toString());
    }

    const result = await mwaModule.transact(async (mobileWallet) => {
      const authResult = await mobileWallet.authorize({
        cluster,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      const signedTxs = await mobileWallet.signTransactions({
        transactions: [transaction],
      });

      return {
        signedTx: signedTxs?.[0],
        authToken: authResult?.auth_token,
      };
    });

    if (result.authToken) {
      setAuthToken(result.authToken);
    }

    return result.signedTx;
  }, [cluster, endpoint, authToken, publicKey, mwaModule]);

  // Sign transaction via injected
  const signTransactionInjected = useCallback(async (transaction) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    return wallet.signTransaction(transaction);
  }, [wallet, connected]);

  // Main sign transaction
  const signTransaction = useCallback(async (transaction) => {
    if (wallet?.type === 'mwa') {
      return signTransactionMWA(transaction);
    }
    return signTransactionInjected(transaction);
  }, [wallet, signTransactionMWA, signTransactionInjected]);

  // Sign and send via MWA
  const signAndSendTransactionMWA = useCallback(async (transaction, options = {}) => {
    if (!mwaModule?.transact) {
      throw new Error('MWA not available');
    }

    const connection = new Connection(endpoint, 'confirmed');
    
    if (!transaction.recentBlockhash) {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
    }
    
    if (!transaction.feePayer && publicKey) {
      transaction.feePayer = new PublicKey(publicKey.toString());
    }

    const result = await mwaModule.transact(async (mobileWallet) => {
      const authResult = await mobileWallet.authorize({
        cluster,
        identity: APP_IDENTITY,
        auth_token: authToken,
      });

      const signatures = await mobileWallet.signAndSendTransactions({
        transactions: [transaction],
        options: {
          minContextSlot: options.minContextSlot,
          skipPreflight: options.skipPreflight,
          preflightCommitment: options.preflightCommitment,
        },
      });

      return {
        signature: signatures?.[0],
        authToken: authResult?.auth_token,
      };
    });

    if (result.authToken) {
      setAuthToken(result.authToken);
    }

    return result.signature;
  }, [cluster, endpoint, authToken, publicKey, mwaModule]);

  // Sign and send via injected
  const signAndSendTransactionInjected = useCallback(async (transaction, options = {}) => {
    if (!wallet || !connected) {
      throw new Error('Wallet not connected');
    }
    
    const connection = new Connection(endpoint, 'confirmed');
    const signed = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: options.skipPreflight || false,
      preflightCommitment: options.preflightCommitment || 'confirmed',
    });
    
    return signature;
  }, [wallet, connected, endpoint]);

  // Main sign and send
  const signAndSendTransaction = useCallback(async (transaction, options = {}) => {
    if (wallet?.type === 'mwa') {
      return signAndSendTransactionMWA(transaction, options);
    }
    return signAndSendTransactionInjected(transaction, options);
  }, [wallet, signAndSendTransactionMWA, signAndSendTransactionInjected]);

  // Get available wallets
  const getAvailableWallets = useCallback(() => {
    const available = [];
    
    if (typeof window === 'undefined') return available;
    
    const mobile = isMobileDevice();
    const android = isAndroid();
    const useMWA = shouldUseMWA();
    
    // Check injected wallets
    const phantomInstalled = !!(window.phantom?.solana?.isPhantom || window.solana?.isPhantom);
    const solflareInstalled = !!window.solflare?.isSolflare;
    const backpackInstalled = !!window.backpack;
    
    // On Android without injected wallet, show MWA first
    if (android && !phantomInstalled && !solflareInstalled && !backpackInstalled) {
      available.push({
        id: 'mwa',
        name: 'Mobile Wallet Adapter',
        subtitle: 'Connect your Solana wallet app',
        icon: '/wallets/seeker.svg',
        installed: true,
        recommended: true,
        isMWA: true,
        ready: !!mwaModule?.transact,
      });
    }
    
    // Phantom
    available.push({
      id: 'phantom',
      name: 'Phantom',
      subtitle: phantomInstalled ? 'Tap to connect' : (mobile ? 'Open in Phantom' : 'Install Phantom'),
      icon: '/wallets/phantom.svg',
      installed: phantomInstalled || mobile, // On mobile, we can deep link
      recommended: phantomInstalled && !useMWA,
      downloadUrl: phantomInstalled ? null : 'https://phantom.app/',
      canDeepLink: mobile && !phantomInstalled,
    });
    
    // Solflare
    available.push({
      id: 'solflare',
      name: 'Solflare',
      subtitle: solflareInstalled ? 'Tap to connect' : (mobile ? 'Open in Solflare' : 'Install Solflare'),
      icon: '/wallets/solflare.svg',
      installed: solflareInstalled || mobile,
      downloadUrl: solflareInstalled ? null : 'https://solflare.com/',
      canDeepLink: mobile && !solflareInstalled,
    });
    
    // Backpack
    available.push({
      id: 'backpack',
      name: 'Backpack',
      subtitle: backpackInstalled ? 'Tap to connect' : (mobile ? 'Open in Backpack' : 'Install Backpack'),
      icon: '/wallets/backpack.svg',
      installed: backpackInstalled || mobile,
      downloadUrl: backpackInstalled ? null : 'https://backpack.app/',
      canDeepLink: mobile && !backpackInstalled,
    });
    
    return available;
  }, [mwaModule]);

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
    isAndroid: isAndroid(),
    isIOS: isIOS(),
    isPWA: isInstalledPWA(),
    mwaSupported,
    mwaReady: !!mwaModule?.transact,
    isReady,
  }), [
    publicKey, connected, connecting, wallet, walletName,
    network, endpoint, cluster, connect, disconnect, signMessage,
    signTransaction, signAndSendTransaction, getAvailableWallets,
    mwaSupported, mwaModule, isReady
  ]);
  
  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export default SolanaWalletProvider;
