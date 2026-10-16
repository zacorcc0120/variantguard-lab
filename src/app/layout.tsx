import type { Metadata, Viewport } from 'next';
import './globals.css';
import { BOOTSTRAP_SCRIPT, I18nProvider } from '@/i18n/provider';

export const metadata: Metadata = {
  title: 'VariantGuard Lab — Shopify CSV import risk checker',
  description:
    'Compare a baseline Shopify product CSV export against a proposed re-import and see which rows would lose variants, clear inventory or create duplicate products — entirely in your browser.',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `lang` starts as the server-rendered locale. The bootstrap script below
    // rewrites it before first paint when the visitor's real locale differs.
    <html lang="en">
      <head>
        {/*
          Runs before the body is parsed, so the correct font stack and the boot
          gate are in place for the first frame. Without it a Chinese visitor
          would get a visible English-then-Chinese swap, and a CJK page painted
          with a Latin font metrics first.
        */}
        <script dangerouslySetInnerHTML={{ __html: BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
