'use client';

import { useState, useEffect, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Wallet, Smartphone, Monitor, Check, Loader2, ExternalLink, ChevronRight, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '@/lib/i18n/provider';
import { isSolanaSeeker, isMobileDevice } from './SolanaWalletProvider';

// Wallet metadata with icons and descriptions
const WALLET_META = {
  'Mobile Wallet Adapter': {
    name: 'Seeker Wallet',
    altName: 'Seed Vault',
    description: 'Official Solana Seeker wallet',
    icon: '🌱',
    color: 'from-green-500 to-emerald-500',
    isSeeker: true,
    recommended: true,
  },
  'Phantom': {
    name: 'Phantom',
    description: 'Popular Solana wallet',
    icon: '👻',
    color: 'from-purple-500 to-violet-500',
    downloadUrl: 'https://phantom.app/',
  },
  'Solflare': {
    name: 'Solflare',
    description: 'Secure Solana wallet',
    icon: '🔥',
    color: 'from-orange-500 to-red-500',
    downloadUrl: 'https://solflare.com/',
  },
  'Backpack': {
    name: 'Backpack',
    description: 'xNFT-ready wallet',
    icon: '🎒',
    color: 'from-blue-500 to-cyan-500',
    downloadUrl: 'https://backpack.app/',
  },
  'Coinbase Wallet': {
    name: 'Coinbase Wallet',
    description: 'Self-custody wallet',
    icon: '💰',
    color: 'from-blue-600 to-blue-700',
    downloadUrl: 'https://www.coinbase.com/wallet',
  },
};

export default function WalletConnectModal({ 
  open, 
  onOpenChange,
  onConnected
}) {
  const { t, direction } = useI18n();
  const { wallets, select, connect, connecting, connected, publicKey, wallet } = useWallet();
  
  const [isSeeker, setIsSeeker] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    setIsSeeker(isSolanaSeeker());
    setIsMobile(isMobileDevice());
  }, []);
  
  // Sort wallets: Seeker first on mobile, installed wallets prioritized
  const sortedWallets = useMemo(() => {
    if (!wallets) return [];
    
    return [...wallets].sort((a, b) => {
      const metaA = WALLET_META[a.adapter.name] || {};
      const metaB = WALLET_META[b.adapter.name] || {};
      
      // On Seeker mobile, prioritize Seed Vault
      if (isSeeker || isMobile) {
        if (metaA.isSeeker) return -1;
        if (metaB.isSeeker) return 1;
      }
      
      // Then sort by readyState (installed wallets first)
      const readyOrder = {
        'Installed': 0,
        'Loadable': 1,
        'NotDetected': 2,
        'Unsupported': 3,
      };
      
      const orderA = readyOrder[a.readyState] ?? 3;
      const orderB = readyOrder[b.readyState] ?? 3;
      
      if (orderA !== orderB) return orderA - orderB;
      
      // Then by recommended status
      if (metaA.recommended && !metaB.recommended) return -1;
      if (metaB.recommended && !metaA.recommended) return 1;
      
      return 0;
    });
  }, [wallets, isSeeker, isMobile]);
  
  // Handle wallet selection and connection
  const handleSelectWallet = async (walletAdapter) => {
    setError(null);
    setSelectedWallet(walletAdapter.adapter.name);
    
    try {
      select(walletAdapter.adapter.name);
      await connect();
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect');
      setSelectedWallet(null);
    }
  };
  
  // Close modal when connected
  useEffect(() => {
    if (connected && publicKey) {
      onConnected?.(publicKey.toString());
      onOpenChange(false);
    }
  }, [connected, publicKey, onConnected, onOpenChange]);
  
  const getWalletMeta = (adapter) => {
    return WALLET_META[adapter.name] || {
      name: adapter.name,
      description: 'Solana wallet',
      icon: '💳',
      color: 'from-gray-500 to-gray-600',
    };
  };
  
  const isInstalled = (wallet) => {
    return wallet.readyState === 'Installed' || wallet.readyState === 'Loadable';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={direction}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            Connect Wallet
          </DialogTitle>
          <DialogDescription>
            {isSeeker || isMobile 
              ? 'Connect your Solana wallet to play'
              : 'Choose a Solana wallet to connect'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {/* Device indicator */}
          <div className="flex items-center gap-2 mb-4 p-2 rounded-lg bg-secondary/50">
            {isMobile ? (
              <>
                <Smartphone className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {isSeeker ? 'Solana Seeker detected' : 'Mobile device'}
                </span>
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Desktop browser</span>
              </>
            )}
          </div>
          
          {/* Error message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
            >
              {error}
            </motion.div>
          )}
          
          {/* Wallet list */}
          <ScrollArea className="h-[300px] pr-2">
            <div className="space-y-2">
              {sortedWallets.map((walletAdapter, index) => {
                const meta = getWalletMeta(walletAdapter.adapter);
                const installed = isInstalled(walletAdapter);
                const isSelected = selectedWallet === walletAdapter.adapter.name;
                const isConnecting = connecting && isSelected;
                const isFirstOnSeeker = index === 0 && (isSeeker || isMobile) && meta.isSeeker;
                
                return (
                  <motion.div
                    key={walletAdapter.adapter.name}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Button
                      variant={isFirstOnSeeker ? 'default' : 'outline'}
                      className={`w-full h-auto py-3 px-4 justify-between ${
                        isFirstOnSeeker 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 hover:from-green-400 hover:to-emerald-400' 
                          : ''
                      } ${!installed && !meta.isSeeker ? 'opacity-70' : ''}`}
                      onClick={() => handleSelectWallet(walletAdapter)}
                      disabled={connecting}
                    >
                      <div className="flex items-center gap-3">
                        {/* Wallet icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                          isFirstOnSeeker ? 'bg-white/20' : `bg-gradient-to-br ${meta.color}/20`
                        }`}>
                          {walletAdapter.adapter.icon ? (
                            <img 
                              src={walletAdapter.adapter.icon} 
                              alt={meta.name}
                              className="w-6 h-6"
                            />
                          ) : (
                            meta.icon
                          )}
                        </div>
                        
                        <div className="text-start">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{meta.name}</span>
                            {meta.recommended && isFirstOnSeeker && (
                              <Badge className="bg-yellow-500/20 text-yellow-300 text-[10px] px-1">
                                <Star className="w-3 h-3 me-0.5" /> Recommended
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs ${isFirstOnSeeker ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {meta.description}
                          </p>
                        </div>
                      </div>
                      
                      {/* Status indicator */}
                      <div className="flex items-center gap-2">
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : installed ? (
                          <Badge variant="secondary" className="text-[10px]">
                            <Check className="w-3 h-3 me-1" /> Ready
                          </Badge>
                        ) : meta.downloadUrl ? (
                          <a 
                            href={meta.downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-primary flex items-center gap-1 hover:underline"
                          >
                            Install <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : (
                          <ChevronRight className={`w-4 h-4 ${isFirstOnSeeker ? 'text-white/70' : 'text-muted-foreground'}`} />
                        )}
                      </div>
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </ScrollArea>
          
          <Separator className="my-4" />
          
          {/* Info footer */}
          <div className="text-center">
            <p className="text-xs text-muted-foreground">
              New to Solana? 
              <a 
                href="https://solana.com/ecosystem/wallets" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ms-1"
              >
                Learn about wallets →
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
