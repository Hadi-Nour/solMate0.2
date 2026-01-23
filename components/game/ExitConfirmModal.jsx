'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

export default function ExitConfirmModal({ 
  open, 
  onOpenChange, 
  isOnline = false,
  onConfirm,
  onCancel
}) {
  const { t, direction } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xs" dir={direction}>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-destructive/20">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <DialogTitle>{t('exitConfirm.title')}</DialogTitle>
              <DialogDescription className="text-sm">
                {isOnline 
                  ? t('exitConfirm.onlineMessage')
                  : t('exitConfirm.botMessage')
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <DialogFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            {t('exitConfirm.cancel')}
          </Button>
          <Button variant="destructive" onClick={onConfirm} className="flex-1">
            {t('exitConfirm.leave')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
