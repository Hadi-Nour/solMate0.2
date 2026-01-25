'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageCircle, Smile, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';
import { sendQuickChat, getSocket } from '@/lib/socket/client';

// Debug mode controlled by environment variable (default: false)
const DEBUG_QUICKCHAT = process.env.NEXT_PUBLIC_DEBUG_QUICKCHAT === 'true';

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
  const [debugCounter, setDebugCounter] = useState(0);
  const currentSocketId = useRef(null);
  const onChatReceivedRef = useRef(onChatReceived);

  // Keep callback ref updated
  useEffect(() => {
    onChatReceivedRef.current = onChatReceived;
  }, [onChatReceived]);

  // Listen for incoming quick chats
  useEffect(() => {
    let mounted = true;
    let pollInterval = null;

    const handleQuickChat = (data) => {
      if (!mounted) {
        if (DEBUG_QUICKCHAT) console.log('[QuickChat] ⚠️ Not mounted, ignoring event');
        return;
      }
      const { from, presetId, type, timestamp } = data;
      if (DEBUG_QUICKCHAT) {
        console.log('[QuickChat] ✅ EVENT RECEIVED:', { from, presetId, type, timestamp, myColor: yourColor });
      }
      
      // Increment debug counter
      setDebugCounter(prev => prev + 1);
      
      // Show the chat bubble
      const chatData = { from, presetId, type, timestamp };
      setReceivedChat(chatData);
      
      // Auto-hide after 4 seconds
      setTimeout(() => {
        if (mounted) {
          setReceivedChat(prev => {
            if (prev?.timestamp === timestamp) {
              return null;
            }
            return prev;
          });
        }
      }, 4000);

      if (onChatReceivedRef.current) {
        onChatReceivedRef.current({ from, presetId, type });
      }
    };

    const handleCooldown = ({ remaining }) => {
      if (!mounted) return;
      if (DEBUG_QUICKCHAT) console.log('[QuickChat] Cooldown received:', remaining);
      setOnCooldown(true);
      setCooldownRemaining(Math.ceil(remaining / 1000));
    };

    const checkAndSetupListeners = () => {
      const socket = getSocket();
      
      if (!socket || !socket.connected) {
        return; // Will retry via interval
      }

      // If socket.id changed, we need to re-attach listeners
      if (currentSocketId.current !== socket.id) {
        // Remove old listeners if they exist
        if (currentSocketId.current) {
          if (DEBUG_QUICKCHAT) console.log('[QuickChat] Socket changed from', currentSocketId.current, 'to', socket.id);
          socket.off('match:quickchat', handleQuickChat);
          socket.off('quickchat:cooldown', handleCooldown);
        }
        
        // Attach new listeners
        if (DEBUG_QUICKCHAT) console.log('[QuickChat] Attaching listeners to socket:', socket.id);
        socket.on('match:quickchat', handleQuickChat);
        socket.on('quickchat:cooldown', handleCooldown);
        currentSocketId.current = socket.id;
      }
    };

    // Initial setup
    checkAndSetupListeners();
    
    // Poll to catch socket reconnections
    pollInterval = setInterval(checkAndSetupListeners, 1000);

    return () => {
      mounted = false;
      if (pollInterval) clearInterval(pollInterval);
      
      const socket = getSocket();
      if (socket) {
        if (DEBUG_QUICKCHAT) console.log('[QuickChat] Cleanup: removing listeners');
        socket.off('match:quickchat', handleQuickChat);
        socket.off('quickchat:cooldown', handleCooldown);
      }
      currentSocketId.current = null;
    };
  }, [yourColor]);

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
    
    if (DEBUG_QUICKCHAT) {
      const socket = getSocket();
      console.log('[QuickChat] 📤 Sending message:', { matchId, presetId, type: 'message' });
      console.log('[QuickChat] 📤 Using socket:', socket?.id, 'Connected:', socket?.connected);
    }
    
    sendQuickChat(matchId, presetId, 'message', (ack) => {
      if (DEBUG_QUICKCHAT) {
        console.log('[QuickChat] 📤 Server ACK:', ack);
      }
    });
    
    setShowPanel(false);
    setOnCooldown(true);
    setCooldownRemaining(3);
  }, [matchId, onCooldown]);

  const handleSendEmote = useCallback((emoteId) => {
    if (onCooldown) return;
    
    if (DEBUG_QUICKCHAT) {
      const socket = getSocket();
      console.log('[QuickChat] 📤 Sending emote:', { matchId, emoteId, type: 'emote' });
      console.log('[QuickChat] 📤 Using socket:', socket?.id, 'Connected:', socket?.connected);
    }
    
    sendQuickChat(matchId, emoteId, 'emote', (ack) => {
      if (DEBUG_QUICKCHAT) {
        console.log('[QuickChat] 📤 Server ACK:', ack);
      }
    });
    
    setShowPanel(false);
    setOnCooldown(true);
    setCooldownRemaining(3);
  }, [matchId, onCooldown]);

  // Get localized message text
  const getMessageText = (presetId) => {
    return t(`quickchat.${presetId}`);
  };

  // Debug log when receivedChat changes (only in debug mode)
  useEffect(() => {
    if (DEBUG_QUICKCHAT) {
      console.log('[QuickChat] 🎯 receivedChat state changed:', receivedChat);
    }
  }, [receivedChat]);

  return (
    <>
      {/* DEBUG INDICATOR - Only visible when NEXT_PUBLIC_DEBUG_QUICKCHAT=true */}
      {DEBUG_QUICKCHAT && (
        <div className="fixed top-2 right-2 z-[9999] bg-black/80 text-white text-xs p-2 rounded font-mono">
          <div>📨 Received: {debugCounter}</div>
          <div>💬 Chat: {receivedChat ? 'SET' : 'NULL'}</div>
          {receivedChat && (
            <div>From: {receivedChat.from} | Type: {receivedChat.type}</div>
          )}
        </div>
      )}

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
        <DialogContent className="max-w-xs p-3" aria-describedby="quickchat-description">
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center gap-2 text-base">
              <MessageCircle className="h-4 w-4" />
              {t('quickchat.title')}
            </DialogTitle>
            <DialogDescription id="quickchat-description" className="sr-only">
              Send quick chat messages or emotes to your opponent
            </DialogDescription>
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

      {/* Chat Bubble Display - Using Portal to render at document.body level */}
      {typeof document !== 'undefined' && receivedChat && createPortal(
        <AnimatePresence>
          <ChatBubblePortal
            key={receivedChat.timestamp}
            from={receivedChat.from}
            presetId={receivedChat.presetId}
            type={receivedChat.type}
            yourColor={yourColor}
            t={t}
          />
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

// Chat Bubble Component - Rendered via Portal with FORCED VISIBILITY
function ChatBubblePortal({ from, presetId, type, yourColor, t }) {
  const isFromYou = from === yourColor;
  
  if (DEBUG_QUICKCHAT) {
    console.log('[ChatBubble] 🎨 PORTAL Rendering:', { from, presetId, type, yourColor, isFromYou });
  }
  
  let content;
  if (type === 'emote') {
    const emote = FREE_EMOTES.find(e => e.id === presetId);
    content = <span className="text-3xl">{emote?.emoji || '❓'}</span>;
  } else {
    const msg = PRESET_MESSAGES.find(m => m.id === presetId);
    content = (
      <span className="text-base font-semibold">
        {msg?.emoji} {t(`quickchat.${presetId}`)}
      </span>
    );
  }

  // FORCED VISIBILITY: Fixed position, highest z-index, bright colors
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.8 }}
      transition={{ type: 'spring', damping: 15, stiffness: 300 }}
      style={{
        position: 'fixed',
        zIndex: 999999,
        pointerEvents: 'none',
        left: '50%',
        transform: 'translateX(-50%)',
        top: isFromYou ? 'auto' : '100px',
        bottom: isFromYou ? '200px' : 'auto',
      }}
    >
      <div 
        style={{
          padding: '12px 24px',
          borderRadius: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          border: '3px solid',
          borderColor: isFromYou ? '#22c55e' : '#3b82f6',
          backgroundColor: isFromYou ? '#166534' : '#1e40af',
          color: 'white',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        {content}
      </div>
    </motion.div>
  );
}

// Export for use in other components
export { PRESET_MESSAGES, FREE_EMOTES };
