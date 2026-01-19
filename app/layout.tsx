import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { SessionProvider } from '@/components/providers/session-provider';
import './globals.css';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'Vanguard - Sistema de Gestión Inteligente',
  description: 'Sistema de gestión de inventarios con inteligencia artificial',
  manifest: '/manifest.json',
};

export const viewport = {
  themeColor: '#10b981',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${jetbrainsMono.variable} font-mono antialiased`}>
        <SessionProvider>
          <I18nProvider>
            {children}
          </I18nProvider>
        </SessionProvider>
      </body>
    </html>
  );
}