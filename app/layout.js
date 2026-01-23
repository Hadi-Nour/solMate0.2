import './globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'SolMate - Solana Chess',
  description: 'Play chess on Solana. Earn cosmetics, compete in VIP Arena, and collect rewards.',
  manifest: '/manifest.json',
  themeColor: '#14F195',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SolMate',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body className="bg-background text-foreground min-h-screen">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
