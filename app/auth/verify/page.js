'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, already-verified
  const [message, setMessage] = useState('');

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      return;
    }

    // Verify the token
    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.alreadyVerified) {
            setStatus('already-verified');
            setMessage('Your email is already verified');
          } else {
            setStatus('success');
            setMessage(data.message || 'Email verified successfully!');
          }
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed');
        }
      })
      .catch((err) => {
        console.error('Verification error:', err);
        setStatus('error');
        setMessage('An error occurred during verification');
      });
  }, [token]);

  const renderContent = () => {
    switch (status) {
      case 'verifying':
        return (
          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
              <CardTitle>Verifying your email</CardTitle>
              <CardDescription>Please wait...</CardDescription>
            </CardHeader>
          </Card>
        );

      case 'success':
        return (
          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle>Email Verified!</CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your email has been verified successfully. You can now sign in to your account.
              </p>
              <Button
                className="w-full solana-gradient text-black font-semibold"
                onClick={() => router.push('/auth/login')}
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        );

      case 'already-verified':
        return (
          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-blue-500" />
              </div>
              <CardTitle>Already Verified</CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Your email address has already been verified. You can sign in to your account.
              </p>
              <Button
                className="w-full solana-gradient text-black font-semibold"
                onClick={() => router.push('/auth/login')}
              >
                Sign In
              </Button>
            </CardContent>
          </Card>
        );

      case 'error':
      default:
        return (
          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>Verification Failed</CardTitle>
              <CardDescription>{message}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                The verification link may have expired or is invalid. Please try signing up again or request a new verification email.
              </p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
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
                  Go to Login
                </Button>
              </div>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-3xl font-bold">
            <span className="text-4xl">♟️</span>
            <span className="solana-text-gradient">SolMate</span>
          </Link>
        </div>

        {renderContent()}
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
