'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Mail, Lock, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/provider';

// OAuth provider icons
const ProviderIcons = {
  google: (
    <svg className="w-5 h-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  twitter: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
};

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [providers, setProviders] = useState(null);

  const callbackUrl = searchParams.get('callbackUrl') || '/';
  const errorParam = searchParams.get('error');

  useEffect(() => {
    getProviders().then(setProviders);
    
    if (errorParam) {
      const errorMessages = {
        'CredentialsSignin': 'Invalid email or password',
        'OAuthSignin': 'Error signing in with provider',
        'OAuthCallback': 'Error during OAuth callback',
        'OAuthCreateAccount': 'Error creating OAuth account',
        'EmailCreateAccount': 'Error creating email account',
        'Callback': 'Error during callback',
        'OAuthAccountNotLinked': 'This email is already linked to another account',
        'default': 'An error occurred during sign in',
      };
      setError(errorMessages[errorParam] || errorMessages.default);
    }
  }, [errorParam]);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Handle specific error cases with user-friendly messages
        const errorMessage = result.error;
        
        // Check if it's an email verification error
        if (errorMessage.toLowerCase().includes('verify') || 
            errorMessage.toLowerCase().includes('not verified') ||
            errorMessage.toLowerCase().includes('email verification')) {
          // Redirect to signup with email to trigger OTP resend
          toast.error('Please verify your email first');
          router.push(`/auth/signup?email=${encodeURIComponent(email)}&resend=true`);
          return;
        }
        
        // Map error messages to user-friendly versions
        const errorMap = {
          'CredentialsSignin': 'Invalid email or password',
          'Invalid credentials': 'Invalid email or password',
          'No user found': 'No account found with this email',
          'Invalid password': 'Invalid email or password',
        };
        
        setError(errorMap[errorMessage] || errorMessage);
      } else {
        // Also get our custom JWT token for API calls
        try {
          const tokenRes = await fetch('/api/auth/get-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
          });
          
          if (tokenRes.ok) {
            const tokenData = await tokenRes.json();
            if (tokenData.token) {
              localStorage.setItem('solmate_token', tokenData.token);
              if (tokenData.user) {
                localStorage.setItem('user', JSON.stringify(tokenData.user));
              }
            }
          }
        } catch (tokenErr) {
          console.warn('Failed to get custom token:', tokenErr);
        }
        
        toast.success(t('auth.signedInSuccess') || 'Signed in successfully!');
        router.push(callbackUrl);
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    await signIn(provider, { callbackUrl });
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
          <p className="text-muted-foreground mt-2">{t('auth.signInTagline') || 'Sign in to play chess on Solana'}</p>
        </div>

        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle>{t('auth.welcomeBack') || 'Welcome back'}</CardTitle>
            <CardDescription>{t('auth.signInDesc') || 'Sign in to your account to continue'}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Error message */}
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* OAuth Buttons */}
            <div className="space-y-2">
              {providers?.google && (
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={loading}
                >
                  {ProviderIcons.google}
                  <span className="ml-2">{t('login.continueWithGoogle') || 'Continue with Google'}</span>
                </Button>
              )}
              {providers?.facebook && (
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('facebook')}
                  disabled={loading}
                >
                  {ProviderIcons.facebook}
                  <span className="ml-2">{t('login.continueWithFacebook') || 'Continue with Facebook'}</span>
                </Button>
              )}
              {providers?.twitter && (
                <Button
                  variant="outline"
                  className="w-full h-11"
                  onClick={() => handleOAuthLogin('twitter')}}
                  disabled={loading}
                >
                  {ProviderIcons.twitter}
                  <span className="ml-2">{t('login.continueWithX') || 'Continue with X'}</span>
                </Button>
              )}
            </div>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                {t('auth.orContinueEmail') || 'or continue with email'}
              </span>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.email') || 'Email'}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">{t('auth.password') || 'Password'}</Label>
                  <Link href="/auth/forgot-password" className="text-xs text-primary hover:underline">
                    {t('auth.forgotPassword') || 'Forgot password?'}
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-11 solana-gradient text-black font-semibold"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('auth.signingIn') || 'Signing in...'}
                  </>
                ) : (
                  t('auth.signIn') || 'Sign In'
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-4 pt-0">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.noAccount') || "Don't have an account?"}{' '}
              <Link href="/auth/signup" className="text-primary hover:underline font-medium">
                {t('auth.signUp') || 'Sign up'}
              </Link>
            </p>
          </CardFooter>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          By continuing, you agree to our{' '}
          <Link href="/privacy-policy" className="underline">Privacy Policy</Link>
          {' '}and{' '}
          <Link href="/privacy-policy" className="underline">Terms of Service</Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
