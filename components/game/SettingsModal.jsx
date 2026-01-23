'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Volume2, Vibrate, Eye, Palette } from 'lucide-react';

export default function SettingsModal({ 
  open, 
  onOpenChange,
  settings,
  onSettingsChange
}) {
  const handleChange = (key, value) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Game Settings</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <Label htmlFor="sound">Sound Effects</Label>
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
              <Label htmlFor="haptic">Haptic Feedback</Label>
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
              <Label htmlFor="moves">Show Legal Moves</Label>
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
              <Label>Board Theme</Label>
            </div>
            <Select 
              value={settings?.boardTheme ?? 'classic'}
              onValueChange={(v) => handleChange('boardTheme', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="classic">Classic Wood</SelectItem>
                <SelectItem value="dark-marble">Dark Marble</SelectItem>
                <SelectItem value="neon">Neon Cyber</SelectItem>
                <SelectItem value="solana">Solana Purple</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
