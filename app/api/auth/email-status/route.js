import { NextResponse } from 'next/server';
import { verifyEmailConnection } from '@/lib/email/transporter';

// Health check endpoint for SMTP configuration
// GET /api/auth/email-status
export async function GET() {
  try {
    const result = await verifyEmailConnection();
    
    // Return configuration info (without secrets)
    return NextResponse.json({
      smtp: {
        host: process.env.SMTP_HOST || 'NOT_SET',
        port: process.env.SMTP_PORT || 'NOT_SET',
        user: process.env.SMTP_USER || 'NOT_SET',
        from: process.env.EMAIL_FROM || 'NOT_SET',
        hasPassword: !!process.env.SMTP_PASS,
      },
      status: result.connected ? 'connected' : 'failed',
      error: result.error || null,
      code: result.code || null,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: error.message,
    }, { status: 500 });
  }
}
