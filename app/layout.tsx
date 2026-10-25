import type { Metadata } from 'next';
import '../public/app.css';
import '../public/fear-chart.css';
export const metadata: Metadata = {
  title: 'Small Steps — Your progress, at your pace',
  description: 'Celebrate every small win. Track psychological readiness, movement confidence, gratitude, and personal milestones.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg' },
};
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="en"><body>{children}</body></html>;
}
