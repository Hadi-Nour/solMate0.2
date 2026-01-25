'use client';

import { I18nProvider } from '@/lib/i18n/provider';
import { SolanaWalletProvider } from '@/components/wallet/SolanaWalletProvider';
import { FeedbackProvider } from '@/lib/feedback/provider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export default function Providers({ children }) {
  return (
    <SolanaWalletProvider>
      <I18nProvider>
        <FeedbackProvider>
          <ServiceWorkerRegistration />
          {children}
        </FeedbackProvider>
      </I18nProvider>
    </SolanaWalletProvider>
  );
}
