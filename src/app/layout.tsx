import type { Metadata, Viewport } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";

const bodoni = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Astral — your chart, read properly",
  description:
    "A natal chart calculated from real ephemeris data: planets, houses, aspects, transits, synastry, and an astrologer you can ask.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodoni.variable} ${manrope.variable} h-full`}>
      <body className="min-h-full antialiased">
        <div className="nebula" aria-hidden />
        <div className="starfield" aria-hidden />
        {children}
      </body>
    </html>
  );
}
