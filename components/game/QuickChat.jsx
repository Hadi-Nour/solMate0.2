'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Smile, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';
import { sendQuickChat, getSocket } from '@/lib/socket/client';

// Preset messages (keys for i18n)
const PRESET_MESSAGES = [
  { id: 'goodLuck', emoji: '🍀' },
  { id: 'niceMove', emoji: '👏' },
  { id: 'wow', emoji: '😮' },
  { id: 'oops', emoji: '😅' },
  { id: 'gg', emoji: '🤝' },
  { id: 'thanks', emoji: '🙏' },
  { id: 'rematch', emoji: '🔄' },
  { id: 'wellPlayed', emoji: '⭐' },
];

// Free emotes
const FREE_EMOTES = [
  { id: 'smile', emoji: '😊' },
  { id: 'think', emoji: '🤔' },
  { id: 'fire', emoji: '🔥' },
  { id: 'clap', emoji: '👏' },
  { id: 'trophy', emoji: '🏆' },
  { id: 'chess', emoji: '♟️' },
];

export default function QuickChat({ 
  matchId, 
  yourColor, 
  onChatReceived 
}) {
  const { t } = useI18n();
  const [showPanel, setShowPanel] = useState(false);
  const [activeTab, setActiveTab] = useState('messages');
  const [onCooldown, setOnCooldown] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const [receivedChat, setReceivedChat] = useState(null);
  const currentSocketId = useRef(null);
  const onChatReceivedRef = useRef(onChatReceived);

  // Keep callback ref updated
  useEffect(() => {
    onChatReceivedRef.current = onChatReceived;
  }, [onChatReceived]);

  // Listen for incoming quick chats - with robust socket handling
  useEffect(() => {
    let mounted = true;
    let retryTimeout = null;

    const handleQuickChat = (data) => {
      if (!mounted) return;
      const { from, presetId, type, timestamp } = data;
      console.log('[QuickChat] EVENT RECEIVED:', { from, presetId, type, timestamp, myColor: yourColor });
      
      // Show the chat bubble
      setReceivedChat({ from, presetId, type, timestamp });
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        if (mounted) {
          setReceivedChat(prev => 
            prev?.timestamp === timestamp ? null : prev
          );
        }
      }, 3000);

      if (onChatReceivedRef.current) {
        onChatReceivedRef.current({ from, presetId, type });
      }
    };

    const handleCooldown = ({ remaining }) => {
      if (!mounted) return;
      console.log('[QuickChat] Cooldown received:', remaining);
      setOnCooldown(true);
      setCooldownRemaining(Math.ceil(remaining / 1000));
    };

    const setupListeners = () => {
      const socket = getSocket();
      
      if (!socket) {
        console.log('[QuickChat] No socket yet, retrying in 500ms...');
        retryTimeout = setTimeout(setupListeners, 500);
        return;
      }

      if (!socket.connected) {
        console.log('[QuickChat] Socket exists but not connected, retrying in 500ms...');
        retryTimeout = setTimeout(setupListeners, 500);
        return;
      }

      // Avoid duplicate listeners
      if (listenerSetup.current) {
        console.log('[QuickChat] Listeners already set up, skipping');
        return;
      }

      console.log('[QuickChat] Setting up listeners on socket:', socket.id);
      
      // Add listeners
      socket.on('match:quickchat', handleQuickChat);
      socket.on('quickchat:cooldown', handleCooldown);
      listenerSetup.current = true;

      const listenerCount = socket.listeners('match:quickchat').length;
      console.log('[QuickChat] Listeners attached. Count:', listenerCount);
    };

    setupListeners();

    return () => {
      mounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      
      const socket = getSocket();
      if (socket && listenerSetup.current) {
        console.log('[QuickChat] Cleaning up listeners');
        socket.off('match:quickchat', handleQuickChat);
        socket.off('quickchat:cooldown', handleCooldown);
        listenerSetup.current = false;
      }
    };
  }, [yourColor]); // Re-run if color changes (shouldn't happen but just in case)

  // Re-check socket connection periodically if not connected
  useEffect(() => {
    const checkSocket = () => {
      const socket = getSocket();
      if (socket && socket.connected) {
        console.log('[QuickChat] Socket confirmed connected:', socket.id);
      } else {
        console.log('[QuickChat] Socket not ready, will retry...');
      }
    };
    
    checkSocket();
    const interval = setInterval(checkSocket, 2000);
    
    return () => clearInterval(interval);
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (onCooldown && cooldownRemaining > 0) {
      const timer = setTimeout(() => {
        setCooldownRemaining(prev => prev - 1);
        if (cooldownRemaining <= 1) {
          setOnCooldown(false);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [onCooldown, cooldownRemaining]);

  const handleSendMessage = useCallback((presetId) => {
    if (onCooldown) return;
    console.log('[QuickChat] Sending message:', { matchId, presetId, type: 'message' });
    sendQuickChat(matchId, presetId, 'message');
    setShowPanel(false);
    setOnCooldown(true);
    setCooldownRemaining(3);
  }, [matchId, onCooldown]);

  const handleSendEmote = useCallback((emoteId) => {
    if (onCooldown) return;
    console.log('[QuickChat] Sending emote:', { matchId, emoteId, type: 'emote' });
    sendQuickChat(matchId, emoteId, 'emote');
    setShowPanel(false);
    setOnCooldown(true);
    setCooldownRemaining(3);
  }, [matchId, onCooldown]);

  // Get localized message text
  const getMessageText = (presetId) => {
    return t(`quickchat.${presetId}`);
  };

  // Get emote display
  const getEmoteDisplay = (emoteId) => {
    const emote = FREE_EMOTES.find(e => e.id === emoteId);
    return emote?.emoji || '❓';
  };

  return (
    <>
      {/* Chat Button */}
      <Button 
        variant="outline" 
        size="icon"
        onClick={() => setShowPanel(true)}
        disabled={onCooldown}
        className="relative"
      >
        <MessageCircle className="h-4 w-4" />
        {onCooldown && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-[10px] rounded-full flex items-center justify-center">
            {cooldownRemaining}
          </span>
        )}
      </Button>

      {/* Chat Panel Dialog */}
      <Dialog open={showPanel} onOpenChange={setShowPanel}>
        <DialogContent className="max-w-xs p-3">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4" />
              {t('quickchat.title')}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="messages" className="text-xs">
                💬 {t('quickchat.messages')}
              </TabsTrigger>
              <TabsTrigger value="emotes" className="text-xs">
                😊 {t('quickchat.emotes')}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="messages" className="mt-2">
              <div className="grid grid-cols-2 gap-2">
                {PRESET_MESSAGES.map((msg) => (
                  <Button
                    key={msg.id}
                    variant="outline"
                    size="sm"
                    className="h-auto py-2 px-2 flex flex-col gap-1 text-xs"
                    onClick={() => handleSendMessage(msg.id)}
                    disabled={onCooldown}
                  >
                    <span className="text-base">{msg.emoji}</span>
                    <span className="truncate w-full text-center">
                      {getMessageText(msg.id)}
                    </span>
                  </Button>
                ))}
              </div>
            </TabsContent>
            
            <TabsContent value="emotes" className="mt-2">
              <div className="grid grid-cols-3 gap-2">
                {FREE_EMOTES.map((emote) => (
                  <Button
                    key={emote.id}
                    variant="outline"
                    size="lg"
                    className="h-14 text-2xl"
                    onClick={() => handleSendEmote(emote.id)}
                    disabled={onCooldown}
                  >
                    {emote.emoji}
                  </Button>
                ))}
              </div>
            </TabsContent>
          </Tabs>
          
          {onCooldown && (
            <p className="text-xs text-center text-muted-foreground mt-2">
              {t('quickchat.cooldown')} ({cooldownRemaining}s)
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Chat Bubble Display */}
      <AnimatePresence>
        {receivedChat && (
          <ChatBubble
            from={receivedChat.from}
            presetId={receivedChat.presetId}
            type={receivedChat.type}
            yourColor={yourColor}
            t={t}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Chat Bubble Component
function ChatBubble({ from, presetId, type, yourColor, t }) {
  const isFromYou = from === yourColor;
  
  let content;
  if (type === 'emote') {
    const emote = FREE_EMOTES.find(e => e.id === presetId);
    content = <span className="text-2xl">{emote?.emoji || '❓'}</span>;
  } else {
    const msg = PRESET_MESSAGES.find(m => m.id === presetId);
    content = (
      <span className="text-sm">
        {msg?.emoji} {t(`quickchat.${presetId}`)}
      </span>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      className={`fixed z-50 ${
        isFromYou 
          ? 'bottom-40 left-1/2 -translate-x-1/2' 
          : 'top-32 left-1/2 -translate-x-1/2'
      }`}
    >
      <div className={`px-4 py-2 rounded-2xl shadow-lg ${
        isFromYou
          ? 'bg-primary text-primary-foreground'
          : 'bg-secondary text-secondary-foreground'
      }`}>
        {content}
      </div>
    </motion.div>
  );
}

// Export for use in other components
export { PRESET_MESSAGES, FREE_EMOTES };
