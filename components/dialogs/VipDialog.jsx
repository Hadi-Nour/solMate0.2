'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';

export default function VipDialog({ open, onOpenChange, user, onPayUsdc, onPaySol, loading, price = 6.99 }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-500" />
            Unlock VIP
          </DialogTitle>
          <DialogDescription>
            Get lifetime access to VIP Arena and earn rewards!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-secondary">
            <h3 className="font-bold mb-2">VIP Benefits</h3>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>✓ Access VIP Arena (ranked matches)</li>
              <li>✓ Earn Bronze Chests on wins</li>
              <li>✓ 5-win streak = Silver Chest + Gold Point</li>
              <li>✓ 5 Gold Points = Gold Chest</li>
              <li>✓ Compete on leaderboards</li>
            </ul>
          </div>
          
          <div className="text-center">
            <p className="text-3xl font-bold solana-text-gradient">${price}</p>
            <p className="text-sm text-muted-foreground">Lifetime Access</p>
          </div>
          
          {!user ? (
            <p className="text-center text-sm text-muted-foreground">
              Please sign in first to purchase VIP
            </p>
          ) : (
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={onPayUsdc}
                disabled={loading}
              >
                {loading ? 'Processing...' : `Pay ${price} USDC`}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={onPaySol}
                disabled={loading}
              >
                {loading ? 'Processing...' : 'Pay with SOL (equivalent)'}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                SOL price locked for 30s after quote
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
