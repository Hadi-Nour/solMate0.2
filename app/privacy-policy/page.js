'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
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
            <h1 className="text-3xl font-bold solana-text-gradient">SolMate Privacy Policy</h1>
          </div>
          <p className="text-muted-foreground">Last updated: June 2025</p>
        </div>

        {/* Content */}
        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to SolMate ("we," "our," or "us"). This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our chess gaming application and website at playsolmates.app (the "Service").
            </p>
            <p className="text-muted-foreground leading-relaxed mt-3">
              Please read this privacy policy carefully. If you do not agree with the terms of this privacy policy, please do not access the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.1 Personal Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              We may collect personal information that you voluntarily provide when you:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Create an account (email address, display name)</li>
              <li>Sign in using social providers (Google, Facebook, X/Twitter)</li>
              <li>Connect a Solana wallet address</li>
              <li>Contact us for support</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.2 Automatically Collected Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you access our Service, we may automatically collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and approximate location</li>
              <li>Game statistics and play history</li>
              <li>Usage data (pages visited, features used)</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.3 Blockchain Information</h3>
            <p className="text-muted-foreground leading-relaxed">
              When you connect a Solana wallet or make transactions, we may collect:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Wallet public addresses</li>
              <li>Transaction signatures (for payment verification)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-2">
              Note: We never have access to your private keys or seed phrases.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">3. How We Use Your Information</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use the collected information to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Provide, operate, and maintain the Service</li>
              <li>Create and manage your account</li>
              <li>Process transactions and verify payments</li>
              <li>Match you with other players for online games</li>
              <li>Track game statistics and leaderboards</li>
              <li>Send you service-related communications</li>
              <li>Improve and personalize your experience</li>
              <li>Detect and prevent fraud or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">4. Information Sharing</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may share your information in the following situations:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>With Other Players:</strong> Your display name, avatar, and game statistics may be visible to other players</li>
              <li><strong>Service Providers:</strong> Third-party services that help us operate (hosting, analytics)</li>
              <li><strong>Legal Requirements:</strong> If required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              We do not sell your personal information to third parties.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">5. Third-Party Services</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service integrates with third-party services:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li><strong>Solana Blockchain:</strong> For wallet authentication and payments</li>
              <li><strong>Google OAuth:</strong> For social sign-in</li>
              <li><strong>Facebook/Meta:</strong> For social sign-in</li>
              <li><strong>X (Twitter):</strong> For social sign-in</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              These services have their own privacy policies, and we encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">6. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide you services. You can request deletion of your account and associated data at any time.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">8. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
              <li>Access the personal information we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-3">
              To exercise these rights, please contact us at <a href="mailto:support@playsolmates.app" className="text-primary hover:underline">support@playsolmates.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">9. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mb-4">11. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <ul className="list-none text-muted-foreground mt-2 space-y-1">
              <li>Email: <a href="mailto:support@playsolmates.app" className="text-primary hover:underline">support@playsolmates.app</a></li>
              <li>Website: <a href="https://playsolmates.app" className="text-primary hover:underline">https://playsolmates.app</a></li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-border text-center text-sm text-muted-foreground">
          <p>© 2025 SolMate. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
