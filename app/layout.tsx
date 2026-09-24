import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Navbar } from '@/components/layout/Navbar';
import { MobileNav } from '@/components/layout/MobileNav';

export const metadata: Metadata = {
  title: 'spykke — Encontre pets perdidos',
  description: 'Plataforma para ajudar a encontrar animais perdidos com mapa em tempo real, avistamentos e alertas regionais.',
  keywords: ['pets', 'animais perdidos', 'encontrar pet', 'mapa', 'avistamentos'],
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>
        <Navbar />
        <main className="page-wrapper">
          {children}
        </main>
        <MobileNav />
      </body>
    </html>
  );
}
