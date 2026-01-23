'use client';

import { I18nProvider } from '@/lib/i18n/provider';
import { SolanaWalletProvider } from '@/components/wallet/SolanaWalletProvider';

export default function Providers({ children }) {
  return (
    <SolanaWalletProvider>
      <I18nProvider>
        {children}
      </I18nProvider>
    </SolanaWalletProvider>
  );
}
