import type { Metadata } from "next";
import { Fraunces, JetBrains_Mono, Nunito } from "next/font/google";
import "./globals.css";

const nunito = Nunito({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const fraunces = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "KS2 Mastery · Spelling",
  description: "Cloudflare-first KS2 spelling practice with Gemini TTS and browser offline fallback.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB" className={`${nunito.variable} ${fraunces.variable} ${jetBrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
