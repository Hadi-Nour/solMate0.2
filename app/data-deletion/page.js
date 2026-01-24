'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function DataDeletionPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    setLoading(true);
    
    // In production, this would call an API endpoint
    // For now, we just show a success message
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      toast.success('Deletion request submitted');
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to App
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-4xl">♟️</span>
            <h1 className="text-3xl font-bold solana-text-gradient">Data Deletion</h1>
          </div>
          <p className="text-muted-foreground">Request deletion of your SolMate account and data</p>
        </div>

        {submitted ? (
          <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <CardTitle>Request Submitted</CardTitle>
              <CardDescription>
                We've received your data deletion request
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-center">
              <p className="text-muted-foreground">
                Your request has been submitted successfully. We will process your deletion request within 30 days and send a confirmation email to <strong>{email}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                If you signed in with a social provider (Google, Facebook, or X), you may also want to revoke app permissions from their settings.
              </p>
              <div className="pt-4">
                <Link href="/">
                  <Button className="solana-gradient text-black font-semibold">
                    Return to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Info Card */}
            <Card className="border-amber-500/30 bg-amber-500/10 mb-6">
              <CardContent className="pt-6">
                <div className="flex gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-amber-500 mb-1">What will be deleted?</h3>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Your account and profile information</li>
                      <li>• Game history and statistics</li>
                      <li>• Friends list and social connections</li>
                      <li>• Inventory and cosmetics</li>
                      <li>• VIP status and rewards</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3">
                      <strong>Note:</strong> Blockchain transactions (if any) cannot be deleted as they are permanently recorded on the Solana network.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Deletion Form */}
            <Card className="border-0 shadow-xl bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-destructive" />
                  Request Account Deletion
                </CardTitle>
                <CardDescription>
                  Enter the email address associated with your SolMate account
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      This should be the email you used to create your account or the email from your social login provider.
                    </p>
                  </div>

                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Processing...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Request Data Deletion
                        </>
                      )}
                    </Button>
                  </div>
                </form>

                <div className="mt-6 pt-6 border-t border-border">
                  <h4 className="font-medium mb-2">Alternative: Contact Us Directly</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    You can also request data deletion by emailing us:
                  </p>
                  <a 
                    href="mailto:support@playsolmates.app?subject=Data Deletion Request" 
                    className="text-primary hover:underline text-sm"
                  >
                    support@playsolmates.app
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Social Provider Links */}
            <Card className="mt-6 border-0 shadow-xl bg-card/80 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-lg">Revoke Social Login Permissions</CardTitle>
                <CardDescription>
                  If you signed in with a social provider, you can also revoke SolMate's access:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <a 
                  href="https://myaccount.google.com/connections" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <div>
                      <div className="font-medium">Google Account Connections</div>
                      <div className="text-xs text-muted-foreground">myaccount.google.com/connections</div>
                    </div>
                  </div>
                </a>

                <a 
                  href="https://www.facebook.com/settings?tab=applications" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <div>
                      <div className="font-medium">Facebook App Settings</div>
                      <div className="text-xs text-muted-foreground">facebook.com/settings?tab=applications</div>
                    </div>
                  </div>
                </a>

                <a 
                  href="https://twitter.com/settings/connected_apps" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    <div>
                      <div className="font-medium">X (Twitter) Connected Apps</div>
                      <div className="text-xs text-muted-foreground">twitter.com/settings/connected_apps</div>
                    </div>
                  </div>
                </a>
              </CardContent>
            </Card>
          </>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>
            Questions? Contact us at{' '}
            <a href="mailto:support@playsolmates.app" className="text-primary hover:underline">
              support@playsolmates.app
            </a>
          </p>
          <p className="mt-2">© 2025 SolMate. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
