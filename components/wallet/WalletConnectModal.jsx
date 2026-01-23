'use client';

import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Wallet, Smartphone, Monitor, Check, Loader2, ExternalLink, ChevronRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n/provider';
import { useSolanaWallet } from './SolanaWalletProvider';

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
      setAvailableWallets(getAvailableWallets());
      setError(null);
      setSelectedWallet(null);
    }
  }, [open, getAvailableWallets]);
  
  // Handle wallet selection and connection
  const handleSelectWallet = async (walletId) => {
    setError(null);
    setSelectedWallet(walletId);
    
    try {
      const address = await connect(walletId);
      onConnected?.(address);
      onOpenChange(false);
    } catch (err) {
      console.error('Connection error:', err);
      setError(err.message || 'Failed to connect');
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
          <ScrollArea className="h-[280px] pr-2">
            <div className="space-y-2">
              {sortedWallets.map((wallet, index) => {
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
                    <Button
                      variant={isRecommended ? 'default' : 'outline'}
                      className={`w-full h-auto py-3 px-4 justify-between ${
                        isRecommended 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 hover:from-green-400 hover:to-emerald-400' 
                          : ''
                      } ${!wallet.installed ? 'opacity-70' : ''}`}
                      onClick={() => wallet.installed ? handleSelectWallet(wallet.id) : window.open(wallet.downloadUrl, '_blank')}
                      disabled={connecting}
                    >
                      <div className="flex items-center gap-3">
                        {/* Wallet icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                          isRecommended ? 'bg-white/20' : 'bg-secondary'
                        }`}>
                          {wallet.icon}
                        </div>
                        
                        <div className="text-start">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{wallet.name}</span>
                            {isRecommended && (
                              <Badge className="bg-yellow-500/20 text-yellow-300 text-[10px] px-1">
                                <Star className="w-3 h-3 me-0.5" /> Recommended
                              </Badge>
                            )}
                          </div>
                          <p className={`text-xs ${isRecommended ? 'text-white/70' : 'text-muted-foreground'}`}>
                            {wallet.installed ? 'Ready to connect' : 'Not installed'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Status indicator */}
                      <div className="flex items-center gap-2">
                        {isConnecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : wallet.installed ? (
                          <Badge variant="secondary" className="text-[10px]">
                            <Check className="w-3 h-3 me-1" /> Ready
                          </Badge>
                        ) : (
                          <span className="text-xs text-primary flex items-center gap-1">
                            Install <ExternalLink className="w-3 h-3" />
                          </span>
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
