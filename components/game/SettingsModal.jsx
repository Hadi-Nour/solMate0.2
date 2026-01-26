'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Volume2, VolumeX, Vibrate, Eye, Palette, Globe, Volume1, Lock, Loader2, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';
import { useFeedbackContext } from '@/lib/feedback/provider';
import { locales, languageNames } from '@/lib/i18n/config';
import { toast } from 'sonner';

export default function SettingsModal({ 
  open, 
  onOpenChange,
  settings,
  onSettingsChange,
  authToken,
  user
}) {
  const { t, locale, setLocale, direction } = useI18n();
  const feedback = useFeedbackContext();
  
  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const handleChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
    
    // Also update feedback context for sound/haptic
    if (key === 'soundEnabled') {
      feedback.setSoundEnabled(value);
      // Play a test sound when enabling
      if (value) {
        setTimeout(() => feedback.buttonClick(), 100);
      }
    } else if (key === 'hapticEnabled') {
      feedback.setHapticEnabled(value);
      // Trigger a test vibration when enabling
      if (value) {
        setTimeout(() => feedback.buttonClick(), 100);
      }
    }
  };

  const handleVolumeChange = (value) => {
    const volume = value[0] / 100;
    feedback.setMasterVolume(volume);
    // Play a test sound at the new volume
    feedback.playSound(feedback.EVENTS.BUTTON_CLICK);
  };

  // Get volume icon based on level
  const VolumeIcon = feedback.masterVolume === 0 ? VolumeX : 
                     feedback.masterVolume < 0.5 ? Volume1 : Volume2;

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
          <div className="space-y-4">
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
            
            {/* Volume Slider - only show when sound is enabled */}
            {(settings?.soundEnabled ?? true) && (
              <div className="flex items-center gap-3 pl-8">
                <VolumeIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <Slider
                  value={[feedback.masterVolume * 100]}
                  onValueChange={handleVolumeChange}
                  max={100}
                  step={10}
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8 text-right">
                  {Math.round(feedback.masterVolume * 100)}%
                </span>
              </div>
            )}
          </div>
          
          {/* Vibration */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Vibrate className="h-5 w-5 text-muted-foreground" />
              <div>
                <Label htmlFor="haptic">{t('settings.haptic')}</Label>
                {!feedback.isVibrationSupported && (
                  <p className="text-xs text-muted-foreground">
                    Not supported on this device
                  </p>
                )}
              </div>
            </div>
            <Switch 
              id="haptic" 
              checked={settings?.hapticEnabled ?? true}
              onCheckedChange={(v) => handleChange('hapticEnabled', v)}
              disabled={!feedback.isVibrationSupported}
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
