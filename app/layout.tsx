import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cashual — Split Expenses Intelligently',
  description:
    'Split expenses fairly with friends, scan receipts with AI, and track your personal spending. The smart way to manage shared costs.',
  keywords: 'expense splitting, receipt scanner, shared expenses, budget tracking, split bills',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,300..800;1,14..32,300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
