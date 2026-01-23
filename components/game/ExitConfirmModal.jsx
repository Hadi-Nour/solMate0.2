'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ExitConfirmModal({ 
  open, 
  onOpenChange, 
  isOnline = false,
  onConfirm,
  onCancel
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/20">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle>Leave Match?</DialogTitle>
              <DialogDescription className="text-sm">
                {isOnline 
                  ? 'Leaving will count as a resignation. You will lose this game.'
                  : 'Your current game progress will be lost.'
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">
            Leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
