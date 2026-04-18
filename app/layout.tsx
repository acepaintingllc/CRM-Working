import type { Metadata } from "next";
import Script from "next/script";
import ServiceWorkerRegister from "./ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: "ACE Painting",
  description: "ACE Painting CRM",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ACE Field Cam",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Script src="/theme-init.js" strategy="beforeInteractive" />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
