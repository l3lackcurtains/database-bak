import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Crumet Sync',
  description: 'Database backup, restore, and migration management for Crumet Sync',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('crumet-theme');if(t==='dark'||t==='system'&&matchMedia('(prefers-color-scheme:dark)').matches||!t&&matchMedia('(prefers-color-scheme:dark)').matches)document.documentElement.classList.add('dark')})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
