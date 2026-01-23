'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { User, Check, Lock, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useI18n } from '@/lib/i18n/provider';

// Avatar data with emojis for display
const AVATARS = [
  { id: 'default', emoji: '👤', rarity: 'common' },
  { id: 'pawn', emoji: '♟️', rarity: 'uncommon' },
  { id: 'knight', emoji: '♞', rarity: 'rare' },
  { id: 'bishop', emoji: '♝', rarity: 'rare' },
  { id: 'rook', emoji: '♜', rarity: 'epic' },
  { id: 'queen', emoji: '♛', rarity: 'epic' },
  { id: 'king', emoji: '♚', rarity: 'legendary' },
  { id: 'grandmaster', emoji: '🏆', rarity: 'legendary' },
];

const RARITY_COLORS = {
  common: 'bg-gray-500/20 border-gray-500/30',
  uncommon: 'bg-green-500/20 border-green-500/30',
  rare: 'bg-blue-500/20 border-blue-500/30',
  epic: 'bg-purple-500/20 border-purple-500/30',
  legendary: 'bg-yellow-500/20 border-yellow-500/30',
};

export default function EditProfileModal({ 
  open, 
  onOpenChange,
  user,
  authToken,
  onProfileUpdated
}) {
  const { t, direction } = useI18n();
  
  const [displayName, setDisplayName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('default');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Initialize values when modal opens
  useEffect(() => {
    if (open && user) {
      setDisplayName(user.displayName || '');
      setSelectedAvatar(user.equipped?.avatar || 'default');
      setError('');
    }
  }, [open, user]);
  
  // Get owned avatars from inventory
  const getOwnedAvatars = () => {
    const owned = ['default']; // default is always owned
    if (user?.inventory) {
      user.inventory.forEach(item => {
        if (item.startsWith('avatar_')) {
          owned.push(item.replace('avatar_', ''));
        }
      });
    }
    return owned;
  };
  
  const ownedAvatars = getOwnedAvatars();
  
  // Validate display name
  const validateName = (name) => {
    if (!name || name.trim() === '') return null; // Empty is allowed (clears name)
    const trimmed = name.trim();
    
    if (trimmed.length < 3 || trimmed.length > 16) {
      return t('profile.validation.lengthError');
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return t('profile.validation.charactersError');
    }
    
    return null;
  };
  
  const handleSave = async () => {
    // Validate
    const nameError = validateName(displayName);
    if (nameError) {
      setError(nameError);
      return;
    }
    
    setIsSaving(true);
    setError('');
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          avatarId: selectedAvatar
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Failed to update profile');
        return;
      }
      
      // Success
      if (onProfileUpdated) {
        onProfileUpdated(data.profile);
      }
      onOpenChange(false);
      
    } catch (e) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Helper to get display name with wallet suffix if needed
  const getPreviewName = () => {
    if (displayName.trim()) {
      return displayName.trim();
    }
    if (user?.wallet) {
      return `${user.wallet.slice(0, 4)}...${user.wallet.slice(-4)}`;
    }
    return 'Anonymous';
  };
  
  const getAvatarEmoji = (avatarId) => {
    return AVATARS.find(a => a.id === avatarId)?.emoji || '👤';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir={direction}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            {t('profile.editProfile')}
          </DialogTitle>
          <DialogDescription>
            {t('profile.previewTitle')}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Preview Card */}
          <motion.div 
            className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center text-3xl border-2 border-primary/30">
                {getAvatarEmoji(selectedAvatar)}
              </div>
              <div>
                <p className="text-lg font-bold">{getPreviewName()}</p>
                <p className="text-xs text-muted-foreground font-mono">
                  {user?.friendCode || '--------'}
                </p>
              </div>
            </div>
          </motion.div>
          
          {/* Display Name Input */}
          <div className="space-y-2">
            <Label htmlFor="displayName">{t('profile.displayName')}</Label>
            <Input
              id="displayName"
              placeholder={t('profile.displayNamePlaceholder')}
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError('');
              }}
              maxLength={16}
              className="font-medium"
            />
            <p className="text-xs text-muted-foreground">
              {displayName.trim().length}/16 - {t('profile.validation.charactersError')}
            </p>
          </div>
          
          {/* Avatar Selection */}
          <div className="space-y-2">
            <Label>{t('profile.selectAvatar')}</Label>
            <ScrollArea className="h-32">
              <div className="grid grid-cols-4 gap-2">
                {AVATARS.map((avatar) => {
                  const isOwned = ownedAvatars.includes(avatar.id);
                  const isSelected = selectedAvatar === avatar.id;
                  
                  return (
                    <motion.button
                      key={avatar.id}
                      onClick={() => isOwned && setSelectedAvatar(avatar.id)}
                      disabled={!isOwned}
                      className={`relative p-3 rounded-xl border-2 transition-all ${
                        isSelected 
                          ? 'border-primary bg-primary/20 ring-2 ring-primary/30' 
                          : isOwned
                            ? `${RARITY_COLORS[avatar.rarity]} hover:border-primary/50`
                            : 'border-muted bg-muted/30 opacity-50 cursor-not-allowed'
                      }`}
                      whileHover={isOwned ? { scale: 1.05 } : {}}
                      whileTap={isOwned ? { scale: 0.95 } : {}}
                    >
                      <div className="text-2xl text-center">{avatar.emoji}</div>
                      <p className="text-[10px] text-center mt-1 truncate">
                        {t(`profile.avatars.${avatar.id}`)}
                      </p>
                      
                      {/* Selection indicator */}
                      {isSelected && (
                        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-3 h-3 text-black" />
                        </div>
                      )}
                      
                      {/* Lock indicator */}
                      {!isOwned && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
              {t('profile.avatars.locked')}: {AVATARS.length - ownedAvatars.length}
            </p>
          </div>
          
          {/* Error Message */}
          {error && (
            <motion.div 
              className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {error}
            </motion.div>
          )}
          
          {/* Save Button */}
          <Button 
            className="w-full solana-gradient text-black font-bold"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 me-2 animate-spin" />
                {t('profile.saving')}
              </>
            ) : (
              t('profile.saveChanges')
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
