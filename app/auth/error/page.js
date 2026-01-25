'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const error = searchParams.get('error');

  const errorMessages = {
    'Configuration': 'There is a problem with the server configuration. Please try again later.',
    'AccessDenied': 'Access was denied. You may have cancelled the sign-in or don\'t have permission.',
    'Verification': 'The verification link has expired or has already been used.',
    'OAuthSignin': 'There was an error signing in with the provider. Please try again.',
    'OAuthCallback': 'There was an error during the OAuth callback. Please try again.',
    'OAuthCreateAccount': 'Could not create an account with this OAuth provider.',
    'EmailCreateAccount': 'Could not create an account with this email.',
    'Callback': 'There was an error during the authentication callback.',
    'OAuthAccountNotLinked': 'This email is already associated with another account. Please sign in with the original method you used.',
    'EmailSignin': 'The email could not be sent. Please try again.',
    'CredentialsSignin': 'The credentials you provided are invalid.',
    'SessionRequired': 'You need to be signed in to access this page.',
    'default': 'An unexpected error occurred during authentication.',
  };

  const errorMessage = errorMessages[error] || errorMessages.default;

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
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Authentication Error</CardTitle>
            <CardDescription className="text-base">
              {errorMessage}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <p className="text-xs text-muted-foreground bg-muted p-2 rounded font-mono">
                Error code: {error}
              </p>
            )}
            
            <div className="flex flex-col gap-2 pt-4">
              <Button
                className="w-full solana-gradient text-black font-semibold"
                onClick={() => router.push('/auth/login')}
              >
                Try Again
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push('/')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>

            <div className="pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                If this problem persists, please contact{' '}
                <a href="mailto:support@playsolmates.app" className="text-primary hover:underline">
                  support@playsolmates.app
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <AuthErrorContent />
    </Suspense>
  );
}
