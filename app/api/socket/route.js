import { NextResponse } from 'next/server';

// This is a placeholder API route for socket path
// The actual Socket.io server runs via custom server.js

export async function GET(request) {
  return NextResponse.json({ 
    message: 'Socket.io endpoint - connect via websocket',
    path: '/api/socket'
  });
}
