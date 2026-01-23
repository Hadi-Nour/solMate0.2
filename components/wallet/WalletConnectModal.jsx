'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Wallet, Smartphone, Monitor, Check, Loader2, ExternalLink, ChevronRight, Star, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n/provider';
import { useSolanaWallet } from './SolanaWalletProvider';

// Wallet metadata with official icons
const WALLET_CONFIG = {
  seeker: {
    name: 'Seeker Wallet',
    subtitle: 'Solana Mobile Seed Vault',
    icon: '/wallets/seeker.svg',
    downloadUrl: null, // Pre-installed on Seeker
    color: 'from-emerald-500 to-teal-600',
  },
  phantom: {
    name: 'Phantom',
    subtitle: 'Popular Solana wallet',
    icon: '/wallets/phantom.svg',
    downloadUrl: 'https://phantom.app/',
    color: 'from-purple-500 to-violet-600',
  },
  solflare: {
    name: 'Solflare',
    subtitle: 'Non-custodial wallet',
    icon: '/wallets/solflare.svg',
    downloadUrl: 'https://solflare.com/',
    color: 'from-orange-500 to-red-600',
  },
  backpack: {
    name: 'Backpack',
    subtitle: 'xNFT enabled wallet',
    icon: '/wallets/backpack.svg',
    downloadUrl: 'https://backpack.app/',
    color: 'from-red-500 to-rose-600',
  },
};

export default function WalletConnectModal({ 
  open, 
  onOpenChange,
  onConnected
}) {
  const { t, direction } = useI18n();
  const { connect, connecting, connected, publicKey, getAvailableWallets, isSeeker, isMobile } = useSolanaWallet();
  
  const [availableWallets, setAvailableWallets] = useState([]);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [error, setError] = useState(null);
  
  // Load available wallets when modal opens
  useEffect(() => {
    if (open) {
      // Defer state updates to avoid cascading renders
      const timeoutId = setTimeout(() => {
        setAvailableWallets(getAvailableWallets());
        setError(null);
        setSelectedWallet(null);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [open, getAvailableWallets]);
  
  // Handle wallet selection and connection
  const handleSelectWallet = async (walletId) => {
    const config = WALLET_CONFIG[walletId];
    const wallet = availableWallets.find(w => w.id === walletId);
    
    // If not installed, open download page
    if (!wallet?.installed && config?.downloadUrl) {
      window.open(config.downloadUrl, '_blank');
      return;
    }
    
    setError(null);
    setSelectedWallet(walletId);
    
    try {
      const address = await connect(walletId);
      onConnected?.(address);
      onOpenChange(false);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect wallet');
      setSelectedWallet(null);
    }
  };
  
  // Sort wallets: recommended first, then installed
  const sortedWallets = useMemo(() => {
    return [...availableWallets].sort((a, b) => {
      if (a.recommended && !b.recommended) return -1;
      if (b.recommended && !a.recommended) return 1;
      if (a.installed && !b.installed) return -1;
      if (b.installed && !a.installed) return 1;
      return 0;
    });
  }, [availableWallets]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden" dir={direction}>
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-primary" />
              </div>
              Connect Wallet
            </DialogTitle>
            <DialogDescription className="text-sm mt-2">
              {isSeeker 
                ? 'Connect your Seed Vault to start playing'
                : isMobile 
                  ? 'Connect your Solana wallet'
                  : 'Choose a Solana wallet to connect'
              }
            </DialogDescription>
          </DialogHeader>
          
          {/* Device indicator */}
          <div className="flex items-center gap-2 mt-4 px-3 py-2 rounded-lg bg-secondary/50">
            {isMobile ? (
              <>
                <Smartphone className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">
                  {isSeeker ? 'Solana Seeker Device' : 'Mobile Browser'}
                </span>
                {isSeeker && (
                  <Badge className="ms-auto bg-primary/20 text-primary text-[10px]">
                    Seed Vault Ready
                  </Badge>
                )}
              </>
            ) : (
              <>
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Desktop Browser</span>
              </>
            )}
          </div>
        </div>
        
        {/* Wallet list */}
        <div className="p-4">
          {/* Error message */}
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </motion.div>
          )}
          
          <ScrollArea className="h-[300px] pe-2">
            <div className="space-y-2">
              {sortedWallets.map((wallet, index) => {
                const config = WALLET_CONFIG[wallet.id] || {};
                const isSelected = selectedWallet === wallet.id;
                const isConnecting = connecting && isSelected;
                const isRecommended = wallet.recommended;
                
                return (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <button
                      className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
                        isRecommended 
                          ? 'bg-gradient-to-r from-primary/10 to-primary/5 border-primary/30 hover:border-primary/60' 
                          : wallet.installed
                            ? 'bg-card border-border hover:border-primary/40 hover:bg-secondary/50'
                            : 'bg-muted/30 border-border/50 opacity-70 hover:opacity-100'
                      } ${isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
                      onClick={() => handleSelectWallet(wallet.id)}
                      disabled={connecting}
                    >
                      {/* Wallet icon */}
                      <div className={`relative w-12 h-12 rounded-xl overflow-hidden shrink-0 ${
                        isRecommended ? `bg-gradient-to-br ${config.color}` : 'bg-secondary'
                      }`}>
                        <Image
                          src={config.icon || '/wallets/phantom.svg'}
                          alt={config.name}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                        {isRecommended && (
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center shadow-lg">
                            <Star className="w-3 h-3 text-black fill-current" />
                          </div>
                        )}
                      </div>
                      
                      {/* Wallet info */}
                      <div className="flex-1 text-start min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold truncate">{config.name}</span>
                          {isRecommended && (
                            <Badge className="bg-primary/20 text-primary text-[10px] px-1.5 shrink-0">
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {config.subtitle}
                        </p>
                      </div>
                      
                      {/* Status / Action */}
                      <div className="shrink-0">
                        {isConnecting ? (
                          <div className="flex items-center gap-2 text-primary">
                            <Loader2 className="w-5 h-5 animate-spin" />
                          </div>
                        ) : wallet.installed ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-500 border-green-500/20">
                            <Check className="w-3 h-3 me-1" />
                            Ready
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            <ExternalLink className="w-3 h-3 me-1" />
                            Install
                          </Badge>
                        )}
                      </div>
                    </button>
                  </motion.div>
                );
              })}
              
              {/* Empty state if no wallets */}
              {sortedWallets.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No wallets detected</p>
                  <p className="text-xs mt-1">Install a Solana wallet to continue</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              New to Solana?
            </p>
            <a 
              href="https://solana.com/ecosystem/wallets" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Learn about wallets
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
