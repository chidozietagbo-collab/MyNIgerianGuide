import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";

const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "MyNigerianGuide — Find trusted Nigerian businesses",
    template: "%s | MyNigerianGuide",
  },
  description:
    "Nigeria's business directory and social platform. Discover, connect with, and follow trusted local businesses across Nigeria.",
  metadataBase: new URL("https://mynigerianguide.com"),
};

export const viewport: Viewport = {
  themeColor: "#0E7A4F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} font-body antialiased bg-ink-50 text-ink-700`}>
        {children}
      </body>
    </html>
  );
}
