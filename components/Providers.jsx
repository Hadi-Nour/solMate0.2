'use client';

import { I18nProvider } from '@/lib/i18n/provider';
import { SolanaWalletProvider } from '@/components/wallet/SolanaWalletProvider';
import ServiceWorkerRegistration from '@/components/ServiceWorkerRegistration';

export default function Providers({ children }) {
  return (
    <SolanaWalletProvider>
      <I18nProvider>
        <ServiceWorkerRegistration />
        {children}
      </I18nProvider>
    </SolanaWalletProvider>
  );
}
