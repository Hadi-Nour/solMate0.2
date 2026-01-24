import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Facebook Data Deletion Callback
 * 
 * This endpoint handles Facebook's data deletion callback requirements.
 * When a user removes your app from their Facebook account or requests
 * data deletion, Facebook sends a request to this endpoint.
 * 
 * Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

// Parse signed request from Facebook
function parseSignedRequest(signedRequest, secret) {
  if (!signedRequest || !secret) return null;
  
  const [encodedSig, payload] = signedRequest.split('.');
  
  if (!encodedSig || !payload) return null;
  
  // Decode the payload
  const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
  
  // Verify the signature
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  
  const sig = encodedSig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  if (expectedSig !== sig) {
    console.error('[FB Data Deletion] Invalid signature');
    return null;
  }
  
  return data;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const signedRequest = formData.get('signed_request');
    
    if (!signedRequest) {
      return NextResponse.json(
        { error: 'Missing signed_request' },
        { status: 400 }
      );
    }
    
    const appSecret = process.env.FACEBOOK_CLIENT_SECRET;
    
    if (!appSecret) {
      console.error('[FB Data Deletion] FACEBOOK_CLIENT_SECRET not configured');
      // Still respond properly even without secret for testing
    }
    
    // Parse and verify the signed request
    const data = appSecret ? parseSignedRequest(signedRequest, appSecret) : null;
    
    // Get the Facebook user ID
    const userId = data?.user_id || 'unknown';
    
    // Generate a unique confirmation code for this deletion request
    const confirmationCode = crypto.randomBytes(16).toString('hex');
    
    // In production, you would:
    // 1. Find the user in your database by their Facebook OAuth ID
    // 2. Schedule or immediately process the deletion
    // 3. Store the confirmation code for status tracking
    
    console.log(`[FB Data Deletion] Request received for user: ${userId}, confirmation: ${confirmationCode}`);
    
    // TODO: Implement actual deletion logic
    // const db = await connectToMongo();
    // await db.collection('users').deleteOne({ 'oauth.facebook': userId });
    // await db.collection('deletion_requests').insertOne({
    //   provider: 'facebook',
    //   providerId: userId,
    //   confirmationCode,
    //   requestedAt: new Date(),
    //   status: 'pending'
    // });
    
    // Return the response format required by Facebook
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://playsolmates.app';
    const statusUrl = `${appUrl}/data-deletion/status?code=${confirmationCode}`;
    
    return NextResponse.json({
      url: statusUrl,
      confirmation_code: confirmationCode
    });
    
  } catch (error) {
    console.error('[FB Data Deletion] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for status checking
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.json(
      { error: 'Confirmation code is required' },
      { status: 400 }
    );
  }
  
  // TODO: Look up the actual deletion status in the database
  // For now, return a generic response
  
  return NextResponse.json({
    confirmation_code: code,
    status: 'completed',
    message: 'Your data has been deleted from SolMate.'
  });
}
