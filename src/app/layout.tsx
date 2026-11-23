import type { Metadata, Viewport } from "next";
import { Press_Start_2P, VT323 } from "next/font/google";
import "./globals.css";

const pixel = Press_Start_2P({
  variable: "--font-pixel",
  weight: "400",
  subsets: ["latin"],
});

const pixText = VT323({
  variable: "--font-vt",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GROWTOPIA WEB — Fan Demo",
  description:
    "Game sandbox 2D pixel-art bergaya Growtopia: hancurkan & pasang blok world default (dirt, lava, air, cave, bedrock, pintu). Fan-made demo.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#6ec2f2",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={`${pixel.variable} ${pixText.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
