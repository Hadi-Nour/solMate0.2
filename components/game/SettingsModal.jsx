'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Vibrate, Eye, Palette, Globe } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';
import { locales, languageNames } from '@/lib/i18n/config';

export default function SettingsModal({ 
  open, 
  onOpenChange,
  settings,
  onSettingsChange
}) {
  const { t, locale, setLocale, direction } = useI18n();

  const handleChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm" dir={direction}>
        <DialogHeader>
          <DialogTitle>{t('settings.title')}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Language Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <Label>{t('settings.language')}</Label>
            </div>
            <Select 
              value={locale}
              onValueChange={setLocale}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locales.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {languageNames[loc]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Separator />
          
          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="sound">{t('settings.sound')}</Label>
            </div>
            <Switch 
              id="sound" 
              checked={settings?.soundEnabled ?? true}
              onCheckedChange={(v) => handleChange('soundEnabled', v)}
            />
          </div>
          
          {/* Vibration */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="haptic">{t('settings.haptic')}</Label>
            </div>
            <Switch 
              id="haptic" 
              checked={settings?.hapticEnabled ?? true}
              onCheckedChange={(v) => handleChange('hapticEnabled', v)}
            />
          </div>
          
          <Separator />
          
          {/* Show Legal Moves */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="moves">{t('settings.legalMoves')}</Label>
            </div>
            <Switch 
              id="moves" 
              checked={settings?.showLegalMoves ?? true}
              onCheckedChange={(v) => handleChange('showLegalMoves', v)}
            />
          </div>
          
          <Separator />
          
          {/* Board Theme */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <Label>{t('settings.boardTheme')}</Label>
            </div>
            <Select 
              value={settings?.boardTheme ?? 'classic'}
              onValueChange={(v) => handleChange('boardTheme', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">{t('settings.themes.classic')}</SelectItem>
                <SelectItem value="dark-marble">{t('settings.themes.darkMarble')}</SelectItem>
                <SelectItem value="neon">{t('settings.themes.neon')}</SelectItem>
                <SelectItem value="solana">{t('settings.themes.solana')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
