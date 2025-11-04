import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Einstein Video Generator',
  description: 'Generate a short WebM video about Albert Einstein in-browser',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
