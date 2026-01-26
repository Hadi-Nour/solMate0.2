'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Loader2, AlertCircle, CheckCircle2, XCircle, ArrowLeft } from 'lucide-react';
import { useI18n } from '@/lib/i18n/provider';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, direction } = useI18n();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setValidating(false);
      setError(t('auth.noResetToken'));
      return;
    }

    const validateToken = async () => {
      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();

        if (response.ok && data.valid) {
          setTokenValid(true);
          setUserEmail(data.email);
        } else {
          setError(data.error || t('auth.resetLinkExpired'));
        }
      } catch (err) {
        setError(t('auth.unexpectedError'));
      } finally {
        setValidating(false);
      }
    };

    validateToken();
  }, [token, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('auth.passwordsMustMatch'));
      return;
    }

    if (password.length < 8) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || t('auth.unexpectedError'));
      }
    } catch (err) {
      setError(t('auth.unexpectedError'));
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={direction}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">{t('auth.validatingLink')}</p>
        </motion.div>
      </div>
    );
  }

  // Invalid token state
  if (!tokenValid && !validating) {
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
              <div className="mx-auto w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <CardTitle>{t('auth.invalidResetLink')}</CardTitle>
              <CardDescription>
                {error || t('auth.resetLinkExpired')}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Button
                className="w-full"
                onClick={() => router.push('/auth/forgot-password')}
              >
                {t('auth.requestNewLink')}
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => router.push('/auth/login')}
              >
                <ArrowLeft className="w-4 h-4 me-2" />
                {t('auth.backToSignIn')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Success state
  if (success) {
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
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle>{t('auth.passwordChangedTitle')}</CardTitle>
              <CardDescription>
                {t('auth.passwordChangedSuccess')}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <Button
                className="w-full h-11 solana-gradient text-black font-semibold"
                onClick={() => router.push('/auth/login')}
              >
                {t('auth.signInNow')}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // Form state
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
          <p className="text-muted-foreground mt-2">{t('auth.createNewPassword')}</p>
        </div>

        <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
          <CardHeader className="pb-4">
            <CardTitle>{t('auth.resetPassword')}</CardTitle>
            <CardDescription>
              {t('auth.enterNewPasswordFor')} <strong>{userEmail}</strong>
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.newPasswordLabel')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder={t('auth.newPasswordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="ps-10"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('auth.confirmPasswordLabel')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t('auth.confirmNewPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="ps-10"
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
                    <Loader2 className="w-4 h-4 me-2 animate-spin" />
                    {t('auth.resettingPassword')}
                  </>
                ) : (
                  t('auth.resetPasswordButton')
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex-col gap-4 pt-0">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/auth/login')}
            >
              <ArrowLeft className="w-4 h-4 me-2" />
              {t('auth.backToSignIn')}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useI18n();
  
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
