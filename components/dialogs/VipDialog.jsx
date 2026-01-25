'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Crown, Loader2, CheckCircle, XCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { PAYMENT_STATES, PAYMENT_STATUS_MESSAGES } from '@/hooks/useVipPayment';

export default function VipDialog({ 
  open, 
  onOpenChange, 
  user, 
  onPayUsdc, 
  onPaySol, 
  paymentState = PAYMENT_STATES.IDLE,
  statusMessage = '',
  errorMessage = null,
  txSignature = null,
  onReset,
  config = {}
}) {
  const isProcessing = ![PAYMENT_STATES.IDLE, PAYMENT_STATES.SUCCESS, PAYMENT_STATES.ERROR].includes(paymentState);
  const price = config.vipPriceUsdc || 6.99;
  const cluster = config.cluster || 'devnet';
  
  // Get explorer URL for transaction
  const getExplorerUrl = (sig) => {
    const base = cluster === 'mainnet-beta' 
      ? 'https://explorer.solana.com' 
      : 'https://explorer.solana.com';
    const params = cluster === 'mainnet-beta' ? '' : '?cluster=devnet';
    return `${base}/tx/${sig}${params}`;
  };

  // Render payment status UI
  const renderPaymentStatus = () => {
    if (paymentState === PAYMENT_STATES.IDLE) return null;

    if (paymentState === PAYMENT_STATES.SUCCESS) {
      return (
        <div className="space-y-4">
          <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <CheckCircle className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="font-bold text-green-500">Payment Successful!</p>
              <p className="text-sm text-muted-foreground">VIP Lifetime activated</p>
            </div>
          </div>
          {txSignature && (
            <a
              href={getExplorerUrl(txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              View transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <Button onClick={() => onOpenChange(false)} className="w-full">
            Done
          </Button>
        </div>
      );
    }

    if (paymentState === PAYMENT_STATES.ERROR) {
      return (
        <div className="space-y-4">
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>
              {errorMessage || 'Payment failed. Please try again.'}
            </AlertDescription>
          </Alert>
          {txSignature && (
            <a
              href={getExplorerUrl(txSignature)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
            >
              View transaction <ExternalLink className="w-3 h-3" />
            </a>
          )}
          <Button onClick={onReset} variant="outline" className="w-full">
            Try Again
          </Button>
        </div>
      );
    }

    // Processing states
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-secondary">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <div className="text-center">
            <p className="font-medium">{statusMessage || PAYMENT_STATUS_MESSAGES[paymentState]}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {paymentState === PAYMENT_STATES.AWAITING_SIGNATURE && 'Check your wallet'}
              {paymentState === PAYMENT_STATES.CONFIRMING && 'This may take up to 60 seconds'}
              {paymentState === PAYMENT_STATES.VERIFYING && 'Almost done...'}
            </p>
          </div>
        </div>
        {txSignature && (
          <a
            href={getExplorerUrl(txSignature)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-sm text-primary hover:underline"
          >
            View transaction <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={isProcessing ? undefined : onOpenChange}>
      <DialogContent className={isProcessing ? 'pointer-events-auto' : ''}>
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
          {/* Network indicator */}
          {cluster && (
            <div className={`flex items-center gap-2 text-xs px-2 py-1 rounded w-fit ${
              cluster === 'mainnet-beta' 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-yellow-500/20 text-yellow-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                cluster === 'mainnet-beta' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              {cluster === 'mainnet-beta' ? 'Mainnet' : 'Devnet'}
            </div>
          )}

          {/* Payment status or default UI */}
          {paymentState !== PAYMENT_STATES.IDLE ? (
            renderPaymentStatus()
          ) : (
            <>
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
                <p className="text-3xl font-bold solana-text-gradient">${price.toFixed(2)}</p>
                <p className="text-sm text-muted-foreground">Lifetime Access</p>
              </div>
              
              {!user ? (
                <Alert>
                  <AlertTriangle className="w-4 h-4" />
                  <AlertDescription>
                    Please sign in first to purchase VIP
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={onPayUsdc}
                    disabled={isProcessing}
                  >
                    Pay {price.toFixed(2)} USDC
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={onPaySol}
                    disabled={isProcessing}
                  >
                    Pay with SOL (equivalent)
                  </Button>
                  <p className="text-xs text-center text-muted-foreground">
                    {cluster === 'devnet' && '⚠️ Using Devnet - test tokens only'}
                    {cluster === 'mainnet-beta' && 'SOL price locked for 30s after quote'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
