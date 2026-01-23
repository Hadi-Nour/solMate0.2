import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata = {
  title: 'SolMate - Solana Chess',
  description: 'Play chess on Solana. Earn cosmetics, compete in VIP Arena, and collect rewards.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SolMate',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#14F195',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon-192.svg" />
        <link rel="apple-touch-icon" href="/icon-512.svg" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-background text-foreground min-h-screen">
        {children}
        <Toaster position="bottom-center" richColors />
      </body>
    </html>
  );
}
