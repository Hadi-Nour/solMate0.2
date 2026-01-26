'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Mail, Lock, User, Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
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

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, direction } = useI18n();
  
  // Check for redirect params (from login page when email not verified)
  const redirectEmail = searchParams.get('email');
  const shouldResend = searchParams.get('resend') === 'true';
  
  const [step, setStep] = useState('signup'); // 'signup' | 'verify'
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState(redirectEmail || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  // Auto-resend OTP if user was redirected from login with unverified email
  useEffect(() => {
    if (redirectEmail && shouldResend) {
      handleResendFromLogin();
    }
  }, [redirectEmail, shouldResend]);

  const handleResendFromLogin = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: redirectEmail,
          resendOnly: true, // Just resend OTP, don't create new account
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(t('auth.verificationCodeSent'));
        setStep('verify');
      } else {
        setError(data.error || t('auth.failedToResend'));
      }
    } catch (err) {
      setError(t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validation
    if (!agreedToTerms) {
      setError(t('auth.mustAgreeTerms'));
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsMustMatch'));
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordMinLength'));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, agreedToTerms }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('auth.unexpectedError'));
        return;
      }

      // Show OTP verification step
      setStep('verify');
      toast.success(t('auth.verificationCodeSent'));
    } catch (err) {
      setError(t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      setError(t('auth.invalidOtp'));
      return;
    }

    setVerifying(true);
    setError('');

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t('auth.verificationFailed'));
        return;
      }

      // Store auth token and redirect to game
      if (data.authToken) {
        localStorage.setItem('solmate_token', data.authToken);
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
      }

      toast.success(t('auth.emailVerified'));
      router.push('/');
    } catch (err) {
      setError(t('auth.verificationFailed'));
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOTP = async () => {
    setResending(true);
    setError('');

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName, agreedToTerms }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(t('auth.newVerificationCode'));
        setOtp('');
      } else {
        setError(data.error || t('auth.failedToResend'));
      }
    } catch (err) {
      setError(t('auth.failedToResend'));
    } finally {
      setResending(false);
    }
  };

  const handleOAuthLogin = async (provider) => {
    setLoading(true);
    await signIn(provider, { callbackUrl: '/' });
  };

  // OTP Verification Step
  if (step === 'verify') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={direction}>
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
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <CardTitle>{t('auth.verifyYourEmail')}</CardTitle>
              <CardDescription>
                {t('auth.weSentCode')} <strong>{email}</strong>
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex justify-center">
                <InputOTP 
                  value={otp} 
                  onChange={setOtp} 
                  maxLength={6}
                  className="gap-2"
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={1} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={2} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={3} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={4} className="w-12 h-14 text-xl" />
                    <InputOTPSlot index={5} className="w-12 h-14 text-xl" />
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button
                onClick={handleVerifyOTP}
                className="w-full h-11 solana-gradient text-black font-semibold"
                disabled={verifying || otp.length !== 6}
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('auth.verifying') || 'Verifying...'}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {t('auth.verifyBtn') || 'Verify & Sign In'}
                  </>
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  {t('auth.didntReceiveCode') || "Didn't receive the code?"}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResendOTP}
                  disabled={resending}
                >
                  {resending ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      {t('auth.sending') || 'Sending...'}
                    </>
                  ) : (
                    t('auth.resendCode') || 'Resend code'
                  )}
                </Button>
              </div>
            </CardContent>

            <CardFooter>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => setStep('signup')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('auth.backToSignup') || 'Back to signup'}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Signup Form
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={direction}>
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
          <p className="text-muted-foreground mt-2">{t('auth.signUpTagline')}</p>
        </div>

        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle>{t('auth.createAccount')}</CardTitle>
            <CardDescription>{t('auth.signInTagline')}</CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            {/* OAuth Buttons */}
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => handleOAuthLogin('google')}
                disabled={loading}
              >
                {ProviderIcons.google}
                <span className="ml-2">{t('login.continueWithGoogle') || 'Continue with Google'}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => handleOAuthLogin('facebook')}
                disabled={loading}
              >
                {ProviderIcons.facebook}
                <span className="ml-2">{t('login.continueWithFacebook') || 'Continue with Facebook'}</span>
              </Button>
              <Button
                variant="outline"
                className="w-full h-11"
                onClick={() => handleOAuthLogin('twitter')}
                disabled={loading}
              >
                {ProviderIcons.twitter}
                <span className="ml-2">{t('login.continueWithX') || 'Continue with X'}</span>
              </Button>
            </div>

            <div className="relative">
              <Separator />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                {t('auth.orSignUpEmail') || 'or sign up with email'}
              </span>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">{t('auth.displayName') || 'Display Name'} ({t('common.optional') || 'optional'})</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="ChessMaster"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

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
                <Label htmlFor="password">{t('auth.password') || 'Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('auth.passwordPlaceholder') || 'At least 8 characters'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPassword') || 'Confirm Password'}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('auth.confirmPasswordPlaceholder') || 'Confirm your password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Terms & Conditions Checkbox */}
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={setAgreedToTerms}
                  className="mt-1"
                />
                <Label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                  {t('auth.agreeTerms') || 'I agree to the'}{' '}
                  <Link href="/privacy-policy" className="text-primary hover:underline">
                    {t('auth.termsConditions') || 'Terms & Conditions'}
                  </Link>{' '}
                  {t('auth.and') || 'and'}{' '}
                  <Link href="/privacy-policy" className="text-primary hover:underline">
                    {t('auth.privacyPolicy') || 'Privacy Policy'}
                  </Link>
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-11 solana-gradient text-black font-semibold"
                disabled={loading || !agreedToTerms}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('auth.creatingAccount') || 'Creating account...'}
                  </>
                ) : (
                  t('auth.createAccount') || 'Create Account'
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-4 pt-0">
            <p className="text-sm text-muted-foreground text-center">
              {t('auth.alreadyHaveAccount') || 'Already have an account?'}{' '}
              <Link href="/auth/login" className="text-primary hover:underline font-medium">
                {t('auth.signIn') || 'Sign in'}
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <SignupContent />
    </Suspense>
  );
}
