'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Check for different scenarios
  const token = searchParams.get('token');
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const authToken = searchParams.get('token'); // Auto-login token from verification

  const [status, setStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Handle redirect from verify-otp API with success and authToken
    if (success === 'true' && authToken) {
      // Auto-login: Store the auth token
      localStorage.setItem('solmate_token', authToken);
      setStatus('success');
      setMessage('Email verified successfully! Redirecting to game...');
      
      // Redirect to game after a short delay
      setTimeout(() => {
        router.push('/');
      }, 2000);
      return;
    }

    // Handle error from redirect
    if (error) {
      setStatus('error');
      const errorMessages = {
        'missing_token': 'Verification token is missing.',
        'invalid_token': 'This verification link is invalid or has expired.',
        'server_error': 'An error occurred during verification. Please try again.',
      };
      setMessage(errorMessages[error] || 'Verification failed.');
      return;
    }

    // Handle direct token verification (legacy flow)
    if (token && success !== 'true') {
      verifyToken(token);
      return;
    }

    // No token or success - show generic message
    if (!token && !success) {
      setStatus('error');
      setMessage('No verification information provided.');
    }
  }, [token, success, error, authToken, router]);

  const verifyToken = async (verificationToken) => {
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verificationToken }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Email verified successfully!');
        
        // Auto-login if authToken provided
        if (data.authToken) {
          localStorage.setItem('solmate_token', data.authToken);
          if (data.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
          }
          
          // Redirect to game
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('An error occurred during verification.');
    }
  };

  // Loading state
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying your email...</p>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold">
              <span className="text-4xl">♟️</span>
              <span className="solana-text-gradient">PlaySolMates</span>
            </Link>
          </div>

          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
            <CardHeader className="text-center">
              <motion.div 
                className="mx-auto w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-4"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5 }}
              >
                <CheckCircle2 className="w-10 h-10 text-green-500" />
              </motion.div>
              <CardTitle className="text-2xl">Email Verified! 🎉</CardTitle>
              <CardDescription className="text-base">
                {message}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Redirecting to game...
              </div>
              
              <Button
                className="w-full h-11 solana-gradient text-black font-semibold"
                onClick={() => router.push('/')}
              >
                Start Playing Now
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Error state
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold">
            <span className="text-4xl">♟️</span>
            <span className="solana-text-gradient">PlaySolMates</span>
          </Link>
        </div>

        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Verification Failed</CardTitle>
            <CardDescription>
              {message}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              The verification link may have expired. Please try signing up again or request a new verification email.
            </p>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => router.push('/auth/signup')}
              >
                Sign Up Again
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push('/auth/login')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
