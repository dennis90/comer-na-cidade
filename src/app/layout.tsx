import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://comernacidade.com.br';

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: 'Comer na Cidade — Comércios na sua cidade',
    template: '%s | Comer na Cidade',
  },
  description: 'Encontre restaurantes, padarias e comércios locais. Veja cardápios, horários e formas de atendimento.',
  openGraph: {
    siteName: 'Comer na Cidade',
    locale: 'pt_BR',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
