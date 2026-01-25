'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, Mail, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // NextAuth redirects here after sending the magic link email
  // The 'type' param indicates what kind of verification request
  const type = searchParams.get('type');
  const provider = searchParams.get('provider');
  
  // Legacy token verification (for backwards compatibility)
  const token = searchParams.get('token');
  const [legacyStatus, setLegacyStatus] = useState('verifying');
  const [legacyMessage, setLegacyMessage] = useState('');

  // Handle legacy token verification
  useEffect(() => {
    if (!token) return;

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          if (data.alreadyVerified) {
            setLegacyStatus('already-verified');
            setLegacyMessage('Your email is already verified');
          } else {
            setLegacyStatus('success');
            setLegacyMessage(data.message || 'Email verified successfully!');
          }
        } else {
          setLegacyStatus('error');
          setLegacyMessage(data.error || 'Verification failed');
        }
      })
      .catch((err) => {
        console.error('Verification error:', err);
        setLegacyStatus('error');
        setLegacyMessage('An error occurred during verification');
      });
  }, [token]);

  // If we have a token, show legacy verification UI
  if (token) {
    return renderLegacyContent();
  }

  // NextAuth Magic Link - Show "Check your email" message
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
            <span className="solana-text-gradient">PlaySolMates</span>
          </Link>
        </div>

        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl text-center">
          <CardHeader>
            <motion.div 
              className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mb-4"
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              <Inbox className="w-10 h-10 text-primary" />
            </motion.div>
            <CardTitle className="text-2xl">Check your email</CardTitle>
            <CardDescription className="text-base">
              A magic link has been sent to your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-muted-foreground">
                Click the link in the email to sign in to your PlaySolMates account. 
                The link will expire in <span className="font-semibold text-foreground">24 hours</span>.
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4" />
              <span>Can't find the email? Check your spam folder.</span>
            </div>

            <div className="pt-4 border-t border-border space-y-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push('/auth/login')}
              >
                Back to Sign In
              </Button>
              <p className="text-xs text-muted-foreground">
                Wrong email? <Link href="/auth/login" className="text-primary hover:underline">Try again</Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Having trouble? <Link href="/support" className="text-primary hover:underline">Contact Support</Link>
        </p>
      </motion.div>
    </div>
  );

  // Legacy token verification UI
  function renderLegacyContent() {
    const renderStatusContent = () => {
      switch (legacyStatus) {
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
                <CardDescription>{legacyMessage}</CardDescription>
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
                <CardDescription>{legacyMessage}</CardDescription>
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
                <CardDescription>{legacyMessage}</CardDescription>
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
              <span className="solana-text-gradient">PlaySolMates</span>
            </Link>
          </div>

          {renderStatusContent()}
        </motion.div>
      </div>
    );
  }
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
