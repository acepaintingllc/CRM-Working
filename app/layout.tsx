import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACE Painting",
  description: "ACE Painting CRM",
};

const themeScript = `
(() => {
  try {
    const key = 'acecrm.theme';
    const stored = localStorage.getItem(key);
    const theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
  } catch {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
