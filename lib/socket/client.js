'use client';

import { io } from 'socket.io-client';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket(token) {
  if (socket?.connected) {
    console.log('[Socket] Already connected with id:', socket.id);
    return socket;
  }
  
  socket = io({
    path: '/api/socket',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected with id:', socket.id);
  });
  
  socket.on('connect_error', (error) => {
    console.error('[Socket] ❌ Connection error:', error.message);
  });
  
  socket.on('disconnect', (reason) => {
    console.log('[Socket] ⚠️ Disconnected:', reason);
  });

  // DEBUG: Log ALL incoming events
  socket.onAny((eventName, ...args) => {
    console.log('[Socket] 📨 Event received:', eventName, args);
  });
  
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Matchmaking functions
export function joinQueue(timeControl, isVipArena) {
  if (!socket?.connected) return;
  socket.emit('queue:join', { timeControl, isVipArena });
}

export function leaveQueue() {
  if (!socket?.connected) return;
  socket.emit('queue:leave');
}

// Game functions
export function makeMove(matchId, from, to, promotion) {
  if (!socket?.connected) return;
  socket.emit('match:move', { matchId, from, to, promotion });
}

export function resign(matchId) {
  if (!socket?.connected) return;
  socket.emit('match:resign', { matchId });
}

export function offerDraw(matchId) {
  if (!socket?.connected) return;
  socket.emit('match:offer_draw', { matchId });
}

export function acceptDraw(matchId) {
  if (!socket?.connected) return;
  socket.emit('match:accept_draw', { matchId });
}

export function declineDraw(matchId) {
  if (!socket?.connected) return;
  socket.emit('match:decline_draw', { matchId });
}

// Quick Chat functions
export function sendQuickChat(matchId, presetId, type = 'message') {
  if (!socket?.connected) {
    console.error('[Socket] Cannot send quick chat - socket not connected');
    return;
  }
  console.log('[Socket] Emitting match:quickchat:', { matchId, presetId, type });
  socket.emit('match:quickchat', { matchId, presetId, type });
}
