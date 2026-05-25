import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { I18nProvider } from '@/components/providers/i18n-provider';
import { SessionProvider } from '@/components/providers/session-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { ErrorBoundary } from '@/components/error/ErrorBoundary';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
});

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
  themeColor: '#5E6AD2',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <ThemeProvider>
          <SessionProvider>
            <I18nProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </I18nProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
