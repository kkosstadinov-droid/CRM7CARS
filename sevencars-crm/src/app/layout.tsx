import type { Metadata } from "next";
import localFont from "next/font/local";
import { Sofia_Sans } from "next/font/google";
import "./globals.css";

const sofiaSans = Sofia_Sans({
  variable: "--font-sofia-sans",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "600", "700"],
});

const halvar = localFont({
  src: "../../public/fonts/HalvarBreit-Bd.woff2",
  variable: "--font-halvar",
  display: "swap",
});

export const metadata: Metadata = {
  title: "7CARS CRM",
  description: "Web CRM for car import, sales, and resale operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sofiaSans.variable} ${halvar.variable} antialiased`}>{children}</body>
    </html>
  );
}
